/** Constantes de E-Hentai: dominios, cabeceras y opciones del buscador. */

export const BASE_URL = "https://e-hentai.org";
export const API_URL = "https://api.e-hentai.org/api.php";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

/** Miniaturas por página de galería para visitantes sin cuenta (= imágenes por «capítulo»). */
export const THUMBS_PER_PAGE = 20;

/** `f_cats` es la máscara de categorías EXCLUIDAS: 1023 = todas. */
export const ALL_CATEGORIES = 1023;
export const CATEGORIES = [
  ["2", "Doujinshi"], ["4", "Manga"], ["8", "Artist CG"], ["16", "Game CG"], ["512", "Western"],
  ["256", "Non-H"], ["32", "Image Set"], ["64", "Cosplay"], ["128", "Asian Porn"], ["1", "Misc"],
].map(([value, label]) => ({ value, label }));

/** `value` es la etiqueta `language:` del sitio; `any` no filtra. */
export const DEFAULT_LANGUAGE = "spanish";
export const LANGUAGES = [
  ["spanish", "Español"], ["english", "Inglés"], ["japanese", "Japonés"], ["chinese", "Chino"],
  ["korean", "Coreano"], ["portuguese", "Portugués"], ["french", "Francés"], ["russian", "Ruso"],
  ["any", "Todos"],
].map(([value, label]) => ({ value, label }));

/** Valoración mínima (`f_srdd`, estrellas). */
export const RATINGS = ["2", "3", "4", "5"].map((value) => ({ value, label: `${value}★ o más` }));
