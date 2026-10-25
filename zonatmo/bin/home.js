/** Listas de series: populares y últimas añadidas (misma rejilla de tarjetas). */

import { ROUTES, SELECTORS } from "./config.js";
import { fail } from "./utils/errors.js";
import { loadDocument } from "./utils/http.js";
import { kindOf } from "./utils/normalize.js";
import { attrOf, collapse, compact, textOf } from "./utils/text.js";
import { imageRef, relativePath } from "./utils/url.js";

/** La portada vive en `data-bg` del contenedor y, además, en el `src` de la imagen. */
function coverOf(row) {
  const source =
    attrOf(row, SELECTORS.card.thumbnail, "data-bg") || attrOf(row, SELECTORS.card.image, "src");
  return source === "" ? undefined : imageRef(source);
}

function titleOf(row) {
  return attrOf(row, SELECTORS.card.title, "title") || textOf(row, SELECTORS.card.title);
}

function badgesOf(row) {
  const badges = [];
  const score = textOf(row, SELECTORS.card.score);
  if (score !== "") {
    badges.push(`★ ${score}`);
  }
  const mature = textOf(row, SELECTORS.card.mature);
  if (mature !== "") {
    badges.push(mature);
  }
  const demography = textOf(row, SELECTORS.card.demography);
  if (demography !== "") {
    badges.push(demography);
  }
  return badges;
}

function hintOf(row) {
  return [textOf(row, SELECTORS.card.status), textOf(row, SELECTORS.card.chapters)]
    .filter(Boolean)
    .join(" · ");
}

/** Tarjeta de serie → item de lista del contrato. */
export function itemOf(row, url) {
  const id = relativePath(attrOf(row, SELECTORS.card.link, "href"), false);
  const title = titleOf(row);
  if (id === "" || title === "") {
    throw fail("PARSE", "Tarjeta de serie sin enlace o sin título", {
      url,
      selector: `${SELECTORS.card.link} / ${SELECTORS.card.title}`,
    });
  }
  return compact({
    id,
    title,
    cover: coverOf(row),
    kind: kindOf(textOf(row, SELECTORS.card.kind)),
    badges: badgesOf(row),
    hint: collapse(hintOf(row)),
  });
}

/** Página de la biblioteca → `{ items, hasNext }`. */
export async function listPage(host, url) {
  const { document } = await loadDocument(host, url);
  const items = document.select(SELECTORS.card.root).map((row) => itemOf(row, url));
  return { items, hasNext: document.select(SELECTORS.nextPage).length > 0 };
}

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export function popular(host, page) {
  return listPage(host, ROUTES.popular(pageNumber(page)));
}

export function latest(host, page) {
  return listPage(host, ROUTES.latest(pageNumber(page)));
}
