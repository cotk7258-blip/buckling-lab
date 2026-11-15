import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveColumn, viewAtLoad, dohshiOld } from './column.ts';

const E_FY = 200000 / 355;

test('弾性のうちは P = Pe·v/(v0+v) に一致する', () => {
  const p = solveColumn({ lambda: 1.5, resid: 0, imp: 1 / 1000, eOverFy: E_FY });
  let checked = 0;
  for (const s of p.steps.slice(1)) {
    if (s.yieldFrac > 0) break;
    const exact = (p.Pe * s.v) / (p.v0 + s.v);
    assert.ok(Math.abs(s.P - exact) < 1e-9 + 1e-7 * exact, `v=${s.v} P=${s.P} exact=${exact}`);
    checked++;
  }
  assert.ok(checked > 100);
});

test('理想の柱(不整なし)は min(Py, Pe) に届く', () => {
  for (const lam of [0.3, 0.7, 1.2, 1.8]) {
    const p = solveColumn({ lambda: lam, resid: 0, imp: 0, eOverFy: E_FY });
    const ideal = Math.min(1, 1 / (lam * lam));
    assert.ok(p.Pu <= ideal + 1e-6, `λ=${lam} Pu=${p.Pu}`);
    assert.ok(p.Pu > ideal * 0.97, `λ=${lam} Pu=${p.Pu} ideal=${ideal}`);
  }
});

test('初期たわみだけの柱は、縁が降伏する荷重(ペリー・ロバートソン)より強く、理想より弱い', () => {
  for (const lam of [0.5, 0.9, 1.3, 1.8]) {
    const p = solveColumn({ lambda: lam, resid: 0, imp: 1 / 1000, eOverFy: E_FY });
    const eta = (p.v0 * 0.5) / p.r2; // v0·c/r²
    const pe = p.Pe;
    const a = (1 + (1 + eta) * pe) / 2;
    const firstYield = a - Math.sqrt(a * a - pe);
    assert.ok(p.Pu >= firstYield - 1e-4, `λ=${lam} Pu=${p.Pu} PR=${firstYield}`);
    assert.ok(Math.abs(p.Pfy - firstYield) < 0.02, `λ=${lam} Pfy=${p.Pfy} PR=${firstYield}`);
    assert.ok(p.Pu < Math.min(1, pe), `λ=${lam}`);
  }
});

test('残留応力だけの柱は接線係数荷重か、それより少し上で最大になる', () => {
  const resid = 0.3;
  for (const lam of [0.7, 0.9, 1.1]) {
    const p = solveColumn({ lambda: lam, resid, imp: 0, eOverFy: E_FY, nFlange: 201, nWeb: 61 });
    // まっすぐ押したとき、平均応力 P(e) と弾性の芯の Ie(e) を求め、P = Pe·Ie/I になる荷重を探す
    const n = p.z.length;
    const at = (e: number) => {
      let P = 0;
      let ie = 0;
      for (let i = 0; i < n; i++) {
        const s = Math.min(1, e + p.sigR[i]);
        P += s * p.w[i];
        if (s < 1) ie += p.w[i] * p.z[i] * p.z[i];
      }
      return { P, limit: (p.Pe * ie) / p.r2 };
    };
    let lo = 0;
    let hi = 2;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      const r = at(m);
      if (r.P < r.limit) lo = m;
      else hi = m;
    }
    const pt = at(lo).P;
    // シャンリーの理論: 曲がり始めは接線係数荷重、そこから少し上がって最大になる
    assert.ok(p.Pu > pt - 0.01 && p.Pu < pt + 0.06, `λ=${lam} Pu=${p.Pu} Pt=${pt}`);
  }
});

test('不整を大きくすると強度は下がる', () => {
  const base = { lambda: 0.9, eOverFy: E_FY };
  const a = solveColumn({ ...base, resid: 0, imp: 1 / 1000 }).Pu;
  const b = solveColumn({ ...base, resid: 0.3, imp: 1 / 1000 }).Pu;
  const c = solveColumn({ ...base, resid: 0.3, imp: 1 / 500 }).Pu;
  assert.ok(a > b && b > c, `${a} ${b} ${c}`);
});

test('どの断面でも、応力の合力は軸力 P と曲げ P·(v0+v)·sin につり合う', () => {
  for (const lam of [0.4, 0.9, 1.6]) {
    const p = solveColumn({ lambda: lam, resid: 0.3, imp: 1 / 1000, eOverFy: E_FY });
    const n = p.z.length;
    const last = Math.min(p.steps.length - 1, p.peak + 40);
    for (let k = 1; k <= last; k += 7) {
      const s = p.steps[k];
      for (let j = 0; j < p.ns; j++) {
        let N = 0;
        let M = 0;
        for (let i = 0; i < n; i++) {
          N += s.sigS[j * n + i] * p.w[i];
          M += s.sigS[j * n + i] * p.w[i] * p.z[i];
        }
        const sn = Math.sin((Math.PI * j) / (2 * (p.ns - 1)));
        assert.ok(Math.abs(N - s.P) < 2e-4, `λ=${lam} k=${k} j=${j} N=${N} P=${s.P}`);
        assert.ok(Math.abs(M - s.P * (p.v0 + s.v) * sn) < 2e-4, `λ=${lam} k=${k} j=${j} M=${M}`);
      }
    }
  }
});

test('荷重から状態を引ける', () => {
  const p = solveColumn({ lambda: 0.9, resid: 0.3, imp: 1 / 1000, eOverFy: E_FY });
  const v = viewAtLoad(p, p.Pu * 0.5);
  assert.ok(Math.abs(v.step.P - p.Pu * 0.5) < 1e-3);
  assert.equal(v.collapsed, false);
  assert.equal(viewAtLoad(p, p.Pu + 0.05).collapsed, true);
});

test('道示の旧式は区間の境目でつながる', () => {
  assert.ok(Math.abs(dohshiOld(0.2) - 1) < 1e-9);
  assert.ok(Math.abs(dohshiOld(1) - 1 / 1.773) < 1e-3);
});

test('各国の曲線: 区間の境目でつながり、理想の線を超えない', async () => {
  const c = await import('./curves.ts');
  assert.ok(Math.abs(c.aisc(1.5) - 0.877 / 2.25) < 2e-3);
  assert.ok(Math.abs(c.aij(Math.sqrt(1 / 0.6) - 1e-9) - c.aij(Math.sqrt(1 / 0.6) + 1e-9)) < 1e-6);
  assert.ok(Math.abs(c.eurocode(0.2, 0.34) - 1) < 1e-9);
  for (let l = 0.05; l <= 2.5; l += 0.05) {
    for (const v of [c.dohshiOld(l), c.aisc(l), c.eurocode(l, 0.34), c.eurocode(l, 0.49), c.aij(l)]) {
      assert.ok(v <= c.idealCurve(l) + 1e-9 && v > 0, `λ=${l} v=${v}`);
    }
  }
});

test('板の局部座屈: 幅が半分で弾性座屈応力は4倍、強さは降伏で頭打ち', async () => {
  const p = await import('./plate.ts');
  assert.ok(Math.abs(p.sigmaEl(500, 10) / p.sigmaEl(1000, 10) - 4) < 1e-9);
  assert.ok(Math.abs(p.sigmaEl(1000, 20) / p.sigmaEl(1000, 10) - 4) < 1e-9);
  // σel = 4π²E/(12(1-ν²))·(t/b)² ≈ 723,000·(t/b)²
  assert.ok(Math.abs(p.sigmaEl(1000, 10) - 72.3) < 0.1);
  const R = p.plateR(1000, 10, 355);
  assert.ok(Math.abs(p.plateR(500, 10, 355) - R / 2) < 1e-9);
  assert.equal(p.plateStrength(0.5), 1);
  assert.ok(p.plateStrength(0.7001) <= 1);
  assert.ok(Math.abs(p.plateStrength(1.4) - 0.5 / 1.96) < 1e-9);
  for (let r = 0.1; r < 3; r += 0.1) assert.ok(p.plateStrength(r) <= Math.min(1, p.plateTheory(r)) + 1e-9);
});
