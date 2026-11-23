/**
 * VisorManga — módulo script de RyuuNest para `https://visormanga.com` (Visor TMO Manga, 18+).
 * Todo es HTML estático sin reto: listas de `/biblioteca` y `/genero/…`, ficha `/manga/…`
 * y lector `/leer/…` con las imágenes en `data-src`.
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
