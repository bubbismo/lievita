import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mu, rinfrescoVoglio, rinfrescoHo, impasto, impastoFrigo, crescitaFrigo, integraleFrigo,
  integraleNumerico, taraRinfresco, taraImpasto, taraFrigo, oreFinoA, oreTra, DEFAULTS,
} from './model.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('mu(T)', () => {
  [[6, 0.0125], [20, 0.139], [22, 0.168], [24, 0.2], [27, 0.253]].forEach(([T, v]) => near(mu(T), v, 0.01, `mu(${T})`));
});

test('rinfresco voglio', () => {
  let r = rinfrescoVoglio({ tot: 250, tipo: 'pm', T: 24, ore: 8 });
  near(r.D, 4.48, 0.01, 'D'); near(r.lievito, 56, 1, 'l'); near(r.farina, 129, 1, 'f'); near(r.acqua, 65, 1, 'a');
  r = rinfrescoVoglio({ tot: 100, tipo: 'lico', T: 20, ore: 12 });
  near(r.D, 4.94, 0.01, 'D'); near(r.lievito, 20, 1, 'l'); near(r.farina, 40, 1, 'f'); near(r.acqua, 40, 1, 'a');
  r = rinfrescoVoglio({ tot: 300, tipo: 'pm', T: 27, ore: 4 });
  near(r.D, 2.43, 0.01, 'D'); near(r.lievito, 124, 1, 'l'); near(r.farina, 118, 1, 'f'); near(r.acqua, 59, 1, 'a');
});

test('rinfresco ho', () => {
  const r = rinfrescoHo({ b: 80, tipo: 'pm', T: 24, ore: 8 });
  near(r.totale, 80 * r.D, 1e-9, 'tot');
  near(r.lievito + r.farina + r.acqua, r.totale, 1e-9, 'somma');
});

test('impasto', () => {
  let r = impasto({ F: 1000, H: 0.7, s: 0.02, tipo: 'pm', T: 24, ore: 5 });
  near(r.D, 9.49, 0.01, 'D'); near(r.lievito, 181, 1, 'l'); near(r.perc, 0.181, 0.001, '%');
  near(r.farinaAgg, 879, 1, 'f'); near(r.acquaAgg, 640, 1, 'a'); near(r.sale, 20, 1, 's');
  r = impasto({ F: 1000, H: 0.7, s: 0.02, tipo: 'pm', T: 20, ore: 10 });
  near(r.D, 27.1, 0.05, 'D'); near(r.lievito, 64, 1, 'l'); near(r.farinaAgg, 958, 1, 'f'); near(r.acquaAgg, 679, 1, 'a');
  r = impasto({ F: 500, H: 0.65, s: 0.02, tipo: 'lico', T: 27, ore: 4 });
  near(r.D, 9.16, 0.01, 'D'); near(r.lievito, 91, 1, 'l'); near(r.perc, 0.182, 0.001, '%');
  near(r.farinaAgg, 454, 1, 'f'); near(r.acquaAgg, 279, 1, 'a'); near(r.sale, 10, 1, 's');
});

test('impasto con frigo', () => {
  const casi = [
    [{ F: 1000, H: 0.7, tipo: 'pm', Ta: 24, ta: 2, tf: 16 }, 0.300, 0.528, 7.92, 217, 855, 628],
    [{ F: 1000, H: 0.7, tipo: 'pm', Ta: 22, ta: 3, tf: 24 }, 0.420, 0.578, 12.1, 142, 905, 653],
    [{ F: 1000, H: 0.7, tipo: 'pm', Ta: 24, ta: 4, tf: 12 }, 0.700, 0.477, 18.9, 91, 939, 670],
    [{ F: 500, H: 0.75, tipo: 'lico', Ta: 24, ta: 0, tf: 48 }, 0, 0.842, 8.20, 108, 446, 321],
  ];
  for (const [i, Sa, Sf, D, l, f, a] of casi) {
    const r = impastoFrigo({ ...i, s: 0.02 });
    near(r.Sa, Sa, 0.01, 'Sa'); near(r.Sf, Sf, 0.01, 'Sf'); near(r.D, D, 0.05, 'D');
    near(r.lievito, l, 1, 'lievito'); near(r.farinaAgg, f, 1, 'farina'); near(r.acquaAgg, a, 1, 'acqua');
  }
  assert.ok(impastoFrigo({ F: 1000, H: 0.7, s: 0.02, tipo: 'pm', Ta: 24, ta: 2, tf: 80 }).avvisi.some((x) => x.includes('3 giorni')));
});

test('integrale: forma chiusa = numerico', () => {
  for (const [Ta, t1, t2] of [[24, 0, 16], [20, 0.5, 48], [27, 0, 72]]) {
    near(integraleFrigo(Ta, t1, t2), integraleNumerico(Ta, t1, t2, DEFAULTS, 0.001), 0.0005, 'integrale');
  }
});

test('avvisi', () => {
  assert.ok(rinfrescoVoglio({ tot: 100, tipo: 'pm', T: 24, ore: 1 }).avvisi.length > 0);
  assert.ok(rinfrescoVoglio({ tot: 100, tipo: 'pm', T: 27, ore: 40 }).avvisi.some((a) => a.includes('Diluizione')));
  assert.ok(impasto({ F: 1000, H: 0.7, s: 0.02, tipo: 'pm', T: 24, ore: 2 }).avvisi.length > 0);
  assert.ok(impasto({ F: 1000, H: 0.7, s: 0.02, tipo: 'pm', T: 24, ore: 20 }).avvisi.length > 0);
});

test('taratura', () => {
  near(taraRinfresco({ lievito: 100, farina: 100, acqua: 50, T: 24, ore: 5 }), 0.204, 0.001, 'muRef');
  near(taraImpasto({ impasto: 1920, lievito: 200, T: 24, ore: 5 }), 0.398, 0.001, 'k');
  near(taraFrigo({ impasto: 1720, lievito: 150, Ta: 24, ta: 2, tf: 16 }), 1.28, 0.01, 'kFrigo');
  assert.ok(Number.isNaN(taraFrigo({ impasto: 1720, lievito: 1700, Ta: 24, ta: 2, tf: 16 })));
  assert.equal(taraFrigo({ impasto: NaN, lievito: 150, Ta: 24, ta: 2, tf: 16 }), null);
});

test('orari', () => {
  const now = new Date(2026, 0, 1, 10, 0, 0);
  near(oreFinoA('18:30', now), 8.5, 1e-9, 'oggi');
  near(oreFinoA('08:00', now), 22, 1e-9, 'domani');
  near(oreTra('2026-01-01T18:00', '2026-01-02T12:00'), 18, 1e-9, 'oreTra');
});
