/** Peticiones a la API GraphQL a través de `host`, con errores tipados. */

import { ACCEPT_LANGUAGE, BASE_URL, GRAPHQL_URL, QUERIES, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";

export function requestHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    Accept: "application/json",
    Referer: `${BASE_URL}/`,
  };
}

/** Cabeceras que la app debe enviar al pedir una imagen (el CDN no las exige hoy). */
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

const CHALLENGE = /Just a moment|cf-chl|Attention Required/iu;

/** Ejecuta la consulta `operation` de `QUERIES` y devuelve `data`. */
export async function graphql(host, operation, variables) {
  const url =
    `${GRAPHQL_URL}?operationName=${operation}` +
    `&query=${encodeURIComponent(QUERIES[operation])}` +
    `&variables=${encodeURIComponent(JSON.stringify(variables))}`;
  const response = await host.fetch(url, { headers: requestHeaders() });
  const text = await response.text();
  if (CHALLENGE.test(text.slice(0, 2000)) && !text.trimStart().startsWith("{")) {
    throw fail("BLOCKED", "Cloudflare pidió verificar el navegador (Just a moment…)", {
      url: GRAPHQL_URL,
      status: response.status,
    });
  }
  // 400 = el API rechazó la consulta (errores GraphQL en el cuerpo): se trata abajo como PARSE.
  if ((response.status < 200 || response.status > 299) && response.status !== 400) {
    throw statusError(GRAPHQL_URL, response.status);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw fail("PARSE", "La API no devolvió JSON", { url: GRAPHQL_URL, status: response.status });
  }
  if (body.errors?.length > 0 || body.data == null) {
    throw fail("PARSE", `La API rechazó la consulta ${operation}`, { url: GRAPHQL_URL });
  }
  return body.data;
}
