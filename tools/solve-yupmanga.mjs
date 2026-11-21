// Resuelve un reto del lector de YupManga con el intérprete cerrado del módulo (nunca ejecuta el JS del sitio).
// Uso: node tools/solve-yupmanga.mjs <challenge.js> <ficha.html>   → imprime la respuesta, o sale con código 1 y el error en stderr.
import { readFileSync } from "node:fs";
import { solveChallenge } from "../yupmanga/bin/utils/challenge.js";

try {
  console.log(solveChallenge(readFileSync(process.argv[2], "utf8"), readFileSync(process.argv[3], "utf8")));
} catch (error) {
  console.error(`${error.code ?? "ERROR"}: ${error.message}`);
  process.exit(1);
}
