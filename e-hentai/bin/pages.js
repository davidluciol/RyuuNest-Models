/**
 * Imágenes de un bloque (`g/{gid}/{token}/{p}`): la página `p` de la galería da 20 enlaces `/s/`;
 * el primero se abre en HTML (trae `showkey` y su imagen) y el resto se pide a la API `showpage`.
 * Las URL de H@H (`*.hath.network`) caducan: no se guardan.
 */

import { BASE_URL, THUMBS_PER_PAGE } from "./config.js";
import { galleryOf } from "./details.js";
import { fail } from "./utils/errors.js";
import { callApi, fetchText, imageHeaders } from "./utils/http.js";

const READER_PATH = /^https:\/\/e-hentai\.org\/s\/([0-9a-f]{10})\/(\d+)-(\d+)$/u;
const MISSING = /Key missing|Gallery not found|This gallery has been removed|Gallery not available/iu;

function blockOf(chapterId) {
  const { gid, token } = galleryOf(chapterId);
  const block = Number(/\/(\d+)$/u.exec(String(chapterId))?.[1] ?? "0");
  return { gid, token, block };
}

function imageOf(doc, url) {
  const src = doc.select("#img")[0]?.attr("src");
  if (!src || !src.startsWith("https://")) throw fail("PARSE", "La página de lectura no trae imagen", { url, selector: "#img" });
  // El sitio sirve 509.gif en vez de la imagen cuando se agota la cuota de descarga.
  if (/\/509\.gif$/u.test(src)) throw fail("RATE_LIMITED", "E-Hentai agotó la cuota de imágenes (509)", { url });
  return src;
}

async function readerLinks(host, gid, token, block) {
  const url = `${BASE_URL}/g/${gid}/${token}/?p=${block}`;
  // `nw=1` salta el aviso de contenido; `?nw=always` redirige y pierde `?p=`.
  const text = await fetchText(host, url, { Cookie: "nw=1" });
  const links = host.html(text).select("#gdt a")
    .map((a) => READER_PATH.exec(a.attr("href") ?? ""))
    .filter(Boolean)
    .map(([href, imgkey, , page]) => ({ href, imgkey, page: Number(page) }));
  if (links.length > 0) return links;
  if (MISSING.test(text)) throw fail("NOT_FOUND", `La galería ${gid} no existe o fue retirada`, { url });
  throw fail("PARSE", "La galería no trae enlaces de lectura", { url, selector: "#gdt a" });
}

async function showpage(host, gid, showkey, { imgkey, page, href }) {
  const body = await callApi(host, { method: "showpage", gid, page, imgkey, showkey });
  if (typeof body.i3 !== "string") throw fail("PARSE", "La API showpage no devolvió la imagen", { url: href });
  return imageOf(host.html(body.i3), href);
}

export async function pages(host, chapterId) {
  const { gid, token, block } = blockOf(chapterId);
  const [first, ...rest] = await readerLinks(host, gid, token, block);
  const html = await fetchText(host, first.href);
  const showkey = /var showkey\s*=\s*"([0-9a-z]+)"/u.exec(html)?.[1];
  if (!showkey) throw fail("PARSE", "La página de lectura no trae showkey", { url: first.href });
  const firstImage = imageOf(host.html(html), first.href);
  const others = await Promise.all(rest.map((link) => showpage(host, gid, showkey, link)));
  const from = block * THUMBS_PER_PAGE + 1;
  return {
    title: `Páginas ${from}–${from + rest.length}`,
    images: [firstImage, ...others].map((url) => ({ url, headers: imageHeaders() })),
  };
}
