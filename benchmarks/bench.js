// Shared kit for the benchmarks pages: DOM/SVG builders, scales, formatting, data loading, motion, provenance, clock.
export const CLIENT = { geth: '#6CB8EA', besu: '#E69F00', nethermind: '#1FC08F', erigon: '#B57BFF' };
export const COL = {
  bg: '#0A0D14', ink: '#E2E6E2', ink2: '#B9C2B9', muted: '#8F9A8F', line: 'rgba(226,230,226,.16)', green: '#33FF33',
  blue: '#6CB8EA', amber: '#E69F00', mint: '#1FC08F', orange: '#FF9F43', red: '#F0504A', lilac: '#B57BFF', verm: '#D55E00',
};
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const DATA = new URL('../uploads/benchmarks/', import.meta.url).href;

// h('div', {class: 'x', onclick: fn, text: 'hi'}, ...children) / s('rect', {...}) for SVG. null/false children are skipped.
export const h = (tag, attrs, ...kids) => build(document.createElement(tag), attrs, kids);
export const s = (tag, attrs, ...kids) => build(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, kids);
function build(el, attrs, kids) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// Client mark (pbt-devnet monitor's one-colour silhouettes, clients.svg) in the client's colour.
// Inline in HTML, or nested inside an SVG chart by passing {x, y}.
const MARKS = new URL('clients.svg', import.meta.url).href;
export const avatar = (id, size = 18, attrs = {}) =>
  s('svg', { width: size, height: size, color: CLIENT[id], class: 'avatar', 'aria-hidden': 'true', ...attrs },
    s('use', { href: `${MARKS}#${id}`, width: '100%', height: '100%' }));
// Avatar + name in the client's colour.
export const who = (c, size = 18, style = '') =>
  h('span', { class: 'who', style: `color:${CLIENT[c.id]};${style}` }, avatar(c.id, size), c.name);

// Linear / log scales: f(x) maps domain → range, f.inv maps back.
export function scale(d0, d1, r0, r1) {
  const f = (x) => r0 + ((x - d0) / (d1 - d0)) * (r1 - r0);
  f.inv = (y) => d0 + ((y - r0) / (r1 - r0)) * (d1 - d0);
  return f;
}
export function logScale(d0, d1, r0, r1) {
  const l0 = Math.log(d0), l1 = Math.log(d1);
  const f = (x) => r0 + ((Math.log(Math.max(x, d0)) - l0) / (l1 - l0)) * (r1 - r0);
  f.inv = (y) => Math.exp(l0 + ((y - r0) / (r1 - r0)) * (l1 - l0));
  return f;
}

const nf = (d) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const p2 = (n) => String(n).padStart(2, '0');
export const fmt = {
  n: (v, d = 0) => nf(d).format(v),
  dur(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    return h ? `${h}h ${p2(m)}m ${p2(x)}s` : m ? `${m}m ${p2(x)}s` : `${x}s`;
  },
  hm(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? `${h}h ${p2(m)}m` : `${m}m`;
  },
  // Relative change from → to, e.g. "+38 %" / "−31 %".
  pct(from, to) {
    const p = (to / from - 1) * 100;
    return `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(Math.abs(p) < 10 ? 1 : 0)} %`;
  },
  gb: (bytes, d = 1) => `${nf(d).format(bytes / 1e9)} GB`,
  short: (hex, a = 8, b = 4) => `${hex.slice(0, a + 2)}…${hex.slice(-b)}`,
};

// Cached loaders. CSV values become numbers where numeric, '' → null; rows with `utc` get `t` (unix seconds).
const cache = new Map();
const load = (url, as) => {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r[as](); }));
  return cache.get(url);
};
export const getJSON = (url) => load(url, 'json');
export const getCSV = (url) => {
  const key = `csv:${url}`;
  if (!cache.has(key)) cache.set(key, load(url, 'text').then(parseCSV));
  return cache.get(key);
};
function parseCSV(txt) {
  const [head, ...lines] = txt.trim().split(/\r?\n/);
  const keys = head.split(',');
  return lines.map((l) => {
    const v = l.split(','), o = {};
    keys.forEach((k, i) => { const x = v[i]; o[k] = x === '' || x == null ? null : isNaN(+x) ? x : +x; });
    if (o.utc) o.t = Date.parse(o.utc) / 1000;
    return o;
  });
}

// Motion. Everything collapses to its end state under prefers-reduced-motion.
const ease = (k) => 1 - Math.pow(1 - k, 3);
export function countUp(el, to, format = (v) => fmt.n(v), dur = 1100) {
  if (REDUCED) { el.textContent = format(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = format(k < 1 ? to * ease(k) : to);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const HEX = '0123456789abcdef';
// Hex scramble that settles left to right on `final` (the site's hashTrack, 55 ms ticks).
export function scramble(el, final, dur = 1000) {
  if (REDUCED) { el.textContent = final; return; }
  const t0 = performance.now();
  const iv = setInterval(() => {
    const k = (performance.now() - t0) / dur;
    if (k >= 1) { clearInterval(iv); el.textContent = final; return; }
    const n = Math.floor(k * final.length);
    el.textContent = final.slice(0, n) + [...final.slice(n)].map((c) => (/[0-9a-f]/i.test(c) ? HEX[(Math.random() * 16) | 0] : c)).join('');
  }, 55);
}
export function onVisible(el, fn, threshold = 0.3) {
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
  io.observe(el);
}
export const reveal = (root = document) =>
  root.querySelectorAll('.reveal:not(.in)').forEach((el) => onVisible(el, () => el.classList.add('in'), 0.15));

// One floating tooltip for the page. hover(el, html | (event) => html).
const tipEl = h('div', { class: 'tip', role: 'tooltip' });
document.body.append(tipEl);
export const tip = {
  show(html, ev) { tipEl.innerHTML = html; tipEl.classList.add('on'); tip.move(ev); },
  move(ev) {
    const x = Math.max(8, Math.min(ev.clientX + 14, innerWidth - tipEl.offsetWidth - 8));
    const y = ev.clientY + 18 + tipEl.offsetHeight > innerHeight ? ev.clientY - tipEl.offsetHeight - 10 : ev.clientY + 18;
    tipEl.style.left = `${x}px`; tipEl.style.top = `${y}px`;
  },
  hide() { tipEl.classList.remove('on'); },
};
export function hover(el, html) {
  el.addEventListener('pointerenter', (e) => tip.show(typeof html === 'function' ? html(e) : html, e));
  el.addEventListener('pointermove', (e) => { if (typeof html === 'function') tipEl.innerHTML = html(e); tip.move(e); });
  el.addEventListener('pointerleave', tip.hide);
  return el;
}

// A published number: links to the raw file it comes from (absolute URL), hover names the file.
export function num(text, src, attrs = {}) {
  const a = h('a', { class: 'num', href: src, target: '_blank', rel: 'noopener', ...attrs }, text);
  return hover(a, `<span class="lbl">source</span><br><b>${src.replace(DATA, '')}</b> ↗`);
}
// Glossary: one sentence per term (HANDOVER §4 / EIP-8347). term(key, text?) → dotted-underline span, hover defines it.
const GLOSSARY = {
  newpayload: "The <code>engine_newPayload</code> call a proxy times between Lighthouse and the EL: how long the EL takes to validate and execute one block.",
  mgas: 'Execution throughput while following the head — Σ gas ÷ Σ newPayload time over the window, not sync speed.',
  headcov: 'Valid newPayloads ÷ (window ÷ 12 s); ~0.99 is a perfect score given mainnet\u2019s own ~1% missed slots, below 0.9 would mean the node fell behind.',
  headlag: 'How many blocks the EL is behind the CL\u2019s head; max 1 everywhere here means it was never behind.',
  pctl: 'A percentile of the window\u2019s newPayload times — p50/p95/p99 mean 50%/95%/99% of blocks were processed at least that fast.',
  pbt: 'EIP-8297\u2019s Partitioned Binary Tree — the binary state commitment that replaces the MPT.',
  mptroot: 'The root hash of Ethereum\u2019s current state commitment, the hexary Merkle Patricia Trie.',
  preimages: 'The raw account addresses and storage-slot keys needed to re-derive the MPT\u2019s hashed paths into PBT keys, since Keccak can\u2019t be inverted.',
  anchor: 'The finalized mainnet block whose state the snapshot pair was converted from (EIP-8347\u2019s ANCHOR_BLOCK).',
  pagecache: 'File-backed memory the kernel caches from disk reads — reclaimable under pressure, unlike a process\u2019s own memory.',
  anon: 'A process\u2019s own resident memory, as counted by the cgroup — separate from the reclaimable page cache.',
};
export const term = (key, text) => hover(h('span', { class: 'term' }, text ?? key), GLOSSARY[key]);

// Shared replay clock: t = seconds since each import's own start. speed = simulated seconds per real second.
export class Clock {
  constructor(duration, speed = 600) { Object.assign(this, { duration, speed, t: 0, playing: false, subs: new Set() }); }
  on(fn) { this.subs.add(fn); fn(this.t, this); return () => this.subs.delete(fn); }
  emit() { for (const fn of this.subs) fn(this.t, this); }
  seek(t) { this.t = Math.max(0, Math.min(this.duration, t)); this.emit(); }
  pause() { this.playing = false; this.emit(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  play() {
    if (this.playing) return;
    if (REDUCED) return this.seek(this.duration);
    if (this.t >= this.duration) this.t = 0;
    this.playing = true;
    let last = performance.now();
    const step = (now) => {
      if (!this.playing) return;
      this.t = Math.min(this.duration, this.t + ((now - last) / 1000) * this.speed);
      last = now;
      if (this.t >= this.duration) this.playing = false;
      this.emit();
      if (this.playing) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    this.emit();
  }
}
// Play/pause + scrubber + time readout bound to a clock. Several can share one clock.
export function controls(clock) {
  const btn = h('button', { 'aria-label': 'Play or pause the replay', onclick: () => clock.toggle() });
  const range = h('input', {
    // max rounded up to the step so the thumb's end reaches t = duration (seek clamps).
    type: 'range', min: 0, max: Math.ceil(clock.duration / 15) * 15, step: 15, value: 0, 'aria-label': 'Time since the import started',
    // Read the value first: pause() emits, and the subscriber below writes the old t back into the range.
    oninput: (e) => { const v = +e.target.value; clock.pause(); clock.seek(v); },
  });
  const t = h('span', { class: 't' });
  clock.on((v) => { btn.textContent = clock.playing ? '❚❚' : '▶'; range.value = v; t.textContent = `t+${fmt.hm(v)}`; });
  return h('div', { class: 'clock' }, btn, t, range, h('span', { class: 'lbl' }, `1 s = ${clock.speed / 60} min`));
}
