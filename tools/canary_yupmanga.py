"""Canario del reto del lector de YupManga: ¿el módulo sigue resolviendo lo que el sitio genera?

Uso: uv run --project tools --locked python tools/canary_yupmanga.py [--series ID] [--n 10] [--pause 1.5] [--keep DIR]
Por intento: ficha → get_challenge → solveChallenge (intérprete cerrado) → open_chapter. El servidor es el oráculo:
respuesta correcta = `chapter_id` real (el `chapter=` del og:image de la ficha); incorrecta = id señuelo.
Sale con 0 si todos aciertan, 1 si alguno falla (guarda reto y ficha en --keep para ampliar miniJs.js/boxStyle.js).
Cloudflare corta tras ~35 peticiones seguidas: no pases --n mayor de ~10 y deja pausa.
"""
import argparse
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from curl_cffi import requests as cr  # noqa: E402
from fetch import resolve_opts  # noqa: E402

BASE = "https://www.yupmanga.com"
ROOT = Path(__file__).resolve().parent.parent


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--series")
    p.add_argument("--n", type=int, default=10)
    p.add_argument("--pause", type=float, default=1.5)
    p.add_argument("--keep", type=Path, default=ROOT / ".scrape-tmp" / "yupmanga" / "canary")
    a = p.parse_args()
    a.keep.mkdir(parents=True, exist_ok=True)

    def session():
        return cr.Session(impersonate="chrome", curl_options=resolve_opts(BASE + "/"), timeout=60)

    s = session()
    series = a.series
    if not series:
        top = s.get(f"{BASE}/top").text
        series = re.search(r"/series\.php\?id=([A-Z0-9]+)", top).group(1)

    ok = 0
    for i in range(1, a.n + 1):
        s = session()
        page = s.get(f"{BASE}/series.php?id={series}")
        if page.status_code != 200:
            print(f"{i}: ficha {page.status_code} (¿Cloudflare? espera y reintenta)")
            return 2
        real = re.search(r"og:image[^>]*chapter=([0-9A-Z]+)", page.text).group(1)
        csrf = re.search(r'id="csrf_token"[^>]*value="([^"]+)"', page.text) or re.search(r'value="([^"]+)"[^>]*id="csrf_token"', page.text)
        h = {"X-CSRF-Token": csrf.group(1), "X-Requested-With": "XMLHttpRequest", "Referer": f"{BASE}/series.php?id={series}", "Origin": BASE}
        key = re.search(r'data-chapter-key=.{1,2}?([0-9][0-9.]*)', s.get(f"{BASE}/ajax/load_chapters.php?series_id={series}&page=1&order=asc", headers=h).text).group(1)
        ch = s.post(f"{BASE}/ajax/get_challenge.php", data={"chapter_key": key, "s": series}, headers=h).json()
        with tempfile.TemporaryDirectory() as tmp:
            js, html = Path(tmp, "c.js"), Path(tmp, "s.html")
            js.write_text(ch["challenge_js"], encoding="utf8")
            html.write_bytes(page.content)
            run = subprocess.run(["node", str(ROOT / "tools" / "solve-yupmanga.mjs"), str(js), str(html)], capture_output=True, text=True)
            answer = run.stdout.strip()
            opened = s.post(f"{BASE}/ajax/open_chapter.php", data={"chapter_key": key, "s": series, "challenge_id": ch["challenge_id"], "answer": answer or "0"}, headers=h).json() if answer else {}
            good = opened.get("chapter_id") == real
            ok += good
            print(f"{i}: {'OK ' if good else 'FALLO'} respuesta={answer or '-'} {run.stderr.strip()[:140]}")
            if not good:
                d = a.keep / f"fallo-{int(time.time())}-{i}"
                d.mkdir(exist_ok=True)
                (d / "challenge.js").write_text(ch["challenge_js"], encoding="utf8")
                (d / "ficha.html").write_bytes(page.content)
                print(f"   guardado en {d} (datos no confiables: sanitiza antes de leer)")
        time.sleep(a.pause)
    print(f"{ok}/{a.n} aceptados")
    return 0 if ok == a.n else 1


if __name__ == "__main__":
    sys.exit(main())
