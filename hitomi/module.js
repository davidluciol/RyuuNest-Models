/**
 * Hitomi.la — módulo script de RyuuNest para `https://hitomi.la`.
 * El sitio es una SPA: las listas son archivos binarios `.nozomi` (IDs de 4 bytes) y cada
 * galería es un `galleries/<id>.js`. Todo va por `host.fetch` (`bytes()` para los binarios).
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
