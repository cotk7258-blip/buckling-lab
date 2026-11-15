// 一様な圧縮を受ける板(両側の縁が支えられた長い板)の局部座屈。

export const E = 200000; // N/mm²
export const NU = 0.3;
/** 座屈係数。両縁が単純支持の長い板で 4 */
export const K_PLATE = 4;

/** 弾性座屈応力 σel (N/mm²)。b: 板幅、t: 板厚 */
export function sigmaEl(b: number, t: number, k = K_PLATE): number {
  return ((k * Math.PI ** 2 * E) / (12 * (1 - NU ** 2))) * (t / b) ** 2;
}

/** 幅厚比パラメータ R = √(σy/σel) */
export function plateR(b: number, t: number, sigmaY: number, k = K_PLATE): number {
  return Math.sqrt(sigmaY / sigmaEl(b, t, k));
}

/** 理論値(弾性座屈)σel/σy = 1/R² */
export const plateTheory = (R: number) => 1 / (R * R);

/**
 * 道路橋示方書(平成24年版まで)の両縁支持板の局部座屈に対する強さ σcr/σy。
 * R ≦ 0.7 で 1.0、それより大きいと 0.5/R²。式どおりだと R = 0.7 のすぐ上で 1.02 になるので 1.0 で頭打ちにする。
 */
export function plateStrength(R: number): number {
  return R <= 0.7 ? 1 : Math.min(1, 0.5 / (R * R));
}

/** 等間隔の縦リブ n 本(十分に硬い)で分けたときの、1枚あたりの板幅 */
export const panelWidth = (b: number, ribs: number) => b / (ribs + 1);
