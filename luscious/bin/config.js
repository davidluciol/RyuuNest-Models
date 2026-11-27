/** Constantes de Luscious: dominios, cabeceras, consultas GraphQL y opciones del catálogo. */

export const BASE_URL = "https://www.luscious.net";
export const GRAPHQL_URL = `${BASE_URL}/graphql/nobatch/`;
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export const ACCEPT_LANGUAGE = "es-MX,es;q=0.9,en;q=0.8";

const ALBUM_FIELDS =
  "id title url created number_of_pictures is_manga cover { url } language { title } genres { id title } tags { text category }";

export const QUERIES = {
  AlbumList: `query AlbumList($input: AlbumListInput!) { album { list(input: $input) { info { page has_next_page } items { ${ALBUM_FIELDS} } } } }`,
  AlbumGet: `query AlbumGet($id: ID!) { album { get(id: $id) { ... on Album { ${ALBUM_FIELDS} description } ... on MutationError { errors { code message } } } } }`,
  AlbumListOwnPictures:
    "query AlbumListOwnPictures($input: PictureListInput!) { picture { list(input: $input) { info { has_next_page } items { id position url_to_original thumbnails { width url } } } } }",
};

/** El API anónimo da 50 imágenes por página y corta cada orden en 1000 (20 páginas); con los dos órdenes, 2000. */
export const PICTURE_PAGES_PER_ORDER = 20;
export const PICTURE_LIST_CAP = 1000;

export const DEFAULT_LANGUAGE = "3";
export const LANGUAGES = [
  { value: "3", label: "Español" },
  { value: "1", label: "Inglés" },
  { value: "2", label: "Japonés" },
  { value: "9", label: "Coreano" },
  { value: "8", label: "Chino" },
  { value: "100", label: "Portugués" },
  { value: "6", label: "Francés" },
  { value: "4", label: "Italiano" },
  { value: "5", label: "Alemán" },
  { value: "7", label: "Ruso" },
  { value: "103", label: "Sin texto" },
  { value: "all", label: "Todos" },
];

export const TYPES = [
  { value: "manga", label: "Manga" },
  { value: "pictures", label: "Imágenes" },
];

/** `value` es el `display` del API. */
export const ORDERS = [
  { value: "date_trending", label: "Tendencia" },
  { value: "date_newest", label: "Recientes" },
  { value: "rating_all_time", label: "Mejor valorados" },
  { value: "date_last_interaction", label: "Actividad reciente" },
];

/** Géneros que la home del sitio enlaza (`genre_ids`). */
export const GENRES = [
  ["1", "Sin género"], ["2", "Fetish"], ["6", "Tankōbon"], ["22", "Cosplay"], ["23", "SFW"],
  ["24", "Incest"], ["25", "3D"], ["30", "Cross-Dressing"], ["31", "Futanari"], ["32", "Ebony"],
  ["34", "Mind Control"], ["36", "Group Sex"], ["38", "Monsters & Tentacles"], ["39", "Kemonomimi"],
  ["43", "Public Sex"], ["47", "Sex Workers"], ["48", "Military"], ["50", "Workplace"],
  ["58", "Vintage"], ["59", "Defloration"], ["63", "AI Art"],
].map(([value, label]) => ({ value, label }));
