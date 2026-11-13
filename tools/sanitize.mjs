#!/usr/bin/env node
/**
 * Sanitiza una respuesta cruda guardada en `.scrape-tmp/` antes de que un LLM la lea.
 * Uso: node tools/sanitize.mjs <archivo> [salida]   (sin salida → stdout; el informe va a stderr)
 * shortcut: trabaja con regex, no con parser; el CSS oculto lo descarta Scrapling (`main_content_only`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Zero-width, bidi, BOM y tag characters (U+E0000–E007F).
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]|\uDB40[\uDC00-\uDC7F]/g;
const BLOCKS = /<!--[\s\S]*?-->|<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi;
const SUSPICIOUS = [
  /ignore (all |any )?(previous|prior|above) (instructions|prompts?)/i,
  /\b(system prompt|as an? (ai|assistant|llm)|you are (now )?an? (ai|assistant))\b/i,
  /\b(curl|wget|npm install|pip install|rm -rf|powershell)\b/i,
  /\b(assistant|claude|chatgpt)\b.{0,40}\b(must|should|run|execute|send|download)\b/i,
  /[A-Za-z0-9+/]{200,}={0,2}/, // blob base64
];

export function sanitize(text) {
  const report = { invisible: 0, blocks: 0, suspicious: [] };
  let clean = String(text).replace(INVISIBLE, () => (report.invisible++, ""));
  clean = clean.replace(BLOCKS, () => (report.blocks++, ""));
  clean = clean.normalize("NFKC");
  for (const pattern of SUSPICIOUS) {
    const hit = clean.match(pattern);
    if (hit) report.suspicious.push(hit[0].slice(0, 80));
  }
  return { clean, report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error("Uso: node tools/sanitize.mjs <archivo> [salida]");
    process.exit(2);
  }
  const { clean, report } = sanitize(readFileSync(input, "utf8"));
  if (output) writeFileSync(output, clean);
  else process.stdout.write(clean);
  console.error(JSON.stringify(report));
  if (report.suspicious.length) process.exitCode = 1; // 1 = revisar a mano; anotar en BUGS.md
}
