/** Listas (popular, recientes, búsqueda por etiqueta/artista…), home y filtros. */

import { DEFAULT_LANGUAGE, LANGUAGES, NAMESPACES, ORDERS, TYPES } from "./config.js";
import { galleryInfo, loadGg, thumbnailUrl } from "./gallery.js";
import { idsForWord, indexVersion } from "./btree.js";
import { PAGE_SIZE } from "./config.js";
import { readAllIds, readIds } from "./nozomi.js";
import { imageHeaders } from "./utils/http.js";

const SECTIONS = [ORDERS[0], ORDERS[2]];

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export function names(list, key) {
  return (list ?? []).map((entry) => entry[key]).filter(Boolean);
}

export function summaryOf(info, gg) {
  const artists = names(info.artists, "artist").join(", ");
  const badges = [info.type, info.language].filter(Boolean);
  return {
    id: String(info.id),
    title: info.title ?? info.japanese_title ?? `#${info.id}`,
    cover: { url: thumbnailUrl(gg, info.files[0].hash), headers: imageHeaders() },
    kind: "manga",
    nsfw: true,
    ...(badges.length > 0 ? { badges } : {}),
    ...(artists === "" ? {} : { hint: artists }),
  };
}

/** Una galería caída no rompe la lista; si caen todas, se propaga el primer error. */
async function summaries(host, ids) {
  if (ids.length === 0) return [];
  const gg = await loadGg(host);
  const settled = await Promise.allSettled(ids.map((id) => galleryInfo(host, id)));
  const items = settled.filter((r) => r.status === "fulfilled").map((r) => summaryOf(r.value, gg));
  if (items.length === 0) throw settled[0].reason;
  return items;
}

/** Ruta de la lista `.nozomi`. Prioridad: término de búsqueda > tipo > orden. */
export function listPath({ term, type, order, language }) {
  const lang = LANGUAGES.some((l) => l.value === language) ? language : DEFAULT_LANGUAGE;
  const word = String(term ?? "").trim().split(/\s+/u)[0] ?? "";
  if (word !== "") {
    const [namespace, ...rest] = word.includes(":") ? word.split(":") : ["tag", word];
    const area = NAMESPACES[namespace];
    const value = rest.join(":").replace(/_/gu, " ");
    if (area !== undefined && value !== "") {
      const tag = namespace === "female" || namespace === "male" ? `${namespace}:${value}` : value;
      return `${area}/${encodeURIComponent(tag)}-${lang}`;
    }
  }
  if (TYPES.some((t) => t.value === type)) return `type/${type}-${lang}`;
  const chosen = ORDERS.find((o) => o.value === order) ?? ORDERS[0];
  return chosen.tag === null ? `${chosen.area}-${lang}` : `${chosen.area}/${chosen.tag}-${lang}`;
}

/** Palabras de la consulta como las trata el sitio: minúsculas, `_` = espacio. */
export function queryTerms(query) {
  return String(query ?? "")
    .toLowerCase()
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => term.replace(/_/gu, " "));
}

// shortcut: por instancia del módulo solo se recuerda la última búsqueda (la paginación no repite
// el recorrido); si se alternan consultas, cada cambio vuelve a leer el índice.
const lastSearch = new WeakMap();

/**
 * T45 · IDs de una búsqueda con texto libre: cada palabra por el B-tree, cada `namespace:valor`
 * por su lista y, con un idioma concreto, cruzado con `index-<idioma>`. Todas deben cumplirse.
 */
async function textSearchIds(host, terms, language) {
  const lang = LANGUAGES.some((l) => l.value === language) ? language : DEFAULT_LANGUAGE;
  const key = `${lang}|${terms.join(" ")}`;
  const cached = lastSearch.get(host);
  if (cached?.key === key) return cached.ids;
  const version = await indexVersion(host);
  const lists = [];
  for (const term of terms) {
    lists.push(
      term.includes(":")
        ? await readAllIds(host, listPath({ term: term.replace(/ /gu, "_"), language: lang }))
        : await idsForWord(host, version, term),
    );
  }
  if (lang !== "all") lists.push(await readAllIds(host, `index-${lang}`));
  const [first, ...rest] = lists.sort((a, b) => a.length - b.length);
  const sets = rest.map((list) => new Set(list));
  const ids = (first ?? [])
    .filter((id) => sets.every((set) => set.has(id)))
    .sort((a, b) => Number(b) - Number(a)); // más nuevo primero
  lastSearch.set(host, { key, ids });
  return ids;
}

async function page(host, query, number, filters) {
  const terms = queryTerms(query);
  if (terms.some((term) => !term.includes(":"))) {
    const ids = await textSearchIds(host, terms, filters.language);
    const start = (pageNumber(number) - 1) * PAGE_SIZE;
    return {
      items: await summaries(host, ids.slice(start, start + PAGE_SIZE)),
      hasNext: ids.length > start + PAGE_SIZE,
    };
  }
  const { ids, hasNext } = await readIds(host, listPath({ ...filters, term: query }), pageNumber(number));
  return { items: await summaries(host, ids), hasNext };
}

export const popular = (host, number) => page(host, "", number, { order: "week" });
export const latest = (host, number) => page(host, "", number, { order: "new" });
export const search = (host, query, number, filters) => page(host, query, number, filters ?? {});

export async function home(host) {
  const sections = [];
  for (const section of SECTIONS) {
    const result = await page(host, "", 1, { order: section.value });
    sections.push({ id: section.value, title: section.label, kind: "list", items: result.items, hasNext: result.hasNext });
  }
  return { sections };
}

export function list(host, sectionId, number) {
  return page(host, "", number, { order: sectionId });
}

export function filters() {
  const select = (id, label, options) => ({ id, label, type: "select", options });
  return [
    select("language", "Idioma", LANGUAGES),
    select("order", "Orden", ORDERS.map(({ value, label }) => ({ value, label }))),
    select("type", "Tipo", TYPES),
  ];
}
