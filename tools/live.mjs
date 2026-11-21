// Prueba EN VIVO de un módulo contra el sitio real (solo análisis, no se publica).
// Requiere: `tools/tls-proxy.py <origen>` en marcha y RYUUNEST_REPO (clon del repo principal, aporta htmlparser2/css-select).
// DUMP=<dir> guarda cada respuesta cruda (cuarentena: .scrape-tmp/). TRACE=1 muestra cada petición (método, URL, estado, bytes). Uso: node tools/live.mjs <carpeta-modulo> <op> [args JSON...]   p. ej.  node tools/live.mjs yupmanga popular 1
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const [dir, op, ...raw] = process.argv.slice(2);
if (!dir || !op || !process.env.RYUUNEST_REPO) {
  console.error("uso: RYUUNEST_REPO=<clon> node tools/live.mjs <modulo> <op> [args JSON...]");
  process.exit(2);
}
const proxy = process.env.TLS_PROXY ?? "http://127.0.0.1:8799/";
const require = createRequire(`${process.env.RYUUNEST_REPO}/packages/core/package.json`);
const { parseDocument } = require("htmlparser2");
const { selectAll } = require("css-select");

const textOf = (n) => (n.type === "text" ? n.data : (n.children ?? []).map(textOf).join(""));
const view = (node) => ({
  attr: (name) => node.attribs?.[name],
  text: () => textOf(node),
  select: (selector) => selectAll(selector, node).map(view),
});

const host = {
  html: (text) => view(parseDocument(text)),
  fetch: async (url, init = {}) => {
    const r = await fetch(proxy, {
      method: "POST",
      headers: { ...init.headers, "X-Target-Url": url, "X-Method": init.method ?? "GET" },
      body: init.body,
    });
    const body = Buffer.from(await r.arrayBuffer());
    if (process.env.TRACE) console.error(init.method ?? "GET", url.slice(0, 110), r.headers.get("x-status"), body.length, body.length < 200 ? body.toString("utf8") : "", "loc=" + r.headers.get("x-location"), "cookie=" + (init.headers?.Cookie ?? "").replace(/=[^;]{6,}/g, "=…"), new Date().toISOString().slice(17, 23));
    if (process.env.DUMP) { mkdirSync(process.env.DUMP, { recursive: true }); writeFileSync(`${process.env.DUMP}/${Date.now()}-${(init.method ?? "GET")}-${new URL(url).pathname.replace(/\W+/g, "_")}.raw`, body); }
    const headers = { "content-type": r.headers.get("x-ctype") ?? "", "set-cookie": r.headers.get("x-set-cookie") ?? "", location: r.headers.get("x-location") ?? "" };
    return { status: Number(r.headers.get("x-status")), headers, url, text: async () => body.toString("utf8"), arrayBuffer: async () => body, bytes: async () => new Uint8Array(body) };
  },
};

const create = (await import(pathToFileURL(resolve(dir, "module.js")).href)).default;
const args = raw.map((a) => { try { return JSON.parse(a); } catch { return a; } });
try {
  console.log(JSON.stringify(await create(host)[op](...args), null, 1).slice(0, 4000));
} catch (e) {
  console.log("ERROR", e.code, e.message);
}
