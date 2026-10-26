/** Constantes del sitio: dominio, cabeceras, selectores y expresiones regulares. */

export const BASE_URL = "https://m440.in";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

/** Rutas del sitio. El home trae las dos listas y el buscador es un JSON. */
export const ROUTES = {
  home: `${BASE_URL}/`,
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
