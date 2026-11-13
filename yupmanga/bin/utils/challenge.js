/** Resolución del reto JS del lector y utilidades del formulario. */

import { fail } from "./errors.js";
import { runScript } from "./miniJs.js";

/** Cuerpo `application/x-www-form-urlencoded` sin depender de `URLSearchParams`. */
export function formBody(params) {
  return Object.entries(params)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

/** Comparación lexicográfica de [important, especificidad, orden]. */
function outranks(a, b) {
  const at = a.findIndex((part, i) => part !== b[i]);
  return at === -1 || a[at] > b[at];
}

const DEFAULTS = { order: "0", "flex-grow": "0", "flex-shrink": "1" };

/**
 * Estilo calculado de un hijo del `<div id>` oculto de la ficha: el reto lee `order`,
 * `flex-grow` y `flex-shrink`, que salen de reglas `#id .a.b{…}` de un `<style>` en línea.
 * Gana `!important`, luego la especificidad (nº de clases) y luego el orden en el código.
 */
function computedStyle(rules, classes, property) {
  let best;
  for (const rule of rules) {
    if (!rule.classes.every((name) => classes.includes(name))) {
      continue;
    }
    for (const [name, value, important] of rule.declarations) {
      if (name !== property) {
        continue;
      }
      const rank = [important ? 1 : 0, rule.classes.length, rule.index];
      if (best === undefined || outranks(rank, best.rank)) {
        best = { rank, value };
      }
    }
  }
  return best === undefined ? DEFAULTS[property] ?? "" : best.value;
}

/** `document` simulado con solo lo que el reto consulta: el div oculto de la ficha. */
function fakeBrowser(html, state) {
  const styles = new Map();
  const styleOf = (element) => ({
    getPropertyValue: (property) => computedStyle(element.rules, element.classes, property),
  });
  const document = {
    getElementById: (id) => {
      const safe = String(id).replace(/[^\w-]/gu, "");
      const box = new RegExp(String.raw`<div[^>]*\bid="${safe}"[^>]*>([\s\S]*?)</div>`, "u").exec(html);
      if (box === null) {
        return null;
      }
      const rules = [];
      const rule = new RegExp(String.raw`#${safe}\s+([^\s{,]+)\s*\{([^}]*)\}`, "gu");
      for (const match of html.matchAll(rule)) {
        rules.push({
          index: rules.length,
          classes: (match[1].match(/\.[\w-]+/gu) ?? []).map((name) => name.slice(1)),
          declarations: match[2]
            .split(";")
            .map((part) => /^\s*([\w-]+)\s*:\s*([^!]*?)\s*(!important)?\s*$/u.exec(part))
            .filter((part) => part !== null)
            .map((part) => [part[1], part[2], part[3] !== undefined]),
        });
      }
      const children = [...box[1].matchAll(/<[a-z]+[^>]*\sclass="([^"]*)"[^>]*>/giu)].map((tag) => {
        const element = { classes: tag[1].split(/\s+/u).filter(Boolean), rules };
        styles.set(element, styleOf(element));
        return element;
      });
      state.found = true;
      return { children };
    },
  };
  return { document, window: { getComputedStyle: (element) => styles.get(element) } };
}

/**
 * El reto es JS ofuscado que cambia en cada petición: lee el DOM oculto de la ficha y
 * suma una cuenta aritmética distinta cada vez. Se ejecuta en un intérprete cerrado
 * (`miniJs.js`), nunca con `eval`, contra un `document` simulado de la ficha.
 */
export function solveChallenge(script, seriesHtml) {
  const state = { found: false };
  const answer = runScript(String(script ?? ""), fakeBrowser(String(seriesHtml ?? ""), state));
  if (!state.found) {
    throw fail("UNSUPPORTED", "La ficha no trae el nodo oculto que lee el reto del lector");
  }
  if (typeof answer !== "string" || !/^\d+$/u.test(answer) || answer === "0") {
    throw fail("UNSUPPORTED", "El reto del lector no se pudo resolver (cambió de formato)");
  }
  return answer;
}

/** Espera el tiempo que el sitio exige para el interstitial. */
export function sleep(milliseconds) {
  return new Promise((resolve) => {
    if (typeof setTimeout !== "function") {
      throw fail("UNSUPPORTED", "El runtime del módulo no ofrece temporizadores");
    }
    setTimeout(resolve, milliseconds);
  });
}
