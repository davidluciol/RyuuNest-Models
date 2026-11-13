/** Constantes del sitio: dominio, cabeceras, selectores y expresiones regulares. */

export const BASE_URL = "https://m440.in";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

/** Rutas del sitio. El home trae las dos listas y el buscador es un JSON. */
export const ROUTES = {
  home: `${BASE_URL}/`,
  /** Fragmento HTML del directorio (`/manga-list`); acepta cat, alpha, sortBy y asc. */
  catalog: (params) => `${BASE_URL}/filterList?${new URLSearchParams(params).toString()}`,
  search: (query) => `${BASE_URL}/search?q=${encodeURIComponent(query)}`,
};

export const SELECTORS = {
  popular: {
    card: "ul.hot-thumbnails li.span3",
    link: ".manga-name a",
    cover: "img",
    score: ".label-info",
    chapter: "div.well p",
  },
  latest: {
    item: ".mangalist .manga-item",
    link: "h3 a[href]",
    tooltip: 'h3 a[data-toggle="tooltip"]',
    genre: "h3 span.label",
    date: "small",
    chapter: "h6.events-subtitle a",
  },
  catalog: {
    card: "div.col-sm-6 div.media",
    link: "a.chart-title",
    cover: "a.thumbnail img",
    score: ".label-info",
    info: ".media-body > div",
    nextPage: "ul.pagination a[rel=next]",
  },
  search: {
    title: "a.chart-title",
    link: "a[href]",
    cover: "img",
    status: "span.label",
  },
  details: {
    cover: "div.boxed img.img-responsive",
    rating: "#item-rating",
    summary: "div.well",
  },
  pages: {
    title: "h1 b",
    images: "img[data-src]",
  },
};

/** El listado de capítulos viene cifrado en la ficha; su clave es fija. */
export const CHAPTER_KEY = "X^Ib1O*HLVh%3W2t";
export const MANGA_PAYLOAD = "const jsmangas = ";
export const CHAPTER_PAYLOAD = 'const UsaPoncho = "';

export const CHALLENGE_TITLE = /just a moment|attention required|checking your browser/iu;
export const DEMOGRAPHIC_ROW = /<dt>\s*Demogr[áa]fico\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/iu;
export const IMAGE_SOURCE = /src=['"]([^'"]+)['"]/iu;

/** Géneros del directorio: `cat` es el id numérico del sitio. */
export const CATEGORIES = [
  "Action", "Adventure", "Comedy", "Doujinshi", "Drama", "Ecchi", "Fantasy", "Gender Bender",
  "Harem", "Historical", "Horror", "Josei", "Martial Arts", "Mature", "Mecha", "Mystery",
  "One Shot", "Psychological", "Romance", "School Life", "Sci-fi", "Seinen", "Shoujo",
  "Shoujo Ai", "Shounen", "Shounen Ai", "Slice of Life", "Sports", "Supernatural", "Tragedy",
  "Yaoi", "Yuri", "Hentai", "Smut",
];

/** Orden del directorio: `views` va de mayor a menor y `name` de la A a la Z. */
export const SORTS = { name: { sortBy: "name", asc: "true" }, views: { sortBy: "views", asc: "false" } };
