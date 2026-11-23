/** Peticiones a través de `host` con cabeceras del sitio y errores tipados. */

import { ACCEPT_LANGUAGE, ADULT_COOKIE, BASE_URL, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";

export function requestHeaders(extra) {
  return {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    Referer: `${BASE_URL}/`,
    Cookie: ADULT_COOKIE,
    ...extra,
  };
}

/** Portadas e imágenes del lector dan 403 sin este `Referer`. */
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

/** Una serie que no existe redirige al buscador (`/search?stype=1&name=…`). */
const redirectedToSearch = (asked, final) =>
  typeof final === "string" && !/\/search/u.test(asked) && /^https:\/\/(m\.)?fanfox\.net\/search/u.test(final);

export async function fetchText(host, url, extra) {
  const response = await host.fetch(url, { headers: requestHeaders(extra) });
  // El host sigue las redirecciones (`url` final); si no lo hiciera, queda `Location`.
  const location = response.headers?.location;
  const final = location ? new URL(location, url).href : response.url;
  if (redirectedToSearch(url, final)) throw fail("NOT_FOUND", `No existe en FanFox: ${url}`, { url });
  if (response.status < 200 || response.status > 299) throw statusError(url, response.status);
  return response.text();
}
