import * as THREE from 'three';
import { panelWidth, plateR, plateStrength, plateTheory } from '../physics/plate.ts';
import { writeStressColor } from './common.ts';
import { ShowBase, arrow, drawTube, label, line, placeArrow, ramp, setLine, tube } from './kit.ts';

const STEEL = new THREE.Color('#7d8ba1');
const DARK = () => new THREE.MeshStandardMaterial({ color: '#1c2740', metalness: 0.7, roughness: 0.45 });
const plateMat = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

function tag(text: string, color: string, size = 0.7, wide = 1) {
  const s = label(text, color, wide);
  s.scale.multiplyScalar(size);
  return s;
}

/** 板の表面に引く格子の線。波の形に沿って動くので、ふくらみが立体に見える */
class SurfGrid {
  lines: THREE.LineSegments;
  private uv: number[] = [];
  constructor(private b: number, private a: number, nu: number, nv: number) {
    const seg = 36;
    for (let k = 0; k <= nu; k++) for (let i = 0; i < seg; i++) this.uv.push(k / nu, i / seg, k / nu, (i + 1) / seg);
    for (let j = 0; j <= nv; j++) for (let i = 0; i < seg; i++) this.uv.push(i / seg, j / nv, (i + 1) / seg, j / nv);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.uv.length / 2) * 3), 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#0a1226', transparent: true, opacity: 0.6 }));
    this.lines.frustumCulled = false;
  }
  update(z: (u: number, v: number) => number) {
    const p = this.lines.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.uv.length / 2; i++) {
      const u = this.uv[i * 2];
      const v = this.uv[i * 2 + 1];
      p.setXYZ(i, (u - 0.5) * this.b, (v - 0.5) * this.a, z(u, v));
    }
    p.needsUpdate = true;
  }
}

/** 板1枚(縦が押す向き)。両側の縁は支えられ、手前・奥へ波打つ */
class Panel {
  group = new THREE.Group();
  private mesh: THREE.Mesh;
  private base: Float32Array;
  private ribs: THREE.Mesh[] = [];
  private ribBase: Float32Array[] = [];
  private top: THREE.Mesh;
  private arrow: THREE.Group;
  private c = new THREE.Color();
  private grid: SurfGrid;

  constructor(public a: number, public b: number, maxRibs = 2) {
    const geo = new THREE.PlaneGeometry(b, a, 56, 84);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    this.base = new Float32Array(geo.attributes.position.array as Float32Array);
    this.mesh = new THREE.Mesh(geo, plateMat());
    this.mesh.position.y = a / 2;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.grid = new SurfGrid(b, a, Math.round(b / 0.1875), Math.round(a / 0.1875));
    this.mesh.add(this.grid.lines);
    const dark = DARK();
    // 上下の押し板と、両側の縁を支える柱(隣の板の代わり)
    const bot = new THREE.Mesh(new THREE.BoxGeometry(b + 0.5, 0.16, 0.6), dark);
    bot.position.y = -0.08;
    this.top = new THREE.Mesh(new THREE.BoxGeometry(b + 0.5, 0.16, 0.6), dark);
    this.group.add(bot, this.top);
    for (const x of [-b / 2 - 0.06, b / 2 + 0.06]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, a, 0.34), dark);
      rail.position.set(x, a / 2, 0);
      this.group.add(rail);
    }
    for (let i = 0; i < maxRibs; i++) {
      const g = new THREE.BoxGeometry(0.05, a, 0.3, 1, 40, 1);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.6, roughness: 0.35, emissive: '#fbbf24', emissiveIntensity: 0.25 }));
      m.position.y = a / 2;
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.ribs.push(m);
      this.ribBase.push(new Float32Array(g.attributes.position.array as Float32Array));
    }
    this.arrow = arrow('#ffffff');
    this.arrow.scale.set(1.8, 1, 1.8);
    this.group.add(this.arrow);
  }

  /**
   * A: 波の高さ。m: 縦の波の数。n: 横の波の数(リブの数+1)。load: 矢印の長さ。
   * ribs: リブの数、ribIn: リブの出具合 0〜1、ribDepth: リブのせい(細いと一緒にたわむ)、follow: リブが板と一緒にたわむ度合い。
   * stress: 応力の色で見る度合い(真ん中が逃げ、縁が働く様子。模式的な分布)
   */
  update(A: number, m: number, n: number, load: number, o: { ribs?: number; ribIn?: number; ribDepth?: number; follow?: number; stress?: number } = {}) {
    const { a, b } = this;
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.mesh.geometry.attributes.color as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const ca = col.array as Float32Array;
    const stress = o.stress ?? 0;
    const tmp = new Float32Array(3);
    for (let i = 0; i < pos.count; i++) {
      const u = this.base[i * 3] / b + 0.5;
      const v = this.base[i * 3 + 1] / a + 0.5;
      const w = Math.sin(m * Math.PI * v) * Math.sin(n * Math.PI * u);
      pa[i * 3 + 2] = A * w;
      // ふくらんだ側を明るく、へこんだ側を暗く
      const tint = A > 0.001 ? w * 0.22 * Math.min(1, A / 0.08) : 0;
      this.c.copy(STEEL).offsetHSL(0, 0, tint);
      if (stress > 0) {
        // 座屈後: 縁の近くほど大きな応力、ふくらんだ真ん中は小さい(模式図)
        const e = Math.abs(Math.cos(n * Math.PI * u));
        writeStressColor(tmp, 0, 0.05 + 0.95 * e ** 2.6, 1, STEEL);
        this.c.lerp(new THREE.Color(tmp[0], tmp[1], tmp[2]), stress);
      }
      ca[i * 3] = this.c.r;
      ca[i * 3 + 1] = this.c.g;
      ca[i * 3 + 2] = this.c.b;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.grid.update((u, v) => A * Math.sin(m * Math.PI * v) * Math.sin(n * Math.PI * u));
    const shorten = A * A * 0.9;
    this.top.position.y = a + 0.08 - shorten;
    this.mesh.scale.y = (a - shorten) / a;
    this.mesh.position.y = (a - shorten) / 2;
    const len = 0.3 + 0.75 * Math.min(1.2, load);
    placeArrow(this.arrow, 0, a + 0.2 - shorten + len, 0, 0, load > 0.005 ? -len : 0);
    // リブ
    const nr = o.ribs ?? 0;
    const depth = o.ribDepth ?? 0.3;
    const follow = o.follow ?? 0;
    this.ribs.forEach((r, i) => {
      r.visible = i < nr && (o.ribIn ?? 1) > 0.01;
      if (!r.visible) return;
      const x = ((i + 1) / (nr + 1) - 0.5) * b;
      const p = r.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.ribBase[i];
      for (let k = 0; k < p.count; k++) {
        const v = base[k * 3 + 1] / a + 0.5;
        const z0 = (base[k * 3 + 2] / 0.3) * depth;
        p.setZ(k, z0 + depth / 2 + 0.01 + follow * A * Math.sin(m * Math.PI * v));
      }
      p.needsUpdate = true;
      r.geometry.computeVertexNormals();
      r.position.x = x;
      r.scale.y = ((a - shorten) / a) * (o.ribIn ?? 1);
      r.position.y = a - shorten - ((a - shorten) * (o.ribIn ?? 1)) / 2;
    });
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
    this.arrow = arrow('#ffffff');
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

// 強さのグラフ
const GX = (R: number) => 0.2 + R * 1.75;
const GY = (s: number) => 0.55 + s * 2.1;
const GZ = -0.2;
function curve(f: (R: number) => number, r0: number, r1: number, rad: number, color: string) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const R = r0 + ((r1 - r0) * i) / 80;
    pts.push(new THREE.Vector3(GX(R), GY(f(R)), GZ));
  }
  return tube(pts, rad, color);
}

export interface Lab5 {
  b: number; // mm
  t: number; // mm
  ribs: number;
  load: number; // σ/σy
}
export const SIGMA_Y = 355;
/** 場面で使う例の板(R = 1.4 になる幅と厚み) */
export const EX_R = 1.4;

export class Stage5Show extends ShowBase {
  private gBox = new THREE.Group();
  private box: BoxCol;
  private gPanel = new THREE.Group();
  private panel: Panel;
  private square: THREE.LineLoop;
  private effTags: THREE.Sprite[] = [];
  private effLines: THREE.Line[] = [];
  private gain: THREE.Sprite[] = [];
  private gPair = new THREE.Group();
  private wide: Panel;
  private narrow: Panel;
  private pairTags: THREE.Sprite[] = [];
  private gGraph = new THREE.Group();
  private cTheory: THREE.Mesh;
  private cYield: THREE.Mesh;
  private cDesign: THREE.Mesh;
  private dots: THREE.Mesh[] = [];
  private dotTags: THREE.Sprite[] = [];
  private probe: THREE.Mesh;
  private amp = [0, 0];
  lab: Lab5 = { b: 1000, t: 12, ribs: 0, load: 0.3 };

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.addFloor(-0.2);
    this.scene.add(this.gBox, this.gPanel, this.gPair, this.gGraph);
    this.box = new BoxCol(3.3, 1.35);
    this.gBox.add(this.box.group);

    this.panel = new Panel(3.0, 1.5);
    this.gPanel.add(this.panel.group);
    this.square = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.75, 0, 0.25),
        new THREE.Vector3(0.75, 0, 0.25),
        new THREE.Vector3(0.75, 1.5, 0.25),
        new THREE.Vector3(-0.75, 1.5, 0.25),
      ]),
      new THREE.LineBasicMaterial({ color: '#fbbf24' }),
    );
    this.gPanel.add(this.square);
    for (const x of [-0.56, 0.56]) {
      const l = line('#fbbf24');
      setLine(l, x - 0.19, 3.3, x + 0.19, 3.3, 0.4);
      const s = tag('有効幅', '#fbbf24', 0.7);
      s.position.set(x * 2.6, 1.5, 0.4);
      this.gPanel.add(l, s);
      this.effLines.push(l);
      this.effTags.push(s);
    }
    for (const t of ['× 1', '× 4', '× 9']) {
      const s = tag(t, '#fbbf24', 1.5);
      s.position.set(2.0, 1.6, 0.3);
      this.gPanel.add(s);
      this.gain.push(s);
    }

    this.wide = new Panel(3.0, 1.5, 0);
    this.wide.group.position.x = -1.45;
    this.narrow = new Panel(3.0, 0.75, 0);
    this.narrow.group.position.x = 1.55;
    this.gPair.add(this.wide.group, this.narrow.group);
    for (const [t, x, y, c] of [['幅 1', -1.45, -0.55, '#e8eefc'], ['幅 1/2', 1.55, -0.55, '#e8eefc'], ['1倍で座屈', -1.45, 4.25, '#fbbf24'], ['4倍で座屈', 1.55, 4.25, '#fbbf24']] as const) {
      const s = tag(t, c, 0.75);
      s.position.set(x, y, 0.4);
      this.gPair.add(s);
      this.pairTags.push(s);
    }

    // グラフ
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.5), new THREE.MeshBasicMaterial({ color: '#0b1430', transparent: true, opacity: 0.85 }));
    board.position.set(GX(1.05), GY(0.58), GZ - 0.1);
    this.gGraph.add(board);
    const axis = (x0: number, y0: number, x1: number, y1: number, c = '#9fb0d0') => {
      const l = line(c);
      setLine(l, x0, y0, x1, y1, GZ - 0.02);
      this.gGraph.add(l);
    };
    axis(GX(0), GY(0), GX(2.15), GY(0));
    axis(GX(0), GY(0), GX(0), GY(1.3));
    axis(GX(0), GY(1), GX(2.15), GY(1), '#1b2a4d');
    const put = (t: string, x: number, y: number, c = '#d3def2', size = 0.6, wide = 1) => {
      const s = tag(t, c, size, wide);
      s.position.set(x, y, GZ);
      this.gGraph.add(s);
      return s;
    };
    for (const r of [0.7, 1.4, 2.0]) {
      axis(GX(r), GY(0), GX(r), GY(0) - 0.06);
      put(r.toFixed(1), GX(r), GY(0) - 0.2);
    }
    put('100%', GX(0) - 0.32, GY(1));
    put('強さ', GX(0) - 0.3, GY(1.3), '#e8eefc');
    put('R(薄くて広い →)', GX(1.5), GY(0) - 0.48, '#e8eefc', 0.6, 2);
    this.cTheory = curve(plateTheory, 0.88, 2.15, 0.02, '#fbbf24');
    this.cYield = curve(() => 1, 0, 2.15, 0.02, '#ff1f4b');
    this.cDesign = curve(plateStrength, 0.01, 2.15, 0.036, '#5cd0ff');
    this.cDesign.position.z = 0.03;
    this.gGraph.add(this.cTheory, this.cYield, this.cDesign);
    [0, 1, 2].forEach((n) => {
      const R = EX_R / (n + 1);
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.8 }));
      d.position.set(GX(R), GY(plateStrength(R)), GZ + 0.1);
      const s = tag(n === 0 ? 'リブなし' : `リブ${n}本`, '#ffffff', 0.55);
      s.position.set(GX(R) + (n === 0 ? 0.1 : 0), GY(plateStrength(R)) + 0.24, GZ + 0.1);
      this.gGraph.add(d, s);
      this.dots.push(d);
      this.dotTags.push(s);
    });
    this.probe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 0.9 }));
    this.gGraph.add(this.probe);
    this.setScene(0);
  }

  private show(...gs: THREE.Group[]) {
    for (const g of [this.gBox, this.gPanel, this.gPair, this.gGraph]) g.visible = gs.includes(g);
  }
  private panelExtras(square: boolean, eff: boolean, gain: number) {
    this.square.visible = square;
    for (const l of this.effLines) l.visible = false;
    for (const t of this.effTags) t.visible = eff;
    this.gain.forEach((g, i) => (g.visible = i === gain));
  }
  private graph(ft: number, fy: number, fd: number, dots: number[], probe: number | null) {
    drawTube(this.cTheory, ft);
    drawTube(this.cYield, fy);
    drawTube(this.cDesign, fd);
    this.dots.forEach((d, i) => {
      d.visible = dots.includes(i);
      this.dotTags[i].visible = dots.includes(i);
    });
    this.probe.visible = probe !== null;
    if (probe !== null) this.probe.position.set(GX(Math.min(2.15, probe)), GY(plateStrength(probe)), GZ + 0.12);
  }

  protected tick(dt: number) {
    const s = this.sceneIndex;
    const c = this.clock;
    this.gPanel.position.set(0, 0, 0);
    this.gPanel.scale.setScalar(1);
    if (s === 0) {
      this.show(this.gBox);
      const t = c % 16;
      const p = ramp(t, 1, 6) * (1 - ramp(t, 15, 16));
      const A = 0.2 * ramp(t, 5, 6.5) * (1 - ramp(t, 15, 16));
      this.box.update(A, 3, p);
      this.caption = t < 1 ? '板を薄く広げて作った、箱形の柱を押す' : t < 5 ? '柱はまっすぐ立っている…' : t < 10.5 ? '柱はまっすぐなのに、板がベコベコと波打った' : '柱全体ではなく、板1枚1枚が座屈する。局部座屈';
      this.look(0, 1.75, 2.6, 3.0, 32, 14);
    } else if (s === 1) {
      this.show(this.gPanel);
      const t = c % 18;
      const p = ramp(t, 2.5, 6) * (1 - ramp(t, 17, 18));
      const A = 0.24 * ramp(t, 5.5, 7) * (1 - ramp(t, 17, 18));
      this.panel.update(A, 2, 1, p);
      this.panelExtras(t > 9 && t < 17, false, -1);
      this.caption =
        t < 2.5
          ? '箱の壁を1枚取り出す。両側の縁は、隣の板に支えられている'
          : t < 9
            ? '押すと、手前と奥へ交互にふくらむ'
            : t < 13.5
              ? '波の1つは、ほぼ正方形。板は、幅と同じ長さの波を作る'
              : '縁が支えられているので、柱のように1つの弓なりにはなれない';
      this.look(0, 1.6, 2.4, 2.9, 40, 16);
    } else if (s === 2) {
      this.show(this.gPair);
      const t = c % 22;
      const p = 4.2 * ramp(t, 1.5, 14) * (1 - ramp(t, 21, 22));
      const fade = 1 - ramp(t, 21, 22);
      this.amp[0] += (((p >= 1 ? 0.24 : 0) * fade) - this.amp[0]) * (1 - Math.exp(-dt * 6));
      this.amp[1] += (((p >= 4 ? 0.14 : 0) * fade) - this.amp[1]) * (1 - Math.exp(-dt * 6));
      this.wide.update(this.amp[0], 2, 1, Math.min(p, 1.05) / 4 + 0.03);
      this.narrow.update(this.amp[1], 4, 1, p / 4 + 0.03);
      this.pairTags[2].visible = this.amp[0] > 0.15;
      this.pairTags[3].visible = this.amp[1] > 0.09;
      this.caption =
        t < 1.5
          ? '幅が半分の板と比べる(厚みは同じ)'
          : p < 1
            ? `同じ強さで押していく(基準の ${p.toFixed(1)} 倍)`
            : p < 4
              ? `幅の広い板が座屈。狭い板はまだ平ら(基準の ${p.toFixed(1)} 倍)`
              : t < 17.5
                ? '幅が半分なら、4倍まで耐える'
                : '厚みを2倍にしても4倍。効くのは「幅 ÷ 厚み」の2乗';
      this.look(0, 1.8, 3.1, 3.2, 36, 16);
    } else if (s === 3) {
      this.show(this.gPanel);
      const t = c % 20;
      const st = ramp(t, 2, 4);
      this.panel.update(0.24, 2, 1, 1, { stress: st });
      this.panelExtras(false, t > 9.5, -1);
      this.caption =
        t < 2
          ? '座屈した板を、応力の色で見る'
          : t < 9.5
            ? 'ふくらんだ真ん中は暗いまま。力を受け流して、逃げている'
            : t < 14.5
              ? '働いているのは縁の近くだけ(有効幅)。縁は赤 = 降伏に達している'
              : '効く板が減ると、柱全体の踏ん張りも減る。全体の座屈の引き金になる';
      this.look(0, 1.45, 2.4, 2.9, 36, 14);
    } else if (s === 4) {
      this.show(this.gPanel);
      const t = c % 30;
      let A = 0;
      let m = 2;
      let n = 1;
      let p = 0;
      let ribs = 0;
      let ribIn = 0;
      let g = -1;
      if (t < 6) {
        p = ramp(t, 0.8, 3) * (1 - ramp(t, 5, 6));
        A = 0.24 * ramp(t, 2.6, 3.6) * (1 - ramp(t, 5, 6));
        g = A > 0.15 ? 0 : -1;
        this.caption = '幅の広い板は、弱い力(基準の1倍)で座屈する';
      } else if (t < 18) {
        ribs = 1;
        ribIn = ramp(t, 6, 8);
        p = 4.05 * ramp(t, 9, 14) * (1 - ramp(t, 17, 18));
        m = 4;
        n = 2;
        A = 0.14 * ramp(p, 3.98, 4.05) * (1 - ramp(t, 17, 18));
        g = A > 0.09 ? 1 : -1;
        this.caption = t < 9 ? '板の真ん中に、縦のリブ(補剛材)を1本溶接する' : p < 3.98 ? `同じ力ではびくともしない(基準の ${p.toFixed(1)} 倍)` : '座屈する力は4倍。リブが「幅が半分の板2枚」に変えた';
      } else {
        ribs = 2;
        ribIn = ramp(t, 18, 20);
        p = 9.05 * ramp(t, 20.5, 26) * (1 - ramp(t, 29, 30));
        m = 6;
        n = 3;
        A = 0.1 * ramp(p, 8.98, 9.05) * (1 - ramp(t, 29, 30));
        g = A > 0.06 ? 2 : -1;
        this.caption = t < 20.5 ? 'リブを2本にすると、幅は 1/3' : p < 8.98 ? `基準の ${p.toFixed(1)} 倍` : '座屈する力は9倍(幅の2乗に反比例)';
      }
      this.panel.update(A, m, n, Math.min(1.1, p / 8 + 0.05 * Math.min(1, p)), { ribs, ribIn });
      this.panelExtras(false, false, g);
      this.look(0.4, 1.6, 2.9, 2.9, 40, 16);
    } else if (s === 5) {
      this.show(this.gPanel, this.gGraph);
      this.gPanel.position.set(-2.55, 0.35, 0);
      this.gPanel.scale.setScalar(0.78);
      const t = Math.min(c, 40);
      const ribs = t < 22 ? 0 : t < 30 ? 1 : 2;
      const A = ribs === 0 ? 0.15 * ramp(t, 17, 18.5) : 0;
      this.panel.update(A * (1 - ramp(t, 21, 22)), 2, 1, 0.6, { ribs, ribIn: 1 });
      this.panelExtras(false, false, -1);
      this.graph(ramp(t, 4, 7), ramp(t, 8.5, 10.5), ramp(t, 12, 15.5), t < 17 ? [] : t < 22 ? [0] : t < 30 ? [0, 1] : [0, 1, 2], null);
      this.caption =
        t < 4
          ? '板の強さのグラフ。右へ行くほど、薄くて広い板'
          : t < 8.5
            ? '金の線 = 座屈の理論値。幅が半分で4倍'
            : t < 12
              ? 'でも、材料の限界(降伏)は超えられない'
              : t < 17
                ? '設計の線(水色): 薄い板は理論値の半分。厚い板は降伏で頭打ち'
                : t < 22
                  ? 'この板(R = 1.4)の強さは、降伏の 26%'
                  : t < 30
                    ? 'リブ1本で R = 0.7。強さは 100% に。約4倍'
                    : 'リブ2本でも 100% のまま。天井に届けば、それ以上は増えない';
      this.look(0.55, 1.75, 3.9, 2.75, 14, 8);
    } else if (s === 6) {
      this.show(this.gPanel);
      const t = c % 24;
      const weak = t < 12;
      const p = weak ? 1.6 * ramp(t, 2, 6) * (1 - ramp(t, 11, 12)) : 4.05 * ramp(t, 14, 19) * (1 - ramp(t, 23, 24));
      let A: number;
      if (weak) A = 0.24 * ramp(p, 1.5, 1.6) * (1 - ramp(t, 11, 12));
      else A = 0.14 * ramp(p, 3.98, 4.05) * (1 - ramp(t, 23, 24));
      this.panel.update(A, weak ? 2 : 4, weak ? 1 : 2, Math.min(1.1, p / 4 + 0.05), { ribs: 1, ribIn: 1, ribDepth: weak ? 0.07 : 0.3, follow: weak ? 1 : 0 });
      this.panelExtras(false, false, -1);
      this.caption =
        t < 2
          ? 'リブが細すぎると、どうなるか'
          : t < 12
            ? p < 1.5
              ? `細いリブを付けて押す(基準の ${p.toFixed(1)} 倍)`
              : 'リブが板と一緒にたわんだ。幅を分けられず、ほとんど効かない'
            : p < 3.98
              ? `リブを十分に硬くすると(基準の ${p.toFixed(1)} 倍)`
              : 'リブはまっすぐのまま。板だけが、半分の幅で波打つ';
      this.look(0.2, 1.6, 2.6, 2.9, 42, 16);
    } else {
      // 実験室
      this.show(this.gPanel, this.gGraph);
      this.gPanel.position.set(-2.55, 0.35, 0);
      this.gPanel.scale.setScalar(0.78);
      const { b, t, ribs, load } = this.lab;
      const R = plateR(panelWidth(b, ribs), t, SIGMA_Y);
      const el = Math.min(plateTheory(R), 9);
      const strength = plateStrength(R);
      const n = ribs + 1;
      const m = Math.max(1, Math.round(2 * n));
      // 弾性座屈を超えると波打ち始める(R が小さい板は、波打つ前に降伏する)
      const over = load / Math.min(el, 1.05);
      const goal = el < 1 && over > 1 ? Math.min(0.24, (0.24 / n) * Math.sqrt(Math.min(4, over - 1) + 0.15)) : 0;
      this.amp[0] += (goal - this.amp[0]) * (1 - Math.exp(-dt * 6));
      this.panel.update(this.amp[0], m, n, load, { ribs, ribIn: 1, stress: load >= strength ? 1 : 0 });
      this.panelExtras(false, false, -1);
      this.graph(1, 1, 1, [], R);
      this.caption = '';
      this.look(0.55, 1.75, 3.9, 2.75, 14, 8);
    }
  }
}
