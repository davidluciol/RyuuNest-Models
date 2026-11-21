/** Resolución del reto JS del lector y utilidades del formulario. */

import { fail } from "./errors.js";
import { createBox } from "./boxStyle.js";
import { runScript } from "./miniJs.js";

/** Cuerpo `application/x-www-form-urlencoded` sin depender de `URLSearchParams`. */
export function formBody(params) {
  return Object.entries(params)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

/**
 * `document` simulado con solo lo que el reto consulta: el nodo oculto de la ficha y el
 * estilo calculado (`order`, `flex-grow`, `flex-shrink`) de sus hijos (ver `boxStyle.js`).
 */
function fakeBrowser(html, state) {
  const styles = new Map();
  const window = {};
  const document = {
    getElementById: (id) => {
      const box = createBox(html, String(id));
      if (box === null) {
        return null;
      }
      const children = box.children.map((child) => {
        const get = (property) => box.compute(child, property);
        const element = { ownerDocument: { defaultView: window } };
        styles.set(element, {
          getPropertyValue: get,
          order: get("order"),
          flexGrow: get("flex-grow"),
          flexShrink: get("flex-shrink"),
        });
        return element;
      });
      state.found = true;
      return { children, querySelectorAll: (selector) => (selector === ":scope>*" ? children : []) };
    },
    querySelector: (selector) => {
      const id = /^(?:#|\[id=")([\w-]+)"?\]?$/u.exec(String(selector));
      return id === null ? null : document.getElementById(id[1]);
    },
  };
  const getComputedStyle = (element) => styles.get(element);
  window.getComputedStyle = getComputedStyle;
  return { document, window, getComputedStyle };
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
