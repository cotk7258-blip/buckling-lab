// 複合座屈(軸力と曲げの組合せ)の照査を、映像用に無次元で書いたもの。式の形は check.ts と同じ。
//
//  n  = σc/σy(発生する軸方向圧縮応力)
//  m  = 曲げの使用割合の素(発生する曲げ応力 ÷ 曲げの許容値。α で割る前)
//  pu = σcz/σy(全体座屈の許容値。局部座屈を考慮した値)
//  pe = σe/σy = 1/λ²(オイラー座屈応力)
//
// ここでは曲げは1方向だけ(座屈する向きと同じ軸)。2方向の式は check.ts。

/** α = 1 − σc/(0.8σe)。軸力による付加曲げの影響を表す係数 */
export const alpha = (n: number, pe: number) => 1 - n / (0.8 * pe);

/** 使用割合の合計 U = σc/σcz + (曲げ)/α。α ≦ 0 は適用範囲外で Infinity */
export function usage(n: number, m: number, pu: number, pe: number): number {
  const a = alpha(n, pe);
  if (a <= 0) return Infinity;
  return n / pu + m / a;
}

/** 安全率 = 1/U */
export const safety = (n: number, m: number, pu: number, pe: number) => 1 / usage(n, m, pu, pe);

/** 軸力 n のとき、U = 1 になる曲げ m(耐えられる限界の線) */
export function momentLimit(n: number, pu: number, pe: number): number {
  if (n >= pu) return 0;
  return Math.max(0, (1 - n / pu) * alpha(n, pe));
}

/**
 * 軸力と曲げを同じ割合で増やしたとき、U = 1 に達する倍率(限界の線にぶつかる所)。
 * γ·a + γ·m/(1 − γ·c) = 1(a = n/pu、c = n/(0.8pe))の小さい方の根。α が変わるので 1/U より小さい。
 */
export function loadFactor(n: number, m: number, pu: number, pe: number): number {
  const a = n / pu;
  const c = n / (0.8 * pe);
  const s = a + m + c;
  if (s <= 0) return Infinity;
  if (a * c < 1e-12) return 1 / (a + m);
  return (s - Math.sqrt(s * s - 4 * a * c)) / (2 * a * c);
}
