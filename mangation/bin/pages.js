/** Lector: `/manga/<slug>/chapter/<n>/__data.json` → imágenes del CDN, por número de página. */

import { requireSlug } from "./details.js";
import { fail } from "./utils/errors.js";
import { imageHeaders, mediaUrl, pageData } from "./utils/http.js";

/** Id de capítulo = `<slug>/<número>` (el lector va por número, admite decimales). */
function parseChapterId(chapterId) {
  const match = /^([^/]+)\/(\d+(?:\.\d+)?)$/u.exec(String(chapterId ?? "").trim());
  if (!match) throw fail("NOT_FOUND", `Identificador de capítulo no válido: ${chapterId}`);
  return { slug: requireSlug(match[1]), number: match[2] };
}

export async function pages(host, chapterId) {
  const { slug, number } = parseChapterId(chapterId);
  const data = await pageData(host, `/manga/${slug}/chapter/${number}`);
  const chapter = data?.reader?.chapter;
  if (!chapter) throw fail("PARSE", "La página no es un lector de Mangation", { url: `https://mangation.com/manga/${slug}/chapter/${number}` });
  const images = [...(chapter.pages ?? [])]
    .sort((a, b) => Number(a?.number) - Number(b?.number))
    .map((page) => mediaUrl(page?.image))
    .filter(Boolean)
    .map((url) => ({ url, headers: imageHeaders() }));
  if (images.length === 0) throw fail("NOT_FOUND", `El capítulo ${chapterId} no tiene imágenes`);
  return { images };
}
