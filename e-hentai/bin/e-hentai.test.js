// Prueba sin red (fixtures inventadas). Necesita el parser del repo principal:
// RYUUNEST_REPO=<ruta al clon> node --test e-hentai/bin/e-hentai.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import create from "../module.js";

const repo = process.env.RYUUNEST_REPO;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const reply = (status, text) => ({ status, text: async () => text });
const API = "https://api.e-hentai.org/api.php";

/** `route(call)` devuelve `{ status, text }`; cada petición queda en `requests`. */
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
    html: (text) => view(parseDocument(text)),
    fetch: async (url, init = {}) => {
      const call = { url, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
      requests.push(call);
      return route(call);
    },
  };
}

const showpage = (page) => JSON.stringify({ i3: `<a><img id="img" src="https://n${page}.demo.hath.network/h/x/${page}.webp"></a>` });

test("e-hentai: latest recorre la cadena ?next= hasta la página pedida", { skip: !repo }, async () => {
  const requests = [];
  const host = makeHost(() => reply(200, fixture("list.html")), requests);
  const { items, hasNext } = await create(host).latest(3);
  assert.deepEqual(requests.map((r) => r.url), [
    "https://e-hentai.org/?f_search=language%3Aspanish",
    "https://e-hentai.org/?f_search=demo&next=900002",
    "https://e-hentai.org/?f_search=demo&next=900002",
  ]);
  assert.equal(requests[0].headers.Referer, "https://e-hentai.org/");
  assert.equal(hasNext, true);
  assert.deepEqual(items[0], {
    id: "g/900001/abcdef0123",
    title: "Serie Inventada Uno",
    cover: { url: "https://ehgt.org/w/00/000/00001-demo.webp", headers: items[0].cover.headers },
    kind: "manga",
    nsfw: true,
    badges: ["Manga", "Español"],
    hint: "12 págs.",
  });
  assert.equal(items[1].cover.url, "https://ehgt.org/w/00/000/00002-demo.webp");
  assert.deepEqual(items[1].badges, ["Doujinshi", "klingon"]);
  assert.equal(items[1].hint, "1 págs.");
});

test("e-hentai: la cadena se corta en la última página", { skip: !repo }, async () => {
  const host = makeHost(() => reply(200, fixture("list-last.html")));
  assert.deepEqual(await create(host).latest(2), { items: [], hasNext: false });
  const first = await create(host).latest(1);
  assert.equal(first.hasNext, false);
  assert.equal(first.items[0].cover, undefined);
});

test("e-hentai: search traduce filtros a f_search, f_cats y f_srdd", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("list-last.html")), requests));
  await mod.search(" maid ", 1, { language: "english", categories: ["2", "4", "zz"], tags: ["female:big breasts", "solo"], rating: "4" });
  await mod.search("x", 1, { language: "any", categories: "4", rating: "9" });
  await mod.search("", 1, { language: "zz" });
  const params = requests.map((r) => Object.fromEntries(new URL(r.url).searchParams));
  assert.deepEqual(params[0], {
    f_search: 'maid language:english female:"big breasts$" solo',
    f_cats: "1017",
    f_sr: "on",
    f_srdd: "4",
  });
  assert.deepEqual(params[1], { f_search: "x", f_cats: "1019" });
  assert.deepEqual(params[2], { f_search: "language:spanish" });
});

test("e-hentai: popular, home, list y filters", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(() => reply(200, fixture("list.html")), requests));
  const popular = await mod.popular(1);
  assert.equal(popular.items.length, 2);
  assert.equal(popular.hasNext, false);
  assert.deepEqual(await mod.popular(2), { items: [], hasNext: false });
  const { sections } = await mod.home();
  assert.deepEqual(sections.map((s) => [s.id, s.title, s.kind, s.items.length, s.hasNext]), [
    ["latest", "Recientes", "list", 2, true],
    ["popular", "Populares", "list", 2, false],
  ]);
  await mod.list("popular", 1);
  await mod.list("zz", 1);
  assert.deepEqual(requests.map((r) => r.url).slice(-2), ["https://e-hentai.org/popular", "https://e-hentai.org/?f_search=language%3Aspanish"]);
  const filters = await mod.filters();
  assert.deepEqual(filters.map((f) => [f.id, f.type]), [["language", "select"], ["categories", "multi"], ["tags", "tags"], ["rating", "select"]]);
  assert.equal(filters[0].options[0].value, "spanish");
});

test("e-hentai: details usa gdata y parte en bloques de 20", { skip: !repo }, async () => {
  const requests = [];
  const details = await create(makeHost(() => reply(200, fixture("gdata.json")), requests)).details("g/900001/abcdef0123");
  assert.equal(requests[0].url, API);
  assert.deepEqual(requests[0].body, { method: "gdata", gidlist: [[900001, "abcdef0123"]], namespace: 1 });
  assert.equal(details.title, "Serie Inventada Uno & Amigos");
  assert.deepEqual(details.altTitles, []);
  assert.deepEqual(details.genres, ["demo", "full color"]);
  assert.equal(details.status, "completed");
  assert.deepEqual(details.extra, {
    Categoría: "Manga", "Subido por": "demo", Valoración: "4.50", Páginas: "45",
    Idioma: "spanish, translated", Artista: "autora demo", Parodia: "original",
  });
  assert.deepEqual(details.chapters.map((c) => [c.id, c.title, c.number]), [
    ["g/900001/abcdef0123/2", "Páginas 41–45", 3],
    ["g/900001/abcdef0123/1", "Páginas 21–40", 2],
    ["g/900001/abcdef0123/0", "Páginas 1–20", 1],
  ]);
  assert.deepEqual(details.chapters[0].releases, [{ id: "g/900001/abcdef0123/2", publishedAt: "2026-01-01T00:00:00.000Z" }]);
});

test("e-hentai: details da NOT_FOUND con error de la API o id inválido", { skip: !repo }, async () => {
  const mod = create(makeHost(() => reply(200, fixture("gdata-missing.json"))));
  await assert.rejects(mod.details("g/900009/abcdef0123"), { name: "ModuleError", code: "NOT_FOUND" });
  await assert.rejects(mod.details("900009"), { code: "NOT_FOUND" });
});

test("e-hentai: pages abre el primer /s/ y pide el resto a showpage", { skip: !repo }, async () => {
  const requests = [];
  const host = makeHost((call) => {
    if (call.url === API) return reply(200, showpage(call.body.page));
    return reply(200, fixture(call.url.includes("/s/") ? "reader.html" : "gallery.html"));
  }, requests);
  const result = await create(host).pages("g/900001/abcdef0123/1", "g/900001/abcdef0123/1");
  assert.equal(requests[0].url, "https://e-hentai.org/g/900001/abcdef0123/?p=1");
  assert.equal(requests[0].headers.Cookie, "nw=1");
  assert.equal(requests[1].url, "https://e-hentai.org/s/aaaaaaaaaa/900001-21");
  assert.deepEqual(requests.slice(2).map((r) => r.body), [
    { method: "showpage", gid: 900001, page: 22, imgkey: "bbbbbbbbbb", showkey: "demoshowkey1" },
    { method: "showpage", gid: 900001, page: 23, imgkey: "cccccccccc", showkey: "demoshowkey1" },
  ]);
  assert.equal(result.title, "Páginas 21–23");
  assert.deepEqual(result.images.map((i) => i.url), [
    "https://demo.abcdefgh.hath.network:7000/h/demo-21/keystamp=1;xres=1280/21.webp",
    "https://n22.demo.hath.network/h/x/22.webp",
    "https://n23.demo.hath.network/h/x/23.webp",
  ]);
  assert.equal(result.images[0].headers.Referer, "https://e-hentai.org/");
});

test("e-hentai: errores tipados (404, veto de IP, cuota 509, galería vacía)", { skip: !repo }, async () => {
  const at = (route) => create(makeHost(route));
  await assert.rejects(at(() => reply(404, "Key missing, or incorrect key provided.")).pages("g/900001/abcdef0123/0"), { code: "NOT_FOUND" });
  await assert.rejects(at(() => reply(200, "Your IP address has been temporarily banned for excessive pageloads.")).latest(1), { code: "RATE_LIMITED" });
  await assert.rejects(at(() => reply(200, "<html><body>nada</body></html>")).pages("g/900001/abcdef0123/0"), { code: "PARSE" });
  const quota = (call) => reply(200, call.url.includes("/s/")
    ? fixture("reader.html").replace(/src="[^"]+"/u, 'src="https://ehgt.org/g/509.gif"')
    : fixture("gallery.html"));
  await assert.rejects(at(quota).pages("g/900001/abcdef0123/0"), { code: "RATE_LIMITED" });
  await assert.rejects(at(() => reply(200, fixture("list.html").replace("https://e-hentai.org/?f_search", "https://otro.example/?f_search"))).latest(2), { code: "PARSE" });
});
