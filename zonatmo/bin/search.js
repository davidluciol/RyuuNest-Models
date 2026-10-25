/** Buscador de la biblioteca por título. */

import { ROUTES } from "./config.js";
import { listPage } from "./home.js";

export function search(host, query, page) {
  const text = String(query ?? "").trim();
  const current = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  if (text === "") {
    return Promise.resolve({ items: [], hasNext: false });
  }
  return listPage(host, ROUTES.search(text, current));
}
