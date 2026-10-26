/**
 * M440 — módulo script de RyuuNest para `https://m440.in`.
 * Solo usa `host.*`: los permisos de dominio, el tiempo límite y la concurrencia
 * los aplica el host. Cada llamada arma sus cabeceras y no hay estado compartido.
 */

import { popular, latest } from "./bin/home.js";
import { search } from "./bin/search.js";
import { details } from "./bin/details.js";
import { pages } from "./bin/pages.js";

/** Fábrica del módulo. El host aplica permisos y límites. */
export default function create(host) {
  return {
    popular: (page) => popular(host, page),
    latest: (page) => latest(host, page),
    search: (query, page) => search(host, query, page),
    details: (seriesId) => details(host, seriesId),
    pages: (chapterId, releaseId) => pages(host, chapterId, releaseId),
  };
}
