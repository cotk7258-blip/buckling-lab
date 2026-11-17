import * as THREE from 'three';
import { BG, addStudioEnvironment, makeRenderer } from './common.ts';

export const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
/** 時刻 t が a〜b の間で 0→1 */
export const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

export function arrow(color: string): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.4 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 16), m);
  shaft.position.y = 0.5;
  shaft.name = 'shaft';
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 20), m);
  head.name = 'head';
  g.add(shaft, head);
  return g;
}
/** 矢印を根元 y0 から長さ len(負なら下向き)で置く */
export function setArrow(g: THREE.Group, x: number, y0: number, len: number, z = 0) {
  const a = Math.abs(len);
  g.visible = a > 0.04;
  if (!g.visible) return;
  g.position.set(x, y0, z);
  g.rotation.z = len < 0 ? Math.PI : 0;
  const shaft = g.getObjectByName('shaft')!;
  const head = g.getObjectByName('head')!;
  const sl = Math.max(0.01, a - 0.26);
  shaft.scale.y = sl;
  shaft.position.y = sl / 2;
  head.position.y = sl + 0.13;
}
export function tintArrow(g: THREE.Group, color: string) {
  const m = (g.getObjectByName('head') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  m.color.set(color);
  m.emissive.copy(m.color);
}

/** 文字の札(常にカメラを向く)。wide は長い文用 */
export function label(text: string, color: string, wide = 1): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = 512 * wide;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.font = 'bold 76px "Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, cv.width / 2, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false, fog: false }));
  sp.scale.set(1.5 * wide, 0.375, 1);
  return sp;
}

export function line(color: string, dashed = false): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.06 })
    : new THREE.LineBasicMaterial({ color });
  return new THREE.Line(geo, mat);
}
export function setLine(l: THREE.Line, x0: number, y0: number, x1: number, y1: number, z = 0.42) {
  const p = l.geometry.attributes.position as THREE.BufferAttribute;
  p.setXYZ(0, x0, y0, z);
  p.setXYZ(1, x1, y1, z);
  p.needsUpdate = true;
  l.computeLineDistances();
}


/** 線を太く見せたいときの管。pts をなめらかにつなぐ */
export function tube(pts: THREE.Vector3[], radius: number, color: string, glow = 0.6): THREE.Mesh {
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), Math.max(8, pts.length * 3), radius, 8);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: glow, roughness: 0.5 });
  return new THREE.Mesh(geo, mat);
}
/** 管を根元から frac(0〜1)まで描く */
export function drawTube(m: THREE.Mesh, frac: number) {
  const idx = m.geometry.index!;
  m.geometry.setDrawRange(0, Math.floor((idx.count / 6) * Math.max(0, Math.min(1, frac))) * 6);
  m.visible = frac > 0.001;
}

/**
 * 各ステージの 3D の土台。場面(番号)ごとの時計、カメラの寄せ、横になぞる回り込み、
 * 画面に重ねる説明文(caption)を持つ。継承して tick() で中身を動かす。
 */
export abstract class ShowBase {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  caption = '';
  /** いまの場面と、その場面に入ってからの秒 */
  sceneIndex = 0;
  clock = 0;
  time = 0;
  protected aspect = 1;
  private w = 0;
  private h = 0;
  private tgt = { cx: 0, cy: 1.5, hw: 3, hh: 3, az: 10, el: 8 };
  private cur = { cx: 0, cy: 1.5, hw: 3, hh: 3, az: 10, el: 8 };
  private userAz = 0;
  private first = true;

  constructor(protected canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    this.scene.background = BG;
    addStudioEnvironment(this.renderer, this.scene, 0.5);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#c5cfdd', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(3, 7, 7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#0284c7', 1.0);
    rim.position.set(-6, 4, -5);
    this.scene.add(rim);
    canvas.style.touchAction = 'pan-y';
    let drag: { x: number; az: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, az: this.userAz }));
    this.onMove = (e) => {
      if (drag) this.userAz = Math.max(-70, Math.min(70, drag.az - (e.clientX - drag.x) * 0.35));
    };
    this.onUp = () => (drag = null);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }
  private onMove: (e: PointerEvent) => void;
  private onUp: () => void;

  /** 床と目盛り(必要なステージだけ呼ぶ) */
  protected addFloor(y = 0) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: '#e4eaf2', metalness: 0.2, roughness: 0.75 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = y;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(80, 80, '#bfcada', '#d3dbe6');
    grid.position.y = y + 0.002;
    this.scene.add(grid);
    this.scene.fog = new THREE.Fog(BG, 18, 60);
  }

  /** 画面に収めたい範囲(中心と半分の幅・高さ)と向き */
  protected look(cx: number, cy: number, hw: number, hh: number, az = 10, el = 8) {
    this.tgt = { cx, cy, hw, hh, az, el };
  }

  setScene(i: number) {
    if (i === this.sceneIndex && !this.first) return;
    this.sceneIndex = i;
    this.clock = 0;
    this.userAz = 0;
    this.onScene(i);
  }
  protected onScene(_i: number) {}
  protected abstract tick(dt: number): void;

  frame(dt: number) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w && h && (w !== this.w || h !== this.h)) {
      this.w = w;
      this.h = h;
      this.aspect = w / h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = this.aspect;
      this.camera.updateProjectionMatrix();
    }
    this.clock += dt;
    this.time += dt;
    this.tick(dt);
    const k = this.first ? 1 : 1 - Math.exp(-dt * 2.4);
    const kAz = this.first ? 1 : 1 - Math.exp(-dt * 5);
    this.first = false;
    const c = this.cur;
    const t = this.tgt;
    c.cx += (t.cx - c.cx) * k;
    c.cy += (t.cy - c.cy) * k;
    c.hw += (t.hw - c.hw) * k;
    c.hh += (t.hh - c.hh) * k;
    c.el += (t.el - c.el) * k;
    c.az += (t.az + this.userAz - c.az) * kAz;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = Math.max(c.hh / tan, c.hw / (tan * this.aspect));
    const az = THREE.MathUtils.degToRad(c.az + Math.sin(this.time * 0.25) * 1.5);
    const el = THREE.MathUtils.degToRad(c.el);
    this.camera.position.set(c.cx + dist * Math.sin(az) * Math.cos(el), c.cy + dist * Math.sin(el), dist * Math.cos(az) * Math.cos(el));
    this.camera.lookAt(c.cx, c.cy, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.renderer.dispose();
  }
}

/** 矢印を (x, y) から (dx, dy) の向き・長さで置く(紙面内の好きな向き) */
export function placeArrow(g: THREE.Group, x: number, y: number, z: number, dx: number, dy: number) {
  const a = Math.hypot(dx, dy);
  g.visible = a > 0.04;
  if (!g.visible) return;
  g.position.set(x, y, z);
  g.rotation.z = Math.atan2(-dx, dy);
  const shaft = g.getObjectByName('shaft')!;
  const head = g.getObjectByName('head')!;
  const sl = Math.max(0.01, a - 0.26);
  shaft.scale.y = sl;
  shaft.position.y = sl / 2;
  head.position.y = sl + 0.13;
}

const UP = new THREE.Vector3(0, 1, 0);
const DIR = new THREE.Vector3();
/** 矢印を (x, y, z) から (dx, dy, dz) の向き・長さで置く(3次元の好きな向き) */
export function aimArrow(g: THREE.Group, x: number, y: number, z: number, dx: number, dy: number, dz: number) {
  const a = Math.hypot(dx, dy, dz);
  g.visible = a > 0.04;
  if (!g.visible) return;
  g.position.set(x, y, z);
  g.quaternion.setFromUnitVectors(UP, DIR.set(dx / a, dy / a, dz / a));
  const shaft = g.getObjectByName('shaft')!;
  const head = g.getObjectByName('head')!;
  const sl = Math.max(0.01, a - 0.26);
  shaft.scale.y = sl;
  shaft.position.y = sl / 2;
  head.position.y = sl + 0.13;
}
