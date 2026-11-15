// 軸力と曲げを同時に受ける柱の照査(設計で使う相関式の形)と、安全率。
//
// 記号(どれも無次元)
//  n  = 作用する軸力 ÷ 降伏荷重
//  m  = 作用する曲げ(軸力がないときの曲げモーメント)÷ 曲げの強さ
//  pu = 軸力だけのときの柱の強さ ÷ 降伏荷重(全体座屈の強さ × 局部座屈の強さの割合)
//  pe = オイラーの座屈荷重 ÷ 降伏荷重 = 1/λ̄²
//
// 仮定: 曲げは一方向で、座屈する向きと同じ向き。曲げの強さは一定(横ねじれ座屈などは考えない)。
// 軸力による曲げの増幅は 1/(1 − 軸力/オイラー荷重) で表す(たわみがサインカーブに近いときの近似)。

/** 軸力が曲げ(たわみ)を何倍に増やすか */
export function amplification(n: number, pe: number): number {
  const r = n / pe;
  return r >= 1 ? Infinity : 1 / (1 - r);
}

/** 照査式の左辺。1 以下なら耐えられる: n/pu + m × 増幅 ≦ 1 */
export function interaction(n: number, m: number, pu: number, pe: number): number {
  return n / pu + m * amplification(n, pe);
}

/** 増幅を考えないときの左辺(直線の相関): n/pu + m */
export const interactionLinear = (n: number, m: number, pu: number) => n / pu + m;

/** 軸力 n のとき、耐えられる曲げ m の上限(相関曲線) */
export function momentCapacity(n: number, pu: number, pe: number): number {
  if (n >= pu) return 0;
  return (1 - n / pu) * (1 - n / pe);
}

/**
 * 安全率: 軸力と曲げを同じ割合で増やしていったとき、何倍で限界(左辺 = 1)に達するか。
 * γ·a + γ·m/(1 − γ·c) = 1(a = n/pu、c = n/pe)を解く。a·c·γ² − (a + m + c)·γ + 1 = 0 の小さい方の根。
 */
export function safetyFactor(n: number, m: number, pu: number, pe: number): number {
  const a = n / pu;
  const c = n / pe;
  const s = a + m + c;
  if (s <= 0) return Infinity;
  if (a * c < 1e-12) return 1 / (a + m);
  return (s - Math.sqrt(s * s - 4 * a * c)) / (2 * a * c);
}
