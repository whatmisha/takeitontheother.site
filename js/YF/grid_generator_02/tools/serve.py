#!/usr/bin/env python3
"""Serve the local YF environment without stale source modules during development."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class DevelopmentHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parents[2]
    handler = partial(DevelopmentHandler, directory=str(directory))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    print(f'Pizza Boxer 02: http://127.0.0.1:{args.port}/grid_generator_02/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
