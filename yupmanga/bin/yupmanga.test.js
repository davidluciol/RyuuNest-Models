// Prueba sin red. Necesita el parser del repo principal: RYUUNEST_REPO=<ruta al clon> node --test bin/yupmanga.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import create from "../module.js";
import { solveChallenge } from "./utils/challenge.js";
import { runScript } from "./utils/miniJs.js";
import { createBox } from "./utils/boxStyle.js";

const repo = process.env.RYUUNEST_REPO;
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/** Respuesta esperada del reto inventado, calculada a mano e independiente del intérprete. */
function expectedAnswer() {
  const hex = "802"; // hijos ordenados por `order`: 2 → 9-1, 7 → 20-4 (&15 = 0), 9!important → 3-1
  const w = [1200, 3400, 560];
  let u = 0x1234abcd;
  for (let m = 0; m < w.length; m += 1) u = ((u ^ w[m]) + m * 77) >>> 0;
  u = (u & 3) === 0 ? Math.imul(u, 31) >>> 0 : (u + "a".charCodeAt(0)) >>> 0;
  u = (u ^ w[0]) >>> 0;
  const stat = String(u);
  let total = 0;
  for (const ch of hex) total = (total * 31 + ch.charCodeAt(0)) & 0xffffff;
  for (let i = 0; i < stat.length; i += 1) total = (total ^ stat.charCodeAt(i)) + i;
  return String(total);
}

function makeHost(requests, { badAnswers = false } = {}) {
  const require = createRequire(`${repo}/packages/core/package.json`);
  const { parseDocument } = require("htmlparser2");
  const { selectAll } = require("css-select");
  const json = (data) => ({ status: 200, headers: {}, text: async () => JSON.stringify(data) });
  const page = (name) => ({ status: 200, headers: { "set-cookie": "ym_device=abc; Path=/" }, text: async () => fixture(name) });
  return {
    html: (text) => {
      const root = parseDocument(text);
      const textOf = (n) => (n.type === "text" ? n.data : (n.children ?? []).map(textOf).join(""));
      const view = (node) => ({
        attr: (name) => node.attribs?.[name],
        text: () => textOf(node),
        select: (selector) => selectAll(selector, node).map(view),
      });
      return view(root);
    },
    fetch: async (url, init = {}) => {
      requests.push({ url, ...init });
      if (url.includes("/ajax/get_challenge.php")) {
        return json({ success: true, challenge_id: "cid", challenge_js: fixture("challenge.js.txt") });
      }
      if (url.includes("/ajax/open_chapter.php")) {
        const answer = new URLSearchParams(init.body).get("answer");
        return json(
          !badAnswers && answer === expectedAnswer()
            ? { success: true, token: "tokenfalso", chapter_id: "CAPFALSO01" }
            : { success: true, token: "tokeninservible" },
        );
      }
      if (url.includes("/ajax/complete_ad_interstitial.php")) return json({ success: true });
      if (url.includes("/ajax/load_chapters.php")) return { status: 200, headers: {}, text: async () => fixture("chapters.json") };
      if (url.includes("/ajax/load_similar_series.php")) return json({ series_data: [] });
      if (url.includes("/box-modal.php")) return page("interstitial.html");
      if (url.includes("/reader_v2.php")) return page("reader.html");
      if (url.includes("/series.php")) return page("series.html");
      return page("home.html");
    },
  };
}

test("el intérprete resuelve el reto y respeta !important, especificidad y declaraciones repetidas", () => {
  assert.equal(solveChallenge(fixture("challenge.js.txt"), fixture("series.html")), expectedAnswer());
});

test("el intérprete resuelve el reto con plantillas, const/let, desestructuración, for…of y flechas", () => {
  let q = (305419896 ^ (305419896 << 8)) >>> 0;
  q = (q + 15) >>> 0;
  for (const e of [1200, 3400, 560]) q = (Math.imul(q, 31) + e) >>> 0;
  const stat = String((q ^ 5) >>> 0);
  let total = 0;
  for (const ch of "802") total = (total * 31 + ch.charCodeAt(0)) & 0xffffff;
  for (let i = 0; i < stat.length; i += 1) total = (total ^ stat.charCodeAt(i)) + i;
  assert.equal(solveChallenge(fixture("challenge2.js.txt"), fixture("series.html")), String(total));
});

test("el intérprete aplica la función de Array.from y los generadores, clases y try/finally", () => {
  assert.equal(runScript("var t=0;Array.from('abc',function(c,i){t+=c.charCodeAt(0)*(i+1);});return t+'';"), String(97 + 98 * 2 + 99 * 3));
  assert.equal(
    runScript("function*g(){yield 1;yield 2;}var s=0;for(const v of g())s+=v;class A{constructor(x){this.v=x;}m(){this.v+=s;return this;}}try{s+=1;}finally{}return new A(10).m().v+'';"),
    "14",
  );
});

test("la cascada CSS del nodo oculto resuelve selectores, var(), flex, !important y escapes", () => {
  const html = String.raw`<style>#zz[hidden]{--v:7}#zz>.a{order:var(--v);flex:3 2}[id="zz"] .\62 c:not(.x){order:9!important;order:/*}*/4}#zz .a:nth-child(1){flex-grow:11}#zz .d{order:var(--nada)}</style>
<div id="zz" hidden><!--</div>--><i class="a"></i><b class="bc" style="order:1"></b><em class="d"></em><u class="e" style="flex-shrink:5"></u></div>`;
  const box = createBox(html, "zz");
  const got = box.children.map((c) => ["order", "flex-grow", "flex-shrink"].map((p) => box.compute(c, p)).join("/"));
  // a: order var=7, grow 11 (nth-child más específico), shrink 2 · bc: !important 9 gana al en línea · d: var sin valor → inicial · e: en línea
  assert.deepEqual(got, ["7/11/2", "9/0/1", "0/0/1", "0/0/5"]);
  assert.equal(createBox(html, "nope"), null);
});

test("el intérprete no alcanza nada fuera de su sandbox y corta los bucles infinitos", () => {
  assert.throws(() => runScript("return globalThis;"), { code: "UNSUPPORTED" });
  assert.throws(() => runScript('return [].constructor("return 1")();'), { code: "UNSUPPORTED" });
  assert.throws(() => runScript("while(true){}", {}, 10_000), { code: "UNSUPPORTED" });
  assert.equal(runScript("var a=[3,1,2];a.sort(function(x,y){return x-y;});return a.join('');"), "123");
});

test("yupmanga: listas con portada con cabeceras y cookie de la sesión", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(requests));
  const { items } = await mod.latest(1);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "/series.php?id=SERIEFALSA1");
  assert.equal(items[0].kind, "manhwa");
  assert.equal(
    items[0].cover.url,
    "https://www.yupmanga.com/image-proxy-v2.php?chapter=FAKECOVER0001&page=1&context=cover",
  );
  assert.equal(items[0].cover.headers.Cookie, "ym_device=abc");
  assert.ok(items[0].cover.headers.Accept.includes("image/webp"));
  await mod.latest(2);
  assert.ok(requests.some((r) => r.url === "https://www.yupmanga.com/?page=2"));
  assert.deepEqual(await mod.popular(2), { items: [], hasNext: false });
});

test("yupmanga: home, ver más y género con filtro (sin texto) o búsqueda por título", { skip: !repo }, async () => {
  const requests = [];
  const mod = create(makeHost(requests));
  const { sections } = await mod.home();
  assert.deepEqual(sections.map((section) => section.id), ["popular", "latest"]);
  assert.equal(sections[1].items.length, 2);
  assert.deepEqual(await mod.list("nope", 1), { items: [], hasNext: false });
  assert.equal((await mod.filters())[0].id, "genre");
  assert.equal((await mod.search("", 2, { genre: "ciencia+ficción" })).items.length, 2);
  assert.ok(requests.some((r) => r.url === "https://www.yupmanga.com/genero/ciencia+ficci%C3%B3n?page=2"));
  assert.deepEqual(await mod.search("", 1, { genre: "../admin" }), { items: [], hasNext: false });
});

test("yupmanga: la ficha guarda el lector propio de cada capítulo", { skip: !repo }, async () => {
  const mod = create(makeHost([]));
  const info = await mod.details("/series.php?id=SER1");
  const releases = Object.fromEntries(info.chapters.map((c) => [c.title, c.releases[0].id]));
  assert.equal(releases["Tomo - 01"], "/series.php?id=SER1&chapter=1.00&reader=box-modal.php");
  assert.equal(releases["Tomo - 02"], "/series.php?id=SER1&chapter=2.00");
});

test("yupmanga: pages resuelve el reto, espera la puerta y lee el mapa de páginas", { skip: !repo }, async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback) => {
    callback();
    return 0;
  });
  const requests = [];
  const mod = create(makeHost(requests));
  const result = await mod.pages("Tomo - 01", "/series.php?id=SER1&chapter=1.00&reader=box-modal.php");
  assert.equal(result.title, "Tomo - 01");
  assert.deepEqual(
    result.images.map((i) => i.url),
    [
      "https://www.yupmanga.com/image-proxy-v2.php?k=clave-uno",
      "https://www.yupmanga.com/image-proxy-v2.php?k=clave-dos",
    ],
  );
  assert.ok(requests.some((r) => r.url.includes("/box-modal.php?chapter=CAPFALSO01&token=tokenfalso")));
  assert.ok(requests.every((r) => !r.url.includes("get_anchor")));
});

test("yupmanga: si el sitio no acepta la respuesta del reto da BLOCKED, no páginas vacías", { skip: !repo }, async () => {
  const mod = create(makeHost([], { badAnswers: true }));
  await assert.rejects(mod.pages("x", "/series.php?id=SER1&chapter=1.00"), { code: "BLOCKED" });
});
