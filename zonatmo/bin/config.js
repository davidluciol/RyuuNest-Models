/** Constantes del sitio: dominio, cabeceras, selectores y expresiones regulares. */

export const BASE_URL = "https://zonatmo.org";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

/** Rutas de la biblioteca: las tres listas comparten el mismo marcado de tarjeta. */
export const ROUTES = {
  popular: (page) =>
    `${BASE_URL}/biblioteca?order_item=likes_count&order_dir=desc&page=${page}`,
  latest: (page) => `${BASE_URL}/biblioteca?order_item=creation&order_dir=desc&page=${page}`,
  search: (query, page) =>
    `${BASE_URL}/biblioteca?title=${encodeURIComponent(query)}&filter_by=title&page=${page}`,
};

export const SELECTORS = {
  card: {
    root: "div.element",
    link: "a",
    thumbnail: "div.thumbnail",
    image: "img",
    title: "div.thumbnail-title h4",
    kind: "span.book-type",
    score: "span.score",
    mature: "span.book-meta-mature",
    status: "span.book-meta-status",
    chapters: "span.book-meta-item",
    demography: "span.demography",
  },
  nextPage: 'a[rel="next"]',
  details: {
    title: "h1.element-title",
    kind: "h1.book-type",
    cover: "img.book-thumbnail",
    score: "div.element-image div.score span",
    demography: "div.element-image div.demography",
    description: "p.element-description",
    genres: "h6 a.badge",
    status: "span.book-status",
    synonyms: "div.synonyms-wrap",
    meta: "div.manga-meta-bar span",
    authors: 'a[href*="filter_by=author"]',
    chapters: "li.upload-link",
    chapterTitle: "span.chapter-number",
    releases: "div.chapter-detail div.d-flex.align-items-center.flex-wrap",
    releaseLink: "a.btn.btn-primary",
    releaseGroup: 'a[href*="/groups/"]',
    releaseDate: "span.text-muted.small",
    related: "div.rel-card",
    relatedLink: "a",
    relatedTitle: "div.thumbnail-title h4",
    relatedKind: "span.book-type",
    relatedScore: "span.score span",
    relatedDemography: "span.demography",
    relatedStyle: "style",
  },
  pages: {
    chapter: "#chapterSelect option[selected]",
    images: "img.reader-image",
  },
};

export const CHALLENGE_TITLE = /just a moment|attention required|checking your browser/iu;
export const CHAPTER_NUMBER = /^cap[ií]tulo\s+(\d+(?:[.,]\d+)?)/iu;
export const DISPLAY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u;
export const CHAPTERS_META = /^([\d.,]+)\s+cap[ií]tulos?$/iu;
export const VISITS_META = /^([\d.,]+)\s+visitas?$/iu;
export const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/u;
