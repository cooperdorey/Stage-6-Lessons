// Quick-select buttons above the topic list, shared by every generator page:
//   All · Yr 11 · Yr 12 · Clear
// A year button ticks every lesson in that year's topics and unticks the rest.
// The topic's year comes from its `course` in engine.js ("Year 11 Advanced", "Year 12 Advanced"),
// so new topics join the right button automatically.
// Load after the page's own script: it runs once that script has built the sidebar.
document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('topics');
  if (!box || typeof TOPICS === 'undefined') return;

  const css = document.createElement('style');
  css.textContent = `
    .quick{display:flex;gap:6px;margin:0 0 12px}
    .quick button{flex:1;padding:6px 4px;font-size:13px;font-weight:600}
    .quick button[aria-pressed=true]{background:var(--brand);color:var(--brand-ink)}
    .quick .clear{flex:0 0 auto;padding:6px 10px;border-color:var(--line);color:var(--muted);font-weight:400}`;
  document.head.append(css);

  const yearOf = t => (/Year\s*(\d+)/.exec(t.course || '') || [])[1] || '';
  const years = [...new Set(TOPICS.map(yearOf).filter(Boolean))].sort();
  const choices = [{ id: 'all', label: 'All', title: 'Tick every lesson', on: () => true },
    ...years.map(y => ({ id: 'y' + y, label: 'Yr ' + y, title: `Tick every Year ${y} lesson only`, on: t => yearOf(t) === y }))];

  const bar = document.createElement('div');
  bar.className = 'quick'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Quick select');
  bar.innerHTML = choices.map(c => `<button type="button" data-q="${c.id}" title="${c.title}" aria-pressed="false">${c.label}</button>`).join('')
    + '<button type="button" class="clear" data-q="clear" title="Untick everything">Clear</button>';
  box.before(bar);

  const panels = () => [...box.querySelectorAll('details[data-topic]')];
  const topicOf = det => TOPICS.find(t => t.id === det.dataset.topic);
  function syncTopic(det) {
    const ls = [...det.querySelectorAll('.lsel')], n = ls.filter(x => x.checked).length, ts = det.querySelector('.tsel');
    if (ts) { ts.checked = n === ls.length; ts.indeterminate = n > 0 && n < ls.length }
  }
  // light up the button that matches the current ticks exactly
  function mark() {
    const ticked = det => det.querySelectorAll('.lsel:checked').length;
    const full = det => ticked(det) === det.querySelectorAll('.lsel').length;
    bar.querySelectorAll('[data-q]').forEach(b => {
      const c = choices.find(x => x.id === b.dataset.q);
      if (!c) return;
      const match = panels().every(det => c.on(topicOf(det)) ? full(det) : ticked(det) === 0);
      b.setAttribute('aria-pressed', String(match && box.querySelector('.lsel:checked') !== null));
    });
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const c = choices.find(x => x.id === b.dataset.q);
    panels().forEach(det => {
      const on = c ? c.on(topicOf(det)) : false;
      det.querySelectorAll('.lsel').forEach(x => { x.checked = on });
      syncTopic(det);
      if (c && c.id !== 'all') det.open = on;      // a year opens its own topics and folds the others away
    });
    mark();
  });
  box.addEventListener('change', mark);
  mark();
});
