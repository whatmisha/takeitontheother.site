from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import re

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'grainy_land/tests/reviews/pigment-20'
class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        name = self.path.removeprefix('/__grainy_save/')
        if not self.path.startswith('/__grainy_save/') or not re.fullmatch(r'(?:0[1-9]|1[0-9]|20|contact-sheet|detail-sheet)\.png|metrics\.json', name):
            self.send_error(404); return
        size = int(self.headers.get('Content-Length', '0'))
        if size <= 0 or size > 25000000:
            self.send_error(413); return
        data = self.rfile.read(size)
        if name.endswith('.png') and not data.startswith(bytes([137,80,78,71,13,10,26,10])):
            self.send_error(400); return
        (OUTPUT/name).write_bytes(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'OK')
    def log_message(self, format, *args):
        if str(args[1]) not in ('200','304'): super().log_message(format,*args)

print('Grainy review server: http://127.0.0.1:8020',flush=True)
ThreadingHTTPServer(('127.0.0.1',8020),partial(Handler,directory=str(ROOT))).serve_forever()
