#!/usr/bin/env python3
"""Static server for previewing films in a browser.

The only thing it adds over `python -m http.server` is that it refuses to let
the browser cache anything — otherwise every edit needs a hard reload and you
end up debugging a stale file.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # quiet unless something is wrong
        if not str(args[1] if len(args) > 1 else "").startswith("2"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
    root = Path(__file__).resolve().parent.parent  # repo root
    handler = partial(NoCacheHandler, directory=str(root))
    print(f"open http://localhost:{port}/brands/lab/films/nocode.html")
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
