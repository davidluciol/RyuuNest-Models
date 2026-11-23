/** Peticiones a través de `host` con cabeceras del sitio y errores tipados. */

import { ACCEPT_LANGUAGE, BASE_URL, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";

export function requestHeaders() {
  return { "User-Agent": USER_AGENT, "Accept-Language": ACCEPT_LANGUAGE, Referer: `${BASE_URL}/` };
}

/** Portadas e imágenes no exigen `Referer`; se manda igual, como un navegador. */
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

export async function fetchText(host, url) {
  const response = await host.fetch(url, { headers: requestHeaders() });
  if (response.status < 200 || response.status > 299) throw statusError(url, response.status);
  return response.text();
}
