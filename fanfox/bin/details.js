/** Ficha de serie por HTML: datos visibles y capítulos de las dos pestañas (sin volumen y con volumen). */

import { BASE_URL, NSFW_GENRES, SERIES_ID } from "./config.js";
import { fail } from "./utils/errors.js";
import { fetchText, imageHeaders } from "./utils/http.js";

const CHAPTER_PATH = /^\/manga\/([a-z0-9_]+\/(?:v[a-zA-Z0-9.]+\/)?c[0-9.]+)\/1\.html$/u;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const textOf = (doc, selector) => doc.select(selector)[0]?.text().replace(/\s+/gu, " ").trim() ?? "";

/** `Nov 13,2026` → `2026-11-13`; las fechas relativas («18 minute ago», «Today») se omiten. */
function isoDate(text) {
  const match = /^([A-Z][a-z]{2}) (\d{1,2}),\s?(\d{4})$/u.exec(text.trim());
  const month = match ? MONTHS.indexOf(match[1]) + 1 : 0;
  if (month === 0) return undefined;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function statusOf(text) {
  const value = text.toLowerCase();
  if (value.includes("complet")) return "completed";
  if (value.includes("ongoing")) return "ongoing";
  return "unknown";
}

function chapterOf(link) {
  const id = CHAPTER_PATH.exec(link.attr("href") ?? "")?.[1];
  if (!id) return undefined;
  const title = textOf(link, ".title3") || id;
  const number = Number(/(?:^|\/)c([0-9.]+)$/u.exec(id)[1]);
  const publishedAt = isoDate(textOf(link, ".title2"));
  return {
    id,
    title,
    ...(Number.isFinite(number) ? { number } : {}),
    releases: [{ id, ...(publishedAt ? { publishedAt } : {}) }],
  };
}

/** Las pestañas no se solapan: se unen y se ordenan de la más nueva a la más vieja. */
function chaptersOf(doc, slug) {
  const seen = new Set();
  const chapters = doc.select("ul.detail-main-list a").map(chapterOf)
    .filter((c) => c && c.id.startsWith(`${slug}/`) && !seen.has(c.id) && seen.add(c.id));
  return chapters.sort((a, b) => (b.number ?? -1) - (a.number ?? -1));
}

export async function details(host, seriesId) {
  const slug = String(seriesId ?? "");
  if (!SERIES_ID.test(slug)) throw fail("NOT_FOUND", `Identificador de serie no válido: ${seriesId}`);
  const url = `${BASE_URL}/manga/${slug}/`;
  const doc = host.html(await fetchText(host, url));
  // Models #30: sin la cookie `isAdult=1` el sitio manda un aviso en vez de la lista.
  if (doc.select("#checkAdult").length > 0) {
    throw fail("BLOCKED", "FanFox mostró el aviso +18 en vez de los capítulos (no llegó la cookie isAdult=1)", { url });
  }
  const title = textOf(doc, ".detail-info-right-title-font");
  if (title === "") throw fail("PARSE", "La página no es una ficha de FanFox", { url, selector: ".detail-info-right-title-font" });
  const cover = doc.select("img.detail-info-cover-img")[0]?.attr("src")?.replace(/^(https?:)?\/\//u, "https://");
  const genres = doc.select(".detail-info-right-tag-list a").map((a) => a.text().trim()).filter(Boolean);
  const authors = doc.select(".detail-info-right-say a").map((a) => a.text().trim()).filter(Boolean);
  const description = textOf(doc, ".fullcontent") || textOf(doc, ".detail-info-right-content");
  // `0.0` es «sin votos», no una valoración.
  const rating = textOf(doc, ".detail-info-right-title-star .item-score").replace(/^0(\.0)?$/u, "");
  const extra = { Autor: authors.join(", "), Valoración: rating };
  return {
    id: slug,
    title,
    ...(cover ? { cover: { url: cover, headers: imageHeaders() } } : {}),
    nsfw: genres.some((g) => NSFW_GENRES.has(g)),
    ...(authors.length ? { hint: authors.join(", ") } : {}),
    ...(description ? { description } : {}),
    genres,
    status: statusOf(textOf(doc, ".detail-info-right-title-tip")),
    altTitles: [],
    extra: Object.fromEntries(Object.entries(extra).filter(([, value]) => value)),
    chapters: chaptersOf(doc, slug),
  };
}
