/** Peticiones a través de `host` (HTML del sitio y API JSON), con errores tipados. */

import { ACCEPT_LANGUAGE, API_URL, BASE_URL, USER_AGENT } from "../config.js";
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

/** El sitio responde 200 con un texto corto cuando veta la IP por exceso de peticiones. */
function bannedError(url, status, text) {
  if (text.length < 5000 && /temporarily banned/iu.test(text)) {
    return fail("RATE_LIMITED", "E-Hentai vetó la IP temporalmente por exceso de peticiones", { url, status });
  }
  return undefined;
}

async function send(host, url, init) {
  const response = await host.fetch(url, init);
  const text = await response.text();
  const banned = bannedError(url, response.status, text);
  if (banned) throw banned;
  if (response.status < 200 || response.status > 299) throw statusError(url, response.status);
  return text;
}

export const fetchText = (host, url, extra) => send(host, url, { headers: requestHeaders(extra) });

/** POST a la API JSON; un `error` en el cuerpo se devuelve tal cual para que el llamador decida. */
export async function callApi(host, body) {
  const text = await send(host, API_URL, {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify(body),
  });
  try {
    return JSON.parse(text);
  } catch {
    throw fail("PARSE", "La API no devolvió JSON", { url: API_URL });
  }
}
