// Hermes (motor JS de la app) pierde las propiedades de `...(await x)` dentro de un literal de objeto
// en funciones async: el resultado llega sin `items`. Usa `const` explícito antes de construir el objeto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPREAD_AWAIT = /\.\.\.\s*\(\s*await\b/;
// YupManga usa el spread dentro de un `for` y funciona en el dispositivo (verificado): no se toca.
const ALLOWED_PREFIXES = ["yupmanga/"];

function listJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "fixtures" ? [] : listJs(path);
    return name.endsWith(".js") && !name.endsWith(".test.js") ? [path] : [];
  });
}

function modulesFiles() {
  const files = [];
  for (const name of readdirSync(ROOT)) {
    const site = join(ROOT, name);
    if (!statSync(site).isDirectory() || name.startsWith(".") || name === "node_modules") continue;
    const moduleJs = join(site, "module.js");
    try {
      statSync(moduleJs);
      files.push(moduleJs);
    } catch {
      // carpeta sin módulo (tools, skills, packages…)
    }
    const bin = join(site, "bin");
    try {
      files.push(...listJs(bin));
    } catch {
      // sin bin/
    }
  }
  return files;
}

test("ningún módulo usa spread de await (`...(await x)`) por el bug de Hermes", () => {
  const violations = [];
  for (const file of modulesFiles()) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (SPREAD_AWAIT.test(line)) violations.push(`${rel}:${index + 1}`);
      });
  }
  assert.deepEqual(
    violations,
    [],
    `Spread de await encontrado (asigna a una constante antes):\n${violations.join("\n")}`,
  );
});
