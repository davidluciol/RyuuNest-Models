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

/** Query de una ruta relativa, sin depender de `URL`. */
export function queryOf(path) {
  const query = requirePath(path, "ruta").split("?")[1] ?? "";
  const params = {};
  for (const pair of query.split("&")) {
    if (pair === "") {
      continue;
    }
    const index = pair.indexOf("=");
    const key = index === -1 ? pair : pair.slice(0, index);
    const value = index === -1 ? "" : pair.slice(index + 1);
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/gu, " "));
  }
  return params;
}

export function imageRef(url, referer) {
  return {
    url: absoluteUrl(url),
    headers: {
      Referer: referer === undefined ? `${BASE_URL}/` : referer,
      "User-Agent": USER_AGENT,
    },
  };
}
