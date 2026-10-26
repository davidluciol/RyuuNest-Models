/** Peticiones y lectura de documentos HTML a través de `host`. */

import { ACCEPT_LANGUAGE, CHALLENGE_TITLE, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";
import { textOf } from "./text.js";

export function requestHeaders(referer, accept) {
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    Accept: accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
  if (referer !== undefined) {
    headers.Referer = referer;
  }
  return headers;
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

/** Trae una página y la devuelve como documento y como texto crudo. */
export async function loadDocument(host, url, referer) {
  const response = await host.fetch(url, { headers: requestHeaders(referer) });
  if (response.status < 200 || response.status > 299) {
    throw statusError(url, response.status);
  }
  const text = await response.text();
  const document = host.html(text);
  if (CHALLENGE_TITLE.test(textOf(document, "title"))) {
    throw fail("BLOCKED", `El sitio pide superar una protección anti-bot en ${url}`, { url });
  }
  // El adaptador de la app puede no rellenar `response.url`: se conserva la pedida.
  return { document, text, url: response.url || url };
}
