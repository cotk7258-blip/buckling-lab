import { useEffect, useMemo, useRef, useState } from 'react';
import { solveColumn, viewAtLoad, dohshiOld } from '../physics/column.ts';
import type { ColumnPath, ColumnView } from '../physics/column.ts';
import { C, stressColor } from '../ui/colors.ts';
import { Tex } from '../ui/Tex.tsx';

const E_OVER_FY = 200000 / 355; // E = 2.0×10^5 N/mm²、σy = 355 N/mm²(SM490Y 相当)
const IMP_CHOICES = [0, 5000, 2000, 1000, 500, 250]; // 初期たわみ L/n(0 は無し)
const AMP = 12; // たわみを絵の上で何倍に見せるか

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** 幅の狭い画面(スマホ)かどうか。図の中の字が小さくなりすぎないよう、図の作りを変える */
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

export default function Stage3() {
  const [lambda, setLambda] = useState(0.9);
  const [resid, setResid] = useState(0.3);
  const [impIdx, setImpIdx] = useState(3);
  const [load, setLoad] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);

  const ideal = useMemo(
    () => solveColumn({ lambda, resid: 0, imp: 0, eOverFy: E_OVER_FY }),
    [lambda],
  );
  const real = useMemo(() => {
    const n = IMP_CHOICES[impIdx];
    return solveColumn({ lambda, resid, imp: n ? 1 / n : 0, eOverFy: E_OVER_FY });
  }, [lambda, resid, impIdx]);

  const loadMax = Math.ceil((ideal.Pu + 0.1) * 100) / 100;
  const s = Math.min(load, loadMax);
  const vIdeal = viewAtLoad(ideal, s);
  const vReal = viewAtLoad(real, s);

  // 再生
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setLoad((p) => {
        const next = p + dt * (slow ? 0.015 : 0.09);
        if (next >= loadMax) {
          setPlaying(false);
          return loadMax;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, slow, loadMax]);

  const reset = () => {
    setPlaying(false);
    setLoad(0);
  };
  const changeParam = (fn: () => void) => {
    fn();
    reset();
  };

  const yieldedFrac = fracYielded(vReal);
  const idealLimit = Math.min(1, ideal.Pe);

  return (
    <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 space-y-4">
        <Narration
          s={s}
          real={real}
          vReal={vReal}
          vIdeal={vIdeal}
          yieldedFrac={yieldedFrac}
          idealLimit={idealLimit}
        />

        <div className="grid grid-cols-2 gap-3">
          <ColumnCard
            title="竹"
            sub="理想の弾性体(不整なし)"
            accent={C.ideal}
            path={ideal}
            view={vIdeal}
          />
          <ColumnCard
            title="現実の鋼"
            sub="溶接の残留応力+初期たわみ"
            accent={C.real}
            path={real}
            view={vReal}
          />
        </div>

        <div className="rounded-xl border border-studio-600 bg-studio-900 p-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (s >= loadMax) setLoad(0);
                setPlaying((p) => !p);
              }}
              className="h-11 min-w-20 whitespace-nowrap rounded-lg bg-comp px-3 text-base font-bold text-studio-950"
            >
              {playing ? '一時停止' : s >= loadMax ? 'もう一度' : '押す ▶'}
            </button>
            <button
              onClick={() => setSlow((v) => !v)}
              aria-pressed={slow}
              className={`h-11 whitespace-nowrap rounded-lg border px-3 text-sm font-bold ${
                slow ? 'border-gold bg-gold/15 text-gold' : 'border-studio-600 text-ink-dim'
              }`}
            >
              スロー
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setLoad((p) => Math.max(0, p - 0.005));
              }}
              className="h-11 w-11 rounded-lg border border-studio-600 text-lg"
              aria-label="1コマ戻す"
            >
              ◀
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setLoad((p) => Math.min(loadMax, p + 0.005));
              }}
              className="h-11 w-11 rounded-lg border border-studio-600 text-lg"
              aria-label="1コマ進める"
            >
              ▶
            </button>
            <button onClick={reset} className="ml-auto h-11 whitespace-nowrap rounded-lg border border-studio-600 px-3 text-sm text-ink-dim" aria-label="最初から">
              ↺ 0%
            </button>
          </div>
          <label className="mt-2 block">
            <span className="flex items-baseline justify-between text-sm text-ink-dim">
              <span>押す力(降伏荷重に対する割合)</span>
              <span className="num text-xl font-bold text-ink">{pct(s)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={loadMax}
              step={0.001}
              value={s}
              onChange={(e) => {
                setPlaying(false);
                setLoad(Number(e.target.value));
              }}
              style={{ ['--thumb' as string]: C.comp }}
              aria-label="押す力"
            />
          </label>
        </div>

        <LoadGraph ideal={ideal} real={real} vIdeal={vIdeal} vReal={vReal} />
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-studio-600 bg-studio-900 p-4">
          <h3 className="text-base font-bold">条件を変える</h3>
          <Slider
            label="細長比パラメータ"
            symbol="\bar{\lambda}"
            hint="「降伏」と「座屈」の勝負指標。1 より大きいと座屈が先"
            value={lambda}
            min={0.2}
            max={2}
            step={0.05}
            show={lambda.toFixed(2)}
            color={C.gold}
            onChange={(v) => changeParam(() => setLambda(v))}
          />
          <Slider
            label="残留応力"
            symbol="\sigma_{rc}"
            hint="溶接で閉じ込められた力。押す前から履いている下駄"
            value={resid}
            min={0}
            max={0.4}
            step={0.05}
            show={`${pct(resid)} σy`}
            color={C.yield}
            onChange={(v) => changeParam(() => setResid(v))}
          />
          <Slider
            label="初期たわみ"
            symbol="v_0"
            hint="作ったときからある、わずかな曲がり"
            value={impIdx}
            min={0}
            max={IMP_CHOICES.length - 1}
            step={1}
            show={IMP_CHOICES[impIdx] ? `L/${IMP_CHOICES[impIdx]}` : 'なし'}
            color={C.tens}
            onChange={(v) => changeParam(() => setImpIdx(v))}
          />
        </div>

        <div className="rounded-xl border border-studio-600 bg-studio-900 p-4">
          <h3 className="text-base font-bold">この条件での結果</h3>
          <dl className="mt-2 space-y-2">
            <ResultRow label="竹(理論値)" value={ideal.Pu} color={C.ideal} />
            <ResultRow label="現実の鋼" value={real.Pu} color={C.real} />
          </dl>
          <p className="mt-3 text-base">
            現実の鋼は理論値の{' '}
            <strong className="num text-2xl text-gold">{pct(real.Pu / ideal.Pu)}</strong>{' '}
            で限界。
          </p>
          <p className="mt-2 text-sm text-ink-dim">
            参考: 道路橋示方書(平成24年版まで)の設計曲線は{' '}
            <span className="num text-ink">{pct(dohshiOld(lambda))}</span>
            。設計曲線は、多くの実験・解析の下側に引いた線です。
          </p>
        </div>

        <div className="rounded-xl border border-studio-600 bg-studio-900 p-4">
          <h3 className="text-base font-bold">ドミノ倒しの式</h3>
          <div className="mt-2 overflow-x-auto text-lg">
            <Tex block>{String.raw`P_{cr} \approx \dfrac{\pi^2 E\, I_e}{L^2}`}</Tex>
          </div>
          <p className="text-sm text-ink-dim">
            降伏した(赤い)部分はもう踏ん張れない。残った健全な部分の{' '}
            <Tex>{'I_e'}</Tex>(断面の踏ん張りやすさ)だけで支えるので、赤が広がるほど限界が下がる。
            下がった限界に押す力が追いつくと、一気に曲がる。
          </p>
        </div>

        <p className="px-1 text-xs leading-relaxed text-ink-dim">
          計算の前提: 両端ピン。断面は溶接 H 形鋼を弱軸まわりに曲げたときのフランジ(幅方向に 61 本の繊維)。
          完全弾塑性、E = 2.0×10⁵ N/mm²、σy = 355 N/mm²。残留応力は先端が圧縮・溶接部が引張の直線分布。
          たわみは正弦波の形とし、柱の中央の断面で力のつり合いを解く。柱の色は中央の断面の状態から求めた表示用の近似。たわみは {AMP} 倍に誇張。
        </p>
      </aside>
    </div>
  );
}

function fracYielded(v: ColumnView): number {
  let n = 0;
  for (const y of v.step.yl) if (y) n++;
  return n / v.step.yl.length;
}

/* ---------- ナレーション ---------- */

function Narration(props: {
  s: number;
  real: ColumnPath;
  vReal: ColumnView;
  vIdeal: ColumnView;
  yieldedFrac: number;
  idealLimit: number;
}) {
  const { s, real, vReal, vIdeal, yieldedFrac, idealLimit } = props;
  let head: string;
  let body: string;
  let tone = C.comp;
  if (s <= 0.001) {
    head = '同じ太さ・同じ長さの2本を、同じ力で押します';
    body =
      '左は不整のない理想の柱「竹」。右は現実の鋼の柱。鋼は押す前から、断面の先端に圧縮の力(残留応力)が閉じ込められ、ほんの少し曲がっています。下の断面図の点線がその「下駄」です。';
  } else if (vIdeal.collapsed) {
    head = '竹も限界。理論値どおりの座屈です';
    body = `理想の柱は理論値(降伏荷重の ${pct(idealLimit)})まで耐えました。現実の鋼はその ${pct(
      real.Pu / idealLimit,
    )} で先に限界。この差が、設計曲線が理論の線より下に引かれる理由です。`;
    tone = C.gold;
  } else if (vReal.collapsed) {
    head = `鋼が先に座屈しました(降伏荷重の ${pct(real.Pu)})`;
    body =
      '赤い部分が広がって踏ん張りが落ち、曲がりが曲がりを呼ぶドミノ倒しになりました。竹はまだまっすぐ耐えています。';
    tone = C.yield;
  } else if (yieldedFrac > 0) {
    head = `平均の応力はまだ降伏の ${pct(s)}。なのに、先端が赤く降伏`;
    body = `下駄(残留応力)と曲げの分が足され、断面の ${pct(
      yieldedFrac,
    )} が先に降伏しました。赤い部分はもう踏ん張れません。踏ん張りやすさは元の ${pct(
      vReal.step.ieRatio,
    )} に。スローやコマ送りで赤の広がりを追ってください。`;
    tone = C.yield;
  } else {
    head = 'まだ2本とも弾性。ただし鋼の断面は不公平';
    body =
      '竹は断面のどこも同じ応力。鋼は先端だけ、下駄の分と曲げの分が上乗せされて、降伏の線(金色)に早く近づいています。';
  }
  return (
    <div
      className="rounded-xl border-l-4 bg-studio-800/80 px-4 py-3"
      style={{ borderColor: tone }}
      aria-live="polite"
    >
      <p className="text-xs font-bold tracking-widest text-ink-dim">STAGE 3 — いま起きていること</p>
      <p className="mt-1 text-lg font-bold leading-snug sm:text-xl">{head}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-dim sm:text-base">{body}</p>
    </div>
  );
}

/* ---------- 柱と断面 ---------- */

function ColumnCard(props: {
  title: string;
  sub: string;
  accent: string;
  path: ColumnPath;
  view: ColumnView;
}) {
  const { title, sub, accent, path, view } = props;
  const st = view.step;
  const total = (path.v0 + st.v) / path.L;
  const limit = Math.min(1, path.Pe * st.ieRatio);
  const buckled = view.collapsed;
  return (
    <div
      className={`min-w-0 rounded-xl border bg-studio-900 p-2 sm:p-3 ${
        buckled ? 'border-yield' : 'border-studio-600'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold" style={{ color: accent }}>
          {title}
        </h3>
        {buckled && <span className="flash-yield rounded bg-yield px-2 py-0.5 text-xs font-bold text-white">座屈</span>}
      </div>
      <p className="text-xs text-ink-dim">{sub}</p>
      <ColumnFigure path={path} view={view} />
      <p className="mt-1 text-xs text-ink-dim">断面の応力(中央で輪切り。上=圧縮)</p>
      <SectionChart path={path} view={view} />
      <div className="mt-2 space-y-2">
        <Gauge
          label="いまの荷重"
          value={st.P}
          color={C.comp}
          marker={limit}
          markerLabel="いまの踏ん張りでの座屈限界"
        />
        <Gauge label="踏ん張り Ie/I" value={st.ieRatio} color={st.ieRatio < 0.999 ? C.yield : C.ideal} />
        <p className="num text-xs text-ink-dim">
          中央のたわみ {total < 1e-5 ? 'ほぼ 0' : `L/${Math.round(1 / total).toLocaleString()}`}
        </p>
      </div>
    </div>
  );
}

function ColumnFigure({ path, view }: { path: ColumnPath; view: ColumnView }) {
  const W = 160;
  const top = 46;
  const H = 230;
  const cx = W / 2;
  const NX = 26;
  const NZ = 9;
  const st = view.step;
  const thick = Math.max(6, Math.min(64, H / path.L));
  const total = (path.v0 + st.v) / path.L;
  const dMax = Math.min(0.3 * H, AMP * total * H);
  const xAt = (xi: number) => cx + dMax * Math.sin(Math.PI * xi);
  const n = path.z.length;
  const cells = [];
  for (let j = 0; j < NX; j++) {
    const x0 = j / NX;
    const x1 = (j + 1) / NX;
    const sn = Math.sin(Math.PI * (j + 0.5) / NX);
    for (let k = 0; k < NZ; k++) {
      const z = (k + 0.5) / NZ - 0.5;
      const fi = Math.min(n - 1, Math.floor((z + 0.5) * n));
      // 中央から離れた断面: 軸力 P と曲げ P·(v0+v)·sin から弾性で見積もり、±σy で頭打ち
      const est = Math.max(-1, Math.min(1, st.P * (1 + 12 * (path.v0 + st.v) * sn * z) + path.sigR[fi]));
      // 中央の近くは解いた値(塑性の履歴を含む)へなめらかに寄せる
      const t = Math.max(0, Math.min(1, (sn - 0.8) / 0.19));
      const wt = t * t * (3 - 2 * t);
      const sg = est + (st.sig[fi] - est) * wt;
      // z>0 が曲がりの内側(左)
      const a = -(k / NZ - 0.5) * thick;
      const b = -((k + 1) / NZ - 0.5) * thick;
      const y0 = top + x0 * H;
      const y1 = top + x1 * H;
      cells.push(
        <polygon
          key={`${j}-${k}`}
          points={`${xAt(x0) + a},${y0} ${xAt(x0) + b},${y0} ${xAt(x1) + b},${y1 + 0.4} ${xAt(x1) + a},${y1 + 0.4}`}
          fill={stressColor(sg)}
        />,
      );
    }
  }
  const arrow = 10 + 26 * Math.min(1.1, st.P);
  return (
    <svg viewBox={`0 0 ${W} 300`} className="mx-auto block w-full max-w-[220px]" role="img" aria-label="柱の変形と応力">
      {/* 荷重の矢印 */}
      <line x1={cx} y1={top - 8 - arrow} x2={cx} y2={top - 10} stroke={C.ink} strokeWidth={3} />
      <polygon points={`${cx - 6},${top - 12} ${cx + 6},${top - 12} ${cx},${top - 3}`} fill={C.ink} />
      <text x={cx + 10} y={top - 16} fill={C.ink} fontSize={13} className="num">
        P = {pct(st.P)}
      </text>
      {/* まっすぐの位置 */}
      <line x1={cx} y1={top} x2={cx} y2={top + H} stroke={C.dim} strokeWidth={0.6} strokeDasharray="3 4" />
      {cells}
      {/* 輪切りの位置 */}
      <line
        x1={xAt(0.5) - thick / 2 - 8}
        y1={top + H / 2}
        x2={xAt(0.5) + thick / 2 + 8}
        y2={top + H / 2}
        stroke={C.gold}
        strokeWidth={1.2}
        strokeDasharray="2 2"
      />
      {/* 支点(下: ピン、上: ピン+ローラー) */}
      <circle cx={cx} cy={top} r={3.5} fill="#0a1224" stroke={C.ink} strokeWidth={1.2} />
      <polygon points={`${cx},${top + H} ${cx - 12},${top + H + 16} ${cx + 12},${top + H + 16}`} fill="none" stroke={C.ink} strokeWidth={1.4} />
      <circle cx={cx} cy={top + H} r={3.5} fill="#0a1224" stroke={C.ink} strokeWidth={1.2} />
      <line x1={cx - 22} y1={top + H + 17} x2={cx + 22} y2={top + H + 17} stroke={C.ink} strokeWidth={1.4} />
    </svg>
  );
}

function SectionChart({ path, view }: { path: ColumnPath; view: ColumnView }) {
  const narrow = useNarrow();
  const W = narrow ? 170 : 300;
  const Hh = narrow ? 148 : 174;
  const x0 = narrow ? 4 : 12;
  const x1 = W - x0;
  const y0 = narrow ? 76 : 92; // 応力 0
  const sc = narrow ? 52 : 62; // σy あたりの高さ
  const n = path.z.length;
  const bw = (x1 - x0) / n;
  const st = view.step;
  const X = (z: number) => (x0 + x1) / 2 - z * (x1 - x0); // z>0(内側)を左に
  const bars = [];
  for (let i = 0; i < n; i++) {
    const sg = st.sig[i];
    const h = Math.abs(sg) * sc;
    bars.push(
      <rect
        key={i}
        x={X(path.z[i]) - bw / 2}
        y={sg >= 0 ? y0 - h : y0}
        width={bw + 0.3}
        height={Math.max(0.5, h)}
        fill={stressColor(sg)}
        className={st.yl[i] ? 'flash-yield' : undefined}
      />,
    );
  }
  const resid = Array.from(path.z, (z, i) => `${X(z)},${y0 - path.sigR[i] * sc}`).join(' ');
  const hasResid = path.params.resid > 0;
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="block w-full" role="img" aria-label="断面の応力分布">
      <line x1={x0} y1={y0 - sc} x2={x1} y2={y0 - sc} stroke={C.gold} strokeWidth={1.2} strokeDasharray="5 3" />
      <text x={x0} y={y0 - sc - 5} fill={C.gold} fontSize={12}>
        {narrow ? '降伏 σy' : '降伏 σy(ここで頭打ち)'}
      </text>
      {bars}
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={C.dim} strokeWidth={0.8} />
      {hasResid && (
        <polyline points={resid} fill="none" stroke={C.ink} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.85} />
      )}
      {/* 平均応力 */}
      <line x1={x0} y1={y0 - st.P * sc} x2={x1} y2={y0 - st.P * sc} stroke={C.ink} strokeWidth={0.8} opacity={0.6} />
      <text x={x0} y={Hh - 4} fill={C.dim} fontSize={11}>
        先端
      </text>
      <text x={(x0 + x1) / 2} y={Hh - 4} fill={C.dim} fontSize={11} textAnchor="middle">
        {hasResid ? (narrow ? '溶接部' : '溶接部(点線=残留応力)') : '中央'}
      </text>
      <text x={x1} y={Hh - 4} fill={C.dim} fontSize={11} textAnchor="end">
        先端
      </text>
    </svg>
  );
}

function Gauge(props: { label: string; value: number; color: string; marker?: number; markerLabel?: string }) {
  const { label, value, color, marker, markerLabel } = props;
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-ink-dim">
        <span>{label}</span>
        <span className="num text-sm font-bold text-ink">{pct(value)}</span>
      </div>
      <div className="relative mt-1 h-3 rounded-full bg-studio-700">
        <div className="h-3 rounded-full" style={{ width: `${w}%`, background: color }} />
        {marker !== undefined && (
          <div
            className="absolute -top-1 h-5 w-0.5 bg-gold"
            style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }}
            title={markerLabel}
          />
        )}
      </div>
      {markerLabel && (
        <p className="mt-0.5 text-[11px] text-gold">
          ┃ {markerLabel} <span className="num">{pct(marker ?? 0)}</span>
        </p>
      )}
    </div>
  );
}

/* ---------- 荷重とたわみのグラフ ---------- */

function LoadGraph(props: { ideal: ColumnPath; real: ColumnPath; vIdeal: ColumnView; vReal: ColumnView }) {
  const { ideal, real, vIdeal, vReal } = props;
  const narrow = useNarrow();
  const W = narrow ? 360 : 640;
  const Hh = narrow ? 250 : 260;
  const m = { l: 42, r: 8, t: 16, b: 36 };
  const xMax = 1 / 40;
  const yMax = Math.max(1.1, Math.min(1.3, ideal.Pu + 0.15));
  const X = (d: number) => m.l + (Math.min(d, xMax) / xMax) * (W - m.l - m.r);
  const Y = (p: number) => Hh - m.b - (p / yMax) * (Hh - m.t - m.b);
  const line = (path: ColumnPath) => {
    const pts: string[] = [];
    for (const s of path.steps) {
      const d = (path.v0 + s.v) / path.L;
      if (d > xMax) break;
      pts.push(`${X(d).toFixed(1)},${Y(s.P).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const dot = (path: ColumnPath, v: ColumnView, color: string) => {
    const d = (path.v0 + v.step.v) / path.L;
    return (
      <circle cx={X(d)} cy={Y(v.step.P)} r={6} fill={color} stroke="#0a1224" strokeWidth={2} />
    );
  };
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="rounded-xl border border-studio-600 bg-studio-900 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-base font-bold">押す力と、たわみ</h3>
        <p className="text-sm">
          <span style={{ color: C.ideal }}>● 竹</span>
          <span className="ml-3" style={{ color: C.real }}>
            ● 現実の鋼
          </span>
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-1 block w-full" role="img" aria-label="荷重とたわみの関係">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} y1={Y(t)} x2={W - m.r} y2={Y(t)} stroke="#1b2a4d" strokeWidth={1} />
            <text x={m.l - 6} y={Y(t) + 4} fill={C.dim} fontSize={12} textAnchor="end" className="num">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line x1={m.l} y1={Y(1)} x2={W - m.r} y2={Y(1)} stroke={C.yield} strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={W - m.r - 4} y={Y(1) - 5} fill={C.yield} fontSize={12} textAnchor="end">
          {narrow ? '降伏荷重 Py' : '降伏荷重 Py(全断面が降伏)'}
        </text>
        {ideal.Pe < yMax && Math.abs(ideal.Pe - 1) > 0.06 && (
          <>
            <line x1={m.l} y1={Y(ideal.Pe)} x2={W - m.r} y2={Y(ideal.Pe)} stroke={C.gold} strokeWidth={1.2} strokeDasharray="6 4" />
            <text x={W - m.r - 4} y={Y(ideal.Pe) - 5} fill={C.gold} fontSize={12} textAnchor="end">
              {narrow ? 'オイラー荷重 Pe' : 'オイラー荷重 Pe(弾性の理論値)'}
            </text>
          </>
        )}
        <polyline points={line(ideal)} fill="none" stroke={C.ideal} strokeWidth={2.2} opacity={0.9} />
        <polyline points={line(real)} fill="none" stroke={C.real} strokeWidth={2.2} />
        {dot(ideal, vIdeal, C.ideal)}
        {dot(real, vReal, C.real)}
        <text x={(W + m.l) / 2} y={Hh - 8} fill={C.dim} fontSize={12} textAnchor="middle">
          {narrow ? '中央のたわみ → 右端で L/40' : '中央のたわみ(柱の長さ L に対する割合)→ 右端で L/40'}
        </text>
      </svg>
    </div>
  );
}

/* ---------- 操作部品 ---------- */

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
