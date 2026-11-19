import {
  DEFAULTS, rinfrescoVoglio, rinfrescoHo, impasto, impastoFrigo,
  taraRinfresco, taraImpasto, taraFrigo, oreFinoA, oreTra,
} from './model.js';

const KEY = 'lievito.v2';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const pad = (n) => String(n).padStart(2, '0');
const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function defaultInforno() {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return toLocal(d);
}

const initial = () => ({
  tab: 'rinfresco',
  p: { ...DEFAULTS },
  set: { splash: true, frigoTarato: false },
  sh: { tipo: 'pm', F: 1000, H: 70, s: 2 },
  r: { T: 24, tempoModo: 'ore', ore: 8, orario: '18:00', modo: 'voglio', tot: 250, b: 80 },
  i: { T: 24, tempoModo: 'ore', ore: 5, orario: '18:00' },
  f: { Ta: 24, ta: 2, modo: 'ore', tf: 16, inizio: '', inforno: '' },
  cal: { tr: {}, ti: {}, tf: {} },
});

function load() {
  const d = initial();
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k of ['r', 'i', 'f', 'sh', 'p', 'set', 'cal']) Object.assign(d[k], s[k] || {});
    if (['rinfresco', 'impasto', 'frigo'].includes(s.tab)) d.tab = s.tab;
  } catch { /* ignora */ }
  d.f.inizio = toLocal(new Date()); // "adesso" a ogni apertura
  if (!d.f.inforno) d.f.inforno = defaultInforno();
  return d;
}
const state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignora */ }
}

const get = (path) => path.split('.').reduce((a, k) => a?.[k], state);
function set(path, v) {
  const ks = path.split('.'); const last = ks.pop();
  get(ks.join('.'))[last] = v;
}
const num = (v) => {
  if (v === '' || v == null) return NaN;
  return typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
};
const fmtG = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('it-IT') : '–');
const fmt1 = (x) => x.toLocaleString('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const fmt3 = (x) => x.toFixed(3).replace('.', ',');

// ---------- binding ----------
const STR_PATHS = new Set(['sh.tipo', 'r.tempoModo', 'r.modo', 'i.tempoModo', 'f.modo', 'r.orario', 'i.orario', 'f.inizio', 'f.inforno']);
function syncInputs() {
  for (const el of $$('[data-bind]')) {
    const v = get(el.dataset.bind);
    if (el.classList.contains('seg')) {
      $$('button', el).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === String(v)));
    } else if (document.activeElement !== el) el.value = v ?? '';
  }
  for (const el of $$('[data-out]')) el.textContent = get(el.dataset.out);
  for (const el of $$('[data-show]')) {
    const [p, v] = el.dataset.show.split('=');
    el.hidden = get(p) !== v;
  }
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === state.tab));
  for (const t of ['rinfresco', 'impasto', 'frigo']) $('#tab-' + t).hidden = state.tab !== t;
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.bind) {
    const p = el.dataset.bind;
    set(p, STR_PATHS.has(p) ? el.value : el.value === '' ? '' : num(el.value));
  } else if (el.dataset.cal) {
    set('cal.' + el.dataset.cal, el.value === '' ? '' : num(el.value));
  } else if (el.dataset.param) {
    const v = num(el.value);
    if (Number.isFinite(v)) state.p[el.dataset.param] = v;
  } else if (el.id === 'set-splash') {
    state.set.splash = el.checked;
  } else return;
  update();
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('.seg button');
  if (b) { set(b.parentElement.dataset.bind, b.dataset.v); update(); }
  const t = e.target.closest('.tabs button');
  if (t) { state.tab = t.dataset.tab; update(); window.scrollTo(0, 0); }
});

// ---------- calcolo ----------
function oreDa(s, outId) {
  if (s.tempoModo === 'orario') {
    const h = oreFinoA(s.orario);
    $(outId).textContent = Number.isFinite(h) ? `Mancano circa ${fmt1(h)} ore` : '';
    return h;
  }
  return num(s.ore);
}
const setWarns = (id, list) => { $(id).innerHTML = list.map((t) => `<p>${t}</p>`).join(''); };

function calcRinfresco() {
  const r = state.r;
  const h = oreDa(r, '#r-ore-calc');
  const base = { tipo: state.sh.tipo, T: num(r.T), ore: h };
  const q = r.modo === 'voglio' ? num(r.tot) : num(r.b);
  const out = ['lievito', 'farina', 'acqua', 'totale', 'rapporto'];
  if (!Number.isFinite(q) || !Number.isFinite(h) || q <= 0) {
    out.forEach((k) => { $('#r-' + k).textContent = '–'; });
    setWarns('#r-warn', []);
    return;
  }
  const res = r.modo === 'voglio'
    ? rinfrescoVoglio({ ...base, tot: q }, state.p)
    : rinfrescoHo({ ...base, b: q }, state.p);
  $('#r-lievito').textContent = fmtG(res.lievito);
  $('#r-farina').textContent = fmtG(res.farina);
  $('#r-acqua').textContent = fmtG(res.acqua);
  $('#r-totale').textContent = fmtG(res.totale) + ' g';
  $('#r-rapporto').textContent = res.lievito > 0
    ? `1 : ${fmt1(res.farina / res.lievito)} : ${fmt1(res.acqua / res.lievito)}` : '–';
  setWarns('#r-warn', res.avvisi);
}

const last = { i: null, f: null };
function mostra(pre, r, avvisi) {
  const ids = ['lievito', 'farina', 'acqua', 'sale'];
  if (!r) {
    ids.forEach((k) => { $(`#${pre}-${k}`).textContent = '–'; });
    $(`#${pre}-perc`).textContent = '';
    setWarns(`#${pre}-warn`, avvisi || []);
    return;
  }
  $(`#${pre}-lievito`).textContent = fmtG(r.lievito);
  $(`#${pre}-perc`).textContent = `${fmt1(r.perc * 100)}% sulla farina`;
  $(`#${pre}-farina`).textContent = fmtG(r.farinaAgg);
  $(`#${pre}-acqua`).textContent = fmtG(r.acquaAgg);
  $(`#${pre}-sale`).textContent = fmtG(r.sale);
  setWarns(`#${pre}-warn`, r.avvisi);
}
const comuni = () => {
  const { F, H, s } = state.sh;
  const v = { F: num(F), H: num(H) / 100, s: num(s) / 100, tipo: state.sh.tipo };
  return [v.F, v.H, v.s].every(Number.isFinite) && v.F > 0 ? v : null;
};

function calcImpasto() {
  const c = comuni(); const h = oreDa(state.i, '#i-ore-calc');
  last.i = null;
  if (!c || !Number.isFinite(h)) return mostra('i', null);
  last.i = impasto({ ...c, T: num(state.i.T), ore: h }, state.p);
  mostra('i', last.i);
}

function giorno(d, ref) {
  const g = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((g(d) - g(ref)) / 86400000);
  if (diff === 0) return 'oggi';
  if (diff === 1) return 'domani';
  if (diff === 2) return 'dopodomani';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}
const ora = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function calcFrigo() {
  const f = state.f; const c = comuni();
  const ta = num(f.ta);
  let tf; let inizio = new Date();
  if (f.modo === 'orari') {
    const d = new Date(f.inizio);
    if (!isNaN(d)) inizio = d;
    tf = oreTra(f.inizio, f.inforno) - ta;
    $('#f-ore-calc').textContent = Number.isFinite(tf) ? `Ore in frigo: ${fmt1(Math.max(0, tf))}` : '';
  } else {
    tf = num(f.tf);
    $('#f-ore-calc').textContent = '';
  }
  last.f = null; $('#f-riepilogo').textContent = '';
  if (!c || !Number.isFinite(ta) || ta < 0 || !Number.isFinite(tf)) return mostra('f', null);
  if (tf < 0) return mostra('f', null, ["Le ore in frigo sono negative: sposta l'orario di infornata o riduci le ore fuori."]);
  last.f = impastoFrigo({ ...c, Ta: num(f.Ta), ta, tf }, state.p);
  mostra('f', last.f);
  const inFrigo = new Date(inizio.getTime() + ta * 3600000);
  const inforna = new Date(inFrigo.getTime() + tf * 3600000);
  $('#f-riepilogo').textContent =
    `Impasta alle ${ora(inizio)}, in frigo alle ${ora(inFrigo)}, inforna ${giorno(inforna, inizio)} alle ${ora(inforna)}`;
}

$$('[data-prepara]').forEach((b) => b.addEventListener('click', () => {
  const r = last[b.dataset.prepara];
  if (!r) return;
  Object.assign(state.r, { modo: 'voglio', tempoModo: 'ore', tot: Math.round(r.lievito + state.p.riserva) });
  state.tab = 'rinfresco';
  update(true); window.scrollTo(0, 0);
}));

// ---------- impostazioni avanzate ----------
const PARAMS = [
  ['muRef', 'Velocità di crescita a Tref (1/h)', 0.01],
  ['tRef', 'Temperatura di riferimento Tref (°C)', 1],
  ['tMin', 'Temperatura a cui la crescita si ferma (°C)', 1],
  ['tMax', 'Temperatura oltre cui non accelera (°C)', 1],
  ['lag', 'Ritardo iniziale (ore)', 0.1],
  ['kImpasto', 'Fattore impasto', 0.01],
  ['tFrigo', 'Temperatura del frigorifero (°C)', 1],
  ['tau', 'Raffreddamento in frigo, costante di tempo (ore)', 0.1],
  ['kFrigo', 'Fattore correttivo del frigo', 0.01],
  ['hPm', 'Idratazione PM solida', 0.05],
  ['hLico', 'Idratazione li.co.li.', 0.05],
  ['riserva', 'Riserva di lievito da tenere (g)', 5],
];
$('#params').innerHTML = PARAMS.map(([k, l, st]) =>
  `<div class="param"><label for="p-${k}">${l}</label><input id="p-${k}" type="number" inputmode="decimal" step="${st}" data-param="${k}"></div>`).join('');
function syncParams() {
  for (const [k] of PARAMS) {
    const el = $('#p-' + k);
    if (document.activeElement !== el) el.value = state.p[k];
  }
  $('#set-splash').checked = state.set.splash;
}
$('#reset').addEventListener('click', () => {
  state.p = { ...DEFAULTS }; state.set.frigoTarato = false; update(true);
});

function syncCal() {
  for (const el of $$('[data-cal]')) {
    if (document.activeElement !== el) el.value = get('cal.' + el.dataset.cal) ?? '';
  }
}
function propose(resId, saveId, value, label, current, apply) {
  const res = $(resId), btn = $(saveId);
  if (value == null) { res.textContent = ''; btn.hidden = true; return; }
  if (Number.isNaN(value)) { res.textContent = 'I dati non sono coerenti: controlla ore e grammi'; btn.hidden = true; return; }
  res.textContent = `${label}: ${fmt3(value)} (ora ${current})`;
  btn.hidden = false;
  btn.onclick = () => { apply(+value.toFixed(3)); update(true); };
}
function calcCal() {
  const t = state.cal.tr;
  const mu = taraRinfresco({ lievito: num(t.lievito), farina: num(t.farina), acqua: num(t.acqua), T: num(t.T), ore: num(t.ore) }, state.p);
  propose('#tr-res', '#tr-save', mu, 'Nuovo valore proposto', state.p.muRef, (v) => { state.p.muRef = v; });
  const u = state.cal.ti;
  const k = taraImpasto({ impasto: num(u.impasto), lievito: num(u.lievito), T: num(u.T), ore: num(u.ore) }, state.p);
  propose('#ti-res', '#ti-save', k, 'Nuovo valore proposto', state.p.kImpasto, (v) => { state.p.kImpasto = v; });
  const w = state.cal.tf;
  const kf = taraFrigo({ impasto: num(w.impasto), lievito: num(w.lievito), Ta: num(w.Ta), ta: num(w.ta), tf: num(w.tf) }, state.p);
  propose('#tf-res', '#tf-save', kf, 'Nuovo valore proposto', state.p.kFrigo,
    (v) => { state.p.kFrigo = v; state.set.frigoTarato = true; });
}

function update(force) {
  syncInputs();
  if (force) { syncParams(); syncCal(); }
  calcRinfresco(); calcImpasto(); calcFrigo(); calcCal();
  $('#f-nota').hidden = state.set.frigoTarato;
  save();
}
syncParams(); syncCal(); update();
setInterval(() => { calcRinfresco(); calcImpasto(); }, 30000);

// ---------- splash ----------
const splash = $('#splash');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function chiudiSplash() { splash.hidden = true; }

if (!state.set.splash) chiudiSplash();
else {
  let andato = false;
  $('#heart').addEventListener('click', () => {
    if (andato) return; andato = true;
    if (reduce) {
      splash.animate({ opacity: [1, 0] }, { duration: 200, fill: 'forwards' }).finished.then(chiudiSplash);
      return;
    }
    esplodi();
  });
}

const HEART_D = 'M10 18 C4 12 1 9 1 5.5 C1 3 3 1.5 5.2 1.5 C7.2 1.5 9 2.7 10 4.5 C11 2.7 12.8 1.5 14.8 1.5 C17 1.5 19 3 19 5.5 C19 9 16 12 10 18Z';
const GRAIN_D = 'M0 0 C7 -6 7 -17 0 -27 C-7 -17 -7 -6 0 0Z';
function frammento(i) {
  const el = document.createElement('div');
  el.className = 'frag';
  el.innerHTML = i % 4 === 3
    ? `<svg viewBox="-9 -30 18 32"><path d="${GRAIN_D}" fill="#e6b94a" stroke="#a87a14"/></svg>`
    : `<svg viewBox="0 0 20 20"><path d="${HEART_D}" fill="#d62839"/></svg>`;
  return el;
}

function esplodi() {
  const heart = $('#heart'), stage = $('.stage', splash);
  const wheat = $('.wheat', splash), title = $('h1', splash), brand = $('.brand', splash);
  heart.style.animation = 'none';
  const gonfia = heart.animate(
    { transform: ['scale(1)', 'scale(1.4)'] },
    { duration: 400, easing: 'ease-in', fill: 'forwards' });
  gonfia.finished.then(() => {
    heart.animate({ opacity: [1, 1, 0] }, { duration: 120, fill: 'forwards' });
    const n = 12 + Math.floor(Math.random() * 9);
    for (let i = 0; i < n; i++) {
      const el = frammento(i); stage.appendChild(el);
      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 150;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      const rot = (Math.random() - 0.5) * 720;
      const sc = 0.8 + Math.random() * 1.2;
      el.animate([
        { transform: 'translate(0,0) rotate(0) scale(.6)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${sc})`, opacity: 0 },
      ], { duration: 900, easing: 'ease-out', fill: 'forwards' });
    }
    for (const el of [wheat, title, brand]) el.animate({ opacity: [1, 0] }, { duration: 500, fill: 'forwards' });
    setTimeout(() => {
      splash.animate({ opacity: [1, 0] }, { duration: 400, fill: 'forwards' }).finished.then(chiudiSplash);
    }, 700);
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
