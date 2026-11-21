/** Home dinámico, «ver más» y filtro de género (`/genero/<slug>`). */

import { ROUTES } from "./config.js";
import { latest, listPage, popular } from "./home.js";

/** Géneros de `/categorias`; `value` es el slug tal como lo usa el sitio en la URL. */
const GENRES = [
  ["shōnen", "Shōnen"], ["shōjo", "Shōjo"], ["seinen", "Seinen"], ["josei", "Josei"],
  ["acción", "Acción"], ["aventura", "Aventura"], ["comedia", "Comedia"], ["drama", "Drama"],
  ["fantasía", "Fantasía"], ["ciencia+ficción", "Ciencia ficción"], ["romance", "Romance"],
  ["terror", "Terror"], ["misterio", "Misterio"], ["isekai", "Isekai"], ["harem", "Harem"],
  ["yaoi+(boys'+love)", "Yaoi (Boys' Love)"], ["yuri+(girls'+love)", "Yuri (Girls' Love)"],
  ["slice+of+life", "Slice of life"], ["psicológico", "Psicológico"], ["ecchi", "Ecchi"], ["gore", "Gore"],
];

const SECTIONS = [
  { id: "popular", title: "Más leídas", load: popular },
  { id: "latest", title: "Últimas publicaciones", load: latest },
];

export function filters() {
  return [
    {
      id: "genre",
      label: "Género",
      type: "select",
      options: GENRES.map(([value, label]) => ({ value, label })),
    },
  ];
}

/** Página de un género; un valor fuera de la lista se ignora (va a la URL, no se interpola nada ajeno). */
export function genrePage(host, genre, page) {
  const known = GENRES.some(([value]) => value === genre);
  return known ? listPage(host, ROUTES.genre(genre, page)) : undefined;
}

export async function home(host) {
  const sections = [];
  for (const section of SECTIONS) {
    sections.push({ id: section.id, title: section.title, kind: "list", ...(await section.load(host, 1)) });
  }
  return { sections };
}

export async function list(host, sectionId, page) {
  const section = SECTIONS.find((candidate) => candidate.id === sectionId);
  return section === undefined ? { items: [], hasNext: false } : section.load(host, page);
}
