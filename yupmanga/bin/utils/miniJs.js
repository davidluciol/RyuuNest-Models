/**
 * Intérprete mínimo y cerrado de un subconjunto de JS (ES5, solo cálculo).
 *
 * Sirve para resolver el reto del lector sin `eval`/`new Function`: el código lo
 * escribe el sitio y la app no aísla los módulos, así que nada se ejecuta de forma
 * nativa. Lo único alcanzable desde el script son los globales que se le pasan,
 * `Math`, `String`, `Number`, `parseInt`/`parseFloat` y un puñado de métodos de
 * cadenas y arreglos. Cualquier sintaxis o miembro desconocido da `UNSUPPORTED`.
 */

import { fail } from "./errors.js";

const PUNCT = [
  "...", "**", "=>", ">>>=", "===", "!==", "<<=", ">>=", ">>>", "&&", "||", "==", "!=", "<=", ">=", "<<", ">>",
  "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
  "+", "-", "*", "/", "%", "&", "|", "^", "~", "!", "<", ">", "=", "?", ":", ",", ";", ".",
  "(", ")", "[", "]", "{", "}",
];
const NUMBER = /0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const IDENT = /[A-Za-z_$][\w$]*/y;
const ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };

function unsupported(message) {
  return fail("UNSUPPORTED", `El reto del lector usa JS no soportado: ${message}`);
}

/** Secuencia de escape: `index` apunta al carácter tras `\`; devuelve el valor y el último índice leído. */
function readEscape(source, index) {
  const current = source[index];
  if (current === "x" || current === "u") {
    const size = current === "x" ? 2 : 4;
    return [String.fromCharCode(parseInt(source.slice(index + 1, index + 1 + size), 16)), index + size];
  }
  return [ESCAPES[current] ?? current, index];
}

/** Plantilla con acento grave: trozos de texto y el código de cada `${…}` (se analiza aparte). */
function readTemplate(source, start) {
  const quasis = [];
  const exprs = [];
  let text = "";
  let index = start + 1;
  while (index < source.length && source[index] !== "`") {
    if (source[index] === "\\") {
      const [value, last] = readEscape(source, index + 1);
      text += value;
      index = last + 1;
    } else if (source[index] === "$" && source[index + 1] === "{") {
      quasis.push(text);
      text = "";
      let depth = 1;
      let quote = "";
      const from = index + 2;
      index = from;
      for (; index < source.length && depth > 0; index += 1) {
        const char = source[index];
        if (quote !== "") {
          quote = char === "\\" ? (index += 1, quote) : char === quote ? "" : quote;
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === "{") {
          depth += 1;
        } else if (char === "}") {
          depth -= 1;
        }
      }
      exprs.push(source.slice(from, index - 1));
    } else {
      text += source[index];
      index += 1;
    }
  }
  quasis.push(text);
  return { token: { type: "tpl", quasis, exprs }, end: index + 1 };
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }
    NUMBER.lastIndex = index;
    IDENT.lastIndex = index;
    let match;
    if (/\d/u.test(char) && (match = NUMBER.exec(source)) !== null) {
      tokens.push({ type: "num", value: Number(match[0]) });
      index += match[0].length;
    } else if ((match = IDENT.exec(source)) !== null && match.index === index) {
      tokens.push({ type: "id", value: match[0] });
      index += match[0].length;
    } else if (char === '"' || char === "'") {
      let value = "";
      index += 1;
      while (index < source.length && source[index] !== char) {
        let current = source[index];
        if (current === "\\") {
          index += 1;
          current = source[index];
          [current, index] = readEscape(source, index);
        }
        value += current;
        index += 1;
      }
      tokens.push({ type: "str", value });
      index += 1;
    } else if (char === "`") {
      const { token, end } = readTemplate(source, index);
      tokens.push(token);
      index = end;
    } else {
      const punct = PUNCT.find((candidate) => source.startsWith(candidate, index));
      if (punct === undefined) {
        throw unsupported(`carácter «${char}»`);
      }
      tokens.push({ type: "p", value: punct });
      index += punct.length;
    }
  }
  return tokens;
}

const BINARY_PRECEDENCE = {
  "||": 1, "&&": 2, "|": 3, "^": 4, "&": 5,
  "==": 6, "!=": 6, "===": 6, "!==": 6,
  "<": 7, ">": 7, "<=": 7, ">=": 7,
  "<<": 8, ">>": 8, ">>>": 8,
  "+": 9, "-": 9, "*": 10, "/": 10, "%": 10, "**": 11,
};
const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=", ">>>="]);
const LITERALS = { true: true, false: false, null: null };

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  peek() {
    return this.tokens[this.position];
  }

  next() {
    const token = this.tokens[this.position];
    this.position += 1;
    if (token === undefined) {
      throw unsupported("fin de código inesperado");
    }
    return token;
  }

  isPunct(value) {
    const token = this.peek();
    return token !== undefined && token.type === "p" && token.value === value;
  }

  isWord(value) {
    const token = this.peek();
    return token !== undefined && token.type === "id" && token.value === value;
  }

  eat(value) {
    if (this.isPunct(value)) {
      this.position += 1;
      return true;
    }
    return false;
  }

  expect(value) {
    if (!this.eat(value)) {
      throw unsupported(`se esperaba «${value}»`);
    }
  }

  program() {
    const body = [];
    while (this.peek() !== undefined) {
      body.push(this.statement());
    }
    return body;
  }

  block() {
    this.expect("{");
    const body = [];
    while (!this.eat("}")) {
      body.push(this.statement());
    }
    return body;
  }

  /** Nombre o patrón de desestructuración: `a`, `[a, b]`, `{k: a, [0]: b}`; `inner` admite `= valor`. */
  binding(inner = false) {
    let target;
    if (this.eat("[")) {
      const items = [];
      while (!this.eat("]")) {
        items.push(this.isPunct(",") ? null : this.binding(true));
        this.eat(",");
      }
      target = ["arrp", items];
    } else if (this.eat("{")) {
      const entries = [];
      while (!this.eat("}")) {
        let key;
        if (this.eat("[")) {
          key = ["computed", this.assign()];
          this.expect("]");
        } else {
          key = String(this.next().value);
        }
        if (this.eat(":")) {
          entries.push([key, this.binding(true)]);
        } else {
          entries.push([key, this.eat("=") ? ["dflt", key, this.assign()] : key]);
        }
        this.eat(",");
      }
      target = ["objp", entries];
    } else {
      target = this.next().value;
    }
    return inner && this.eat("=") ? ["dflt", target, this.assign()] : target;
  }

  /** Parámetros tras un `(` ya leído: nombres o patrones, con valor por defecto o `...resto`. */
  params() {
    const list = [];
    while (!this.eat(")")) {
      if (this.eat("...")) {
        list.push({ target: this.binding(), rest: true });
      } else {
        const target = this.binding();
        list.push({ target, def: this.eat("=") ? this.assign() : undefined });
      }
      this.eat(",");
    }
    return list;
  }

  declarations(first) {
    const list = [];
    let target = first;
    do {
      target ??= this.binding();
      list.push([target, this.eat("=") ? this.assign() : undefined]);
      target = undefined;
    } while (this.eat(","));
    return ["var", list];
  }

  isDeclaration() {
    return this.isWord("var") || this.isWord("let") || this.isWord("const");
  }

  statement() {
    const token = this.peek();
    if (token.type === "p") {
      if (token.value === "{") {
        return ["block", this.block()];
      }
      if (this.eat(";")) {
        return ["block", []];
      }
    }
    if (token.type === "id") {
      switch (token.value) {
        case "var":
        case "let":
        case "const": {
          this.next();
          const node = this.declarations();
          this.eat(";");
          return node;
        }
        case "if": {
          this.next();
          this.expect("(");
          const test = this.expression();
          this.expect(")");
          const yes = this.statement();
          const no = this.isWord("else") && this.next() ? this.statement() : undefined;
          return ["if", test, yes, no];
        }
        case "for": {
          this.next();
          this.expect("(");
          let init;
          if (this.isDeclaration()) {
            this.next();
            const target = this.binding();
            if (this.isWord("of")) {
              this.next();
              const iterable = this.expression();
              this.expect(")");
              return ["forof", target, iterable, this.statement()];
            }
            init = this.declarations(target);
          } else if (!this.isPunct(";")) {
            init = ["expr", this.expression()];
          }
          this.expect(";");
          const test = this.isPunct(";") ? undefined : this.expression();
          this.expect(";");
          const update = this.isPunct(")") ? undefined : this.expression();
          this.expect(")");
          return ["for", init, test, update, this.statement()];
        }
        case "while": {
          this.next();
          this.expect("(");
          const test = this.expression();
          this.expect(")");
          return ["for", undefined, test, undefined, this.statement()];
        }
        case "switch":
          return this.switchStatement();
        case "do": {
          this.next();
          const body = this.statement();
          if (!this.isWord("while")) {
            throw unsupported("do sin while");
          }
          this.next();
          this.expect("(");
          const test = this.expression();
          this.expect(")");
          this.eat(";");
          return ["dowhile", body, test];
        }
        case "try": {
          this.next();
          const body = this.block();
          let param;
          let handler;
          let cleanup;
          if (this.isWord("catch")) {
            this.next();
            if (this.eat("(")) {
              param = this.binding();
              this.expect(")");
            }
            handler = this.block();
          }
          if (this.isWord("finally")) {
            this.next();
            cleanup = this.block();
          }
          return ["try", body, param, handler, cleanup];
        }
        case "class": {
          this.next();
          const name = this.next().value;
          this.expect("{");
          const methods = [];
          while (!this.eat("}")) {
            if (this.eat(";")) {
              continue;
            }
            const method = String(this.next().value);
            this.expect("(");
            methods.push([method, ["fn", this.params(), this.block(), {}]]);
          }
          return ["var", [[name, ["class", methods]]]];
        }
        case "break":
        case "continue":
          this.next();
          this.eat(";");
          return [token.value];
        case "return": {
          this.next();
          const value = this.isPunct(";") || this.isPunct("}") ? undefined : this.expression();
          this.eat(";");
          return ["return", value];
        }
        case "function": {
          this.next();
          const generator = this.eat("*");
          const name = this.next().value;
          return ["var", [[name, this.functionRest({ generator })]]];
        }
        default:
      }
    }
    const node = ["expr", this.expression()];
    this.eat(";");
    return node;
  }

  switchStatement() {
    this.next();
    this.expect("(");
    const subject = this.expression();
    this.expect(")");
    this.expect("{");
    const cases = [];
    while (!this.eat("}")) {
      const label = this.next().value;
      let test;
      if (label === "case") {
        test = this.expression();
      } else if (label !== "default") {
        throw unsupported("switch mal formado");
      }
      this.expect(":");
      const body = [];
      while (!this.isWord("case") && !this.isWord("default") && !this.isPunct("}")) {
        body.push(this.statement());
      }
      cases.push([test, body]);
    }
    return ["switch", subject, cases];
  }

  functionRest(flags = {}) {
    this.expect("(");
    return ["fn", this.params(), this.block(), flags];
  }

  expression() {
    let node = this.assign();
    while (this.eat(",")) {
      node = ["seq", node, this.assign()];
    }
    return node;
  }

  assign() {
    if (this.isWord("yield")) {
      this.next();
      const closing = this.isPunct(";") || this.isPunct(")") || this.isPunct("}") || this.isPunct("]");
      return ["yield", closing ? undefined : this.assign()];
    }
    const left = this.conditional();
    const token = this.peek();
    if (token !== undefined && token.type === "p" && ASSIGN_OPS.has(token.value)) {
      this.next();
      if (left[0] === "arr" && token.value === "=" && left[1].every((item) => item[0] === "id")) {
        return ["asg", "=", ["arrp", left[1].map((item) => item[1])], this.assign()];
      }
      if (left[0] !== "id" && left[0] !== "mem") {
        throw unsupported("asignación a algo que no es una variable");
      }
      return ["asg", token.value, left, this.assign()];
    }
    return left;
  }

  conditional() {
    const test = this.binary(0);
    if (!this.eat("?")) {
      return test;
    }
    const yes = this.assign();
    this.expect(":");
    return ["cond", test, yes, this.assign()];
  }

  binary(minimum) {
    let left = this.unary();
    for (;;) {
      const token = this.peek();
      const precedence =
        token !== undefined && token.type === "p" ? BINARY_PRECEDENCE[token.value] : undefined;
      if (precedence === undefined || precedence <= minimum) {
        return left;
      }
      this.next();
      left = ["bin", token.value, left, this.binary(precedence)];
    }
  }

  unary() {
    const token = this.peek();
    if (token.type === "p" && ["!", "-", "+", "~"].includes(token.value)) {
      this.next();
      return ["un", token.value, this.unary()];
    }
    if (token.type === "id" && token.value === "typeof") {
      this.next();
      return ["un", "typeof", this.unary()];
    }
    if (token.type === "p" && (token.value === "++" || token.value === "--")) {
      this.next();
      return ["upd", token.value, true, this.unary()];
    }
    const node = this.member();
    const after = this.peek();
    if (after !== undefined && after.type === "p" && (after.value === "++" || after.value === "--")) {
      this.next();
      return ["upd", after.value, false, node];
    }
    return node;
  }

  member() {
    let node = this.primary();
    for (;;) {
      if (this.eat(".")) {
        node = ["mem", node, ["lit", this.next().value]];
      } else if (this.eat("[")) {
        node = ["mem", node, this.expression()];
        this.expect("]");
      } else if (this.eat("(")) {
        const args = [];
        while (!this.eat(")")) {
          args.push(this.eat("...") ? ["spread", this.assign()] : this.assign());
          this.eat(",");
        }
        node = ["call", node, args];
      } else {
        return node;
      }
    }
  }

  /** Tras un `(` ya leído: ¿el paréntesis que lo cierra va seguido de `=>`? */
  arrowAhead() {
    let depth = 1;
    let index = this.position;
    for (; index < this.tokens.length && depth > 0; index += 1) {
      const token = this.tokens[index];
      if (token.type === "p" && "([{".includes(token.value)) {
        depth += 1;
      } else if (token.type === "p" && ")]}".includes(token.value)) {
        depth -= 1;
      }
    }
    const after = this.tokens[index];
    return after !== undefined && after.type === "p" && after.value === "=>";
  }

  arrowRest(params) {
    this.expect("=>");
    return ["fn", params, this.isPunct("{") ? this.block() : [["return", this.assign()]], { arrow: true }];
  }

  primary() {
    const token = this.next();
    if (token.type === "num" || token.type === "str") {
      return ["lit", token.value];
    }
    if (token.type === "tpl") {
      return ["tpl", token.quasis, token.exprs.map((code) => new Parser(tokenize(code)).expression())];
    }
    if (token.type === "id" && this.isPunct("=>")) {
      return this.arrowRest([{ target: token.value }]);
    }
    if (token.type === "id") {
      if (token.value === "function") {
        const generator = this.eat("*");
        if (this.peek().type === "id") {
          this.next();
        }
        return this.functionRest({ generator });
      }
      if (token.value === "new") {
        let callee = this.primary();
        for (;;) {
          if (this.eat(".")) {
            callee = ["mem", callee, ["lit", this.next().value]];
          } else if (this.eat("[")) {
            callee = ["mem", callee, this.expression()];
            this.expect("]");
          } else {
            break;
          }
        }
        const args = [];
        if (this.eat("(")) {
          while (!this.eat(")")) {
            args.push(this.eat("...") ? ["spread", this.assign()] : this.assign());
            this.eat(",");
          }
        }
        return ["new", callee, args];
      }
      return token.value in LITERALS ? ["lit", LITERALS[token.value]] : ["id", token.value];
    }
    if (token.value === "(" && this.arrowAhead()) {
      return this.arrowRest(this.params());
    }
    if (token.value === "(") {
      const node = this.expression();
      this.expect(")");
      return node;
    }
    if (token.value === "[") {
      const items = [];
      while (!this.eat("]")) {
        items.push(this.eat("...") ? ["spread", this.assign()] : this.assign());
        this.eat(",");
      }
      return ["arr", items];
    }
    if (token.value === "{") {
      const entries = [];
      while (!this.eat("}")) {
        let key;
        if (this.eat("[")) {
          key = ["computed", this.assign()];
          this.expect("]");
        } else {
          key = String(this.next().value);
        }
        if (this.eat("(")) {
          entries.push([key, ["fn", this.params(), this.block(), {}]]);
        } else {
          entries.push([key, this.eat(":") ? this.assign() : ["id", key]]);
        }
        this.eat(",");
      }
      return ["obj", entries];
    }
    throw unsupported(`símbolo «${token.value}»`);
  }
}

const BINARY = {
  "+": (a, b) => a + b, "-": (a, b) => a - b, "*": (a, b) => a * b, "/": (a, b) => a / b,
  "%": (a, b) => a % b, "&": (a, b) => a & b, "|": (a, b) => a | b, "^": (a, b) => a ^ b,
  "<<": (a, b) => a << b, ">>": (a, b) => a >> b, ">>>": (a, b) => a >>> b,
  "**": (a, b) => a ** b,
  "<": (a, b) => a < b, ">": (a, b) => a > b, "<=": (a, b) => a <= b, ">=": (a, b) => a >= b,
  "==": (a, b) => a == b, "!=": (a, b) => a != b, "===": (a, b) => a === b, "!==": (a, b) => a !== b,
};

const STRING_METHODS = {
  charCodeAt: (s, i) => s.charCodeAt(i),
  charAt: (s, i) => s.charAt(i),
  split: (s, separator) => s.split(separator),
  toString: (s) => s,
  slice: (s, from, to) => s.slice(from, to),
  indexOf: (s, part) => s.indexOf(part),
  codePointAt: (s, i) => s.codePointAt(i),
  substring: (s, from, to) => s.substring(from, to),
  padStart: (s, n, fill) => s.padStart(n, fill),
  padEnd: (s, n, fill) => s.padEnd(n, fill),
  concat: (s, ...parts) => s.concat(...parts),
  toUpperCase: (s) => s.toUpperCase(),
  toLowerCase: (s) => s.toLowerCase(),
};
const ARRAY_METHODS = {
  push: (a, ...items) => a.push(...items),
  forEach: (a, callback) => a.forEach((item, index) => callback(item, index)),
  map: (a, callback) => a.map((item, index) => callback(item, index)),
  reduce: (a, callback, ...initial) =>
    a.reduce((total, item, index) => callback(total, item, index), ...initial),
  sort: (a, compare) => (compare === undefined ? a.sort() : a.sort(compare)),
  join: (a, separator) => a.join(separator),
  slice: (a, from, to) => a.slice(from, to),
  indexOf: (a, item) => a.indexOf(item),
  reverse: (a) => a.reverse(),
  concat: (a, ...items) => a.concat(...items),
  filter: (a, callback) => a.filter((item, index) => callback(item, index)),
  some: (a, callback) => a.some((item, index) => callback(item, index)),
  every: (a, callback) => a.every((item, index) => callback(item, index)),
  includes: (a, item) => a.includes(item),
  at: (a, index) => a.at(index),
  fill: (a, value) => a.fill(value),
  flat: (a) => a.flat(),
  entries: (a) => a.map((item, index) => [index, item]),
};
const NUMBER_METHODS = { toString: (n, radix) => n.toString(radix) };

/** Marcas internas (símbolos): una clase del reto y la clase de una instancia suya. */
const CLASS = Symbol("class");
const INSTANCE = Symbol("instance");
/** Función del reto: `fn[USERFN](esto, args)` la invoca con `this`. */
const USERFN = Symbol("userfn");

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function withMethods(value, key, methods) {
  return hasOwn(methods, key) ? (...args) => methods[key](value, ...args) : undefined;
}

function read(object, key) {
  if (typeof object === "string" || Array.isArray(object)) {
    if (key === "length" || typeof key === "number") {
      return object[key];
    }
    const methods = typeof object === "string" ? STRING_METHODS : ARRAY_METHODS;
    return withMethods(object, key, methods);
  }
  if (typeof object === "number") {
    return withMethods(object, key, NUMBER_METHODS);
  }
  if (typeof object === "object" && object !== null) {
    if (hasOwn(object, key)) {
      return object[key];
    }
    const record = object[INSTANCE];
    return record !== undefined && hasOwn(record.methods, key) ? record.methods[key] : undefined;
  }
  if (typeof object === "function") {
    return hasOwn(object, key) ? object[key] : undefined;
  }
  throw unsupported(`lectura de «${String(key)}» en ${String(object)}`);
}

const BREAK = Symbol("break");
const CONTINUE = Symbol("continue");

function stringFunction() {
  const callable = (value) => String(value);
  callable.fromCharCode = (...codes) => String.fromCharCode(...codes);
  return callable;
}

function baseGlobals() {
  return {
    Math: {
      imul: Math.imul, round: Math.round, floor: Math.floor, ceil: Math.ceil, abs: Math.abs,
      min: Math.min, max: Math.max, pow: Math.pow, trunc: Math.trunc, sign: Math.sign, PI: Math.PI,
    },
    JSON: { parse: (text) => JSON.parse(text), stringify: (value) => JSON.stringify(value) },
    Array: {
      isArray: (value) => Array.isArray(value),
      of: (...items) => items,
      from: (value, map) => {
        const items = typeof value === "string" || Array.isArray(value) ? [...value] : [];
        return map === undefined ? items : items.map((item, index) => map(item, index));
      },
    },
    String: stringFunction(),
    Number: (value) => Number(value),
    parseInt: (value, radix) => parseInt(value, radix),
    parseFloat: (value) => parseFloat(value),
    isNaN: (value) => Number.isNaN(Number(value)),
    NaN,
    Infinity,
    undefined,
  };
}

/**
 * Ejecuta `source` como cuerpo de función y devuelve su `return`. `globals` añade
 * los objetos que el script puede ver (por ejemplo un `document` simulado).
 */
export function runScript(source, globals = {}, maxSteps = 3_000_000) {
  let program;
  try {
    program = new Parser(tokenize(source)).program();
  } catch (error) {
    throw error?.name === "ModuleError" ? error : unsupported("código mal formado");
  }
  const top = Object.assign(Object.create(null), baseGlobals(), globals);
  let steps = 0;

  const lookup = (env, name) => {
    for (let scope = env; scope !== null; scope = scope.parent) {
      if (name in scope.vars) {
        return scope;
      }
    }
    return null;
  };

  function call(fn, args, thisArg) {
    if (typeof fn !== "function") {
      throw unsupported("llamada a algo que no es una función");
    }
    return fn[USERFN] === undefined ? fn(...args) : fn[USERFN](thisArg, args);
  }

  /** Argumentos o elementos de arreglo, expandiendo `...x` (solo cadenas y arreglos). */
  function evaluateList(nodes, env) {
    return nodes.flatMap((item) => {
      if (item[0] !== "spread") {
        return [evaluate(item, env)];
      }
      const value = evaluate(item[1], env);
      if (typeof value !== "string" && !Array.isArray(value)) {
        throw unsupported("spread sobre algo que no es cadena o arreglo");
      }
      return [...value];
    });
  }

  function evaluate(node, env) {
    steps += 1;
    if (steps > maxSteps) {
      throw fail("UNSUPPORTED", "El reto del lector excede el límite de cálculo");
    }
    switch (node[0]) {
      case "lit":
        return node[1];
      case "id": {
        const scope = lookup(env, node[1]);
        if (scope === null) {
          throw unsupported(`variable «${node[1]}» sin definir`);
        }
        return scope.vars[node[1]];
      }
      case "arr":
        return evaluateList(node[1], env);
      case "obj": {
        const object = Object.create(null);
        for (const [key, value] of node[1]) {
          object[typeof key === "string" ? key : evaluate(key[1], env)] = evaluate(value, env);
        }
        return object;
      }
      case "class": {
        const record = { [CLASS]: true, methods: Object.create(null) };
        for (const [name, method] of node[1]) {
          record.methods[name] = makeFunction(method, env);
        }
        return record;
      }
      case "new": {
        const record = evaluate(node[1], env);
        const args = evaluateList(node[2], env);
        if (record === null || typeof record !== "object" || record[CLASS] !== true) {
          throw unsupported("new sobre algo que no es una clase del reto");
        }
        const instance = Object.create(null);
        instance[INSTANCE] = record;
        if (record.methods.constructor !== undefined) {
          record.methods.constructor[USERFN](instance, args);
        }
        return instance;
      }
      case "yield": {
        let scope = env;
        while (scope !== null && scope.gen === undefined) {
          scope = scope.parent;
        }
        if (scope === null) {
          throw unsupported("yield fuera de un generador");
        }
        scope.gen.push(node[1] === undefined ? undefined : evaluate(node[1], env));
        return undefined;
      }
      case "tpl":
        return node[1].map((part, i) => (i === 0 ? part : String(evaluate(node[2][i - 1], env)) + part)).join("");
      case "fn":
        return makeFunction(node, env);
      case "seq":
        evaluate(node[1], env);
        return evaluate(node[2], env);
      case "cond":
        return evaluate(node[1], env) ? evaluate(node[2], env) : evaluate(node[3], env);
      case "mem":
        return read(evaluate(node[1], env), evaluate(node[2], env));
      case "call": {
        const callee = node[1];
        if (callee[0] === "mem") {
          const target = evaluate(callee[1], env);
          return call(read(target, evaluate(callee[2], env)), evaluateList(node[2], env), target);
        }
        return call(evaluate(callee, env), evaluateList(node[2], env), undefined);
      }
      case "un":
        return unary(node, env);
      case "bin": {
        if (node[1] === "&&") {
          return evaluate(node[2], env) && evaluate(node[3], env);
        }
        if (node[1] === "||") {
          return evaluate(node[2], env) || evaluate(node[3], env);
        }
        return BINARY[node[1]](evaluate(node[2], env), evaluate(node[3], env));
      }
      case "asg": {
        const value =
          node[1] === "="
            ? evaluate(node[3], env)
            : BINARY[node[1].slice(0, -1)](evaluate(node[2], env), evaluate(node[3], env));
        return store(node[2], value, env);
      }
      case "upd": {
        const before = Number(evaluate(node[3], env));
        const after = node[1] === "++" ? before + 1 : before - 1;
        store(node[3], after, env);
        return node[2] ? after : before;
      }
      default:
        throw unsupported(`expresión «${node[0]}»`);
    }
  }

  function unary(node, env) {
    if (node[1] === "typeof") {
      if (node[2][0] === "id" && lookup(env, node[2][1]) === null) {
        return "undefined";
      }
      return typeof evaluate(node[2], env);
    }
    const value = evaluate(node[2], env);
    switch (node[1]) {
      case "!":
        return !value;
      case "-":
        return -value;
      case "+":
        return +value;
      default:
        return ~value;
    }
  }

  /** Declara una variable o un patrón de desestructuración en el ámbito actual. */
  function declare(target, value, env) {
    if (target === null) {
      return;
    }
    if (typeof target === "string") {
      env.vars[target] = value;
    } else if (target[0] === "dflt") {
      declare(target[1], value === undefined ? evaluate(target[2], env) : value, env);
    } else if (target[0] === "arrp") {
      const items = typeof value === "string" || Array.isArray(value) ? [...value] : [];
      target[1].forEach((item, index) => declare(item, items[index], env));
    } else {
      target[1].forEach(([key, item]) =>
        declare(item, read(value, typeof key === "string" ? key : evaluate(key[1], env)), env),
      );
    }
  }

  function store(target, value, env) {
    if (target[0] === "arrp") {
      target[1].forEach((name, index) => store(["id", name], value[index], env));
      return value;
    }
    if (target[0] === "id") {
      (lookup(env, target[1]) ?? { vars: top }).vars[target[1]] = value;
      return value;
    }
    const object = evaluate(target[1], env);
    const key = evaluate(target[2], env);
    const isArrayIndex = Array.isArray(object) && typeof key === "number";
    const isObject = object !== null && typeof object === "object" && !Array.isArray(object);
    if (!isArrayIndex && !isObject) {
      throw unsupported("asignación a un miembro que no es un índice de arreglo ni un objeto");
    }
    object[key] = value;
    return value;
  }

  /** Función del reto. Un generador se evalúa de golpe: devuelve el arreglo de lo que cede. */
  function makeFunction(node, env) {
    const [, params, body, flags] = node;
    const invoke = (thisArg, args) => {
      const scope = { vars: Object.create(null), parent: env };
      if (!flags.arrow) {
        scope.vars.this = thisArg;
      }
      if (flags.generator) {
        scope.gen = [];
      }
      params.forEach(({ target, def, rest }, index) => {
        let value = rest ? args.slice(index) : args[index];
        if (value === undefined && def !== undefined) {
          value = evaluate(def, scope);
        }
        declare(target, value, scope);
      });
      try {
        runBlock(body, scope);
      } catch (signal) {
        if (signal === null || typeof signal !== "object" || !("returned" in signal)) {
          throw signal;
        }
        return flags.generator ? scope.gen : signal.returned;
      }
      return flags.generator ? scope.gen : undefined;
    };
    const fn = (...args) => invoke(undefined, args);
    fn[USERFN] = invoke;
    return fn;
  }

  function runBlock(statements, env) {
    for (const statement of statements) {
      const signal = execute(statement, env);
      if (signal !== undefined) {
        return signal;
      }
    }
    return undefined;
  }

  function execute(node, env) {
    steps += 1;
    switch (node[0]) {
      case "expr":
        evaluate(node[1], env);
        return undefined;
      case "var":
        for (const [target, init] of node[1]) {
          declare(target, init === undefined ? undefined : evaluate(init, env), env);
        }
        return undefined;
      case "forof": {
        const iterable = evaluate(node[2], env);
        if (typeof iterable !== "string" && !Array.isArray(iterable)) {
          throw unsupported("for…of sobre algo que no es cadena o arreglo");
        }
        for (const item of [...iterable]) {
          declare(node[1], item, env);
          const signal = execute(node[3], env);
          if (signal === BREAK) {
            break;
          }
          if (signal !== undefined && signal !== CONTINUE) {
            return signal;
          }
          steps += 1;
          if (steps > maxSteps) {
            throw fail("UNSUPPORTED", "El reto del lector excede el límite de cálculo");
          }
        }
        return undefined;
      }
      case "block":
        return runBlock(node[1], env);
      case "if":
        if (evaluate(node[1], env)) {
          return execute(node[2], env);
        }
        return node[3] === undefined ? undefined : execute(node[3], env);
      case "for": {
        if (node[1] !== undefined) {
          execute(node[1], env);
        }
        while (node[2] === undefined || evaluate(node[2], env)) {
          const signal = execute(node[4], env);
          if (signal === BREAK) {
            break;
          }
          if (signal !== undefined && signal !== CONTINUE) {
            return signal;
          }
          if (node[3] !== undefined) {
            evaluate(node[3], env);
          }
          steps += 1;
          if (steps > maxSteps) {
            throw fail("UNSUPPORTED", "El reto del lector excede el límite de cálculo");
          }
        }
        return undefined;
      }
      case "dowhile": {
        do {
          const signal = execute(node[1], env);
          if (signal === BREAK) {
            break;
          }
          if (signal !== undefined && signal !== CONTINUE) {
            return signal;
          }
          steps += 1;
          if (steps > maxSteps) {
            throw fail("UNSUPPORTED", "El reto del lector excede el límite de cálculo");
          }
        } while (evaluate(node[2], env));
        return undefined;
      }
      case "try": {
        try {
          return runBlock(node[1], env);
        } catch (error) {
          const internal = error === null || typeof error !== "object" || "returned" in error || error.name === "ModuleError";
          if (node[3] === undefined || internal) {
            throw error;
          }
          if (node[2] !== undefined) {
            declare(node[2], error, env);
          }
          return runBlock(node[3], env);
        } finally {
          const signal = node[4] === undefined ? undefined : runBlock(node[4], env);
          if (signal !== undefined) {
            return signal;
          }
        }
      }
      case "switch": {
        const subject = evaluate(node[1], env);
        const cases = node[2];
        let start = cases.findIndex(([test]) => test !== undefined && evaluate(test, env) === subject);
        if (start === -1) {
          start = cases.findIndex(([test]) => test === undefined);
        }
        for (let index = start; index !== -1 && index < cases.length; index += 1) {
          const signal = runBlock(cases[index][1], env);
          if (signal === BREAK) {
            break;
          }
          if (signal !== undefined) {
            return signal;
          }
        }
        return undefined;
      }
      case "break":
        return BREAK;
      case "continue":
        return CONTINUE;
      case "return":
        throw { returned: node[1] === undefined ? undefined : evaluate(node[1], env) };
      default:
        throw unsupported(`sentencia «${node[0]}»`);
    }
  }

  const root = { vars: Object.create(null), parent: { vars: top, parent: null } };
  try {
    runBlock(program, root);
  } catch (signal) {
    if (signal !== null && typeof signal === "object" && "returned" in signal) {
      return signal.returned;
    }
    throw signal;
  }
  return undefined;
}
