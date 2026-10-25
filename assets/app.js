// Lesson Cards — reads manifest.json (built from the lessons/ folder tree)
// and loads one lesson file at a time.
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
}
function store(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function recall(k){try{return localStorage.getItem(k)}catch(e){return null}}

// ---------- manifest ----------
async function loadManifest(){
  const r = await fetch('manifest.json',{cache:'no-cache'});
  if (!r.ok) throw new Error('manifest.json not found');
  M = await r.json();
  LIST = [];
  M.years.forEach(y=>y.courses.forEach(c=>c.topics.forEach(t=>{
    t.key = `${y.id}/${c.id}/${t.id}`;
    t.lessons.forEach(l=>LIST.push(Object.assign({}, l, {y, c, t})));
  })));
}
const byId = id => LIST.find(l=>l.id===id);
function lastIn(topic){
  let m={}; try{m=JSON.parse(recall('lc-topic-last')||'{}')}catch(e){}
  return topic.lessons.find(l=>l.id===m[topic.key]) || topic.lessons[0];
}

// ---------- picker ----------
function fill(sel, items, value){
  sel.replaceChildren(...items.map(i=>{const o=document.createElement('option');o.value=i.id;o.textContent=i.label;return o}));
  sel.value = value;
}
const topicLabel = t => (t.num ? t.num + ' · ' : '') + t.name;
function buildNav(L){
  fill($('selYear'), M.years.map(y=>({id:y.id,label:y.name})), L.y.id);
  fill($('selCourse'), L.y.courses.map(c=>({id:c.id,label:c.name})), L.c.id);
  fill($('selTopic'), L.c.topics.map(t=>({id:t.id,label:topicLabel(t)})), L.t.id);
  $('crumb').textContent = `${L.y.name} · ${L.c.name}`;
  const tabs = $('tabs'); tabs.replaceChildren();
  L.t.lessons.forEach(l=>{
    const b=document.createElement('button');b.className='tab';b.type='button';b.role='tab';
    b.dataset.id=l.id;b.setAttribute('aria-selected',l.id===L.id);
    b.innerHTML=`<b>${l.code}</b>`;b.append(document.createTextNode(l.title));
    b.addEventListener('click',()=>go(l.id));tabs.append(b);
  });
  math(tabs);
  let m={}; try{m=JSON.parse(recall('lc-topic-last')||'{}')}catch(e){}
  m[L.t.key]=L.id; store('lc-topic-last',JSON.stringify(m));
}
$('selYear').addEventListener('change',e=>{const y=M.years.find(x=>x.id===e.target.value);go(lastIn(y.courses[0].topics[0]).id)});
$('selCourse').addEventListener('change',e=>{const y=M.years.find(x=>x.id===$('selYear').value);const c=y.courses.find(x=>x.id===e.target.value);go(lastIn(c.topics[0]).id)});
$('selTopic').addEventListener('change',e=>{const y=M.years.find(x=>x.id===$('selYear').value);const c=y.courses.find(x=>x.id===$('selCourse').value);go(lastIn(c.topics.find(x=>x.id===e.target.value)).id)});

// ---------- lesson files ----------
async function fetchLesson(L){
  if (cache.has(L.id)) return cache.get(L.id);
  const r = await fetch(L.path,{cache:'no-cache'});
  if (!r.ok) throw new Error('Could not load ' + L.path);
  let text = await r.text();
  text = text.replace(/^﻿?---[\s\S]*?\n---\s*\n/, '');      // front matter
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

// ---------- render ----------
async function go(id){
  const L = byId(id) || LIST[LIST.length-1]; current = L;
  buildNav(L);
  $('lname').textContent = `${L.code} – ${L.title}`; math($('lname'));
  const deck = $('deck'); deck.replaceChildren(Object.assign(document.createElement('p'),{className:'status',textContent:'Loading…'}));
  let data;
  try { data = await fetchLesson(L) } catch(e){ deck.firstChild.textContent = e.message; return }
  if (current !== L) return;
  const list = showSol && data.solutions ? data.solutions : data.cards;
  deck.classList.toggle('sol-mode', showSol);
  $('lmeta').textContent = showSol ? `Worked solutions · ${list.length} cards` : `${data.cards.length} cards · practice cards sit in the right column`;
  deck.replaceChildren(); let r = null;
  list.forEach(card=>{
    const el = withCopy(card), right = isRight(labelOf(card));
    if (!right || !r){
      const row=document.createElement('div');row.className='row';
      const l=document.createElement('div'); r=document.createElement('div'); row.append(l,r); deck.append(row);
      if (!right){ l.append(el); return }
    }
    r.append(el);
  });
  math(deck);
  store('lc-lesson', L.id);
  if (decodeURIComponent(location.hash.slice(1)) !== L.id) { try{history.replaceState(null,'','#'+L.id)}catch(e){} }
}

// ---------- copy to clipboard as an image ----------
const opts = {pixelRatio:2, backgroundColor:'#f4f4f4', filter:n=>!(n.classList&&n.classList.contains('copy'))};
async function showShot(node){
  try{const url=await htmlToImage.toPng(node,opts);$('shotImg').src=url;$('shot').hidden=false}
  catch(e){toast('Could not make the image. Try again.')}
}
function copyNode(node,msg){
  if (typeof htmlToImage==='undefined'){toast('Image tools are still loading. Try again in a moment.');return}
  if (!navigator.clipboard || typeof ClipboardItem==='undefined'){showShot(node);return}
  const blob = htmlToImage.toBlob(node,opts);
  navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>toast(msg+'. Paste it into OneNote.')).catch(()=>showShot(node));
}

// ---------- wiring ----------
$('allBtn').addEventListener('click',()=>copyNode($('deck'),'All cards copied'));
$('ansBtn').addEventListener('click',e=>{
  showSol=!showSol; const b=e.currentTarget;
  b.setAttribute('aria-pressed',showSol); b.textContent=showSol?'Show lesson':'Show answers'; b.classList.toggle('solid',showSol);
  if (current) go(current.id);
});
$('shotClose').addEventListener('click',()=>$('shot').hidden=true);
window.addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.slice(1)); if(!current||id!==current.id) go(id)});

(async()=>{
  try { await loadManifest() }
  catch(e){
    $('deck').firstChild.textContent = location.protocol==='file:'
      ? 'Open this site through its web address (or a local server) — browsers block loading lessons from a file.'
      : 'Could not load the lesson list (manifest.json).';
    return;
  }
  if (!LIST.length){ $('deck').firstChild.textContent='No lessons yet.'; return }
  let start = decodeURIComponent(location.hash.slice(1));
  if (!byId(start)) start = recall('lc-lesson') || '';
  go(start);
})();
