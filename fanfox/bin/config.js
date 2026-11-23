/** Constantes de FanFox: dominios, cabeceras y opciones del buscador. */

export const BASE_URL = "https://fanfox.net";
export const MOBILE_URL = "https://m.fanfox.net";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export const ACCEPT_LANGUAGE = "en-US,en;q=0.9";
/** Sin esta cookie las fichas para adultos muestran un aviso en vez de los capítulos. */
export const ADULT_COOKIE = "isAdult=1";

/** `slug` de serie y `slug/[vNN/]cNNN` de capítulo, tal como salen en las rutas del sitio. */
export const SERIES_ID = /^[a-z0-9_]+$/u;
export const CHAPTER_ID = /^[a-z0-9_]+\/(?:v[a-zA-Z0-9.]+\/)?c[0-9.]+$/u;

/** Órdenes del directorio (`/directory/?{sort}`); `""` es el orden por popularidad. */
export const SECTIONS = [
  { id: "popular", title: "Populares", sort: "" },
  { id: "latest", title: "Últimas actualizaciones", sort: "latest" },
  { id: "rating", title: "Mejor valoradas", sort: "rating" },
  { id: "news", title: "Nuevas series", sort: "news" },
];

/** `genres` del buscador: el servidor solo aplica un género (con «1,12» ignora el resto). */
export const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Martial Arts", "Shounen", "Horror", "Supernatural",
  "Harem", "Psychological", "Romance", "School Life", "Shoujo", "Mystery", "Sci-fi", "Seinen", "Tragedy",
  "Ecchi", "Sports", "Slice of Life", "Mature", "Shoujo Ai", "Webtoons", "Doujinshi", "One Shot", "Smut",
  "Yaoi", "Josei", "Historical", "Shounen Ai", "Gender Bender", "Adult", "Yuri", "Mecha", "Lolicon", "Shotacon",
].map((label, index) => ({ value: String(index + 1), label }));

/** `type` del buscador. */
export const TYPES = [
  ["1", "Manga japonés"], ["2", "Manhwa coreano"], ["3", "Manhua chino"], ["4", "Europeo"],
  ["5", "Americano"], ["6", "Hong Kong"], ["7", "Otro"],
].map(([value, label]) => ({ value, label }));

/** `st` del buscador («Completed?»: 2 = sí, 1 = no). */
export const STATUSES = [
  { value: "1", label: "En curso" },
  { value: "2", label: "Completada" },
];

/** Géneros que marcan una ficha como `nsfw` aunque el módulo no lo sea. */
export const NSFW_GENRES = new Set(["Adult", "Smut", "Mature", "Hentai"]);
