# Notes for Claude

This repo is the Dorey Desk site (cards for OneNote). Lesson content rules (atomisation, card order,
We Do levels) live in the Lesson Creator project; this file covers the repo format.

- One file per lesson: `lessons/<year>/<course>/<NN-topic>/<code>-<slug>.html`.
- Front matter `code:` and `title:` (title may contain `$…$` maths).
- Cards use the existing `.c` / `.h` / `.b` markup with `$…$` maths (rendered at runtime
  by KaTeX as MathML). Do not paste pre-rendered MathML.
- Worked solutions go inline as `<div class="ws">…</div>` under each question, including
  on model cards. The app hides them in lesson view.
- No exercise card. Labels with "We Do" / "your turn" go right; nothing else may use those words.
- New topic: create the folder and a `_meta.json` with `{"name": "…"}`.
- A topic's Dorey's Resource Book goes in the topic folder as `drb.pdf` (other editions as
  `drb-<label>.pdf`). The LaTeX source lives in the Lesson Creator project, not here; commit the
  compiled PDF. Choosing a topic shows Lessons / DRB; `#…/<topic>/drb` is the DRB page.
- Course `_meta.json` also has `short`, `colour` and `order` (colours chosen by Coop:
  11 ADV blue, 11 STD light green, 12 STD 1 light teal, 12 STD 2 dark purple, 12 ADV navy).
- Brackets: use plain `( )`; use `\left( … \right)` only around fractions. Don't use `\big`.
  (The app draws non-fraction `\left…\right` pairs at normal size so pairs always match.)
- Before committing, run `python3 scripts/build_manifest.py`; it must report no problems.
- Generators: one page per generator in `generators/`, registered in
  `generators/generators.json`. The question bank (`gen` functions, topics, lessons and each
  lesson's `marks`) lives in `generators/engine.js`, shared by the question generator, the
  LSQ generator (`lsq.html`, 2-page A4 quiz, PDF via the vendored jsPDF + html-to-image) and the
  homework generator (`homework.html`, two-page (double-sided) HSC-style Question 1 with parts (a), (b)… sorted
  by marks, at most two 1-mark parts, same PDF approach). A lesson's `marks` decides where its
  questions sit on the homework sheet, so set it to the HSC value. The All / Yr 11 / Yr 12 / Clear buttons above each topic list come from
  `generators/picker.js` (load it after the page's own script); a topic's year is read from its `course`. They use the site's vendored KaTeX (MathML output), no CDNs.
  In the question generator, test every generator function on many seeds before committing
  (all maths must parse in KaTeX; no `NaN`, `undefined`, `+ -` or `1x`).
