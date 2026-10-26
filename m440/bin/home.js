/** Listas del home: «Actualizaciones populares» y «Últimas actualizaciones». */

import { IMAGE_SOURCE, ROUTES, SELECTORS } from "./config.js";
import { fail } from "./utils/errors.js";
import { loadDocument } from "./utils/http.js";
import { attrOf, collapse, compact, textOf } from "./utils/text.js";
import { imageRef, relativePath } from "./utils/url.js";

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function coverFrom(src) {
  const url = String(src ?? "").trim();
  return url === "" ? undefined : imageRef(url);
}

/** Tarjeta de «Actualizaciones populares»: serie, portada, nota y último capítulo. */
function popularItem(card, url) {
  const id = relativePath(attrOf(card, SELECTORS.popular.link, "href"), false);
  const title = attrOf(card, SELECTORS.popular.link, "title") || textOf(card, SELECTORS.popular.link);
  if (id === "" || title === "") {
    throw fail("PARSE", "Tarjeta popular sin enlace o sin título", {
      url,
      selector: `${SELECTORS.popular.link}`,
    });
  }
  const score = textOf(card, SELECTORS.popular.score);
  return compact({
    id,
    title,
    cover: coverFrom(attrOf(card, SELECTORS.popular.cover, "src")),
    badges: score === "" ? [] : [`★ ${score}`],
    hint: textOf(card, SELECTORS.popular.chapter),
  });
}

/** Fila de «Últimas actualizaciones»: la portada viaja en el tooltip del título. */
function latestItem(item, url) {
  const id = relativePath(attrOf(item, SELECTORS.latest.link, "href"), false);
  const title = textOf(item, SELECTORS.latest.link);
  if (id === "" || title === "") {
    throw fail("PARSE", "Fila de actualización sin enlace o sin título", {
      url,
      selector: SELECTORS.latest.link,
    });
  }
  const tooltip = attrOf(item, SELECTORS.latest.tooltip, "title");
  const coverMatch = IMAGE_SOURCE.exec(tooltip);
  const chapter = textOf(item, SELECTORS.latest.chapter);
  const genre = textOf(item, SELECTORS.latest.genre);
  return compact({
    id,
    title,
    cover: coverFrom(coverMatch === null ? "" : coverMatch[1]),
    badges: genre === "" ? [] : [genre],
    hint: collapse([textOf(item, SELECTORS.latest.date), chapter].filter(Boolean).join(" · ")),
  });
}

function unique(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

async function homePage(host) {
  return loadDocument(host, ROUTES.home);
}

export async function popular(host, page) {
  if (pageNumber(page) > 1) {
    return { items: [], hasNext: false };
  }
  const { document, url } = await homePage(host);
  const cards = document.select(SELECTORS.popular.card);
  if (cards.length === 0) {
    throw fail("PARSE", "El home no trae la sección de populares", {
      url,
      selector: SELECTORS.popular.card,
    });
  }
  return { items: cards.map((card) => popularItem(card, url)), hasNext: false };
}

export async function latest(host, page) {
  if (pageNumber(page) > 1) {
    return { items: [], hasNext: false };
  }
  const { document, url } = await homePage(host);
  const rows = document.select(SELECTORS.latest.item);
  if (rows.length === 0) {
    throw fail("PARSE", "El home no trae la sección de últimas actualizaciones", {
      url,
      selector: SELECTORS.latest.item,
    });
  }
  return { items: unique(rows.map((row) => latestItem(row, url))), hasNext: false };
}
