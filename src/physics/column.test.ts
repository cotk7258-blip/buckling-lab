import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveColumn, viewAtLoad, dohshiOld } from './column.ts';

const E_FY = 200000 / 355;

test('弾性のうちは P = Pe·v/(v0+v) に一致する', () => {
  const p = solveColumn({ lambda: 1.5, resid: 0, imp: 1 / 1000, eOverFy: E_FY });
  for (const s of p.steps.slice(1)) {
    if (s.yl.some((y) => y !== 0)) break;
    const exact = (p.Pe * s.v) / (p.v0 + s.v);
    // 繊維61本の離散化で I が (1-1/n²) 倍になる分の差を許す
    assert.ok(Math.abs(s.P - exact) < 5e-4 * exact + 1e-9, `v=${s.v} P=${s.P} exact=${exact}`);
  }
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
    const eta = (6 * p.v0); // v0·c/r² = 6·v0/b
    const pe = p.Pe;
    const a = (1 + (1 + eta) * pe) / 2;
    const firstYield = a - Math.sqrt(a * a - pe);
    assert.ok(p.Pu >= firstYield - 1e-4, `λ=${lam} Pu=${p.Pu} PR=${firstYield}`);
    assert.ok(p.Pu < Math.min(1, pe), `λ=${lam}`);
  }
});

test('残留応力だけの柱は接線係数荷重に近い', () => {
  // 先端から降伏が進み、弾性の芯の幅の割合 u のとき
  // 平均応力 = 1 - σrc·u²、接線係数荷重 = Pe·u³
  const resid = 0.3;
  for (const lam of [0.7, 0.9, 1.1]) {
    const pe = 1 / (lam * lam);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 80; i++) {
      const u = (lo + hi) / 2;
      if (1 - resid * u * u > pe * u * u * u) lo = u;
      else hi = u;
    }
    const u = (lo + hi) / 2;
    const pt = Math.min(pe * u * u * u, pe, 1);
    const p = solveColumn({ lambda: lam, resid, imp: 0, eOverFy: E_FY, nFib: 201 });
    assert.ok(Math.abs(p.Pu - pt) < 0.03, `λ=${lam} Pu=${p.Pu} Pt=${pt}`);
  }
});

test('不整を大きくすると強度は下がる', () => {
  const base = { lambda: 0.9, eOverFy: E_FY };
  const a = solveColumn({ ...base, resid: 0, imp: 1 / 1000 }).Pu;
  const b = solveColumn({ ...base, resid: 0.3, imp: 1 / 1000 }).Pu;
  const c = solveColumn({ ...base, resid: 0.3, imp: 1 / 500 }).Pu;
  assert.ok(a > b && b > c, `${a} ${b} ${c}`);
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
