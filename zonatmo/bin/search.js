/** Buscador de la biblioteca: título y filtros opcionales (tipo, demografía, estado, género, orden). */

import { browse } from "./catalog.js";

export function search(host, query, page, filters) {
  const text = String(query ?? "").trim();
  const active = Object.values(filters ?? {}).some((value) => value !== undefined && value !== "");
  if (text === "" && !active) {
    return Promise.resolve({ items: [], hasNext: false });
  }
  return browse(host, text, filters, page);
}
