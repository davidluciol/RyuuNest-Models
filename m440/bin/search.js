/** Buscador: el autocompletado del sitio devuelve un JSON con hasta 20 series. */

import { catalogPage } from "./catalog.js";
import { CATEGORIES, ROUTES, SELECTORS } from "./config.js";
import { fail } from "./utils/errors.js";
import { requestHeaders, statusError } from "./utils/http.js";
import { attrOf, collapse, compact, splitList, textOf } from "./utils/text.js";
import { imageRef, relativePath } from "./utils/url.js";

function itemOf(host, entry) {
  if (entry === null || typeof entry !== "object") {
    return undefined;
  }
  const label = host.html(String(entry.label ?? ""));
  const id =
    relativePath(attrOf(label, SELECTORS.search.link, "href"), false) ||
    (typeof entry.data === "string" && entry.data !== "" ? `/manga/${entry.data}` : "");
  const title = collapse(entry.value) || textOf(label, SELECTORS.search.title);
  if (id === "" || title === "") {
    return undefined;
  }
  const status =
    attrOf(label, SELECTORS.search.status, "title") || textOf(label, SELECTORS.search.status);
  const cover = attrOf(label, SELECTORS.search.cover, "src");
  return compact({
    id,
    title,
    cover: cover === "" ? undefined : imageRef(cover),
    badges: [status, ...splitList(entry.categories)].filter((badge) => badge !== ""),
  });
}

/** Con filtros y sin texto se usa el directorio; con texto, el autocompletado (el género filtra su resultado). */
export async function search(host, query, page, filters) {
  const text = String(query ?? "").trim();
  const current = Number(page);
  if (text === "" && filters !== undefined && Object.keys(filters).length > 0) {
    return catalogPage(host, filters, page);
  }
  if (text.length < 2 || (Number.isInteger(current) && current > 1)) {
    return { items: [], hasNext: false };
  }
  const genre = CATEGORIES[Number(filters?.cat) - 1];
  const url = ROUTES.search(text);
  const response = await host.fetch(url, { headers: requestHeaders(undefined, "application/json") });
  if (response.status < 200 || response.status > 299) {
    throw statusError(url, response.status);
  }
  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw fail("PARSE", "El buscador no devolvió JSON válido", { url, selector: "response" });
  }
  if (!Array.isArray(payload)) {
    throw fail("PARSE", "El buscador devolvió un JSON con forma inesperada", {
      url,
      selector: "response[]",
    });
  }
  const items = payload
    .map((entry) => itemOf(host, entry))
    .filter((item) => item !== undefined)
    .filter((item) => genre === undefined || item.badges?.includes(genre));
  if (payload.length > 0 && items.length === 0 && genre === undefined) {
    throw fail("PARSE", "El buscador trae resultados pero ninguno se pudo leer", {
      url,
      selector: `${SELECTORS.search.link} / ${SELECTORS.search.title}`,
    });
  }
  return { items, hasNext: false };
}
