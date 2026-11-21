/** Listas: populares (top) y últimas series (home), con la misma tarjeta. */

import { ROUTES, SELECTORS } from "./config.js";
import { fail } from "./utils/errors.js";
import { cookieHeader, createSession, loadDocument } from "./utils/http.js";
import { kindOf, statusOf } from "./utils/normalize.js";
import { attrOf, collapse, compact, textOf } from "./utils/text.js";
import { imageRef, relativePath } from "./utils/url.js";

/** Tarjeta de serie → item de lista del contrato. */
export function itemOf(card, url, cookie) {
  const id = relativePath(attrOf(card, SELECTORS.card.link, "href"), true);
  const title = textOf(card, SELECTORS.card.title);
  if (id === "" || title === "") {
    throw fail("PARSE", "Tarjeta de serie sin enlace o sin título", {
      url,
      selector: `${SELECTORS.card.link} / ${SELECTORS.card.title}`,
    });
  }

  let kind;
  let statusText = "";
  for (const badge of card.select(SELECTORS.card.badge)) {
    const text = collapse(badge.text());
    if (text === "") {
      continue;
    }
    if (kind === undefined) {
      const value = kindOf(text);
      if (value !== undefined) {
        kind = value;
        continue;
      }
    }
    if (statusText === "" && statusOf(text) !== "unknown") {
      statusText = text;
    }
  }

  const cover = attrOf(card, SELECTORS.card.image, "src");
  return compact({
    id,
    title,
    cover: cover === "" ? undefined : imageRef(cover, undefined, cookie),
    kind,
    badges: statusText === "" ? [] : [statusText],
  });
}

/** Primera rejilla con tarjetas (top: «Más leídas»; home: «Últimas series»). */
function firstGrid(document, url, cookie) {
  for (const grid of document.select(SELECTORS.grid)) {
    const cards = grid.select(SELECTORS.card.root);
    if (cards.length > 0) {
      return cards.map((card) => itemOf(card, url, cookie));
    }
  }
  throw fail("PARSE", "La página no trae ninguna rejilla de series", {
    url,
    selector: SELECTORS.grid,
  });
}

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** Una página de listado: tarjetas de la primera rejilla y «Siguiente» si existe. */
export async function listPage(host, url) {
  const session = createSession();
  const { document } = await loadDocument(host, session, url);
  const hasNext = document.select(SELECTORS.pagination).some((link) => /siguiente/iu.test(link.text()));
  return { items: firstGrid(document, url, cookieHeader(session)), hasNext };
}

/** `/top` no pagina (ignora `?page=`): solo la primera página trae datos. */
export async function popular(host, page) {
  if (pageNumber(page) > 1) {
    return { items: [], hasNext: false };
  }
  return { ...(await listPage(host, ROUTES.popular())), hasNext: false };
}

export function latest(host, page) {
  return listPage(host, ROUTES.latest(pageNumber(page)));
}
