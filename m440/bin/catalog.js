/** Directorio del sitio (`/filterList`): secciones del home, «ver más» y filtros del buscador. */

import { CATEGORIES, ROUTES, SELECTORS, SORTS } from "./config.js";
import { homeLists } from "./home.js";
import { loadDocument } from "./utils/http.js";
import { attrOf, collapse, compact, textOf } from "./utils/text.js";
import { imageRef, relativePath } from "./utils/url.js";

const ALPHA = ["Other", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** Secciones propias del sitio. `home` = vienen del home; `catalog` = del directorio. */
const SECTIONS = [
  { id: "popular", title: "Actualizaciones populares" },
  { id: "latest", title: "Últimas actualizaciones" },
  { id: "views", title: "Más leídos", sort: "views" },
  { id: "az", title: "Directorio A-Z", sort: "name" },
];

export const FILTERS = [
  {
    id: "cat",
    label: "Género",
    type: "select",
    options: CATEGORIES.map((label, index) => ({ value: String(index + 1), label })),
  },
  {
    id: "alpha",
    label: "Inicial",
    type: "select",
    options: ALPHA.map((value) => ({ value, label: value === "Other" ? "#" : value })),
  },
  {
    id: "sort",
    label: "Orden",
    type: "select",
    options: [
      { value: "name", label: "A-Z" },
      { value: "views", label: "Más visitas" },
    ],
  },
];

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** Tarjeta del directorio → item. Sin enlace o título, se omite (no rompe la página). */
function catalogItem(card) {
  const id = relativePath(attrOf(card, SELECTORS.catalog.link, "href"), false);
  const title =
    attrOf(card, SELECTORS.catalog.link, "title") || textOf(card, SELECTORS.catalog.link);
  if (id === "" || title === "") {
    return undefined;
  }
  const cover = attrOf(card, SELECTORS.catalog.cover, "src");
  const score = textOf(card, SELECTORS.catalog.score);
  const [views, genre] = card.select(SELECTORS.catalog.info).map((node) => collapse(node.text()));
  return compact({
    id,
    title,
    cover: cover === "" ? undefined : imageRef(cover),
    badges: [score === "" ? "" : `★ ${score}`, genre ?? ""].filter(Boolean),
    hint: views ? `${views} visitas` : "",
  });
}

/** Una página del directorio, con los filtros `cat`, `alpha` y `sort` ya validados. */
export async function catalogPage(host, filters, page) {
  const sort = SORTS[filters?.sort] ?? SORTS.name;
  const params = { page: String(pageNumber(page)), ...sort };
  if (CATEGORIES[Number(filters?.cat) - 1] !== undefined) params.cat = String(Number(filters.cat));
  if (ALPHA.includes(filters?.alpha)) params.alpha = filters.alpha;
  const { document } = await loadDocument(host, ROUTES.catalog(params));
  const items = document
    .select(SELECTORS.catalog.card)
    .map(catalogItem)
    .filter((item) => item !== undefined);
  return { items, hasNext: document.select(SELECTORS.catalog.nextPage).length > 0 };
}

/** Home dinámico: las listas del home y las primeras páginas del directorio. */
export async function home(host) {
  const lists = await homeLists(host);
  const sections = [];
  for (const section of SECTIONS) {
    let result = lists[section.id];
    if (result === undefined) {
      try {
        result = await catalogPage(host, { sort: section.sort }, 1);
      } catch (error) {
        // El directorio puede estar tras Cloudflare: la sección se omite, el home sigue.
        if (error?.code !== "BLOCKED") throw error;
        continue;
      }
    }
    sections.push({ id: section.id, title: section.title, kind: "list", ...result });
  }
  return { sections };
}

/** «Ver más» de una sección. */
export async function list(host, sectionId, page) {
  const section = SECTIONS.find((candidate) => candidate.id === sectionId);
  if (section === undefined) {
    return { items: [], hasNext: false };
  }
  if (section.sort !== undefined) {
    return catalogPage(host, { sort: section.sort }, page);
  }
  const lists = await homeLists(host);
  return pageNumber(page) > 1 ? { items: [], hasNext: false } : lists[section.id];
}

export function filters() {
  return FILTERS;
}
