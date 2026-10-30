#!/usr/bin/env python3
"""Build manifest.json from the lessons/ folder tree, and check every lesson.

lessons/<year>/<course>/<NN-topic>/<code>-<slug>.html
Each folder may hold a _meta.json with {"name": "..."} for its display name.
Course folders may also set "short" (e.g. "12 ADV"), "colour" (hex) and "order".
Each lesson file starts with front matter:
    ---
    code: 1.01
    title: The Derivative of Exponential Functions
    ---
then its cards. Optional: a line <!-- solutions --> followed by separate
solution cards; otherwise worked solutions sit inside cards as <div class="ws">.

A topic folder may also hold the topic's Dorey's Resource Book as drb.pdf.
Extra editions sit beside it as drb-<label>.pdf (e.g. drb-student.pdf) and
show as extra downloads.

Run from the repo root:  python3 scripts/build_manifest.py
Exits non-zero (failing the deploy) if a lesson has a problem.
"""
import hashlib, json, os, re, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = os.path.join(ROOT, 'lessons')
problems = []

def read_meta(path):
    f = os.path.join(path, '_meta.json')
    if os.path.exists(f):
        try:
            with open(f, encoding='utf-8') as fh:
                return json.load(fh)
        except json.JSONDecodeError as e:
            problems.append(f'{os.path.relpath(f, ROOT)}: not valid JSON ({e})')
    return {}

def meta_name(path, fallback):
    return read_meta(path).get('name', fallback)

def nice(slug):
    slug = re.sub(r'^\d+-', '', slug)
    return slug.replace('-', ' ').capitalize()

def subdirs(path):
    return sorted(d for d in os.listdir(path)
                  if os.path.isdir(os.path.join(path, d)) and not d.startswith(('.', '_')))

def code_key(code):
    return [int(p) if p.isdigit() else p for p in re.split(r'[.\-]', code)]

def read_lesson(path, rel):
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    m = re.match(r'﻿?---\s*\n(.*?)\n---\s*\n', text, re.S)
    if not m:
        problems.append(f'{rel}: missing front matter (--- code / title ---)')
        return None
    fm = dict(re.findall(r'^(\w+):\s*(.+?)\s*$', m.group(1), re.M))
    for k in ('code', 'title'):
        if k not in fm:
            problems.append(f'{rel}: front matter has no "{k}:"')
            return None
    body = text[m.end():]
    main = re.split(r'<!--\s*solutions\s*-->', body, flags=re.I)[0]
    cards = len(re.findall(r'<div class="c">', main))
    if cards == 0:
        problems.append(f'{rel}: no cards found')
    if body.count('<div') != body.count('</div>'):
        problems.append(f'{rel}: unbalanced <div> tags ({body.count("<div")} open, {body.count("</div>")} close)')
    if re.sub(r'\\\$', '', body).count('$') % 2:
        problems.append(f'{rel}: odd number of $ signs (an unclosed maths expression)')
    return {'code': fm['code'], 'title': fm['title'], 'cards': cards}

def pdf_info(path, rel):
    with open(path, 'rb') as fh:
        data = fh.read()
    if not data.startswith(b'%PDF'):
        problems.append(f'{rel}: not a PDF file')
        return None
    # page count: the largest /Count (the root page tree), which pdflatex often
    # keeps inside compressed object streams
    counts = [int(n) for n in re.findall(rb'/Count\s+(\d+)', data)]
    for s in re.findall(rb'stream\r?\n(.*?)endstream', data, re.S):
        try:
            counts += [int(n) for n in re.findall(rb'/Count\s+(\d+)', zlib.decompress(s))]
        except zlib.error:
            pass
    pages = max(counts, default=0)
    return {'path': rel, 'bytes': len(data), 'pages': pages,
            'v': hashlib.sha1(data).hexdigest()[:8]}

def read_drb(tp):
    """drb.pdf (the main edition) plus any drb-<label>.pdf editions."""
    files = sorted(f for f in os.listdir(tp) if re.fullmatch(r'drb(-[\w-]+)?\.pdf', f, re.I))
    main, extras = None, []
    for f in files:
        rel = os.path.relpath(os.path.join(tp, f), ROOT).replace(os.sep, '/')
        info = pdf_info(os.path.join(tp, f), rel)
        if not info:
            continue
        if f.lower() == 'drb.pdf':
            main = info
        else:
            info['label'] = f[4:-4].replace('-', ' ').capitalize()
            extras.append(info)
    if not main and extras:
        main = extras.pop(0)
    if main:
        main['extras'] = extras
    return main

years = []
for y in subdirs(LESSONS):
    yp = os.path.join(LESSONS, y)
    courses = []
    for c in subdirs(yp):
        cp = os.path.join(yp, c)
        topics = []
        for t in subdirs(cp):
            tp = os.path.join(cp, t)
            num = re.match(r'(\d+)-', t)
            lessons = []
            for f in os.listdir(tp):
                if not f.endswith('.html'):
                    continue
                rel = os.path.relpath(os.path.join(tp, f), ROOT).replace(os.sep, '/')
                info = read_lesson(os.path.join(tp, f), rel)
                if info:
                    lid = rel[len('lessons/'):-len('.html')]
                    lessons.append({'id': lid, 'code': info['code'], 'title': info['title'],
                                    'path': rel, 'cards': info['cards']})
            lessons.sort(key=lambda l: code_key(l['code']))
            drb = read_drb(tp)
            if lessons or drb:
                topics.append({'id': t, 'name': meta_name(tp, nice(t)),
                               'num': str(int(num.group(1))) if num else '', 'lessons': lessons,
                               'drb': drb})
        m = read_meta(cp)
        # courses with no lessons yet are kept, so the home page can show them as "coming soon"
        courses.append({'id': c, 'name': m.get('name', nice(c)), 'short': m.get('short', ''),
                        'colour': m.get('colour', ''), 'order': m.get('order', 99), 'topics': topics})
    courses.sort(key=lambda k: (k['order'], k['name']))
    if courses:
        m = read_meta(yp)
        years.append({'id': y, 'name': m.get('name', nice(y)), 'colour': m.get('colour', ''), 'courses': courses})

# Generators: every lesson must have a slot in CODE_ORDER, or printed sheet codes can't record it.
eng_path = os.path.join(ROOT, 'generators', 'engine.js')
if os.path.exists(eng_path):
    with open(eng_path, encoding='utf-8') as fh:
        eng = fh.read()
    lesson_ids = re.findall(r"\{id:'([\w-]+)'[^{}]*?\bgen:", eng)
    m = re.search(r'const CODE_ORDER=\[(.*?)\];', eng, re.S)
    order = re.findall(r'"([\w-]+)"', m.group(1)) if m else []
    if not m:
        problems.append('generators/engine.js: CODE_ORDER list not found')
    for lid in lesson_ids:
        if lid not in order:
            problems.append(f'generators/engine.js: lesson "{lid}" is missing from CODE_ORDER (add it at the END of the list)')
    dups = sorted({x for x in order if order.count(x) > 1})
    if dups:
        problems.append(f'generators/engine.js: CODE_ORDER lists {", ".join(dups)} more than once')

with open(os.path.join(ROOT, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump({'years': years}, fh, ensure_ascii=False, indent=1)

n = sum(len(t['lessons']) for y in years for c in y['courses'] for t in c['topics'])
d = sum(1 for y in years for c in y['courses'] for t in c['topics'] if t['drb'])
print(f'manifest.json: {len(years)} years, {n} lessons, {d} DRB')
if problems:
    print('\nProblems:\n  ' + '\n  '.join(problems))
    sys.exit(1)
