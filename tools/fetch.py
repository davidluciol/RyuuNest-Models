"""Descarga una URL autorizada con huella TLS de navegador (curl_cffi) y guarda el cuerpo crudo.

Uso: uv run --project tools --locked python tools/fetch.py URL SALIDA [--method POST] [--data k=v&k2=v2] [--header 'K: V']
Imprime estado, tamaño y tipo. El cuerpo es dato NO confiable: pásalo por tools/sanitize.mjs antes de leerlo.
"""
import argparse
import socket
from urllib.parse import urlparse

from curl_cffi import requests as cr


def resolve_opts(url):
    """curl_cffi usa su propio DNS y falla en algunas redes; resolvemos con el sistema y fijamos la IP."""
    u = urlparse(url)
    port = u.port or (443 if u.scheme == "https" else 80)
    try:
        ip = socket.getaddrinfo(u.hostname, port)[0][4][0]
    except OSError:
        return {}
    return {10203: [f"{u.hostname}:{port}:{ip}"]}  # CURLOPT_RESOLVE


def request(method, url, headers=None, data=None, **kw):
    return cr.request(method, url, headers=headers, data=data, impersonate="chrome", timeout=60,
                      allow_redirects=False, curl_options=resolve_opts(url), **kw)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("url")
    p.add_argument("out")
    p.add_argument("--method", default="GET")
    p.add_argument("--data")
    p.add_argument("--header", action="append", default=[])
    a = p.parse_args()
    headers = dict(h.split(": ", 1) for h in a.header)
    r = request(a.method, a.url, headers, a.data)
    open(a.out, "wb").write(r.content)
    print(r.status_code, len(r.content), r.headers.get("content-type"), r.headers.get("location", ""))


if __name__ == "__main__":
    main()
