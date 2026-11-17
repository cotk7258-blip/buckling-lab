import * as THREE from 'three';
import { SECTION } from '../physics/column.ts';
import type { ColumnPath, ColumnView } from '../physics/column.ts';
import { ExplainScene } from './explain.ts';
import type { ExplainMode } from './explain.ts';
import { BG, addStudioEnvironment, makeGlowMaterial, makeRenderer, writeStressColor } from './common.ts';
import { arrow, label, placeArrow } from './kit.ts';

/** たわみを絵の上で何倍に見せるか */
export const DEFL_AMP = 12;

const COL_H = 4; // 柱の絵の高さ
const BASE_Y = 0.95; // 柱の下端の高さ
const COL_X = [-1.45, 1.45];
const TOP_BEAM_Y = BASE_Y + COL_H + 0.95;
const STEEL = new THREE.Color('#7c8aa0');

interface PlateMesh {
  mesh: THREE.Mesh;
  base: Float32Array;
  /** 頂点ごとの繊維の番号(小数)と、その板の最後の繊維 */
  fib: Float32Array;
  fibMax: number;
}

class Column3D {
  group = new THREE.Group();
  private plates: PlateMesh[] = [];
  private body = new THREE.Group();
  private topCap = new THREE.Group();
  private botCap = new THREE.Group();
  private ram: THREE.Mesh;
  private cut: THREE.LineLoop;
  private light: THREE.PointLight;
  private mat: THREE.Material;
  // 輪切り: 上半分を透かし、切り口に応力の色を出す
  private clipLow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e3);
  private clipHigh = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e3);
  private ghostMat: THREE.MeshBasicMaterial;
  private ghosts: THREE.Mesh[] = [];
  private cap: THREE.Mesh;
  private cutaway = 0;
  /** 断面の外形(絵の単位) */
  bw = 0.3;
  hw = 0.3;
  lastD = 0;

  constructor(x: number, glow: { value: number }, machine: THREE.Material, withTags = false) {
    this.mat = makeGlowMaterial(glow, { vertexColors: true, clippingPlanes: [this.clipLow] });
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: '#64748b',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      clippingPlanes: [this.clipHigh],
    });
    this.cap = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    );
    this.cap.visible = false;
    this.group.add(this.cap);
    this.group.position.x = x;
    this.group.add(this.body, this.topCap, this.botCap);
    const pin = new THREE.CylinderGeometry(0.075, 0.075, 0.9, 24).rotateX(Math.PI / 2);
    const bright = new THREE.MeshStandardMaterial({ color: '#c9d3e3', metalness: 0.9, roughness: 0.25 });
    // 下の支点: 台 + ピン + 受け板
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.0, BASE_Y - 0.42, 1.1), machine);
    ped.position.y = (BASE_Y - 0.42) / 2 + 0.2;
    this.group.add(ped);
    const pinB = new THREE.Mesh(pin, bright);
    pinB.position.y = BASE_Y - 0.145;
    this.group.add(pinB);
    this.botCap.position.y = BASE_Y - 0.145;
    this.botCap.add(this.capPlate(0.11, machine));
    // 上の支点: 受け板 + ピン + ジャッキ
    const pinT = new THREE.Mesh(pin, bright);
    this.topCap.add(pinT);
    this.topCap.add(this.capPlate(-0.11, machine));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.95), machine);
    head.position.y = 0.17;
    this.topCap.add(head);
    this.ram = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1, 28), bright);
    this.group.add(this.ram);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 28), machine);
    sleeve.position.y = TOP_BEAM_Y - 0.25;
    this.group.add(sleeve);
    // 輪切りの位置を示す枠
    this.cut = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#6d28d9', transparent: true }),
    );
    this.group.add(this.cut);
    this.light = new THREE.PointLight('#ff2d55', 0, 6, 1.6);
    this.light.position.set(0, BASE_Y + COL_H / 2, 1.2);
    this.group.add(this.light);
    // 曲げる力(押す力 × たわみ)と、戻す力(回復力)
    this.fOut = arrow('#ea580c');
    this.fBack = arrow('#0284c7');
    for (const a of [this.fOut, this.fBack]) a.scale.set(1.5, 1, 1.5);
    this.group.add(this.fOut, this.fBack);
    if (withTags)
      for (const [t, c] of [['曲げる力 P×たわみ', '#ea580c'], ['戻す力', '#0284c7']] as const) {
        const sp = label(t, c, t.length > 5 ? 2 : 1);
        sp.scale.multiplyScalar(0.6);
        sp.visible = false;
        this.group.add(sp);
        this.ftags.push(sp);
      }
  }
  private fOut: THREE.Group;
  private fBack: THREE.Group;
  private ftags: THREE.Sprite[] = [];

  private capPlate(y: number, machine: THREE.Material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 1.0), machine);
    m.position.y = y;
    m.name = 'cap';
    return m;
  }

  /** 柱の長さ(細長さ)に合わせて形を作り直す */
  build(path: ColumnPath) {
    for (const p of this.plates) {
      this.body.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    for (const g of this.ghosts) this.body.remove(g);
    this.ghosts = [];
    this.plates = [];
    const sc = COL_H / path.Lmm;
    const bw = SECTION.b * sc;
    const tf = SECTION.tf * sc;
    const hw = SECTION.hw * sc;
    const tw = SECTION.tw * sc;
    this.bw = bw;
    this.hw = hw + 2 * tf;
    const { nf, nw } = path;
    const add = (geo: THREE.BufferGeometry, z0: number, flange: boolean) => {
      geo.translate(0, 0, z0);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const base = new Float32Array(pos.array as Float32Array);
      const fib = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        if (flange) {
          // 曲がりの内側(-x)が z>0 の繊維
          const zf = -base[i * 3] / bw;
          fib[i] = Math.max(0, Math.min(nf - 1, (zf + 0.5) * nf - 0.5));
        } else {
          const u = base[i * 3 + 2] / hw;
          fib[i] = nf + Math.max(0, Math.min(nw - 1, (u + 0.5) * nw - 0.5));
        }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.frustumCulled = false;
      this.body.add(mesh);
      const ghost = new THREE.Mesh(geo, this.ghostMat);
      ghost.frustumCulled = false;
      ghost.visible = false;
      this.body.add(ghost);
      this.ghosts.push(ghost);
      this.plates.push({ mesh, base, fib, fibMax: flange ? nf - 1 : nf + nw - 1 });
    };
    add(new THREE.BoxGeometry(bw, COL_H, tf, 20, 56, 1), (hw + tf) / 2, true);
    add(new THREE.BoxGeometry(bw, COL_H, tf, 20, 56, 1), -(hw + tf) / 2, true);
    add(new THREE.BoxGeometry(tw, COL_H, hw, 1, 56, 8), 0, false);
    // 受け板を断面より少し大きく
    const s = Math.max(0.55, bw * 1.5);
    const d = Math.max(0.6, this.hw * 1.5);
    for (const g of [this.topCap, this.botCap]) {
      const cap = g.getObjectByName('cap') as THREE.Mesh;
      cap.scale.set(s / 0.8, 1, d / 1.0);
    }
    // 切り口: 繊維ごとの四角を並べる(色は毎回、中央断面の応力から)
    const cp: number[] = [];
    const quad = (x0: number, x1: number, z0: number, z1: number) =>
      cp.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x0, 0, z0, x1, 0, z1, x1, 0, z0);
    for (const zc of [(hw + tf) / 2, -(hw + tf) / 2])
      for (let i = 0; i < nf; i++) {
        const xc = -path.z[i] * bw;
        quad(xc - bw / nf / 2, xc + bw / nf / 2, zc - tf / 2, zc + tf / 2);
      }
    for (let i = 0; i < nw; i++) {
      const zc = path.u[nf + i] * hw;
      quad(-tw / 2, tw / 2, zc - hw / nw / 2, zc + hw / nw / 2);
    }
    this.cap.geometry.dispose();
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cp), 3));
    cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cp.length), 3));
    this.cap.geometry = cg;
    const o = 0.02;
    const pts = [
      [-bw / 2 - o, -this.hw / 2 - o],
      [bw / 2 + o, -this.hw / 2 - o],
      [bw / 2 + o, this.hw / 2 + o],
      [-bw / 2 - o, this.hw / 2 + o],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.cut.geometry.dispose();
    this.cut.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  update(path: ColumnPath, view: ColumnView, mix: number, time: number, cutTarget: number, dt: number) {
    const st = view.step;
    const sc = COL_H / path.Lmm;
    // 絵の上でのたわみ(誇張)
    const D = Math.min(1.25, DEFL_AMP * (path.v0 + st.v) * SECTION.b * sc);
    this.lastD = D;
    const theta = (D * Math.PI) / COL_H;
    const shorten = (Math.PI * Math.PI * D * D) / (4 * COL_H);
    const n = path.nf + path.nw;
    const ns = path.ns;
    const sig = st.sigS;
    for (const p of this.plates) {
      const pos = p.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const col = p.mesh.geometry.attributes.color as THREE.BufferAttribute;
      const pa = pos.array as Float32Array;
      const ca = col.array as Float32Array;
      const cnt = pos.count;
      for (let i = 0; i < cnt; i++) {
        const x0 = p.base[i * 3];
        const y0 = p.base[i * 3 + 1];
        const xi = y0 / COL_H + 0.5;
        const sn = Math.sin(Math.PI * xi);
        const cs = Math.cos(Math.PI * xi);
        pa[i * 3] = x0 + D * sn;
        pa[i * 3 + 1] = y0 - x0 * theta * cs - shorten * xi;
        // 応力: 断面(端〜中央)と繊維の両方で補間
        const sj = Math.min(xi, 1 - xi) * 2 * (ns - 1);
        const j0 = Math.min(ns - 2, Math.floor(sj));
        const tj = sj - j0;
        const f0 = Math.floor(p.fib[i]);
        const f1 = Math.min(p.fibMax, f0 + 1);
        const tf = p.fib[i] - f0;
        const a = sig[j0 * n + f0] + (sig[j0 * n + f1] - sig[j0 * n + f0]) * tf;
        const b = sig[(j0 + 1) * n + f0] + (sig[(j0 + 1) * n + f1] - sig[(j0 + 1) * n + f0]) * tf;
        writeStressColor(ca, i * 3, a + (b - a) * tj, mix, STEEL);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      p.mesh.geometry.computeVertexNormals();
    }
    this.body.position.y = BASE_Y + COL_H / 2;
    const topY = BASE_Y + COL_H - shorten;
    this.topCap.position.set(0, topY + 0.145, 0);
    this.topCap.rotation.z = theta;
    this.botCap.rotation.z = -theta;
    const ramBottom = topY + 0.4;
    const len = Math.max(0.05, TOP_BEAM_Y - ramBottom);
    this.ram.scale.y = len;
    this.ram.position.y = ramBottom + len / 2;
    const cutY = BASE_Y + COL_H / 2 - shorten / 2;
    this.cut.position.set(D, cutY, 0);
    // 輪切りの進み具合
    this.cutaway += (cutTarget - this.cutaway) * (1 - Math.exp(-dt * 2.5));
    const on = this.cutaway > 0.02;
    this.clipLow.constant = on ? cutY + (1 - this.cutaway) * (COL_H / 2 + 0.6) : 1e3;
    this.clipHigh.constant = -cutY;
    this.ghostMat.opacity = 0.05 * this.cutaway;
    for (const g of this.ghosts) g.visible = on;
    this.cap.visible = this.cutaway > 0.9;
    if (this.cap.visible) {
      this.cap.position.set(D, cutY, 0);
      const cc = this.cap.geometry.attributes.color as THREE.BufferAttribute;
      const arr = cc.array as Float32Array;
      for (let q = 0; q < n + path.nf; q++) {
        const f = q < path.nf ? q : q < 2 * path.nf ? q - path.nf : q - path.nf;
        for (let k = 0; k < 6; k++) writeStressColor(arr, (q * 6 + k) * 3, st.sig[f], Math.max(mix, 0.001), STEEL);
      }
      cc.needsUpdate = true;
    }
    (this.cut.material as THREE.LineBasicMaterial).opacity = mix;
    this.cut.visible = mix > 0.02;
    // 座屈の瞬間に赤く光らせる
    const pulse = view.collapsed ? 0.6 + 0.4 * Math.sin(time * 7) : 0;
    this.light.intensity = view.collapse > 0 ? (2 + 6 * (1 - view.collapse)) * pulse : 0;
    this.light.position.x = D;
    // たわみが見えてきたら、柱の中ほどに力の矢印。座屈したら曲げる力が勝つ
    const fy = BASE_Y + COL_H / 2 - shorten / 2;
    const fon = D > 0.08 && this.cutaway < 0.05;
    const k = 0.9 * D;
    const out = view.collapsed ? k * 1.35 : k;
    placeArrow(this.fOut, D + this.bw / 2 + 0.1, fy + 0.18, 0.3, fon ? out : 0, 0);
    placeArrow(this.fBack, D - this.bw / 2 - 0.1, fy - 0.18, 0.3, fon ? -k : 0, 0);
    if (this.ftags.length) {
      this.ftags[0].visible = fon;
      this.ftags[0].position.set(D + this.bw / 2 + 0.1 + out + 0.75, fy + 0.18, 0.4);
      this.ftags[1].visible = fon;
      this.ftags[1].position.set(D - this.bw / 2 - 0.1 - k - 0.45, fy - 0.18, 0.4);
    }
  }
}

export interface CameraPose {
  /** 水平の向き(度。0 が正面) */
  az: number;
  /** 見下ろす角度(度) */
  el: number;
  /** どこを映すか */
  focus: 'both' | 'real' | 'realMid' | 'ideal';
}

export class Stage3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private cols: Column3D[];
  private glow = { value: 0 };
  private pose: CameraPose = { az: 18, el: 8, focus: 'both' };
  private cur = { az: 18, el: 8, cx: 0, cy: 3, hw: 3.2, hh: 3.3 };
  private userAz = 0;
  private shake = 0;
  private wasCollapsed = [false, false];
  private aspect = 1;
  private explain: ExplainScene;
  private explainMode: ExplainMode | null = null;
  /** 説明用の場面の、いまの段階の文 */
  caption = '';
  private w = 1;
  private h = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    this.scene.background = BG;
    this.scene.fog = new THREE.Fog(BG, 14, 42);
    addStudioEnvironment(this.renderer, this.scene, 0.55);

    this.explain = new ExplainScene(this.scene.environment, BG);

    const machine = new THREE.MeshStandardMaterial({ color: '#6f7d94', metalness: 0.45, roughness: 0.5 });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ color: '#e4eaf2', metalness: 0.2, roughness: 0.75 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(60, 60, '#bfcada', '#d3dbe6');
    grid.position.y = 0.002;
    this.scene.add(grid);

    // 試験機: 床の台、うしろの門形の枠、上の梁
    const slab = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 2.2), machine);
    slab.position.set(0, 0.1, -0.2);
    this.scene.add(slab);
    for (const x of [-3.0, 3.0]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, TOP_BEAM_Y, 0.5), machine);
      post.position.set(x, TOP_BEAM_Y / 2, -0.95);
      this.scene.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.5, 1.9), machine);
    beam.position.set(0, TOP_BEAM_Y + 0.25, -0.3);
    this.scene.add(beam);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#c5cfdd', 0.7));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(4, 8, 7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#0284c7', 1.6);
    rim.position.set(-6, 4, -5);
    this.scene.add(rim);

    this.cols = COL_X.map((x, i) => new Column3D(x, this.glow, machine, i === 1));
    for (const c of this.cols) this.scene.add(c.group);

    // 横になぞると回り込む(縦のスクロールはページに渡す)
    canvas.style.touchAction = 'pan-y';
    let drag: { x: number; az: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, az: this.userAz };
    });
    window.addEventListener('pointermove', (e) => {
      if (drag) this.userAz = Math.max(-75, Math.min(75, drag.az - (e.clientX - drag.x) * 0.35));
    });
    const end = () => (drag = null);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h || (w === this.w && h === this.h)) return;
    this.w = w;
    this.h = h;
    this.aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  setPaths(paths: ColumnPath[]) {
    paths.forEach((p, i) => this.cols[i].build(p));
  }

  setPose(pose: CameraPose, resetUser = true) {
    this.pose = pose;
    if (resetUser) this.userAz = 0;
  }

  /** 説明用の場面(バネの束)に切り替える。null で試験機に戻す */
  setExplain(mode: ExplainMode | null) {
    if (mode === this.explainMode) return;
    this.explainMode = mode;
    this.explain.reset();
  }

  /** 柱の上のラベルを置く画面上の位置(px)。映っていなければ null */
  labelPos(i: number): { x: number; y: number } | null {
    if (this.pose.focus === 'realMid' || this.explainMode) return null;
    const v = new THREE.Vector3(COL_X[i], TOP_BEAM_Y - 0.05, 0.6).project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 0.98) return null;
    return { x: ((v.x + 1) / 2) * this.w, y: Math.max(4, ((1 - v.y) / 2) * this.h) };
  }

  update(paths: ColumnPath[], views: ColumnView[], stressMix: number, time: number, dt: number) {
    this.resize();
    if (this.explainMode) {
      this.explain.update(this.explainMode, dt, this.aspect);
      this.caption = this.explain.caption;
      this.renderer.render(this.explain.scene, this.explain.camera);
      return;
    }
    this.caption = '';
    this.glow.value = stressMix;
    views.forEach((v, i) => {
      this.cols[i].update(paths[i], v, stressMix, time, i === 1 && this.pose.focus === 'realMid' ? 1 : 0, dt);
      if (v.collapsed && !this.wasCollapsed[i]) this.shake = 1;
      this.wasCollapsed[i] = v.collapsed;
    });

    // カメラ: 目標の構図へなめらかに寄せる
    const f = this.pose.focus;
    const real = this.cols[1];
    const tgt =
      f === 'both'
        ? { cx: 0.3, cy: 3.05, hw: 3.0, hh: 2.95 }
        : f === 'real'
          ? { cx: COL_X[1] + 0.3, cy: 3.0, hw: 1.5, hh: 2.75 }
          : f === 'ideal'
            ? { cx: COL_X[0] + 0.3, cy: 3.0, hw: 1.5, hh: 2.75 }
            : { cx: COL_X[1] + real.lastD, cy: BASE_Y + COL_H / 2 - 0.1, hw: Math.max(0.42, real.bw * 1.9), hh: Math.max(0.5, real.bw * 2.2) };
    const k = 1 - Math.exp(-dt * 2.2);
    const c = this.cur;
    c.az += (this.pose.az + this.userAz - c.az) * (1 - Math.exp(-dt * 5));
    c.el += (this.pose.el - c.el) * k;
    c.cx += (tgt.cx - c.cx) * k;
    c.cy += (tgt.cy - c.cy) * k;
    c.hw += (tgt.hw - c.hw) * k;
    c.hh += (tgt.hh - c.hh) * k;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = Math.max(c.hh / tan, c.hw / (tan * this.aspect));
    const az = THREE.MathUtils.degToRad(c.az + Math.sin(time * 0.25) * 2.5);
    const el = THREE.MathUtils.degToRad(c.el);
    this.shake *= Math.exp(-dt * 5);
    const sx = this.shake * 0.05 * Math.sin(time * 61);
    const sy = this.shake * 0.05 * Math.sin(time * 47);
    this.camera.position.set(
      c.cx + dist * Math.sin(az) * Math.cos(el) + sx,
      c.cy + dist * Math.sin(el) + sy,
      dist * Math.cos(az) * Math.cos(el),
    );
    this.camera.lookAt(c.cx + sx, c.cy + sy, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
