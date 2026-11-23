/** Peticiones a la API JSON y a los `__data.json` de SvelteKit a través de `host`, con errores tipados. */

import { ACCEPT_LANGUAGE, API_URL, BASE_URL, MEDIA_URL, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";

export function requestHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    Accept: "application/json",
    Referer: `${BASE_URL}/`,
  };
}

/** Cabeceras para las imágenes (el CDN no las exige hoy). */
export function imageHeaders() {
  return { Referer: `${BASE_URL}/`, "User-Agent": USER_AGENT };
}

/** Portadas e imágenes llegan como ruta relativa al CDN (`content/<id>/…`). */
export function mediaUrl(path) {
  const value = String(path ?? "").trim();
  if (value === "") return undefined;
  return /^https:\/\//u.test(value) ? value : `${MEDIA_URL}/${value.replace(/^\/+/u, "")}`;
}

export function statusError(url, status) {
  const code =
    status === 404
      ? "NOT_FOUND"
      : status === 429
        ? "RATE_LIMITED"
        : status === 401 || status === 403
          ? "BLOCKED"
          : "NETWORK";
  return fail(code, `El sitio respondió ${status} a ${url}`, { url, status });
}

async function getJson(host, url) {
  const response = await host.fetch(url, { headers: requestHeaders() });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    if (response.status < 200 || response.status > 299) throw statusError(url, response.status);
    throw fail("PARSE", "El sitio no devolvió JSON", { url, status: response.status });
  }
  return { status: response.status, body };
}

/** `GET` a la API. Sus errores llegan como `{ error: { code, message } }`. */
export async function apiJson(host, path) {
  const url = `${API_URL}${path}`;
  const { status, body } = await getJson(host, url);
  if (status >= 200 && status <= 299) return body;
  const message = body?.error?.message;
  if (status === 400) throw fail("PARSE", message ?? "La API rechazó la petición", { url, status });
  const error = statusError(url, status);
  if (message) error.message = message;
  throw error;
}

/**
 * Rehidrata el formato *devalue* de SvelteKit: un array plano donde objetos y arrays guardan
 * índices. Solo datos: nunca se ejecuta nada del sitio.
 */
export function hydrate(values) {
  const seen = new Map();
  const at = (index) => {
    if (typeof index !== "number" || index < 0) return undefined; // -1 = undefined, -2… = huecos/NaN
    if (seen.has(index)) return seen.get(index);
    const value = values[index];
    if (Array.isArray(value)) {
      // Tipos especiales (`["Date", "…"]`): solo se conserva la fecha.
      if (typeof value[0] === "string") return value[0] === "Date" ? value[1] : undefined;
      const out = [];
      seen.set(index, out);
      for (const item of value) out.push(at(item));
      return out;
    }
    if (value !== null && typeof value === "object") {
      const out = {};
      seen.set(index, out);
      for (const [key, item] of Object.entries(value)) {
        if (key !== "__proto__") out[key] = at(item);
      }
      return out;
    }
    return value;
  };
  return at(0);
}

/** Datos de una página (`/manga/<slug>` → `/manga/<slug>/__data.json`). Los 404 llegan con 200. */
export async function pageData(host, path, query = "") {
  const url = `${BASE_URL}${path}/__data.json${query}`;
  const { status, body } = await getJson(host, url);
  if (status < 200 || status > 299) throw statusError(url, status);
  const node = (body?.nodes ?? []).filter((n) => n != null).at(-1);
  if (node?.type === "error") {
    const code = node.error?.status === 404 ? "NOT_FOUND" : "PARSE";
    throw fail(code, node.error?.message ?? "La página devolvió un error", { url, status: node.error?.status });
  }
  if (node?.type !== "data" || !Array.isArray(node.data)) {
    throw fail("PARSE", "Respuesta de página inesperada", { url });
  }
  return hydrate(node.data);
}
