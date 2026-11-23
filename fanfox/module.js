/**
 * FanFox — módulo script de RyuuNest para `https://fanfox.net` (antes MangaFox, en inglés).
 * Listas por el HTML del directorio y del buscador, ficha por HTML y lector por la vista
 * móvil `roll_manga` (todas las imágenes en una petición), con respaldo de `chapterfun.ashx`.
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
