/** Listas: populares (top) y últimas series (home), con la misma tarjeta. */

import { ROUTES, SELECTORS } from "./config.js";
import { fail } from "./utils/errors.js";
import { createSession, loadDocument } from "./utils/http.js";
import { kindOf, statusOf } from "./utils/normalize.js";
import { attrOf, collapse, compact, textOf } from "./utils/text.js";
import { imageRef, relativePath } from "./utils/url.js";

/** Tarjeta de serie → item de lista del contrato. */
export function itemOf(card, url) {
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
    cover: cover === "" ? undefined : imageRef(cover),
    kind,
    badges: statusText === "" ? [] : [statusText],
  });
}

/** Primera rejilla con tarjetas (top: «Más leídas»; home: «Últimas series»). */
function firstGrid(document, url) {
  for (const grid of document.select(SELECTORS.grid)) {
    const cards = grid.select(SELECTORS.card.root);
    if (cards.length > 0) {
      return cards.map((card) => itemOf(card, url));
    }
  }
  throw fail("PARSE", "La página no trae ninguna rejilla de series", {
    url,
    selector: SELECTORS.grid,
  });
}

async function singlePage(host, page, url) {
  if (Number(page) > 1) {
    return { items: [], hasNext: false };
  }
  const session = createSession();
  const { document } = await loadDocument(host, session, url);
  return { items: firstGrid(document, url), hasNext: false };
}

export function popular(host, page) {
  return singlePage(host, page, ROUTES.popular());
}

export function latest(host, page) {
  return singlePage(host, page, ROUTES.latest());
}
