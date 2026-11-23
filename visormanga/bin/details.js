/** Ficha de serie por HTML: título (sin el año), sinopsis, géneros, tipo y capítulos. */

import { BASE_URL, SERIES_ID } from "./config.js";
import { fail } from "./utils/errors.js";
import { fetchText, imageHeaders } from "./utils/http.js";

const CHAPTER_LINK = /^https:\/\/visormanga\.com\/leer\/([a-z0-9-]+-(\d+(?:\.\d+)?))$/u;

const textOf = (doc, selector) => doc.select(selector)[0]?.text().replace(/\s+/gu, " ").trim() ?? "";

function chapterOf(link) {
  const match = CHAPTER_LINK.exec(link.attr("href") ?? "");
  if (!match) return undefined;
  const [, id, num] = match;
  const title = textOf(link, ".chapter-li-a") || `Capítulo ${num}`;
  return { id, title, number: Number(num), releases: [{ id }] };
}

/** El sitio ya los lista del más nuevo al más viejo; se quitan los de otras series. */
function chaptersOf(doc, slug) {
  const seen = new Set();
  return doc.select(".ul-manga-chapter a").map(chapterOf)
    .filter((c) => c && c.id.startsWith(`${slug}-`) && !seen.has(c.id) && seen.add(c.id));
}

export async function details(host, seriesId) {
  const slug = String(seriesId ?? "");
  if (!SERIES_ID.test(slug)) throw fail("NOT_FOUND", `Identificador de serie no válido: ${seriesId}`);
  const url = `${BASE_URL}/manga/${slug}`;
  const doc = host.html(await fetchText(host, url));
  const heading = textOf(doc, "h1.h1-title-manga");
  if (heading === "") throw fail("PARSE", "La página no es una ficha de VisorManga", { url, selector: "h1.h1-title-manga" });
  // El <h1> termina en «(2024)»: el contrato no tiene campo de año, va a la descripción.
  const year = /\((\d{4})\)$/u.exec(heading)?.[1];
  const title = heading.replace(/\s*\(\d{4}\)$/u, "");
  const synopsis = textOf(doc, ".sinopsis p.content");
  const description = [year ? `Año: ${year}` : "", synopsis].filter(Boolean).join("\n\n");
  const cover = doc.select(".front-page-image img")[0]?.attr("src");
  const type = textOf(doc, ".front-page-image .type-manga");
  return {
    id: slug,
    title,
    ...(cover ? { cover: { url: cover, headers: imageHeaders() } } : {}),
    nsfw: true,
    ...(type ? { hint: type } : {}),
    ...(description ? { description } : {}),
    genres: doc.select(".genre-entrada").map((g) => g.text().trim()).filter(Boolean),
    status: "unknown",
    altTitles: [],
    extra: type ? { Tipo: type } : {},
    chapters: chaptersOf(doc, slug),
  };
}
