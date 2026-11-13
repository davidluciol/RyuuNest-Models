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
  ">>>=", "===", "!==", "<<=", ">>=", ">>>", "&&", "||", "==", "!=", "<=", ">=", "<<", ">>",
  "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
  "+", "-", "*", "/", "%", "&", "|", "^", "~", "!", "<", ">", "=", "?", ":", ",", ";", ".",
  "(", ")", "[", "]", "{", "}",
];
const NUMBER = /0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const IDENT = /[A-Za-z_$][\w$]*/y;
const ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };

function unsupported(message) {
  return fail("UNSUPPORTED", `El reto del lector usa JS no soportado: ${message}`);
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
          if (current === "x" || current === "u") {
            const size = current === "x" ? 2 : 4;
            current = String.fromCharCode(parseInt(source.slice(index + 1, index + 1 + size), 16));
            index += size;
          } else {
            current = ESCAPES[current] ?? current;
          }
        }
        value += current;
        index += 1;
      }
      tokens.push({ type: "str", value });
      index += 1;
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
  "+": 9, "-": 9, "*": 10, "/": 10, "%": 10,
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

  declarations() {
    const list = [];
    do {
      const name = this.next().value;
      list.push([name, this.eat("=") ? this.assign() : undefined]);
    } while (this.eat(","));
    return ["var", list];
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
        case "var": {
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
          if (this.isWord("var")) {
            this.next();
            init = this.declarations();
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
          const name = this.next().value;
          return ["var", [[name, this.functionRest()]]];
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

  functionRest() {
    this.expect("(");
    const params = [];
    while (!this.eat(")")) {
      params.push(this.next().value);
      this.eat(",");
    }
    return ["fn", params, this.block()];
  }

  expression() {
    let node = this.assign();
    while (this.eat(",")) {
      node = ["seq", node, this.assign()];
    }
    return node;
  }

  assign() {
    const left = this.conditional();
    const token = this.peek();
    if (token !== undefined && token.type === "p" && ASSIGN_OPS.has(token.value)) {
      this.next();
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
          args.push(this.assign());
          this.eat(",");
        }
        node = ["call", node, args];
      } else {
        return node;
      }
    }
  }

  primary() {
    const token = this.next();
    if (token.type === "num" || token.type === "str") {
      return ["lit", token.value];
    }
    if (token.type === "id") {
      if (token.value === "function") {
        if (this.peek().type === "id") {
          this.next();
        }
        return this.functionRest();
      }
      return token.value in LITERALS ? ["lit", LITERALS[token.value]] : ["id", token.value];
    }
    if (token.value === "(") {
      const node = this.expression();
      this.expect(")");
      return node;
    }
    if (token.value === "[") {
      const items = [];
      while (!this.eat("]")) {
        items.push(this.assign());
        this.eat(",");
      }
      return ["arr", items];
    }
    throw unsupported(`símbolo «${token.value}»`);
  }
}

const BINARY = {
  "+": (a, b) => a + b, "-": (a, b) => a - b, "*": (a, b) => a * b, "/": (a, b) => a / b,
  "%": (a, b) => a % b, "&": (a, b) => a & b, "|": (a, b) => a | b, "^": (a, b) => a ^ b,
  "<<": (a, b) => a << b, ">>": (a, b) => a >> b, ">>>": (a, b) => a >>> b,
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
};
const NUMBER_METHODS = { toString: (n, radix) => n.toString(radix) };

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
  if ((typeof object === "object" && object !== null) || typeof object === "function") {
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
      min: Math.min, max: Math.max,
    },
    JSON: { parse: (text) => JSON.parse(text), stringify: (value) => JSON.stringify(value) },
    Array: { isArray: (value) => Array.isArray(value) },
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

  function call(fn, args) {
    if (typeof fn !== "function") {
      throw unsupported("llamada a algo que no es una función");
    }
    return fn(...args);
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
        return node[1].map((item) => evaluate(item, env));
      case "fn":
        return makeFunction(node, env);
      case "seq":
        evaluate(node[1], env);
        return evaluate(node[2], env);
      case "cond":
        return evaluate(node[1], env) ? evaluate(node[2], env) : evaluate(node[3], env);
      case "mem":
        return read(evaluate(node[1], env), evaluate(node[2], env));
      case "call":
        return call(
          evaluate(node[1], env),
          node[2].map((arg) => evaluate(arg, env)),
        );
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

  function store(target, value, env) {
    if (target[0] === "id") {
      (lookup(env, target[1]) ?? { vars: top }).vars[target[1]] = value;
      return value;
    }
    const object = evaluate(target[1], env);
    const key = evaluate(target[2], env);
    if (!Array.isArray(object) || typeof key !== "number") {
      throw unsupported("asignación a un miembro que no es un índice de arreglo");
    }
    object[key] = value;
    return value;
  }

  function makeFunction(node, env) {
    return (...args) => {
      const scope = { vars: Object.create(null), parent: env };
      node[1].forEach((name, index) => {
        scope.vars[name] = args[index];
      });
      try {
        runBlock(node[2], scope);
      } catch (signal) {
        if (signal !== null && typeof signal === "object" && "returned" in signal) {
          return signal.returned;
        }
        throw signal;
      }
      return undefined;
    };
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
        for (const [name, init] of node[1]) {
          env.vars[name] = init === undefined ? undefined : evaluate(init, env);
        }
        return undefined;
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
