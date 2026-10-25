/** Normalización de tipo, estado y fechas. */

import { DISPLAY_DATE } from "../config.js";

/** Solo los valores que el contrato admite como `kind`; el resto se omite. */
export function kindOf(text) {
  const kind = String(text ?? "").trim().toLowerCase();
  return kind === "manga" || kind === "manhwa" || kind === "manhua" || kind === "comic"
    ? kind
    : undefined;
}

/** `status` de la app a partir de la clase y el texto del sitio. */
export function statusOf(classAndText) {
  const value = String(classAndText ?? "").toLowerCase();
  if (/ended|complet|finaliz/u.test(value)) {
    return "completed";
  }
  if (/publishing|ongoing|public/u.test(value)) {
    return "ongoing";
  }
  if (/hiatus|pausa|paused/u.test(value)) {
    return "hiatus";
  }
  if (/cancel/u.test(value)) {
    return "cancelled";
  }
  return "unknown";
}

/** `27/05/2026` → `2026-05-27`; `undefined` si no es una fecha válida del sitio. */
export function isoDate(text) {
  const match = DISPLAY_DATE.exec(String(text ?? "").trim());
  if (match === null) {
    return undefined;
  }
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
