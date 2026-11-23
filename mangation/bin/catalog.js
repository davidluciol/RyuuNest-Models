/** Listas (populares, nuevos, buscador híbrido, géneros), home y filtros. */

import {
  ADULT, DEMOGRAPHICS, MAX_LIBRARY_PAGES, ORDERS, SEARCH_LIMIT, SERIES_ID, STATUSES, TYPES,
} from "./config.js";
import { apiJson, imageHeaders, mediaUrl, pageData } from "./utils/http.js";

const labelOf = (options, value) => options.find((o) => o.value === value)?.label;
const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const valid = (options, values) => asArray(values).filter((v) => options.some((o) => o.value === v));
const EMPTY = { items: [], hasNext: false };

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** Las novelas son texto: fuera de todas las listas (sin verificar, hoy no hay ninguna). */
const isComic = (manga) => manga?.slug && manga.type !== "novela";

export function summaryOf(manga) {
  const cover = mediaUrl(manga.cover);
  const badges = [labelOf(TYPES, manga.type), labelOf(DEMOGRAPHICS, manga.demografy)].filter(Boolean);
  if (manga.adult === true) badges.push("+18");
  return {
    id: manga.slug,
    title: manga.title || manga.slug,
    ...(cover ? { cover: { url: cover, headers: imageHeaders() } } : {}),
    kind: TYPES.some((t) => t.value === manga.type) ? manga.type : "manga",
    nsfw: manga.adult === true,
    badges,
  };
}

const cards = (list) => (Array.isArray(list) ? list : []).filter(isComic).map(summaryOf);

/** `+18` por defecto visible; solo `"false"` lo oculta. */
const showAdult = (filters) => filters?.adult !== "false";

/** `/public/mangas/library` con los filtros que el servidor admite (sus enums exactos). */
function libraryQuery(page, filters = {}) {
  const params = new URLSearchParams();
  const types = valid(TYPES, filters.type);
  for (const type of types.length > 0 ? types : TYPES.map((t) => t.value)) params.append("type", type);
  for (const value of valid(DEMOGRAPHICS, filters.demografy)) params.append("demografy", value);
  for (const value of valid(STATUSES, filters.status)) params.append("status", value);
  params.set("adult", String(showAdult(filters)));
  params.set("sort", valid(ORDERS, filters.order)[0] ?? ORDERS[0].value);
  params.set("page", String(pageNumber(page)));
  return params.toString();
}

async function libraryPage(host, page, filters) {
  const body = await apiJson(host, `/public/mangas/library?${libraryQuery(page, filters)}`);
  return { raw: body?.items ?? [], hasNext: pageNumber(page) < Number(body?.totalPages ?? 0) };
}

async function library(host, page, filters) {
  const { raw, hasNext } = await libraryPage(host, page, filters);
  return { items: cards(raw), hasNext };
}

export async function popular(host, page) {
  if (pageNumber(page) > 1) return EMPTY; // `/popular` trae una sola lista fija
  const data = await pageData(host, "/popular");
  return { items: cards(data?.mangas), hasNext: false };
}

export const latest = (host, page) => library(host, page, {});

async function genrePage(host, slug, page, filters) {
  const data = await pageData(host, `/genre/${slug}`, `?page=${pageNumber(page)}`);
  const raw = (data?.items ?? []).filter((m) => showAdult(filters) || m.adult !== true);
  return { items: cards(raw), hasNext: pageNumber(page) < Number(data?.totalPages ?? 0) };
}

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Filtros aplicados en local a resultados de texto (la API de búsqueda no los acepta). */
function matches(manga, filters = {}) {
  const check = (options, field) => {
    const wanted = valid(options, filters[field]);
    return wanted.length === 0 || manga[field] === undefined || wanted.includes(manga[field]);
  };
  return (showAdult(filters) || manga.adult !== true) &&
    check(TYPES, "type") && check(DEMOGRAPHICS, "demografy") && check(STATUSES, "status");
}

/** Recorre la library con `+18` y todos los tipos y filtra por título. */
async function scanLibrary(host, text) {
  const found = [];
  for (let page = 1; page <= MAX_LIBRARY_PAGES; page += 1) {
    const { raw, hasNext } = await libraryPage(host, page, {});
    found.push(...raw.filter((m) => fold(m.title).includes(fold(text))));
    if (!hasNext) break;
  }
  return found;
}

/**
 * Con texto: la API (máx. 5). Si llega al tope, se completa con la library entera.
 * Sin texto: library con filtros, o el listado del género (no se combina con los demás filtros).
 */
export async function search(host, query, page, filters = {}) {
  const text = String(query ?? "").trim();
  if (text === "") {
    const genre = String(filters?.genre ?? "");
    return SERIES_ID.test(genre) ? genrePage(host, genre, page, filters) : library(host, page, filters);
  }
  if (text.length < 2 || pageNumber(page) > 1) return EMPTY;
  let found = (await apiJson(host, `/public/mangas?${new URLSearchParams({ q: text })}`))?.data ?? [];
  if (found.length >= SEARCH_LIMIT) {
    const seen = new Set(found.map((m) => m.slug));
    found = [...found, ...(await scanLibrary(host, text)).filter((m) => !seen.has(m.slug) && seen.add(m.slug))];
  }
  return { items: cards(found.filter((m) => matches(m, filters))), hasNext: false };
}

const SECTIONS = [
  { id: "popular", title: "Populares", load: popular },
  { id: "latest", title: "Nuevos", load: latest },
];

export async function list(host, sectionId, page) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  return section ? section.load(host, page) : EMPTY;
}

export async function home(host) {
  const sections = await Promise.all(
    SECTIONS.map(async ({ id, title, load }) => ({ id, title, kind: "list", ...(await load(host, 1)) })),
  );
  return { sections };
}

/** Los géneros salen de la API para no quedar desfasados. */
export async function filters(host) {
  const body = await apiJson(host, "/public/genres");
  const genres = (body?.genres ?? [])
    .filter((g) => SERIES_ID.test(String(g.slug ?? "")) && g.name)
    .map((g) => ({ value: g.slug, label: String(g.name) }));
  return [
    { id: "type", label: "Tipo", type: "multi", options: TYPES },
    { id: "demografy", label: "Demografía", type: "multi", options: DEMOGRAPHICS },
    { id: "status", label: "Estado", type: "multi", options: STATUSES },
    { id: "order", label: "Orden", type: "select", options: ORDERS },
    { id: "genre", label: "Género (sin otros filtros)", type: "select", options: genres },
    { id: "adult", label: "Incluir +18", type: "select", options: ADULT },
  ];
}
