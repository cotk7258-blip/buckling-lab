export const C = {
  comp: '#38bdf8',
  tens: '#fb923c',
  yield: '#f43f5e',
  gold: '#fbbf24',
  base: '#22335a',
  ink: '#e8eefc',
  dim: '#9fb0d0',
  ideal: '#86efac',
  real: '#e2e8f0',
};

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
const BASE = hex(C.base);
const COMP = hex(C.comp);
const TENS = hex(C.tens);

/** 応力/σy(圧縮を正)から色。降伏(±1)は赤 */
export function stressColor(s: number): string {
  if (s >= 0.995 || s <= -0.995) return C.yield;
  const t = Math.min(1, Math.abs(s));
  const to = s >= 0 ? COMP : TENS;
  const k = 0.12 + 0.88 * t;
  const r = Math.round(BASE[0] + (to[0] - BASE[0]) * k);
  const g = Math.round(BASE[1] + (to[1] - BASE[1]) * k);
  const b = Math.round(BASE[2] + (to[2] - BASE[2]) * k);
  return `rgb(${r},${g},${b})`;
}
