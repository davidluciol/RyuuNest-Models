/**
 * Luscious — módulo script de RyuuNest para `https://www.luscious.net`.
 * Todo sale de su API GraphQL pública por GET (`/graphql/nobatch/`); las imágenes viven en
 * `ah-img.luscious.net`. Cada álbum es una obra con un solo capítulo.
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
