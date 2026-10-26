# Notes for Claude

This repo is the Stage 6 – Lessons site (cards for OneNote). Lesson content rules (atomisation, card order,
We Do levels) live in the Lesson Creator project; this file covers the repo format.

- One file per lesson: `lessons/<year>/<course>/<NN-topic>/<code>-<slug>.html`.
- Front matter `code:` and `title:` (title may contain `$…$` maths).
- Cards use the existing `.c` / `.h` / `.b` markup with `$…$` maths (rendered at runtime
  by KaTeX as MathML). Do not paste pre-rendered MathML.
- Worked solutions go inline as `<div class="ws">…</div>` under each question, including
  on model cards. The app hides them in lesson view.
- No exercise card. Labels with "We Do" / "your turn" go right; nothing else may use those words.
- New topic: create the folder and a `_meta.json` with `{"name": "…"}`.
- Course `_meta.json` also has `short`, `colour` and `order` (colours chosen by Coop:
  11 ADV blue, 11 STD light green, 12 STD 1 light teal, 12 STD 2 dark purple, 12 ADV navy).
- Brackets: use plain `( )`; use `\left( … \right)` only around fractions. Don't use `\big`.
  (The app draws non-fraction `\left…\right` pairs at normal size so pairs always match.)
- Before committing, run `python3 scripts/build_manifest.py`; it must report no problems.
