// 圧縮を受ける両端ピン柱の繊維モデル(中央断面でのつり合い)。
//
// 仮定
//  - 断面: 幅 b の長方形の板を、板の幅方向に曲げる(溶接 H 形鋼を弱軸まわりに
//    曲げたときのフランジに相当。フランジ先端がいちばん外側の繊維になる)。
//  - 材料: 完全弾塑性(降伏後の硬化なし)。除荷は弾性(繊維ごとに塑性ひずみを持つ)。
//  - 残留応力: 先端で圧縮 σrc、中央で引張 σrc の直線分布(断面内でつり合う)。
//  - たわみ: 初期たわみ v0·sin(πx/L)、追加たわみ v·sin(πx/L)。
//    つり合いは柱の中央の断面だけで満たす(古典的な近似解法)。
//
// 無次元化(圧縮を正)
//  - 応力は σy、ひずみは εy = σy/E、長さは板幅 b、力は Py = σy·A で割る。
//  - 細長比パラメータ λ̄ = (L/πr)·√(σy/E)、r = b/√12。
//  - 中央の曲率(ひずみ/εy で表す) φ = 12·v/λ̄²。
//  - 弾性のとき P/Py = (1/λ̄²)·v/(v0+v)(オイラー荷重 Pe/Py = 1/λ̄²)。

export interface ColumnParams {
  /** 細長比パラメータ λ̄ */
  lambda: number;
  /** 残留応力の大きさ σrc/σy (0〜0.4 程度) */
  resid: number;
  /** 初期たわみ v0/L (例 1/1000)。0 のときはごく小さい乱れ(L/10^6)を入れる */
  imp: number;
  /** E/σy (例 200000/355) */
  eOverFy: number;
  /** 繊維の数 */
  nFib?: number;
  /** 載荷の刻みの数 */
  nStep?: number;
}

export interface ColumnStep {
  /** 追加たわみ(中央)/b */
  v: number;
  /** 荷重 P/Py */
  P: number;
  /** 断面中心のひずみ/εy */
  eps0: number;
  /** 曲率(ひずみ/εy を b で割った値) */
  phi: number;
  /** 繊維の応力/σy(圧縮を正) */
  sig: Float32Array;
  /** 0=弾性 1=圧縮で降伏 2=引張で降伏 */
  yl: Uint8Array;
  /** 弾性のまま残っている部分の断面二次モーメント / 元の I */
  ieRatio: number;
}

export interface ColumnPath {
  params: ColumnParams;
  /** 繊維の位置 z/b (-0.5〜0.5) */
  z: Float32Array;
  /** 残留応力/σy(圧縮を正) */
  sigR: Float32Array;
  steps: ColumnStep[];
  /** 最大荷重の刻みの番号 */
  peak: number;
  /** 最大荷重 Pu/Py */
  Pu: number;
  /** オイラー荷重 Pe/Py */
  Pe: number;
  /** 柱の長さ L/b */
  L: number;
  /** 初期たわみ v0/b */
  v0: number;
}

const YIELD_TOL = 1e-9;

export function solveColumn(params: ColumnParams): ColumnPath {
  const n = params.nFib ?? 61;
  const nStep = params.nStep ?? 420;
  const lam = params.lambda;
  const r = 1 / Math.sqrt(12);
  const L = lam * Math.PI * r * Math.sqrt(params.eOverFy);
  const v0 = Math.max(params.imp, 1e-6) * L;
  const Pe = 1 / (lam * lam);

  const z = new Float32Array(n);
  const sigR = new Float32Array(n);
  const w = 1 / n;
  for (let i = 0; i < n; i++) {
    z[i] = (i + 0.5) / n - 0.5;
    sigR[i] = params.resid * (4 * Math.abs(z[i]) - 1);
  }
  // 離散化しても残留応力の合力が 0 になるようにそろえる
  let mean = 0;
  for (let i = 0; i < n; i++) mean += sigR[i] * w;
  for (let i = 0; i < n; i++) sigR[i] -= mean;

  const ep = new Float64Array(n); // 塑性ひずみ(確定した値)
  const sig = new Float64Array(n);

  // 与えた eps0・phi での応力・合力(塑性ひずみは確定値から試算)
  const evalSection = (eps0: number, phi: number) => {
    let N = 0;
    let M = 0;
    for (let i = 0; i < n; i++) {
      let s = eps0 + phi * z[i] - ep[i] + sigR[i];
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      sig[i] = s;
      N += s * w;
      M += s * z[i] * w;
    }
    return { N, M };
  };

  const steps: ColumnStep[] = [];
  const snapshot = (v: number, P: number, eps0: number, phi: number) => {
    const s = new Float32Array(n);
    const yl = new Uint8Array(n);
    let ie = 0;
    for (let i = 0; i < n; i++) {
      s[i] = sig[i];
      if (sig[i] >= 1 - YIELD_TOL) yl[i] = 1;
      else if (sig[i] <= -1 + YIELD_TOL) yl[i] = 2;
      else ie += z[i] * z[i] * w;
    }
    steps.push({ v, P, eps0, phi, sig: s, yl, ieRatio: ie * 12 });
  };

  evalSection(0, 0);
  snapshot(0, 0, 0, 0);

  const vMin = v0 * 1e-3;
  const vMax = Math.max(1.2, 0.06 * L);
  let eps0Prev = 0;
  for (let k = 1; k <= nStep; k++) {
    const v = vMin * Math.pow(vMax / vMin, (k - 1) / (nStep - 1));
    const phi = (12 * v) / (lam * lam);
    const arm = v0 + v;
    const g = (e: number) => {
      const { N, M } = evalSection(e, phi);
      return M - N * arm;
    };
    // g は eps0 について減少。前の刻みの値のまわりで符号の変わる区間を探す
    let lo = eps0Prev - 0.05;
    let hi = eps0Prev + 0.05;
    let glo = g(lo);
    let ghi = g(hi);
    let guard = 0;
    while (glo < 0 && guard++ < 60) {
      lo -= (hi - lo);
      glo = g(lo);
    }
    guard = 0;
    while (ghi > 0 && guard++ < 60) {
      hi += (hi - lo);
      ghi = g(hi);
    }
    for (let it = 0; it < 60; it++) {
      const mid = 0.5 * (lo + hi);
      if (g(mid) > 0) lo = mid;
      else hi = mid;
    }
    const eps0 = 0.5 * (lo + hi);
    const { N } = evalSection(eps0, phi);
    // 塑性ひずみを確定
    for (let i = 0; i < n; i++) {
      const trial = eps0 + phi * z[i] - ep[i] + sigR[i];
      if (trial > 1) ep[i] += trial - 1;
      else if (trial < -1) ep[i] += trial + 1;
    }
    snapshot(v, N, eps0, phi);
    eps0Prev = eps0;
  }

  let peak = 0;
  for (let k = 1; k < steps.length; k++) if (steps[k].P > steps[peak].P) peak = k;

  return { params, z, sigR, steps, peak, Pu: steps[peak].P, Pe, L, v0 };
}

/** 載荷装置の荷重 s (P/Py) に対する柱の状態。最大荷重を超えたら崩壊の過程を進める */
export interface ColumnView {
  /** 刻みの番号(小数。前後を補間して使う) */
  index: number;
  step: ColumnStep;
  /** 最大荷重を超えて崩壊しているか */
  collapsed: boolean;
}

export function viewAtLoad(path: ColumnPath, s: number, collapseSpan = 0.08): ColumnView {
  const { steps, peak, Pu } = path;
  if (s >= Pu) {
    const t = Math.min(1, (s - Pu) / collapseSpan);
    // 崩壊後は たわみが柱の長さの 1/40 になる所まで進める
    let end = peak;
    const vEnd = path.L / 40;
    while (end < steps.length - 1 && steps[end].v + path.v0 < vEnd) end++;
    const idx = peak + t * (end - peak);
    return { index: idx, step: lerpStep(steps, idx), collapsed: s > Pu };
  }
  let lo = 0;
  let hi = peak;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (steps[mid].P <= s) lo = mid;
    else hi = mid;
  }
  const a = steps[lo];
  const b = steps[hi];
  const t = b.P > a.P ? (s - a.P) / (b.P - a.P) : 0;
  const idx = lo + Math.min(1, Math.max(0, t));
  return { index: idx, step: lerpStep(steps, idx), collapsed: false };
}

function lerpStep(steps: ColumnStep[], idx: number): ColumnStep {
  const i = Math.min(steps.length - 2, Math.floor(idx));
  const t = idx - i;
  const a = steps[i];
  const b = steps[i + 1];
  if (t <= 0) return a;
  if (t >= 1) return b;
  const n = a.sig.length;
  const sig = new Float32Array(n);
  for (let k = 0; k < n; k++) sig[k] = a.sig[k] + (b.sig[k] - a.sig[k]) * t;
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    v: m(a.v, b.v),
    P: m(a.P, b.P),
    eps0: m(a.eps0, b.eps0),
    phi: m(a.phi, b.phi),
    sig,
    yl: t < 0.5 ? a.yl : b.yl,
    ieRatio: m(a.ieRatio, b.ieRatio),
  };
}

/** 道路橋示方書(平成24年版まで)の基準耐荷力曲線 σcr/σy */
export function dohshiOld(lam: number): number {
  if (lam <= 0.2) return 1;
  if (lam <= 1) return 1.109 - 0.545 * lam;
  return 1 / (0.773 + lam * lam);
}
