#!/usr/bin/env python3
"""Build manifest.json from the lessons/ folder tree, and check every lesson.

lessons/<year>/<course>/<NN-topic>/<code>-<slug>.html
Each folder may hold a _meta.json with {"name": "..."} for its display name.
Each lesson file starts with front matter:
    ---
    code: 1.01
    title: The Derivative of Exponential Functions
    ---
then its cards. Optional: a line <!-- solutions --> followed by separate
solution cards; otherwise worked solutions sit inside cards as <div class="ws">.

Run from the repo root:  python3 scripts/build_manifest.py
Exits non-zero (failing the deploy) if a lesson has a problem.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = os.path.join(ROOT, 'lessons')
problems = []

def meta_name(path, fallback):
    f = os.path.join(path, '_meta.json')
    if os.path.exists(f):
        with open(f, encoding='utf-8') as fh:
            return json.load(fh).get('name', fallback)
    return fallback

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
            if lessons:
                topics.append({'id': t, 'name': meta_name(tp, nice(t)),
                               'num': str(int(num.group(1))) if num else '', 'lessons': lessons})
        if topics:
            courses.append({'id': c, 'name': meta_name(cp, nice(c)), 'topics': topics})
    if courses:
        years.append({'id': y, 'name': meta_name(yp, nice(y)), 'courses': courses})

with open(os.path.join(ROOT, 'manifest.json'), 'w', encoding='utf-8') as fh:
    json.dump({'years': years}, fh, ensure_ascii=False, indent=1)

n = sum(len(t['lessons']) for y in years for c in y['courses'] for t in c['topics'])
print(f'manifest.json: {len(years)} years, {n} lessons')
if problems:
    print('\nProblems:\n  ' + '\n  '.join(problems))
    sys.exit(1)
