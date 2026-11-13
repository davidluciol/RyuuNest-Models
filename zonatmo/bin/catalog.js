/** Biblioteca del sitio: secciones del home, «ver más», filtros y búsqueda, con respaldo en el espejo. */

import {
  ADULT_GENRES,
  DEMOGRAPHIES,
  GENRES,
  LIBRARY_URL,
  SORTS,
  STATUSES,
  TYPES,
} from "./config.js";
import { listPage } from "./home.js";
import { mirrorList } from "./mirror.js";

/** Secciones del home: cada una es un orden de la biblioteca. */
const SECTIONS = [
  { id: "popular", title: "Populares", sort: "likes_count" },
  { id: "latest", title: "Últimas añadidas", sort: "creation" },
  { id: "top", title: "Mejor puntuadas", sort: "score" },
];

const options = (list) => list.map(([value, label]) => ({ value, label }));

export const FILTERS = [
  { id: "sort", label: "Orden", type: "select", options: SORTS.map(({ value, label }) => ({ value, label })) },
  { id: "type", label: "Tipo", type: "select", options: options(TYPES) },
  { id: "demography", label: "Demografía", type: "select", options: options(DEMOGRAPHIES) },
  { id: "status", label: "Estado", type: "select", options: options(STATUSES) },
  { id: "genre", label: "Género", type: "select", options: options(GENRES) },
  {
    id: "content",
    label: "Contenido",
    type: "select",
    options: [{ value: "sfw", label: "Ocultar +18" }],
  },
];

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** URL de `/biblioteca`; los valores que no estén en las tablas se descartan. */
function libraryUrl(query, filters, page) {
  const sort = SORTS.find((candidate) => candidate.value === filters?.sort) ?? SORTS[0];
  const params = new URLSearchParams({
    order_item: sort.value,
    order_dir: sort.dir,
    page: String(page),
  });
  if (query !== "") {
    params.set("title", query);
    params.set("filter_by", "title");
  }
  for (const [name, list] of [["type", TYPES], ["demography", DEMOGRAPHIES], ["status", STATUSES]]) {
    if (list.some(([value]) => value === filters?.[name])) params.set(name, filters[name]);
  }
  if (GENRES.some(([value]) => value === filters?.genre)) params.append("genders[]", filters.genre);
  if (filters?.content === "sfw") {
    for (const id of ADULT_GENRES) params.append("exclude_genders[]", id);
  }
  return `${LIBRARY_URL}?${params}`;
}

/** Sitio principal y, si falla (salvo un 404 real), el espejo. Si ambos fallan, el error del principal. */
export async function withMirror(primary, mirror) {
  try {
    return await primary();
  } catch (error) {
    if (error?.code === "NOT_FOUND") throw error;
    try {
      return await mirror();
    } catch {
      throw error;
    }
  }
}

/** Lista con texto y filtros opcionales. Base de popular, latest, home, list y search. */
export function browse(host, query, filters, page) {
  const text = String(query ?? "").trim();
  const current = pageNumber(page);
  return withMirror(
    () => listPage(host, libraryUrl(text, filters, current)),
    () => mirrorList(host, text, filters, current),
  );
}

export async function home(host) {
  const sections = [];
  for (const section of SECTIONS) {
    const result = await browse(host, "", { sort: section.sort }, 1);
    sections.push({ id: section.id, title: section.title, kind: "list", ...result });
  }
  return { sections };
}

export function list(host, sectionId, page) {
  const section = SECTIONS.find((candidate) => candidate.id === sectionId);
  if (section === undefined) {
    return Promise.resolve({ items: [], hasNext: false });
  }
  return browse(host, "", { sort: section.sort }, page);
}

export function filters() {
  return FILTERS;
}
