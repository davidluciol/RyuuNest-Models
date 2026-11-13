/**
 * ZonaTMO — módulo script de RyuuNest para `https://zonatmo.org`, con respaldo en `https://zonatmo.to`.
 * Solo usa `host.*`: los permisos de dominio, el tiempo límite y la concurrencia
 * los aplica el host. Cada llamada arma sus cabeceras y no hay estado compartido.
 */

import { browse, filters, home, list } from "./bin/catalog.js";
import { search } from "./bin/search.js";
import { details } from "./bin/details.js";
import { isMirrorId, mirrorDetails, mirrorPages } from "./bin/mirror.js";
import { pages } from "./bin/pages.js";

/** Fábrica del módulo (SPEC §6.5). El host aplica permisos y límites. */
export default function create(host) {
  return {
    popular: (page) => browse(host, "", { sort: "likes_count" }, page),
    latest: (page) => browse(host, "", { sort: "creation" }, page),
    search: (query, page, activeFilters) => search(host, query, page, activeFilters),
    home: () => home(host),
    list: (sectionId, page) => list(host, sectionId, page),
    filters: async () => filters(),
    // Los ids del espejo (`/manga/…`) y los del sitio (`/library/…`) no son intercambiables.
    details: (seriesId) =>
      isMirrorId(seriesId) ? mirrorDetails(host, seriesId) : details(host, seriesId),
    pages: async (chapterId, releaseId) =>
      isMirrorId(releaseId) ? mirrorPages(host, releaseId) : pages(host, chapterId, releaseId),
  };
}
