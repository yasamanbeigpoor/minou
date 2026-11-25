"""Builds the downloadable PDF summary for every module.

Run from the repo root after adding or changing a module:
    python3 tools/build_summaries.py

Writes summaries/<class>-<module>.pdf (English pronunciation) and
summaries/<class>-<module>-fa.pdf (English + Persian pronunciation).
Needs: pip install playwright && playwright install chromium
"""
import functools
import http.server
import json
import pathlib
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    handler.log_message = lambda *a, **k: None
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    classes = json.loads((ROOT / "content/classes.json").read_text())["classes"]
    httpd = serve()
    port = httpd.server_address[1]
    out = ROOT / "summaries"
    out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for cls in classes:
            for f in cls["modules"]:
                mod = json.loads((ROOT / f"content/{cls['id']}/{f}.json").read_text())
                key = f"{cls['id']}.{mod['id']}"
                for fa in (False, True):
                    page.goto(f"http://127.0.0.1:{port}/summary.html?m={key}&fa={'1' if fa else '0'}")
                    page.wait_for_selector("body[data-ready='1']", timeout=20000)
                    name = f"{cls['id']}-{mod['id']}{'-fa' if fa else ''}.pdf"
                    page.pdf(path=str(out / name), format="A4", print_background=True,
                             margin={"top": "14mm", "bottom": "16mm", "left": "14mm", "right": "14mm"})
                    print("wrote", name)
        browser.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()
