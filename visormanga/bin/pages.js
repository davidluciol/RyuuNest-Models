/** Imágenes de un capítulo (`slug-NN.NN`): vienen todas en `img.lazyload[data-src]` del lector. */

import { BASE_URL, CHAPTER_ID } from "./config.js";
import { fail } from "./utils/errors.js";
import { fetchText, imageHeaders } from "./utils/http.js";

/** Solo hosts del manifest; el `src` es un GIF de carga y lo demás son logos o anuncios. */
const IMAGE_HOST = /^https:\/\/([a-z0-9-]+\.)*(imgvtmo\.com|visormanga\.com)\//u;

export async function pages(host, chapterId) {
  const id = String(chapterId ?? "");
  if (!CHAPTER_ID.test(id)) throw fail("NOT_FOUND", `Identificador de capítulo no válido: ${chapterId}`);
  const url = `${BASE_URL}/leer/${id}`;
  const images = host.html(await fetchText(host, url)).select("img.lazyload[data-src]")
    .map((img) => (img.attr("data-src") ?? "").trim())
    .filter((src) => IMAGE_HOST.test(src));
  if (images.length === 0) throw fail("PARSE", "El capítulo no trae imágenes", { url, selector: "img.lazyload[data-src]" });
  return { images: images.map((src) => ({ url: src, headers: imageHeaders() })) };
}
