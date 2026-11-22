import base64, http.server, pathlib

OUT = pathlib.Path(r'C:/Users/26646/Documents/Qoder/2026-11-16/36c4b6e0/ui-assets/preview')

class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n).decode()
        name = self.path.strip('/') or 'shot.png'
        if body.startswith('data:image/png;base64,'):
            body = body.split(',', 1)[1]
        (OUT / name).write_bytes(base64.b64decode(body))
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b'ok')
        print('saved', name, flush=True)

    def log_message(self, *a):
        pass

http.server.HTTPServer(('127.0.0.1', 8765), H).serve_forever()