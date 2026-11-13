/** Respaldo `zonatmo.to`: lista, busca, da fichas y páginas por su API JSON y su CDN. */

import {
  DEMOGRAPHIES,
  GENRES,
  MIRROR_CDN,
  MIRROR_PAGE_SIZE,
  MIRROR_ROUTES,
  MIRROR_URL,
  SORTS,
  STATUSES,
  TYPES,
  USER_AGENT,
} from "./config.js";
import { fail } from "./utils/errors.js";
import { requestHeaders, statusError } from "./utils/http.js";
import { kindOf, statusOf } from "./utils/normalize.js";
import { compact } from "./utils/text.js";

/** Ids del espejo: serie `/manga/<id>/<slug>`, release `/manga/<id>/<slug>/<capítulo>`; los del sitio principal son `/library/…`. */
const MAX_CHAPTER_PAGES = 60; // shortcut: 1 500 capítulos como máximo, subir si hace falta

export const isMirrorId = (id) => typeof id === "string" && id.startsWith("/manga/");

const TYPE_BY_ID = new Map(TYPES.filter((type) => type[2]).map((type) => [type[2], type[0]]));

async function getJson(host, url) {
  const response = await host.fetch(url, { headers: requestHeaders(`${MIRROR_URL}/`) });
  if (response.status < 200 || response.status > 299) {
    throw statusError(url, response.status);
  }
  let json;
  try {
    json = JSON.parse(await response.text());
  } catch {
    throw fail("PARSE", `El espejo no devolvió JSON en ${url}`, { url });
  }
  if (json?.error === true) {
    throw fail("NETWORK", `El espejo respondió con error en ${url}: ${json.message}`, { url });
  }
  return json;
}

/** Portada del espejo: la ruta viene relativa a `wp-content/uploads`. */
function coverRef(path) {
  const value = String(path ?? "").trim();
  if (value === "") {
    return undefined;
  }
  const url = /^https?:\/\//iu.test(value) ? value : `${MIRROR_ROUTES.uploads}${value}`;
  return { url, headers: { Referer: `${MIRROR_URL}/`, "User-Agent": USER_AGENT } };
}

function itemOf(row) {
  const score = Number(row.score);
  return compact({
    id: `/manga/${row._id}/${row.slug}`,
    title: String(row.title ?? "").trim(),
    cover: coverRef(row.cover),
    kind: kindOf(TYPE_BY_ID.get(row.types?.[0])),
    badges: [score > 0 ? `★ ${score}` : "", row.is_erotic ? "+18" : ""].filter(Boolean),
    hint: row.total_chapters ? `${row.total_chapters} capítulos` : "",
  });
}

const mirrorId = (list, value) => list.find((option) => option[0] === value)?.[2];

/** Una página del espejo con los mismos filtros que `/biblioteca` (los que no tenga se ignoran). */
export async function mirrorList(host, query, filters, page) {
  const sort = SORTS.find((candidate) => candidate.value === filters?.sort) ?? SORTS[0];
  const params = new URLSearchParams({
    page: String(page),
    postsPerPage: String(MIRROR_PAGE_SIZE),
    orderBy: sort.mirror[0],
    order: sort.mirror[1],
  });
  const set = (name, value) => value !== undefined && params.set(name, String(value));
  set("search", query || undefined);
  set("type", mirrorId(TYPES, filters?.type));
  set("demography", mirrorId(DEMOGRAPHIES, filters?.demography));
  set("status", mirrorId(STATUSES, filters?.status));
  set("genres", mirrorId(GENRES, filters?.genre));
  set("erotic", filters?.content === "sfw" ? 0 : undefined);
  const url = `${MIRROR_ROUTES.listing}?${params}`;
  const { data } = await getJson(host, url);
  if (!Array.isArray(data?.items)) {
    throw fail("PARSE", "El listado del espejo no trae `items`", { url });
  }
  return { items: data.items.map(itemOf), hasNext: data.pagination?.has_next === true };
}

function parseId(seriesId) {
  const match = /^\/manga\/(\d+)\/([\w%-]+)$/u.exec(String(seriesId));
  if (match === null) {
    throw fail("NOT_FOUND", `Identificador de serie no válido: ${String(seriesId)}`);
  }
  return { id: match[1], slug: match[2] };
}

const lines = (text) =>
  String(text ?? "")
    .split(/[\n;]/u)
    .map((line) => line.trim())
    .filter(Boolean);

/** Todos los capítulos de la serie (el sitio da 25 por página). */
async function chapterRows(host, slug) {
  const rows = [];
  for (let page = 1; page <= MAX_CHAPTER_PAGES; page += 1) {
    const { data } = await getJson(host, MIRROR_ROUTES.chapterList(slug, page));
    rows.push(...(Array.isArray(data?.items) ? data.items : []));
    if (data?.pagination?.has_next !== true) break;
  }
  return rows;
}

/** Capítulos agrupados por número; cada versión (grupo) es un release. */
function chaptersOf(rows, seriesPath) {
  const byNumber = new Map();
  for (const row of rows) {
    const number = Number(row.chapter_number);
    const key = Number.isFinite(number) ? number : String(row.slug ?? row.id);
    const title = `Capítulo ${Number.isFinite(number) ? number : row.id}`;
    const entry = byNumber.get(key) ?? {
      id: title,
      title,
      ...(Number.isFinite(number) ? { number } : {}),
      releases: [],
    };
    entry.releases.push(
      compact({
        id: `${seriesPath}/${row.slug}`,
        group: row.group?.name,
        publishedAt: /^\d{4}-\d{2}-\d{2}/u.exec(row.release_date ?? "")?.[0],
      }),
    );
    byNumber.set(key, entry);
  }
  return [...byNumber.values()];
}

export async function mirrorDetails(host, seriesId) {
  const { id, slug } = parseId(seriesId);
  const manga = await getJson(host, MIRROR_ROUTES.manga(id));
  const title = String(manga?.title ?? "").trim();
  if (title === "") {
    throw fail("PARSE", "La ficha del espejo no trae título", { url: MIRROR_ROUTES.manga(id) });
  }
  const cover = coverRef((await getJson(host, MIRROR_ROUTES.single(slug))).data?.cover);
  const extra = compact({
    "Demografía": manga.demography,
    "Tipo": manga.type,
    "Autor": lines(Array.isArray(manga.author) ? manga.author.join(";") : manga.author).join(", "),
  });
  return {
    id: seriesId,
    title,
    ...(cover ? { cover } : {}),
    ...(manga.description ? { description: String(manga.description).trim() } : {}),
    genres: lines(manga.genres),
    status: statusOf(`${manga.status_raw ?? ""} ${manga.status ?? ""}`),
    altTitles: [...new Set([...lines(manga.alt_titles), ...lines(manga.synonyms)])],
    extra,
    chapters: chaptersOf(await chapterRows(host, slug), `/manga/${id}/${slug}`),
    related: [],
  };
}

/** Páginas: el capítulo trae `jit` y las imágenes salen de `<cdn>/manga/<jit>/<archivo>`. */
export async function mirrorPages(host, releaseId) {
  const match = /^\/manga\/\d+\/([\w%-]+)\/([\w%-]+)$/u.exec(String(releaseId));
  if (match === null) {
    throw fail("NOT_FOUND", `Identificador de release no válido: ${String(releaseId)}`);
  }
  const url = MIRROR_ROUTES.chapter(match[1], match[2]);
  const { data } = await getJson(host, url);
  const jit = String(data?.chapter?.jit ?? "");
  const images = Array.isArray(data?.chapter?.images) ? data.chapter.images : [];
  if (!/^[\w-]+\/[\w-]+$/u.test(jit) || images.length === 0) {
    throw fail("PARSE", "El capítulo del espejo no trae `jit` o imágenes", { url });
  }
  return {
    title: String(data.chapter.title ?? "").trim() || undefined,
    images: images.map((image) => {
      const file = String(image.image_url ?? "");
      if (!/^[\w.-]+$/u.test(file)) {
        throw fail("PARSE", "Una imagen del capítulo trae un nombre no válido", { url });
      }
      return {
        url: `${MIRROR_CDN}/manga/${jit}/${file}`,
        headers: { Referer: `${MIRROR_URL}/`, "User-Agent": USER_AGENT },
      };
    }),
  };
}
