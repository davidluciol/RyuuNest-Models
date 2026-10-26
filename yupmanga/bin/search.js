/** Buscador por título (`/search.php?q=…&page=N`). */

import { ROUTES, SELECTORS } from "./config.js";
import { itemOf } from "./home.js";
import { createSession, loadDocument } from "./utils/http.js";

function hasNextPage(document) {
  return document
    .select(SELECTORS.pagination)
    .some((link) => /siguiente/i.test(link.text()));
}

export async function search(host, query, page) {
  const text = String(query ?? "").trim();
  const current = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  if (text === "") {
    return { items: [], hasNext: false };
  }
  const url = ROUTES.search(text, current);
  const session = createSession();
  const { document } = await loadDocument(host, session, url);
  const items = document
    .select(SELECTORS.card.root)
    .map((card) => itemOf(card, url));
  return { items, hasNext: hasNextPage(document) };
}
