/** Listas (popular, recientes, búsqueda por etiqueta/artista…), home y filtros. */

import { DEFAULT_LANGUAGE, LANGUAGES, NAMESPACES, ORDERS, TYPES } from "./config.js";
import { galleryInfo, loadGg, thumbnailUrl } from "./gallery.js";
import { readIds } from "./nozomi.js";
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

async function page(host, query, number, filters) {
  const { ids, hasNext } = await readIds(host, listPath({ ...filters, term: query }), pageNumber(number));
  return { items: await summaries(host, ids), hasNext };
}

export const popular = (host, number) => page(host, "", number, { order: "week" });
export const latest = (host, number) => page(host, "", number, { order: "new" });
export const search = (host, query, number, filters) => page(host, query, number, filters ?? {});

export async function home(host) {
  const sections = await Promise.all(
    SECTIONS.map(async ({ value, label }) => {
      const result = await page(host, "", 1, { order: value });
      return { id: value, title: label, kind: "list", items: result.items, hasNext: result.hasNext };
    }),
  );
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
