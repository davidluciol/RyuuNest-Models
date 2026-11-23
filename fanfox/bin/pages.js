/**
 * Imágenes de un capítulo (`slug/[vNN/]cNNN`). Vía principal: la vista móvil `roll_manga`
 * trae todas las imágenes en `img[data-original]`. Respaldo: el lector de escritorio da
 * `chapterid` e `imagecount` y `chapterfun.ashx` devuelve, empaquetadas, dos URL por llamada.
 * Las URL llevan `token`/`ttl` y caducan en ~1 día: no se guardan.
 */

import { BASE_URL, CHAPTER_ID, MOBILE_URL } from "./config.js";
import { fail } from "./utils/errors.js";
import { fetchText, imageHeaders } from "./utils/http.js";
import { unpack } from "./utils/unpack.js";

/** Las URL protocol-relative pasan a https; `&amp;` ya lo decodifica el parser. */
const httpsUrl = (src) => src.replace(/^(https?:)?\/\//u, "https://");
const IMAGE_HOST = /^https:\/\/[a-z0-9.-]+\.(mangafox\.me|mfcdn\.net)\//u;

export const FALLBACK_NOTICE = "Aviso: se quitó un anuncio al final; puede faltar la última página";

function chapterOf(chapterId) {
  const id = String(chapterId ?? "");
  if (!CHAPTER_ID.test(id)) throw fail("NOT_FOUND", `Identificador de capítulo no válido: ${chapterId}`);
  return id;
}

async function mobileImages(host, id) {
  const html = await fetchText(host, `${MOBILE_URL}/roll_manga/${id}/1.html`);
  return host.html(html).select("img[data-original]")
    .map((img) => httpsUrl(img.attr("data-original") ?? ""))
    .filter((url) => IMAGE_HOST.test(url));
}

/** `var pix="…";var pvalue=["…",…]` del código desempaquetado → URL absolutas. */
function chapterfunImages(script, url) {
  const code = unpack(script);
  const pix = /var pix="([^"]+)"/u.exec(code ?? "")?.[1];
  const list = /var pvalue=(\[[^\]]*\])/u.exec(code ?? "")?.[1];
  if (!pix || !list) throw fail("PARSE", "chapterfun.ashx no trae la lista de imágenes", { url });
  let values;
  try {
    values = JSON.parse(list);
  } catch {
    throw fail("PARSE", "chapterfun.ashx trae una lista de imágenes ilegible", { url });
  }
  return values.map((value) => httpsUrl(`${pix}${value}`)).filter((u) => IMAGE_HOST.test(u));
}

async function desktopImages(host, id) {
  const readerUrl = `${BASE_URL}/manga/${id}/1.html`;
  const html = await fetchText(host, readerUrl);
  const cid = /var chapterid\s*=\s*(\d+)/u.exec(html)?.[1];
  const count = Number(/var imagecount\s*=\s*(\d+)/u.exec(html)?.[1] ?? 0);
  if (!cid || count === 0) throw fail("PARSE", "El lector no trae chapterid/imagecount", { url: readerUrl });
  const images = [];
  // Cada llamada devuelve la página pedida y la siguiente; el sitio no exige la clave `key`.
  for (let page = 1; page <= count && images.length < count; page += 2) {
    const url = `${BASE_URL}/manga/${id}/chapterfun.ashx?cid=${cid}&page=${page}&key=`;
    const script = await fetchText(host, url, { Referer: readerUrl, "X-Requested-With": "XMLHttpRequest" });
    for (const image of chapterfunImages(script, url)) if (!images.includes(image)) images.push(image);
  }
  // La última es un anuncio (mismo PNG con nombres como `cp_e18`, `d01f` o `d025`) que la vista móvil omite.
  // shortcut: comprobado en 3 capítulos (imagecount = móvil + 1); si falta una página real, revisar con capturas.
  return images.slice(0, -1);
}

export async function pages(host, chapterId) {
  const id = chapterOf(chapterId);
  let images = await mobileImages(host, id);
  const fallback = images.length === 0;
  if (fallback) images = await desktopImages(host, id);
  if (images.length === 0) throw fail("PARSE", "El capítulo no trae imágenes", { url: `${BASE_URL}/manga/${id}/1.html` });
  return {
    // El respaldo descarta la última imagen (anuncio): se avisa por si era una página real.
    ...(fallback ? { title: FALLBACK_NOTICE } : {}),
    images: images.map((url) => ({ url, headers: imageHeaders() })),
  };
}
