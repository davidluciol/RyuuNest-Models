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
  const first = selector === "" ? scope : scope.select(selector)[0];
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
