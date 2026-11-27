// Prueba sin red (fixtures inventadas): node --test mangation/bin/mangation.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import create from "../module.js";
import { hydrate } from "./utils/http.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const reply = (status, text) => ({ status, text: async () => text });

/** `route(url)` → [status, fixture]; registra cada URL pedida. */
function makeHost(route, requests = []) {
  return {
    fetch: async (url, init = {}) => {
      requests.push({ url, headers: init.headers });
      const [status, name] = route(new URL(url)) ?? [404, "api-404.json"];
      return reply(status, fixture(name));
    },
  };
}

const site = (u) => {
  const path = u.pathname;
  if (path === "/api/public/mangas/library") return [200, u.searchParams.get("page") === "2" ? "library-2.json" : "library-1.json"];
  if (path === "/api/public/mangas") return [200, u.searchParams.get("q").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() === "demo" ? "search-full.json" : "search-short.json"];
  if (path === "/api/public/genres") return [200, "genres.json"];
  if (path === "/api/public/mangas/serie-demo-uno/chapters") return [200, "chapters-2.json"];
  if (path === "/popular/__data.json") return [200, "popular.data.json"];
  if (path === "/genre/comedia/__data.json") return [200, "genre.data.json"];
  if (path === "/manga/serie-demo-uno/__data.json") return [200, "manga.data.json"];
  if (path === "/manga/serie-demo-uno/chapter/1/__data.json") return [200, "chapter.data.json"];
  if (path.endsWith("/__data.json")) return [200, "notfound.data.json"];
  return undefined;
};

const rejectsWith = (promise, code) => assert.rejects(promise, (e) => e.name === "ModuleError" && e.code === code);

test("mangation: hydrate rehidrata devalue, ignora __proto__ y tipos especiales", () => {
  assert.deepEqual(hydrate([{ a: 1, b: 2, c: -1, d: 3 }, "x", [4, 4], ["Date", "2026-01-01"], 7]), {
    a: "x", b: [7, 7], c: undefined, d: "2026-01-01",
  });
  const out = hydrate([{ __proto__: null, ["__proto__"]: 1 }, { polluted: 1 }]);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
});

test("mangation: latest pide la library y quita novelas", async () => {
  const requests = [];
  const { items, hasNext } = await create(makeHost(site, requests)).latest(1);
  const url = new URL(requests[0].url);
  assert.equal(url.origin + url.pathname, "https://api.mangation.com/api/public/mangas/library");
  assert.deepEqual(url.searchParams.getAll("type"), ["manga", "manhwa", "manhua"]);
  assert.equal(url.searchParams.get("adult"), "true");
  assert.equal(url.searchParams.get("sort"), "newest");
  assert.equal(requests[0].headers.Accept, "application/json");
  assert.equal(hasNext, true);
  assert.deepEqual(items.map((i) => i.id), ["serie-demo-uno", "serie-demo-dos"]);
  assert.deepEqual(items[0], {
    id: "serie-demo-uno",
    title: "Serie Demo Uno",
    cover: { url: "https://media.mangation.com/content/demoA/covers/portada.jpg", headers: items[0].cover.headers },
    kind: "manga",
    nsfw: false,
    badges: ["Manga", "Shōnen"],
  });
  assert.equal(items[1].kind, "manhwa");
  assert.equal(items[1].nsfw, true);
  assert.deepEqual(items[1].badges, ["Manhwa", "Seinen", "+18"]);
  assert.equal((await create(makeHost(site)).latest(2)).hasNext, false);
});

test("mangation: popular solo tiene página 1", async () => {
  const module = create(makeHost(site));
  const first = await module.popular(1);
  assert.deepEqual(first.items.map((i) => i.id), ["serie-demo-dos", "serie-demo-uno"]);
  assert.equal(first.hasNext, false);
  assert.deepEqual(await module.popular(2), { items: [], hasNext: false });
});

test("mangation: search sin texto usa filtros de servidor o el género", async () => {
  const requests = [];
  const module = create(makeHost(site, requests));
  await module.search("", 2, { type: ["manhwa", "novela"], demografy: "seinen", status: ["hiatus"], order: "oldest", adult: "false" });
  const url = new URL(requests[0].url);
  assert.deepEqual(url.searchParams.getAll("type"), ["manhwa"]);
  assert.deepEqual(url.searchParams.getAll("demografy"), ["seinen"]);
  assert.deepEqual(url.searchParams.getAll("status"), ["hiatus"]);
  assert.equal(url.searchParams.get("adult"), "false");
  assert.equal(url.searchParams.get("sort"), "oldest");
  assert.equal(url.searchParams.get("page"), "2");

  const genre = await module.search("", 1, { genre: "comedia" });
  assert.equal(requests.at(-1).url, "https://mangation.com/genre/comedia/__data.json?page=1");
  assert.deepEqual(genre.items.map((i) => i.id), ["serie-demo-uno", "serie-demo-dos"]);
  assert.equal(genre.hasNext, true);
  const noAdult = await module.search("", 1, { genre: "comedia", adult: "false" });
  assert.deepEqual(noAdult.items.map((i) => i.id), ["serie-demo-uno"]);
});

test("mangation: search con texto es híbrido cuando la API llega al tope", async () => {
  const requests = [];
  const module = create(makeHost(site, requests));
  const short = await module.search("  uno ", 1);
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url).searchParams.get("q"), "uno");
  assert.deepEqual(short.items.map((i) => i.id), ["serie-demo-uno"]);

  requests.length = 0;
  const full = await module.search("DÉMO", 1);
  assert.equal(new URL(requests[0].url).searchParams.get("q"), "DÉMO");
  assert.equal(requests.length, 3); // API + 2 páginas de library
  assert.deepEqual(full.items.map((i) => i.id), [
    "serie-demo-uno", "serie-demo-dos", "demo-tres", "demo-cuatro", "demo-escondida",
  ]);
  assert.equal(full.hasNext, false);

  const filtered = await module.search("demo", 1, { adult: "false", type: "manga" });
  assert.deepEqual(filtered.items.map((i) => i.id), ["serie-demo-uno", "demo-tres"]);

  requests.length = 0;
  assert.deepEqual(await module.search("a", 1), { items: [], hasNext: false });
  assert.deepEqual(await module.search("demo", 2), { items: [], hasNext: false });
  assert.equal(requests.length, 0);
});

test("mangation: home, list y filters", async () => {
  const module = create(makeHost(site));
  const { sections } = await module.home();
  assert.deepEqual(sections.map((s) => [s.id, s.kind, s.items.length]), [["popular", "list", 2], ["latest", "list", 2]]);
  assert.equal((await module.list("latest", 2)).items[0].id, "demo-escondida");
  assert.deepEqual(await module.list("nada", 1), { items: [], hasNext: false });
  const filters = await module.filters();
  assert.deepEqual(filters.map((f) => [f.id, f.type]), [
    ["type", "multi"], ["demografy", "multi"], ["status", "multi"], ["order", "select"], ["genre", "select"], ["adult", "select"],
  ]);
  assert.ok(!filters[0].options.some((o) => o.value === "novela"));
  assert.deepEqual(filters[4].options, [{ value: "comedia", label: "Comedia" }, { value: "ciencia-ficcion", label: "Ciencia ficción" }]);
  assert.equal(filters[5].options[0].value, "true");
});

test("mangation: details junta la ficha y las páginas de capítulos", async () => {
  const requests = [];
  const series = await create(makeHost(site, requests)).details("serie-demo-uno");
  assert.deepEqual(requests.map((r) => r.url), [
    "https://mangation.com/manga/serie-demo-uno/__data.json",
    "https://api.mangation.com/api/public/mangas/serie-demo-uno/chapters?page=2&order=asc",
  ]);
  assert.equal(series.id, "serie-demo-uno");
  assert.equal(series.description, "Sinopsis inventada.");
  assert.deepEqual(series.genres, ["Comedia"]);
  assert.equal(series.status, "ongoing");
  assert.deepEqual(series.extra, { Tipo: "Manga", Demografía: "Shōnen", Estado: "En curso", "Subido por": "Subidor Demo" });
  assert.equal(series.chapters.length, 12);
  assert.deepEqual(series.chapters[0], {
    id: "serie-demo-uno/11.5", title: "Extra", number: 11.5, releases: [{ id: "serie-demo-uno/11.5" }],
  });
  // El título es el del sitio; la app antepone «Capítulo N» (y no lo repite si el sitio ya lo trae).
  assert.equal(series.chapters.at(-1).title, "Comienzo");
  assert.equal(series.chapters.at(-2).title, "Capítulo 2");
});

test("mangation: details y pages tipan errores", async () => {
  const module = create(makeHost(site));
  await rejectsWith(module.details("no-existe"), "NOT_FOUND");
  await rejectsWith(module.details("../x"), "NOT_FOUND");
  await rejectsWith(module.pages("serie-demo-uno/999"), "NOT_FOUND");
  await rejectsWith(module.pages("serie-demo-uno"), "NOT_FOUND");
  await rejectsWith(create(makeHost(() => [403, "api-404.json"])).latest(1), "BLOCKED");
  await rejectsWith(create(makeHost(() => [429, "api-404.json"])).details("serie-demo-uno"), "RATE_LIMITED");
});

test("mangation: pages ordena las imágenes del CDN", async () => {
  const requests = [];
  const { images } = await create(makeHost(site, requests)).pages("serie-demo-uno/1");
  assert.equal(requests[0].url, "https://mangation.com/manga/serie-demo-uno/chapter/1/__data.json");
  assert.deepEqual(images.map((i) => i.url), [
    "https://media.mangation.com/content/demoA/chapters/001/001.jpg",
    "https://media.mangation.com/content/demoA/chapters/001/002.jpg",
  ]);
  assert.equal(images[0].headers.Referer, "https://mangation.com/");
});
