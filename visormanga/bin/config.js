/** Constantes de VisorManga: dominios, cabeceras, secciones y géneros. */

export const BASE_URL = "https://visormanga.com";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export const ACCEPT_LANGUAGE = "es-ES,es;q=0.9";

/** `slug` de serie y `slug-NN.NN` de capítulo, tal como salen en `/manga/…` y `/leer/…`. */
export const SERIES_ID = /^[a-z0-9-]+$/u;
export const CHAPTER_ID = /^[a-z0-9-]+-\d+(?:\.\d+)?$/u;

/** Secciones de `home()`; solo la biblioteca pagina. */
export const SECTIONS = [
  { id: "chapters", title: "Últimos capítulos" },
  { id: "new", title: "Últimos manhwas agregados" },
  { id: "popular", title: "Populares" },
  { id: "library", title: "Biblioteca" },
];

/** Rutas `/genero/<slug>`; el sitio no combina género y texto (`?search=` se ignora ahí). */
export const GENRES = Object.entries({
  accion: "Acción", animacion: "Animación", apocaliptico: "Apocalíptico", "artes-marciales": "Artes Marciales",
  aventura: "Aventura", "boys-love": "Boys Love", ciberpunk: "Ciberpunk", "ciencia-ficcion": "Ciencia Ficción",
  comedia: "Comedia", crimen: "Crimen", demonios: "Demonios", deporte: "Deporte", drama: "Drama", ecchi: "Ecchi",
  extranjero: "Extranjero", familia: "Familia", fantasia: "Fantasía", "genero-bender": "Género Bender",
  "girls-love": "Girls Love", gore: "Gore", guerra: "Guerra", harem: "Harem", historia: "Historia",
  horror: "Horror", magia: "Magia", mecha: "Mecha", militar: "Militar", misterio: "Misterio", musica: "Música",
  ninos: "Niños", oeste: "Oeste", parodia: "Parodia", policiaco: "Policiaco", psicologico: "Psicológico",
  realidad: "Realidad", "realidad-virtual": "Realidad Virtual", "recuentos-de-la-vida": "Recuentos de la vida",
  reencarnacion: "Reencarnación", romance: "Romance", samurai: "Samurái", sobrenatural: "Sobrenatural",
  superpoderes: "Superpoderes", supervivencia: "Supervivencia", telenovela: "Telenovela", thriller: "Thriller",
  tragedia: "Tragedia", vampiros: "Vampiros", "vida-escolar": "Vida Escolar",
}).map(([value, label]) => ({ value, label }));
