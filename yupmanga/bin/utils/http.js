/** Peticiones a través de `host`: sesión con cookies propias, documentos y JSON. */

import { ACCEPT_LANGUAGE, CHALLENGE_TITLE, USER_AGENT } from "../config.js";
import { fail } from "./errors.js";
import { textOf } from "./text.js";
import { absoluteUrl } from "./url.js";

/** El host no garantiza un tarro de cookies entre llamadas: lo llevamos nosotros. */
export function createSession() {
  return { cookies: {} };
}

function headerValue(headers, name) {
  if (headers === undefined || headers === null) {
    return "";
  }
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) {
      return String(value ?? "");
    }
  }
  return "";
}

const COOKIE_ATTRIBUTES = /^(path|expires|max-age|domain|secure|httponly|samesite|priority)$/iu;

function absorbCookies(state, headers) {
  const raw = headerValue(headers, "set-cookie");
  if (raw === "") {
    return;
  }
  for (const chunk of raw.split(/,(?=\s*[A-Za-z0-9_\-.]+=)/u)) {
    const pair = chunk.split(";")[0];
    const index = pair.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const name = pair.slice(0, index).trim();
    if (COOKIE_ATTRIBUTES.test(name)) {
      continue;
    }
    state.cookies[name] = pair.slice(index + 1).trim();
  }
}

function cookieHeader(state) {
  return Object.entries(state.cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function requestHeaders(state, extra, referer) {
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept-Language": ACCEPT_LANGUAGE,
    ...extra,
  };
  if (referer !== undefined) {
    headers.Referer = referer;
  }
  const cookie = cookieHeader(state);
  if (cookie !== "") {
    headers.Cookie = cookie;
  }
  return headers;
}

export function statusError(url, status, code) {
  const resolved =
    code ??
    (status === 404
      ? "NOT_FOUND"
      : status === 429
        ? "RATE_LIMITED"
        : status === 401 || status === 403
          ? "BLOCKED"
          : "NETWORK");
  return fail(resolved, `El sitio respondió ${status} a ${url}`, { url, status });
}

export async function request(host, state, url, options = {}) {
  const { method = "GET", headers = {}, body, referer } = options;
  const requestInit = { method, headers: requestHeaders(state, headers, referer) };
  if (body !== undefined) {
    requestInit.body = body;
    requestInit.headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  let response = await host.fetch(url, requestInit);
  absorbCookies(state, response.headers);
  let finalUrl = response.url || url;
  let hops = 0;
  while (response.status >= 300 && response.status < 400 && hops < 5) {
    const location = headerValue(response.headers, "location");
    if (location === "") {
      break;
    }
    finalUrl = absoluteUrl(location);
    response = await host.fetch(finalUrl, {
      method: "GET",
      headers: requestHeaders(state, headers, referer),
    });
    absorbCookies(state, response.headers);
    hops += 1;
  }
  if (response.status < 200 || response.status > 299) {
    throw statusError(finalUrl, response.status);
  }
  return { response, url: response.url || finalUrl };
}

function assertNotChallenge(document, url) {
  if (CHALLENGE_TITLE.test(textOf(document, "title"))) {
    throw fail("BLOCKED", `El sitio pide superar una protección anti-bot en ${url}`, { url });
  }
}

export async function loadDocument(host, state, url, referer) {
  const { response, url: finalUrl } = await request(host, state, url, { referer });
  const text = await response.text();
  const document = host.html(text);
  assertNotChallenge(document, url);
  return { document, text, url: finalUrl };
}

export async function getJson(host, state, url, options) {
  const { response } = await request(host, state, url, options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw fail("PARSE", `El sitio no devolvió JSON en ${url}`, { url });
  }
}
