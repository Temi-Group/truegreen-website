#!/usr/bin/env python3
"""
Local preview server for the Truegreen site.

    python3 scripts/serve-local.py      # then open http://localhost:8080

Serves the site (the portal needs a real server — ES modules and fetch() do
not work over file://) and adds one extra route, POST /save, which lets
scripts/encrypt.html write data/dashboard-content.json or data/dashboard.json
directly instead of you downloading the file and moving it by hand.

Local only: it binds to 127.0.0.1 and the route does not exist on GitHub Pages.
"""
import http.server, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(ROOT)


# Plaintext dashboard staged for encryption. Deliberately OUTSIDE the repo so
# it can never be committed; served only to localhost, only by this script.
SOURCE = os.environ.get(
    'TG_DASHBOARD_SOURCE',
    os.path.expanduser('~/Desktop/truegreen-investor-dashboard.html'),
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.rstrip('/') == '/local-source':
            if not os.path.isfile(SOURCE):
                self.send_error(404, 'No staged dashboard')
                return
            data = open(SOURCE, 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()

    def do_POST(self):
        if self.path.rstrip('/') != '/save':
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        try:
            payload = json.loads(body)
            name = 'dashboard-content.json' if payload.get('mode') == 'content' else 'dashboard.json'
            if not payload.get('ciphertext'):
                raise ValueError('payload has no ciphertext')
        except Exception as exc:
            self.send_error(400, f'Bad payload: {exc}')
            return

        target = os.path.join(ROOT, 'data', name)
        with open(target, 'wb') as fh:
            fh.write(body if body.endswith(b'\n') else body + b'\n')
        print(f'  -> saved data/{name} ({len(body)} bytes)')

        reply = json.dumps({'saved': f'data/{name}'}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(reply)))
        self.end_headers()
        self.wfile.write(reply)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    print(f'Truegreen site  ->  http://localhost:{PORT}')
    print(f'Publish tool    ->  http://localhost:{PORT}/scripts/encrypt.html')
    print(f'Staged dashboard -> {SOURCE}'
          f'{"" if os.path.isfile(SOURCE) else "   (NOT FOUND)"}')
    print('Ctrl+C to stop.')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
