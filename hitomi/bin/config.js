/** Constantes de Hitomi.la: dominios, cabeceras y opciones del catálogo. */

export const BASE_URL = "https://hitomi.la";
export const CONTENT_URL = "https://ltn.gold-usergeneratedcontent.net";
export const IMAGE_DOMAIN = "gold-usergeneratedcontent.net";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

/** Elementos por página: cada uno cuesta una petición a `galleries/<id>.js`. */
export const PAGE_SIZE = 24;

export const DEFAULT_LANGUAGE = "spanish";
export const LANGUAGES = [
  { value: "spanish", label: "Español" },
  { value: "english", label: "Inglés" },
  { value: "japanese", label: "Japonés" },
  { value: "all", label: "Todos" },
];

/** Orden → carpeta/etiqueta de la lista `.nozomi` (`index` = más recientes). */
export const ORDERS = [
  { value: "new", label: "Más recientes", area: "index", tag: null },
  { value: "today", label: "Popular: hoy", area: "popular", tag: "today" },
  { value: "week", label: "Popular: semana", area: "popular", tag: "week" },
  { value: "month", label: "Popular: mes", area: "popular", tag: "month" },
  { value: "year", label: "Popular: año", area: "popular", tag: "year" },
];

export const TYPES = [
  { value: "doujinshi", label: "Doujinshi" },
  { value: "manga", label: "Manga" },
  { value: "artistcg", label: "Artist CG" },
  { value: "gamecg", label: "Game CG" },
  { value: "imageset", label: "Image set" },
  { value: "anime", label: "Anime" },
];

/** Namespaces del buscador (`female:yuri`, `artist:nombre`) → carpeta de la lista. */
export const NAMESPACES = {
  female: "tag",
  male: "tag",
  tag: "tag",
  artist: "artist",
  group: "group",
  series: "series",
  character: "character",
  type: "type",
};
