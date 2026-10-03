from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import re
import argparse

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--review', choices=['pigment-20','pigment-v2','tones-v1'], default='pigment-20')
parser.add_argument('--port', type=int, default=8020)
args = parser.parse_args()
OUTPUT = ROOT / 'grainy_land/tests/reviews' / args.review
PREFIX = {'pigment-20':'/__grainy_save/','pigment-v2':'/__grainy_v2_save/','tones-v1':'/__grainy_tones_save/'}[args.review]
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_POST(self):
        name = self.path.removeprefix(PREFIX)
        if not self.path.startswith(PREFIX) or not re.fullmatch(r'(?:0[1-9]|1[0-9]|20|contact-sheet|detail-sheet|before-after|materials|default|ember|abstract)\.png|metrics\.json', name):
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

print(f'Grainy review server: http://127.0.0.1:{args.port}',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(ROOT))).serve_forever()
