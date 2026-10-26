/** Resolución del reto JS del lector y utilidades del formulario. */

import { CHALLENGE_PARTS } from "../config.js";
import { fail } from "./errors.js";

/** Cuerpo `application/x-www-form-urlencoded` sin depender de `URLSearchParams`. */
export function formBody(params) {
  return Object.entries(params)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

/**
 * El reto es JS ofuscado con constantes por petición. Se extraen la lista numérica
 * y el alfabeto, y se reproduce su misma cuenta: no se ejecuta nada del sitio.
 */
export function solveChallenge(script, anchor) {
  const match = CHALLENGE_PARTS.exec(String(script ?? ""));
  if (match === null) {
    throw fail("UNSUPPORTED", "El reto del lector cambió de formato y no se puede resolver", {
      selector: CHALLENGE_PARTS.source,
    });
  }
  const values = match[1].split(",").map(Number);
  const alphabet = match[2]
    .split(",")
    .map((code) => String.fromCharCode(Number(code)))
    .join("");
  if (values.length === 0 || alphabet === "") {
    throw fail("UNSUPPORTED", "El reto del lector llegó vacío");
  }

  let staticPart = 0;
  for (let index = 0; index < values.length; index += 1) {
    staticPart = (staticPart ^ values[index]) + alphabet.charCodeAt(index % alphabet.length);
  }
  const stamp = String(staticPart);

  let total = 0;
  for (const character of String(anchor ?? "")) {
    total = (total * 31 + character.charCodeAt(0)) & 0xffffff;
  }
  for (let index = 0; index < stamp.length; index += 1) {
    total = (total ^ stamp.charCodeAt(index)) + index;
  }
  return String(total);
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
