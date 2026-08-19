/* Forest Shuffle -- card compendium
   Browse / Focus / Web views over the card set and the relations between cards.
   No libraries: the relation lines are hand-drawn SVG beziers measured off the
   real DOM, and the Web view runs a small spring/repulsion simulation. */
(function () {
'use strict';

/* ================================================================ index */

const CW = 300, CH = 466;                 // nominal card size in the sheets
const ALIAS = {}, BYKEY = {};
FS.species.forEach(sp => { if (sp.alias) ALIAS[sp.k] = sp.alias; else BYKEY[sp.k] = sp; });
const SPECIES = FS.species.filter(sp => !sp.alias);
const deref = k => BYKEY[ALIAS[k] || k];

/* cards per species, remembering which half the species sits on */
const CARDS_OF = {};
SPECIES.forEach(sp => CARDS_OF[sp.k] = []);
const HALF = {T: ['tree'], W: ['winter'], V: ['top', 'bottom'], H: ['left', 'right']};
FS.cards.forEach(card => {
  const [id, layout, , , , species, symbols, , printed] = card;
  species.forEach((raw, i) => {
    if (!raw) return;
    const sp = deref(raw);
    if (!sp) return;
    CARDS_OF[sp.k].push({
      card, id, layout,
      half: (HALF[layout][i] || HALF[layout][0]),
      symbol: (symbols && symbols[i]) || null,
      partner: species[1 - i] ? deref(species[1 - i]) : null,
      printedAs: (printed && printed[i]) || null
    });
  });
});
SPECIES.forEach(sp => {
  sp.printings = CARDS_OF[sp.k];
  sp.count = sp.printings.length;
  sp.rep = sp.printings.find(p => p.card[2] !== null) || sp.printings[0];
  sp.halves = [...new Set(sp.printings.map(p => p.half))];
  sp.symbols = {};
  sp.printings.forEach(p => { if (p.symbol) sp.symbols[p.symbol] = (sp.symbols[p.symbol] || 0) + 1; });
});

const BY_TAG = {};
Object.keys(FS.tags).forEach(t => BY_TAG[t] = SPECIES.filter(sp => (sp.tags || []).includes(t)));

/* ---------------------------------------------------------------- nodes */
/* a node is either a species (sp:<key>), a concept (c:#foo) or,
   in the Web view only, a type hub (tag:<Tag>) */
const NODES = {};
SPECIES.forEach(sp => NODES['sp:' + sp.k] = {id: 'sp:' + sp.k, kind: 'sp', sp, name: sp.n});
Object.keys(FS.concepts).forEach(c => NODES['c:' + c] = {id: 'c:' + c, kind: 'c', c, name: FS.concepts[c].name, hint: FS.concepts[c].hint});
Object.keys(FS.tags).forEach(t => NODES['tag:' + t] = {id: 'tag:' + t, kind: 'tag', tag: t, name: FS.tags[t].plural || FS.tags[t].label});

/* short, shareable ids for the URL */
const slugify = t => String(t).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SLUG_TO_ID = {}, ID_TO_SLUG = {};
Object.values(NODES).forEach(n => {
  if (n.kind === 'tag') return;
  let sl = slugify(n.kind === 'c' ? 'the-' + n.name : n.name);
  if (SLUG_TO_ID[sl]) sl += '-' + (n.kind === 'c' ? 'concept' : 'card');
  SLUG_TO_ID[sl] = n.id; ID_TO_SLUG[n.id] = sl;
});

const CONCEPT_GLYPH = {
  '#trees': '🌲', '#treeSpecies': '🧬', '#sapling': '🌱', '#cave': '🕳', '#clearing': '🍃',
  '#fullTree': '🎯', '#slotTop': '⬆', '#slotBottom': '⬇', '#sameTree': '🌳', '#matchSymbol': '🎨',
  '#extraTurn': '🔄', '#drawDeck': '🃏', '#opponents': '⚔', '#alone': '👤', '#hand': '🖐',
  '#discard': '♻', '#winter': '❄'
};

/* ------------------------------------------------------------ relations */
/* an edge a -> b reads "a feeds / acts on b" */
const KINDS = {
  score: {label: 'scores from',  color: 'var(--k-score)', raw: '#4fd1c5', dash: '',        w: 1.7},
  need:  {label: 'needs',        color: 'var(--k-need)',  raw: '#ef6f5e', dash: '',        w: 2.4},
  free:  {label: 'plays free',   color: 'var(--k-free)',  raw: '#8ed46a', dash: '7 5',     w: 1.8},
  draw:  {label: 'draws on',     color: 'var(--k-draw)',  raw: '#e8c04a', dash: '2 5',     w: 1.8},
  boost: {label: 'boosts',       color: 'var(--k-boost)', raw: '#bb8cf0', dash: '',        w: 2},
  share: {label: 'shares slot',  color: 'var(--k-share)', raw: '#6aa8f0', dash: '10 4 2 4',w: 1.8},
  gain:  {label: 'gains',        color: 'var(--k-gain)',  raw: '#89a596', dash: '4 4',     w: 1.3},
  pair:  {label: 'same card',    color: 'var(--k-pair)',  raw: '#b09a80', dash: '3 6',     w: 1.2}
};
const TOWARDS_SELF = {score: 1, need: 1, draw: 1};   // target feeds the species

const EDGES = [], WEB_EDGES = [];
function push(list, a, b, kind, label) {
  if (!a || !b || a === b) return;
  list.push({a, b, kind, label: label || KINDS[kind].label});
}
function targetsOf(tk, v) {
  if (tk === 'tag') return (BY_TAG[v] || []).map(sp => 'sp:' + sp.k);
  if (tk === 'sp') { const sp = BYKEY[v] || SPECIES.find(x => x.n === v); return sp ? ['sp:' + sp.k] : []; }
  if (tk === 'tree') { const sp = BYKEY[v]; return sp ? ['sp:' + sp.k] : []; }
  if (tk === 'c') return ['c:' + v];
  return [];
}
SPECIES.forEach(sp => {
  const me = 'sp:' + sp.k;
  (sp.refs || []).forEach(([kind, tk, v, label]) => {
    const inward = TOWARDS_SELF[kind];
    targetsOf(tk, v).forEach(t => inward ? push(EDGES, t, me, kind, label) : push(EDGES, me, t, kind, label));
    /* web view: collapse type groups into one hub */
    const wt = tk === 'tag' ? ['tag:' + v] : targetsOf(tk, v);
    wt.forEach(t => inward ? push(WEB_EDGES, t, me, kind, label) : push(WEB_EDGES, me, t, kind, label));
  });
});
/* structural edges so the concept hubs actually connect to something */
SPECIES.forEach(sp => {
  const me = 'sp:' + sp.k;
  const add = (c, l) => { push(EDGES, me, 'c:' + c, 'gain', l); push(WEB_EDGES, me, 'c:' + c, 'gain', l); };
  if (sp.halves.includes('top')) add('#slotTop', 'sits atop a tree');
  if (sp.halves.includes('bottom')) add('#slotBottom', 'sits below a tree');
  if ((sp.tags || []).includes('Tree')) { add('#trees', 'is a tree'); add('#treeSpecies', 'is a tree species'); }
});
/* two halves of one physical card: you only ever get one of them */
const seenPair = {};
FS.cards.forEach(c => {
  if (c[5].length !== 2) return;
  const [x, y] = c[5].map(deref);
  if (!x || !y || x === y) return;
  const key = [x.k, y.k].sort().join('|');
  (seenPair[key] = seenPair[key] || {a: 'sp:' + x.k, b: 'sp:' + y.k, kind: 'pair', ids: []}).ids.push(c[0]);
});
const PAIRS = Object.values(seenPair);
PAIRS.forEach(p => { p.label = p.ids.length + ' shared card' + (p.ids.length > 1 ? 's' : ''); EDGES.push(p); });

const REL = {};
function rel(id) {
  if (REL[id]) return REL[id];
  const out = [], inn = [], pair = [];
  EDGES.forEach(e => {
    if (e.kind === 'pair') {
      if (e.a === id) pair.push({node: NODES[e.b], kind: 'pair', label: e.label, ids: e.ids});
      else if (e.b === id) pair.push({node: NODES[e.a], kind: 'pair', label: e.label, ids: e.ids});
      return;
    }
    if (e.a === id && NODES[e.b]) out.push({node: NODES[e.b], kind: e.kind, label: e.label});
    else if (e.b === id && NODES[e.a]) inn.push({node: NODES[e.a], kind: e.kind, label: e.label});
  });
  const dedupe = arr => {
    const m = new Map();
    arr.forEach(r => { const k = r.node.id + '|' + r.kind; if (!m.has(k)) m.set(k, r); });
    return [...m.values()];
  };
  return REL[id] = {out: dedupe(out), in: dedupe(inn), pair: dedupe(pair)};
}
/* combos that run through a shared concept: A boosts #cave, B scores from #cave */
function combos(id) {
  const r = rel(id), res = [];
  const mine = new Map();
  r.out.filter(x => x.node.kind === 'c').forEach(x => mine.set(x.node.id, 'gives'));
  r.in.filter(x => x.node.kind === 'c').forEach(x => mine.set(x.node.id, 'takes'));
  mine.forEach((side, cid) => {
    EDGES.forEach(e => {
      if (e.kind === 'pair') return;
      const other = side === 'gives' ? (e.a === cid ? e.b : null) : (e.b === cid ? e.a : null);
      if (!other || other === id || !NODES[other] || NODES[other].kind !== 'sp') return;
      res.push({node: NODES[other], via: NODES[cid], kind: e.kind, label: e.label});
    });
  });
  const m = new Map();
  res.forEach(x => { const k = x.node.id + '|' + x.via.id; if (!m.has(k)) m.set(k, x); });
  return [...m.values()];
}

/* ================================================================ groups */
const GROUP_DEFS = {
  type: {
    order: ['Tree', 'Shrub', 'Bird', 'Bat', 'Butterfly', 'Insect', 'Paw', 'Cloven', 'Amphibian', 'Plant', 'Mushroom', 'Other', 'Concept'],
    label: {Tree: 'Trees', Shrub: 'Shrubs', Bird: 'Birds', Bat: 'Bats', Butterfly: 'Butterflies', Insect: 'Insects',
            Paw: 'Pawed animals', Cloven: 'Cloven-hoofed & deer', Amphibian: 'Amphibians', Plant: 'Plants',
            Mushroom: 'Mushrooms', Other: 'Odd ones out', Concept: 'Game concepts'},
    color: {Tree: '#4c9a5a', Shrub: '#79bd7a', Bird: '#58a8d8', Bat: '#8a7fb8', Butterfly: '#b072c8', Insect: '#46b39a',
            Paw: '#e08a4a', Cloven: '#c9a227', Amphibian: '#4fbf9f', Plant: '#6cc24a', Mushroom: '#d4746a',
            Other: '#8ea795', Concept: '#c9b98a'},
    of: sp => {
      const t = sp.tags || [];
      if (t.includes('Shrub')) return 'Shrub';
      if (t.includes('Tree')) return 'Tree';
      if (t.includes('Butterfly')) return 'Butterfly';
      if (t.includes('Bat')) return 'Bat';
      if (t.includes('Bird')) return 'Bird';
      if (t.includes('Mushroom')) return 'Mushroom';
      if (t.includes('Amphibian')) return 'Amphibian';
      if (t.includes('Plant')) return 'Plant';
      if (t.includes('Insect')) return 'Insect';
      if (t.includes('Deer') || t.includes('Cloven-hoofed animal')) return 'Cloven';
      if (t.includes('Paw')) return 'Paw';
      return 'Other';
    }
  },
  slot: {
    order: ['tree', 'shrub', 'top', 'side', 'bottom', 'winter', 'Concept'],
    label: {tree: 'Trees -- stand alone, four slots', shrub: 'Shrubs -- four slots, but no tree', top: 'Treetop -- top slot',
            side: 'Trunk -- left or right slot', bottom: 'Ground -- bottom slot', winter: 'Winter -- never played', Concept: 'Game concepts'},
    color: {tree: '#4c9a5a', shrub: '#79bd7a', top: '#58a8d8', side: '#e08a4a', bottom: '#6cc24a', winter: '#9fc0d4', Concept: '#c9b98a'},
    of: sp => sp.slot
  },
  set: {
    order: ['b', 'a', 'e', 'x', 'Concept'],
    label: {b: 'Base game', a: 'Alpine expansion', e: 'Woodland Edge expansion', x: 'Exploration -- rare cards', Concept: 'Game concepts'},
    color: {b: '#7ec46a', a: '#b9a7d6', e: '#8fd0a8', x: '#e6a04a', Concept: '#c9b98a'},
    of: sp => sp.set
  },
  cost: {
    order: ['0', '1', '2', '3', '-', 'Concept'],
    label: {'0': 'Costs nothing', '1': 'Costs 1 card', '2': 'Costs 2 cards', '3': 'Costs 3 cards', '-': 'Not played', Concept: 'Game concepts'},
    color: {'0': '#8fd0a8', '1': '#cdd07a', '2': '#e0a838', '3': '#e07a4a', '-': '#9fc0d4', Concept: '#c9b98a'},
    of: sp => sp.cost === null || sp.cost === undefined ? '-' : String(sp.cost)
  }
};

/* ================================================================ state */
const state = {
  view: 'browse',
  group: 'type',
  sets: new Set(['b', 'a', 'e', 'x']),
  q: '',
  sel: null,
  isolate: true
};

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

/* ============================================================== sprites */
function sheetOf(card) { return card[2] === null ? null : FS.sheets[card[2]]; }
function fullCardStyle(card) {
  const sh = sheetOf(card);
  if (!sh) return null;
  return {
    backgroundImage: `url(${sh.file})`,
    backgroundSize: (sh.cols * 100) + '%',
    backgroundPosition: (sh.cols > 1 ? card[3] * 100 / (sh.cols - 1) : 0) + '% ' + (sh.rows > 1 ? card[4] * 100 / (sh.rows - 1) : 0) + '%'
  };
}
const FOCUS_RECT = {
  tree:   {x: 24, y: 58, w: 252, h: 208},
  top:    {x: 24, y: 18, w: 252, h: 152},
  bottom: {x: 24, y: 248, w: 252, h: 152},
  left:   {x: 10, y: 40, w: 130, h: 166},
  right:  {x: 160, y: 40, w: 130, h: 166},
  winter: {x: 24, y: 58, w: 252, h: 208}
};
function avatarStyle(pr, D) {
  const sh = sheetOf(pr.card);
  if (!sh) return null;
  const cw = sh.w / sh.cols, ch = sh.h / sh.rows;
  const r = FOCUS_RECT[pr.half] || FOCUS_RECT.tree;
  const rx = r.x / CW * cw, ry = r.y / CH * ch, rw = r.w / CW * cw, rh = r.h / CH * ch;
  const s = Math.max(D / rw, D / rh);
  return {
    backgroundImage: `url(${sh.file})`,
    backgroundSize: (sh.w * s) + 'px ' + (sh.h * s) + 'px',
    backgroundPosition: (-(pr.card[3] * cw + rx) * s) + 'px ' + (-(pr.card[4] * ch + ry) * s) + 'px'
  };
}
function applyStyle(node, st) { if (st) Object.assign(node.style, st); }

/* dim the half that does not belong to this species */
const MASK = {
  top:    'linear-gradient(180deg,transparent 46%,rgba(6,14,10,.74) 54%)',
  bottom: 'linear-gradient(0deg,transparent 46%,rgba(6,14,10,.74) 54%)',
  left:   'linear-gradient(90deg,transparent 46%,rgba(6,14,10,.74) 54%)',
  right:  'linear-gradient(270deg,transparent 46%,rgba(6,14,10,.74) 54%)'
};
const FRAME = {
  top:    {left: '3%', top: '2%', width: '94%', height: '46%'},
  bottom: {left: '3%', top: '52%', width: '94%', height: '46%'},
  left:   {left: '2%', top: '2%', width: '46%', height: '96%'},
  right:  {left: '52%', top: '2%', width: '46%', height: '96%'}
};
const SLOT_WORD = {tree: 'Tree', shrub: 'Shrub', top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right', side: 'Left / right', winter: 'Winter'};

/* ================================================================ tiles */
function cardArt(sp, big) {
  const art = el('div', 'art');
  const pr = sp.rep;
  const st = pr && fullCardStyle(pr.card);
  if (st) {
    applyStyle(art, st);
    if (MASK[pr.half]) { const m = el('div', 'mask'); m.style.background = MASK[pr.half]; art.appendChild(m); }
    if (FRAME[pr.half]) { const f = el('div', 'frame'); Object.assign(f.style, FRAME[pr.half]); art.appendChild(f); }
  } else {
    art.className = 'art plate';
    art.innerHTML = `<div><div class="pg" style="font-size:38px">${PLATE_GLYPH(sp)}</div>
      <div class="pt">${esc(FS.sets[sp.set].short)} · no scan</div></div>`;
  }
  if (!big) {
    art.appendChild(el('span', 'slotbadge', SLOT_WORD[sp.slot] || ''));
    if (sp.cost !== null && sp.cost !== undefined) art.appendChild(el('span', 'cost', sp.cost));
  }
  return art;
}
function PLATE_GLYPH(sp) {
  const t = sp.tags || [];
  if (/Christmas/.test(sp.n)) return '🎄';
  if (/Oak/.test(sp.n)) return '🌳';
  if (t.includes('Tree')) return '🌴';
  if (t.includes('Bird')) return '🐦';
  if (t.includes('Butterfly')) return '🦋';
  if (t.includes('Plant')) return '🌸';
  if (t.includes('Deer')) return '🦌';
  if (t.includes('Paw')) return '🐾';
  return '✦';
}
function tileFor(sp) {
  const t = el('div', 'tile');
  t.dataset.id = 'sp:' + sp.k;
  t.appendChild(cardArt(sp));
  const meta = el('div', 'meta');
  meta.appendChild(el('span', 'nm', esc(sp.n)));
  const sub = el('div', 'sub');
  sub.innerHTML = `<span>${sp.count}×</span><span>${FS.sets[sp.set].short}</span>`;
  const dots = el('div', 'dots');
  Object.keys(sp.symbols).forEach(s => {
    const i = el('i'); i.style.background = FS.symbols[s] ? FS.symbols[s].color : '#666';
    i.title = (FS.symbols[s] ? FS.symbols[s].name : s) + ' symbol × ' + sp.symbols[s];
    dots.appendChild(i);
  });
  sub.appendChild(dots);
  meta.appendChild(sub);
  t.appendChild(meta);
  t.appendChild(el('span', 'arrowbadge', ''));
  t.addEventListener('click', () => select('sp:' + sp.k));
  return t;
}
function conceptTile(node) {
  const t = el('div', 'tile concept');
  t.dataset.id = node.id;
  const art = el('div', 'art');
  art.appendChild(el('div', 'cg', CONCEPT_GLYPH[node.c] || '◆'));
  t.appendChild(art);
  const meta = el('div', 'meta');
  meta.appendChild(el('span', 'nm', esc(node.name)));
  meta.appendChild(el('div', 'sub', '<span>concept</span>'));
  t.appendChild(meta);
  t.appendChild(el('span', 'arrowbadge', ''));
  t.addEventListener('click', () => select(node.id));
  return t;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])); }

/* ============================================================== browse */
let browseSvg = null;
function visibleSpecies() {
  const q = state.q.trim().toLowerCase();
  return SPECIES.filter(sp => {
    if (!state.sets.has(sp.set)) return false;
    if (!q) return true;
    if (!sp._hay) sp._hay = [sp.n, sp.sci, sp.k, (sp.tags || []).join(' '), sp.fx, sp.bn, sp.pt,
      (sp.note || []).join(' '), FS.slots[sp.slot] && FS.slots[sp.slot].name, FS.sets[sp.set].name,
      sp.printings.map(p => (typeof p.id === 'number' ? String(p.id).padStart(3, '0') + ' ' + p.id : p.id) + ' ' + (p.printedAs || '')).join(' '),
      Object.keys(sp.symbols).join(' ')].join(' ').toLowerCase();
    return sp._hay.includes(q);
  });
}
function renderBrowse() {
  const host = $('#browse');
  host.innerHTML = '';
  const g = GROUP_DEFS[state.group];
  const list = visibleSpecies();
  const buckets = {};
  list.forEach(sp => { const k = g.of(sp); (buckets[k] = buckets[k] || []).push(sp); });
  const q = state.q.trim().toLowerCase();
  const conceptList = Object.values(NODES).filter(n => n.kind === 'c' &&
    (!q || (n.name + ' ' + n.hint).toLowerCase().includes(q)));
  if (conceptList.length) buckets.Concept = conceptList;

  g.order.forEach(key => {
    const items = buckets[key];
    if (!items || !items.length) return;
    const sec = el('div', 'group');
    const color = g.color[key] || '#8ea795';
    const h = el('h2');
    h.innerHTML = `<span class="swatch" style="background:${color};color:${color}"></span>${esc(g.label[key] || key)}
                   <span class="rule"></span><span class="n">${items.length}</span>`;
    sec.appendChild(h);
    const grid = el('div', 'grid');
    if (key === 'Concept') items.forEach(n => grid.appendChild(conceptTile(n)));
    else items.slice().sort(sortSpecies).forEach(sp => grid.appendChild(tileFor(sp)));
    sec.appendChild(grid);
    host.appendChild(sec);
  });
  if (!host.children.length) host.appendChild(el('p', 'fx-empty', 'Nothing matches that search.'));

  browseSvg = mkSvg();
  host.appendChild(browseSvg);
  const deck = new Set();
  list.forEach(sp => sp.printings.forEach(p => deck.add(p.id)));
  $('#count').innerHTML = `<b>${list.length}</b> entries · <b>${deck.size}</b> cards in the box`;
  paintSelection();
}
function sortSpecies(a, b) {
  if (state.group === 'cost' || state.group === 'set' || state.group === 'slot') {
    const t = (GROUP_DEFS.type.order.indexOf(GROUP_DEFS.type.of(a)) - GROUP_DEFS.type.order.indexOf(GROUP_DEFS.type.of(b)));
    if (t) return t;
  }
  if (a.cost !== b.cost && state.group === 'type') return (a.cost || 0) - (b.cost || 0);
  return a.n.localeCompare(b.n);
}

/* ======================================================== link drawing */
const NS = 'http://www.w3.org/2000/svg';
function svgEl(t, attrs) { const n = document.createElementNS(NS, t); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
function mkSvg() {
  const s = svgEl('svg', {class: 'links'});
  const defs = svgEl('defs');
  Object.keys(KINDS).forEach(k => {
    const m = svgEl('marker', {id: 'ah-' + k, viewBox: '0 0 10 10', refX: '8.5', refY: '5',
      markerWidth: '5.5', markerHeight: '5.5', orient: 'auto-start-reverse'});
    m.appendChild(svgEl('path', {d: 'M0,1 L9.5,5 L0,9 L2.4,5 Z', fill: KINDS[k].raw}));
    defs.appendChild(m);
  });
  s.appendChild(defs);
  return s;
}
function anchor(r, tx, ty) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  let dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return {x: cx, y: cy};
  const sx = (r.w / 2 + 4) / Math.abs(dx || 1e-6), sy = (r.h / 2 + 4) / Math.abs(dy || 1e-6);
  const s = Math.min(sx, sy);
  return {x: cx + dx * s, y: cy + dy * s};
}
function bez(a, b, bend) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d, k = Math.min(d * 0.26, 150) * bend;
  const c1 = {x: a.x + dx * 0.32 + nx * k, y: a.y + dy * 0.32 + ny * k};
  const c2 = {x: a.x + dx * 0.68 + nx * k, y: a.y + dy * 0.68 + ny * k};
  return {d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
          mid: {x: (a.x + b.x) / 2 + nx * k * 0.75, y: (a.y + b.y) / 2 + ny * k * 0.75}};
}
function drawLinks(svg, host, pairsList, opts) {
  opts = opts || {};
  while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
  const hb = host.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${host.scrollWidth} ${host.scrollHeight}`);
  svg.setAttribute('width', host.scrollWidth);
  svg.setAttribute('height', host.scrollHeight);
  const rectOf = node => {
    const b = node.getBoundingClientRect();
    return {x: b.left - hb.left + host.scrollLeft, y: b.top - hb.top + host.scrollTop, w: b.width, h: b.height};
  };
  const labelled = pairsList.length <= (opts.maxLabels != null ? opts.maxLabels : 11);
  pairsList.forEach((p, i) => {
    if (!p.from || !p.to) return;
    const ra = rectOf(p.from), rb = rectOf(p.to);
    const a = anchor(ra, rb.x + rb.w / 2, rb.y + rb.h / 2);
    const b = anchor(rb, ra.x + ra.w / 2, ra.y + ra.h / 2);
    const dd = Math.hypot((rb.x + rb.w / 2) - (ra.x + ra.w / 2), (rb.y + rb.h / 2) - (ra.y + ra.h / 2));
    const soft = (opts.flat ? 0.22 : 1) * (dd < 190 ? 0.35 : 1);
    const bend = (i % 2 ? 1 : -1) * (0.5 + (i % 5) * 0.15) * soft;
    const g = bez(a, b, bend);
    const K = KINDS[p.kind];
    const halo = svgEl('path', {d: g.d, stroke: 'rgba(4,10,8,.85)', 'stroke-width': K.w + 3.4, opacity: '.75'});
    svg.appendChild(halo);
    const path = svgEl('path', {d: g.d, stroke: K.raw, 'stroke-width': K.w, opacity: '.95',
      'marker-end': `url(#ah-${p.kind})`});
    if (K.dash) { path.setAttribute('stroke-dasharray', K.dash); path.setAttribute('class', 'anim'); }
    svg.appendChild(path);
    if (labelled && p.label) {
      const t = svgEl('text', {x: g.mid.x, y: g.mid.y, class: 'lab', 'text-anchor': 'middle'});
      t.textContent = p.label;
      svg.appendChild(t);
    }
  });
}

/* ============================================================ selection */
function paintSelection() {
  document.body.classList.toggle('selecting', !!state.sel);
  document.body.classList.toggle('isolate', state.isolate);
  document.querySelectorAll('#browse .tile').forEach(t => t.classList.remove('sel', 'linked', 'dir-in', 'dir-out', 'dir-both'));
  if (browseSvg) drawLinks(browseSvg, $('#browse'), []);
  if (!state.sel) { collapseEmptyGroups(); closePanel(); return; }

  const r = rel(state.sel);
  const dir = {};
  r.in.forEach(x => dir[x.node.id] = (dir[x.node.id] === 'out' || dir[x.node.id] === 'both') ? 'both' : 'in');
  r.out.forEach(x => dir[x.node.id] = (dir[x.node.id] === 'in' || dir[x.node.id] === 'both') ? 'both' : 'out');
  r.pair.forEach(x => { if (!dir[x.node.id]) dir[x.node.id] = 'both'; });

  const tiles = {};
  document.querySelectorAll('#browse .tile').forEach(t => tiles[t.dataset.id] = t);
  const selTile = tiles[state.sel];
  if (selTile) selTile.classList.add('sel');
  Object.keys(dir).forEach(id => {
    const t = tiles[id];
    if (!t) return;
    t.classList.add('linked', 'dir-' + dir[id]);
    t.querySelector('.arrowbadge').textContent = dir[id] === 'in' ? 'affects it' : dir[id] === 'out' ? 'affected' : 'both ways';
  });

  openPanel(state.sel);
  if (state.view === 'browse') requestAnimationFrame(() => {
    collapseEmptyGroups();
    if (selTile) {
      const b = selTile.getBoundingClientRect();
      if (b.top < 130 || b.bottom > innerHeight - 20) selTile.scrollIntoView({block: 'center', behavior: 'smooth'});
    }
    if (!selTile) return;
    const live = n => n && n.offsetParent !== null;
    const lines = [];
    r.in.forEach(x => { if (live(tiles[x.node.id])) lines.push({from: tiles[x.node.id], to: selTile, kind: x.kind, label: x.label}); });
    r.out.forEach(x => { if (live(tiles[x.node.id])) lines.push({from: selTile, to: tiles[x.node.id], kind: x.kind, label: x.label}); });
    r.pair.forEach(x => { if (live(tiles[x.node.id])) lines.push({from: selTile, to: tiles[x.node.id], kind: 'pair', label: x.label}); });
    requestAnimationFrame(() => drawLinks(browseSvg, $('#browse'), lines));
  });
  if (state.view === 'focus') renderFocus();
  if (state.view === 'web') { if (web) web.alpha = Math.max(web.alpha, .55); paintWeb(); }
}
function collapseEmptyGroups() {
  const hide = state.isolate && !!state.sel;
  document.querySelectorAll('#browse .group').forEach(g => {
    if (!hide) return g.classList.remove('empty');
    const any = [...g.querySelectorAll('.tile')].some(t => t.classList.contains('linked') || t.classList.contains('sel'));
    g.classList.toggle('empty', !any);
  });
}
function select(id, keepView) {
  state.sel = state.sel === id ? null : id;
  if (!keepView && state.view === 'web') { /* stay */ }
  history.replaceState(null, '', hashFor());
  paintSelection();
}

/* ================================================================ panel */
function nodeAvatar(node, D, cls) {
  if (node.kind === 'c') { const a = el('div', (cls || 'av') + ' cn', CONCEPT_GLYPH[node.c] || '◆'); return a; }
  if (node.kind === 'tag') { const a = el('div', (cls || 'av') + ' cn', FS.tags[node.tag].glyph); return a; }
  const a = el('div', cls || 'av');
  const st = node.sp.rep && avatarStyle(node.sp.rep, D);
  if (st) applyStyle(a, st);
  else { a.classList.add('cn'); a.textContent = '✦'; }
  return a;
}
function chip(text, color) {
  const c = el('span', 'chip', esc(text));
  c.style.color = color; c.style.background = hexA(color, .15); c.style.borderColor = hexA(color, .38);
  return c;
}
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(200,220,205,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function closePanel() { document.body.classList.remove('has-panel'); }
function openPanel(id) {
  const node = NODES[id];
  if (!node) return;
  document.body.classList.add('has-panel');
  const head = $('#panelhead'), body = $('#panelbody');
  head.innerHTML = ''; body.innerHTML = '';

  const ht = el('div');
  if (node.kind === 'c') {
    ht.innerHTML = `<h3 class="pname">${esc(node.name)}</h3><div class="psci">game concept</div>`;
  } else {
    const sp = node.sp;
    ht.innerHTML = `<h3 class="pname">${esc(sp.n)}</h3>` + (sp.sci ? `<div class="psci">${esc(sp.sci)}</div>` : '');
    const chips = el('div', 'pchips');
    chips.appendChild(chip(FS.sets[sp.set].name, FS.sets[sp.set].color));
    (sp.tags || []).forEach(t => chips.appendChild(chip(FS.tags[t].glyph + ' ' + FS.tags[t].label, FS.tags[t].color)));
    ht.appendChild(chips);
  }
  head.appendChild(ht);
  const go = el('button', 'ghost', 'Focus');
  go.style.cssText = 'margin-left:auto;padding:5px 10px';
  go.title = 'Spread this card out in the Focus view';
  go.onclick = () => setView('focus');
  head.appendChild(go);
  const x = el('button', 'x', '×');
  x.style.marginLeft = '6px';
  x.title = 'Close (Esc)';
  x.onclick = () => select(state.sel);
  head.appendChild(x);

  if (node.kind === 'c') {
    body.appendChild(sec('What it means', el('p', null, esc(node.hint))));
  } else {
    const sp = node.sp;
    /* hero */
    const hero = el('div', 'hero');
    const big = el('div', 'big');
    const st = sp.rep && fullCardStyle(sp.rep.card);
    if (st) {
      applyStyle(big, st);
      if (MASK[sp.rep.half]) { const m = el('div', 'mask'); m.style.background = MASK[sp.rep.half]; big.appendChild(m); }
      if (FRAME[sp.rep.half]) { const f = el('div', 'frame'); Object.assign(f.style, FRAME[sp.rep.half]); big.appendChild(f); }
    } else { big.classList.add('plate'); big.innerHTML = `<div><div class="pg">🂠</div><div class="pt">no scan</div></div>`; }
    hero.appendChild(big);
    const facts = el('div', 'facts');
    const f = (k, v) => { const d = el('div', 'fact'); d.innerHTML = `<span class="fk">${k}</span><span class="fv">${v}</span>`; facts.appendChild(d); };
    f('Goes', esc(FS.slots[sp.slot] ? FS.slots[sp.slot].name : sp.slot) + (sp.slot === 'side' ? ' (left or right)' : ''));
    f('Cost', sp.cost === null || sp.cost === undefined ? 'not played' : sp.cost === 0 ? 'free' : sp.cost + ' card' + (sp.cost > 1 ? 's' : ''));
    f('Copies', sp.count + ' in the game');
    const syms = Object.keys(sp.symbols);
    f('Colours', syms.length
      ? syms.map(s => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:7px;white-space:nowrap"><i style="width:9px;height:9px;border-radius:50%;background:${FS.symbols[s] ? FS.symbols[s].color : '#777'};display:inline-block"></i>${esc(FS.symbols[s] ? FS.symbols[s].name : s)}${sp.symbols[s] > 1 ? ' ×' + sp.symbols[s] : ''}</span>`).join('')
      : '<span style="color:var(--ink3)">not recorded</span>');
    hero.appendChild(facts);
    body.appendChild(hero);

    /* rules text */
    const rules = el('div');
    if (sp.fx) rules.appendChild(box('eff', 'Effect', sp.fx));
    if (sp.bn) rules.appendChild(box('bon', 'Bonus', sp.bn));
    if (sp.pt) rules.appendChild(box('pts', 'Points', sp.pt));
    body.appendChild(sec('What it does', rules));

    /* relations */
    const r = rel(id);
    if (r.in.length) body.appendChild(sec('Affected by <span style="color:var(--in)">' + r.in.length + '</span>', relList(r.in)));
    if (r.out.length) body.appendChild(sec('Affects <span style="color:var(--out)">' + r.out.length + '</span>', relList(r.out)));
    if (r.pair.length) body.appendChild(sec('Shares a card with', relList(r.pair)));
    const cb = combos(id);
    if (cb.length) {
      const wrap = el('div', 'rel-list');
      cb.slice(0, 24).forEach(c => {
        const row = el('div', 'rel');
        row.appendChild(nodeAvatar(c.node, 30));
        row.appendChild(el('div', 'rt', `<b>${esc(c.node.name)}</b><s>via ${esc(c.via.name.toLowerCase())}</s>`));
        const kt = el('span', 'kindtag', KINDS[c.kind].label);
        kt.style.color = KINDS[c.kind].raw; kt.style.background = hexA(KINDS[c.kind].raw, .14);
        row.appendChild(kt);
        row.onclick = () => select(c.node.id);
        wrap.appendChild(row);
      });
      body.appendChild(sec('Combos through the same thing', wrap));
    }

    /* printings */
    const pl = el('div', 'printings');
    sp.printings.forEach(p => {
      const row = el('div', 'pr');
      const sym = p.symbol ? (FS.symbols[p.symbol] || {name: p.symbol, color: '#777'}) : null;
      row.innerHTML = `<span class="id">${typeof p.id === 'number' ? String(p.id).padStart(3, '0') : p.id}</span>` +
        (sym ? `<span class="sy" style="background:${sym.color}" title="${esc(sym.name)} symbol"></span>` : `<span class="sy" style="background:#3a4a40" title="unrecorded"></span>`) +
        `<span class="wh">${esc(p.half)}</span>` +
        `<span class="pw">${p.printedAs ? '“' + esc(p.printedAs) + '” · ' : ''}${p.partner ? 'with ' + esc(p.partner.n) : '—'}</span>`;
      if (p.partner) row.onclick = () => select('sp:' + p.partner.k);
      pl.appendChild(row);
    });
    body.appendChild(sec('All ' + sp.count + ' printings', pl));

    if (sp.note && sp.note.length) {
      const ul = el('ul', 'notes');
      sp.note.forEach(n => ul.appendChild(el('li', null, esc(n))));
      body.appendChild(sec('Worth knowing', ul));
    }
  }
  body.scrollTop = 0;
}
function sec(title, content) {
  const s = el('div', 'sec');
  s.appendChild(el('h4', null, title));
  s.appendChild(content);
  return s;
}
function box(cls, k, text) {
  const b = el('div', 'rule-box ' + cls);
  b.innerHTML = `<span class="rk">${k}</span><p>${esc(text)}</p>`;
  return b;
}
function relList(arr) {
  const wrap = el('div', 'rel-list');
  arr.slice().sort((a, b) => a.kind.localeCompare(b.kind) || a.node.name.localeCompare(b.node.name)).forEach(x => {
    const row = el('div', 'rel');
    row.appendChild(nodeAvatar(x.node, 30));
    row.appendChild(el('div', 'rt', `<b>${esc(x.node.name)}</b><s>${esc(x.label || KINDS[x.kind].label)}</s>`));
    const kt = el('span', 'kindtag', KINDS[x.kind].label);
    kt.style.color = KINDS[x.kind].raw; kt.style.background = hexA(KINDS[x.kind].raw, .14);
    row.appendChild(kt);
    row.onclick = () => select(x.node.id);
    wrap.appendChild(row);
  });
  return wrap;
}

/* ================================================================ focus */
let focusSvg = null;
function renderFocus() {
  const host = $('#focus');
  host.innerHTML = '';
  if (!state.sel) {
    host.appendChild(el('p', 'fx-empty', 'Pick a card in Browse (or search for one) to see its relations spread out.'));
    const grid = el('div', 'grid');
    ['sp:Violet Carpenter Bee', 'sp:European Hare', 'sp:Goshawk', 'sp:Chanterelle', 'sp:Silver Fir', 'sp:Mole', 'sp:Urtica', 'sp:Wolf']
      .forEach(id => { if (NODES[id]) grid.appendChild(tileFor(NODES[id].sp)); });
    const s = el('div', 'group');
    s.appendChild(el('h2', null, '<span class="swatch" style="background:#c9b98a;color:#c9b98a"></span>Good places to start<span class="rule"></span>'));
    s.appendChild(grid);
    host.appendChild(s);
    return;
  }
  const node = NODES[state.sel], r = rel(state.sel);
  const wrap = el('div', 'fx-wrap');
  const left = el('div', 'fx-col left'), mid = el('div', 'fx-mid'), right = el('div', 'fx-col right');

  const lh = el('div', 'fx-side-h');
  lh.innerHTML = `<span class="dot" style="background:var(--in)"></span>affects it · ${r.in.length}`;
  left.appendChild(lh);
  left.appendChild(buckets(r.in, 'in'));

  const hero = el('div', 'fx-hero');
  hero.appendChild(node.kind === 'c' ? conceptTile(node) : tileFor(node.sp));
  hero.querySelector('.tile').classList.add('sel');
  mid.appendChild(hero);
  if (r.pair.length) {
    const ph = el('div', 'fx-side-h');
    ph.innerHTML = `<span class="dot" style="background:var(--k-pair)"></span>shares a card with · ${r.pair.length}`;
    mid.appendChild(ph);
    const pw = el('div', 'fx-pairs');
    r.pair.slice().sort((a, b) => a.node.name.localeCompare(b.node.name)).forEach(x => {
      const c = el('div', 'pc');
      c.appendChild(nodeAvatar(x.node, 22));
      c.appendChild(el('b', null, esc(x.node.name)));
      c.title = x.label;
      c.onclick = () => select(x.node.id);
      pw.appendChild(c);
    });
    mid.appendChild(pw);
  }

  const rh = el('div', 'fx-side-h');
  rh.innerHTML = `affected by it · ${r.out.length}<span class="dot" style="background:var(--out)"></span>`;
  right.appendChild(rh);
  right.appendChild(buckets(r.out, 'out'));

  wrap.appendChild(left); wrap.appendChild(mid); wrap.appendChild(right);
  host.appendChild(wrap);
  focusSvg = mkSvg();
  focusSvg.style.zIndex = '0';
  wrap.insertBefore(focusSvg, wrap.firstChild);

  requestAnimationFrame(() => {
    const heroTile = hero.querySelector('.tile');
    const lines = [];
    wrap.querySelectorAll('.fx-item').forEach(it => {
      const side = it.dataset.side, kind = it.dataset.kind;
      if (side === 'in') lines.push({from: it, to: heroTile, kind, label: it.dataset.label});
      else lines.push({from: heroTile, to: it, kind, label: it.dataset.label});
    });
    drawLinks(focusSvg, wrap, lines, {maxLabels: 0, flat: wrap.clientWidth < 900});
  });
}
function buckets(arr, side, flat) {
  const host = el('div');
  const byKind = {};
  arr.forEach(x => (byKind[x.kind] = byKind[x.kind] || []).push(x));
  Object.keys(byKind).sort().forEach(kind => {
    const b = el('div', 'fx-bucket');
    if (!flat) {
      const h = el('div', 'bh');
      h.innerHTML = `<span style="color:${KINDS[kind].raw}">■</span> ${side === 'in' ? invert(kind) : KINDS[kind].label}`;
      b.appendChild(h);
    }
    byKind[kind].sort((a, z) => a.node.name.localeCompare(z.node.name)).forEach(x => {
      const it = el('div', 'fx-item');
      it.dataset.side = side; it.dataset.kind = kind; it.dataset.label = x.label || '';
      it.appendChild(nodeAvatar(x.node, 34));
      it.appendChild(el('div', 'tx', `<b>${esc(x.node.name)}</b><s>${esc(x.label || KINDS[kind].label)}</s>`));
      it.onclick = () => select(x.node.id);
      b.appendChild(it);
    });
    host.appendChild(b);
  });
  if (!arr.length) host.appendChild(el('div', 'fx-empty', 'nothing'));
  return host;
}
function invert(kind) {
  return {score: 'gives it points', need: 'it cannot score without', draw: 'makes it draw',
          free: 'plays it for free', boost: 'boosts it', share: 'lets it share a slot',
          gain: 'feeds it', pair: 'same card'}[kind] || KINDS[kind].label;
}

/* ================================================================== web */
let web = null;
function buildWeb() {
  const box = $('#webbox');
  box.innerHTML = '';
  const svg = svgEl('svg', {});
  const defs = svgEl('defs');
  Object.keys(KINDS).forEach(k => {
    const m = svgEl('marker', {id: 'wah-' + k, viewBox: '0 0 10 10', refX: '9', refY: '5',
      markerWidth: '4.6', markerHeight: '4.6', orient: 'auto-start-reverse'});
    m.appendChild(svgEl('path', {d: 'M0,1.5 L9.5,5 L0,8.5 L2.4,5 Z', fill: KINDS[k].raw}));
    defs.appendChild(m);
  });
  svg.appendChild(defs);
  const gEdges = svgEl('g', {});
  svg.appendChild(gEdges);
  box.appendChild(svg);
  const layer = el('div');
  layer.style.cssText = 'position:absolute;inset:0';
  box.appendChild(layer);
  const labSvg = svgEl('svg', {});
  labSvg.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const gLab = svgEl('g', {});
  labSvg.appendChild(gLab);
  box.appendChild(labSvg);

  const active = id => {
    const n = NODES[id];
    if (!n) return false;
    if (n.kind === 'sp') return state.sets.has(n.sp.set);
    return true;
  };
  const used = new Set();
  const links = WEB_EDGES.filter(e => active(e.a) && active(e.b));
  links.forEach(e => { used.add(e.a); used.add(e.b); });
  const W = box.clientWidth, H = box.clientHeight;
  const nodes = [...used].map((id, i) => {
    const n = NODES[id];
    const big = n.kind !== 'sp';
    const ang = i / used.size * Math.PI * 2;
    return {
      id, node: n, big,
      r: big ? 26 : 17,
      x: W / 2 + Math.cos(ang) * (W * .33) * (big ? .45 : 1),
      y: H / 2 + Math.sin(ang) * (H * .38) * (big ? .45 : 1),
      vx: 0, vy: 0
    };
  });
  const idx = {}; nodes.forEach((n, i) => idx[n.id] = i);
  const L = links.map(e => ({s: idx[e.a], t: idx[e.b], kind: e.kind, label: e.label})).filter(l => l.s != null && l.t != null);

  const paths = L.map(l => {
    const p = svgEl('path', {class: 'edge', stroke: KINDS[l.kind].raw, 'stroke-width': l.kind === 'gain' ? 0.8 : 1.15,
      opacity: l.kind === 'gain' ? '.18' : '.42', 'marker-end': `url(#wah-${l.kind})`});
    if (KINDS[l.kind].dash) p.setAttribute('stroke-dasharray', KINDS[l.kind].dash);
    gEdges.appendChild(p);
    return p;
  });
  const dots = nodes.map(n => {
    const d = el('div');
    const D = n.r * 2;
    d.className = 'wn';
    d.style.cssText = `position:absolute;width:${D}px;height:${D}px;border-radius:50%;left:0;top:0;
      box-shadow:0 0 0 1.5px rgba(240,250,242,.28),0 4px 12px rgba(0,0,0,.5);
      background-repeat:no-repeat;background-color:#132019;cursor:pointer;display:grid;place-items:center;
      font-size:${n.big ? 17 : 12}px;transition:box-shadow .15s,filter .2s`;
    if (n.node.kind === 'sp') {
      const st = n.node.sp.rep && avatarStyle(n.node.sp.rep, D);
      if (st) applyStyle(d, st); else d.textContent = '✦';
    } else {
      d.style.background = 'radial-gradient(120% 100% at 50% 0,#2d4b39,#15231b)';
      d.textContent = n.node.kind === 'c' ? (CONCEPT_GLYPH[n.node.c] || '◆') : FS.tags[n.node.tag].glyph;
    }
    d.title = n.node.name;
    d.onclick = ev => { ev.stopPropagation(); select(n.id); };
    layer.appendChild(d);
    return d;
  });
  const labels = nodes.map(n => {
    if (!n.big) return null;
    const t = svgEl('text', {'text-anchor': 'middle'});
    t.textContent = n.node.name;
    gLab.appendChild(t);
    return t;
  });

  web = {box, svg, nodes, L, paths, dots, labels, idx, alpha: 1, raf: 0};

  /* drag */
  let drag = null;
  layer.addEventListener('pointerdown', ev => {
    const i = dots.indexOf(ev.target);
    if (i < 0) return;
    drag = i; nodes[i].fx = true; svg.classList.add('drag');
    ev.target.setPointerCapture(ev.pointerId);
  });
  layer.addEventListener('pointermove', ev => {
    if (drag == null) return;
    const b = box.getBoundingClientRect();
    nodes[drag].x = ev.clientX - b.left; nodes[drag].y = ev.clientY - b.top;
    web.alpha = Math.max(web.alpha, .35);
  });
  layer.addEventListener('pointerup', () => { if (drag != null) nodes[drag].fx = false; drag = null; svg.classList.remove('drag'); });
  tickWeb();
  paintWeb();
}
function tickWeb() {
  if (!web) return;
  const {nodes, L} = web;
  const W = web.box.clientWidth, H = web.box.clientHeight;
  const steps = web.alpha > .5 ? 2 : 1;
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = (Math.random() - .5); dy = (Math.random() - .5); }
        const min = (a.r + b.r + 14);
        const rep = (a.big || b.big ? 3600 : 2100) / d2;
        const d = Math.sqrt(d2);
        let f = rep;
        if (d < min) f += (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        a.vx -= ux * f; a.vy -= uy * f;
        b.vx += ux * f; b.vy += uy * f;
      }
    }
    L.forEach(l => {
      const a = nodes[l.s], b = nodes[l.t];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const hot = state.sel && (a.id === state.sel || b.id === state.sel);
      const rest = hot ? 78 : 116;
      const f = (d - rest) * (hot ? 0.03 : 0.011);
      const ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f;
      b.vx -= ux * f; b.vy -= uy * f;
    });
    nodes.forEach(n => {
      n.vx += (W / 2 - n.x) * 0.0016;
      n.vy += (H / 2 - n.y) * 0.0016;
      if (n.fx) { n.vx = n.vy = 0; return; }
      n.vx *= .84; n.vy *= .84;
      n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x + n.vx * web.alpha));
      n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y + n.vy * web.alpha));
    });
  }
  web.alpha *= .992;
  drawWeb();
  web.raf = requestAnimationFrame(tickWeb);
}
function drawWeb() {
  const {nodes, L, paths, dots, labels} = web;
  nodes.forEach((n, i) => { dots[i].style.transform = `translate(${(n.x - n.r).toFixed(1)}px,${(n.y - n.r).toFixed(1)}px)`; });
  L.forEach((l, i) => {
    const a = nodes[l.s], b = nodes[l.t];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const ax = a.x + dx / d * a.r, ay = a.y + dy / d * a.r;
    const bx = b.x - dx / d * (b.r + 3), by = b.y - dy / d * (b.r + 3);
    const nx = -(by - ay) / d * 16, ny = (bx - ax) / d * 16;
    paths[i].setAttribute('d', `M${ax.toFixed(1)},${ay.toFixed(1)} Q${((ax + bx) / 2 + nx).toFixed(1)},${((ay + by) / 2 + ny).toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`);
  });
  nodes.forEach((n, i) => { if (labels[i]) { labels[i].setAttribute('x', n.x); labels[i].setAttribute('y', n.y + n.r + 13); } });
}
function paintWeb() {
  if (!web) return;
  const {nodes, L, paths, dots} = web;
  if (!state.sel) {
    dots.forEach(d => { d.style.filter = ''; d.style.scale = '1'; d.style.zIndex = '';
      d.style.boxShadow = '0 0 0 1.5px rgba(240,250,242,.28),0 4px 12px rgba(0,0,0,.5)'; });
    paths.forEach((p, i) => p.setAttribute('opacity', L[i].kind === 'gain' ? '.18' : '.42'));
    return;
  }
  const r = rel(state.sel);
  const near = new Map();
  r.in.forEach(x => near.set(x.node.id, 'in'));
  r.out.forEach(x => near.set(x.node.id, 'out'));
  dots.forEach((d, i) => {
    const id = nodes[i].id;
    if (id === state.sel) { d.style.filter = ''; d.style.zIndex = '5'; d.style.scale = '1.9';
      d.style.boxShadow = '0 0 0 3px #f2e9d2,0 0 30px rgba(242,233,210,.55)'; }
    else if (near.has(id)) { d.style.filter = ''; d.style.zIndex = '4'; d.style.scale = '1.25';
      d.style.boxShadow = `0 0 0 2.5px ${near.get(id) === 'in' ? '#4fd1c5' : '#f2a24b'},0 0 16px rgba(0,0,0,.6)`; }
    else { d.style.filter = 'saturate(.25) brightness(.5)'; d.style.zIndex = ''; d.style.scale = '1';
      d.style.boxShadow = '0 0 0 1px rgba(240,250,242,.1)'; }
  });
  paths.forEach((p, i) => {
    const l = L[i];
    const hot = nodes[l.s].id === state.sel || nodes[l.t].id === state.sel;
    p.setAttribute('opacity', hot ? '.98' : '.06');
    p.setAttribute('stroke-width', hot ? (KINDS[l.kind].w) : (l.kind === 'gain' ? .8 : 1.1));
  });
}

/* ================================================================ rules */
const RULES_HTML = () => {
  const anat = FS.cards.find(c => c[0] === 117);
  const st = fullCardStyle(anat);
  const style = st ? `background-image:${st.backgroundImage};background-size:${st.backgroundSize};background-position:${st.backgroundPosition}` : '';
  return `<button class="x" id="rulesx" title="Close">×</button>
  <h3>Forest Shuffle in one screen</h3>
  <p class="lead">A card game by Kosch for 2-5 players. You build a forest: trees give card slots, and the animals,
  plants and mushrooms you hang on them score for each other.</p>
  <div class="cols">
    <div>
      <h5>A turn: pick A or B</h5>
      <p><b>A -- Draw two cards.</b> Each one either from the top of the deck or face up from the clearing.
      Hand limit is 10, so with 9 cards you may only draw one.</p>
      <p><b>B -- Play one card.</b> Pay its cost by putting that many <i>other</i> cards from your hand face up
      into the clearing, then place the card in your forest and use its effect, then its bonus.</p>
      <p>At the end of your turn, if the clearing holds 10 or more cards, all of them go back in the box.</p>

      <h5>Trees and slots</h5>
      <p>A tree offers four slots: top, bottom, left and right. Playing a tree also makes you flip the top card of
      the deck face up into the clearing. A tree with a card on all four sides is <b>fully occupied</b>.</p>
      <p>Instead of a tree you may play any card face down as a <b>tree sapling</b>: four slots, but no species and
      no colour. It still shows the tree symbol.</p>

      <h5>Split cards</h5>
      <p>Every non-tree card carries two creatures -- either top and bottom, or left and right. Choose one half,
      pay only its cost, and slide the unused half under the tree. Only the visible half exists from then on.
      A half can only go into an empty slot on the matching side.</p>
    </div>
    <div>
      <h5>Effect, bonus and mushrooms</h5>
      <p>The <b>effect</b> fires once when you play the card. The <b>bonus</b> (the coloured arrow) only fires if
      every card you paid with shows the <i>same tree symbol</i> as the card you are playing -- which half of a
      split payment card shows it does not matter.</p>
      <p>Mushrooms and shrubs give a <b>permanent</b> effect instead: from your next turn on they hand you a card
      whenever you play something matching.</p>

      <h5>End and scoring</h5>
      <p>Three winter cards sit in the bottom third of the deck. Drawing one puts it next to the clearing and you
      immediately draw a replacement. The <b>third winter card ends the game at once</b> -- you do not finish your turn.</p>
      <p>Add up the points on every visible card in your forest plus one point per card under your cave. Highest
      total wins; a tie is a shared victory.</p>

      <h5>How to read a card</h5>
      <div class="anatwrap">
        <div class="anat" style="${style}">
          <b style="left:4%;top:1.5%">1</b>
          <b style="left:80%;top:1.5%">2</b>
          <b style="left:4%;top:27%">3</b>
          <b style="left:34%;top:32.5%">4</b>
          <b style="left:9%;top:41%">5</b>
          <b style="left:32%;top:41%">6</b>
          <b style="left:78%;top:41%">7</b>
          <b style="left:34%;top:82%">8</b>
        </div>
        <ul class="anatkey">
          <li><i>1</i><span><b>Cost</b> -- how many other cards from your hand you discard to play this half.</span></li>
          <li><i>2</i><span><b>Card colour</b> and the tree symbol on it. Pay with cards all showing this symbol and the bonus fires.</span></li>
          <li><i>3</i><span><b>Type symbols</b> -- bird, bat, insect, plant and so on. Most scoring counts these.</span></li>
          <li><i>4</i><span><b>Name</b>, with a tiny number beside it: how many copies exist in the game.</span></li>
          <li><i>5</i><span><b>Effect</b> -- fires once, right after you play the card.</span></li>
          <li><i>6</i><span><b>Bonus arrow</b> -- fires only when the payment matched the card colour.</span></li>
          <li><i>7</i><span><b>Points</b> at the end of the game.</span></li>
          <li><i>8</i><span>The <b>other half</b>. Pick one, slide the other under the tree, and forget about it.</span></li>
        </ul>
      </div>
    </div>
    <div>
      <h5>The lines in this compendium</h5>
      ${Object.keys(KINDS).map(k => `<p style="margin:0 0 7px"><span style="display:inline-block;width:26px;border-top:${KINDS[k].w + .6}px ${KINDS[k].dash ? 'dashed' : 'solid'} ${KINDS[k].raw};vertical-align:middle;margin-right:8px"></span><b style="color:${KINDS[k].raw}">${KINDS[k].label}</b> -- ${KIND_HELP[k]}</p>`).join('')}
      <h5 style="margin-top:16px">Ring colours</h5>
      <p><span style="color:var(--in)">■</span> <b>affects it</b> -- this card matters to the one you selected.<br>
         <span style="color:var(--out)">■</span> <b>affected</b> -- the selected card matters to this one.</p>
      <h5 style="margin-top:16px">Where this comes from</h5>
      <p>Card scans and the card/species tables come from the Board Game Arena implementation. Rules and card
      wordings were condensed from the official rulebook (Lookout, 2026) and the official digital appendix covering
      the Alpine, Woodland Edge and Exploration expansions. Frequencies of all 111 entries were checked against the
      appendix. The 15 rare Exploration cards have no scans, so they show up as plates.</p>
    </div>
  </div>`;
};
const KIND_HELP = {
  score: 'having the target in play gives this card points.',
  need: 'without the target this card scores nothing at all.',
  free: 'this card lets you put the target into your forest without paying.',
  draw: 'playing the target makes this card hand you cards.',
  boost: 'this card raises the target’s count, or makes it worth more.',
  share: 'this card lets cards pile into one slot.',
  gain: 'a plain gain -- an extra turn, cards, the clearing, your cave.',
  pair: 'the two halves of one physical card. You only ever get one of them.'
};

/* ============================================================== chrome */
function buildChrome() {
  const sp = $('#setpills');
  Object.keys(FS.sets).forEach(k => {
    const s = FS.sets[k];
    const b = el('button', 'setpill', `<i></i>${esc(s.short)}`);
    b.setAttribute('aria-pressed', 'true');
    b.style.color = s.color;
    b.style.background = hexA(s.color, .16);
    b.onclick = () => {
      if (state.sets.has(k)) { if (state.sets.size === 1) return; state.sets.delete(k); }
      else state.sets.add(k);
      const on = state.sets.has(k);
      b.setAttribute('aria-pressed', String(on));
      b.style.background = on ? s.color : 'rgba(0,0,0,.2)';
      b.style.color = on ? '#0d1512' : s.color;
      REL_RESET(); rerender();
    };
    b.style.background = s.color; b.style.color = '#0d1512';
    sp.appendChild(b);
  });
  const lg = $('#legend');
  lg.innerHTML = `<span class="li"><i style="border-color:var(--in)"></i>affects it</span>
                  <span class="li"><i style="border-color:var(--out)"></i>affected by it</span>` +
    Object.keys(KINDS).slice(0, 6).map(k =>
      `<span class="li"><i style="border-color:${KINDS[k].raw};border-top-style:${KINDS[k].dash ? 'dashed' : 'solid'}"></i>${KINDS[k].label}</span>`).join('');

  $('#viewseg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setView(b.dataset.view);
  });
  $('#groupseg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.group = b.dataset.group;
    [...$('#groupseg').children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderBrowse();
  });
  const q = $('#q'), qc = $('#qclr');
  let tmr;
  q.addEventListener('input', () => {
    qc.hidden = !q.value;
    clearTimeout(tmr);
    tmr = setTimeout(() => { state.q = q.value; renderBrowse(); }, 110);
  });
  qc.onclick = () => { q.value = ''; qc.hidden = true; state.q = ''; renderBrowse(); q.focus(); };
  $('#isobtn').onclick = () => {
    state.isolate = !state.isolate;
    $('#isobtn').setAttribute('aria-pressed', String(state.isolate));
    paintSelection();
  };
  const modal = $('#rulesmodal');
  $('#rulesbtn').onclick = () => {
    modal.innerHTML = `<div class="box">${RULES_HTML()}</div>`;
    modal.classList.add('on');
    modal.querySelector('#rulesx').onclick = () => modal.classList.remove('on');
  };
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('on'); });
  $('#shake').onclick = () => {
    if (!web) return;
    web.nodes.forEach(n => { n.vx += (Math.random() - .5) * 60; n.vy += (Math.random() - .5) * 60; });
    web.alpha = 1;
  };

  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modal.classList.contains('on')) return modal.classList.remove('on');
      if (state.sel) { state.sel = null; history.replaceState(null, '', location.pathname); paintSelection(); }
      return;
    }
    if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
  });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { paintSelection(); if (web) web.alpha = Math.max(web.alpha, .3); }, 180); });
}
function REL_RESET() { /* relations do not depend on filters -- kept for clarity */ }
function setView(v) {
  state.view = v;
  [...$('#viewseg').children].forEach(c => c.setAttribute('aria-pressed', String(c.dataset.view === v)));
  ['browse', 'focus', 'web'].forEach(id => $('#' + id).classList.toggle('on', id === v));
  history.replaceState(null, '', hashFor());
  if (v === 'focus') renderFocus();
  if (v === 'web') { if (!web) buildWeb(); else { web.alpha = Math.max(web.alpha, .4); paintWeb(); } }
  if (v === 'browse') paintSelection();
}
function rerender() { renderBrowse(); if (state.view === 'focus') renderFocus(); if (web) { cancelAnimationFrame(web.raf); web = null; if (state.view === 'web') buildWeb(); } }

/* ================================================================= boot */
buildChrome();
renderBrowse();
function hashFor() {
  const bits = [];
  if (state.view !== 'browse') bits.push('v=' + state.view);
  if (state.sel) bits.push('c=' + (ID_TO_SLUG[state.sel] || encodeURIComponent(state.sel)));
  return bits.length ? '#' + bits.join('&') : location.pathname + location.search;
}
function fromHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  const v = h.get('v'), c = h.get('c');
  const want = c ? (NODES[c] ? c : (SLUG_TO_ID[slugify(c)] || null)) : null;
  if (want !== state.sel) { state.sel = want; paintSelection(); }
  if (v && ['browse', 'focus', 'web'].includes(v) && v !== state.view) setView(v);
}
fromHash();
addEventListener('hashchange', fromHash);
})();
