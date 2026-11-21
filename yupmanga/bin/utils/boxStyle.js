/**
 * Cascada CSS mínima para el nodo oculto de la ficha que lee el reto del lector.
 *
 * El sitio genera un `<style>` y un `<div>` con hijos cuyo `order`, `flex-grow` y
 * `flex-shrink` solo se obtienen resolviendo la cascada como un navegador: selectores
 * de id/clase/etiqueta/atributo, `>` y descendiente, `:nth-child()`, `:not()`,
 * `!important`, especificidad, `style` en línea, atajo `flex`, escapes hexadecimales
 * y variables `var(--x)` heredadas. Todo es texto del sitio: solo se analiza, nunca
 * se ejecuta. Lo que no se entiende da `UNSUPPORTED` en vez de adivinar.
 */

import { fail } from "./errors.js";

function unsupported(message) {
  return fail("UNSUPPORTED", `El reto del lector usa HTML/CSS no soportado: ${message}`);
}

const DEFAULTS = { order: "0", "flex-grow": "0", "flex-shrink": "1" };
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr"]);

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, "");

/** Declaraciones `a:b;c:d!important` → [nombre, valor, important]. */
function parseDeclarations(text) {
  const list = [];
  for (const part of stripComments(text).split(";")) {
    const colon = part.indexOf(":");
    if (colon < 1) {
      continue;
    }
    const name = part.slice(0, colon).trim().toLowerCase();
    let value = part.slice(colon + 1).trim();
    const important = /!\s*important\s*$/iu.test(value);
    value = value.replace(/!\s*important\s*$/iu, "").trim();
    if (/^[\w-]+$/u.test(name) && value !== "") {
      list.push([name, value, important]);
    }
  }
  return list;
}

/* ---------- HTML del nodo oculto ---------- */

const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gu;
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gy;

function attributesOf(text) {
  const attrs = Object.create(null);
  for (const match of text.matchAll(ATTRIBUTE)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function elementOf(tag, attrText, parent) {
  const attrs = attributesOf(attrText);
  const element = {
    tag: tag.toLowerCase(),
    attrs,
    id: attrs.id,
    classes: (attrs.class ?? "").split(/\s+/u).filter(Boolean),
    parent,
    children: [],
    index: 1,
  };
  if (parent !== null) {
    parent.children.push(element);
    element.index = parent.children.length;
  }
  return element;
}

/** Árbol del elemento con ese `id` (hasta su cierre), o `null` si no existe. */
function parseBox(html, id) {
  const escaped = id.replace(/[^\w-]/gu, "");
  const start = new RegExp(String.raw`<([a-zA-Z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*?\bid=(["'])${escaped}\3(?:[^>"']|"[^"]*"|'[^']*')*)>`, "u").exec(html);
  if (start === null) {
    return null;
  }
  const root = elementOf(start[1], start[2], null);
  let current = root;
  TAG.lastIndex = start.index + start[0].length;
  for (let match = TAG.exec(html); match !== null; match = TAG.exec(html)) {
    const [whole, closing, name, rest] = match;
    if (closing === "/") {
      if (current === root) {
        return root;
      }
      current = current.parent;
    } else if (!VOID_TAGS.has(name.toLowerCase()) && !whole.endsWith("/>")) {
      current = elementOf(name, rest, current);
    } else {
      elementOf(name, rest, current);
    }
  }
  return root;
}

/* ---------- selectores ---------- */

function readIdent(text, from) {
  let index = from;
  let value = "";
  while (index < text.length) {
    if (text[index] === "\\") {
      const hex = /^[0-9a-fA-F]{1,6}\s?/u.exec(text.slice(index + 1));
      if (hex !== null) {
        value += String.fromCodePoint(parseInt(hex[0], 16));
        index += 1 + hex[0].length;
      } else {
        value += text[index + 1] ?? "";
        index += 2;
      }
    } else if (/[\w-]/u.test(text[index])) {
      value += text[index];
      index += 1;
    } else {
      break;
    }
  }
  return [value, index];
}

function untilClosing(text, from, open, close) {
  let depth = 1;
  let index = from;
  for (; index < text.length && depth > 0; index += 1) {
    if (text[index] === open) {
      depth += 1;
    } else if (text[index] === close) {
      depth -= 1;
    }
  }
  return [text.slice(from, index - 1), index];
}

function nthMatcher(argument) {
  const text = argument.trim().toLowerCase();
  if (text === "odd") {
    return (index) => index % 2 === 1;
  }
  if (text === "even") {
    return (index) => index % 2 === 0;
  }
  const formula = /^([+-]?\d*)n\s*(?:([+-])\s*(\d+))?$/u.exec(text);
  if (formula !== null) {
    const step = formula[1] === "" || formula[1] === "+" ? 1 : formula[1] === "-" ? -1 : Number(formula[1]);
    const offset = formula[2] === undefined ? 0 : Number(formula[3]) * (formula[2] === "-" ? -1 : 1);
    return (index) => (step === 0 ? index === offset : (index - offset) / step >= 0 && Number.isInteger((index - offset) / step));
  }
  if (/^\d+$/u.test(text)) {
    return (index) => index === Number(text);
  }
  throw unsupported(`:nth-child(${argument})`);
}

/** Compuesto (`div#a.b[c]:not(.d)`) desde `from`; devuelve [compuesto, índice final]. */
function parseCompound(text, from) {
  const compound = { tag: undefined, id: undefined, classes: [], attrs: [], pseudos: [] };
  let index = from;
  for (;;) {
    const char = text[index];
    if (char === "#") {
      [compound.id, index] = readIdent(text, index + 1);
    } else if (char === ".") {
      const [name, next] = readIdent(text, index + 1);
      compound.classes.push(name);
      index = next;
    } else if (char === "[") {
      const [body, next] = untilClosing(text, index + 1, "[", "]");
      const match = /^\s*([\w-]+)\s*(?:(~?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?\s*$/u.exec(body);
      if (match === null) {
        throw unsupported(`selector de atributo [${body}]`);
      }
      compound.attrs.push({ name: match[1].toLowerCase(), op: match[2], value: match[3] ?? match[4] ?? match[5] });
      index = next;
    } else if (char === ":") {
      const [name, afterName] = readIdent(text, index + 1);
      if (text[afterName] !== "(") {
        throw unsupported(`pseudoclase :${name}`);
      }
      const [argument, next] = untilClosing(text, afterName + 1, "(", ")");
      if (name === "nth-child") {
        compound.pseudos.push({ type: "nth", test: nthMatcher(argument) });
      } else if (name === "not") {
        compound.pseudos.push({ type: "not", inner: parseCompound(argument.trim(), 0)[0] });
      } else {
        throw unsupported(`pseudoclase :${name}()`);
      }
      index = next;
    } else if (char === "*") {
      index += 1;
    } else if (char !== undefined && /[A-Za-z]/u.test(char) && index === from) {
      [compound.tag, index] = readIdent(text, index);
      compound.tag = compound.tag.toLowerCase();
    } else {
      return [compound, index];
    }
  }
}

function parseSelector(text) {
  const parts = [];
  let index = 0;
  let combinator = " ";
  const skip = () => {
    const before = index;
    while (/\s/u.test(text[index] ?? "x")) {
      index += 1;
    }
    return index > before;
  };
  skip();
  while (index < text.length) {
    const [compound, next] = parseCompound(text, index);
    if (next === index) {
      throw unsupported(`selector «${text}»`);
    }
    parts.push({ combinator, compound });
    index = next;
    skip();
    if (text[index] === ">") {
      combinator = ">";
      index += 1;
      skip();
    } else if (text[index] === "+" || text[index] === "~") {
      throw unsupported(`combinador «${text[index]}»`);
    } else {
      combinator = " ";
    }
  }
  return parts;
}

function specificityOf(compound) {
  const own = [
    compound.id === undefined ? 0 : 1,
    compound.classes.length + compound.attrs.length + compound.pseudos.filter((p) => p.type === "nth").length,
    compound.tag === undefined ? 0 : 1,
  ];
  for (const pseudo of compound.pseudos) {
    if (pseudo.type === "not") {
      specificityOf(pseudo.inner).forEach((value, i) => {
        own[i] += value;
      });
    }
  }
  return own;
}

function attributeValue(element, name) {
  return element.attrs[name];
}

function matchesCompound(compound, element) {
  if (compound.tag !== undefined && compound.tag !== element.tag) {
    return false;
  }
  if (compound.id !== undefined && compound.id !== element.id) {
    return false;
  }
  if (!compound.classes.every((name) => element.classes.includes(name))) {
    return false;
  }
  for (const { name, op, value } of compound.attrs) {
    const actual = attributeValue(element, name);
    if (actual === undefined || (op === "=" && actual !== value) || (op === "~=" && !actual.split(/\s+/u).includes(value))) {
      return false;
    }
  }
  return compound.pseudos.every((pseudo) =>
    pseudo.type === "nth" ? pseudo.test(element.index) : !matchesCompound(pseudo.inner, element),
  );
}

function matchesFrom(parts, k, element) {
  if (!matchesCompound(parts[k].compound, element)) {
    return false;
  }
  if (k === 0) {
    return true;
  }
  if (parts[k].combinator === ">") {
    return element.parent !== null && matchesFrom(parts, k - 1, element.parent);
  }
  for (let ancestor = element.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (matchesFrom(parts, k - 1, ancestor)) {
      return true;
    }
  }
  return false;
}

/* ---------- hojas de estilo ---------- */

function parseRules(css) {
  const rules = [];
  const text = stripComments(css);
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{", index);
    if (open === -1) {
      break;
    }
    const close = text.indexOf("}", open);
    const selectorText = text.slice(index, open).trim();
    if (close === -1 || selectorText.startsWith("@")) {
      throw unsupported("regla @ o bloque sin cerrar");
    }
    const declarations = parseDeclarations(text.slice(open + 1, close));
    for (const selector of selectorText.split(",")) {
      const parts = parseSelector(selector.trim());
      rules.push({
        parts,
        specificity: parts.flatMap(({ compound }) => [specificityOf(compound)]).reduce(
          (sum, value) => sum.map((n, i) => n + value[i]),
          [0, 0, 0],
        ),
        declarations,
        order: rules.length,
      });
    }
    index = close + 1;
  }
  return rules;
}

/** Compara [importante, en línea, ids, clases, etiquetas, orden]: ¿`a` gana a `b`? */
function outranks(a, b) {
  const at = a.findIndex((part, i) => part !== b[i]);
  return at === -1 || a[at] > b[at];
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu;

/** Valor de `flex-grow`/`flex-shrink` dentro del atajo `flex`, o `undefined` si no es válido. */
function flexPart(value, property) {
  const tokens = value.trim().split(/\s+/u);
  const keywords = { none: ["0", "0"], auto: ["1", "1"], initial: ["0", "1"] };
  if (keywords[tokens[0]] !== undefined) {
    return keywords[tokens[0]][property === "flex-grow" ? 0 : 1];
  }
  if (!NUMBER.test(tokens[0])) {
    return undefined;
  }
  if (property === "flex-grow") {
    return tokens[0];
  }
  return tokens[1] !== undefined && NUMBER.test(tokens[1]) ? tokens[1] : "1";
}

/**
 * Nodo oculto con id `id` dentro de `html`: sus hijos directos y el estilo calculado
 * de cada uno. Devuelve `null` si la ficha no lo trae.
 */
export function createBox(source, id) {
  // Comentarios `<!--</div>-->` dentro del nodo: no son etiquetas.
  const html = source.replace(/<!--[\s\S]*?-->/gu, "");
  const root = parseBox(html, id);
  if (root === null) {
    return null;
  }
  const rules = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/giu)]
    .map((match) => match[1])
    .filter((css) => css.includes(id))
    .flatMap(parseRules);
  const matched = new Map();
  const rulesFor = (element) => {
    if (!matched.has(element)) {
      matched.set(element, rules.filter((rule) => matchesFrom(rule.parts, rule.parts.length - 1, element)));
    }
    return matched.get(element);
  };

  /** Declaraciones que afectan a `names` en `element`, con su rango de cascada. */
  const candidates = (element, accepts) => {
    const found = [];
    for (const rule of rulesFor(element)) {
      for (const [name, value, important] of rule.declarations) {
        if (accepts(name)) {
          found.push({ name, value, rank: [important ? 1 : 0, 0, ...rule.specificity, rule.order] });
        }
      }
    }
    for (const [name, value, important] of parseDeclarations(element.attrs.style ?? "")) {
      if (accepts(name)) {
        found.push({ name, value, rank: [important ? 1 : 0, 1, 0, 0, 0, Number.MAX_SAFE_INTEGER] });
      }
    }
    return found;
  };

  const customCache = new Map();
  const customProperties = (element) => {
    if (!customCache.has(element)) {
      const props = { ...(element.parent === null ? {} : customProperties(element.parent)) };
      const best = {};
      for (const found of candidates(element, (name) => name.startsWith("--"))) {
        if (best[found.name] === undefined || outranks(found.rank, best[found.name].rank)) {
          best[found.name] = found;
        }
      }
      for (const [name, found] of Object.entries(best)) {
        props[name] = found.value;
      }
      customCache.set(element, props);
    }
    return customCache.get(element);
  };

  /** Sustituye `var(--x, respaldo)`; `undefined` si queda alguna variable sin valor (declaración no válida). */
  const resolve = (value, element, depth = 0) => {
    const props = customProperties(element);
    let invalid = false;
    const text = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/gu, (_, name, fallback) => {
      const found = props[name] ?? fallback;
      if (found === undefined || depth > 8) {
        invalid = true;
        return "";
      }
      const inner = resolve(found, element, depth + 1);
      invalid ||= inner === undefined;
      return inner ?? "";
    });
    return invalid ? undefined : text;
  };

  const compute = (element, property) => {
    const longhand = property === "flex-grow" || property === "flex-shrink";
    let best;
    for (const found of candidates(element, (name) => name === property || (longhand && name === "flex"))) {
      const resolved = resolve(found.value, element);
      // Una variable sin valor no descarta la declaración: gana la cascada y vuelve al valor inicial.
      const text = resolved === undefined ? undefined : resolved.trim();
      const value = text === undefined ? DEFAULTS[property] : found.name === "flex" ? flexPart(text, property) : text;
      if (value === undefined || value === "") {
        continue;
      }
      if (best === undefined || outranks(found.rank, best.rank)) {
        best = { rank: found.rank, value };
      }
    }
    return best === undefined ? DEFAULTS[property] : best.value;
  };

  return { children: root.children, compute };
}
