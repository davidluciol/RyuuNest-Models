/** Peticiones a través de `host`. Las imágenes y los `.nozomi` exigen `Referer: hitomi.la`. */

import { ACCEPT_LANGUAGE, BASE_URL, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";

export function requestHeaders(extra) {
  return {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    Referer: `${BASE_URL}/`,
    ...extra,
  };
}

/** Cabeceras que la app debe enviar al pedir una imagen. */
export function imageHeaders() {
  return { Referer: `${BASE_URL}/`, "User-Agent": USER_AGENT };
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

/** Pide `url` y devuelve la respuesta si el estado es 2xx (o está en `allow`). */
export async function request(host, url, extraHeaders, allow = []) {
  const response = await host.fetch(url, { headers: requestHeaders(extraHeaders) });
  if ((response.status < 200 || response.status > 299) && !allow.includes(response.status)) {
    throw statusError(url, response.status);
  }
  return response;
}

export async function fetchText(host, url) {
  return (await request(host, url)).text();
}
