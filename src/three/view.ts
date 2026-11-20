/**
 * 見る人が調整するカメラ(全映像で共通)。場面ごとの構図に、平行移動と引きを上乗せする。
 * x・y: 画面の横・縦への平行移動(構図の半分の幅・高さを 1 とする)。zoom: 1 より大きいほど引く。
 */
export const VIEW_DEFAULT = { x: 0, y: 0, zoom: 1.15 };
export const VIEW = { ...VIEW_DEFAULT };

const KEY = 'buckling-lab-view';
try {
  const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (v && typeof v.zoom === 'number') Object.assign(VIEW, { x: +v.x || 0, y: +v.y || 0, zoom: Math.min(2.5, Math.max(0.6, v.zoom)) });
} catch {
  /* 読めなくても既定の構図で動く */
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(VIEW));
  } catch {
    /* 保存できなくても動く */
  }
}

export function panView(dx: number, dy: number) {
  VIEW.x = Math.max(-1.5, Math.min(1.5, VIEW.x + dx));
  VIEW.y = Math.max(-1.5, Math.min(1.5, VIEW.y + dy));
  save();
}
export function zoomView(f: number) {
  VIEW.zoom = Math.max(0.6, Math.min(2.5, VIEW.zoom * f));
  save();
}
export function resetView() {
  Object.assign(VIEW, VIEW_DEFAULT);
  save();
}

/**
 * 構図 c(中心 cx・cy、半分の幅 hw・高さ hh、水平の向き az 度)に調整を上乗せした、カメラの注視点と半分の幅・高さ。
 * 平行移動はカメラから見た左右(向きに合わせる)と上下。
 */
export function applyView(c: { cx: number; cy: number; hw: number; hh: number }, azDeg: number, v = VIEW) {
  const az = (azDeg * Math.PI) / 180;
  const px = v.x * c.hw;
  return {
    tx: c.cx + px * Math.cos(az),
    ty: c.cy + v.y * c.hh,
    tz: -px * Math.sin(az),
    hw: c.hw * v.zoom,
    hh: c.hh * v.zoom,
  };
}

/** 画面の表示を、なめらかに目標の調整へ寄せるための入れ物 */
export function smoothView(cur: { x: number; y: number; zoom: number }, dt: number) {
  const k = 1 - Math.exp(-dt * 6);
  cur.x += (VIEW.x - cur.x) * k;
  cur.y += (VIEW.y - cur.y) * k;
  cur.zoom += (VIEW.zoom - cur.zoom) * k;
  return cur;
}
