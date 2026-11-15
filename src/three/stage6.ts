import * as THREE from 'three';
import { dohshiOld } from '../physics/curves.ts';
import { safetyFactor } from '../physics/beamcolumn.ts';
import { plateStrength } from '../physics/plate.ts';
import { SurfGrid } from './stage5.ts';
import { ShowBase, arrow, label, line, placeArrow, ramp, setLine, tube } from './kit.ts';

const DARK = () => new THREE.MeshStandardMaterial({ color: '#6f7d94', metalness: 0.45, roughness: 0.5 });

function tag(text: string, color: string, size = 0.7, wide = 1) {
  const s = label(text, color, wide);
  s.scale.multiplyScalar(size);
  return s;
}

interface BoxState {
  /** 柱ごと曲がるずれ(全体座屈) */
  Dg: number;
  /** 板の波の高さ(局部座屈) */
  Al: number;
  /** 縦の波の数 */
  m: number;
  /** panel: リブと角は動かず、その間のパネルが波打つ。plate: リブごと板全体が波打つ */
  mode: 'panel' | 'plate';
  load: number;
}

/** 4枚の板でできた箱形の柱。各板の真ん中に縦のリブを付けられる */
class Box6 {
  group = new THREE.Group();
  private walls: { mesh: THREE.Mesh; base: Float32Array; grid: SurfGrid; cos: number; sin: number; sgn: number }[] = [];
  private ribs: { mesh: THREE.Mesh; base: Float32Array }[] = [];
  private top: THREE.Mesh;
  private arrow: THREE.Group;
  private hi: THREE.Mesh;

  constructor(private a: number, private b: number, withRibs: boolean, ribDepth = 0.13) {
    const wallMat = new THREE.MeshStandardMaterial({ color: '#9aa7ba', metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const ribMat = new THREE.MeshStandardMaterial({ color: '#6d28d9', metalness: 0.3, roughness: 0.45 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const th = (i * Math.PI) / 2;
      g.rotation.y = th;
      const geo = new THREE.PlaneGeometry(b, a, 32, 96);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(0, a / 2, b / 2);
      mesh.frustumCulled = false;
      const grid = new SurfGrid(b, a, 8, Math.round((a / b) * 8));
      mesh.add(grid.lines);
      g.add(mesh);
      this.walls.push({ mesh, base: new Float32Array(geo.attributes.position.array as Float32Array), grid, cos: Math.cos(th), sin: Math.sin(th), sgn: i % 2 ? -1 : 1 });
      if (withRibs) {
        const rg = new THREE.BoxGeometry(0.035, a, ribDepth, 1, 96, 1);
        const rib = new THREE.Mesh(rg, ribMat);
        rib.position.set(0, a / 2, b / 2 + ribDepth / 2);
        rib.frustumCulled = false;
        g.add(rib);
        this.ribs.push({ mesh: rib, base: new Float32Array(rg.attributes.position.array as Float32Array) });
      }
      this.group.add(g);
    }
    const dark = DARK();
    const bot = new THREE.Mesh(new THREE.BoxGeometry(b + 0.7, 0.18, b + 0.7), dark);
    bot.position.y = -0.09;
    this.top = new THREE.Mesh(new THREE.BoxGeometry(b + 0.7, 0.18, b + 0.7), dark);
    this.arrow = arrow('#1f2a44');
    this.arrow.scale.set(2, 1, 2);
    // パネル1区画を示す色板
    this.hi = new THREE.Mesh(
      new THREE.PlaneGeometry(b / 2 - 0.03, a - 0.06),
      new THREE.MeshBasicMaterial({ color: '#6d28d9', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.hi.position.set(-b / 4, a / 2, b / 2 + 0.012);
    this.hi.visible = false;
    this.group.add(bot, this.top, this.arrow, this.hi);
  }

  highlightPanel(on: boolean) {
    this.hi.visible = on;
  }

  update(o: BoxState) {
    const { a, b } = this;
    const n = o.mode === 'panel' ? 2 : 1;
    const slopeK = (o.Dg * Math.PI) / a;
    const shorten = (Math.PI * Math.PI * o.Dg * o.Dg) / (4 * a);
    for (const w of this.walls) {
      // 板の中の点(面内 x、面外 z)を、柱ごとのずれ+板の波で動かす
      const wave = (u: number, v: number) => w.sgn * o.Al * Math.sin(o.m * Math.PI * v) * Math.sin(n * Math.PI * u);
      const gx = (v: number) => o.Dg * Math.sin(Math.PI * v);
      const dx = (_u: number, v: number) => gx(v) * w.cos;
      const dz = (u: number, v: number) => wave(u, v) + gx(v) * w.sin;
      // 柱が傾く分: 柱の軸から x 方向に離れた点ほど上下に動く
      const dy = (u: number, v: number) => -(((u - 0.5) * b * w.cos + (b / 2) * w.sin) * slopeK * Math.cos(Math.PI * v)) - shorten * v;
      const p = w.mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < p.count; k++) {
        const u = w.base[k * 3] / b + 0.5;
        const v = w.base[k * 3 + 1] / a + 0.5;
        p.setXYZ(k, w.base[k * 3] + dx(u, v), w.base[k * 3 + 1] + dy(u, v), dz(u, v));
      }
      p.needsUpdate = true;
      w.mesh.geometry.computeVertexNormals();
      w.grid.update(dz, dx, dy);
    }
    this.ribs.forEach((r, i) => {
      const w = this.walls[i];
      const p = r.mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < p.count; k++) {
        const v = r.base[k * 3 + 1] / a + 0.5;
        const gx = o.Dg * Math.sin(Math.PI * v);
        const follow = o.mode === 'plate' ? w.sgn * o.Al * Math.sin(o.m * Math.PI * v) : 0;
        const dy = -((r.base[k * 3] * w.cos + (b / 2) * w.sin) * slopeK * Math.cos(Math.PI * v)) - shorten * v;
        p.setXYZ(k, r.base[k * 3] + gx * w.cos, r.base[k * 3 + 1] + dy, r.base[k * 3 + 2] + follow + gx * w.sin);
      }
      p.needsUpdate = true;
      r.mesh.geometry.computeVertexNormals();
    });
    this.top.position.y = a + 0.09 - shorten;
    const len = 0.3 + 0.8 * Math.min(1.2, o.load);
    placeArrow(this.arrow, 0, a + 0.24 - shorten + len, 0, 0, o.load > 0.005 ? -len : 0);
  }
}

// グラフ(横: 柱の細長さ λ̄、縦: 強さ)
const GX = (l: number) => 0.4 + l * 1.7;
const GY = (s: number) => 0.9 + s * 2.3;
const GZ = -0.3;
function curvePts(f: (l: number) => number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 70; i++) {
    const l = 0.01 + (2.1 * i) / 70;
    pts.push(new THREE.Vector3(GX(l), GY(f(l)), GZ));
  }
  return pts;
}

export interface Lab6 {
  /** 柱の細長さ λ̄ */
  lam: number;
  /** 板の幅厚比パラメータ */
  R: number;
  /** 作用する軸力 ÷ 降伏荷重 */
  n: number;
  /** 作用する曲げ ÷ 曲げの強さ */
  m: number;
}
/** 局部座屈を考慮しない強さ(全体座屈だけ)と、考慮した強さ(掛け算)。旧道示の考え方 */
export const strengthG = (lam: number) => dohshiOld(lam);
export const strengthGL = (lam: number, R: number) => dohshiOld(lam) * plateStrength(R);
/** 場面で使う例 */
export const EX = { lam: 0.8, R: 1.0, n: 0.2, m: 0.3 };
/** 軸力と曲げの場面の例: 増幅がよく見える、細長くて板の厚い柱 */
export const EXB = { lam: 1.4, R: 0.6, n: 0.12, m: 0.25 };

// 軸力と曲げのグラフ(横: 曲げ ÷ 曲げだけの強さ、縦: 軸力 ÷ 軸力だけの強さ)。場所はグラフの壁と同じ
const NX = (m: number) => GX(m * 1.9);
const NY = (r: number) => GY(r);

function dotMesh(color: string, r = 0.085) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
}

export class Stage6Show extends ShowBase {
  private gOne = new THREE.Group();
  private box: Box6;
  private weak: Box6;
  private tags: THREE.Sprite[] = [];
  private side: THREE.Group;
  private sideTag: THREE.Sprite;
  private gPair = new THREE.Group();
  private thick: Box6;
  private thin: Box6;
  private gGraph = new THREE.Group();
  private cG: THREE.Mesh;
  private cGL: THREE.Mesh | null = null;
  private lastR = -1;
  private probe: THREE.Mesh[] = [];
  private loadLine: THREE.Line;
  private loadTag: THREE.Sprite;
  private gNM = new THREE.Group();
  private cLin: THREE.Mesh | null = null;
  private cAmp: THREE.Mesh | null = null;
  private nmKey = '';
  private pt: THREE.Mesh;
  private hit: THREE.Mesh;
  private ray: THREE.Line;
  lab: Lab6 = { lam: 1.2, R: 0.6, n: 0.15, m: 0.25 };

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.addFloor(-0.2);
    this.scene.add(this.gOne, this.gPair, this.gGraph, this.gNM);
    this.box = new Box6(4.4, 1.0, true);
    this.weak = new Box6(4.4, 1.0, true, 0.045);
    this.gOne.add(this.box.group, this.weak.group);
    for (const [t, x, y] of [['リブ', 1.25, 3.4], ['パネル', -1.35, 2.2], ['角', 1.35, 1.2]] as const) {
      const s = tag(t, '#6d28d9', 0.8);
      s.position.set(x, y, 0.8);
      this.gOne.add(s);
      this.tags.push(s);
    }
    // 横から押す力(曲げを生む)
    this.side = arrow('#ea580c');
    this.side.scale.set(2, 1, 2);
    this.sideTag = tag('横から', '#ea580c', 0.9);
    this.gOne.add(this.side, this.sideTag);

    this.thick = new Box6(4.4, 1.0, false);
    this.thick.group.position.x = -1.7;
    this.thin = new Box6(4.4, 1.0, false);
    this.thin.group.position.x = 1.7;
    this.gPair.add(this.thick.group, this.thin.group);
    for (const [t, x] of [['板が厚い柱', -1.7], ['板が薄い柱', 1.7]] as const) {
      const s = tag(t, '#1f2a44', 0.8);
      s.position.set(x, -0.6, 0.8);
      this.gPair.add(s);
    }

    // 2つのグラフの下地と軸
    const frame = (g: THREE.Group, xl: string, yl: string, xt: [number, string][], yt: [number, string][]) => {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false }));
      board.position.set(GX(1.05), GY(0.55), GZ - 0.1);
      g.add(board);
      const axis = (x0: number, y0: number, x1: number, y1: number, c = '#64748b') => {
        const l = line(c);
        setLine(l, x0, y0, x1, y1, GZ - 0.02);
        g.add(l);
      };
      axis(GX(0), GY(0), GX(2.15), GY(0));
      axis(GX(0), GY(0), GX(0), GY(1.25));
      const put = (t: string, x: number, y: number, c = '#44536e', size = 0.7, wide = 1) => {
        const s = tag(t, c, size, wide);
        s.position.set(x, y, GZ);
        g.add(s);
      };
      for (const [x, t] of xt) put(t, x, GY(0) - 0.22);
      for (const [y, t] of yt) {
        put(t, GX(0) - 0.36, y);
        axis(GX(0), y, GX(2.15), y, '#d5dce8');
      }
      put(yl, GX(0) + 0.35, GY(1.33), '#1f2a44', 0.75, 2);
      put(xl, GX(1.55), GY(0) - 0.5, '#1f2a44', 0.75, 2);
    };
    frame(this.gGraph, '柱の細長さ →', '強さ', [0.5, 1, 1.5, 2].map((l) => [GX(l), l.toFixed(1)]), [[GY(1), '100%'], [GY(0.5), '50%']]);
    this.cG = tube(curvePts(strengthG), 0.036, '#0284c7');
    this.gGraph.add(this.cG);
    for (const c of ['#0284c7', '#6d28d9']) {
      const d = dotMesh(c);
      this.gGraph.add(d);
      this.probe.push(d);
    }
    this.loadLine = line('#ea580c');
    this.loadTag = tag('かかる力', '#ea580c', 0.7);
    this.gGraph.add(this.loadLine, this.loadTag);

    frame(this.gNM, '曲げ(横からの力)→', '軸力(軸力だけの強さ = 100%)', [[NX(0.5), '50%'], [NX(1), '100%']], [[NY(0.5), '50%'], [NY(1), '100%']]);
    this.pt = dotMesh('#1f2a44');
    this.hit = dotMesh('#6d28d9', 0.07);
    this.ray = line('#1f2a44');
    this.gNM.add(this.pt, this.hit, this.ray);
    this.setScene(0);
  }

  private setR(R: number) {
    if (Math.abs(R - this.lastR) < 0.004) return;
    this.lastR = R;
    if (this.cGL) {
      this.gGraph.remove(this.cGL);
      this.cGL.geometry.dispose();
    }
    this.cGL = tube(curvePts((l) => strengthGL(l, R)), 0.03, '#6d28d9');
    this.cGL.position.z = 0.03;
    this.gGraph.add(this.cGL);
  }

  /** 軸力と曲げの相関の線を描く。amp: 0 で直線(増幅なし)、1 で増幅あり */
  private setNM(pu: number, pe: number, amp: number) {
    const key = `${pu.toFixed(3)}|${pe.toFixed(3)}|${amp.toFixed(2)}`;
    if (key === this.nmKey) return;
    this.nmKey = key;
    for (const c of [this.cLin, this.cAmp]) {
      if (c) {
        this.gNM.remove(c);
        c.geometry.dispose();
      }
    }
    const pts = (f: (n: number) => number) => {
      const out: THREE.Vector3[] = [];
      for (let i = 0; i <= 50; i++) {
        const n = (pu * i) / 50;
        out.push(new THREE.Vector3(NX(f(n)), NY(n / pu), GZ));
      }
      return out;
    };
    this.cLin = tube(pts((n) => 1 - n / pu), 0.018, '#94a3b8', 0.3);
    this.cAmp = tube(pts((n) => (1 - n / pu) * (1 - amp + amp * (1 - n / pe))), 0.034, '#6d28d9');
    this.cAmp.position.z = 0.03;
    this.gNM.add(this.cLin, this.cAmp);
  }

  private show(g: THREE.Group | null, graph: 'none' | 'lam' | 'nm' = 'none') {
    this.gOne.visible = g === this.gOne;
    this.gPair.visible = g === this.gPair;
    this.gGraph.visible = graph === 'lam';
    this.gNM.visible = graph === 'nm';
  }

  /** 横からの力の矢印。柱の左から、中ほどの高さを押す */
  private sideArrow(len: number, Dg: number) {
    placeArrow(this.side, -0.75 - len + Dg, 2.2, 0.55, len, 0);
    this.sideTag.visible = len > 0.05;
    this.sideTag.position.set(-1.25 + Dg, 2.85, 0.6);
  }

  protected tick() {
    const s = this.sceneIndex;
    const c = this.clock;
    this.gOne.position.set(0, 0, 0);
    this.gOne.scale.setScalar(1);
    this.box.group.visible = s !== 3;
    this.weak.group.visible = s === 3;
    this.box.highlightPanel(false);
    for (const t of this.tags) t.visible = false;
    this.sideArrow(0, 0);
    this.loadLine.visible = false;
    this.loadTag.visible = false;
    const still: BoxState = { Dg: 0, Al: 0, m: 8, mode: 'panel', load: 0 };
    if (s === 0) {
      this.show(this.gOne);
      const t = c % 24;
      this.box.update(still);
      this.tags[0].visible = t > 5;
      this.tags[2].visible = t > 5;
      this.tags[1].visible = t > 11;
      this.box.highlightPanel(t > 11);
      this.caption =
        t < 5
          ? '箱形の柱。薄い板を4枚、溶接して作る'
          : t < 11
            ? '板の真ん中に付いた縦の板が、リブ(補剛材)'
            : t < 18
              ? 'リブと角で区切られた1区画を、パネルと呼ぶ'
              : '柱が曲がる座屈と、板が波打つ座屈。順に整理する';
      this.look(0, 2.3, 2.6, 3.4, 28 + Math.sin(c * 0.3) * 10, 12);
    } else if (s === 1) {
      this.show(this.gOne);
      const t = c % 14;
      const p = ramp(t, 1, 5) * (1 - ramp(t, 13, 14));
      const D = 0.95 * ramp(t, 4.6, 6) * (1 - ramp(t, 13, 14));
      this.box.update({ ...still, Dg: D, load: p });
      this.caption = t < 4.6 ? '柱を上から押していく(軸力だけ)' : t < 9.5 ? '全体座屈: 柱が、柱ごと弓なりに曲がる' : '断面の形は変わらない。決め手は、柱の細長さ';
      this.look(0.4, 2.3, 2.9, 3.4, 20, 8);
    } else if (s === 2) {
      this.show(this.gOne);
      const t = c % 16;
      const p = ramp(t, 1, 5) * (1 - ramp(t, 15, 16));
      const A = 0.1 * ramp(t, 4.6, 6) * (1 - ramp(t, 15, 16));
      this.box.update({ ...still, Al: A, load: p });
      this.box.highlightPanel(t > 10.5 && t < 15);
      this.caption =
        t < 4.6
          ? '同じように押しても、板が薄いと…'
          : t < 10.5
            ? '局部座屈: 柱はまっすぐのまま、板だけが波打つ'
            : 'リブと角は動かない。その間のパネルが波打つ = パネル座屈';
      this.look(0, 2.3, 2.4, 3.2, 34, 12);
    } else if (s === 3) {
      this.show(this.gOne);
      const t = c % 16;
      const p = ramp(t, 1, 5) * (1 - ramp(t, 15, 16));
      const A = 0.2 * ramp(t, 4.6, 6) * (1 - ramp(t, 15, 16));
      this.weak.update({ Dg: 0, Al: A, m: 4, mode: 'plate', load: p });
      this.caption =
        t < 4.6
          ? 'リブが細くて弱いと…'
          : t < 10.5
            ? 'リブごと、板全体が大きく波打つ = 補剛板の全体座屈'
            : 'パネル座屈より大きな波。リブに十分な硬さがあれば防げる';
      this.look(0, 2.3, 2.4, 3.2, 34, 12);
    } else if (s === 4) {
      this.show(this.gPair);
      const t = c % 30;
      const fade = 1 - ramp(t, 29, 30);
      const p = ramp(t, 2.5, 24) * fade;
      const Al = 0.085 * ramp(p, 0.3, 0.37) * fade;
      const DgThin = 0.9 * ramp(p, 0.52, 0.6) * fade;
      const DgThick = 0.9 * ramp(p, 0.93, 1.0) * fade;
      this.thick.update({ Dg: DgThick, Al: 0, m: 4, mode: 'plate', load: Math.min(p, 1) });
      this.thin.update({ Dg: DgThin, Al, m: 4, mode: 'plate', load: Math.min(p, 0.6) });
      this.caption =
        t < 2.5
          ? '外形も長さも同じ2本。違うのは、板の厚みだけ'
          : p < 0.3
            ? '同じ力で押していく'
            : p < 0.52
              ? '右の柱: 先に板が波打った(局部座屈)'
              : p < 0.93
                ? '波打った板は働きが落ちる。柱の踏ん張りも落ち、柱ごと座屈した'
                : '左の柱は、もっと大きな力まで耐えた。右は、局部座屈と全体座屈の連成';
      this.look(0.4, 2.2, 4.0, 3.5, 22, 9);
    } else {
      // ここから先は、柱の絵を左に小さく置き、右にグラフ
      this.gOne.position.set(-2.3, 0.75, 0);
      this.gOne.scale.setScalar(0.62);
      this.look(0.55, 2.2, 4.1, 3.0, 12, 7);
      const t12 = c % 12;
      if (s === 5 || s === 6) {
        this.show(this.gOne, 'lam');
        let R: number;
        if (s === 5) {
          const t = Math.min(c, 40);
          R = t < 12 ? 0.6 : t < 22 ? 0.6 + 0.4 * ramp(t, 12, 14) : 1.0 + 0.4 * ramp(t, 22, 24);
          this.caption =
            t < 5
              ? '青の線 = 全体座屈だけで決めた柱の強さ(STAGE 4 の設計曲線)'
              : t < 12
                ? '板が厚い(R ≦ 0.7)と、局部座屈による低減はなし。2本の線は重なる'
                : t < 22
                  ? '板が薄い(R = 1.0)と、この設計式では × 0.5。線が丸ごと下がる'
                  : 'もっと薄い(R = 1.4)と × 0.26。これが「局部座屈を考慮した強さ」';
          for (const d of this.probe) d.visible = false;
        } else {
          // 軸力だけの照査と安全率: 例の柱(λ̄ = 0.8、R = 1.0)
          R = EX.R;
          const t = Math.min(c, 30);
          const str = strengthGL(EX.lam, R);
          this.probe[0].visible = false;
          this.probe[1].visible = true;
          this.probe[1].position.set(GX(EX.lam), GY(str), GZ + 0.14);
          const on = t > 6;
          this.loadLine.visible = on;
          this.loadTag.visible = on;
          setLine(this.loadLine, GX(0), GY(EX.n), GX(2.15), GY(EX.n), GZ + 0.05);
          this.loadTag.position.set(GX(1.75), GY(EX.n) - 0.2, GZ + 0.05);
          this.caption =
            t < 6
              ? `この柱の強さは、降伏の ${Math.round(str * 100)}%(紫の点)`
              : t < 13
                ? `実際にかかる力は、もっと小さくしておく(オレンジの線、${Math.round(EX.n * 100)}%)`
                : t < 21
                  ? `安全率 = 強さ ÷ かかる力 = ${Math.round(str * 100)} ÷ ${Math.round(EX.n * 100)} = ${(str / EX.n).toFixed(1)}`
                  : 'いまの力を、あと何倍にできるか。それが安全率';
        }
        this.setR(R);
        const p = ramp(t12, 1, 7) * (1 - ramp(t12, 11, 12));
        const thin = Math.max(0, Math.min(1, (R - 0.7) / 0.7));
        const Al = 0.1 * thin * ramp(p, 0.35, 0.5) * (1 - ramp(t12, 11, 12));
        const Dg = s === 5 ? 0.85 * ramp(p, 0.85, 1) * (1 - ramp(t12, 11, 12)) : 0;
        this.box.update({ Dg, Al: s === 5 ? Al : 0, m: 8, mode: 'panel', load: s === 5 ? p * (1 - 0.6 * thin) : 0.45 });
      } else {
        // 軸力と曲げを同時に受ける柱
        this.show(this.gOne, 'nm');
        let lam = EXB.lam;
        let R = EXB.R;
        let n = EXB.n;
        let m = EXB.m;
        let amp = 1;
        let showPt = true;
        let showRay = false;
        if (s === 7) {
          // 曲げが加わると、余力を分け合う
          const t = c % 22;
          amp = 0;
          n = EXB.n * ramp(t, 2, 5);
          m = EXB.m * ramp(t, 7, 10);
          showPt = t > 2;
          this.caption =
            t < 2
              ? '柱は、上から押されるだけではない'
              : t < 7
                ? '上から押す力(軸力)'
                : t < 13
                  ? 'そこへ、横からの力(地震や風)。柱を曲げようとする'
                  : '軸力と曲げで、柱の余力を分け合う。灰色の線の内側なら耐えられる';
        } else if (s === 8) {
          // 軸力が曲げを増幅する
          const t = c % 24;
          amp = ramp(t, 14, 17);
          m = EXB.m;
          n = 0.27 * (ramp(t, 3, 12) - ramp(t, 22.5, 24));
          const pe0 = 1 / (EXB.lam * EXB.lam);
          const k = 1 / (1 - n / pe0);
          this.caption =
            t < 3
              ? '横から押されて、少し曲がった柱'
              : t < 14
                ? `上から押すと、曲がりが大きくなる(いま ${k.toFixed(1)} 倍)`
                : t < 19
                  ? '軸力は、曲げを増幅する。だから耐えられる範囲は、直線より内側(紫の線)'
                  : '増幅の倍率 = 1 ÷ (1 − 軸力 ÷ オイラーの座屈荷重)';
        } else if (s === 9) {
          const t = c % 22;
          showRay = t > 5;
          this.caption =
            t < 5
              ? '黒い点 = いま柱にかかっている軸力と曲げ'
              : t < 12
                ? '軸力と曲げを同じ割合で増やしていくと、紫の線にぶつかる'
                : 'ぶつかるまでの倍率が安全率。あと何倍まで耐えられるか';
        } else {
          ({ lam, R, n, m } = this.lab);
          showRay = true;
          this.caption = '';
        }
        const pu = strengthGL(lam, R);
        const pe = 1 / (lam * lam);
        this.setNM(pu, pe, amp);
        // 柱の絵: 横からの力でたわみ、軸力で増幅される(見やすく誇張)
        const k = n < pe ? 1 / (1 - (amp > 0 || s === 8 ? n / pe : 0)) : 20;
        const Dg = Math.min(1.0, 0.45 * m * k);
        this.box.update({ Dg, Al: 0, m: 8, mode: 'panel', load: n * 1.6 });
        this.sideArrow(m > 0.005 ? 0.3 + 0.85 * m : 0, Dg);
        this.pt.visible = showPt;
        this.pt.position.set(NX(Math.min(m, 1.12)), NY(Math.min(n / pu, 1.2)), GZ + 0.14);
        const g = safetyFactor(n, m, pu, pe);
        const ok = showRay && Number.isFinite(g) && g > 0;
        this.ray.visible = ok;
        this.hit.visible = ok;
        if (ok) {
          setLine(this.ray, NX(0), NY(0), NX(g * m), NY((g * n) / pu), GZ + 0.08);
          this.hit.position.set(NX(g * m), NY((g * n) / pu), GZ + 0.12);
        }
      }
    }
  }
}
