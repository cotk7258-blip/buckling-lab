import * as THREE from 'three';
import { writeStressColor } from './common.ts';

/** 説明用の場面: 鋼をバネの束に置きかえて、圧縮・引張・残留応力を見せる(模式図) */
export type ExplainMode = 'spring' | 'weld';

const N = 7;
const L0 = 2.4; // バネのもとの長さ
const GAP = 0.56;
const NEUTRAL = new THREE.Color('#8794a8');
const HOT = new THREE.Color('#ffd27a');
// 溶接の熱で縮もうとする量(真ん中ほど大きい)
const SHRINK = [0, 0.1, 0.55, 1, 0.55, 0.1, 0];
const SHRINK_MAX = 0.5;
const SHRINK_MEAN = SHRINK.reduce((a, b) => a + b, 0) / N;

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
/** 時刻 t が a〜b の間で 0→1 */
const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

function springGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const turns = 9;
  for (let i = 0; i <= 260; i++) {
    const u = i / 260;
    const a = u * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.17, u, Math.sin(a) * 0.17));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, 0.036, 8);
}

function arrow(color: string): THREE.Group {
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
function setArrow(g: THREE.Group, x: number, y0: number, len: number, z = 0) {
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

/** 文字の札(常にカメラを向く) */
function label(text: string, color: string): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.font = 'bold 76px "Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(1.5, 0.375, 1);
  return sp;
}

export class ExplainScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  /** いまの段階の説明(画面に重ねて出す) */
  caption = '';
  private springs: THREE.Mesh[] = [];
  private mats: THREE.MeshStandardMaterial[] = [];
  private top: THREE.Mesh;
  private topMat: THREE.MeshStandardMaterial;
  private big: THREE.Group;
  private small: THREE.Group[] = [];
  private ref: THREE.Line;
  private torch: THREE.Mesh;
  private torchLight: THREE.PointLight;
  private labels = new THREE.Group();
  private clock = 0;
  private col = new Float32Array(3);
  private c = new THREE.Color();

  constructor(env: THREE.Texture | null, bg: THREE.Color) {
    this.scene.background = bg;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.5;
    this.scene.add(new THREE.HemisphereLight('#a9c8ff', '#0a1020', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(3, 6, 7);
    this.scene.add(key);

    const plate = new THREE.MeshStandardMaterial({ color: '#1c2740', metalness: 0.7, roughness: 0.45 });
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(N * GAP + 0.3, 0.16, 0.8), plate);
    bottom.position.y = -0.08;
    this.scene.add(bottom);
    this.topMat = new THREE.MeshStandardMaterial({ color: '#2a3a60', metalness: 0.7, roughness: 0.45, transparent: true });
    this.top = new THREE.Mesh(new THREE.BoxGeometry(N * GAP + 0.3, 0.16, 0.8), this.topMat);
    this.scene.add(this.top);

    const geo = springGeometry();
    for (let i = 0; i < N; i++) {
      const m = new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.35 });
      const s = new THREE.Mesh(geo, m);
      s.position.x = (i - (N - 1) / 2) * GAP;
      this.scene.add(s);
      this.springs.push(s);
      this.mats.push(m);
      const a = arrow('#ffffff');
      this.scene.add(a);
      this.small.push(a);
    }
    this.big = arrow('#ffffff');
    this.big.scale.set(2.2, 1, 2.2);
    this.scene.add(this.big);

    // もとの長さの目印
    const w = (N * GAP) / 2 + 0.35;
    this.ref = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-w, L0, 0.42), new THREE.Vector3(w, L0, 0.42)]),
      new THREE.LineDashedMaterial({ color: '#fbbf24', dashSize: 0.09, gapSize: 0.06 }),
    );
    this.ref.computeLineDistances();
    this.scene.add(this.ref);

    // 溶接の場面だけ出す札
    const x0 = ((N - 1) / 2) * GAP;
    for (const [text, x] of [['先端', -x0], ['溶接部', 0], ['先端', x0]] as const) {
      const sp = label(text, text === '溶接部' ? '#ffd27a' : '#e8eefc');
      sp.position.set(x, -0.42, 0.5);
      this.labels.add(sp);
    }
    this.scene.add(this.labels);

    this.torch = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#fff4d0' }),
    );
    this.torchLight = new THREE.PointLight('#ffb347', 0, 5, 1.5);
    this.torch.add(this.torchLight);
    this.scene.add(this.torch);
  }

  reset() {
    this.clock = 0;
  }

  /** バネ i の長さ・色を決める。s は応力(圧縮を正、-1〜1)、hot は熱の強さ */
  private setSpring(i: number, len: number, s: number, hot: number) {
    this.springs[i].scale.y = len;
    writeStressColor(this.col, 0, s, Math.min(1, Math.abs(s) * 6), NEUTRAL);
    this.c.setRGB(this.col[0], this.col[1], this.col[2]).lerp(HOT, hot);
    const m = this.mats[i];
    m.color.copy(this.c);
    m.emissive.copy(this.c);
    m.emissiveIntensity = 0.25 + 0.55 * Math.min(1, Math.abs(s) * 2) + 1.4 * hot;
  }

  update(mode: ExplainMode, dt: number, aspect: number) {
    this.clock += dt;
    let topY = L0;
    let topOpacity = 1;
    this.torch.visible = false;
    this.torchLight.intensity = 0;
    for (const a of this.small) a.visible = false;
    this.big.visible = false;
    this.labels.visible = mode === 'weld';

    if (mode === 'spring') {
      const t = this.clock % 17;
      // 縮み(正)・伸び(負)の量
      let d = 0;
      if (t < 2.5) {
        this.caption = '鋼は、目に見えない小さなバネの束';
      } else if (t < 7) {
        d = 0.42 * (ramp(t, 2.5, 4) - ramp(t, 6.2, 7));
        this.caption = '押す → 縮んで、押し返す = 圧縮(青)';
      } else if (t < 11.5) {
        d = -0.42 * (ramp(t, 7, 8.5) - ramp(t, 10.7, 11.5));
        this.caption = '引く → 伸びて、引き戻す = 引張(オレンジ)';
      } else {
        d = 0.68 * (ramp(t, 11.5, 13.5) - ramp(t, 16.2, 17));
        this.caption = d > 0.62 ? '限界。これ以上は押し返せない = 降伏(赤)' : 'もっと強く押すと…';
      }
      topY = L0 - d;
      const s = Math.max(-1, Math.min(1, d / 0.64));
      for (let i = 0; i < N; i++) this.setSpring(i, topY, s, 0);
      // 外から押す・引く力
      if (d > 0) setArrow(this.big, 0, topY + 0.1 + 0.5 + d * 1.6, -(0.5 + d * 1.6));
      else if (d < 0) setArrow(this.big, 0, topY + 0.1, 0.5 - d * 1.6);
    } else {
      const t = this.clock % 23;
      const heat = ramp(t, 2.5, 5) - ramp(t, 6.5, 9.5);
      const cool = ramp(t, 6.5, 9.5); // 縮みの進み
      const join = ramp(t, 11.5, 14); // つなげる
      const free = ramp(t, 6.2, 7.2) * (1 - join); // 切り離して見せている度合い
      const Lf = L0 - SHRINK_MEAN * SHRINK_MAX;
      topY = L0 + 0.32 * free - (L0 - Lf) * join;
      topOpacity = 1 - 0.7 * free;
      if (t < 2.5) this.caption = 'フランジをバネ7本で表す。真ん中が溶接される所';
      else if (t < 6.5) this.caption = '溶接。真ん中だけが、溶けるほど熱くなる';
      else if (t < 11.5) this.caption = '冷えると縮む。切り離せたなら、真ん中だけ短くなる';
      else if (t < 15) this.caption = 'でも鋼はひとつながり。同じ長さにそろえられる';
      else this.caption = '真ん中は引き伸ばされ(引張)、先端は押し縮められる(圧縮)';
      for (let i = 0; i < N; i++) {
        const nat = L0 - SHRINK[i] * SHRINK_MAX * cool;
        const len = nat + (Lf - nat) * join;
        // 自然な長さより長ければ引張(負)、短ければ圧縮(正)
        const s = (-(len - nat) / (SHRINK_MAX * (1 - SHRINK_MEAN))) * 0.85;
        this.setSpring(i, len, s, heat * SHRINK[i]);
        if (t >= 15) {
          const k = ramp(t, 15, 16);
          const x = this.springs[i].position.x;
          // 引っ張られたバネは板を下へ引き、押されたバネは板を上へ押す
          if (s < -0.05) setArrow(this.small[i], x, topY + 0.08 + 0.9 * -s * k + 0.3, -(0.9 * -s * k + 0.3), 0.45);
          else if (s > 0.05) setArrow(this.small[i], x, topY + 0.08, (1.6 * s * k + 0.3), 0.45);
          const m = (this.small[i].getObjectByName('head') as THREE.Mesh).material as THREE.MeshStandardMaterial;
          m.color.set(s < 0 ? '#ffa24a' : '#5cd0ff');
          m.emissive.copy(m.color);
        }
      }
      if (t > 2.5 && t < 5.2) {
        this.torch.visible = true;
        this.torch.position.set(0, ((t - 2.5) / 2.7) * L0, 0.25);
        this.torchLight.intensity = 8;
      }
    }
    this.top.position.y = topY + 0.08;
    this.topMat.opacity = topOpacity;

    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = Math.max(2.95 / tan, 2.45 / (tan * aspect));
    const az = THREE.MathUtils.degToRad(14);
    const el = THREE.MathUtils.degToRad(12);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(dist * Math.sin(az) * Math.cos(el), 1.3 + dist * Math.sin(el), dist * Math.cos(az) * Math.cos(el));
    this.camera.lookAt(0, 1.3, 0);
  }
}
