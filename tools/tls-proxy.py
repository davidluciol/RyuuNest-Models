# Proxy local de ANÁLISIS (solo 127.0.0.1): reenvía con la huella TLS de un navegador (curl_cffi).
# Sirve para probar un módulo contra el sitio real desde Node, que Cloudflare rechaza con 403.
# Uso: python tools/tls-proxy.py https://www.sitio.com/   (cabecera X-Target-Url en cada petición)
# No entra en ningún .zip: el módulo publicado solo usa host.fetch.
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from curl_cffi import requests as cr
ALLOWED = tuple(sys.argv[1:]) or sys.exit("indica al menos un origen permitido, p. ej. https://www.sitio.com/")
class H(BaseHTTPRequestHandler):
    def _go(self):
        url = self.headers["X-Target-Url"]
        if not url.startswith(ALLOWED): self.send_error(403); return
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else None
        hdr = {k: v for k, v in self.headers.items() if k.lower() not in ("host","x-target-url","content-length","connection","accept-encoding","x-method")}
        r = cr.request(self.headers.get("X-Method","GET"), url, headers=hdr, data=body, impersonate="chrome", allow_redirects=False, timeout=60)
        self.send_response(200)
        self.send_header("X-Status", str(r.status_code))
        self.send_header("X-Set-Cookie", ", ".join(r.headers.get_list("set-cookie")))
        self.send_header("X-Location", r.headers.get("location",""))
        self.send_header("X-Ctype", r.headers.get("content-type",""))
        self.send_header("Content-Length", str(len(r.content)))
        self.end_headers(); self.wfile.write(r.content)
    do_GET = do_POST = _go
    def log_message(self,*a): pass
ThreadingHTTPServer(("127.0.0.1", 8799), H).serve_forever()
