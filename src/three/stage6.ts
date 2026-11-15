import * as THREE from 'three';
import { dohshiOld } from '../physics/curves.ts';
import { plateStrength } from '../physics/plate.ts';
import { SurfGrid } from './stage5.ts';
import { ShowBase, arrow, drawTube, label, line, placeArrow, ramp, setLine, tube } from './kit.ts';

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
  lam: number;
  R: number;
}
/** 局部座屈を考慮しない強さ(全体座屈だけ)と、考慮した強さ(掛け算)。旧道示の考え方 */
export const strengthG = (lam: number) => dohshiOld(lam);
export const strengthGL = (lam: number, R: number) => dohshiOld(lam) * plateStrength(R);

export class Stage6Show extends ShowBase {
  private gOne = new THREE.Group();
  private box: Box6;
  private weak: Box6;
  private tags: THREE.Sprite[] = [];
  private gPair = new THREE.Group();
  private thick: Box6;
  private thin: Box6;
  private pairTags: THREE.Sprite[] = [];
  private gGraph = new THREE.Group();
  private cG: THREE.Mesh;
  private cGL: THREE.Mesh | null = null;
  private lastR = -1;
  private probe: THREE.Mesh[] = [];
  lab: Lab6 = { lam: 0.8, R: 1.0 };

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.addFloor(-0.2);
    this.scene.add(this.gOne, this.gPair, this.gGraph);
    this.box = new Box6(4.4, 1.0, true);
    this.weak = new Box6(4.4, 1.0, true, 0.045);
    this.gOne.add(this.box.group, this.weak.group);
    for (const [t, x, y] of [['リブ', 1.25, 3.4], ['パネル', -1.35, 2.2], ['角', 1.35, 1.2]] as const) {
      const s = tag(t, '#6d28d9', 0.8);
      s.position.set(x, y, 0.8);
      this.gOne.add(s);
      this.tags.push(s);
    }
    this.thick = new Box6(4.4, 1.0, false);
    this.thick.group.position.x = -1.7;
    this.thin = new Box6(4.4, 1.0, false);
    this.thin.group.position.x = 1.7;
    this.gPair.add(this.thick.group, this.thin.group);
    for (const [t, x] of [['板が厚い柱', -1.7], ['板が薄い柱', 1.7]] as const) {
      const s = tag(t, '#1f2a44', 0.8);
      s.position.set(x, -0.6, 0.8);
      this.gPair.add(s);
      this.pairTags.push(s);
    }

    // グラフ
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false }));
    board.position.set(GX(1.05), GY(0.55), GZ - 0.1);
    this.gGraph.add(board);
    const axis = (x0: number, y0: number, x1: number, y1: number, c = '#64748b') => {
      const l = line(c);
      setLine(l, x0, y0, x1, y1, GZ - 0.02);
      this.gGraph.add(l);
    };
    axis(GX(0), GY(0), GX(2.15), GY(0));
    axis(GX(0), GY(0), GX(0), GY(1.25));
    axis(GX(0), GY(1), GX(2.15), GY(1), '#d5dce8');
    axis(GX(0), GY(0.5), GX(2.15), GY(0.5), '#d5dce8');
    const put = (t: string, x: number, y: number, c = '#44536e', size = 0.7, wide = 1) => {
      const s = tag(t, c, size, wide);
      s.position.set(x, y, GZ);
      this.gGraph.add(s);
    };
    for (const l of [0.5, 1, 1.5, 2]) put(l.toFixed(1), GX(l), GY(0) - 0.22);
    put('100%', GX(0) - 0.36, GY(1));
    put('50%', GX(0) - 0.33, GY(0.5));
    put('強さ', GX(0) - 0.3, GY(1.27), '#1f2a44', 0.8);
    put('柱の細長さ →', GX(1.6), GY(0) - 0.5, '#1f2a44', 0.75, 2);
    this.cG = tube(curvePts(strengthG), 0.036, '#0284c7');
    this.gGraph.add(this.cG);
    for (const c of ['#0284c7', '#6d28d9']) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 }));
      this.gGraph.add(d);
      this.probe.push(d);
    }
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

  private show(g: THREE.Group, graph = false) {
    this.gOne.visible = g === this.gOne;
    this.gPair.visible = g === this.gPair;
    this.gGraph.visible = graph;
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
              : '柱・板・パネル。大きさの違う3つの座屈がある';
      this.look(0, 2.3, 2.6, 3.4, 28 + Math.sin(c * 0.3) * 10, 12);
    } else if (s === 1) {
      this.show(this.gOne);
      const t = c % 14;
      const p = ramp(t, 1, 5) * (1 - ramp(t, 13, 14));
      const D = 0.95 * ramp(t, 4.6, 6) * (1 - ramp(t, 13, 14));
      this.box.update({ ...still, Dg: D, load: p });
      this.caption = t < 4.6 ? '柱を押していく' : t < 9.5 ? '全体座屈: 柱が、柱ごと弓なりに曲がる' : '断面の形は変わらない。決め手は、柱の細長さ';
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
          ? '同じ柱でも、板が薄いと…'
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
            : 'パネル座屈より大きな波。リブに十分な硬さがあれば起きない';
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
                ? '波打った板は縁しか働かない。踏ん張りが落ち、柱ごと座屈した'
                : '左の柱は、ずっと大きな力まで耐えてから全体座屈。右は連成座屈';
      this.look(0.4, 2.2, 4.0, 3.5, 22, 9);
    } else {
      // 設計での扱い(場面5)と実験室(場面6)
      this.show(this.gOne, true);
      this.gOne.position.set(-2.5, 0.75, 0);
      this.gOne.scale.setScalar(0.62);
      let R: number;
      let lam: number | null = null;
      if (s === 5) {
        const t = Math.min(c, 40);
        R = t < 12 ? 0.6 : t < 22 ? 0.6 + 0.4 * ramp(t, 12, 14) : 1.0 + 0.4 * ramp(t, 22, 24);
        this.caption =
          t < 5
            ? '青の線 = 板は波打たないとしたときの、柱の強さ(STAGE 4 の設計曲線)'
            : t < 12
              ? '板が厚ければ(R ≦ 0.7)、局部座屈を考慮しても同じ。2本の線は重なる'
              : t < 22
                ? '板が薄い(R = 1.0)と、強さは × 0.5。線が丸ごと下がる'
                : 'もっと薄い(R = 1.4)と × 0.26。これが「局部座屈を考慮した強さ」';
      } else {
        R = this.lab.R;
        lam = this.lab.lam;
        this.caption = '';
      }
      this.setR(R);
      // 柱の絵: 板が薄ければ波打ち、限界で柱ごと曲がる(くり返し)
      const t = c % 12;
      const p = ramp(t, 1, 7) * (1 - ramp(t, 11, 12));
      const thin = Math.max(0, Math.min(1, (R - 0.7) / 0.7));
      const Al = 0.1 * thin * ramp(p, 0.35, 0.5) * (1 - ramp(t, 11, 12));
      const Dg = 0.85 * ramp(p, 0.85, 1) * (1 - ramp(t, 11, 12));
      this.box.update({ Dg, Al, m: 8, mode: 'panel', load: p * (1 - 0.6 * thin) });
      for (const d of this.probe) d.visible = lam !== null;
      if (lam !== null) {
        this.probe[0].position.set(GX(lam), GY(strengthG(lam)), GZ + 0.1);
        this.probe[1].position.set(GX(lam), GY(strengthGL(lam, R)), GZ + 0.14);
      }
      this.look(0.75, 2.2, 3.9, 3.0, 12, 7);
    }
    drawTube(this.cG, 1);
  }
}
