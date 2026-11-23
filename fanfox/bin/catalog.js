/** Listas del directorio (popular, últimas, valoradas, nuevas), buscador, home y filtros. */

import { BASE_URL, GENRES, SECTIONS, STATUSES, TYPES } from "./config.js";
import { fetchText, imageHeaders } from "./utils/http.js";

const SERIES_PATH = /^\/manga\/([a-z0-9_]+)\/$/u;

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** Las portadas vienen con `http://`; el CDN sirve lo mismo por https. */
const httpsUrl = (src) => (src ? src.replace(/^(https?:)?\/\//u, "https://") : undefined);

/** Un `<li>` del directorio (`manga-list-1`) o del buscador (`manga-list-4`). */
function summaryOf(item) {
  const link = item.select("a[title]")[0];
  const slug = SERIES_PATH.exec(link?.attr("href") ?? "")?.[1];
  if (!slug) return undefined;
  const cover = httpsUrl(item.select("img")[0]?.attr("src"));
  // El texto visible se corta con «...»: el título completo va en el atributo.
  const title = link.attr("title").trim() || slug;
  const latestChapter = item.select('a[href$="/1.html"]')[0]?.text().trim();
  return {
    id: slug,
    title,
    ...(cover ? { cover: { url: cover, headers: imageHeaders() } } : {}),
    ...(latestChapter ? { hint: latestChapter } : {}),
  };
}

function parseList(doc) {
  return doc.select("ul.manga-list-1-list > li, ul.manga-list-4-list > li").map(summaryOf).filter(Boolean);
}

/** Hay página siguiente si el paginador enlaza a la `page + 1`. */
function hasPage(doc, matches) {
  return doc.select(".pager-list a").some((a) => matches(a.attr("href") ?? ""));
}

async function directory(host, sort, page) {
  const n = pageNumber(page);
  const url = `${BASE_URL}/directory/${n > 1 ? `${n}.html` : ""}${sort ? `?${sort}` : ""}`;
  const doc = host.html(await fetchText(host, url));
  return { items: parseList(doc), hasNext: hasPage(doc, (href) => href.startsWith(`/directory/${n + 1}.html`)) };
}

const pick = (options, value) => (options.some((o) => o.value === value) ? value : "");

/** `/search` acepta título vacío: así los filtros solos también buscan. */
export async function search(host, query, page, filters = {}) {
  const n = pageNumber(page);
  const params = new URLSearchParams({
    title: String(query ?? "").trim(),
    genres: pick(GENRES, filters?.genre),
    type: pick(TYPES, filters?.type) || "0",
    st: pick(STATUSES, filters?.status) || "0",
    page: String(n),
  });
  const doc = host.html(await fetchText(host, `${BASE_URL}/search?${params}`));
  return { items: parseList(doc), hasNext: hasPage(doc, (href) => href.includes(`page=${n + 1}&`) || href.endsWith(`page=${n + 1}`)) };
}

const sectionOf = (id) => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];

export const list = (host, sectionId, page) => directory(host, sectionOf(sectionId).sort, page);
export const popular = (host, page) => list(host, "popular", page);
export const latest = (host, page) => list(host, "latest", page);

export async function home(host) {
  const sections = await Promise.all(
    SECTIONS.map(async ({ id, title, sort }) => ({ id, title, kind: "list", ...(await directory(host, sort, 1)) })),
  );
  return { sections };
}

export function filters() {
  return [
    { id: "genre", label: "Género", type: "select", options: GENRES },
    { id: "type", label: "Tipo", type: "select", options: TYPES },
    { id: "status", label: "Estado", type: "select", options: STATUSES },
  ];
}
