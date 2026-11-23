/**
 * Mangation — módulo script de RyuuNest para `https://mangation.com`.
 * Catálogo, búsqueda y capítulos por su API JSON pública (`api.mangation.com/api`); ficha, lector
 * y populares por los `__data.json` de SvelteKit. Imágenes en `media.mangation.com`.
 */

import { filters, home, latest, list, popular, search } from "./bin/catalog.js";
import { details } from "./bin/details.js";
import { pages } from "./bin/pages.js";

export default function create(host) {
  return {
    popular: (page) => popular(host, page),
    latest: (page) => latest(host, page),
    search: (query, page, activeFilters) => search(host, query, page, activeFilters),
    home: () => home(host),
    list: (sectionId, page) => list(host, sectionId, page),
    filters: () => filters(host),
    details: (seriesId) => details(host, seriesId),
    pages: (chapterId) => pages(host, chapterId),
  };
}
