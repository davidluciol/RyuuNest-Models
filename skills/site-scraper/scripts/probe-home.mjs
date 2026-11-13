#!/usr/bin/env node
// probe-home.mjs — Fase 1 de site-scraper: comprobar el acceso al home SIN navegador.
//
// Uso:
//   node probe-home.mjs <url> [--save ruta/home.html] [--timeout 15000] [--ua "..."]
//
// Salida: un JSON por stdout con access, risk, señales y una recomendación.
// Solo lee (GET). No ejecuta el JavaScript del sitio ni sigue enlaces.
// Requiere Node 18+ (usa fetch global). Sin dependencias.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// ---------- argumentos ----------
const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
  console.error('Uso: node probe-home.mjs <url> [--save ruta/home.html] [--timeout 15000] [--ua "..."]');
  process.exit(argv.length === 0 ? 2 : 0);
}
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flagsWithValue = new Set(['--save', '--timeout', '--ua']);
const url = argv.find((a, i) => !a.startsWith('--') && !flagsWithValue.has(argv[i - 1]));
if (!url || !/^https?:\/\//i.test(url)) {
  console.error('Falta una URL válida que empiece con http:// o https://');
  process.exit(2);
}
const savePath = opt('--save', null);
const timeoutMs = Number(opt('--timeout', '15000'));
// Un User-Agent viejo es una señal de bot; actualiza esta versión de vez en cuando.
const ua = opt(
  '--ua',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
);

const headers = {
  'User-Agent': ua,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Upgrade-Insecure-Requests': '1',
};

// ---------- listas de señales ----------
const AD_NETWORKS = [
  'adsterra', 'popads', 'propeller', 'exoclick', 'juicyads', 'trafficjunky', 'clickadu',
  'hilltopads', 'popcash', 'adcash', 'onclickads', 'profitableratecpm', 'highperformanceformat',
  'effectivegatecpm', 'richads', 'monetag', 'galaksion', 'adskeeper', 'mgid', 'revcontent',
  'taboola', 'outbrain', 'a-ads', 'adnxs',
];
const BENIGN_HOSTS = [
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'code.jquery.com',
  'ajax.googleapis.com', 'fonts.googleapis.com', 'fonts.gstatic.com',
];
const INJECTION_PATTERNS = [
  /ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?)/i,
  /disregard (all |any )?(the )?(previous|prior|above)/i,
  /you are (now )?an? (ai|assistant|language model|llm)\b/i,
  /\b(system prompt|developer message)\b/i,
  /(as|dear) an? (ai|llm|assistant|agent)\b.{0,60}\b(must|should|need to)\b/i,
  /<\/?(system|instructions?)>/i,
  /\bignora (todas )?las instrucciones (anteriores|previas)\b/i,
];

// ---------- utilidades ----------
const rootOf = (host) => host.replace(/^www\./, '').split('.').slice(-2).join('.');
const stripTags = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\s+/g, ' ')
    .trim();
const snippet = (text, index, len = 120) =>
  text.slice(Math.max(0, index - 20), index + len).replace(/\s+/g, ' ').trim();

// ---------- petición (redirects manuales para registrar la cadena) ----------
async function get(startUrl) {
  const chain = [];
  let current = startUrl;
  for (let hop = 0; hop < 6; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(current, { headers, redirect: 'manual', signal: ctrl.signal }).finally(() =>
      clearTimeout(timer)
    );
    chain.push({ url: current, status: res.status });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    const body = await res.text();
    return { res, body, chain, finalUrl: current };
  }
  throw new Error('Demasiadas redirecciones (más de 5)');
}

// ---------- análisis ----------
function analyze({ res, body, chain, finalUrl }) {
  const status = res.status;
  const h = (n) => (res.headers.get(n) || '').toLowerCase();
  const cookies = (res.headers.getSetCookie?.() || []).map((c) => c.split('=')[0]);
  const server = h('server');
  const finalHost = new URL(finalUrl).hostname;
  const origHost = new URL(chain[0].url).hostname;

  // Cloudflare / otras protecciones
  const cfHeaders = server.includes('cloudflare') || !!h('cf-ray') || !!h('cf-mitigated');
  const cfChallengeBody =
    /Just a moment\.\.\./i.test(body) ||
    /cf-chl|__cf_chl|challenge-platform|cf_chl_opt/i.test(body) ||
    /Checking your browser/i.test(body) ||
    /Attention Required! \| Cloudflare/i.test(body) ||
    /Enable JavaScript and cookies to continue/i.test(body);
  const ddosGuard = server.includes('ddos-guard') || /ddos-guard/i.test(body);
  const captcha = /g-recaptcha|h-captcha|hcaptcha\.com|cf-turnstile|data-sitekey/i.test(body);
  const challenge = (h('cf-mitigated') === 'challenge') || cfChallengeBody || (ddosGuard && status >= 400);

  // Contenido útil
  const visible = stripTags(body);
  const anchors = (body.match(/<a\s/gi) || []).length;
  const noscriptJs = /<noscript[^>]*>[\s\S]*?(enable javascript|requires javascript)[\s\S]*?<\/noscript>/i.test(body);
  const spaShell = /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(body);
  const jsRequired = status === 200 && !challenge && visible.length < 400 && (spaShell || noscriptJs);

  // Adware / popups
  const extHosts = new Set();
  for (const m of body.matchAll(/<(?:script|iframe)[^>]*\ssrc=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], finalUrl);
      if (u.hostname && rootOf(u.hostname) !== rootOf(finalHost) && rootOf(u.hostname) !== rootOf(origHost)) {
        extHosts.add(u.hostname);
      }
    } catch { /* src inválido: ignorar */ }
  }
  const lowerBody = body.toLowerCase();
  const adNetworksFound = AD_NETWORKS.filter((n) => lowerBody.includes(n));
  const popupCalls = (body.match(/window\.open\s*\(/g) || []).length + (body.match(/pop-?under/gi) || []).length;
  const unknownExternalHosts = [...extHosts].filter((x) => !BENIGN_HOSTS.includes(x));

  // Posible inyección de prompts (en texto, comentarios, atributos)
  const injectionSignals = [];
  for (const re of INJECTION_PATTERNS) {
    const m = re.exec(body);
    if (m) injectionSignals.push({ pattern: re.source.slice(0, 40), snippet: snippet(body, m.index) });
  }

  // Veredicto de acceso
  let access;
  if (challenge) access = 'challenge';
  else if ([401, 403, 429, 451].includes(status)) access = 'blocked';
  else if (status >= 500) access = 'error';
  else if (jsRequired) access = 'js-required';
  else if (status === 200 && visible.length >= 200) access = 'ok';
  else access = 'error';

  // Riesgo
  const adScore = adNetworksFound.length * 2 + Math.min(popupCalls, 3) + Math.min(unknownExternalHosts.length, 4);
  let risk = adScore >= 6 ? 'high' : adScore >= 2 ? 'medium' : 'low';
  if (injectionSignals.length > 0) risk = 'high';

  const recommendations = {
    ok: risk === 'high'
      ? 'Acceso OK pero riesgo ALTO: no abras navegador. Trabaja solo con el HTML guardado y extracción dirigida, y avisa al humano.'
      : 'Acceso OK con HTTP simple. Sigue con la Fase 2 (análisis del home) usando el HTML guardado.',
    challenge: 'Hay un desafío anti-bot. Busca alternativas (espejo, API/JSON, sitemap, versión móvil). Si no hay, marca el sitio como blocked-antibot y deja de insistir.',
    blocked: 'El servidor rechaza la petición (401/403/429/451). Prueba alternativas legítimas (espejo, API pública) y, si no funciona, marca blocked-antibot.',
    'js-required': 'El HTML llega casi vacío: el contenido lo genera JavaScript. Busca primero un endpoint JSON; si no existe, pasa al Nivel 2 (navegador) solo si el riesgo no es alto.',
    error: 'Respuesta inesperada o error de red. Reintenta una vez; si persiste, repórtalo al humano.',
  };

  return {
    url: chain[0].url,
    finalUrl,
    redirects: chain,
    status,
    access,
    risk,
    protection: {
      cloudflarePresent: cfHeaders,
      cloudflareChallenge: cfChallengeBody || h('cf-mitigated') === 'challenge',
      ddosGuard,
      captcha,
      server: server || null,
      protectionCookies: cookies.filter((c) => /^(cf_|__cf|__ddg|ddg|sucuri|_sucuri)/i.test(c)),
    },
    content: { htmlBytes: Buffer.byteLength(body), visibleTextChars: visible.length, anchors, spaShell },
    safety: {
      adNetworks: adNetworksFound,
      popupCalls,
      unknownExternalHosts: unknownExternalHosts.slice(0, 15),
      injectionSignals,
    },
    recommendation: recommendations[access],
  };
}

// ---------- ejecución ----------
try {
  const result = await get(url);
  const report = analyze(result);
  if (savePath && report.access === 'ok') {
    await mkdir(dirname(savePath), { recursive: true });
    await writeFile(savePath, result.body, 'utf8');
    report.savedTo = savePath;
  } else if (savePath) {
    report.savedTo = null; // no se guarda HTML de desafíos ni errores
  }
  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  console.log(
    JSON.stringify(
      {
        url,
        access: 'error',
        risk: 'unknown',
        error: String(err && err.message ? err.message : err),
        recommendation: 'No se pudo conectar (DNS, timeout o red). Reintenta una vez; si persiste, repórtalo al humano.',
      },
      null,
      2
    )
  );
}
