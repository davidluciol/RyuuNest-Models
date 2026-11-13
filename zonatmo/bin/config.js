/** Constantes del sitio: dominio, cabeceras, selectores y expresiones regulares. */

export const BASE_URL = "https://zonatmo.org";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

/** Espejo de respaldo `zonatmo.to`: WordPress con API JSON (`/wp-api/api`), fichas en `/wp-json` y CDN propio. */
export const MIRROR_URL = "https://zonatmo.to";
export const MIRROR_CDN = "https://cdn.zonatmo.to";
export const MIRROR_ROUTES = {
  listing: `${MIRROR_URL}/wp-api/api/listing/manga`,
  single: (slug) => `${MIRROR_URL}/wp-api/api/single/manga/${encodeURIComponent(slug)}`,
  chapterList: (slug, page) =>
    `${MIRROR_URL}/wp-api/api/single/manga/${encodeURIComponent(slug)}/chapters?page=${page}&postsPerPage=25&order=desc`,
  chapter: (slug, chapterSlug) =>
    `${MIRROR_URL}/wp-api/api/single/manga/${encodeURIComponent(slug)}/${encodeURIComponent(chapterSlug)}`,
  manga: (id) => `${MIRROR_URL}/wp-json/seventi-manga/v1/manga/${id}`,
  uploads: `${MIRROR_URL}/wp-content/uploads`,
};
export const MIRROR_PAGE_SIZE = 24;

/** `/biblioteca` sirve todas las listas; el orden y los filtros van en la query. */
export const LIBRARY_URL = `${BASE_URL}/biblioteca`;

/** Orden: `value` es `order_item` del sitio; `mirror` = [orderBy, order] del espejo. */
export const SORTS = [
  { value: "likes_count", label: "Más populares", dir: "desc", mirror: ["score", "desc"] },
  { value: "creation", label: "Más nuevas", dir: "desc", mirror: ["manga_id", "desc"] },
  { value: "score", label: "Mejor puntuadas", dir: "desc", mirror: ["score", "desc"] },
  { value: "num_chapters", label: "Más capítulos", dir: "desc", mirror: ["total_chapters", "desc"] },
  { value: "alphabetically", label: "A-Z", dir: "asc", mirror: ["title", "asc"] },
];

/** Opciones `[valor en el sitio, etiqueta, id en el espejo]`; sin id = el espejo no la tiene. */
export const TYPES = [
  ["manga", "Manga", 14], ["manhwa", "Manhwa", 87], ["manhua", "Manhua", 31],
  ["webtoon", "Webtoon"], ["novel", "Novela", 214], ["comic", "Comic"],
  ["one_shot", "One shot", 12312], ["doujinshi", "Doujinshi", 207], ["oel", "OEL", 976],
];
export const DEMOGRAPHIES = [
  ["seinen", "Seinen", 45], ["shoujo", "Shoujo", 20], ["shounen", "Shounen", 13],
  ["josei", "Josei", 55], ["kodomo", "Kodomo", 633],
];
export const STATUSES = [
  ["ongoing", "En emisión", 12], ["completed", "Completado", 19], ["ended", "Finalizado", 19],
  ["hiatus", "En pausa", 174], ["cancelled", "Cancelado", 198],
];
/** Géneros comunes a ambos sitios: `[id en el sitio, etiqueta, id en el espejo]`. */
export const GENRES = [
  ["1", "Acción", 2], ["2", "Aventura", 3], ["3", "Comedia", 4], ["4", "Drama", 15],
  ["5", "Fantasía", 5], ["6", "Horror", 82], ["7", "Misterio", 40], ["8", "Romance", 16],
  ["9", "Ciencia ficción", 21], ["12", "Sobrenatural", 7], ["13", "Thriller", 49],
  ["15", "Psicológico", 36], ["17", "Mecha", 144], ["19", "Ecchi", 32], ["20", "Harem", 8],
  ["22", "Recuentos de la vida", 33], ["25", "Familia", 1027], ["26", "Magia", 6],
  ["28", "Vida escolar", 23], ["30", "Boys Love", 103], ["35", "Girls Love", 22],
  ["36", "Reencarnación", 60], ["37", "Tragedia", 46], ["41", "Artes marciales", 26],
  ["43", "Militar", 342], ["44", "Gore", 181], ["46", "Deporte", 37],
  ["47", "Apocalíptico", 861], ["48", "Supervivencia", 112], ["49", "Realidad virtual", 27],
  ["50", "Demonios", 88], ["55", "Historia", 81], ["56", "Parodia", 820],
  ["57", "Vampiros", 345], ["58", "Superpoderes", 116], ["59", "Samurái", 99],
  ["60", "Niños", 219], ["62", "Ciberpunk", 356], ["63", "Música", 403],
  ["64", "Guerra", 1109], ["65", "Policiaco", 111], ["66", "Crimen", 41],
  ["67", "Telenovela", 470], ["70", "Extranjero", 1168], ["118", "Sistema de niveles", 12868],
  ["128", "Venganza", 12891],
];
/** Géneros del sitio que marcan contenido adulto (+18, +19, Erótica, Adulto, Smut). */
export const ADULT_GENRES = ["27", "144", "123", "32", "29"];

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
