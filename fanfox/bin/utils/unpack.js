/**
 * Desempaquetador del formato `eval(function(p,a,c,k,e,d){…}('…',a,c,'…'.split('|')))`.
 * Solo sustituye tokens en base `a` por las palabras del diccionario: nunca ejecuta el JS del sitio.
 */

const PACKED = /\}\('((?:\\'|[^'])*)',\s*(\d+),\s*(\d+),\s*'((?:\\'|[^'])*)'\.split\('\|'\)/u;
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Codificación de índices del empaquetador: base 36 y, por encima, letras mayúsculas desde el 36. */
function encode(n, base) {
  const head = n < base ? "" : encode(Math.floor(n / base), base);
  const rest = n % base;
  return head + (rest > 35 ? String.fromCharCode(rest + 29) : DIGITS[rest]);
}

/** Texto desempaquetado del primer bloque empaquetado, o `undefined` si no hay ninguno. */
export function unpack(source) {
  const match = PACKED.exec(String(source ?? ""));
  if (!match) return undefined;
  const [, payload, base, count, keywords] = match;
  const words = keywords.split("|");
  const dictionary = new Map();
  for (let i = Number(count) - 1; i >= 0; i -= 1) {
    const token = encode(i, Number(base));
    dictionary.set(token, words[i] || token);
  }
  return payload.replace(/\\'/gu, "'").replace(/\b\w+\b/gu, (word) => dictionary.get(word) ?? word);
}
