/** Listas (tendencia, recientes, búsqueda), home y filtros sobre `AlbumList`. */

import { DEFAULT_LANGUAGE, GENRES, LANGUAGES, ORDERS, TYPES } from "./config.js";
import { graphql, imageHeaders } from "./utils/http.js";

const SECTIONS = ORDERS.slice(0, 3);

function pageNumber(page) {
  const value = Number(page);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** Valores de las etiquetas de una categoría: `Artist: nombre` → `nombre`. */
export function tagsOf(album, category) {
  return (album.tags ?? [])
    .filter((tag) => (tag.category ?? null) === category)
    .map((tag) => String(tag.text ?? "").replace(/^[^:]*:\s*/u, ""))
    .filter(Boolean);
}

/** `Spanish / Español` → `Español`; `English` se queda igual. */
function languageOf(album) {
  const title = album.language?.title;
  return title ? title.split(" / ").pop() : undefined;
}

export function summaryOf(album) {
  const artists = tagsOf(album, "Artist").join(", ");
  const badges = [languageOf(album), album.is_manga ? "Manga" : "Imágenes"].filter(Boolean);
  return {
    id: String(album.id),
    title: album.title || `#${album.id}`,
    ...(album.cover?.url ? { cover: { url: album.cover.url, headers: imageHeaders() } } : {}),
    kind: "manga",
    nsfw: true,
    badges,
    ...(artists === "" ? {} : { hint: artists }),
  };
}

/** `input` de `AlbumList`. Con texto y sin orden elegido se ordena por relevancia. */
export function listInput(query, page, { language, type, order, genre } = {}) {
  const text = String(query ?? "").trim();
  const lang = LANGUAGES.some((l) => l.value === language) ? language : DEFAULT_LANGUAGE;
  const filters = [{ name: "album_type", value: TYPES.some((t) => t.value === type) ? type : "manga" }];
  if (lang !== "all") filters.push({ name: "language_ids", value: `+${lang}` });
  if (GENRES.some((g) => g.value === genre)) filters.push({ name: "genre_ids", value: `+${genre}` });
  if (text !== "") filters.push({ name: "search_query", value: text });
  const chosen = ORDERS.find((o) => o.value === order)?.value;
  const display = chosen ?? (text !== "" ? "search_score" : ORDERS[0].value);
  return { display, filters, page: pageNumber(page) };
}

async function albumPage(host, query, page, filters) {
  const data = await graphql(host, "AlbumList", { input: listInput(query, page, filters) });
  const list = data.album?.list;
  return { items: (list?.items ?? []).map(summaryOf), hasNext: list?.info?.has_next_page === true };
}

export const popular = (host, page) => albumPage(host, "", page, { order: "date_trending" });
export const latest = (host, page) => albumPage(host, "", page, { order: "date_newest" });
export const search = (host, query, page, filters) => albumPage(host, query, page, filters ?? {});
export const list = (host, sectionId, page) => albumPage(host, "", page, { order: sectionId });

export async function home(host) {
  const sections = await Promise.all(
    SECTIONS.map(async ({ value, label }) => {
      const result = await list(host, value, 1);
      return { id: value, title: label, kind: "list", items: result.items, hasNext: result.hasNext };
    }),
  );
  return { sections };
}

export function filters() {
  const select = (id, label, options) => ({ id, label, type: "select", options });
  return [
    select("language", "Idioma", LANGUAGES),
    select("type", "Tipo", TYPES),
    select("order", "Orden", ORDERS),
    select("genre", "Género", GENRES),
  ];
}
