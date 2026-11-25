# Minou 🐈‍⬛

A personal French learning app with a black-cat teacher named Minou. It follows a daily routine: review everything learned so far, learn the new module, then ten new numbers.

It's a static web app (plain HTML, CSS and JavaScript, no build step), installable on a phone and usable offline.

## What's inside

- **Learning path**: each module is a trail of short lessons (words, grammar, textbook exercises, reading, listening and speaking, numbers, checkpoint). Finishing the checkpoint unlocks the next module, and every new module starts with a review of the earlier ones.
- **Alphabet bonus track**: letter sounds, the tricky pairs (G/J, E/I, U), accents, and a spelling game.
- **All four skills**: reading, writing (typed answers with forgiving accent checks), listening (the browser's French voice), and speaking (speech recognition in Chrome or Safari, self-check elsewhere).
- **Spaced repetition**: FSRS scheduling per word, rule and number. Missed questions come back in the same lesson and in reviews.
- **Practise tab**: daily review, weak spots, a 15-minute mock exam, and a numbers drill.
- **Notebook**: one summary per module, readable in the app and downloadable as a PDF.
- **Help for beginners**: English for everything, "Minou's trick" memory hooks, sing-along rhymes, plus optional English sound-it-out and Persian-script pronunciation (toggle with **Aa** and **فا**).
- XP, daily goal, streaks, a guided tour, light and dark mode.

Progress is saved in the browser. Use **Me → Backup** to move it between devices.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

It has to be served over HTTP; opening `index.html` directly won't load the lessons.

## Put it online with GitHub Pages

1. Push this folder to a public GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and save.
4. After a minute the app is live at `https://<your-username>.github.io/<repo-name>/`.
5. On your phone, open that link and use **Add to Home Screen**.

## Adding a module

1. Create `content/class1/moduleN.json` (copy `module1.json` as a template).
2. Add `"moduleN"` to the `modules` list in `content/classes.json`.
3. Rebuild the PDF summaries: `python3 tools/build_summaries.py` (needs `pip install playwright && playwright install chromium`).
4. Commit and push. The app picks up new content automatically.

A new class (Class 2) is a new entry in `content/classes.json` with its own folder.

### Module file shape

| Field | What it holds |
| --- | --- |
| `id`, `number`, `title`, `subtitle`, `source` | Module identity |
| `numbers` | `[from, to]` range taught in this module, e.g. `[11, 20]` |
| `path` | The lessons in order. Types: `words` (with `items`), `grammar`, `exercises`, `reading`, `listen`, `numbers`, `checkpoint` |
| `vocab` | `{ id, fr, noun, pl, g, en, pr, fa, tip, trick }`. `g` is `m`, `f`, `mf` or `pl` |
| `grammar` | `teach` cards, `notes`, `tricks`, a `chant`, and `extraNouns` for drills |
| `exercises` | Textbook items. Multiple choice by default, or `type: "type"` / `"sentence"` |
| `readings` | Passages with `lines` (`fr`, `en`, `pr`, `fa`) and `questions` |
| `sentences` | `{ id, fr, en, alts, pr, fa }` for listening, speaking and sentence building |

`pr` is the English sound-it-out spelling (capitals mark the stressed syllable), `fa` is the Persian-script reading.

## Project layout

```
index.html, sw.js, manifest.webmanifest
css/          styles and self-hosted fonts
js/           app.js (screens), lesson.js (player), questions.js and build.js (lesson content),
              srs.js (FSRS), store.js (progress), speech.js, minou.js (the cat), tour.js, summary.js
content/      classes.json and one JSON file per module
summaries/    generated PDF summaries
tools/        build_summaries.py
```

Fonts: Fredoka, Nunito and Vazirmatn, under the SIL Open Font License.
