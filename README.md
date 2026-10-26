# Dorey Desk

Teaching cards and question generators for NSW Stage 6 Mathematics. Lessons are organised
Year → Course → Topic → Lesson.

Live site: https://cooperdorey.github.io/dorey-desk/ (the repo was called Stage-6-Lessons until October 2026).
Open a lesson, copy cards as images into OneNote, and toggle the worked solutions.

## How it fits together

```
index.html                 the app
assets/app.css, app.js     styles and behaviour
scripts/build_manifest.py  builds manifest.json (the lesson list) and checks lessons
lessons/
  year-12/                 _meta.json → {"name": "Year 12"}
    maths-advanced/        _meta.json → {"name": "Mathematics Advanced"}
      01-differential-calculus/          _meta.json → {"name": "Differential calculus"}
        1.01-the-derivative-of-exponential-functions.html
```

The start page offers Lessons or Generators. Lessons steps through Year → Course → Topic, and a topic opens with its lessons
down the side. All of it comes from the folders.

Course folders also set their short name, colour and order in `_meta.json`:

```json
{"name": "Mathematics Advanced", "short": "12 ADV", "colour": "#1F3A68", "order": 3}
```

A course folder with no lessons yet shows on the home page as "Coming soon".

The menus come from the folders. A new year, course or topic is just a new folder
(with a `_meta.json` for its display name). The number at the front of a topic folder
sets its order and is shown in the menu ("1 · Differential calculus").

Every push to `main` runs `.github/workflows/pages.yml`, which rebuilds the lesson list,
checks every lesson file, and publishes the site. If a lesson has a problem (missing
title, unclosed `$`, unbalanced `<div>`), the run fails and the live site stays as it was;
the run log says which file and what to fix.

## Generators

The start page offers **Lessons** or **Generators**. Generators live in `generators/`,
one self-contained page each, listed in `generators/generators.json`:

```json
[{"file": "question-generator.html", "name": "Question generator",
  "desc": "Random questions with worked solutions.", "courses": ["12 ADV", "11 ADV"]}]
```

`courses` uses the courses' `short` names, so the chips pick up the course colours.

The question generator's topics and lessons are the `TOPICS` list near the bottom of its
`<script id="engine">`. Each lesson points at a generator function that returns the question,
the worked-solution lines and the answer. Lesson ids appear in shared links, so keep them
stable once used.

## A lesson file

```html
---
code: 1.01
title: The Derivative of Exponential Functions
---

<div class="c"><div class="h">We Do 2<span>Episode 1 · Derivative of e to a power</span></div><div class="b" style="min-height:300px">
Differentiate $y=3e^{2x+5}$.
<div class="ws">$\dfrac{dy}{dx}=6e^{2x+5}$</div>
</div></div>
```

- One `<div class="c">` per card, in teaching order.
- Card labels containing **We Do** or **your turn** go in the right-hand column.
- Maths goes between `$ … $`.
- Worked solutions go in `<div class="ws">` under their question: hidden in lesson
  view, shown in green with **Show answers**.
- Older lessons (Year 11, topic 8) keep their solutions as separate cards after a
  `<!-- solutions -->` line. Either style works.

## Editing

- **On github.com:** open the lesson file, press `.` to open the editor, make the change,
  and commit. The site updates about a minute later.
- **Ask Claude** in the Lesson Creator project to add or fix a lesson; it can push here
  directly once GitHub is connected.

## Previewing on your own computer

Browsers won't load lessons from a double-clicked file, so run a tiny server:

```
python3 scripts/build_manifest.py
python3 -m http.server
```

then open http://localhost:8000.
