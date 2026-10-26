/** Normalización de tipo, estado y fechas. */

/** Solo los valores que el contrato admite como `kind`; el resto se omite. */
export function kindOf(text) {
  const kind = String(text ?? "").trim().toLowerCase();
  return kind === "manga" || kind === "manhwa" || kind === "manhua" || kind === "comic"
    ? kind
    : undefined;
}

/** `status` de la app a partir del texto visible del sitio. */
export function statusOf(text) {
  const value = String(text ?? "").toLowerCase();
  if (/finaliz|ended|complet/u.test(value)) {
    return "completed";
  }
  if (/activo|emisi|public|ongoing|en curso/u.test(value)) {
    return "ongoing";
  }
  if (/pausa|hiatus|pausad/u.test(value)) {
    return "hiatus";
  }
  if (/abandon|cancel/u.test(value)) {
    return "cancelled";
  }
  return "unknown";
}
