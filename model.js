// Logica di calcolo pura, senza DOM.

export const DEFAULTS = {
  muRef: 0.2,
  tRef: 24,
  tMin: 0,
  tMax: 32,
  lag: 0.5,
  kImpasto: 0.4,
  tFrigo: 6,
  tau: 2.5,
  kFrigo: 1.0,
  hPm: 0.5,
  hLico: 1.0,
  riserva: 50,
};

export function idrLievito(tipo, p = DEFAULTS) {
  return tipo === 'lico' ? p.hLico : p.hPm;
}

function g(T, p) {
  const x = Math.max(0, Math.min(T, p.tMax) - p.tMin) / (p.tRef - p.tMin);
  return x * x;
}

export function mu(T, p = DEFAULTS) {
  return p.muRef * g(T, p);
}

// ---------- Rinfresco ----------
export function fattoreRinfresco(T, ore, p = DEFAULTS) {
  return Math.exp(mu(T, p) * Math.max(0, ore - p.lag));
}

function avvisiRinfresco(D, ore, p) {
  const w = [];
  if (ore <= p.lag) w.push('Tempo troppo breve.');
  else if (D < 1.5) w.push('Troppo poco tempo: il lievito non farà in tempo a crescere.');
  if (D > 30) w.push('Diluizione molto alta: risultato poco affidabile, riduci le ore.');
  return w;
}

export function rinfrescoVoglio({ tot, tipo, T, ore }, p = DEFAULTS) {
  const h = idrLievito(tipo, p);
  const D = fattoreRinfresco(T, ore, p);
  const lievito = tot / D;
  const farina = (tot - lievito) / (1 + h);
  const acqua = h * farina;
  return { D, lievito, farina, acqua, totale: tot, avvisi: avvisiRinfresco(D, ore, p) };
}

export function rinfrescoHo({ b, tipo, T, ore }, p = DEFAULTS) {
  const h = idrLievito(tipo, p);
  const D = fattoreRinfresco(T, ore, p);
  const farina = (b * (D - 1)) / (1 + h);
  const acqua = h * farina;
  return { D, lievito: b, farina, acqua, totale: b * D, avvisi: avvisiRinfresco(D, ore, p) };
}

// ---------- Impasto ----------
// S = crescita accumulata. Restituisce lievito, farina e acqua da aggiungere, sale.
function dalla_crescita({ F, H, s, tipo, S }, p) {
  const h = idrLievito(tipo, p);
  const M = F * (1 + H + s);
  const D = Math.exp(S / p.kImpasto);
  const lievito = M / D;
  const farinaLievito = lievito / (1 + h);
  const acquaLievito = lievito - farinaLievito;
  const farinaAgg = F - farinaLievito;
  const acquaAgg = F * H - acquaLievito;
  const perc = F > 0 ? lievito / F : 0;
  const avvisi = [];
  if (perc > 0.4) avvisi.push('Tempo troppo breve per questa temperatura.');
  if (perc < 0.03) avvisi.push('Lievitazione molto lunga: risultato poco affidabile.');
  if (farinaAgg < 0) avvisi.push('Il lievito contiene più farina di quella totale impostata.');
  if (acquaAgg < 0) avvisi.push('Il lievito contiene più acqua di quella totale impostata.');
  return { M, D, S, lievito, perc, farinaLievito, acquaLievito, farinaAgg, acquaAgg, sale: F * s, avvisi };
}

export function impasto({ F, H, s, tipo, T, ore }, p = DEFAULTS) {
  const S = mu(T, p) * Math.max(0, ore - p.lag);
  const r = dalla_crescita({ F, H, s, tipo, S }, p);
  if (ore <= p.lag) r.avvisi.unshift('Tempo troppo breve.');
  return r;
}

// ---------- Impasto con frigo ----------
// Integrale di mu(T(t)) dt tra t1 e t2, con T(t) = Tf + (Ta-Tf)·exp(-t/tau)
export function integraleFrigo(Ta, t1, t2, p = DEFAULTS) {
  if (!(t2 > t1)) return 0;
  const Tf = p.tFrigo;
  if (Tf >= p.tMin && Tf <= p.tMax && Ta >= p.tMin && Ta <= p.tMax) {
    const a = Tf - p.tMin, b = Ta - Tf, c = p.muRef / ((p.tRef - p.tMin) ** 2);
    const G = (t) => a * a * t - 2 * a * b * p.tau * Math.exp(-t / p.tau)
      - ((b * b * p.tau) / 2) * Math.exp((-2 * t) / p.tau);
    return c * (G(t2) - G(t1));
  }
  return integraleNumerico(Ta, t1, t2, p);
}

export function integraleNumerico(Ta, t1, t2, p = DEFAULTS, passo = 0.01) {
  if (!(t2 > t1)) return 0;
  const n = Math.max(1, Math.ceil((t2 - t1) / passo));
  const dt = (t2 - t1) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = t1 + (i + 0.5) * dt;
    sum += mu(p.tFrigo + (Ta - p.tFrigo) * Math.exp(-t / p.tau), p) * dt;
  }
  return sum;
}

// Fase fuori (Sa) e fase in frigo (Sf, con il kFrigo indicato o quello dei parametri)
export function crescitaFrigo({ Ta, ta, tf }, p = DEFAULTS, kFrigo = p.kFrigo) {
  const Sa = mu(Ta, p) * Math.max(0, ta - p.lag);
  const lagResiduo = Math.max(0, p.lag - ta);
  const Sf = kFrigo * integraleFrigo(Ta, Math.min(lagResiduo, tf), tf, p);
  return { Sa, Sf };
}

export function impastoFrigo({ F, H, s, tipo, Ta, ta, tf }, p = DEFAULTS) {
  const { Sa, Sf } = crescitaFrigo({ Ta, ta, tf }, p);
  const r = dalla_crescita({ F, H, s, tipo, S: Sa + Sf }, p);
  r.Sa = Sa; r.Sf = Sf;
  if (tf > 72) r.avvisi.push('Oltre 3 giorni il calcolo non è affidabile.');
  return r;
}

// ---------- Taratura ----------
export function taraRinfresco({ lievito, farina, acqua, T, ore }, p = DEFAULTS) {
  const D = (lievito + farina + acqua) / lievito;
  const den = (ore - p.lag) * g(T, p);
  if (!(D > 1) || !(den > 0)) return null;
  return Math.log(D) / den;
}

export function taraImpasto({ impasto: M, lievito, T, ore }, p = DEFAULTS) {
  const D = M / lievito;
  if (!(D > 1) || !(ore > p.lag)) return null;
  return (mu(T, p) * (ore - p.lag)) / Math.log(D);
}

// Ritorna: numero (ok), null (dati incompleti), NaN (dati incoerenti)
export function taraFrigo({ impasto: M, lievito, Ta, ta, tf }, p = DEFAULTS) {
  if (![M, lievito, Ta, ta, tf].every(Number.isFinite) || lievito <= 0 || M <= 0) return null;
  const D = M / lievito;
  if (!(D > 1)) return NaN;
  const { Sa, Sf } = crescitaFrigo({ Ta, ta, tf }, p, 1);
  if (!(Sf > 0)) return NaN;
  const k = (p.kImpasto * Math.log(D) - Sa) / Sf;
  return k > 0 && k <= 5 ? k : NaN;
}

// ---------- Orari ----------
export function oreFinoA(hhmm, now = new Date()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return NaN;
  const t = new Date(now);
  t.setHours(+m[1], +m[2], 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return (t - now) / 3600000;
}

// Ore tra due date-ora locali "YYYY-MM-DDTHH:MM"
export function oreTra(da, a) {
  const x = new Date(da), y = new Date(a);
  return (y - x) / 3600000;
}
