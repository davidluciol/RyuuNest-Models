/** Ayudantes de texto y de lectura de nodos. */

export function collapse(text) {
  return String(text ?? "")
    .split(/\s+/u)
    .filter(Boolean)
    .join(" ");
}

export function textOf(scope, selector) {
  const first = scope.select(selector)[0];
  return first === undefined ? "" : collapse(first.text());
}

export function attrOf(scope, selector, name) {
  const first = scope.select(selector)[0];
  const value = first === undefined ? undefined : first.attr(name);
  return value === undefined ? "" : String(value).trim();
}

/** Quita lo que no aporta: `undefined`, `""` y listas vacías. */
export function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) =>
        value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0),
    ),
  );
}

/** Textos de todos los nodos que casan con el selector, sin repetir. */
export function textList(scope, selector) {
  const seen = new Set();
  const values = [];
  for (const node of scope.select(selector)) {
    const text = collapse(node.text());
    if (text !== "" && !seen.has(text)) {
      seen.add(text);
      values.push(text);
    }
  }
  return values;
}

const ENTITIES = {
  amp: "&",
  apos: "'",
  copy: "©",
  eacute: "é",
  Eacute: "É",
  gt: ">",
  iacute: "í",
  iexcl: "¡",
  iquest: "¿",
  laquo: "«",
  lt: "<",
  nbsp: " ",
  ntilde: "ñ",
  oacute: "ó",
  quot: '"',
  raquo: "»",
  times: "×",
  uacute: "ú",
  aacute: "á",
};

/** Decodifica las entidades habituales del sitio (`&oacute;`, `&laquo;`…). */
export function decodeEntities(text) {
  return String(text ?? "").replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (whole, reference) => {
    if (reference.startsWith("#")) {
      const code = reference[1] === "x" || reference[1] === "X"
        ? Number.parseInt(reference.slice(2), 16)
        : Number.parseInt(reference.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[reference] ?? whole;
  });
}

/** Texto plano a partir de un fragmento HTML. */
export function stripTags(html) {
  return collapse(decodeEntities(String(html ?? "").replace(/<[^>]*>/gu, " ")));
}

/** Lista separada por comas (o por el separador indicado), sin vacíos ni repetidos. */
export function splitList(text, separator = ",") {
  const seen = new Set();
  const values = [];
  for (const part of String(text ?? "").split(separator)) {
    const value = collapse(part);
    if (value !== "" && !seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}
