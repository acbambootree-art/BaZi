# Tiny local upload sink: the temple page's __temple.exportBake() POSTs its GLB here for Blender.
#   python3 receiver.py <outdir>      (listens on 127.0.0.1:8817)
import http.server, sys, os, urllib.parse
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:3000')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = os.path.basename(q.get('name', ['upload.bin'])[0])
        n = int(self.headers['Content-Length'])
        buf = bytearray()
        while len(buf) < n:                      # big bodies arrive in pieces
            chunk = self.rfile.read(min(1 << 20, n - len(buf)))
            if not chunk: break
            buf += chunk
        if len(buf) != n:
            self.send_response(400); self.cors(); self.end_headers(); print('short upload', len(buf), n, flush=True); return
        with open(os.path.join(OUT, name), 'wb') as f: f.write(buf)
        self.send_response(200); self.cors(); self.end_headers(); self.wfile.write(b'ok')
        print('saved', name, n, flush=True)

http.server.HTTPServer(('127.0.0.1', 8817), H).serve_forever()
