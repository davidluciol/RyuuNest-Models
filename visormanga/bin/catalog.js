/** Biblioteca (popular), portada (últimos capítulos y series nuevas), barra POPULAR, buscador y géneros. */

import { BASE_URL, GENRES, SECTIONS } from "./config.js";
import { fetchText, imageHeaders } from "./utils/http.js";

const SERIES_LINK = /^https:\/\/visormanga\.com\/manga\/([a-z0-9-]+)$/u;
const CHAPTER_LINK = /^https:\/\/visormanga\.com\/leer\/([a-z0-9-]+)-\d+(?:\.\d+)?$/u;

/** Tarjetas de la lista principal; la barra POPULAR usa otro marcado. */
const LIBRARY = ".manga_portada .image-post > a";
const HOME_CHAPTERS = ".last-chapters-content .manga_portada .image-post > a";
const HOME_NEW = ".last-mangas-content .manga_portada .image-post > a";
const SIDEBAR = ".content-manga-sidebar .widget-thumbnail > a";

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** Enlace a `/manga/<slug>` o a `/leer/<slug>-NN.NN` (el slug del capítulo empieza por el de la serie). */
function summaryOf(link) {
  const href = link.attr("href") ?? "";
  const id = SERIES_LINK.exec(href)?.[1] ?? CHAPTER_LINK.exec(href)?.[1];
  if (!id) return undefined;
  const title = (link.attr("title") ?? "").trim() || id;
  const cover = link.select("img")[0]?.attr("src");
  const hint = link.select(".chapter-episode-updated, .manga-type-updated")[0]?.text().trim();
  return {
    id,
    title,
    ...(cover ? { cover: { url: cover, headers: imageHeaders() } } : {}),
    ...(hint ? { hint } : {}),
  };
}

/** Sin duplicados: una serie puede salir dos veces en «Últimos capítulos». */
function parseList(doc, selector) {
  const seen = new Set();
  return doc.select(selector).map(summaryOf).filter((item) => item && !seen.has(item.id) && seen.add(item.id));
}

const hasPage = (doc, n) => doc.select('a[href*="page="]').some((a) => new RegExp(`[?&]page=${n}(&|$)`, "u").test(a.attr("href") ?? ""));

async function paged(host, path, params, page) {
  const n = pageNumber(page);
  const query = new URLSearchParams({ ...params, ...(n > 1 ? { page: String(n) } : {}) }).toString();
  const doc = host.html(await fetchText(host, `${BASE_URL}${path}${query ? `?${query}` : ""}`));
  return { doc, items: parseList(doc, LIBRARY), hasNext: hasPage(doc, n + 1) };
}

const library = async (host, page) => {
  const { items, hasNext } = await paged(host, "/biblioteca", {}, page);
  return { items, hasNext };
};

const NO_MORE = { items: [], hasNext: false };
const fromDoc = (doc, selector) => ({ items: parseList(doc, selector), hasNext: false });

/** El género va por su ruta e ignora el texto: el servidor no los combina. */
export async function search(host, query, page, filters = {}) {
  const genre = GENRES.find((g) => g.value === filters?.genre)?.value;
  const params = genre ? {} : { search: String(query ?? "").trim() };
  const { items, hasNext } = await paged(host, genre ? `/genero/${genre}` : "/biblioteca", params, page);
  return { items, hasNext };
}

export async function list(host, sectionId, page) {
  const id = SECTIONS.some((s) => s.id === sectionId) ? sectionId : "library";
  if (id === "library") return library(host, page);
  // Portada y barra lateral no paginan.
  if (pageNumber(page) > 1) return NO_MORE;
  if (id === "popular") return fromDoc(host.html(await fetchText(host, `${BASE_URL}/biblioteca`)), SIDEBAR);
  return fromDoc(host.html(await fetchText(host, `${BASE_URL}/`)), id === "chapters" ? HOME_CHAPTERS : HOME_NEW);
}

export const popular = (host, page) => library(host, page);
export const latest = (host, page) => list(host, "chapters", page);

/** Dos peticiones: la portada y la primera página de la biblioteca (lista + barra POPULAR). */
export async function home(host) {
  const [front, lib] = await Promise.all([
    fetchText(host, `${BASE_URL}/`).then((html) => host.html(html)),
    paged(host, "/biblioteca", {}, 1),
  ]);
  const lists = {
    chapters: fromDoc(front, HOME_CHAPTERS),
    new: fromDoc(front, HOME_NEW),
    popular: fromDoc(lib.doc, SIDEBAR),
    library: { items: lib.items, hasNext: lib.hasNext },
  };
  return { sections: SECTIONS.map(({ id, title }) => ({ id, title, kind: "list", ...lists[id] })) };
}

export function filters() {
  return [{ id: "genre", label: "Género", type: "select", options: GENRES }];
}
