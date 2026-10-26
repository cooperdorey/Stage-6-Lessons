// Stage 6 – Lessons
// Reads manifest.json (built from the lessons/ folder tree).
// Addresses:  #                      → start: Lessons or Generators
//             #generators            → list of generators (generators/generators.json)
//             #lessons               → choose a year
//             #year-12               → choose a course
//             #year-12/maths-advanced → choose a topic
//             #year-12/maths-advanced/01-differential-calculus → last lesson used in that topic
//             #year-12/…/1.01-…      → that lesson
'use strict';
const $ = id => document.getElementById(id);
let M = null, LIST = [], current = null, showSol = false, toastT = null;
const cache = new Map();

// ---------- helpers ----------
function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2200)}
function isRight(label){return /\b(we do|your turn)\b/i.test(label)}
function math(el){
  if (typeof renderMathInElement !== 'function') return;
  renderMathInElement(el,{delimiters:[{left:'$',right:'$',display:false}],output:'mathml',throwOnError:false});
  evenBrackets(el);
}
// \left( … \right) brackets stretch to the tallest thing inside, so a power inside makes
// them oversized and lopsided next to ordinary brackets. Only let them stretch when they
// hold something genuinely tall (a fraction or a matrix); otherwise draw them normal size.
function evenBrackets(el){
  el.querySelectorAll('mrow').forEach(row=>{
    const kids=[...row.children], first=kids[0], last=kids[kids.length-1];
    if (!first || first===last || first.tagName.toLowerCase()!=='mo' || last.tagName.toLowerCase()!=='mo') return;
    if (first.getAttribute('fence')!=='true' || last.getAttribute('fence')!=='true') return;
    if (row.querySelector('mfrac, mtable')) return;
    [first,last].forEach(mo=>{ mo.setAttribute('stretchy','false'); mo.setAttribute('lspace','0'); mo.setAttribute('rspace','0') });
  });
}
function store(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function recall(k){try{return localStorage.getItem(k)}catch(e){return null}}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
const plural = (n,w) => `${n} ${w}${n===1?'':'s'}`;

// ---------- colour ----------
function rgb(hex){const h=(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return null;return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}
function inkFor(hex){const c=rgb(hex);if(!c)return '#FFFFFF';
  const L=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
  return (.2126*L[0]+.7152*L[1]+.0722*L[2]) > .36 ? '#13202B' : '#FFFFFF'}
function tint(hex,amt){const c=rgb(hex);if(!c)return '';
  const dark=matchMedia('(prefers-color-scheme: dark)').matches, base=dark?[32,36,43]:[255,255,255];
  return '#'+c.map((v,i)=>Math.round(base[i]+(v-base[i])*amt).toString(16).padStart(2,'0')).join('')}
function lum(c){const L=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*L[0]+.7152*L[1]+.0722*L[2]}
// the course colour, darkened just enough to read as text on a white card
function deep(hex){let c=rgb(hex);if(!c)return '#8B1A1A';
  for(let i=0;i<20 && 1.05/(lum(c)+.05)<4.5;i++) c=c.map(v=>Math.round(v*.9));
  return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')}
function paint(el, course){
  const col = course && course.colour || '#5E6672';
  el.style.setProperty('--course', col);
  el.style.setProperty('--course-ink', inkFor(col));
  el.style.setProperty('--course-tint', tint(col,.12));
  // lesson cards take the course colour (they stay white, for OneNote)
  const ink = inkFor(col);
  el.style.setProperty('--card-head', col);
  el.style.setProperty('--card-ink', ink);
  el.style.setProperty('--card-sub', ink==='#FFFFFF' ? 'rgba(255,255,255,.78)' : 'rgba(19,32,43,.72)');
  el.style.setProperty('--card-title', deep(col));
}

// ---------- manifest ----------
async function loadManifest(){
  const r = await fetch('manifest.json',{cache:'no-store'});
  if (!r.ok) throw new Error('manifest');
  M = await r.json(); LIST = [];
  M.years.forEach(y=>y.courses.forEach(c=>c.topics.forEach(t=>{
    t.key = `${y.id}/${c.id}/${t.id}`;
    t.lessons.forEach(l=>LIST.push(Object.assign({}, l, {y, c, t})));
  })));
}
const byId = id => LIST.find(l=>l.id===id);
const lessonCount = c => c.topics.reduce((n,t)=>n+t.lessons.length,0);
function lastIn(topic){
  let m={}; try{m=JSON.parse(recall('lc-topic-last')||'{}')}catch(e){}
  return topic.lessons.find(l=>l.id===m[topic.key]) || topic.lessons[0];
}
function remember(L){
  let m={}; try{m=JSON.parse(recall('lc-topic-last')||'{}')}catch(e){}
  m[L.t.key]=L.id; store('lc-topic-last',JSON.stringify(m)); store('lc-lesson',L.id);
}

// ---------- router ----------
function route(){
  const parts = decodeURIComponent(location.hash.slice(1)).split('/').filter(Boolean);
  const y = parts[0] && M.years.find(x=>x.id===parts[0]);
  const c = y && parts[1] && y.courses.find(x=>x.id===parts[1]);
  const t = c && parts[2] && c.topics.find(x=>x.id===parts[2]);
  if (parts.length >= 4 && byId(parts.join('/'))) return openLesson(byId(parts.join('/')));
  if (t) return location.replace('#' + lastIn(t).id);
  if (c) return showTopics(y, c);
  if (y) return showCourses(y);
  if (parts[0]==='lessons') return showYears();
  if (parts[0]==='generators') return showGenerators();
  showStart();
}
function showHome(){ $('lesson').hidden = true; $('home').hidden = false; $('status').hidden = true; window.scrollTo(0,0) }
function crumbs(items){
  $('homeCrumbs').innerHTML = items.map(i => i.href ? `<a href="${i.href}">${esc(i.label)}</a>` : `<span>${esc(i.label)}</span>`).join('');
}

// ---------- home: start ----------
let GENS = null;
async function loadGenerators(){
  if (GENS) return GENS;
  try { const r = await fetch('generators/generators.json',{cache:'no-store'}); GENS = r.ok ? await r.json() : [] }
  catch(e){ GENS = [] }
  return GENS;
}
async function showStart(){
  showHome(); crumbs([]); paint($('home'), null);
  $('prompt').textContent = 'What do you need?';
  $('promptSub').textContent = '';
  const tiles = $('tiles'); tiles.className = 'tiles start';
  const courses = M.years.flatMap(y=>y.courses), n = LIST.length;
  const lessons = document.createElement('a'); lessons.className = 'choice has-spines'; lessons.href = '#lessons';
  lessons.style.setProperty('--n', courses.length);
  lessons.innerHTML = `<span class="spines">${courses.map(c=>`<i style="--c:${esc(c.colour||'#9AA1AB')}" title="${esc(c.short||c.name)}"></i>`).join('')}</span>
    <span class="big">Lessons</span><span class="small">Teaching cards for OneNote · ${plural(n,'lesson')}</span>`;
  const gens = document.createElement('a'); gens.className = 'choice gen'; gens.href = '#generators';
  gens.innerHTML = `<span class="dice" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <span class="big">Generators</span><span class="small" id="genCount">Random questions with worked solutions</span>`;
  tiles.replaceChildren(lessons, gens);
  document.title = 'Stage 6 – Lessons';
  const g = await loadGenerators();
  const c = $('genCount'); if (c && g.length) c.textContent = `Random questions with worked solutions · ${plural(g.length,'generator')}`;
}

// ---------- home: generators ----------
async function showGenerators(){
  showHome(); crumbs([{label:'Home',href:'#'},{label:'Generators'}]); paint($('home'), null);
  $('prompt').textContent = 'Choose a generator';
  $('promptSub').textContent = 'Each opens in its own page. Questions come with worked solutions.';
  const tiles = $('tiles'); tiles.className = 'tiles gens'; tiles.replaceChildren();
  document.title = 'Generators – Stage 6 – Lessons';
  const g = await loadGenerators();
  if (!g.length){ tiles.innerHTML = '<p class="empty-note">No generators yet.</p>'; return }
  const colourOf = s => { for (const y of M.years) for (const c of y.courses) if (c.short===s) return c.colour; return '' };
  tiles.replaceChildren(...g.map(x=>{
    const a = document.createElement('a'); a.className = 'generator'; a.href = 'generators/' + encodeURI(x.file);
    a.innerHTML = `<span class="t">${esc(x.name)}</span><span class="d">${esc(x.desc||'')}</span>
      <span class="chips">${(x.courses||[]).map(s=>{const col=colourOf(s)||'#5E6672';return `<span class="course-chip" style="--course:${esc(col)};--course-ink:${inkFor(col)}">${esc(s)}</span>`}).join('')}</span>`;
    return a;
  }));
}

// ---------- home: year ----------
function showYears(){
  showHome(); crumbs([{label:'Home',href:'#'},{label:'Lessons'}]); paint($('home'), null);
  $('prompt').textContent = 'Which year?';
  $('promptSub').textContent = '';
  const tiles = $('tiles'); tiles.className = 'tiles';
  tiles.replaceChildren(...M.years.map(y=>{
    const a = document.createElement('a'); a.className='year has-spines'; a.href = '#'+y.id;
    a.style.setProperty('--n', y.courses.length);
    const n = y.courses.reduce((s,c)=>s+lessonCount(c),0);
    a.innerHTML = `<span class="spines">${y.courses.map(c=>`<i style="--c:${esc(c.colour||'#9AA1AB')}" title="${esc(c.short||c.name)}"></i>`).join('')}</span>
      <span class="word">Year</span><span class="big">${esc(y.name.replace(/^Year\s*/,''))}</span>
      <span class="small">${plural(y.courses.length,'course')}, ${plural(n,'lesson')}</span>`;
    return a;
  }));
  document.title = 'Lessons – Stage 6 – Lessons';
}

// ---------- home: course ----------
function showCourses(y){
  showHome(); crumbs([{label:'Home',href:'#'},{label:'Lessons',href:'#lessons'},{label:y.name}]); paint($('home'), null);
  $('prompt').textContent = 'Choose a course';
  $('promptSub').textContent = y.name;
  const tiles = $('tiles'); tiles.className = 'tiles';
  tiles.replaceChildren(...y.courses.map(c=>{
    const n = lessonCount(c), empty = n===0;
    const a = document.createElement(empty?'div':'a'); a.className = 'course' + (empty?' empty':'');
    if (!empty) a.href = `#${y.id}/${c.id}`; else a.setAttribute('aria-disabled','true');
    paint(a, c);
    a.innerHTML = `<span class="short">${esc(c.short||c.name)}</span><span class="name">${esc(c.name)}</span>
      <span class="count">${empty ? 'Coming soon' : plural(c.topics.length,'topic') + ', ' + plural(n,'lesson')}</span>`;
    return a;
  }));
  document.title = `${y.name} – Stage 6 – Lessons`;
}

// ---------- home: topic ----------
function showTopics(y, c){
  showHome(); crumbs([{label:'Home',href:'#'},{label:'Lessons',href:'#lessons'},{label:y.name,href:'#'+y.id},{label:c.short||c.name}]); paint($('home'), c);
  $('prompt').textContent = 'Choose a topic';
  $('promptSub').textContent = `${y.name} ${c.name}`;
  const tiles = $('tiles'); tiles.className = 'tiles topics';
  if (!c.topics.length){ tiles.innerHTML = '<p class="empty-note">No lessons in this course yet.</p>'; return }
  tiles.replaceChildren(...c.topics.map(t=>{
    const a = document.createElement('a'); a.className='topic'; a.href = `#${y.id}/${c.id}/${t.id}`;
    a.innerHTML = `<span class="num">${esc(t.num||'')}</span><span class="t">${esc(t.name)}<span class="count">${plural(t.lessons.length,'lesson')}</span></span>`;
    return a;
  }));
  document.title = `${c.short||c.name} – Stage 6 – Lessons`;
}

// ---------- lesson view ----------
function buildSide(L){
  const lesson = $('lesson'); paint(lesson, L.c);
  $('sideCrumbs').innerHTML = `<a href="#${L.y.id}">${esc(L.y.name)}</a><a href="#${L.y.id}/${L.c.id}">${esc(L.c.short||L.c.name)}</a>`;
  const topic = $('sideTopic'); topic.href = `#${L.y.id}/${L.c.id}`;
  topic.innerHTML = `${L.t.num ? esc(L.t.num)+' · ' : ''}${esc(L.t.name)}<small>Change topic</small>`;
  const list = $('sideList'); list.replaceChildren();
  L.t.lessons.forEach(l=>{
    const a = document.createElement('a'); a.className='page'; a.href = '#'+l.id;
    if (l.id===L.id) a.setAttribute('aria-current','page');
    a.innerHTML = `<b>${esc(l.code)}</b><span></span>`; a.lastChild.textContent = l.title;
    a.addEventListener('click',()=>$('lesson').classList.remove('open'));
    list.append(a);
  });
  math(list);
}
async function fetchLesson(L){
  if (cache.has(L.id)) return cache.get(L.id);
  const r = await fetch(L.path,{cache:'no-store'});
  if (!r.ok) throw new Error('This lesson could not be loaded (' + L.path + ').');
  let text = await r.text();
  text = text.replace(/^﻿?---[\s\S]*?\n---\s*\n/, '');
  const [main, sols] = text.split(/<!--\s*solutions\s*-->/i);
  const parse = h => { const t=document.createElement('template'); t.innerHTML=h||''; return [...t.content.children].filter(n=>n.classList.contains('c')); };
  const out = {cards: parse(main), solutions: sols ? parse(sols) : null};
  cache.set(L.id, out); return out;
}
function labelOf(card){
  const h=card.querySelector('.h'); if(!h) return '';
  const k=h.cloneNode(true); k.querySelectorAll('span').forEach(s=>s.remove()); return k.textContent;
}
function withCopy(card){
  const c = card.cloneNode(true);
  const b = document.createElement('button'); b.className='copy'; b.type='button'; b.textContent='Copy';
  b.addEventListener('click',()=>copyNode(c,'Card copied')); c.append(b); return c;
}
async function openLesson(L){
  current = L;
  $('home').hidden = true; $('status').hidden = true; $('lesson').hidden = false;
  buildSide(L); remember(L);
  $('lname').textContent = `${L.code} – ${L.title}`; math($('lname'));
  document.title = `${L.code} ${L.title.replace(/\$/g,'')} – Stage 6 – Lessons`;
  const deck = $('deck');
  deck.replaceChildren(Object.assign(document.createElement('p'),{className:'status',textContent:'Loading…'}));
  let data;
  try { data = await fetchLesson(L) } catch(e){ deck.firstChild.textContent = e.message; return }
  if (current !== L) return;
  const list = showSol && data.solutions ? data.solutions : data.cards;
  deck.classList.toggle('sol-mode', showSol);
  $('lmeta').textContent = showSol ? `Worked solutions · ${plural(list.length,'card')}` : `${plural(data.cards.length,'card')} · practice cards sit in the right column`;
  const sheet = document.createElement('div'); sheet.className = 'sheet'; sheet.id = 'sheet';
  deck.replaceChildren(sheet); let r = null;
  list.forEach(card=>{
    const el = withCopy(card), right = isRight(labelOf(card));
    if (!right || !r){
      const row=document.createElement('div');row.className='row';
      const l=document.createElement('div'); r=document.createElement('div'); row.append(l,r); sheet.append(row);
      if (!right){ l.append(el); return }
    }
    r.append(el);
  });
  math(deck);
  fit();
}

// Keep the two-column layout at the cards' real size and scale the whole sheet to the space
// available. Only very narrow screens (phones) drop to one column.
function fit(){
  const deck = $('deck'), sheet = $('sheet'); if (!sheet) return;
  const cs = getComputedStyle(deck);
  const avail = deck.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const one = avail < 700;
  sheet.classList.toggle('one', one);
  const z = Math.min(1, avail / (one ? 760 : 1560));
  sheet.style.zoom = z < 1 ? z.toFixed(4) : '';
}
new ResizeObserver(()=>fit()).observe($('deck'));

// ---------- copy to clipboard as an image ----------
const opts = {pixelRatio:2, backgroundColor:'#f4f4f4', filter:n=>!(n.classList&&n.classList.contains('copy'))};
async function showShot(node){
  try{const url=await htmlToImage.toPng(node,opts);$('shotImg').src=url;$('shot').hidden=false}
  catch(e){toast('Could not make the image. Try again.')}
}
function copyNode(node,msg,done){
  done = done || (()=>{});
  if (typeof htmlToImage==='undefined'){toast('Image tools are still loading. Try again in a moment.');done();return}
  if (!navigator.clipboard || typeof ClipboardItem==='undefined'){showShot(node).finally(done);return}
  const blob = htmlToImage.toBlob(node,opts);
  blob.finally(done);
  navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>toast(msg+'. Paste it into OneNote.')).catch(()=>showShot(node));
}

// ---------- wiring ----------
$('allBtn').addEventListener('click',()=>{
  const sheet=$('sheet'); if(!sheet) return;
  const z=sheet.style.zoom; sheet.style.zoom='';           // copy at full size
  copyNode(sheet,'All cards copied', ()=>{ sheet.style.zoom=z });
});
$('ansBtn').addEventListener('click',e=>{
  showSol=!showSol; const b=e.currentTarget;
  b.setAttribute('aria-pressed',showSol); b.textContent=showSol?'Show lesson':'Show answers'; b.classList.toggle('solid',showSol);
  if (current) openLesson(current);
});
$('sideToggle').addEventListener('click',e=>{
  const lesson=$('lesson'), narrow=matchMedia('(max-width:900px)').matches;
  const cls = narrow ? 'open' : 'collapsed';
  lesson.classList.toggle(cls);
  const shown = narrow ? lesson.classList.contains('open') : !lesson.classList.contains('collapsed');
  e.currentTarget.setAttribute('aria-expanded', shown);
  e.currentTarget.textContent = narrow ? 'Lessons' : (shown ? 'Hide lessons' : 'Show lessons');
});
$('shotClose').addEventListener('click',()=>$('shot').hidden=true);
window.addEventListener('hashchange',route);

(async()=>{
  try { await loadManifest() }
  catch(e){
    $('status').textContent = location.protocol==='file:'
      ? 'Open this site through its web address (or a local server). Browsers block loading lessons from a file.'
      : 'The lesson list (manifest.json) could not be loaded. Refresh to try again.';
    return;
  }
  // keep the button label right for wide screens
  if (!matchMedia('(max-width:900px)').matches){ $('sideToggle').textContent='Hide lessons'; $('sideToggle').setAttribute('aria-expanded','true') }
  route();
})();
