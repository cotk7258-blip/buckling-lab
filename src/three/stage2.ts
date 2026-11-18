import * as THREE from 'three';
import { ShowBase, arrow, label, line, placeArrow, ramp, setLine, tintArrow, tube } from './kit.ts';

/** 支え方。pp=両端ピン、ff=両端固定、cf=根元固定・先端自由(片持ち)、fp=根元固定・先端ピン */
export type Support = 'pp' | 'ff' | 'cf' | 'fp';

const KFP = 4.493409457909064; // tan(k) = k の最初の根
const fpRaw = (x: number) => Math.sin(KFP * x) - KFP * x - Math.tan(KFP) * (Math.cos(KFP * x) - 1);
let fpMax = 0;
for (let i = 0; i <= 400; i++) fpMax = Math.max(fpMax, Math.abs(fpRaw(i / 400)));
const fpSign = fpRaw(0.6) > 0 ? 1 : -1;

/** 座屈の形(最大のずれを 1 にそろえる)、強さ(両端ピンの何倍か)、有効座屈長/長さ、サインカーブ半分にあたる範囲 */
export const SUPPORTS: Record<Support, { name: string; w: (x: number) => number; gain: number; le: number; wave: [number, number] }> = {
  cf: { name: '根元だけ固定(片持ち)', w: (x) => 1 - Math.cos((Math.PI * x) / 2), gain: 0.25, le: 2, wave: [-1, 1] },
  pp: { name: '両端ピン', w: (x) => Math.sin(Math.PI * x), gain: 1, le: 1, wave: [0, 1] },
  fp: { name: '片方固定・片方ピン', w: (x) => (fpSign * fpRaw(x)) / fpMax, gain: (Math.PI / KFP) ** -2 * 1, le: Math.PI / KFP, wave: [1 - Math.PI / KFP, 1] },
  ff: { name: '両端固定', w: (x) => (1 - Math.cos(2 * Math.PI * x)) / 2, gain: 4, le: 0.5, wave: [0.25, 0.75] },
};
// fp: Pcr = k²EI/L² = (k/π)²·Pe
SUPPORTS.fp.gain = (KFP / Math.PI) ** 2;

const DARK = () => new THREE.MeshStandardMaterial({ color: '#6f7d94', metalness: 0.45, roughness: 0.5 });
const BRIGHT = () => new THREE.MeshStandardMaterial({ color: '#c9d3e3', metalness: 0.9, roughness: 0.25 });

/** 細い棒1本(下端が原点)。支え方に合わせた形で横にずれる */
class Bar {
  group = new THREE.Group();
  private mesh: THREE.Mesh;
  private base: Float32Array;
  private short: Float32Array; // ずれ 1 のときの縮み(下からの累積)
  private topGroup = new THREE.Group();
  private arrow: THREE.Group;
  private wave: THREE.Mesh | null = null;
  private react: THREE.Group;
  private fOut: THREE.Group;
  private fBack: THREE.Group;
  private tagsF: THREE.Sprite[] = [];
  private xiMax = 0.5;
  /** 反力と、曲げる力・戻す力の矢印を出すか。札も出すか */
  forces = true;
  tags = false;
  D = 0;
  topX = 0;
  topY = 0;

  constructor(public sup: Support, public H: number, private Dfin = 0.42) {
    const geo = new THREE.BoxGeometry(0.13, H, 0.13, 1, 56, 1);
    this.base = new Float32Array(geo.attributes.position.array as Float32Array);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#9aa8bd', metalness: 0.7, roughness: 0.3 }));
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh, this.topGroup);
    const w = SUPPORTS[sup].w;
    this.short = new Float32Array(201);
    for (let i = 1; i <= 200; i++) {
      const d = (w(i / 200) - w((i - 1) / 200)) * 200;
      this.short[i] = this.short[i - 1] + (d * d) / (2 * H) / 200;
    }
    // 下の支え
    if (sup === 'pp') {
      const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.3, 0.34, 4), DARK());
      tri.rotation.y = Math.PI / 4;
      tri.position.y = -0.2;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), BRIGHT());
      this.group.add(tri, ball);
    } else {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.7), DARK());
      block.position.y = -0.12;
      this.group.add(block);
    }
    // 上の支え
    if (sup === 'pp' || sup === 'fp') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), BRIGHT());
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.5), DARK());
      plate.position.y = 0.13;
      this.topGroup.add(ball, plate);
    } else if (sup === 'ff') {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.6), DARK());
      block.position.y = 0.02;
      this.topGroup.add(block);
    }
    this.arrow = arrow('#1f2a44');
    this.arrow.scale.set(1.6, 1, 1.6);
    this.group.add(this.arrow);
    // サインカーブ半分(有効座屈長)の目印
    const [a, b] = SUPPORTS[sup].wave;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = a + ((b - a) * i) / 40;
      pts.push(new THREE.Vector3(Dfin * w(Math.abs(x)), x * H, 0.12));
    }
    this.wave = tube(pts, 0.035, '#e11d48', 0.9);
    this.wave.visible = false;
    this.group.add(this.wave);
    // 反力(下の支えから上向き)、曲げる力(外力 P × ずれ)と戻す力(回復力)
    this.react = arrow('#64748b');
    this.react.scale.set(1.4, 1, 1.4);
    this.fOut = arrow('#ea580c');
    this.fBack = arrow('#0284c7');
    for (const a of [this.fOut, this.fBack]) a.scale.set(1.3, 1, 1.3);
    this.group.add(this.react, this.fOut, this.fBack);
    for (const [t, c] of [['外力 P', '#1f2a44'], ['反力', '#64748b'], ['曲げる力', '#ea580c'], ['戻す力', '#0284c7']] as const) {
      const sp = label(t, c);
      sp.scale.multiplyScalar(0.6);
      sp.visible = false;
      this.group.add(sp);
      this.tagsF.push(sp);
    }
    let best = 0;
    for (let i = 0; i <= 100; i++) {
      const v = Math.abs(w(i / 100));
      if (v > best) {
        best = v;
        this.xiMax = i / 100;
      }
    }
  }

  /** D: いちばんずれる所のずれ。load: 矢印の長さ(0〜1 くらい)。wave: 赤い目印を出すか */
  /** ratio: 押す力 ÷ 座屈荷重(曲げる力と戻す力の比)。省略すると、その矢印は出さない */
  update(D: number, load: number, showWave = false, ratio?: number) {
    this.D = D;
    const w = SUPPORTS[this.sup].w;
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const H = this.H;
    for (let i = 0; i < pos.count; i++) {
      const xi = this.base[i * 3 + 1] / H + 0.5;
      const slope = (D * (w(Math.min(1, xi + 0.005)) - w(Math.max(0, xi - 0.005)))) / (0.01 * H);
      const sh = D * D * this.short[Math.round(xi * 200)];
      pa[i * 3] = this.base[i * 3] + D * w(xi);
      pa[i * 3 + 1] = xi * H - this.base[i * 3] * slope - sh;
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.topX = D * w(1);
    this.topY = H - D * D * this.short[200];
    this.topGroup.position.set(this.topX, this.topY, 0);
    const len = 0.25 + 0.7 * Math.min(1.3, load);
    placeArrow(this.arrow, this.topX, this.topY + 0.22 + len, 0, 0, load > 0.005 ? -len : 0);
    if (this.wave) this.wave.visible = showWave && D > this.Dfin * 0.9;
    const base = this.sup === 'pp' ? -0.4 : -0.34;
    const rl = load > 0.005 ? len : 0;
    placeArrow(this.react, 0, base - rl, 0, 0, this.forces ? rl : 0);
    const on = this.forces && ratio !== undefined && D > 0.04;
    const xi = this.xiMax;
    const x = D * w(xi);
    const y = xi * H - D * D * this.short[Math.round(xi * 200)];
    const k = 2.4 * Math.abs(D);
    placeArrow(this.fOut, x + 0.12, y + 0.15, 0.15, on ? k * (ratio ?? 0) : 0, 0);
    placeArrow(this.fBack, x - 0.12, y - 0.15, 0.15, on ? -k : 0, 0);
    const tg = this.tags;
    this.tagsF[0].visible = tg && load > 0.005;
    this.tagsF[0].position.set(this.topX + 0.55, this.topY + 0.5, 0.2);
    this.tagsF[1].visible = tg && this.forces && load > 0.005;
    this.tagsF[1].position.set(0.45, base - 0.35, 0.2);
    this.tagsF[2].visible = tg && on;
    this.tagsF[2].position.set(x + 0.12 + k * (ratio ?? 0) + 0.45, y + 0.15, 0.25);
    this.tagsF[3].visible = tg && on;
    this.tagsF[3].position.set(x - 0.12 - k - 0.4, y - 0.15, 0.25);
  }

  /** 高さ xi(0〜1)の位置 */
  at(xi: number): [number, number] {
    return [this.D * SUPPORTS[this.sup].w(xi), xi * this.H];
  }
}

function tag(text: string, color: string, size = 0.7, wide = 1) {
  const s = label(text, color, wide);
  s.scale.multiplyScalar(size);
  return s;
}

/**
 * 回す力(モーメント)の矢印: 点のまわりの、右側の円弧と矢じり。ccw = 左回り(右側では上向き)。
 * 半径 1 で作り、scale で大きさを表す
 */
function curvedArrow(color: string, ccw: boolean) {
  const g = new THREE.Group();
  const a0 = -0.95;
  const a1 = 0.95;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 30; i++) {
    const a = a0 + ((a1 - a0) * i) / 30;
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  g.add(tube(pts, 0.05, color, 0.7));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
  const end = ccw ? a1 : a0;
  head.position.set(Math.cos(end), Math.sin(end), 0);
  // 円の接線の向き(ccw なら角度が増える向き)
  const dir = ccw ? new THREE.Vector3(-Math.sin(end), Math.cos(end), 0) : new THREE.Vector3(Math.sin(end), -Math.cos(end), 0);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(head);
  return g;
}

function plot(f: (x: number) => number, color: string, H: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) pts.push(new THREE.Vector3(f(i / 60), (i / 60) * H, 0));
  return tube(pts, 0.03, color, 0.8);
}

const ORDER: Support[] = ['cf', 'pp', 'fp', 'ff'];

export interface Lab2 {
  sup: Support;
  L: number; // m
  load: number; // P / (座屈荷重と降伏荷重の小さい方)
  /** 座屈荷重が降伏荷重を超える(オイラーの式が使えない)長さか */
  yieldFirst: boolean;
}

export class Stage2Show extends ShowBase {
  private g0 = new THREE.Group(); // 1本(両端ピン)
  private main: Bar;
  private hOut: THREE.Group;
  private hBack: THREE.Group;
  private tOut: THREE.Sprite;
  private tBack: THREE.Sprite;
  private offLine: THREE.Line;
  /** 場面「綱引き」: 真ん中の断面にかかる2つのモーメント(回す力)と、ずれ y、比べるゲージ、きっかけの指 */
  private g1 = new THREE.Group();
  private mBend: THREE.Group;
  private mBack: THREE.Group;
  private yArrow: THREE.Group;
  private poke: THREE.Group;
  private gauge: THREE.Mesh[] = [];
  private t1: Record<string, THREE.Sprite> = {};
  private g2 = new THREE.Group(); // 長さ1倍と2倍
  private short: Bar;
  private long: Bar;
  private tags2: THREE.Sprite[] = [];
  private g3 = new THREE.Group(); // サインカーブと傾き・曲がり
  private bar3: Bar;
  private plots: THREE.Mesh[] = [];
  private tags3: THREE.Sprite[] = [];
  private axes3: THREE.Line[] = [];
  /** 場面「式にする」: 柱の上の1点で、ずれ y・傾き y′・曲がり y″ を示す */
  private gProbe = new THREE.Group();
  private pY: THREE.Group;
  private pTan: THREE.Mesh | null = null;
  private pArc: THREE.Mesh | null = null;
  private pDot: THREE.Mesh;
  private pDots: THREE.Mesh[] = [];
  private pLine: THREE.Line;
  private pTags: THREE.Sprite[] = [];
  private pKey = '';
  private pOut: THREE.Group;
  private pBack: THREE.Group;
  private g5 = new THREE.Group(); // 支え方4種
  private four: Bar[] = [];
  private tags5: THREE.Sprite[][] = [];
  private gLab = new THREE.Group();
  private labBar: Bar | null = null;
  private labKey = '';
  private dyn = [0, 0, 0, 0];
  lab: Lab2 = { sup: 'pp', L: 8, load: 0.5, yieldFirst: false };

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.scene.add(this.g0, this.g2, this.g3, this.g5, this.gLab);

    this.main = new Bar('pp', 3.0, 0.5);
    this.main.tags = true;
    this.g0.add(this.main.group);
    this.hOut = arrow('#ea580c');
    this.hBack = arrow('#0284c7');
    for (const a of [this.hOut, this.hBack]) a.scale.set(1.5, 1, 1.5);
    tintArrow(this.hOut, '#ea580c');
    tintArrow(this.hBack, '#0284c7');
    this.tOut = tag('曲げる力', '#ea580c', 0.75);
    this.tBack = tag('戻す力', '#0284c7', 0.75);
    this.offLine = line('#6d28d9', true);
    this.g0.add(this.hOut, this.hBack, this.tOut, this.tBack, this.offLine);

    // 綱引きの場面の部品
    this.g0.add(this.g1);
    this.mBend = curvedArrow('#ea580c', true);
    this.mBack = curvedArrow('#0284c7', false);
    this.yArrow = arrow('#1f2a44');
    this.yArrow.scale.set(0.5, 1, 0.5);
    this.poke = arrow('#64748b');
    this.poke.scale.set(1.2, 1, 1.2);
    this.g1.add(this.mBend, this.mBack, this.yArrow, this.poke);
    for (const c of ['#ea580c', '#0284c7']) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 0.05), new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false }));
      this.gauge.push(m);
      this.g1.add(m);
    }
    const mk = (k: string, text: string, color: string, size = 0.62) => {
      const sp = tag(text, color, size, Math.max(1, (text.length * 76 + 60) / 512));
      this.g1.add(sp);
      this.t1[k] = sp;
    };
    mk('y', 'ずれ y(腕の長さ)', '#1f2a44');
    mk('path', '押す力の通り道', '#6d28d9', 0.55);
    mk('bend', '曲げるモーメント P × y', '#ea580c');
    mk('back', '戻すモーメント EI × 1/R', '#0284c7');
    mk('poke', '横から少し押す(きっかけ)', '#64748b');
    mk('gb', '曲げる P × y', '#ea580c', 0.55);
    mk('gk', '戻す EI × 1/R', '#0284c7', 0.55);
    mk('gt', '真ん中の断面の回す力', '#1f2a44', 0.55);
    this.g1.visible = false;

    this.short = new Bar('pp', 1.6, 0.4);
    this.short.group.position.x = -1.5;
    this.long = new Bar('pp', 3.2, 0.4);
    this.long.group.position.x = 1.0;
    this.g2.add(this.short.group, this.long.group);
    for (const [t, x, y, c] of [['長さ 1', -1.5, -0.75, '#1f2a44'], ['長さ 2', 1.0, -0.75, '#1f2a44'], ['限界 100%', -2.55, 1.0, '#6d28d9'], ['限界 25%', 2.35, 1.9, '#6d28d9']] as const) {
      const s = tag(t, c, 0.75);
      s.position.set(x, y, 0.3);
      this.g2.add(s);
      this.tags2.push(s);
    }

    this.bar3 = new Bar('pp', 3.0, 0.5);
    this.bar3.group.position.x = -2.9;
    this.g3.add(this.bar3.group);
    const defs: [(x: number) => number, string, string, number][] = [
      [(x) => Math.sin(Math.PI * x), '#1f2a44', 'ずれ y', -1.2],
      [(x) => Math.cos(Math.PI * x), '#0284c7', '傾き y′', 0.6],
      [(x) => -Math.sin(Math.PI * x), '#6d28d9', '曲がり y″', 2.5],
    ];
    for (const [f, c, name, x] of defs) {
      const p = plot(f, c, 3.0);
      p.position.x = x;
      const ax = line('#b4c0d2');
      setLine(ax, x, 0, x, 3.0, -0.02);
      const s = tag(name, c, 0.7, name.length > 4 ? 2 : 1);
      s.position.set(x, -0.4, 0.2);
      this.g3.add(p, ax, s);
      this.axes3.push(ax);
      this.plots.push(p);
      this.tags3.push(s);
    }
    // 柱の上の1点と、その高さの横線・グラフ上の点
    this.g3.add(this.gProbe);
    this.pY = arrow('#1f2a44');
    this.pY.scale.set(0.7, 1, 0.7);
    const ball = (c: string, r = 0.07) => new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 }));
    this.pDot = ball('#e11d48', 0.08);
    for (const c of ['#1f2a44', '#0284c7', '#6d28d9']) {
      const d = ball(c);
      this.pDots.push(d);
      this.gProbe.add(d);
    }
    this.pLine = line('#e11d48', true);
    // 場面「式にする」: 赤い点での、曲げる力(外力による)と戻す力(回復力)
    this.pOut = arrow('#ea580c');
    this.pBack = arrow('#0284c7');
    for (const a of [this.pOut, this.pBack]) a.scale.set(1.1, 1, 1.1);
    this.gProbe.add(this.pY, this.pDot, this.pLine, this.pOut, this.pBack);
    for (const [t, c] of [['ずれ y', '#1f2a44'], ['傾き y′(接線)', '#0284c7'], ['曲がり y″ = −1/R', '#6d28d9'], ['曲げる力 P × y', '#ea580c'], ['戻す力 EI × 1/R', '#0284c7']] as const) {
      const s = tag(t, c, 0.62, Math.max(1.3, (t.length * 76 + 60) / 512));
      this.gProbe.add(s);
      this.pTags.push(s);
    }
    this.gProbe.visible = false;

    ORDER.forEach((sup, i) => {
      const b = new Bar(sup, 2.3, 0.36);
      b.group.position.x = (i - 1.5) * 1.75 - 0.15;
      this.g5.add(b.group);
      this.four.push(b);
      const info = SUPPORTS[sup];
      const gain = info.gain < 1 ? '1/4 倍' : info.gain === 1 ? '1 倍(基準)' : `${info.gain < 3 ? '約 2' : '4'} 倍`;
      const t1 = tag(gain, '#6d28d9', 0.75);
      t1.position.set(b.group.position.x + 0.15, 3.55, 0.3);
      const t2 = tag(`波の長さ ${info.le === 1 ? '1' : info.le < 0.6 ? '0.5' : info.le > 1.5 ? '2' : '0.7'}`, '#e11d48', 0.6);
      t2.position.set(b.group.position.x + 0.15, 3.2, 0.3);
      this.g5.add(t1, t2);
      this.tags5.push([t1, t2]);
    });
    this.setScene(0);
  }

  private only(g: THREE.Group) {
    for (const x of [this.g0, this.g2, this.g3, this.g5, this.gLab]) x.visible = x === g;
    this.g1.visible = false;
  }

  private forces(D: number, p: number, on: boolean) {
    const [x, y] = this.main.at(0.5);
    const out = 2.6 * D * p;
    const back = 2.6 * D;
    const vis = on && D > 0.05;
    placeArrow(this.hOut, x + 0.12, y + 0.22, 0.2, vis ? out : 0, 0);
    placeArrow(this.hBack, x - 0.12, y - 0.22, 0.2, vis ? -back : 0, 0);
    this.tOut.visible = vis;
    this.tBack.visible = vis;
    this.tOut.position.set(x + 0.12 + out + 0.75, y + 0.22, 0.3);
    this.tBack.position.set(x - 0.12 - back - 0.6, y - 0.22, 0.3);
    this.offLine.visible = vis;
    setLine(this.offLine, 0, 0, 0, this.main.topY, 0.05);
  }

  /**
   * 綱引きの場面: 真ん中の断面で、曲げるモーメント P·y(オレンジ、左回り)と戻すモーメント EI/R(青、右回り)を描く。
   * p = P/Pe。両端ピンのサインカーブでは EI/R = Pe·y なので、2つの比は p だけで決まる(y によらない)
   */
  private tug(D: number, p: number, show: boolean, pokeLen: number) {
    this.g1.visible = true;
    const [x, y] = this.main.at(0.5);
    const z = 0.25;
    // 押す力の通り道(上下のピンを結ぶ点線)と、ずれ y: 通り道から真ん中までの横の距離
    this.offLine.visible = show;
    setLine(this.offLine, 0, -0.1, 0, this.main.topY + 0.1, 0.2);
    this.t1.path.visible = show;
    this.t1.path.position.set(-0.75, this.main.topY * 0.82, z);
    placeArrow(this.yArrow, 0, y, z, x, 0);
    this.yArrow.visible = show && x > 0.06;
    this.t1.y.visible = this.yArrow.visible;
    this.t1.y.position.set(x / 2 - 0.15, y - 0.28, z);
    // 回す力の大きさ(絵の上): どちらも y に比例。曲げる方は p 倍
    const kM = 2.2;
    const mb = kM * p * D;
    const mk = kM * D;
    void mk;
    const on = show && D > 0.03;
    this.mBend.visible = on && mb > 0.02;
    this.mBack.visible = on;
    this.mBend.position.set(x, y, z);
    this.mBack.position.set(x, y, z);
    // 円弧の半径を回す力に比例させる。互角(p = 1)なら同じ円に重なり、矢じりだけが逆を向く
    const rb = 0.12 + 1.7 * p * D;
    const rk = 0.18 + 1.7 * D;
    this.mBend.scale.setScalar(rb);
    this.mBack.scale.setScalar(rk);
    this.mBend.position.z = z + 0.04;
    this.t1.bend.visible = this.mBend.visible;
    this.t1.bend.position.set(x + rb * 0.6 + 0.95, y + rb * 0.85 + 0.15, z);
    this.t1.back.visible = on;
    this.t1.back.position.set(x + rk * 0.6 + 1.0, y - rk * 0.85 - 0.15, z);
    // 比べるゲージ(左上)
    const gx = -2.5;
    const gy = 3.05;
    const L = 1.5;
    const set = (m: THREE.Mesh, len: number, yy: number) => {
      m.visible = show && len > 0.01;
      m.scale.x = Math.max(0.01, len);
      m.position.set(gx + len / 2, yy, 0.1);
    };
    set(this.gauge[0], L * Math.min(1.4, (mb / kM) * 2), gy);
    set(this.gauge[1], L * Math.min(1.4, (mk / kM) * 2), gy - 0.36);
    this.t1.gt.visible = show;
    this.t1.gt.position.set(gx + 0.7, gy + 0.36, 0.1);
    this.t1.gb.visible = show;
    this.t1.gb.position.set(gx - 0.55, gy, 0.1);
    this.t1.gk.visible = show;
    this.t1.gk.position.set(gx - 0.6, gy - 0.36, 0.1);
    // きっかけの指(横から押す)
    placeArrow(this.poke, x - 0.1 - pokeLen, y + 0.35, z, pokeLen, 0);
    this.poke.visible = pokeLen > 0.05;
    this.t1.poke.visible = this.poke.visible;
    this.t1.poke.position.set(x - 0.4 - pokeLen, y + 0.7, z);
  }

  /** 柱の上の高さ ξ の点で、ずれ(矢印)・傾き(接線)・曲がり(ぴったり合う円)を描き、グラフの同じ高さに点を打つ */
  private probe(D: number, t: number, s: number) {
    // 赤い点の高さ: 説明の間は下から3割の所。途中で上下に動かし、最後は真ん中
    const [a, b] = s === 3 ? [18, 24] : [21, 28];
    const xi = t < a ? 0.3 : t < b ? 0.5 - 0.38 * Math.cos(((t - a) / (b - a)) * Math.PI * 2) : 0.5;
    const H = this.bar3.H;
    const bx = this.bar3.group.position.x;
    const px = bx + D * Math.sin(Math.PI * xi);
    const py = xi * H;
    this.pDot.position.set(px, py, 0.12);
    // ずれ: 元の線から点まで
    placeArrow(this.pY, bx, py, 0.12, px - bx, 0);
    this.pY.visible = px - bx > 0.06;
    // 横の点線と、3本のグラフ上の点(ずれ sin、傾き cos、曲がり −sin。グラフの横幅は形を見せるための目盛り)
    setLine(this.pLine, bx - 0.2, py, 3.4, py, 0.08);
    const fs = [Math.sin(Math.PI * xi), Math.cos(Math.PI * xi), -Math.sin(Math.PI * xi)];
    this.plots.forEach((p, i) => this.pDots[i].position.set(p.position.x + p.scale.x * fs[i], py, 0.1));
    // 接線と、曲率の円(絵の上の値で計算)
    const key = `${xi.toFixed(3)}|${D.toFixed(3)}`;
    if (key !== this.pKey) {
      this.pKey = key;
      const d1 = (D * Math.PI * Math.cos(Math.PI * xi)) / H; // dx/dy
      const d2 = (-D * Math.PI * Math.PI * Math.sin(Math.PI * xi)) / (H * H);
      const n = Math.hypot(1, d1);
      const tx = d1 / n;
      const ty = 1 / n;
      const tl = 1.0;
      if (this.pTan) {
        this.gProbe.remove(this.pTan);
        this.pTan.geometry.dispose();
      }
      this.pTan = tube([new THREE.Vector3(px - tx * tl, py - ty * tl, 0.16), new THREE.Vector3(px + tx * tl, py + ty * tl, 0.16)], 0.035, '#0284c7', 0.9);
      this.gProbe.add(this.pTan);
      if (this.pArc) {
        this.gProbe.remove(this.pArc);
        this.pArc.geometry.dispose();
        this.pArc = null;
      }
      const kap = Math.abs(d2) / n ** 3;
      if (kap > 1e-3) {
        const R = 1 / kap;
        // 曲がりの内側(柱の元の線の側)に中心
        const cx = px - ty * R;
        const cy = py + tx * R;
        const a0 = Math.atan2(py - cy, px - cx);
        // 円の一部を長めに描き(柱から離れていくので円だと分かる)、点から中心へ向かう半径の線も添える
        const half = Math.min(1.4, 1.5 / R);
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 40; k++) {
          const a = a0 - half + (2 * half * k) / 40;
          pts.push(new THREE.Vector3(cx + R * Math.cos(a), cy + R * Math.sin(a), 0.16));
        }
        this.pArc = tube(pts, 0.022, '#6d28d9', 0.8);
        const rl = Math.min(R, 1.1);
        const rad = tube([new THREE.Vector3(px, py, 0.16), new THREE.Vector3(px - ty * rl, py + tx * rl, 0.16)], 0.015, '#6d28d9', 0.8);
        this.pArc.add(rad);
        this.gProbe.add(this.pArc);
      }
    }
    // 札は、説明している順に出す。
    // 映像4(s = 3)は ずれ → 傾き → 曲がり、映像5(s = 4)は ずれと曲げる力 → 曲がり → 戻す力(傾きは使わない)
    const show = s === 3 ? [true, t >= 6, t >= 12] : [true, false, t >= 7];
    const yd = px - bx;
    const fo = s === 4 ? 1.7 * yd : 0;
    const fb = s === 4 && t >= 14 ? 1.7 * yd : 0;
    placeArrow(this.pOut, px + 0.1, py + 0.15, 0.16, fo, 0);
    placeArrow(this.pBack, px - 0.1, py - 0.32, 0.16, -fb, 0);
    this.pTags[3].visible = fo > 0.05;
    this.pTags[3].position.set(px + 0.1 + fo + 0.75, py + 0.3, 0.2);
    this.pTags[4].visible = fb > 0.05;
    this.pTags[4].position.set(px - 0.1 - fb - 0.2, py - 0.62, 0.2);
    this.pDots[1].visible = s === 3 && t >= 6;
    this.pDots[2].visible = s === 4 ? t >= 7 : t >= 12;
    this.pTags[0].visible = show[0];
    this.pTags[0].position.set((bx + px) / 2, s === 4 ? py + 0.24 : py - 0.22, 0.2);
    this.pTags[1].visible = show[1];
    this.pTags[1].position.set(px + 0.95, py + 0.62, 0.2);
    this.pTags[2].visible = show[2];
    this.pTags[2].position.set(px + 0.8, py - 0.45, 0.2);
    if (this.pTan) this.pTan.visible = show[1];
    if (this.pArc) this.pArc.visible = show[2];
    this.pY.visible = this.pY.visible && show[0];
  }

  protected tick(dt: number) {
    const s = this.sceneIndex;
    const c = this.clock;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    if (s === 0) {
      this.only(this.g0);
      const t = this.cyc(15, c);
      const p = Math.min(1, ramp(t, 1, 8) * 1.0) * (1 - ramp(t, 13.5, 15));
      const D = 0.5 * (ramp(t, 7.9, 8.6) - ramp(t, 13.5, 15));
      this.main.update(D, p, false, p);
      this.forces(0, 0, false);
      this.caption =
        t < 1
          ? '細い棒を、ゆっくり押していく'
          : t < 7.9
            ? `押す力 ${pct(p)}。まっすぐのまま耐えている`
            : '限界の力に達した瞬間、突然ぐにゃり。これが座屈';
      this.look(0, 1.45, 2.4, 2.75, 12, 6);
    } else if (s === 1) {
      this.only(this.g0);
      const t = this.cyc(40, c);
      // 押す力 p(座屈荷重 = 1)と、真ん中のずれ D。横からの指は「わずかに曲げるきっかけ」だけ
      let p = 0.5 * ramp(t, 0.5, 2.5);
      let D = 0;
      let poke = 0;
      let show = false;
      if (t < 3) {
        this.caption = 'まっすぐな柱を、座屈荷重の半分(50%)の力で押しておく';
      } else if (t < 12) {
        poke = 0.7 * (ramp(t, 3, 3.6) - ramp(t, 5.4, 6));
        D = 0.28 * ramp(t, 3.4, 5) * (1 - ramp(t, 10.2, 11.8));
        show = t > 5.5;
        this.caption =
          t < 6
            ? '横から指で少し押して、わずかに曲げる(きっかけ。指はすぐ離す)'
            : t < 10.2
              ? 'ずれ y が腕になって、押す力が真ん中を回す(オレンジ P × y)。曲がった柱は戻ろうとする(青 EI × 1/R)'
              : '50% では、戻す方が2倍強い。だから元のまっすぐに戻る';
      } else if (t < 19) {
        poke = 0.9 * (ramp(t, 12, 12.6) - ramp(t, 14.2, 14.8));
        D = 0.56 * ramp(t, 12.4, 14) * (1 - ramp(t, 17.2, 18.8));
        show = t > 14.3;
        this.caption = t < 17.2 ? 'もっと大きく曲げても、2つの回す力はどちらも2倍。勝ち負けは変わらない' : 'ずれが大きくても小さくても、50% なら必ず戻る';
      } else if (t < 29) {
        p = 0.5 + 0.5 * ramp(t, 20.5, 23.5);
        poke = 0.7 * (ramp(t, 19, 19.6) - ramp(t, 20.2, 20.8));
        D = 0.32 * ramp(t, 19.3, 20.6) + 0.2 * (ramp(t, 25.5, 26.5) - ramp(t, 27.5, 28.5));
        show = t > 20.3;
        this.caption =
          t < 23.5
            ? '押す力を上げていく。曲げる方(P × y)だけが大きくなる'
            : t < 25.5
              ? '100% = 座屈荷重。2つがちょうど互角で、指を離しても曲がったまま止まる'
              : 'このとき互角は、ずれの大きさによらない。まっすぐと曲がった形の、分かれ道';
      } else {
        p = 1.1;
        D = Math.min(0.55, 0.3 * Math.exp((t - 29) * 0.12)) * (1 - ramp(t, 38.5, 40));
        show = t < 38.5;
        this.caption =
          t < 34
            ? '座屈荷重を超えると、曲げる方が勝つ。ずれが増え、曲げる力がさらに増える'
            : 'これが座屈。勝ち負けは、ずれではなく押す力だけで決まる(わずかな曲がりの範囲の話)';
      }
      this.main.update(D, p);
      this.forces(0, 0, false);
      this.tug(D, p, show, poke);
      this.look(-0.2, 1.55, 3.4, 2.85, 10, 6);
    } else if (s === 2) {
      this.only(this.g2);
      const t = this.cyc(24, c);
      let dS = 0;
      let dL = 0;
      let p = 0;
      if (t < 10) {
        dS = dL = 0.4 * ramp(t, 1, 3) * (1 - ramp(t, 9, 10));
        this.caption = t < 5 ? '長さが2倍の棒と比べる。同じだけ横にずらすと…' : '長い棒はゆるいカーブ。カーブがゆるいと、戻す力が弱い';
      } else {
        p = 1.05 * ramp(t, 11, 20) * (1 - ramp(t, 23, 24));
        dL = 0.4 * ramp(p, 0.245, 0.27);
        dS = 0.4 * ramp(p, 0.99, 1.02);
        this.caption = p < 0.25 ? `2本を同じ力で押す。押す力 ${pct(p)}` : p < 0.99 ? `押す力 ${pct(p)}。長い棒は 25% で座屈した` : '長さが2倍なら、座屈する力は 1/4(長さの2乗に反比例)';
      }
      this.short.update(dS, p, false, Math.min(1.02, p));
      this.long.update(dL, p, false, Math.min(1.02, p / 0.25));
      this.tags2[2].visible = dS > 0.3;
      this.tags2[3].visible = dL > 0.3 && t >= 10;
      this.look(-0.2, 1.4, 3.0, 2.8, 10, 6);
    } else if (s === 3 || s === 4) {
      this.only(this.g3);
      const t = this.cyc(s === 4 ? 36 : 30, c);
      // 赤い点で値を読むので、形は止めておく
      const D = 0.5;
      this.bar3.update(D, 1);
      // 映像4: グラフを ずれ → 傾き → 曲がり の順に出す。映像5: ずれと曲がりだけ(傾きは使わない)
      const show = s === 4 ? [1, 0, ramp(t, 7, 8)] : [ramp(t, 1, 2), ramp(t, 6, 7), ramp(t, 12, 13)];
      this.plots.forEach((p, i) => {
        p.scale.x = (D / 0.5) * 0.6;
        p.visible = show[i] > 0.01;
        this.axes3[i].visible = s === 3 || i !== 1;
        this.tags3[i].visible = show[i] > 0.5;
      });
      this.gProbe.visible = true;
      this.probe(D, t, s);
      if (s === 3)
        this.caption =
          t < 6
            ? '座屈した棒の形は、サインカーブの半分'
            : t < 12
              ? '傾き: 両端でいちばん大きく、真ん中でゼロ'
              : t < 18
                ? '傾きの変わり方 = 曲がりのきつさ: 真ん中で最大。もとの形と同じ波で、向きが逆'
                : t < 24
                  ? 'これが映像1 の曲率 1/R。式では y″ と書き、山なりでは負なので 1/R = −y″'
                  : '真ん中のきつさ = ずれ × (π/長さ)²。π は、波の形から来ている';
      else {
        // 釣合いから座屈荷重の式へ: 曲げる力 P·y と 戻す力 EI·(π/l)²·y を、赤い点で比べる
        this.caption =
          t < 7
            ? '赤い点で比べる。曲げる力(オレンジ)= 押す力 P × ずれ y'
            : t < 14
              ? '曲がり具合 1/R = −y″ = (π/l)² × y。サインカーブでは、曲がりがずれに比例する(右の2本は同じ形)'
              : t < 21
                ? '戻す力(青)= 踏ん張り EI × 1/R = EI × (π/l)² × y'
                : t < 28
                  ? 'どの高さでも、2つの力はどちらも y に比例。比べた結果は、点をどこへ動かしても同じ'
                  : t < 32
                    ? 'P × y = EI × (π/l)² × y。両辺の y が消えて、P = π²EI/l²'
                    : '互角になる P はひとつだけ。これがオイラーの座屈荷重 Pe';
      }
      this.look(0, 1.35, 3.9, 2.7, 6, 5);
    } else if (s === 5) {
      this.only(this.g5);
      const t = this.cyc(28, c);
      const p = 4.25 * ramp(t, 2, 19) * (1 - ramp(t, 27, 28));
      const fade = 1 - ramp(t, 27, 28);
      let cap = '同じ棒が4本。違うのは、両端の支え方だけ';
      this.four.forEach((b, i) => {
        const g = SUPPORTS[b.sup].gain;
        const goal = p >= g ? 0.36 : 0;
        this.dyn[i] += (goal * fade - this.dyn[i]) * (1 - Math.exp(-dt * 6));
        b.update(this.dyn[i], Math.min(p, g * 1.02) / 4.2 + 0.05 * Math.min(1, p), true, Math.min(p, g * 1.02) / g);
        const on = this.dyn[i] > 0.3;
        this.tags5[i][0].visible = on;
        this.tags5[i][1].visible = on;
        if (p >= g) cap = `${SUPPORTS[b.sup].name}が座屈(基準の ${g < 1 ? '1/4' : g === 1 ? '1' : g < 3 ? '約2' : '4'} 倍の力)`;
      });
      if (t > 21) cap = '赤い線 = サインカーブ半分。この波が短いほど、強い';
      else if (t >= 2 && p < 0.25) cap = `4本を同じ力で押していく(基準の ${p.toFixed(2)} 倍)`;
      this.caption = cap;
      this.look(0, 0.9, 3.9, 3.6, 8, 5);
    } else {
      this.only(this.gLab);
      const { sup, L, load } = this.lab;
      const key = `${sup}|${L}`;
      if (key !== this.labKey) {
        this.labKey = key;
        if (this.labBar) this.gLab.remove(this.labBar.group);
        this.labBar = new Bar(sup, 0.24 * L, 0.06 * L);
        this.gLab.add(this.labBar.group);
        this.dyn[0] = 0;
      }
      const b = this.labBar!;
      // 降伏が先に来る長さでは、弾性座屈の形には曲げない
      const goal = load >= 1 && !this.lab.yieldFirst ? b.H * 0.24 * Math.min(1, 0.6 + (load - 1) * 2) : 0;
      this.dyn[0] += (goal - this.dyn[0]) * (1 - Math.exp(-dt * 5));
      b.update(this.dyn[0], load * 0.8, true, this.lab.yieldFirst ? undefined : Math.min(1.1, load));
      this.caption = '';
      this.look(0, 1.4, 2.8, 3.4, 10, 6);
    }
  }
}
