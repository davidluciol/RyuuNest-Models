/** Listas (recientes, populares, búsqueda), home y filtros sobre el HTML del índice. */

import { ALL_CATEGORIES, BASE_URL, CATEGORIES, DEFAULT_LANGUAGE, LANGUAGES, RATINGS } from "./config.js";
import { fail } from "./utils/errors.js";
import { fetchText, imageHeaders } from "./utils/http.js";

const GALLERY_PATH = /\/g\/(\d+)\/([0-9a-f]+)\/?/u;
/** Etiquetas `language:` que no son idiomas. */
const NOT_LANGUAGES = new Set(["translated", "rewrite", "speechless"]);

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/** `female:big breasts` → `female:"big breasts$"` (sintaxis exacta del buscador). */
function tagTerm(tag) {
  const text = String(tag).trim();
  const colon = text.indexOf(":");
  if (colon < 0) return text.includes(" ") ? `"${text}"` : text;
  return `${text.slice(0, colon).trim()}:"${text.slice(colon + 1).trim()}$"`;
}

/** URL de la primera página de una búsqueda. */
export function listUrl(query, filters = {}) {
  const language = LANGUAGES.some((l) => l.value === filters.language) ? filters.language : DEFAULT_LANGUAGE;
  const terms = [String(query ?? "").trim()];
  if (language !== "any") terms.push(`language:${language}`);
  for (const tag of asArray(filters.tags)) if (String(tag).trim() !== "") terms.push(tagTerm(tag));
  const params = new URLSearchParams();
  const text = terms.filter(Boolean).join(" ");
  if (text !== "") params.set("f_search", text);
  const chosen = new Set(asArray(filters.categories).filter((c) => CATEGORIES.some((k) => k.value === c)));
  if (chosen.size > 0) {
    const included = [...chosen].reduce((sum, value) => sum + Number(value), 0);
    params.set("f_cats", String(ALL_CATEGORIES - included));
  }
  if (RATINGS.some((r) => r.value === filters.rating)) {
    params.set("f_sr", "on");
    params.set("f_srdd", filters.rating);
  }
  const qs = params.toString();
  return qs === "" ? `${BASE_URL}/` : `${BASE_URL}/?${qs}`;
}

function languageOf(row) {
  for (const tag of row.select('.gt[title^="language:"]')) {
    const value = tag.attr("title").slice("language:".length);
    if (!NOT_LANGUAGES.has(value)) return LANGUAGES.find((l) => l.value === value)?.label ?? value;
  }
  return undefined;
}

function summaryOf(row) {
  const match = GALLERY_PATH.exec(row.select(".glname a")[0]?.attr("href") ?? "");
  if (!match) return undefined;
  const img = row.select(".glthumb img")[0];
  const cover = [img?.attr("data-src"), img?.attr("src")].find((u) => u && u.startsWith("https://"));
  const category = row.select(".cn")[0]?.text().trim();
  const length = /(\d+) pages?/u.exec(row.select(".gl4c")[0]?.text() ?? "")?.[1];
  return {
    id: `g/${match[1]}/${match[2]}`,
    title: row.select(".glink")[0]?.text().trim() || `#${match[1]}`,
    ...(cover ? { cover: { url: cover, headers: imageHeaders() } } : {}),
    kind: "manga",
    nsfw: true,
    badges: [category, languageOf(row)].filter(Boolean),
    ...(length ? { hint: `${length} págs.` } : {}),
  };
}

export function parseList(doc) {
  return doc.select("table.itg tr").map(summaryOf).filter(Boolean);
}

/** El cursor siguiente solo puede apuntar al propio sitio. */
function nextUrl(doc) {
  const href = doc.select("a#unext")[0]?.attr("href");
  if (!href) return undefined;
  const url = new URL(href, BASE_URL);
  if (url.origin !== BASE_URL) throw fail("PARSE", "Enlace de página siguiente fuera del sitio", { url: href });
  return url.href;
}

/** Página `page` de una lista por cursor: se recorre la cadena `?next=` desde la primera. */
async function listPage(host, firstUrl, page) {
  const target = pageNumber(page);
  let url = firstUrl;
  for (let current = 1; ; current += 1) {
    const doc = host.html(await fetchText(host, url));
    const next = nextUrl(doc);
    if (current === target) return { items: parseList(doc), hasNext: next !== undefined };
    if (next === undefined) return { items: [], hasNext: false };
    url = next;
  }
}

export const latest = (host, page) => listPage(host, listUrl(""), page);
export const search = (host, query, page, filters) => listPage(host, listUrl(query, filters ?? {}), page);

/** `/popular` es una sola página y el sitio no la filtra por idioma. */
export async function popular(host, page) {
  if (pageNumber(page) > 1) return { items: [], hasNext: false };
  return { items: parseList(host.html(await fetchText(host, `${BASE_URL}/popular`))), hasNext: false };
}

const SECTIONS = [
  { id: "latest", title: "Recientes", load: latest },
  { id: "popular", title: "Populares", load: popular },
];

export function list(host, sectionId, page) {
  return (SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0]).load(host, page);
}

export async function home(host) {
  const sections = await Promise.all(
    SECTIONS.map(async ({ id, title, load }) => ({ id, title, kind: "list", ...(await load(host, 1)) })),
  );
  return { sections };
}

export function filters() {
  return [
    { id: "language", label: "Idioma", type: "select", options: LANGUAGES },
    { id: "categories", label: "Categorías", type: "multi", options: CATEGORIES },
    { id: "tags", label: "Etiquetas (p. ej. female:maid)", type: "tags" },
    { id: "rating", label: "Valoración mínima", type: "select", options: RATINGS },
  ];
}
