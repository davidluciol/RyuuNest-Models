// Prueba sin red (fixtures inventadas): node --test luscious/bin/luscious.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import create from "../module.js";

// Validador de forma de la app (SPEC §6.2): el mismo que aplica RyuuNest al recibir cada método.
const { detailsShapeViolation, homeShapeViolation, pageShapeViolation, pagesShapeViolation } = await import(
  pathToFileURL(`${process.env.RYUUNEST_REPO}/packages/core/dist/runtimes/contractShape.js`).href
);

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const reply = (status, text) => ({ status, text: async () => text });

/** `routes(op, variables)` devuelve la respuesta; registra cada petición decodificada. */
function makeHost(routes, requests = []) {
  return {
    fetch: async (url, init = {}) => {
      const params = new URL(url).searchParams;
      const call = { url, headers: init.headers, op: params.get("operationName"), variables: JSON.parse(params.get("variables")) };
      requests.push(call);
      return routes(call.op, call.variables);
    },
  };
}

const lists = (requests) => makeHost(() => reply(200, fixture("list.json")), requests);

test("luscious: latest arma la consulta GraphQL y las tarjetas", async () => {
  const requests = [];
  const page = await create(lists(requests)).latest(2);
  const { items, hasNext } = page;
  assert.equal(pageShapeViolation(page), undefined);
  const [call] = requests;
  assert.ok(call.url.startsWith("https://www.luscious.net/graphql/nobatch/?operationName=AlbumList&query="));
  assert.deepEqual(call.variables, {
    input: {
      display: "date_newest",
      filters: [{ name: "album_type", value: "manga" }, { name: "language_ids", value: "+3" }],
      page: 2,
    },
  });
  assert.equal(call.headers.Accept, "application/json");
  assert.equal(hasNext, true);
  assert.deepEqual(items[0], {
    id: "900001",
    title: "Serie Inventada Uno",
    cover: { url: "https://ah-img.luscious.net/demo/900001/cover.315x0.jpg", headers: items[0].cover.headers },
    kind: "manga",
    nsfw: true,
    badges: ["Español", "Manga"],
    hint: "autora_demo",
  });
  assert.equal(items[1].title, "#900002");
  assert.equal(items[1].cover, undefined);
  assert.deepEqual(items[1].badges, ["English", "Imágenes"]);
});

test("luscious: popular, búsqueda con texto y con filtros", async () => {
  const requests = [];
  const module = create(lists(requests));
  await module.popular(0);
  await module.search("  maid ", 1);
  await module.search("", 3, { language: "all", type: "pictures", genre: "24", order: "rating_all_time" });
  await module.search("x", 1, { language: "zz", type: "zz", genre: "zz", order: "zz" });
  const inputs = requests.map((r) => r.variables.input);
  assert.equal(inputs[0].display, "date_trending");
  assert.equal(inputs[0].page, 1);
  assert.equal(inputs[1].display, "search_score");
  assert.deepEqual(inputs[1].filters.at(-1), { name: "search_query", value: "maid" });
  assert.deepEqual(inputs[2], {
    display: "rating_all_time",
    filters: [{ name: "album_type", value: "pictures" }, { name: "genre_ids", value: "+24" }],
    page: 3,
  });
  // Valores desconocidos vuelven a los de por defecto.
  assert.deepEqual(inputs[3].filters.slice(0, 2), [
    { name: "album_type", value: "manga" },
    { name: "language_ids", value: "+3" },
  ]);
});

test("luscious: home, list y filters", async () => {
  const requests = [];
  const module = create(lists(requests));
  const home = await module.home();
  const { sections } = home;
  assert.equal(homeShapeViolation(home), undefined);
  assert.deepEqual(sections.map((s) => s.id), ["date_trending", "date_newest", "rating_all_time"]);
  assert.equal(sections[0].items.length, 2);
  await module.list("date_last_interaction", 2);
  assert.equal(requests.at(-1).variables.input.display, "date_last_interaction");
  const filters = await module.filters();
  assert.deepEqual(filters.map((f) => f.id), ["language", "type", "order", "genre"]);
  assert.equal(filters[0].options[0].value, "3");
});

test("luscious: details lee el álbum y arma un capítulo", async () => {
  const requests = [];
  const detail = await create(makeHost(() => reply(200, fixture("album.json")), requests)).details("900001");
  assert.equal(detailsShapeViolation(detail), undefined);
  assert.deepEqual(detail.altTitles, []);
  assert.deepEqual(requests[0].variables, { id: "900001" });
  assert.equal(detail.description, "Una historia de prueba.");
  assert.deepEqual(detail.genres, ["Fetish", "etiqueta demo"]);
  assert.deepEqual(detail.extra, {
    Idioma: "Spanish / Español",
    Artistas: "autora_demo",
    Series: "obra_demo",
    Personajes: "personaje_demo",
    Traductores: "traductor_demo",
    Tipo: "Manga",
    Páginas: "3",
  });
  assert.equal(detail.status, "completed");
  assert.deepEqual(detail.chapters, [
    { id: "900001", title: "Serie Inventada Uno", number: 1, releases: [{ id: "900001", publishedAt: "2025-11-13T02:13:20.500Z" }] },
  ]);
});

test("luscious: details de álbum borrado o id inválido → NOT_FOUND", async () => {
  const module = create(makeHost(() => reply(200, fixture("album-404.json"))));
  await assert.rejects(module.details("123"), { name: "ModuleError", code: "NOT_FOUND", message: "This album has been deleted." });
  await assert.rejects(module.details("../x"), { code: "NOT_FOUND" });
});

test("luscious: pages pagina, ordena por posición y elige la imagen más ancha", async () => {
  const requests = [];
  const host = makeHost((op, v) => reply(200, fixture(`pictures-${v.input.page}.json`)), requests);
  const chapter = await create(host).pages("900001");
  const { images } = chapter;
  assert.equal(pagesShapeViolation(chapter), undefined);
  assert.deepEqual(requests.map((r) => r.variables.input), [1, 2].map((page) => ({
    filters: [{ name: "album_id", value: "900001" }],
    display: "date_newest",
    page,
  })));
  assert.deepEqual(images.map((i) => i.url), [
    "https://ah-img.luscious.net/demo/900001/1.1680x0.jpg",
    "https://cdn3.luscious.net/demo/900001/2.640x0.avif",
    "https://cdn3.luscious.net/demo/900001/3.1280x0.avif",
  ]);
  assert.equal(images[0].headers.Referer, "https://www.luscious.net/");
});

test("luscious: errores tipados (Cloudflare, 429, JSON roto, error GraphQL)", async () => {
  const cases = [
    [reply(403, fixture("challenge.html")), "BLOCKED"],
    [reply(429, "{}"), "RATE_LIMITED"],
    [reply(200, "<html>no json</html>"), "PARSE"],
    [reply(400, '{"errors":[{"message":"bad"}]}'), "PARSE"],
    [reply(502, "bad gateway"), "NETWORK"],
    [reply(200, '{"errors":[{"message":"bad"}],"data":null}'), "PARSE"],
  ];
  for (const [response, code] of cases) {
    await assert.rejects(create(makeHost(() => response)).latest(1), { name: "ModuleError", code });
  }
});
