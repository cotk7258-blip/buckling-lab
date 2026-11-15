import { useEffect, useMemo, useRef, useState } from 'react';
import { solveColumn, viewAtLoad, dohshiOld } from '../physics/column.ts';
import type { ColumnPath } from '../physics/column.ts';
import { Stage3D, DEFL_AMP } from '../three/stage.ts';
import type { CameraPose } from '../three/stage.ts';
import { Section3D } from '../three/section.ts';
import { Tex } from '../ui/Tex.tsx';

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
}

const SCENES: SceneDef[] = [
  {
    kicker: '実験',
    head: () => '同じ2本の柱を、同じ力で押す',
    body: () =>
      '長さも太さも同じ H形鋼。左は傷ひとつない「理想の柱」。右は工場で溶接して作った「現実の柱」。先に折れるのは、どちらでしょう。',
    stress: false,
    target: () => 0,
    speed: 0.2,
    pose: { az: 24, el: 9, focus: 'both' },
    section: false,
  },
  {
    kicker: '透視',
    head: () => '現実の柱には、押す前から力が潜んでいる',
    body: () =>
      '応力が見える目に切り替えました。青は圧縮、オレンジは引張。溶接の熱が冷えて縮むとき、柱の中に力が閉じ込められます。これが「残留応力」。フランジの先端は、最初から押されています。',
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
      '理想の柱は、どこも同じ青。断面全体で均等に受けています。現実の柱は不公平。先端だけ、潜んでいた力の分が上乗せされて、もう金色の天井(降伏)のすぐ下です。',
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
    kicker: '連鎖',
    head: () => '赤が広がる。踏ん張りが落ちる。さらに曲がる',
    body: (c) =>
      `踏ん張り(曲げへの抵抗)は、先端ほどよく効きます。その先端から失うので、落ち方が急です。曲がると内側がさらに押され、赤が広がる。ドミノ倒しです。限界は降伏の ${pct(c.real.Pu)}。`,
    stress: true,
    target: (c) => c.real.Pu - 0.002,
    speed: 0.018,
    pose: { az: 30, el: 7, focus: 'real' },
    section: true,
  },
  {
    kicker: '座屈',
    head: (c) => `現実の柱が折れた。理論値の ${pct(c.real.Pu / c.ideal.Pu)}`,
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
      `傷のない柱は、理論どおりの力まで耐えてから座屈します。現実の柱はその ${pct(
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
  const stageRef = useRef<Stage3D | null>(null);
  // 毎フレーム読む値(React の再描画を待たずに使う)
  const live = useRef({ load: 0, target: 0, speed: 0.1, mix: 0, mixTarget: 0, ctx, auto: true, playing, slow, focusReal });
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
      stageRef.current?.setPose({ az: 24, el: 9, focus: 'both' });
    } else {
      const sc = SCENES[scene];
      L.auto = true;
      L.target = sc.target(ctx);
      L.speed = sc.speed;
      L.mixTarget = sc.stress ? 1 : 0;
      stageRef.current?.setPose(sc.pose);
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
    : '柱の細長さ、残留応力、初期たわみを変えると、折れ方と限界が変わります。細長い柱ほど、理想と現実の差は小さくなります。';
  const kicker = sc ? sc.kicker : '実験室';

  return (
    <div className="mt-1">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-3">
        {/* 3D の舞台。見出しのテロップは映像に重ねる */}
        <div className="relative overflow-hidden rounded-2xl border border-studio-600 bg-studio-950">
          <canvas ref={mainRef} className="block h-[37dvh] min-h-[280px] w-full lg:h-[72dvh]" />
          <ColumnLabel refEl={labelRefs[0]} name="理想の柱" load={hud.pI} buckled={hud.cI} color="#86efac" />
          <ColumnLabel refEl={labelRefs[1]} name="現実の柱" load={hud.pR} buckled={hud.cR} color="#e2e8f0" />
          <div
            key={scene}
            className="telop pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-studio-950 via-studio-950/85 to-transparent px-3 pb-2.5 pt-10 sm:px-5 sm:pb-4"
            aria-live="polite"
          >
            <p className="text-[11px] font-bold tracking-[0.25em] text-comp sm:text-xs">
              {String(scene + 1).padStart(2, '0')} — {kicker}
            </p>
            <p className="mt-0.5 border-l-4 border-comp pl-2.5 text-[19px] font-bold leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] sm:text-3xl">
              {head}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:gap-3">
          {/* 語り */}
          <p key={`b${scene}`} className="telop rounded-xl bg-studio-800/70 px-3 py-2 text-[14px] leading-relaxed text-ink sm:px-4 sm:py-3 sm:text-base lg:order-2">
            {body}
          </p>

          {/* 断面 */}
          <div
            className={`relative overflow-hidden rounded-2xl border border-studio-600 bg-studio-950 transition-opacity duration-700 lg:order-1 ${
              showSection ? 'opacity-100' : 'opacity-30'
            }`}
          >
            <canvas ref={secRef} className="block h-[21dvh] min-h-[170px] w-full lg:h-[36dvh]" />
            <div className="pointer-events-none absolute left-3 top-2">
              <p className="text-[11px] font-bold tracking-wider text-ink-dim">柱の中央を輪切り</p>
              <p className="text-sm font-bold">{focusReal ? '現実の柱' : '理想の柱'}の断面の応力</p>
            </div>
            <p className="pointer-events-none absolute right-3 top-2 text-right text-xs font-bold text-gold">
              金色の天井 = 降伏
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
              <Meter label="押す力" value={focusReal ? hud.pR : hud.pI} color="#38bdf8" marker={hud.limit} />
              <Meter label="踏ん張り Ie/I" value={hud.ie} color={hud.ie < 0.999 ? '#ff1f4b' : '#86efac'} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-ink-dim lg:order-3">
            <Legend />
            <span>たわみは {DEFL_AMP} 倍に誇張・横になぞると回り込めます</span>
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
            <div className="flex flex-1 items-center justify-center gap-1.5" aria-hidden>
              {Array.from({ length: LAB + 1 }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === scene ? 'w-6 bg-comp' : 'w-1.5 bg-studio-600'}`}
                />
              ))}
            </div>
            {isLab ? (
              <button onClick={() => go(0)} className="h-12 whitespace-nowrap rounded-xl border border-studio-600 px-4 text-sm font-bold">
                最初から見る
              </button>
            ) : (
              <button
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
                  style={{ ['--thumb' as string]: '#38bdf8' }}
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
                symbol="\bar{\lambda}"
                hint="「降伏」と「座屈」の勝負指標。1 より大きいと座屈が先。大きいほど細長い柱"
                value={params.lambda}
                min={0.2}
                max={2}
                step={0.05}
                show={params.lambda.toFixed(2)}
                color="#fbbf24"
                onChange={(v) => changeParam({ lambda: v })}
              />
              <Slider
                label="残留応力"
                symbol="\sigma_{rc}"
                hint="溶接で閉じ込められた力。押す前から先端にかかっている圧縮"
                value={params.resid}
                min={0}
                max={0.4}
                step={0.05}
                show={`${pct(params.resid)} σy`}
                color="#ff1f4b"
                onChange={(v) => changeParam({ resid: v })}
              />
              <Slider
                label="初期たわみ"
                symbol="v_0"
                hint="作ったときからある、わずかな曲がり"
                value={params.impIdx}
                min={0}
                max={IMP_CHOICES.length - 1}
                step={1}
                show={IMP_CHOICES[params.impIdx] ? `L/${IMP_CHOICES[params.impIdx]}` : 'なし'}
                color="#fb923c"
                onChange={(v) => changeParam({ impIdx: v })}
              />
              <p className="mt-2 text-xs text-ink-dim">
                柱の長さ <span className="num text-ink">{(real.Lmm / 1000).toFixed(1)} m</span>(断面 H-300×300×10×16)
              </p>
            </div>

            <div className="rounded-2xl border border-studio-600 bg-studio-900 p-4">
              <h3 className="text-base font-bold">この条件での限界</h3>
              <dl className="mt-2 space-y-2">
                <ResultRow label="理想の柱(理論値)" value={ideal.Pu} color="#86efac" />
                <ResultRow label="現実の柱" value={real.Pu} color="#e2e8f0" />
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

      <p className="mt-4 px-1 text-xs leading-relaxed text-ink-dim">
        計算の前提: 両端ピンの溶接 H形鋼(H-300×300×10×16)が弱軸まわりに座屈する場合。断面を繊維に分け(フランジ 41 本、ウェブ 15 本)、
        完全弾塑性、E = 2.0×10⁵ N/mm²、σy = 355 N/mm²。残留応力は板ごとに直線分布(フランジ先端とウェブ中央が圧縮、溶接部が引張)。
        たわみは正弦波の形とし、柱の中央の断面で力のつり合いを解く。柱の色は、各断面でその位置の軸力と曲げにつり合う応力を解いた値。
        理想の柱は、残留応力なし・初期たわみ L/1,000,000。
      </p>
    </div>
  );
}

/* ---------- 3D の上に重ねる表示 ---------- */

function ColumnLabel(props: {
  refEl: React.RefObject<HTMLDivElement | null>;
  name: string;
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
      <p className="text-sm font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-base" style={{ color: props.color }}>
        {props.name}
      </p>
      <p className="num text-xl font-bold leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-2xl">
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
      <span className="text-tens">引張</span>
      <span
        className="h-2 w-24 rounded-full"
        style={{ background: 'linear-gradient(90deg,#ffa24a,#b4530a 25%,#2a3a60 50%,#1d4ed8 75%,#5cd0ff 96%)' }}
      />
      <span className="text-comp">圧縮</span>
      <span className="ml-1 font-bold text-yield">■ 降伏</span>
    </span>
  );
}

function Meter(props: { label: string; value: number; color: string; marker?: number }) {
  const w = Math.max(0, Math.min(1, props.value)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] text-ink-dim">
        <span>
          {props.label}
          {props.marker !== undefined && <span className="ml-1 text-gold">┃いまの限界</span>}
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
    return <circle cx={X((path.v0 + st.v) / path.L)} cy={Y(st.P)} r={6} fill={color} stroke="#0a1224" strokeWidth={2} />;
  };
  return (
    <div className="rounded-2xl border border-studio-600 bg-studio-900 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-base font-bold">押す力と、たわみ</h3>
        <p className="text-sm">
          <span style={{ color: '#86efac' }}>● 理想の柱</span>
          <span className="ml-3" style={{ color: '#e2e8f0' }}>
            ● 現実の柱
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-1 block w-full" role="img" aria-label="荷重とたわみの関係">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={m.l} y1={Y(t)} x2={W - m.r} y2={Y(t)} stroke="#1b2a4d" strokeWidth={1} />
            <text x={m.l - 6} y={Y(t) + 4} fill="#9fb0d0" fontSize={12} textAnchor="end" className="num">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line x1={m.l} y1={Y(1)} x2={W - m.r} y2={Y(1)} stroke="#ff1f4b" strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={W - m.r - 4} y={Y(1) - 5} fill="#ff1f4b" fontSize={12} textAnchor="end">
          {narrow ? '降伏荷重 Py' : '降伏荷重 Py(全断面が降伏)'}
        </text>
        {ideal.Pe < yMax && Math.abs(ideal.Pe - 1) > 0.06 && (
          <>
            <line x1={m.l} y1={Y(ideal.Pe)} x2={W - m.r} y2={Y(ideal.Pe)} stroke="#fbbf24" strokeWidth={1.2} strokeDasharray="6 4" />
            <text x={W - m.r - 4} y={Y(ideal.Pe) - 5} fill="#fbbf24" fontSize={12} textAnchor="end">
              {narrow ? 'オイラー荷重 Pe' : 'オイラー荷重 Pe(弾性の理論値)'}
            </text>
          </>
        )}
        <polyline points={line(ideal)} fill="none" stroke="#86efac" strokeWidth={2.2} opacity={0.9} />
        <polyline points={line(real)} fill="none" stroke="#e2e8f0" strokeWidth={2.2} />
        {dot(ideal, '#86efac')}
        {dot(real, '#e2e8f0')}
        <text x={(W + m.l) / 2} y={Hh - 8} fill="#9fb0d0" fontSize={12} textAnchor="middle">
          {narrow ? '中央のたわみ → 右端で L/40' : '中央のたわみ(柱の長さ L に対する割合)→ 右端で L/40'}
        </text>
      </svg>
    </div>
  );
}

function Slider(props: {
  label: string;
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
          {props.label} <Tex>{props.symbol}</Tex>
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
