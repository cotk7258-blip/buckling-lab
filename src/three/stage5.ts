import * as THREE from 'three';
import { plateR, plateStrength, plateTheory, plateWinter } from '../physics/plate.ts';
import { writeStressColor } from './common.ts';
import { ShowBase, aimArrow, arrow, drawTube, label, line, placeArrow, ramp, setLine, tube } from './kit.ts';

const STEEL = new THREE.Color('#8a98ae');
const DARK = () => new THREE.MeshStandardMaterial({ color: '#6f7d94', metalness: 0.45, roughness: 0.5 });
const INK = '#1f2a44';
const OUT = '#ea580c';
const BACK = '#0284c7';
const EDGE = '#16a34a';

function tag(text: string, color: string, size = 0.7, wide = 1) {
  const s = label(text, color, wide);
  s.scale.multiplyScalar(size);
  return s;
}

/** 板の表面に引く格子の線。波の形に沿って動くので、ふくらみが立体に見える */
export class SurfGrid {
  lines: THREE.LineSegments;
  private uv: number[] = [];
  constructor(private b: number, private a: number, nu: number, nv: number) {
    const seg = 36;
    for (let k = 0; k <= nu; k++) for (let i = 0; i < seg; i++) this.uv.push(k / nu, i / seg, k / nu, (i + 1) / seg);
    for (let j = 0; j <= nv; j++) for (let i = 0; i < seg; i++) this.uv.push(i / seg, j / nv, (i + 1) / seg, j / nv);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.uv.length / 2) * 3), 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#33415c', transparent: true, opacity: 0.6 }));
    this.lines.frustumCulled = false;
  }
  /** z: 面から出る向きのずれ。dx・dy: 面の中でのずれ(柱ごと曲がるときに使う) */
  update(z: (u: number, v: number) => number, dx?: (u: number, v: number) => number, dy?: (u: number, v: number) => number) {
    const p = this.lines.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.uv.length / 2; i++) {
      const u = this.uv[i * 2];
      const v = this.uv[i * 2 + 1];
      p.setXYZ(i, (u - 0.5) * this.b + (dx ? dx(u, v) : 0), (v - 0.5) * this.a + (dy ? dy(u, v) : 0), z(u, v));
    }
    p.needsUpdate = true;
  }
}


export interface PlateLook {
  /** 波の高さ(絵の単位)と、押す向きの波の数 */
  A?: number;
  m?: number;
  /** 押す力の矢印の長さ(0〜1.2)。上が外力、下が反力 */
  load?: number;
  /** 応力の色: level = 一様な応力/σy、pattern = 波打った後の「縁に偏る」分布の度合い、edge = 縁の応力/σy */
  level?: number;
  pattern?: number;
  edge?: number;
  /** 波の山での、押し出す力(外力による)と戻す力(回復力)の矢印の長さ */
  fOut?: number;
  fBack?: number;
  /** 幅方向の応力 σ/σy(u = 0〜1、圧縮を正)。指定すると level・pattern より優先する */
  stressAt?: (u: number) => number;
  /** 周りを薄くして、真ん中の帯を見せる(0〜1)。帯のたわみ */
  ghost?: number;
  strip?: number;
  /** 支えられた縁を緑に光らせる(0〜1) */
  railGlow?: number;
  /** 札を出すか */
  tags?: boolean;
}

/**
 * 押す向き(縦)に圧縮される板。左右の縁は支え(free なら右の縁は自由)。
 * 板の厚みを持つ箱で描き、面の外へ波打たせる。
 */
export class Plate {
  group = new THREE.Group();
  private mesh: THREE.Mesh;
  private base: Float32Array;
  private grid: SurfGrid;
  private mat: THREE.MeshStandardMaterial;
  private strip: THREE.Mesh;
  private stripBase: Float32Array;
  private railMat: THREE.MeshStandardMaterial;
  private top: THREE.Mesh;
  private loadT: THREE.Group[] = [];
  private loadB: THREE.Group[] = [];
  private out: THREE.Group;
  private back: THREE.Group;
  private tags: Record<string, THREE.Sprite> = {};
  private c = new THREE.Color();
  private tmp = new Float32Array(3);

  constructor(public b: number, public a: number, public t: number, private o: { free?: boolean; nx?: number; ny?: number; loads?: number; arrowScale?: number } = {}) {
    const nx = o.nx ?? 24;
    const ny = o.ny ?? 24;
    const geo = new THREE.BoxGeometry(b, a, t, nx, ny, 1);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    this.base = new Float32Array(geo.attributes.position.array as Float32Array);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.y = a / 2;
    this.mesh.frustumCulled = false;
    this.grid = new SurfGrid(b, a, Math.max(4, Math.round(b / 0.12)), Math.max(4, Math.round(a / 0.12)));
    this.mesh.add(this.grid.lines);
    this.group.add(this.mesh);

    const sg = new THREE.BoxGeometry(b / 8, a, t * 1.4, 1, 32, 1);
    this.stripBase = new Float32Array(sg.attributes.position.array as Float32Array);
    this.strip = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#7c3aed', emissive: '#7c3aed', emissiveIntensity: 0.35, roughness: 0.45 }));
    this.strip.position.y = a / 2;
    this.strip.visible = false;
    this.strip.frustumCulled = false;
    this.group.add(this.strip);

    const dark = DARK();
    const d = Math.max(0.16, t * 3);
    this.railMat = new THREE.MeshStandardMaterial({ color: '#6f7d94', metalness: 0.4, roughness: 0.5, emissive: EDGE, emissiveIntensity: 0 });
    for (const side of o.free ? [-1] : [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, a, d), this.railMat);
      r.position.set(side * (b / 2 + 0.025), a / 2, 0);
      this.group.add(r);
    }
    const bot = new THREE.Mesh(new THREE.BoxGeometry(b + 0.12, 0.06, d), dark);
    bot.position.y = -0.03;
    this.top = new THREE.Mesh(new THREE.BoxGeometry(b + 0.12, 0.06, d), dark);
    this.top.position.y = a + 0.03;
    this.group.add(bot, this.top);

    const n = o.loads ?? 3;
    const sc = o.arrowScale ?? 0.7;
    for (let i = 0; i < n; i++) {
      const at = arrow(INK);
      at.scale.set(sc, 1, sc);
      const ab = arrow('#64748b');
      ab.scale.set(sc, 1, sc);
      this.group.add(at, ab);
      this.loadT.push(at);
      this.loadB.push(ab);
    }
    this.out = arrow(OUT);
    this.back = arrow(BACK);
    for (const g of [this.out, this.back]) g.scale.set(1.3, 1, 1.3);
    this.group.add(this.out, this.back);
    const mk = (k: string, text: string, color: string, wide = 1) => {
      const s = tag(text, color, 0.55, wide);
      s.visible = false;
      this.group.add(s);
      this.tags[k] = s;
    };
    mk('load', '外力(押す力)', INK);
    mk('react', '反力', '#64748b');
    mk('out', '押し出す力', OUT);
    mk('back', '戻す力', BACK);
    mk('edge', '縁の支え', EDGE);
  }

  private shape(u: number, v: number, m: number) {
    return this.o.free ? u * Math.sin(Math.PI * v) : Math.sin(Math.PI * u) * Math.sin(m * Math.PI * v);
  }

  update(o: PlateLook) {
    const { a, b, t } = this;
    const A = o.A ?? 0;
    const m = o.m ?? 1;
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.mesh.geometry.attributes.color as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const ca = col.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const u = this.base[i * 3] / b + 0.5;
      const v = this.base[i * 3 + 1] / a + 0.5;
      const w = this.shape(u, v, m);
      pa[i * 3 + 2] = this.base[i * 3 + 2] + A * w;
      if (o.stressAt) {
        writeStressColor(this.tmp, 0, Math.max(-1, Math.min(1, o.stressAt(u))), 1, STEEL);
        this.c.setRGB(this.tmp[0], this.tmp[1], this.tmp[2]);
      } else if (o.level === undefined) {
        this.c.copy(STEEL).offsetHSL(0, 0, A > 0.001 ? w * 0.2 * Math.min(1, A / 0.06) : 0);
      } else {
        const e = this.o.free ? 1 - u : Math.abs(Math.cos(Math.PI * u));
        const pat = o.pattern ?? 0;
        const sv = o.level * (1 - pat) + (0.05 + 0.95 * (o.edge ?? 1) * e ** 2.6) * pat;
        writeStressColor(this.tmp, 0, Math.min(1, sv), 1, STEEL);
        this.c.setRGB(this.tmp[0], this.tmp[1], this.tmp[2]);
      }
      ca[i * 3] = this.c.r;
      ca[i * 3 + 1] = this.c.g;
      ca[i * 3 + 2] = this.c.b;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.grid.update((u, v) => A * this.shape(u, v, m) + t / 2 + 0.004);
    const ghost = o.ghost ?? 0;
    this.mat.opacity = 1 - 0.82 * ghost;
    (this.grid.lines.material as THREE.LineBasicMaterial).opacity = 0.6 * (1 - 0.8 * ghost);
    this.mat.depthWrite = ghost < 0.5;

    // 真ん中の帯(柱とみなす)
    this.strip.visible = o.strip !== undefined;
    if (this.strip.visible) {
      const sp = this.strip.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < sp.count; i++) {
        const v = this.stripBase[i * 3 + 1] / a + 0.5;
        sp.setZ(i, this.stripBase[i * 3 + 2] + (o.strip ?? 0) * Math.sin(Math.PI * v));
      }
      sp.needsUpdate = true;
      this.strip.geometry.computeVertexNormals();
    }
    this.railMat.emissiveIntensity = 0.9 * (o.railGlow ?? 0);

    // 外力と反力
    const L = o.load ?? 0;
    const n = this.loadT.length;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n - 0.5) * b;
      const len = L > 0.005 ? 0.12 + 0.3 * Math.min(1.2, L) : 0;
      placeArrow(this.loadT[i], x, a + 0.08 + len, 0, 0, -len);
      placeArrow(this.loadB[i], x, -0.08 - len, 0, 0, len);
    }
    // 波の山での、押し出す力と戻す力
    const uc = this.o.free ? 1 : 0.5;
    const vc = this.o.free ? 0.5 : 1 / (2 * m);
    const xc = (uc - 0.5) * b - (this.o.free ? 0.08 : 0);
    const yc = vc * a;
    const zs = A * this.shape(uc, vc, m) + t / 2 + 0.03;
    const fo = o.fOut ?? 0;
    const fb = o.fBack ?? 0;
    aimArrow(this.out, xc, yc + 0.17, zs, 0, 0, fo);
    aimArrow(this.back, xc, yc - 0.17, zs + fb, 0, 0, -fb);
    const show = !!o.tags;
    this.tags.load.visible = show && L > 0.01;
    this.tags.load.position.set(b / 2 + 0.5, a + 0.3, 0);
    this.tags.react.visible = show && L > 0.01;
    this.tags.react.position.set(b / 2 + 0.3, -0.2, 0);
    this.tags.out.visible = show && fo > 0.06;
    this.tags.out.position.set(xc, yc + 0.36, zs + fo + 0.15);
    this.tags.back.visible = show && fb > 0.06;
    this.tags.back.position.set(xc, yc - 0.36, zs + fb + 0.15);
    this.tags.edge.visible = show && (o.railGlow ?? 0) > 0.3;
    this.tags.edge.position.set(-b / 2 - 0.45, a * 0.8, 0.1);
  }
}

/** 薄い板4枚でできた箱形の柱。押すと板が交互に波打つ */
class BoxCol {
  group = new THREE.Group();
  private walls: { mesh: THREE.Mesh; base: Float32Array; grid: SurfGrid }[] = [];
  private top: THREE.Mesh;
  private arrow: THREE.Group;

  constructor(private a: number, private b: number) {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.rotation.y = (i * Math.PI) / 2;
      const geo = new THREE.PlaneGeometry(b, a, 32, 64);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8a98ae', metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
      mesh.position.set(0, a / 2, b / 2);
      mesh.frustumCulled = false;
      g.add(mesh);
      this.group.add(g);
      const grid = new SurfGrid(b, a, 6, 15);
      mesh.add(grid.lines);
      this.walls.push({ mesh, base: new Float32Array(geo.attributes.position.array as Float32Array), grid });
    }
    const dark = DARK();
    const bot = new THREE.Mesh(new THREE.BoxGeometry(b + 0.6, 0.18, b + 0.6), dark);
    bot.position.y = -0.09;
    this.top = new THREE.Mesh(new THREE.BoxGeometry(b + 0.6, 0.18, b + 0.6), dark);
    this.arrow = arrow('#1f2a44');
    this.arrow.scale.set(2, 1, 2);
    this.group.add(bot, this.top, this.arrow);
  }

  update(A: number, m: number, load: number) {
    const { a, b } = this;
    this.walls.forEach((w, i) => {
      const p = w.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const sgn = i % 2 ? -1 : 1;
      for (let k = 0; k < p.count; k++) {
        const u = w.base[k * 3] / b + 0.5;
        const v = w.base[k * 3 + 1] / a + 0.5;
        p.setZ(k, sgn * A * Math.sin(m * Math.PI * v) * Math.sin(Math.PI * u));
      }
      p.needsUpdate = true;
      w.mesh.geometry.computeVertexNormals();
      w.grid.update((u, v) => sgn * A * Math.sin(m * Math.PI * v) * Math.sin(Math.PI * u));
    });
    this.top.position.y = a + 0.09;
    const len = 0.3 + 0.8 * Math.min(1.2, load);
    placeArrow(this.arrow, 0, a + 0.24 + len, 0, 0, load > 0.005 ? -len : 0);
  }
}


/* ---------- 板を並べた列と、奥のグラフの壁 ---------- */

/** 並べる板の R(左ほど厚い板) */
export const RS = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1];
const N = RS.length;
const X = (R: number) => (R - 1.2) * 3.4;
const Y = (s: number) => 1.55 + s * 2.3;
const ZP = 0.6;
const ZG = -0.5;
/** 両縁支持(k = 4)、σy = 355、E = 2.0×10⁵、ν = 0.3 で R = 1 になる幅厚比 */
export const BT1 = 1 / plateR(1, 1, 355, 4);
const PB = 0.5; // 並べる板の幅(絵)
// 応力の柱(場面「縁に寄る」): 下端の高さ、σy の高さ、この板の σel/σy(R = 1.6)、分布の形 1 − sin(πu) の平均
const NB = 18;
const BAR0 = 2.0;
const BARH = 0.9;
const EDGE_EL = 1 / (1.6 * 1.6);
const SHAPE = 1 - 2 / Math.PI;
const thick = (R: number) => Math.max(0.035, 0.1 / R);

function curve(f: (R: number) => number, r0: number, r1: number, rad: number, color: string) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 90; i++) {
    const R = r0 + ((r1 - r0) * i) / 90;
    pts.push(new THREE.Vector3(X(R), Y(Math.min(1.25, f(R))), ZG));
  }
  return tube(pts, rad, color);
}
function dot(r: number, color: string) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4 }));
  m.scale.setScalar(0.001);
  return m;
}

export interface Lab5 {
  b: number; // mm
  t: number; // mm
  /** 座屈係数: 4(両縁支持)か 0.43(自由突出) */
  k: number;
  load: number; // σ/σy
}
export const SIGMA_Y = 355;
export const labR = (l: Lab5) => plateR(l.b, l.t, SIGMA_Y, l.k);

export class Stage5Show extends ShowBase {
  private gBox = new THREE.Group();
  private box: BoxCol;
  private gOne = new THREE.Group();
  private one: Plate;
  private gPair = new THREE.Group();
  private wide: Plate;
  private narrow: Plate;
  private pairTags: THREE.Sprite[] = [];
  private gSup = new THREE.Group();
  private both: Plate;
  private free: Plate;
  private supTags: THREE.Sprite[] = [];
  private gLine = new THREE.Group();
  private plates: Plate[] = [];
  private keys: string[] = [];
  private gWall = new THREE.Group();
  private cYield: THREE.Mesh;
  private cEl: THREE.Mesh;
  private cIdeal: THREE.Mesh;
  private cReal: THREE.Mesh;
  private cDesign: THREE.Mesh;
  private dotI: THREE.Mesh[] = [];
  private dotR: THREE.Mesh[] = [];
  private popI = new Array(N).fill(0);
  private popR = new Array(N).fill(0);
  private mark1: THREE.Group;
  private probe: THREE.Mesh;
  private gLab = new THREE.Group();
  private labPlates: Record<string, Plate> = {};
  private amp = [0, 0, 0];
  private gBars = new THREE.Group();
  private bars: THREE.Mesh[] = [];
  private barTags: THREE.Sprite[] = [];
  private barY = new THREE.Group();
  private barEl = new THREE.Group();
  lab: Lab5 = { b: 900, t: 12, k: 4, load: 0.3 };

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.addFloor(-0.2);
    this.scene.add(this.gBox, this.gOne, this.gPair, this.gSup, this.gLine, this.gWall, this.gLab, this.gBars);
    this.box = new BoxCol(3.3, 1.35);
    this.gBox.add(this.box.group);

    this.one = new Plate(1.4, 1.4, 0.06, { loads: 3 });
    this.gOne.add(this.one.group);

    // 板の上に、幅方向に並ぶ応力の柱(波打つと縁に寄る様子を見せる)
    for (let i = 0; i < NB; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05), new THREE.MeshStandardMaterial({ color: BACK, emissive: BACK, emissiveIntensity: 0.4 }));
      this.gBars.add(m);
      this.bars.push(m);
    }
    const hline = (g: THREE.Group, color: string, dashed: boolean, y: number, text: string) => {
      const l = line(color, dashed);
      setLine(l, -0.78, y, 0.78, y, 0.03);
      const s2 = tag(text, color, 0.55);
      s2.position.set(-0.98, y, 0.03);
      g.add(l, s2);
      this.gBars.add(g);
    };
    hline(this.barY, '#e11d48', false, BAR0 + BARH, 'σy');
    hline(this.barEl, '#6d28d9', true, BAR0 + BARH * EDGE_EL, 'σel');
    for (const [t, c] of [['幅方向に並ぶ応力', INK], ['縁', EDGE], ['縁', EDGE], ['中央', INK]] as const) {
      const s2 = tag(t, c, 0.55, t.length > 4 ? 2 : 1);
      this.gBars.add(s2);
      this.barTags.push(s2);
    }
    this.barTags[0].position.set(0, BAR0 + BARH + 0.28, 0.03);
    this.barTags[1].position.set(-0.7, BAR0 - 0.14, 0.03);
    this.barTags[2].position.set(0.7, BAR0 - 0.14, 0.03);
    this.barTags[3].position.set(0, BAR0 - 0.14, 0.03);

    this.wide = new Plate(1.4, 1.4, 0.06, { loads: 3 });
    this.wide.group.position.x = -1.15;
    this.narrow = new Plate(0.7, 1.4, 0.06, { loads: 2 });
    this.narrow.group.position.x = 1.25;
    this.gPair.add(this.wide.group, this.narrow.group);
    for (const [t, x, y, c] of [['幅 b', -1.15, -0.5, INK], ['幅 b/2', 1.25, -0.5, INK], ['σel で波打つ', -1.15, 2.05, '#6d28d9'], ['4σel で波打つ', 1.25, 2.05, '#6d28d9']] as const) {
      const s = tag(t, c, 0.7);
      s.position.set(x, y, 0.3);
      this.gPair.add(s);
      this.pairTags.push(s);
    }

    this.both = new Plate(1.2, 1.4, 0.06, { loads: 3 });
    this.both.group.position.x = -1.1;
    this.free = new Plate(1.2, 1.4, 0.06, { loads: 3, free: true });
    this.free.group.position.x = 1.15;
    this.gSup.add(this.both.group, this.free.group);
    for (const [t, x, y, c] of [['両縁支持 k = 4', -1.1, -0.5, INK], ['自由突出 k = 0.43', 1.15, -0.5, INK], ['自由な縁', 2.15, 1.65, OUT]] as const) {
      const s = tag(t, c, 0.65, t.length > 6 ? 2 : 1);
      s.position.set(x, y, 0.3);
      this.gSup.add(s);
      this.supTags.push(s);
    }

    // 並べる板
    RS.forEach((R) => {
      const p = new Plate(PB, PB, thick(R), { nx: 12, ny: 12, loads: 1, arrowScale: 0.8 });
      p.group.position.set(X(R), 0, ZP);
      this.gLine.add(p.group);
      this.plates.push(p);
      this.keys.push('');
    });

    // グラフの壁
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 3.9), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false }));
    board.position.set(0, Y(0.6), ZG - 0.12);
    this.gWall.add(board);
    const ax = (x0: number, y0: number, x1: number, y1: number, c = '#64748b') => {
      const l = line(c);
      setLine(l, x0, y0, x1, y1, ZG - 0.02);
      this.gWall.add(l);
    };
    const put = (t: string, x: number, y: number, c = '#44536e', size = 0.7, wide = 1) => {
      const s = tag(t, c, size, wide);
      s.position.set(x, y, ZG);
      this.gWall.add(s);
      return s;
    };
    ax(X(0), Y(0), X(2.4), Y(0));
    ax(X(0), Y(0), X(0), Y(1.25));
    for (const R of [0.5, 1, 1.5, 2]) {
      ax(X(R), Y(0), X(R), Y(0) - 0.07);
      put(R.toFixed(1), X(R), Y(0) - 0.2, '#1f2a44', 0.75);
      put(`b/t ${Math.round(BT1 * R)}`, X(R), Y(0) - 0.42, '#64748b', 0.55);
    }
    for (const s of [0.5, 1]) {
      ax(X(0), Y(s), X(2.4), Y(s), '#d5dce8');
      put(s.toFixed(1), X(0) - 0.3, Y(s), '#1f2a44', 0.75);
    }
    put('σcr/σy', X(0) + 0.15, Y(1.33), INK, 0.8);
    put('幅厚比パラメータ R →', X(2.4) - 0.9, Y(0) - 0.72, INK, 0.75, 2);
    this.cYield = curve(() => 1, 0, 2.4, 0.022, '#e11d48');
    this.cEl = curve(plateTheory, 0.89, 2.4, 0.02, '#6d28d9');
    this.cIdeal = curve((R) => Math.min(1, plateTheory(R)), 0.01, 2.4, 0.034, '#16a34a');
    this.cReal = curve(plateWinter, 0.01, 2.4, 0.03, '#0f766e');
    this.cReal.position.z = 0.02;
    this.cDesign = curve(plateStrength, 0.01, 2.4, 0.04, '#0284c7');
    this.cDesign.position.z = 0.04;
    this.gWall.add(this.cYield, this.cEl, this.cIdeal, this.cReal, this.cDesign);
    RS.forEach((R) => {
      const a = dot(0.075, '#16a34a');
      a.position.set(X(R), Y(Math.min(1, plateTheory(R))), ZG + 0.08);
      const b = dot(0.075, '#0f766e');
      b.position.set(X(R), Y(plateWinter(R)), ZG + 0.12);
      this.gWall.add(a, b);
      this.dotI.push(a);
      this.dotR.push(b);
    });
    this.mark1 = new THREE.Group();
    const ml = line(INK, true);
    setLine(ml, X(1), Y(0), X(1), Y(1.22), ZG + 0.02);
    const t1 = tag('R = 1(σel = σy)', INK, 0.65, 2);
    t1.position.set(X(1), Y(1.3), ZG);
    const ta = tag('降伏が先', '#e11d48', 0.7);
    ta.position.set(X(0.5), Y(1.14), ZG);
    const tb = tag('波打ちが先', '#6d28d9', 0.7);
    tb.position.set(X(1.7), Y(1.14), ZG);
    this.mark1.add(ml, t1, ta, tb);
    this.gWall.add(this.mark1);
    this.probe = dot(0.1, '#e11d48');
    this.probe.scale.setScalar(1);
    this.gWall.add(this.probe);

    // 実験室の板(両縁支持・自由突出)
    for (const k of ['both', 'free']) {
      const p = new Plate(1.0, 1.0, 0.05, { loads: 3, free: k === 'free', nx: 18, ny: 18 });
      p.group.position.z = ZP;
      this.gLab.add(p.group);
      this.labPlates[k] = p;
    }
    this.setScene(0);
  }

  private show(...gs: THREE.Group[]) {
    for (const g of [this.gBox, this.gOne, this.gPair, this.gSup, this.gLine, this.gWall, this.gLab, this.gBars]) g.visible = gs.includes(g);
  }

  /** 幅方向の応力の柱。sAt(u) = σ/σy */
  private setBars(sAt: (u: number) => number) {
    const w = 1.4 / NB;
    this.bars.forEach((m, i) => {
      const u = (i + 0.5) / NB;
      const v = Math.max(0.002, sAt(u));
      m.scale.set(w * 0.8, v * BARH, 1);
      m.position.set((u - 0.5) * 1.4, BAR0 + (v * BARH) / 2, 0);
      const mat = m.material as THREE.MeshStandardMaterial;
      // 縁(いちばん外側の柱)が σy に届いたら赤
      const col = sAt(0) >= 0.995 && (i === 0 || i === NB - 1) ? '#e11d48' : BACK;
      mat.color.set(col);
      mat.emissive.set(col);
    });
  }

  /** 溶接のゆがみと残留応力(現実の板が R = 1 付近で弱くなる理由) */
  private tickWeld(c: number) {
    this.show(this.gOne);
    const t = c % 22;
    const fade = 1 - ramp(t, 21, 22);
    const res = ramp(t, 1, 3) * fade;
    const A0 = 0.035 * ramp(t, 6, 8) * fade;
    // 押す応力 σ/σel(この板は σel ≒ σy の板、R ≒ 1 として描く)
    const p = 0.9 * ramp(t, 10, 17) * fade;
    // 初期たわみは、押すと 1/(1 − σ/σel) 倍に増える(柱の初期たわみと同じ)
    const A = A0 / (1 - p);
    // 残留応力: 溶接した縁の近くは引張、中央側は圧縮(幅で平均すると0)
    const resid = (u: number) => res * (0.3 - 1.1 * Math.abs(Math.cos(Math.PI * u)) ** 8);
    this.one.update({ A, load: p, stressAt: (u) => resid(u) * 0.8 + p * 0.85, railGlow: 0.6, tags: t > 10 });
    this.caption =
      t < 6
        ? '溶接した縁の近くには引張(オレンジ)、中央側には圧縮(青)の残留応力が残る'
        : t < 10
          ? 'さらに、溶接で縮んだ分、板はわずかに反っている(初期たわみ)'
          : t < 15
            ? '押すと、σel に届く前から少しずつふくらむ(反りが 1/(1−σ/σel) 倍に)'
            : '中央は残留圧縮が上乗せされ、早く降伏に近づく。だから R = 1 付近で理想より下がる';
    this.look(0, 0.75, 1.6, 1.35, 30, 14);
  }

  /** 波打った板は、中央が力を受けず、縁に力が寄る(板の低減率が要る、板だけの理由) */
  private tickEdge(c: number) {
    this.show(this.gOne, this.gBars);
    const t = c % 24;
    const fade = 1 - ramp(t, 23, 24);
    const el = EDGE_EL;
    const ult = el + (1 - el) * SHAPE;
    // 平均応力 σ/σy
    const avg = (t < 7 ? el * ramp(t, 1, 6.5) : el + (ult - el) * ramp(t, 7, 14)) * fade;
    const over = Math.max(0, avg - el);
    const sAt = (u: number) => (avg <= el ? avg : el + (over * (1 - Math.sin(Math.PI * u))) / SHAPE);
    this.setBars(sAt);
    const A = 0.16 * Math.min(1, over / Math.max(0.01, ult - el)) + (avg >= el * 0.999 ? 0.04 : 0);
    this.one.update({ A: A * fade, load: avg / ult, stressAt: sAt, railGlow: 1, tags: false });
    this.barEl.visible = true;
    this.caption =
      t < 7
        ? `押していく(平均 ${Math.round(avg * 100)}%)。波打つまでは、幅のどこでも同じ応力で受ける`
        : t < 15
          ? `σel を超えて波打った(平均 ${Math.round(avg * 100)}%)。ふくらんだ中央は逃げて、増えた力は縁が受ける`
          : `縁が σy に届いた = この板の限界。平均すると σy の ${Math.round(ult * 100)}% しか受けられない`;
    this.look(0, 1.75, 1.6, 2.25, 18, 8);
  }

  private wall(fy: number, fe: number, fi: number, fr: number, fd: number, mark: boolean, probe: number | null) {
    drawTube(this.cYield, fy);
    drawTube(this.cEl, fe);
    drawTube(this.cIdeal, fi);
    drawTube(this.cReal, fr);
    drawTube(this.cDesign, fd);
    this.mark1.visible = mark;
    this.probe.visible = probe !== null;
    if (probe !== null) this.probe.position.set(X(Math.min(2.4, probe)), Y(plateStrength(probe)), ZG + 0.16);
  }

  protected tick(dt: number) {
    const raw = this.sceneIndex;
    const c0 = this.clock;
    // 場面 8 = 溶接のゆがみと残留応力、場面 10 = 縁に寄る応力。そのほかは元の番号に読み替える
    if (raw === 8) return this.tickWeld(c0);
    if (raw === 10) return this.tickEdge(c0);
    const s = raw === 9 ? 8 : raw === 11 ? 9 : raw >= 12 ? 10 : raw;
    const c = this.clock;
    const k6 = 1 - Math.exp(-dt * 6);
    if (s === 0) {
      this.show(this.gBox);
      const t = c % 16;
      const p = ramp(t, 1, 6) * (1 - ramp(t, 15, 16));
      const A = 0.2 * ramp(t, 5, 6.5) * (1 - ramp(t, 15, 16));
      this.box.update(A, 3, p);
      this.caption = t < 1 ? '薄い板でできた、箱形の柱を押す' : t < 5 ? '柱はまっすぐ立っている…' : t < 10.5 ? '柱はまっすぐなのに、板が波打った = 局部座屈' : '柱の座屈と同じ順番で、板の座屈を見ていく';
      this.look(0, 1.75, 2.6, 3.0, 32, 14);
    } else if (s === 1) {
      this.show(this.gOne);
      const t = c % 16;
      const p = Math.min(1, ramp(t, 2, 9)) * (1 - ramp(t, 14.5, 16));
      const A = 0.2 * (ramp(t, 8.9, 9.6) - ramp(t, 14.5, 16));
      this.one.update({ A, load: p, level: 0.5 * p, pattern: A > 0.02 ? 0.4 : 0, edge: 0.6, railGlow: ramp(t, 0.5, 2), tags: true });
      this.caption =
        t < 2 ? '箱の壁を1枚取り出す。両側の縁は、隣の板に支えられている' : t < 8.9 ? `上から押し、下で受ける。押す力 ${Math.round(p * 100)}%。板は平らなまま` : 'ある応力で、突然波打った。その応力が σel(弾性局部座屈応力)';
      this.look(0, 0.75, 1.6, 1.35, 32, 14);
    } else if (s === 2) {
      this.show(this.gOne);
      const t = c % 30;
      let p = 0.5;
      let A = 0;
      if (t < 7) {
        A = 0.16 * ramp(t, 1, 2.2) * (1 - ramp(t, 4.2, 6));
        this.caption = t < 4.2 ? '弱い力(σel の 50%)で押しながら、横から波を作ってみる' : '戻す力が勝って、平らに戻る';
      } else if (t < 14) {
        A = t < 8 ? 0.08 * ramp(t, 7, 8) : 0.08 + 0.1 * ramp(t, 9, 10.5);
        this.caption = '波が2倍なら、押し出す力も戻す力も2倍。勝ち負けは変わらない';
      } else if (t < 22) {
        p = 0.5 + 0.5 * ramp(t, 14, 17);
        A = 0.18;
        this.caption = t < 17 ? '押す力を増やすと、押し出す力だけが大きくなる' : 'ちょうど互角になる応力 = σel。どこで手を離しても、その形のまま';
      } else {
        p = 1.15;
        A = Math.min(0.24, 0.18 * Math.exp((t - 22) * 0.05)) * (1 - ramp(t, 28.5, 30));
        this.caption = 'それを超えると、押し出す力の勝ち。波が一気に大きくなる';
      }
      const fb = 2.2 * A;
      this.one.update({ A, load: p, fOut: fb * p, fBack: fb, railGlow: 1, tags: true });
      this.look(0.15, 0.85, 1.7, 1.45, 72, 10);
    } else if (s === 3) {
      this.show(this.gPair);
      const t = c % 24;
      const fade = 1 - ramp(t, 23, 24);
      const p = 4.2 * ramp(t, 1.5, 15) * fade;
      this.amp[0] += ((p >= 1 ? 0.2 : 0) * fade - this.amp[0]) * k6;
      this.amp[1] += ((p >= 4 ? 0.12 : 0) * fade - this.amp[1]) * k6;
      this.wide.update({ A: this.amp[0], m: 1, load: Math.min(p, 1.05) / 2 + 0.03 });
      this.narrow.update({ A: this.amp[1], m: 2, load: p / 4 + 0.03 });
      this.pairTags[2].visible = this.amp[0] > 0.12;
      this.pairTags[3].visible = this.amp[1] > 0.07;
      this.caption =
        t < 1.5
          ? '幅が半分の板と比べる(厚みは同じ)'
          : p < 1
            ? `同じ応力で押していく(σel の ${p.toFixed(1)} 倍)`
            : p < 4
              ? `幅の広い板が波打った。狭い板はまだ平ら(${p.toFixed(1)} 倍)`
              : t < 18
                ? '幅が半分なら、4倍の応力まで耐える。柱の「長さが半分で4倍」と同じ'
                : '厚みを2倍にしても4倍。σel は (t/b)² に比例する';
      this.look(0.05, 0.8, 2.4, 1.6, 30, 12);
    } else if (s === 4) {
      this.show(this.gOne);
      const t = c % 24;
      let ghost = 0;
      let strip = 0;
      let A = 0;
      let glow = 0;
      let p = 0;
      if (t < 4) {
        this.caption = '板を、押す向きに細い帯に分けて考える。帯1本は、長さ b の柱';
      } else if (t < 10) {
        ghost = ramp(t, 4, 5);
        p = 0.25;
        strip = 0.2 * ramp(t, 6, 7.5);
        this.caption = t < 7.5 ? '帯1本だけで押すと…' : '帯は柱として座屈する。σ = π²E/12 × (t/b)²';
      } else if (t < 15) {
        ghost = 1 - ramp(t, 10, 11);
        strip = 0.2 * (1 - ramp(t, 10, 11));
        this.caption = '隣の帯とつながっていて、横に縮めない → × 1/(1−ν²)(約 1.1 倍)';
      } else {
        glow = ramp(t, 15, 16);
        p = Math.min(1, ramp(t, 16, 19));
        A = 0.2 * ramp(t, 18.8, 19.6);
        this.caption = t < 19 ? '両側の縁が支えて、波打ちを抑える → × k(両縁支持で 4)' : 'これで σel = kπ²E / {12(1−ν²)} × (t/b)²';
      }
      this.one.update({ A, load: p, ghost, strip: t >= 4 && t < 15 ? strip : undefined, railGlow: glow, tags: glow > 0.5 });
      this.look(0, 0.75, 1.6, 1.35, 34, 12);
    } else if (s === 5) {
      this.show(this.gSup);
      const t = c % 24;
      const fade = 1 - ramp(t, 23, 24);
      const p = 1.05 * ramp(t, 2, 17) * fade;
      const kr = 0.43 / 4;
      this.amp[0] += ((p >= 1 ? 0.2 : 0) * fade - this.amp[0]) * k6;
      this.amp[1] += ((p >= kr ? 0.22 : 0) * fade - this.amp[1]) * k6;
      this.both.update({ A: this.amp[0], load: Math.min(p, 1.05) * 0.8 + 0.03, railGlow: 1 });
      this.free.update({ A: this.amp[1], load: Math.min(p, kr * 1.05) * 6 + 0.03, railGlow: 1 });
      this.supTags[2].visible = true;
      this.caption =
        t < 2
          ? '右の板は、片側の縁が自由(フランジの突き出した部分など)'
          : p < kr
            ? `同じ応力で押していく(両縁支持の σel の ${p.toFixed(2)} 倍)`
            : p < 1
              ? `自由な縁を持つ板が先に波打った(${p.toFixed(2)} 倍)。k = 0.43 は 4 の約 1/9`
              : 'k は支え方の効果。柱の「有効座屈長」にあたる';
      this.look(0.05, 0.8, 2.4, 1.6, 28, 12);
    } else if (s >= 6 && s <= 9) {
      this.show(this.gLine, this.gWall);
      this.look(0, 2.2, 4.4, 2.55, 6, 8);
      const t = c;
      // 板ごとの押す力と、波の大きさ
      const loads = new Array(N).fill(0);
      const amps = new Array(N).fill(0);
      const levels = new Array(N).fill(0);
      const pats = new Array(N).fill(0);
      const edges = new Array(N).fill(1);
      const pI = new Array(N).fill(0);
      const pR = new Array(N).fill(0);
      let fy = 0;
      let fe = 0;
      let fi = 0;
      let fr = 0;
      let fd = 0;
      let mark = false;
      const doneIdeal = (i: number, k: number) => {
        const R = RS[i];
        const el = plateTheory(R);
        const lim = Math.min(1, el);
        loads[i] = lim * k;
        levels[i] = lim * k;
        if (el < 1 && k >= 1) {
          amps[i] = 0.07;
          pats[i] = 0.5;
          edges[i] = el;
        }
        pI[i] = k >= 1 ? 1 : 0;
      };
      const doneReal = (i: number, k: number) => {
        const R = RS[i];
        const lim = plateWinter(R);
        const el = plateTheory(R);
        loads[i] = lim * k;
        levels[i] = lim * k;
        if (R > 0.673 && k * lim >= Math.min(el, lim) * 0.98) {
          amps[i] = 0.08;
          pats[i] = 1;
          edges[i] = 1;
        }
        pR[i] = k >= 1 ? 1 : 0;
      };
      if (s === 6) {
        this.caption =
          t < 4
            ? '同じ幅で、厚みだけが違う板を10枚(左ほど厚い)'
            : t < 10
              ? '横軸は R = √(σy/σel)。R = 1 は、σel = σy になる板'
              : '幅厚比で書くと R = b/t × √{12(1−ν²)σy/(kπ²E)}。両縁支持・σy = 355 なら R = 1 は b/t ≒ 45';
      } else if (s === 7) {
        for (let i = 0; i < N; i++) {
          const t0 = 1 + i * 0.75;
          doneIdeal(i, ramp(t, t0, t0 + 0.6));
        }
        fy = ramp(t, 1, 3);
        fe = ramp(t, 5, 8.5);
        fi = ramp(t, 9, 11.5);
        mark = t > 9;
        this.caption =
          t < 4.5
            ? '厚い板(R < 1)は、波打つ前に全体が降伏する。天井 = 1.0'
            : t < 9
              ? '薄い板は σel で波打つ。σel/σy = 1/R²'
              : '理想の板の強さ = min(1, 1/R²)。柱の min(1, 1/λ²) と同じ形';
      } else {
        for (let i = 0; i < N; i++) doneIdeal(i, 1);
        fy = 1;
        fe = 1;
        fi = 1;
        mark = true;
        if (s === 8) {
          for (let i = 0; i < N; i++) {
            const t0 = 1 + (N - 1 - i) * 0.6;
            const k = ramp(t, t0, t0 + 0.5);
            if (k > 0) doneReal(i, k);
          }
          fr = ramp(t, 8, 11);
          this.caption =
            t < 7.5
              ? '現実の板(初期のゆがみ・残留応力あり)で押す'
              : t < 13
                ? 'R = 1 の付近は、理想の線より下がる(柱と同じ)'
                : '薄い板は、波打ったあとも縁で耐える。理想の線より上(柱との違い)';
        } else {
          for (let i = 0; i < N; i++) doneReal(i, 1);
          fr = 1;
          fd = ramp(t, 1, 4);
          this.caption =
            t < 5
              ? '設計式(青): R ≦ 0.7 で 1.0、R > 0.7 で 0.5/R²'
              : t < 11
                ? '0.5/R² = 0.5 × σel/σy。波打ち始める応力の半分'
                : '薄い板の余力(緑)は当てにせず、安全側に引いた線';
        }
      }
      const pop = 1 - Math.exp(-dt * 10);
      for (let i = 0; i < N; i++) {
        this.popI[i] += (pI[i] - this.popI[i]) * pop;
        this.popR[i] += (pR[i] - this.popR[i]) * pop;
        this.dotI[i].scale.setScalar(Math.max(0.001, this.popI[i]));
        this.dotR[i].scale.setScalar(Math.max(0.001, this.popR[i]));
        const key = `${loads[i].toFixed(3)}|${amps[i]}|${pats[i]}|${edges[i].toFixed(2)}`;
        if (key !== this.keys[i]) {
          this.keys[i] = key;
          this.plates[i].update({ A: amps[i], load: loads[i], level: levels[i], pattern: pats[i], edge: edges[i] });
        }
      }
      this.wall(fy, fe, fi, fr, fd, mark, null);
    } else {
      // 実験室
      this.show(this.gWall, this.gLab);
      this.look(0, 2.2, 4.4, 2.55, 6, 8);
      for (let i = 0; i < N; i++) {
        this.dotI[i].scale.setScalar(0.001);
        this.dotR[i].scale.setScalar(0.001);
      }
      const L = this.lab;
      const R = labR(L);
      const isFree = L.k < 1;
      const p = this.labPlates[isFree ? 'free' : 'both'];
      this.labPlates.both.group.visible = !isFree;
      this.labPlates.free.group.visible = isFree;
      p.group.position.x = X(Math.min(2.3, Math.max(0.1, R)));
      const el = plateTheory(R);
      const ult = isFree ? Math.min(1, el) : plateWinter(R);
      const onset = Math.min(el, ult);
      const waving = R > 0.673 && L.load >= onset && el < 1.05;
      const goal = waving ? 0.06 + 0.12 * Math.min(1, (L.load - onset) / Math.max(0.05, ult - onset + 0.1)) : 0;
      this.amp[2] += (goal - this.amp[2]) * k6;
      p.update({ A: this.amp[2], load: L.load, level: Math.min(1, L.load), pattern: waving ? 1 : 0, edge: Math.min(1, L.load / Math.max(0.01, ult)) });
      this.wall(1, 1, 1, isFree ? 0 : 1, 1, true, R);
      this.caption = '';
    }
  }
}
