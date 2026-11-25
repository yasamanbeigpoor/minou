"""Records every French phrase the app speaks, with a native French neural voice.

Run from the repo root after adding or changing a module:
    python3 tools/build_audio.py

It lists the phrases (tools/speakables.js), records only the new ones with Kokoro
(voice ff_siwis), and writes audio/<hash>.mp3 plus audio/index.json (text -> file).
Needs: pip install kokoro-onnx soundfile playwright, ffmpeg, and the model files
kokoro-v1.0.onnx (or kokoro-v1.0.int8.onnx) and voices-v1.0.bin (from the kokoro-onnx GitHub releases),
found next to this script or in $KOKORO_DIR.
"""
import functools, hashlib, http.server, json, os, pathlib, subprocess, sys, tempfile, threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
VOICE, SPEED = "ff_siwis", 0.9

# Letter names the voice misreads when written out; recording the capital letter fixes them.
SAY_AS = {"eu": "E", "emme": "M", "effe": "F", "esse": "S", "enne": "N", "qu": "Q"}


def spoken(text):
    """The text actually sent to the voice (spelling strings are letter names joined by ' ; ')."""
    if text in SAY_AS:
        return SAY_AS[text]
    if " ; " in text:
        return " ; ".join(SAY_AS.get(part, part) for part in text.split(" ; "))
    return text


def collect():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a, **k: None
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.goto(f"http://127.0.0.1:{httpd.server_address[1]}/tools/collect.html")
        pg.wait_for_function("window.SPEAKABLES", timeout=20000)
        items = pg.evaluate("window.SPEAKABLES")
        b.close()
    httpd.shutdown()
    return items


def fname(text):
    return hashlib.sha1(f"{VOICE}|{SPEED}|{spoken(text)}".encode()).hexdigest()[:14] + ".mp3"


def main():
    texts = collect()
    AUDIO.mkdir(exist_ok=True)
    index = {t: fname(t) for t in texts}
    todo = [t for t in texts if not (AUDIO / index[t]).exists()]
    print(f"{len(texts)} phrases, {len(todo)} to record")
    if todo:
        from kokoro_onnx import Kokoro
        import soundfile as sf
        d = pathlib.Path(os.environ.get("KOKORO_DIR", pathlib.Path(__file__).parent))
        model = d / "kokoro-v1.0.onnx"   # full model: faster than int8 on most CPUs
        if not model.exists():
            model = d / "kokoro-v1.0.int8.onnx"
        k = Kokoro(str(model), str(d / "voices-v1.0.bin"))
        tmp = pathlib.Path(tempfile.mkdtemp())
        for i, t in enumerate(todo, 1):
            samples, sr = k.create(spoken(t), voice=VOICE, speed=SPEED, lang="fr-fr")
            wav = tmp / "x.wav"
            sf.write(wav, samples, sr)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav),
                            "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08",
                            "-ac", "1", "-b:a", "48k", str(AUDIO / index[t])], check=True)
            if i % 25 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)}", flush=True)
    # Drop recordings nothing uses any more.
    keep = set(index.values())
    for f in AUDIO.glob("*.mp3"):
        if f.name not in keep:
            f.unlink()
    (AUDIO / "index.json").write_text(json.dumps(index, ensure_ascii=False, sort_keys=True, indent=0))
    print("wrote audio/index.json")


if __name__ == "__main__":
    main()
