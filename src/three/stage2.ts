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
  private g2 = new THREE.Group(); // 長さ1倍と2倍
  private short: Bar;
  private long: Bar;
  private tags2: THREE.Sprite[] = [];
  private g3 = new THREE.Group(); // サインカーブと傾き・曲がり
  private bar3: Bar;
  private plots: THREE.Mesh[] = [];
  private tags3: THREE.Sprite[] = [];
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
      [(x) => Math.sin(Math.PI * x), '#1f2a44', 'ずれ', -1.2],
      [(x) => Math.cos(Math.PI * x), '#0284c7', '傾き', 0.6],
      [(x) => -Math.sin(Math.PI * x), '#6d28d9', '曲がりのきつさ', 2.5],
    ];
    for (const [f, c, name, x] of defs) {
      const p = plot(f, c, 3.0);
      p.position.x = x;
      const ax = line('#b4c0d2');
      setLine(ax, x, 0, x, 3.0, -0.02);
      const s = tag(name, c, 0.7, name.length > 4 ? 2 : 1);
      s.position.set(x, -0.4, 0.2);
      this.g3.add(p, ax, s);
      this.plots.push(p);
      this.tags3.push(s);
    }

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

  protected tick(dt: number) {
    const s = this.sceneIndex;
    const c = this.clock;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    if (s === 0) {
      this.only(this.g0);
      const t = c % 15;
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
      const t = c % 30;
      let p = 0.5;
      let D = 0;
      if (t < 7) {
        // 小さい力: 突いても戻る
        D = 0.42 * ramp(t, 1, 2.2) * (1 - ramp(t, 4.2, 6));
        this.caption = t < 4.2 ? '押す力が小さいうち(50%)に、横から突いてみる' : '戻す力が勝って、元に戻る';
      } else if (t < 14) {
        D = 0.2 + 0.22 * ramp(t, 9, 10.5);
        if (t < 8) D = 0.2 * ramp(t, 7, 8);
        this.caption = 'ずれが2倍なら、曲げる力も戻す力も2倍。勝ち負けは変わらない';
      } else if (t < 22) {
        p = 0.5 + 0.5 * ramp(t, 14, 17);
        D = 0.42 - 0.12 * ramp(t, 18.5, 20) * 0;
        this.caption = t < 17 ? '押す力を増やすと、曲げる力だけが大きくなる' : 'ちょうど互角になる力 = 座屈荷重。どこで手を離しても止まったまま';
      } else {
        p = 1.15;
        D = Math.min(0.5, 0.42 * Math.exp((t - 22) * 0.05)) * (1 - ramp(t, 28.5, 30));
        this.caption = 'それを超えると、曲げる力の勝ち。たわみが一気に大きくなる';
      }
      this.main.update(D, p);
      this.forces(D, p, true);
      this.look(0, 1.45, 3.0, 2.75, 10, 6);
    } else if (s === 2) {
      this.only(this.g2);
      const t = c % 24;
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
      const t = c % 24;
      const D = 0.5 * (0.75 + 0.25 * Math.sin(c * 0.8));
      this.bar3.update(D, 1);
      const show = s === 4 ? [1, 1, 1] : [ramp(t, 1, 2), ramp(t, 6, 7), ramp(t, 12, 13)];
      this.plots.forEach((p, i) => {
        p.scale.x = (D / 0.5) * 0.6;
        p.visible = show[i] > 0.01;
        this.tags3[i].visible = show[i] > 0.5;
      });
      if (s === 3)
        this.caption =
          t < 6
            ? '座屈した棒の形は、サインカーブの半分'
            : t < 12
              ? '傾き: 両端でいちばん大きく、真ん中でゼロ'
              : t < 18
                ? '曲がりのきつさ: 真ん中で最大。もとの形と同じ波で、向きが逆'
                : '真ん中のきつさ = ずれ × (π/長さ)²。π は、波の形から来ている';
      else {
        const k = Math.floor(c / 6) % 3;
        this.caption = ['π² : 座屈の形がサインカーブだから', 'EI : 曲げへの踏ん張り(STAGE 1 の硬さ × 形)', 'L² : 長いほどカーブがゆるく、戻す力が弱い'][k];
      }
      this.look(0, 1.35, 3.9, 2.7, 6, 5);
    } else if (s === 5) {
      this.only(this.g5);
      const t = c % 28;
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
