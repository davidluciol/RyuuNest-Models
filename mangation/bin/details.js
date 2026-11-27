/** Ficha: datos de `/manga/<slug>/__data.json` y el resto de capítulos desde la API (10 por página). */

import { DEMOGRAPHICS, MAX_CHAPTER_PAGES, SERIES_ID, STATUSES, TYPES } from "./config.js";
import { summaryOf } from "./catalog.js";
import { fail } from "./utils/errors.js";
import { apiJson, pageData } from "./utils/http.js";

export function requireSlug(value) {
  const slug = String(value ?? "").trim();
  if (!SERIES_ID.test(slug)) throw fail("NOT_FOUND", `Identificador de serie no válido: ${value}`);
  return slug;
}

const labelOf = (options, value) => options.find((o) => o.value === value)?.label;

function chapterOf(slug, chapter) {
  const number = Number(chapter.number);
  if (!Number.isFinite(number)) return undefined;
  const id = `${slug}/${chapter.number}`;
  const title = String(chapter.title ?? "").trim();
  // Solo el título del sitio: la app antepone «Capítulo N» (antes salía «Capítulo 103: Capítulo 103.00»).
  return { id, title: title || `Capítulo ${chapter.number}`, number, releases: [{ id }] };
}

/** La ficha ya trae la página 1 (orden ascendente); el resto se pide a la API en paralelo. */
async function allChapters(host, slug, manga) {
  const first = manga.chapters ?? [];
  const total = Math.min(Number(manga.chaptersPagination?.totalPages ?? 1), MAX_CHAPTER_PAGES);
  const rest = await Promise.all(
    Array.from({ length: Math.max(total - 1, 0) }, async (_, i) => {
      const body = await apiJson(host, `/public/mangas/${slug}/chapters?page=${i + 2}&order=asc`);
      return body?.items ?? [];
    }),
  );
  // Del más nuevo al más viejo, como el resto de módulos.
  return [first, ...rest].flat().map((c) => chapterOf(slug, c)).filter(Boolean).reverse();
}

export async function details(host, seriesId) {
  const slug = requireSlug(seriesId);
  const manga = (await pageData(host, `/manga/${slug}`))?.manga;
  if (!manga?.slug) throw fail("PARSE", "La página no es una ficha de Mangation", { url: `https://mangation.com/manga/${slug}` });
  const extra = {};
  const put = (label, value) => {
    if (value) extra[label] = value;
  };
  put("Tipo", labelOf(TYPES, manga.type));
  put("Demografía", labelOf(DEMOGRAPHICS, manga.demografy));
  put("Estado", labelOf(STATUSES, manga.status));
  put("Subido por", manga.creator?.name);
  if (manga.adult === true) extra["+18"] = "Sí";
  const description = String(manga.description ?? "").trim();
  return {
    ...summaryOf(manga),
    ...(description ? { description } : {}),
    genres: (manga.genres ?? []).map((g) => g?.name).filter(Boolean),
    status: STATUSES.some((s) => s.value === manga.status) ? manga.status : "unknown",
    altTitles: [],
    extra,
    chapters: await allChapters(host, slug, manga),
  };
}
