/**
 * E-Hentai — módulo script de RyuuNest para `https://e-hentai.org`.
 * Listas por HTML (paginación por cursor `?next=`), ficha por la API JSON (`gdata`) y
 * lector por bloques de 20 imágenes (`/s/` + API `showpage`). Todo va por `host.fetch`.
 */

import { popular, latest, search, home, list, filters } from "./bin/catalog.js";
import { details } from "./bin/details.js";
import { pages } from "./bin/pages.js";

export default function create(host) {
  return {
    popular: (page) => popular(host, page),
    latest: (page) => latest(host, page),
    search: (query, page, activeFilters) => search(host, query, page, activeFilters),
    home: () => home(host),
    list: (sectionId, page) => list(host, sectionId, page),
    filters: async () => filters(),
    details: (seriesId) => details(host, seriesId),
    pages: (chapterId) => pages(host, chapterId),
  };
}
