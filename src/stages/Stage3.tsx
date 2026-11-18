import { useEffect, useMemo, useRef, useState } from 'react';
import { solveColumn, viewAtLoad, dohshiOld } from '../physics/column.ts';
import type { ColumnPath } from '../physics/column.ts';
import { Stage3D, DEFL_AMP } from '../three/stage.ts';
import type { CameraPose } from '../three/stage.ts';
import { Section3D } from '../three/section.ts';
import { Tex } from '../ui/Tex.tsx';
import { ClipBar, ClipLabel, updateClip } from '../ui/Story.tsx';
import { Rich, Term } from '../ui/glossary.tsx';

const E_OVER_FY = 200000 / 355; // E = 2.0×10^5 N/mm²、σy = 355 N/mm²(SM490Y 相当)
const IMP_CHOICES = [0, 5000, 2000, 1000, 500, 250]; // 初期たわみ L/n(0 は無し)
const DEFAULTS = { lambda: 0.9, resid: 0.3, impIdx: 3 };

const pct = (x: number) => `${Math.round(x * 100)}%`;

interface Ctx {
  ideal: ColumnPath;
  real: ColumnPath;
  loadMax: number;
}

interface SceneDef {
  kicker: string;
  head: (c: Ctx) => string;
  body: (c: Ctx) => string;
  /** 応力の色で見るか */
  stress: boolean;
  /** この場面で押す力(P/Py)の行き先 */
  target: (c: Ctx) => number;
  /** 押す速さ(P/Py 毎秒) */
  speed: number;
  pose: CameraPose;
  /** 断面の表示を出すか */
  section: boolean;
  /** バネの束で説明する場面 */
  explain?: 'spring' | 'weld' | 'lever' | 'domino';
}

const SCENES: SceneDef[] = [
  {
    kicker: '実験',
    head: () => '同じ2本の柱を、同じ力で押す',
    body: () =>
      '長さも太さも同じ H形鋼。左は傷ひとつない「理想の柱」。右は工場で溶接して作った「現実の柱」。先に耐えられなくなるのは、どちらでしょう。',
    stress: false,
    target: () => 0,
    speed: 0.2,
    pose: { az: 24, el: 9, focus: 'both' },
    section: false,
  },
  {
    kicker: 'そもそも',
    head: () => '鋼の中は、バネの束だと思えばいい',
    body: () =>
      '鋼は硬く見えても、押せばわずかに縮み、引けばわずかに伸びます。縮んだ所は押し返し、伸びた所は引き戻す。この「中で踏ん張っている力」が応力です。押し返しているのが圧縮(青)、引き戻しているのが引張(オレンジ)。バネには限界があり、そこに達した状態が降伏(赤)です。',
    stress: false,
    target: () => 0,
    speed: 0.2,
    pose: { az: 24, el: 9, focus: 'both' },
    section: false,
    explain: 'spring',
  },
  {
    kicker: '溶接',
    head: () => '溶接が、柱の中に力を閉じ込める',
    body: () =>
      '溶接された所は、冷えるときに縮もうとします。でも鋼はひとつながりなので、そこだけ短くはなれません。溶接部は引き伸ばされたまま(引張)。まわりは、縮もうとする溶接部の道連れで押し縮められます(圧縮)。外からは誰も押していないので、引張と圧縮は必ず打ち消し合う。溶接部から遠い先端が、押される側になります。(バネの絵は、しくみを示す模式図です)',
    stress: false,
    target: () => 0,
    speed: 0.2,
    pose: { az: 24, el: 9, focus: 'both' },
    section: false,
    explain: 'weld',
  },
  {
    kicker: '透視',
    head: () => '現実の柱には、押す前から力が潜んでいる',
    body: () =>
      '応力が見える目に切り替えました。さっきのバネの色です。右の柱は、まだ押していないのに色がついています。ウェブとつないだ溶接部(フランジの中央)がオレンジの引張、フランジの先端が青の圧縮。これが「残留応力」です。右上の図は、断面のバネ1本ずつの応力の大きさです。',
    stress: true,
    target: () => 0,
    speed: 0.2,
    pose: { az: 32, el: 10, focus: 'real' },
    section: true,
  },
  {
    kicker: '載荷',
    head: (c) => `降伏の ${pct(c.real.Pfy * 0.85)} まで押す`,
    body: () =>
      '理想の柱は、どこも同じ青。断面全体で均等に受けています。現実の柱は不公平。先端だけ、潜んでいた力の分が上乗せされて、もう赤い天井(降伏)のすぐ下です。',
    stress: true,
    target: (c) => c.real.Pfy * 0.85,
    speed: 0.12,
    pose: { az: 20, el: 8, focus: 'both' },
    section: true,
  },
  {
    kicker: '異変',
    head: (c) => `まだ ${pct(c.real.Pfy)}。なのに、先端が降伏した`,
    body: () =>
      '柱を輪切りにして中をのぞきます。平均ではまだ余裕があるのに、H形の先端(曲がりの内側)が天井に届いて赤くなりました。赤い部分は、これ以上力を受け持てません。柱の「踏ん張り」が減り始めます。',
    stress: true,
    target: (c) => c.real.Pfy + 0.012,
    speed: 0.05,
    pose: { az: 40, el: 38, focus: 'realMid' },
    section: true,
  },
  {
    kicker: 'なぜ痛い',
    head: () => '踏ん張りは、端のバネほどよく効く',
    body: () =>
      '柱が曲がろうとすると、断面は傾こうとします。片側のバネは縮み、反対側は伸び、どちらも傾きを戻す向きに力を出す。これが曲げに対する「踏ん張り」です。端のバネは、変形が大きいので力が大きく、しかも中心から遠いのでテコがよく効きます。だから、先に降伏するのが端だというのは最悪の順番。7本のうち端の1本を失うだけで、踏ん張りは約4割減ります。(バネの絵は模式図です)',
    stress: false,
    target: (c) => c.real.Pfy + 0.012,
    speed: 0.05,
    pose: { az: 24, el: 9, focus: 'both' },
    section: false,
    explain: 'lever',
  },
  {
    kicker: 'なぜ連鎖',
    head: () => '曲がるほど、押す力が「曲げる力」に化ける',
    body: () =>
      '柱が少しでも曲がると、中央が力の通り道からずれます。このずれに押す力を掛けたものが、柱をさらに曲げようとする力です。踏ん張りが十分なら押し戻して止まります。でも踏ん張りが落ちると、曲がる → ずれが増える → 曲げる力が増える → さらに曲がる、の連鎖が止まりません。ドミノ倒しです。(模式図です)',
    stress: false,
    target: (c) => c.real.Pfy + 0.012,
    speed: 0.05,
    pose: { az: 24, el: 9, focus: 'both' },
    section: false,
    explain: 'domino',
  },
  {
    kicker: '連鎖',
    head: () => '赤が広がる。踏ん張りが落ちる。さらに曲がる',
    body: (c) =>
      `本物の柱に戻ります。いま見た2つが同時に起きています。先端が赤くなって踏ん張りが落ち、曲がりが増え、内側がさらに押されて赤が広がる。右上の「踏ん張り」の数字が落ちていくのを見てください。限界は降伏の ${pct(c.real.Pu)}。`,
    stress: true,
    target: (c) => c.real.Pu - 0.002,
    speed: 0.018,
    pose: { az: 30, el: 7, focus: 'real' },
    section: true,
  },
  {
    kicker: '座屈',
    head: (c) => `現実の柱が座屈した。理想の柱の ${pct(c.real.Pu / c.ideal.Pu)}`,
    body: () => '押す力に踏ん張りが追い越され、一気に曲がりました。理想の柱は、まだまっすぐ立っています。',
    stress: true,
    target: (c) => c.real.Pu + 0.08,
    speed: 0.03,
    pose: { az: 16, el: 9, focus: 'both' },
    section: true,
  },
  {
    kicker: '理論値',
    head: (c) => `理想の柱は ${pct(c.ideal.Pu)} まで耐えた`,
    body: (c) =>
      `傷のない柱は、材料の限界(降伏荷重、100%)まで耐えます。この長さでは、オイラーの座屈荷重(${pct(c.ideal.Pe)})より降伏の方が先に来るからです。現実の柱はその ${pct(
        c.real.Pu / c.ideal.Pu,
      )}。設計で使う曲線が理論の線より下に引かれているのは、この差のためです。`,
    stress: true,
    target: (c) => c.loadMax,
    speed: 0.06,
    pose: { az: 24, el: 9, focus: 'both' },
    section: true,
  },
];
const LAB = SCENES.length; // 最後は実験室

export default function Stage3() {
  const [scene, setScene] = useState(0);
  const [params, setParams] = useState(DEFAULTS);
  const [stressOn, setStressOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [focusReal, setFocusReal] = useState(true);
  const [hud, setHud] = useState({ s: 0, ie: 1, limit: 1, yf: 0, pR: 0, pI: 0, cR: false, cI: false });

  const isLab = scene === LAB;
  const ideal = useMemo(
    () => solveColumn({ lambda: params.lambda, resid: 0, imp: 0, eOverFy: E_OVER_FY }),
    [params.lambda],
  );
  const real = useMemo(() => {
    const n = IMP_CHOICES[params.impIdx];
    return solveColumn({ lambda: params.lambda, resid: params.resid, imp: n ? 1 / n : 0, eOverFy: E_OVER_FY });
  }, [params]);
  const loadMax = Math.ceil((ideal.Pu + 0.1) * 100) / 100;
  const ctx: Ctx = useMemo(() => ({ ideal, real, loadMax }), [ideal, real, loadMax]);

  const mainRef = useRef<HTMLCanvasElement>(null);
  const secRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const capRef = useRef<HTMLParagraphElement>(null);
  const stageRef = useRef<Stage3D | null>(null);
  // 毎フレーム読む値(React の再描画を待たずに使う)
  const live = useRef({ load: 0, from: 0, target: 0, speed: 0.1, mix: 0, mixTarget: 0, ctx, auto: true, playing, slow, focusReal });
  live.current.ctx = ctx;
  live.current.playing = playing;
  live.current.slow = slow;
  live.current.focusReal = focusReal;

  // 場面が変わったら、行き先・カメラ・見え方を切り替える
  useEffect(() => {
    const L = live.current;
    if (isLab) {
      L.auto = false;
      L.mixTarget = stressOn ? 1 : 0;
      stageRef.current?.setExplain(null);
      stageRef.current?.setPose({ az: 24, el: 9, focus: 'both' });
    } else {
      const sc = SCENES[scene];
      L.auto = true;
      L.from = L.load;
      L.target = sc.target(ctx);
      L.speed = sc.speed;
      L.mixTarget = sc.stress ? 1 : 0;
      stageRef.current?.setPose(sc.pose);
      stageRef.current?.setExplain(sc.explain ?? null);
    }
  }, [scene, isLab, ctx, stressOn]);

  useEffect(() => {
    stageRef.current?.setPaths([ideal, real]);
  }, [ideal, real]);

  // 3D の用意と、毎フレームの更新
  useEffect(() => {
    const stage = new Stage3D(mainRef.current!);
    const section = new Section3D(secRef.current!);
    stageRef.current = stage;
    stage.setPaths([live.current.ctx.ideal, live.current.ctx.real]);
    stage.setPose(SCENES[0].pose);
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let lastHud = '';
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 隠れているあいだ(「式と Q&A」を開いている間)は描かない
      if (!mainRef.current?.clientWidth) {
        raf = requestAnimationFrame(tick);
        return;
      }
      t += dt;
      const L = live.current;
      const c = L.ctx;
      if (L.auto) {
        const d = L.target - L.load;
        const stepMax = dt * (d < 0 ? 0.6 : L.speed);
        L.load += Math.max(-stepMax, Math.min(stepMax, d));
      } else if (L.playing) {
        L.load = Math.min(c.loadMax, L.load + dt * (L.slow ? 0.012 : 0.08));
      }
      L.load = Math.max(0, Math.min(c.loadMax, L.load));
      L.mix += (L.mixTarget - L.mix) * (1 - Math.exp(-dt * 3));
      const vI = viewAtLoad(c.ideal, L.load);
      const vR = viewAtLoad(c.real, L.load);
      stage.update([c.ideal, c.real], [vI, vR], L.mix, t, dt);
      const fp = L.focusReal ? c.real : c.ideal;
      const fv = L.focusReal ? vR : vI;
      section.update(fp, fv.step, t);
      labelRefs.forEach((r, i) => {
        const p = stage.labelPos(i);
        const el = r.current;
        if (!el) return;
        el.style.opacity = p ? '1' : '0';
        if (p) el.style.transform = `translate(-50%, 0) translate(${p.x}px, ${p.y}px)`;
      });
      if (capRef.current && capRef.current.textContent !== stage.caption) {
        capRef.current.textContent = stage.caption;
        capRef.current.style.opacity = stage.caption ? '1' : '0';
      }
      const h = {
        s: L.load,
        ie: fv.step.ieRatio,
        limit: Math.min(1, fp.Pe * fv.step.ieRatio),
        yf: fv.step.yieldFrac,
        pR: vR.step.P,
        pI: vI.step.P,
        cR: vR.collapsed,
        cI: vI.collapsed,
      };
      const key = `${h.s.toFixed(3)}|${h.ie.toFixed(3)}|${h.pR.toFixed(3)}|${h.pI.toFixed(3)}|${h.cR}|${h.cI}|${L.focusReal}`;
      if (key !== lastHud) {
        lastHud = key;
        setHud(h);
      }
      if (!L.auto && L.playing && L.load >= c.loadMax) setPlaying(false);
      // 場面の動きの進み具合: 説明用の場面はくり返しの周期、試験機は荷重が行き先に着くまで
      const ex = stage.explainClip();
      let clip: { p: number; done: boolean; loop: boolean } | null = null;
      if (ex) clip = ex;
      else if (L.auto) {
        const span = Math.abs(L.target - L.from);
        const left = Math.abs(L.target - L.load);
        clip = span < 0.003 ? { p: 1, done: true, loop: false } : { p: Math.min(1, 1 - left / span), done: left < 0.003, loop: false };
      }
      updateClip(mainRef.current?.closest('[data-shell]') ?? null, clip);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stage.dispose();
      section.dispose();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 場面の札を押したら、その場面を最初から
  const replay = () => {
    const L = live.current;
    if (stageRef.current?.explainClip()) stageRef.current.replayExplain();
    else if (L.auto) {
      L.load = Math.max(0, L.from);
    }
  };
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('scene-change', { detail: { scene, total: LAB + 1 } }));
  }, [scene]);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(LAB, n));
    if (next < LAB && params !== DEFAULTS) setParams(DEFAULTS);
    if (next === 0) live.current.load = 0;
    setPlaying(false);
    setFocusReal(true);
    setScene(next);
  };
  const setLoad = (v: number) => {
    setPlaying(false);
    live.current.load = v;
  };
  const changeParam = (p: Partial<typeof DEFAULTS>) => {
    setParams((old) => ({ ...old, ...p }));
    setLoad(0);
  };

  const sc = isLab ? null : SCENES[scene];
  const showSection = isLab || sc!.section;

  const head = sc ? sc.head(ctx) : '条件を変えて、自分で押してみる';
  const body = sc
    ? sc.body(ctx)
    : '柱の細長さ、残留応力、初期たわみを変えると、座屈のしかたと限界が変わります。理想と現実の差は、細長さが 1 のあたりでいちばん大きく、ずっと短い柱でも、ずっと長い柱でも小さくなります。';
  const kicker = sc ? sc.kicker : '実験室';

  return (
    <div className="mt-1" data-shell>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-3">
        {/* 3D の舞台。見出しのテロップは映像に重ねる */}
        <div className="relative overflow-hidden rounded-2xl border border-studio-600 bg-studio-950">
          <canvas ref={mainRef} className="block h-[37dvh] min-h-[280px] w-full lg:h-[72dvh]" />
          <ClipBar />
          <ColumnLabel refEl={labelRefs[0]} name="理想の柱" term="ideal" load={hud.pI} buckled={hud.cI} color="#16a34a" />
          <ColumnLabel refEl={labelRefs[1]} name="現実の柱" term="real" load={hud.pR} buckled={hud.cR} color="#1f2a44" />
          <p
            ref={capRef}
            className="pointer-events-none absolute inset-x-3 top-3 text-center text-base font-bold leading-snug text-ink drop-shadow-[0_2px_4px_rgba(255,255,255,0.95)] transition-opacity duration-300 sm:top-5 sm:text-2xl"
            style={{ opacity: 0 }}
          />
          <div
            key={scene}
            className="telop pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-studio-950 via-studio-950/85 to-transparent px-3 pb-2.5 pt-10 sm:px-5 sm:pb-4"
            aria-live="polite"
          >
            <p className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[0.25em] text-comp sm:text-xs">
              <span className="min-w-0 truncate">
                {String(scene + 1).padStart(2, '0')}
                <span className="opacity-60"> / {String(LAB + 1).padStart(2, '0')}</span> — {kicker}
              </span>
              <ClipLabel onReplay={replay} />
            </p>
            <p className="mt-0.5 border-l-4 border-comp pl-2.5 text-[19px] font-bold leading-snug drop-shadow-[0_2px_4px_rgba(255,255,255,0.95)] sm:text-3xl">
              {head}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:gap-3">
          {/* 語り */}
          <p key={`b${scene}`} className="telop rounded-xl bg-studio-800/70 px-3 py-2 text-[14px] leading-relaxed text-ink sm:px-4 sm:py-3 sm:text-base lg:order-2">
            <Rich text={body} />
          </p>

          {/* 断面 */}
          <div
            className={`relative overflow-hidden rounded-2xl border border-studio-600 bg-studio-950 transition-opacity duration-700 lg:order-1 ${
              showSection ? 'opacity-100' : 'opacity-30'
            }`}
          >
            <canvas ref={secRef} className="block h-[21dvh] min-h-[170px] w-full lg:h-[36dvh]" />
            <div className="pointer-events-none absolute left-3 top-2">
              <p className="text-[11px] font-bold tracking-wider text-ink-dim">
                <Term id="section">柱の中央を輪切り(図の見方)</Term>
              </p>
              <p className="text-sm font-bold">{focusReal ? '現実の柱' : '理想の柱'}の断面の応力</p>
            </div>
            <p className="pointer-events-none absolute right-3 top-2 text-right text-xs font-bold text-yield">
              <Term id="yield">赤い天井 = 降伏</Term>
            </p>
            {isLab && (
              <button
                onClick={() => setFocusReal((v) => !v)}
                className="absolute right-2 top-8 rounded-lg border border-studio-600 bg-studio-900/90 px-3 py-1.5 text-xs font-bold"
              >
                {focusReal ? '理想の柱を見る' : '現実の柱を見る'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-studio-700 bg-studio-900/60 px-3 py-2">
              <Meter label="押す力" term="load" value={focusReal ? hud.pR : hud.pI} color="#0284c7" marker={hud.limit} />
              <Meter label="残っている踏ん張り" term="ie" value={hud.ie} color={hud.ie < 0.999 ? '#e11d48' : '#16a34a'} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-ink-dim lg:order-3">
            <Legend />
            <span>
              <Term id="amp">たわみは {DEFL_AMP} 倍に誇張</Term>・横になぞると回り込めます
            </span>
          </div>

          {/* 進行(スマホでは画面の下に固定) */}
          <div className="sticky bottom-0 z-10 -mx-3 flex items-center gap-2 bg-studio-950/90 px-3 py-2 backdrop-blur lg:static lg:order-4 lg:mx-0 lg:bg-transparent lg:p-0">
            <button
              onClick={() => go(scene - 1)}
              disabled={scene === 0}
              className="h-12 whitespace-nowrap rounded-xl border border-studio-600 px-4 text-sm font-bold text-ink-dim disabled:opacity-30"
            >
              ◀ 戻る
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex items-center justify-center gap-1" aria-hidden>
                {Array.from({ length: LAB + 1 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === scene ? 'w-4 bg-comp' : i < scene ? 'w-1.5 bg-comp/50' : 'w-1.5 bg-studio-600'}`}
                  />
                ))}
              </div>
              <span className="num text-[11px] font-bold leading-none text-ink-dim">
                {scene + 1} / {LAB + 1} ・ {Math.round(((scene + 1) / (LAB + 1)) * 100)}%
              </span>
            </div>
            {isLab ? (
              <button onClick={() => go(0)} className="h-12 whitespace-nowrap rounded-xl border border-studio-600 px-4 text-sm font-bold">
                最初から見る
              </button>
            ) : (
              <button
                data-next
                onClick={() => go(scene + 1)}
                className="h-12 whitespace-nowrap rounded-xl bg-comp px-6 text-base font-bold text-studio-950"
              >
                {scene === LAB - 1 ? '実験室へ ▶' : '次へ ▶'}
              </button>
            )}
          </div>
        </div>
      </div>

      {isLab && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-studio-600 bg-studio-900 p-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (hud.s >= loadMax - 1e-6) live.current.load = 0;
                    setPlaying((p) => !p);
                  }}
                  className="h-11 min-w-20 whitespace-nowrap rounded-lg bg-comp px-3 text-base font-bold text-studio-950"
                >
                  {playing ? '一時停止' : hud.s >= loadMax - 1e-6 ? 'もう一度' : '押す ▶'}
                </button>
                <ToggleBtn on={slow} onClick={() => setSlow((v) => !v)} label="スロー" />
                <button onClick={() => setLoad(Math.max(0, live.current.load - 0.005))} className="h-11 w-11 rounded-lg border border-studio-600 text-lg" aria-label="1コマ戻す">
                  ◀
                </button>
                <button onClick={() => setLoad(Math.min(loadMax, live.current.load + 0.005))} className="h-11 w-11 rounded-lg border border-studio-600 text-lg" aria-label="1コマ進める">
                  ▶
                </button>
                <span className="ml-auto" />
                <ToggleBtn on={stressOn} onClick={() => setStressOn((v) => !v)} label="応力の色" />
              </div>
              <label className="mt-2 block">
                <span className="flex items-baseline justify-between text-sm text-ink-dim">
                  <span>押す力(降伏荷重に対する割合)</span>
                  <span className="num text-xl font-bold text-ink">{pct(hud.s)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={loadMax}
                  step={0.001}
                  value={Math.min(hud.s, loadMax)}
                  onChange={(e) => setLoad(Number(e.target.value))}
                  style={{ ['--thumb' as string]: '#0284c7' }}
                  aria-label="押す力"
                />
              </label>
            </div>
            <LoadGraph ideal={ideal} real={real} s={hud.s} />
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-studio-600 bg-studio-900 p-4">
              <h3 className="text-base font-bold">条件を変える</h3>
              <Slider
                label="細長比パラメータ"
                term="lambda"
                symbol="\bar{\lambda}"
                hint="「降伏」と「座屈」の勝負指標。1 より大きいと座屈が先。大きいほど細長い柱"
                value={params.lambda}
                min={0.2}
                max={2}
                step={0.05}
                show={params.lambda.toFixed(2)}
                color="#6d28d9"
                onChange={(v) => changeParam({ lambda: v })}
              />
              <Slider
                label="残留応力"
                term="resid"
                symbol="\sigma_{rc}"
                hint="溶接で閉じ込められた力。押す前から先端にかかっている圧縮"
                value={params.resid}
                min={0}
                max={0.4}
                step={0.05}
                show={`${pct(params.resid)} σy`}
                color="#e11d48"
                onChange={(v) => changeParam({ resid: v })}
              />
              <Slider
                label="初期たわみ"
                term="imp"
                symbol="v_0"
                hint="作ったときからある、わずかな曲がり"
                value={params.impIdx}
                min={0}
                max={IMP_CHOICES.length - 1}
                step={1}
                show={IMP_CHOICES[params.impIdx] ? `L/${IMP_CHOICES[params.impIdx]}` : 'なし'}
                color="#ea580c"
                onChange={(v) => changeParam({ impIdx: v })}
              />
              <p className="mt-2 text-xs text-ink-dim">
                柱の長さ <span className="num text-ink">{(real.Lmm / 1000).toFixed(1)} m</span>(断面 H-300×300×10×16)
              </p>
            </div>

            <div className="rounded-2xl border border-studio-600 bg-studio-900 p-4">
              <h3 className="text-base font-bold">この条件での限界</h3>
              <dl className="mt-2 space-y-2">
                <ResultRow label="理想の柱(理論値)" value={ideal.Pu} color="#16a34a" />
                <ResultRow label="現実の柱" value={real.Pu} color="#1f2a44" />
              </dl>
              <p className="mt-3 text-base">
                現実の柱は理論値の <strong className="num text-2xl text-gold">{pct(real.Pu / ideal.Pu)}</strong>
              </p>
              <p className="mt-2 text-sm text-ink-dim">
                参考: 道路橋示方書(平成24年版まで)の設計曲線は{' '}
                <span className="num text-ink">{pct(dohshiOld(params.lambda))}</span>
                。設計曲線は、多くの実験・解析の下側に引いた線です。
              </p>
            </div>

            <div className="rounded-2xl border border-studio-600 bg-studio-900 p-4">
              <h3 className="text-base font-bold">ドミノ倒しの式</h3>
              <div className="mt-2 overflow-x-auto text-lg">
                <Tex block>{String.raw`P_{cr} \approx \dfrac{\pi^2 E\, I_e}{L^2}`}</Tex>
              </div>
              <p className="text-sm text-ink-dim">
                降伏した(赤い)部分はもう踏ん張れない。残った健全な部分の <Tex>{'I_e'}</Tex>
                (断面の踏ん張りやすさ)だけで支えるので、赤が広がるほど限界が下がる。
              </p>
            </div>
          </div>
        </div>
      )}

      <details className="mt-4 px-1 text-xs leading-relaxed text-ink-dim">
        <summary className="cursor-pointer py-1 text-sm font-bold">計算の前提を見る</summary>
        両端ピンの溶接 H形鋼(H-300×300×10×16)が弱軸まわりに座屈する場合。断面を繊維に分け(フランジ 41 本、ウェブ 15 本)、
        完全弾塑性、E = 2.0×10⁵ N/mm²、σy = 355 N/mm²。残留応力は板ごとに直線分布(フランジ先端とウェブ中央が圧縮、溶接部が引張)。実際の溶接 H形鋼では、溶接部の引張は降伏点近くに達して狭い範囲に集中し、板の切り方によっては先端が引張になることもあります。ここでは仕組みを見やすくするため、大きさをそろえた直線分布に単純化しています。
        たわみは正弦波の形とし、柱の中央の断面で力のつり合いを解く。柱の色は、各断面でその位置の軸力と曲げにつり合う応力を解いた値。
        理想の柱は、残留応力なし・初期たわみ L/1,000,000。
      </details>
    </div>
  );
}

/* ---------- 3D の上に重ねる表示 ---------- */

function ColumnLabel(props: {
  refEl: React.RefObject<HTMLDivElement | null>;
  name: string;
  term: string;
  load: number;
  buckled: boolean;
  color: string;
}) {
  return (
    <div
      ref={props.refEl}
      className="pointer-events-none absolute left-0 top-0 whitespace-nowrap text-center transition-opacity duration-300"
      style={{ opacity: 0 }}
    >
      <p className="text-sm font-bold drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)] sm:text-base" style={{ color: props.color }}>
        <Term id={props.term}>{props.name}</Term>
      </p>
      <p className="num text-xl font-bold leading-tight drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)] sm:text-2xl">
        {pct(props.load)}
      </p>
      {props.buckled && (
        <span className="flash-yield mt-0.5 inline-block rounded bg-yield px-2 py-0.5 text-xs font-bold text-white">座屈</span>
      )}
    </div>
  );
}

function Legend() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-tens">
        <Term id="tens">引張</Term>
      </span>
      <span
        className="h-2 w-24 rounded-full"
        style={{ background: 'linear-gradient(90deg,#ea580c,#fdba74 25%,#b9c3d2 50%,#60a5fa 75%,#1d4ed8 96%)' }}
      />
      <span className="text-comp">
        <Term id="comp">圧縮</Term>
      </span>
      <span className="ml-1 font-bold text-yield">
        ■ <Term id="yield">降伏</Term>
      </span>
    </span>
  );
}

function Meter(props: { label: string; term: string; value: number; color: string; marker?: number }) {
  const w = Math.max(0, Math.min(1, props.value)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] text-ink-dim">
        <span>
          <Term id={props.term}>{props.label}</Term>
          {props.marker !== undefined && (
            <span className="ml-1.5 text-gold">
              <Term id="limit">┃いまの限界</Term>
            </span>
          )}
        </span>
        <span className="num text-sm font-bold text-ink">{pct(props.value)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-studio-700">
        <div className="h-2 rounded-full" style={{ width: `${w}%`, background: props.color }} />
        {props.marker !== undefined && (
          <div className="absolute -top-1 h-4 w-0.5 bg-gold" style={{ left: `${Math.max(0, Math.min(1, props.marker)) * 100}%` }} />
        )}
      </div>
    </div>
  );
}

function ToggleBtn(props: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={props.onClick}
      aria-pressed={props.on}
      className={`h-11 whitespace-nowrap rounded-lg border px-3 text-sm font-bold ${
        props.on ? 'border-gold bg-gold/15 text-gold' : 'border-studio-600 text-ink-dim'
      }`}
    >
      {props.label}
    </button>
  );
}

/* ---------- 実験室の部品 ---------- */

function useNarrow(): boolean {
  const q = '(max-width: 640px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

function LoadGraph(props: { ideal: ColumnPath; real: ColumnPath; s: number }) {
  const { ideal, real, s } = props;
  const narrow = useNarrow();
  const W = narrow ? 360 : 640;
  const Hh = narrow ? 240 : 250;
  const m = { l: 42, r: 8, t: 16, b: 36 };
  const xMax = 1 / 40;
  const yMax = Math.max(1.1, Math.min(1.3, ideal.Pu + 0.15));
  const X = (d: number) => m.l + (Math.min(d, xMax) / xMax) * (W - m.l - m.r);
  const Y = (p: number) => Hh - m.b - (p / yMax) * (Hh - m.t - m.b);
  const line = (path: ColumnPath) => {
    const pts: string[] = [];
    for (const st of path.steps) {
      const d = (path.v0 + st.v) / path.L;
      if (d > xMax) break;
      pts.push(`${X(d).toFixed(1)},${Y(st.P).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const dot = (path: ColumnPath, color: string) => {
    const st = viewAtLoad(path, s).step;
    return <circle cx={X((path.v0 + st.v) / path.L)} cy={Y(st.P)} r={6} fill={color} stroke="#ffffff" strokeWidth={2} />;
  };
  return (
    <div className="rounded-2xl border border-studio-600 bg-studio-900 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-base font-bold">押す力と、たわみ</h3>
        <p className="text-sm">
          <span style={{ color: '#16a34a' }}>● 理想の柱</span>
          <span className="ml-3" style={{ color: '#1f2a44' }}>
            ● 現実の柱
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-1 block w-full" role="img" aria-label="荷重とたわみの関係">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={m.l} y1={Y(t)} x2={W - m.r} y2={Y(t)} stroke="#d5dce8" strokeWidth={1} />
            <text x={m.l - 6} y={Y(t) + 4} fill="#64748b" fontSize={12} textAnchor="end" className="num">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line x1={m.l} y1={Y(1)} x2={W - m.r} y2={Y(1)} stroke="#e11d48" strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={W - m.r - 4} y={Y(1) - 5} fill="#e11d48" fontSize={12} textAnchor="end">
          {narrow ? '降伏荷重 Py' : '降伏荷重 Py(全断面が降伏)'}
        </text>
        {ideal.Pe < yMax && Math.abs(ideal.Pe - 1) > 0.06 && (
          <>
            <line x1={m.l} y1={Y(ideal.Pe)} x2={W - m.r} y2={Y(ideal.Pe)} stroke="#6d28d9" strokeWidth={1.2} strokeDasharray="6 4" />
            <text x={W - m.r - 4} y={Y(ideal.Pe) - 5} fill="#6d28d9" fontSize={12} textAnchor="end">
              {narrow ? 'オイラー荷重 Pe' : 'オイラー荷重 Pe(弾性の理論値)'}
            </text>
          </>
        )}
        <polyline points={line(ideal)} fill="none" stroke="#16a34a" strokeWidth={2.2} opacity={0.9} />
        <polyline points={line(real)} fill="none" stroke="#1f2a44" strokeWidth={2.2} />
        {dot(ideal, '#16a34a')}
        {dot(real, '#1f2a44')}
        <text x={(W + m.l) / 2} y={Hh - 8} fill="#64748b" fontSize={12} textAnchor="middle">
          {narrow ? '中央のたわみ → 右端で L/40' : '中央のたわみ(柱の長さ L に対する割合)→ 右端で L/40'}
        </text>
      </svg>
    </div>
  );
}

function Slider(props: {
  label: string;
  term: string;
  symbol: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show: string;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-base font-bold">
          <Term id={props.term}>{props.label}</Term> <Tex>{props.symbol}</Tex>
        </span>
        <span className="num text-lg font-bold" style={{ color: props.color }}>
          {props.show}
        </span>
      </span>
      <span className="block text-xs text-ink-dim">{props.hint}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{ ['--thumb' as string]: props.color }}
      />
    </label>
  );
}

function ResultRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <dt className="text-sm" style={{ color }}>
          {label}
        </dt>
        <dd className="num text-lg font-bold">降伏荷重の {pct(value)}</dd>
      </div>
      <div className="mt-1 h-2 rounded-full bg-studio-700">
        <div className="h-2 rounded-full" style={{ width: `${Math.min(1, value) * 100}%`, background: color }} />
      </div>
    </div>
  );
}
