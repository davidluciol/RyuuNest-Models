/** Constantes de Mangation: dominios, cabeceras y opciones del catálogo (enums de su API). */

export const BASE_URL = "https://mangation.com";
export const API_URL = "https://api.mangation.com/api";
export const MEDIA_URL = "https://media.mangation.com";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

/** Slug de serie tal como lo usa el sitio en `/manga/<slug>`. */
export const SERIES_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** `/public/mangas?q=` nunca devuelve más de 5 resultados ni pagina. */
export const SEARCH_LIMIT = 5;
/** shortcut: la búsqueda completa recorre hasta 10 páginas de 24 (240 obras); subir si el catálogo crece. */
export const MAX_LIBRARY_PAGES = 10;
/** shortcut: tope de 100 páginas de 10 capítulos por serie; subir si aparece una serie más larga. */
export const MAX_CHAPTER_PAGES = 100;

/** `novela` existe en la API pero se excluye (sin verificar: hoy no hay ninguna). */
export const TYPES = [
  { value: "manga", label: "Manga" },
  { value: "manhwa", label: "Manhwa" },
  { value: "manhua", label: "Manhua" },
];

export const DEMOGRAPHICS = [
  { value: "shonen", label: "Shōnen" },
  { value: "shojo", label: "Shōjo" },
  { value: "seinen", label: "Seinen" },
  { value: "josei", label: "Josei" },
  { value: "kodomo", label: "Kodomo" },
  { value: "yaoi", label: "Yaoi" },
  { value: "yuri", label: "Yuri" },
  { value: "bl", label: "BL" },
  { value: "gl", label: "GL" },
];

export const STATUSES = [
  { value: "ongoing", label: "En curso" },
  { value: "completed", label: "Finalizado" },
  { value: "hiatus", label: "En pausa" },
];

export const ORDERS = [
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguos" },
];

/** Primera opción = valor por defecto (todo visible, el manifest declara nsfw). */
export const ADULT = [
  { value: "true", label: "Sí" },
  { value: "false", label: "No" },
];
