/** Datos de galería (`galleries/<id>.js`) y rutas de imagen (`gg.js`). Nada del sitio se ejecuta: solo JSON y regex. */

import { CONTENT_URL, IMAGE_DOMAIN } from "./config.js";
import { fail } from "./utils/errors.js";
import { fetchText } from "./utils/http.js";

export function requireId(value) {
  const id = String(value ?? "").trim();
  if (!/^\d{1,10}$/u.test(id)) {
    throw fail("NOT_FOUND", `Identificador de galería no válido: ${id}`, { selector: "id" });
  }
  return id;
}

/** `var galleryinfo = {…}` → objeto. */
export async function galleryInfo(host, id) {
  const url = `${CONTENT_URL}/galleries/${requireId(id)}.js`;
  const text = await fetchText(host, url);
  let info;
  try {
    info = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    throw fail("PARSE", "La galería no trae JSON válido", { url });
  }
  if (!Array.isArray(info.files) || info.files.length === 0) {
    throw fail("PARSE", "La galería no trae imágenes", { url, selector: "files" });
  }
  return info;
}

/**
 * `gg.js` define el subdominio (`m`) y la carpeta (`b`) de cada imagen.
 * shortcut: solo entiende un grupo de `case N:` con un único `o = X; break;`; si el sitio cambia la forma, falla con PARSE.
 */
export async function loadGg(host) {
  const url = `${CONTENT_URL}/gg.js`;
  const text = await fetchText(host, url);
  const base = /\bb:\s*'([^']*)'/u.exec(text);
  const initial = /var o = (\d+)/u.exec(text);
  const hit = /\bo = (\d+);\s*break/u.exec(text);
  if (base === null || initial === null || hit === null) {
    throw fail("PARSE", "gg.js no tiene la forma esperada", { url });
  }
  const cases = new Set([...text.matchAll(/case (\d+):/gu)].map((match) => Number(match[1])));
  return { base: base[1], m: (slot) => Number(cases.has(slot) ? hit[1] : initial[1]) };
}

/** Los 3 últimos caracteres del hash, `(..)(.)`, dan el número `slot` (hex invertido). */
function parts(hash) {
  const match = /(..)(.)$/u.exec(hash);
  if (!/^[0-9a-f]{64}$/u.test(hash) || match === null) {
    throw fail("PARSE", "Hash de imagen no válido", { selector: "files.hash" });
  }
  return { first: match[1], last: match[2], slot: parseInt(match[2] + match[1], 16) };
}

export function imageUrl(gg, hash) {
  const { slot } = parts(hash);
  return `https://w${1 + gg.m(slot)}.${IMAGE_DOMAIN}/${gg.base}${slot}/${hash}.webp`;
}

export function thumbnailUrl(gg, hash) {
  const { first, last, slot } = parts(hash);
  return `https://${String.fromCharCode(97 + gg.m(slot))}tn.${IMAGE_DOMAIN}/webpbigtn/${last}/${first}/${hash}.webp`;
}
