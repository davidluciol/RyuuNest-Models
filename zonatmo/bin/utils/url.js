/** Rutas e imágenes: los `id` siempre son relativos al sitio. */

import { BASE_URL, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";

/** Ruta relativa al sitio (los dominios cambian); `""` si no hay ruta. */
export function relativePath(href, keepQuery) {
  let path = String(href ?? "")
    .trim()
    .replace(/^https?:\/\/[^/]+/iu, "")
    .replace(/#.*$/u, "");
  if (!keepQuery) {
    path = path.replace(/\?.*$/u, "");
  }
  if (path === "") {
    return "";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function absoluteUrl(url) {
  const value = String(url ?? "").trim();
  if (/^https?:\/\//iu.test(value)) {
    return value;
  }
  if (value.startsWith("//")) {
    return `https:${value}`;
  }
  return `${BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function requirePath(id, what) {
  if (typeof id !== "string" || !id.startsWith("/")) {
    throw fail("NOT_FOUND", `Identificador de ${what} no válido: ${String(id)}`);
  }
  return id;
}

/** RF-24: el sitio pide `Referer` y `User-Agent` al abrir las imágenes. */
export function imageRef(url) {
  return {
    url: absoluteUrl(url),
    headers: { Referer: `${BASE_URL}/`, "User-Agent": USER_AGENT },
  };
}
