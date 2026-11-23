// Prueba sin red (fixtures inventadas). Necesita el parser del repo principal:
// RYUUNEST_REPO=<ruta absoluta al clon> node --test fanfox/bin/fanfox.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import create from "../module.js";
import { unpack } from "./utils/unpack.js";

const repo = process.env.RYUUNEST_REPO;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const reply = (status, text, extra = {}) => ({ status, headers: {}, text: async () => text, ...extra });
const IMAGE_HEADERS = {
  Referer: "https://fanfox.net/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

/** `route(url, headers)` devuelve la respuesta; cada petición queda en `requests`. */
function makeHost(route, requests = []) {
  const require = createRequire(`${repo}/packages/core/package.json`);
  const { parseDocument } = require("htmlparser2");
  const { selectAll } = require("css-select");
  const textOf = (n) => (n.type === "text" ? n.data : (n.children ?? []).map(textOf).join(""));
  const view = (node) => ({
    attr: (name) => node.attribs?.[name],
    text: () => textOf(node),
    select: (selector) => selectAll(selector, node).map(view),
  });
  return {
    html: (text) => view(parseDocument(text, { decodeEntities: true })),
    fetch: async (url, init = {}) => {
      requests.push({ url, headers: init.headers });
      return { url, ...(await route(url, init.headers)) };
    },
  };
}

test("unpack sustituye los tokens sin ejecutar el script", () => {
  assert.equal(
    unpack(fixture("chapterfun-1.txt")),
    'var pix="//zjcdn.mangafox.me/store/manga/900001/1.0/compressed";var pvalue=["/d001.jpg?token=a&ttl=1","/d002.jpg?token=b&ttl=1"];',
  );
  assert.equal(unpack("sin empaquetar"), undefined);
});

test("fanfox: popular lee el directorio con título completo, portada https y pista", { skip: !repo }, async () => {
  const requests = [];
  const { items, hasNext } = await create(makeHost(() => reply(200, fixture("directory.html")), requests)).popular(2);
  assert.equal(requests[0].url, "https://fanfox.net/directory/2.html");
  assert.equal(requests[0].headers.Cookie, "isAdult=1");
  assert.equal(hasNext, true);
  assert.deepEqual(items, [
    {
      id: "serie_inventada_uno",
      title: "Serie Inventada Uno Con Un Titulo Largo",
      cover: { url: "https://fmcdn.mfcdn.net/store/manga/900001/cover.jpg?token=aaa&ttl=1&v=1", headers: IMAGE_HEADERS },
      hint: "Vol.01 Ch.012",
    },
    {
      id: "serie_inventada_dos",
      title: "Serie Inventada Dos",
      cover: { url: "https://fmcdn.mfcdn.net/store/manga/900002/cover.jpg", headers: IMAGE_HEADERS },
    },
  ]);
});

test("fanfox: latest, list y home usan los órdenes del directorio", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("directory.html")), requests));
  assert.equal((await mod.latest(3)).hasNext, false);
  await mod.list("news", 1);
  await mod.list("desconocida", 1);
  const { sections } = await mod.home();
  assert.deepEqual(requests.map((r) => r.url), [
    "https://fanfox.net/directory/3.html?latest",
    "https://fanfox.net/directory/?news",
    "https://fanfox.net/directory/",
    "https://fanfox.net/directory/",
    "https://fanfox.net/directory/?latest",
    "https://fanfox.net/directory/?rating",
    "https://fanfox.net/directory/?news",
  ]);
  assert.deepEqual(sections.map((s) => [s.id, s.title, s.kind, s.items.length]), [
    ["popular", "Populares", "list", 2],
    ["latest", "Últimas actualizaciones", "list", 2],
    ["rating", "Mejor valoradas", "list", 2],
    ["news", "Nuevas series", "list", 2],
  ]);
});

test("fanfox: search traduce filtros válidos y descarta los demás", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost((url) => reply(200, fixture(url.includes("nada") ? "search-empty.html" : "search.html")), requests));
  const found = await mod.search(" tres ", 1, { genre: "12", type: "2", status: "2" });
  assert.deepEqual(found.items, [{
    id: "serie_inventada_tres",
    title: "Serie Inventada Tres",
    cover: { url: "https://fmcdn.mfcdn.net/store/manga/900003/cover.jpg", headers: IMAGE_HEADERS },
    hint: "Ch.007",
  }]);
  assert.equal(found.hasNext, true);
  assert.equal((await mod.search("tres", 2)).hasNext, false);
  assert.deepEqual(await mod.search("nada", 1, { genre: "99", type: "x", status: "9" }), { items: [], hasNext: false });
  const params = requests.map((r) => Object.fromEntries(new URL(r.url).searchParams));
  assert.deepEqual(params[0], { title: "tres", genres: "12", type: "2", st: "2", page: "1" });
  assert.deepEqual(params[2], { title: "nada", genres: "", type: "0", st: "0", page: "1" });
});

test("fanfox: filters refleja el buscador del sitio", { skip: !repo }, async () => {
  const list = await create(makeHost(() => reply(200, ""))).filters();
  assert.deepEqual(list.map((f) => [f.id, f.type, f.options.length]), [["genre", "select", 37], ["type", "select", 7], ["status", "select", 2]]);
  assert.deepEqual(list[0].options[11], { value: "12", label: "Romance" });
});

test("fanfox: details une las dos pestañas de capítulos, más nuevo primero", { skip: !repo }, async () => {
  const requests = [];
  const series = await create(makeHost(() => reply(200, fixture("details.html")), requests)).details("serie_inventada_uno");
  assert.equal(requests[0].url, "https://fanfox.net/manga/serie_inventada_uno/");
  const { chapters, ...meta } = series;
  assert.deepEqual(meta, {
    id: "serie_inventada_uno",
    title: "Serie Inventada Uno",
    cover: { url: "https://fmcdn.mfcdn.net/store/manga/900001/cover.jpg?token=aaa&ttl=1", headers: IMAGE_HEADERS },
    nsfw: true,
    hint: "Autora Inventada",
    description: "Resumen completo de una serie inventada.",
    genres: ["Romance", "Adult"],
    status: "completed",
    altTitles: [],
    extra: { Autor: "Autora Inventada", Valoración: "4.5" },
  });
  assert.deepEqual(chapters, [
    { id: "serie_inventada_uno/c012.5", title: "Ch.012.5", number: 12.5, releases: [{ id: "serie_inventada_uno/c012.5" }] },
    { id: "serie_inventada_uno/v02/c012", title: "Vol.02 Ch.012", number: 12, releases: [{ id: "serie_inventada_uno/v02/c012", publishedAt: "2026-11-13" }] },
    { id: "serie_inventada_uno/c001", title: "Ch.001", number: 1, releases: [{ id: "serie_inventada_uno/c001", publishedAt: "2025-01-05" }] },
  ]);
});

test("fanfox: details tipa los errores", { skip: !repo }, async () => {
  const code = async (route, id = "serie_inventada_uno") =>
    create(makeHost(route)).details(id).then(() => "ok", (e) => [e.name, e.code]);
  assert.deepEqual(await code(() => reply(200, "")), ["ModuleError", "PARSE"]);
  assert.deepEqual(await code(() => reply(200, fixture("page-other.html"))), ["ModuleError", "PARSE"]);
  assert.deepEqual(await code(() => reply(404, "")), ["ModuleError", "NOT_FOUND"]);
  assert.deepEqual(await code(() => reply(403, "")), ["ModuleError", "BLOCKED"]);
  assert.deepEqual(await code(() => reply(429, "")), ["ModuleError", "RATE_LIMITED"]);
  // El host sigue la redirección de una serie inexistente al buscador...
  assert.deepEqual(await code(() => reply(200, fixture("search-empty.html"), { url: "https://fanfox.net/search?stype=1&name=zz" })), ["ModuleError", "NOT_FOUND"]);
  // ...y si no la sigue, queda la cabecera Location.
  assert.deepEqual(await code(() => reply(302, "", { headers: { location: "/search?stype=1&name=zz" } })), ["ModuleError", "NOT_FOUND"]);
  assert.deepEqual(await code(() => reply(200, ""), "../fuera"), ["ModuleError", "NOT_FOUND"]);
});

test("fanfox: pages lee la vista móvil en una petición", { skip: !repo }, async () => {
  const requests = [];
  const result = await create(makeHost(() => reply(200, fixture("roll.html")), requests)).pages("serie_inventada_uno/v01/c001");
  assert.deepEqual(requests.map((r) => r.url), ["https://m.fanfox.net/roll_manga/serie_inventada_uno/v01/c001/1.html"]);
  assert.deepEqual(result, {
    images: [
      { url: "https://zjcdn.mangafox.me/store/manga/900001/1.0/compressed/d001.jpg?token=a&ttl=1", headers: IMAGE_HEADERS },
      { url: "https://zjcdn.mangafox.me/store/manga/900001/1.0/compressed/d002.jpg?token=b&ttl=1", headers: IMAGE_HEADERS },
    ],
  });
});

test("fanfox: pages pasa a chapterfun.ashx si la vista móvil no trae imágenes", { skip: !repo }, async () => {
  const requests = [];
  const route = (url) => {
    if (url.includes("/roll_manga/")) return reply(200, "<html></html>");
    if (url.includes("page=1&")) return reply(200, fixture("chapterfun-1.txt"));
    if (url.includes("page=3&")) return reply(200, fixture("chapterfun-3.txt"));
    return reply(200, fixture("reader.html"));
  };
  const { images } = await create(makeHost(route, requests)).pages("serie_inventada_uno/c001");
  assert.deepEqual(requests.map((r) => r.url), [
    "https://m.fanfox.net/roll_manga/serie_inventada_uno/c001/1.html",
    "https://fanfox.net/manga/serie_inventada_uno/c001/1.html",
    "https://fanfox.net/manga/serie_inventada_uno/c001/chapterfun.ashx?cid=700001&page=1&key=",
    "https://fanfox.net/manga/serie_inventada_uno/c001/chapterfun.ashx?cid=700001&page=3&key=",
  ]);
  assert.equal(requests[2].headers.Referer, "https://fanfox.net/manga/serie_inventada_uno/c001/1.html");
  // La última imagen (anuncio) se descarta.
  assert.deepEqual(images.map((i) => i.url), [
    "https://zjcdn.mangafox.me/store/manga/900001/1.0/compressed/d001.jpg?token=a&ttl=1",
    "https://zjcdn.mangafox.me/store/manga/900001/1.0/compressed/d002.jpg?token=b&ttl=1",
  ]);
});

test("fanfox: pages tipa los errores", { skip: !repo }, async () => {
  const code = async (route, id = "serie_inventada_uno/c001") =>
    create(makeHost(route)).pages(id).then(() => "ok", (e) => e.code);
  assert.equal(await code(() => reply(403, "")), "BLOCKED");
  assert.equal(await code((url) => (url.includes("/roll_manga/") ? reply(200, "") : reply(404, ""))), "NOT_FOUND");
  assert.equal(await code((url) => reply(200, url.includes("chapterfun") ? "basura" : url.includes("/roll_manga/") ? "" : fixture("reader.html"))), "PARSE");
  assert.equal(await code(() => reply(200, fixture("page-other.html"))), "PARSE");
  assert.equal(await code(() => reply(200, ""), "serie/../../x"), "NOT_FOUND");
});
