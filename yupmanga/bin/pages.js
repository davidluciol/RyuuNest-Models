/**
 * Lector. El sitio no publica las imágenes: entrega un token por capítulo tras un
 * reto JS y una puerta de espera. Aquí se reproduce ese flujo con `host.fetch`
 * (formularios POST y cookies propias) y se leen las claves del HTML final.
 */

import {
  AD_TICKET,
  AD_WAIT_MS,
  BASE_URL,
  PAGE_KEYS,
  READER_URL,
  ROUTES,
  SELECTORS,
} from "./config.js";
import { fail } from "./utils/errors.js";
import { formBody, sleep, solveChallenge } from "./utils/challenge.js";
import { createSession, getJson, loadDocument } from "./utils/http.js";
import { attrOf, textOf } from "./utils/text.js";
import { absoluteUrl, imageRef, queryOf, requirePath } from "./utils/url.js";

const XHR = { "X-Requested-With": "XMLHttpRequest" };

function releaseParams(releaseId) {
  const params = queryOf(requirePath(releaseId, "release"));
  const seriesId = params.id;
  const chapterKey = params.chapter;
  if (!seriesId || !chapterKey) {
    throw fail("NOT_FOUND", `La release no identifica serie y capítulo: ${releaseId}`);
  }
  return { seriesId, chapterKey };
}

function chapterToken(payload, seriesId, chapterKey, url) {
  if (!payload || payload.success !== true || typeof payload.token !== "string") {
    throw fail("BLOCKED", "El sitio no entregó acceso al capítulo", { url });
  }
  return {
    token: payload.token,
    chapterId: String(payload.chapter_id || chapterKey),
    seriesId,
  };
}

async function openChapter(host, session, seriesId, chapterKey, referer) {
  const headers = { ...XHR };

  const { document } = await loadDocument(host, session, referer);
  const csrf = attrOf(document, SELECTORS.details.csrf, "value");
  if (csrf === "") {
    throw fail("NOT_FOUND", "La ficha no existe o no trae el token CSRF del lector", {
      url: referer,
      selector: SELECTORS.details.csrf,
    });
  }
  headers["X-CSRF-Token"] = csrf;

  const anchor = await getJson(
    host,
    session,
    `${BASE_URL}/ajax/get_anchor.php?s=${encodeURIComponent(seriesId)}`,
    { headers, referer },
  );
  const challenge = await getJson(host, session, `${BASE_URL}/ajax/get_challenge.php`, {
    method: "POST",
    headers,
    body: formBody({ chapter_key: chapterKey, s: seriesId }),
    referer,
  });
  const answer = solveChallenge(challenge.challenge_js, anchor.v);

  const opened = await getJson(host, session, `${BASE_URL}/ajax/open_chapter.php`, {
    method: "POST",
    headers,
    body: formBody({
      chapter_key: chapterKey,
      s: seriesId,
      challenge_id: challenge.challenge_id,
      answer,
    }),
    referer,
  });
  if (opened && opened.error === "quota_exceeded") {
    throw fail("RATE_LIMITED", "Límite de lectura del sitio alcanzado", { url: referer });
  }
  return chapterToken(opened, seriesId, chapterKey, referer);
}

/** Completa el interstitial de espera con reintento por desfase de reloj. */
async function completeGate(host, session, payload, chapterId, referer) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await getJson(host, session, `${BASE_URL}/ajax/complete_ad_interstitial.php`, {
        method: "POST",
        headers: XHR,
        body: formBody({
          identifier: "chapter_entrance",
          chapter: payload.chapter || chapterId,
          nonce: payload.nonce,
        }),
        referer,
      });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await sleep(2000);
    }
  }
}

function pageEntries(html, url) {
  const match = PAGE_KEYS.exec(html);
  if (match === null) {
    throw fail("PARSE", "El lector no trae el mapa de páginas", {
      url,
      selector: "readerPageKeys",
    });
  }
  let keys;
  try {
    keys = JSON.parse(match[1]);
  } catch {
    throw fail("PARSE", "El mapa de páginas del lector no es JSON válido", { url });
  }
  const entries = Object.entries(keys)
    .map(([page, key]) => [Number(page), String(key ?? "")])
    .filter(([page, key]) => Number.isFinite(page) && key !== "")
    .sort((left, right) => left[0] - right[0]);
  if (entries.length === 0) {
    throw fail("PARSE", "El lector no trae ninguna página", { url });
  }
  return entries;
}

export async function pages(host, _chapterId, releaseId) {
  const { seriesId, chapterKey } = releaseParams(releaseId);
  const session = createSession();
  const seriesUrl = ROUTES.series(seriesId);
  const access = await openChapter(host, session, seriesId, chapterKey, seriesUrl);

  let reader = await loadDocument(
    host,
    session,
    ROUTES.reader(access.chapterId, access.token, 1),
    seriesUrl,
  );

  const ticket = AD_TICKET.exec(reader.text);
  if (ticket !== null) {
    let payload;
    try {
      payload = JSON.parse(ticket[1]);
    } catch {
      throw fail("PARSE", "El interstitial del lector no es JSON válido", { url: reader.url });
    }
    if (typeof payload.nonce !== "string" || payload.nonce === "") {
      throw fail("BLOCKED", "El interstitial del lector no trae nonce", { url: reader.url });
    }
    await sleep(AD_WAIT_MS);
    await completeGate(host, session, payload, access.chapterId, reader.url);

    const target = READER_URL.exec(reader.text);
    if (target === null) {
      throw fail("PARSE", "El interstitial no trae la URL del lector", {
        url: reader.url,
        selector: "data-reader-url",
      });
    }
    reader = await loadDocument(
      host,
      session,
      absoluteUrl(target[1].replace(/&amp;/gu, "&")),
      reader.url,
    );
  }

  const entries = pageEntries(reader.text, reader.url);
  const title = textOf(reader.document, SELECTORS.reader.chapterTitle);
  return {
    ...(title === "" ? {} : { title }),
    images: entries.map(([, key]) =>
      imageRef(`${BASE_URL}/image-proxy-v2.php?k=${encodeURIComponent(key)}`, reader.url),
    ),
  };
}
