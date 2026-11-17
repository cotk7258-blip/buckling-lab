import { useEffect, useRef, useState } from 'react';
import { solveColumn } from '../physics/column.ts';
import { dohshiOld, eurocode } from '../physics/curves.ts';
import { plateStrength, plateWinter } from '../physics/plate.ts';
import { edgeParts, edgeYieldMoment, etaFromImp, idealColumn, idealPlate, perry } from '../physics/theory.ts';
import { Tex } from '../ui/Tex.tsx';
import { Legend, Plot } from './Plot.tsx';
import { C, Fig, Knob, Seg, useNarrow } from './ui.tsx';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const E = 200000;

/* ================= 図: 照査の流れ ================= */

function Node(props: { k: string; tex?: string; tone?: 'in' | 'mid' | 'out' }) {
  const t = props.tone ?? 'mid';
  const cls = t === 'in' ? 'border-studio-600 bg-studio-800' : t === 'out' ? 'border-comp bg-comp text-white' : 'border-studio-600 bg-studio-900';
  return (
    <div className={`min-w-0 rounded-lg border-2 px-2 py-1.5 text-center ${cls}`}>
      <p className="text-[11px] font-bold leading-tight opacity-80">{props.k}</p>
      {props.tex && (
        <div className="overflow-x-auto text-sm">
          <Tex>{props.tex}</Tex>
        </div>
      )}
    </div>
  );
}
const Arrow = () => <span className="self-center text-lg font-bold text-ink-dim">→</span>;

export function FigFlow({ onJump }: { onJump?: (id: string) => void }) {
  const row = (no: string, title: string, id: string, nodes: React.ReactNode[]) => (
    <button onClick={() => onJump?.(id)} className="block w-full rounded-xl border border-studio-600 bg-studio-950/60 p-2 text-left">
      <p className="text-sm font-bold text-comp">
        {no} {title}
      </p>
      <div className="mt-1 flex flex-wrap items-stretch gap-1.5">
        {nodes.flatMap((n, i) => (i ? [<Arrow key={`a${i}`} />, n] : [n]))}
      </div>
    </button>
  );
  return (
    <Fig n="1" title="3つの照査のつながり(押すと、その節へ)">
      <div className="space-y-2">
        {row('①', '局部座屈(軸力のみ)', 'ov-local', [
          <Node key="1" k="板の寸法・材料" tex="b,\,t,\,k,\,\sigma_y" tone="in" />,
          <Node key="2" k="幅厚比パラメータ" tex="R" />,
          <Node key="3" k="低減率" tex="1.0\ /\ 0.5/R^2" />,
          <Node key="4" k="局部座屈の許容値" tex="\sigma_{cl}" tone="out" />,
        ])}
        <p className="pl-4 text-xs font-bold text-violet-700">↓ σcl/σy(使える断面の割合)を ② に掛ける</p>
        {row('②', '全体座屈(軸力のみ)', 'ov-global', [
          <Node key="1" k="細長比・材料" tex="l/r,\,\sigma_y" tone="in" />,
          <Node key="2" k="細長比パラメータ" tex="\lambda" />,
          <Node key="3" k="全体座屈応力" tex="\sigma_{cg}" />,
          <Node key="4" k="全体座屈の許容値" tex="\sigma_{cz}=\sigma_{cg}\tfrac{\sigma_{cl}}{\sigma_y}" tone="out" />,
        ])}
        <p className="pl-4 text-xs font-bold text-violet-700">↓ σcz を ③ の第1項の分母に使う</p>
        {row('③', '複合座屈(軸力+曲げ)', 'ov-comb', [
          <Node key="1" k="発生応力" tex="\sigma_c,\,\sigma_{bc}" tone="in" />,
          <Node key="2" k="付加曲げの係数" tex="\alpha" />,
          <Node key="3" k="使用割合の合計" tex="U" />,
          <Node key="4" k="安全率" tex="1/U" tone="out" />,
        ])}
      </div>
    </Fig>
  );
}

/* ================= 図: 曲がった柱の釣合い ================= */

export function FigColumnEq() {
  const [xr, setXr] = useState(0.35);
  const narrow = useNarrow();
  const W = narrow ? 360 : 560;
  const H = 300;
  const top = 34;
  const bot = H - 30;
  const L = bot - top;
  const cx = narrow ? 110 : 150;
  const A = 46;
  const yAt = (r: number) => A * Math.sin(Math.PI * r);
  const pts = Array.from({ length: 61 }, (_, i) => `${cx + yAt(i / 60)},${bot - (L * i) / 60}`).join(' ');
  const yy = bot - L * xr;
  const dx = yAt(xr);
  const tx = cx + 90;
  return (
    <Fig n="2" title="少し曲がった柱の、ある高さでの力の釣合い" caption="両端ピンの柱を、横にわずかに曲げた状態。高さ x の位置で輪切りにすると、上から押す力 P が腕の長さ y で柱を回そうとする(外力のモーメント)。柱はそれに逆らって曲げに抵抗する。曲がり具合 y″ は、山なりのカーブでマイナスになるので、抵抗は −EI·y″ と書く。">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="曲がった柱の釣合い">
        <line x1={cx} y1={top} x2={cx} y2={bot} stroke={C.gray} strokeDasharray="4 4" />
        <polyline points={pts} fill="none" stroke={C.blue} strokeWidth={5} strokeLinecap="round" />
        {[top, bot].map((y, i) => (
          <g key={i}>
            <polygon points={i ? `${cx},${y} ${cx - 10},${y + 16} ${cx + 10},${y + 16}` : `${cx},${y} ${cx - 10},${y - 16} ${cx + 10},${y - 16}`} fill={C.ink} />
          </g>
        ))}
        <line x1={cx} y1={4} x2={cx} y2={top - 18} stroke={C.red} strokeWidth={3} />
        <polygon points={`${cx - 6},${top - 22} ${cx + 6},${top - 22} ${cx},${top - 16}`} fill={C.red} />
        <text x={cx + 10} y={16} fontSize={14} fill={C.red} fontWeight={700}>
          P
        </text>
        <line x1={cx - 30} y1={yy} x2={cx + dx + 30} y2={yy} stroke={C.violet} strokeDasharray="3 3" />
        <line x1={cx} y1={yy} x2={cx + dx} y2={yy} stroke={C.orange} strokeWidth={3} />
        <circle cx={cx + dx} cy={yy} r={5} fill={C.orange} />
        <text x={cx + dx / 2} y={yy - 8} fontSize={13} fill={C.orange} fontWeight={700} textAnchor="middle">
          y
        </text>
        <text x={cx - 34} y={yy + 4} fontSize={13} fill={C.violet} fontWeight={700} textAnchor="end">
          x
        </text>
        <g fontSize={13} fill={C.ink}>
          <text x={tx} y={yy - 28} fontWeight={700} fill={C.orange}>
            外力が曲げようとする: M = P × y
          </text>
          <text x={tx} y={yy - 8} fontWeight={700} fill={C.blue}>
            柱が抵抗する: −EI × y″
          </text>
          <text x={tx} y={yy + 14} fill={C.dim}>
            ずれ y は最大の {Math.round((dx / A) * 100)}%。曲がり具合 y″ も最大の {Math.round((dx / A) * 100)}%
          </text>
          <text x={tx} y={yy + 34} fill={C.dim}>
            y が大きい所ほど、y″ も大きい(同じ形の波)
          </text>
        </g>
      </svg>
      <Knob label="輪切りにする高さ x / l" value={xr} min={0.05} max={0.95} step={0.01} show={xr.toFixed(2)} color={C.violet} onChange={setXr} />
    </Fig>
  );
}

/* ================= 図: 座屈の形と荷重 ================= */

export function FigModes() {
  const W = 520;
  const H = 230;
  const shape = (cx: number, n: number) =>
    Array.from({ length: 81 }, (_, i) => `${cx + 26 * Math.sin((n * Math.PI * i) / 80)},${H - 34 - (150 * i) / 80}`).join(' ');
  return (
    <Fig n="3" title="曲がったまま釣り合える形は、波の数 n ごとに決まる" caption="kl = nπ のときだけ、曲がった形でも釣り合える。荷重は n² に比例し、いちばん小さい n = 1 が座屈荷重になる。n = 2 以上は、途中を横から押さえない限り現れない。">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="座屈の形">
        {[1, 2, 3].map((n, i) => {
          const cx = 100 + i * 160;
          return (
            <g key={n}>
              <line x1={cx} y1={H - 34} x2={cx} y2={H - 184} stroke={C.gray} strokeDasharray="4 4" />
              <polyline points={shape(cx, n)} fill="none" stroke={n === 1 ? C.blue : C.gray} strokeWidth={4} />
              <text x={cx} y={H - 12} fontSize={14} textAnchor="middle" fontWeight={700} fill={n === 1 ? C.blue : C.dim}>
                n = {n}:{n === 1 ? ' Pe' : ` ${n * n}Pe`}
              </text>
              <text x={cx} y={24} fontSize={12} textAnchor="middle" fill={C.dim}>
                半波 {n} つ
              </text>
            </g>
          );
        })}
      </svg>
    </Fig>
  );
}

/* ================= 図: 板を帯の集まりとみなす ================= */

export function FigStrip() {
  const W = 520;
  const H = 230;
  const x0 = 60;
  const x1 = 380;
  const y0 = 40;
  const y1 = 190;
  const strips = 10;
  return (
    <Fig n="5" title="長い板を、押す向きに並んだ「帯(細い柱)」の集まりとみなす" caption="帯1本は、幅1・厚さ t の長方形断面の柱。波1つの長さ(≒ 板の幅 b)を柱の長さとみなすと、オイラー式から出発できる。ただし帯は隣とつながっていて横に縮めず(× 1/(1−ν²))、両側の縁が支えられている(× k)。">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="板と帯">
        <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#eef2f8" stroke={C.axis} />
        {Array.from({ length: strips - 1 }, (_, i) => (
          <line key={i} x1={x0} y1={y0 + ((i + 1) * (y1 - y0)) / strips} x2={x1} y2={y0 + ((i + 1) * (y1 - y0)) / strips} stroke={C.grid} />
        ))}
        <rect x={x0} y={y0 + (4 * (y1 - y0)) / strips} width={x1 - x0} height={(y1 - y0) / strips} fill={C.blue} opacity={0.35} />
        <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={C.green} strokeWidth={5} />
        <line x1={x0} y1={y1} x2={x1} y2={y1} stroke={C.green} strokeWidth={5} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <polygon points={`${x0 - 26},${y0 + 30 + i * 45} ${x0 - 6},${y0 + 38 + i * 45} ${x0 - 26},${y0 + 46 + i * 45}`} fill={C.red} />
            <polygon points={`${x1 + 26},${y0 + 30 + i * 45} ${x1 + 6},${y0 + 38 + i * 45} ${x1 + 26},${y0 + 46 + i * 45}`} fill={C.red} />
          </g>
        ))}
        <path
          d={Array.from({ length: 41 }, (_, i) => `${i ? 'L' : 'M'}${x0 + ((x1 - x0) * i) / 40},${y0 + (y1 - y0) / 2 - 18 * Math.sin((2 * Math.PI * i) / 40)}`).join(' ')}
          fill="none"
          stroke={C.red}
          strokeDasharray="5 4"
          strokeWidth={2}
        />
        <g fontSize={13} fontWeight={700}>
          <text x={x1 + 34} y={y0 + 4} fill={C.green}>
            縁: 支えられている
          </text>
          <text x={x1 + 34} y={y0 + 22} fill={C.green}>
            (係数 k に入る)
          </text>
          <text x={x1 + 34} y={y0 + 92} fill={C.blue}>
            帯1本 = 柱
          </text>
          <text x={x1 + 34} y={y0 + 110} fill={C.dim}>
            I = t³/12、A = t
          </text>
          <text x={x1 + 34} y={y0 + 128} fill={C.dim}>
            r = t/√12
          </text>
          <text x={(x0 + x1) / 2} y={y1 + 30} fill={C.red} textAnchor="middle">
            赤い破線: 波打ち(波1つの長さ ≒ b)
          </text>
          <line x1={x0 - 40} y1={y0} x2={x0 - 40} y2={y1} stroke={C.ink} />
          <text x={x0 - 46} y={(y0 + y1) / 2 + 4} fill={C.ink} textAnchor="end">
            b
          </text>
        </g>
      </svg>
    </Fig>
  );
}

/* ================= 図: λ の目盛り ================= */

export function FigLambdaRuler() {
  const [lr, setLr] = useState(80);
  const [sy, setSy] = useState(235);
  const base = Math.PI * Math.sqrt(E / sy);
  const lam = lr / base;
  const narrow = useNarrow();
  const W = narrow ? 360 : 600;
  const H = 120;
  const X = (v: number) => 20 + (Math.min(2.2, v) / 2.2) * (W - 40);
  return (
    <Fig n="6" title="λ は「σe = σy になる基準の柱」の何倍細長いか" caption="基準の柱の細長比は π√(E/σy)。鋼が強い(σy が大きい)ほど基準の柱は太く短くなり、同じ l/r でも λ は大きくなる。">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="λ の目盛り">
        <rect x={X(0)} y={34} width={X(1) - X(0)} height={26} fill="#fde7c8" />
        <rect x={X(1)} y={34} width={X(2.2) - X(1)} height={26} fill="#dbeafe" />
        <text x={(X(0) + X(1)) / 2} y={52} fontSize={13} textAnchor="middle" fontWeight={700} fill={C.orange}>
          λ &lt; 1: 先に降伏
        </text>
        <text x={(X(1) + X(2.2)) / 2} y={52} fontSize={13} textAnchor="middle" fontWeight={700} fill={C.blue}>
          λ &gt; 1: 先に弾性座屈
        </text>
        <line x1={X(0)} y1={74} x2={X(2.2)} y2={74} stroke={C.ink} strokeWidth={1.5} />
        {[0, 0.5, 1, 1.5, 2].map((v) => (
          <g key={v}>
            <line x1={X(v)} y1={70} x2={X(v)} y2={78} stroke={C.ink} />
            <text x={X(v)} y={94} fontSize={12} textAnchor="middle" fill={C.dim}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <circle cx={X(lam)} cy={74} r={8} fill={C.red} stroke="#fff" strokeWidth={2} />
        <text x={X(lam)} y={24} fontSize={14} textAnchor="middle" fontWeight={700} fill={C.red}>
          λ = {lam.toFixed(2)}
        </text>
        <text x={X(1)} y={112} fontSize={12} textAnchor="middle" fill={C.dim}>
          基準の柱(l/r = {base.toFixed(1)})
        </text>
      </svg>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Knob label="細長比 l/r" value={lr} min={10} max={200} step={1} show={String(lr)} color={C.red} onChange={setLr} />
        <Knob label="降伏応力 σy" value={sy} min={205} max={450} step={5} show={`${sy} N/mm²`} color={C.orange} onChange={setSy} />
      </div>
    </Fig>
  );
}

/* ================= 図: σy で割ると1本になる ================= */

const STEELS = [
  { sy: 235, name: 'σy = 235', color: C.blue },
  { sy: 355, name: 'σy = 355', color: C.violet },
  { sy: 450, name: 'σy = 450', color: C.orange },
];

export function FigCollapse({ n }: { n: string }) {
  const [norm, setNorm] = useState(false);
  const [t, setT] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const goal = norm ? 1 : 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((v) => {
        const nv = v + Math.sign(goal - v) * dt * 1.1;
        if ((goal - nv) * (goal - v) <= 0) return goal;
        raf.current = requestAnimationFrame(tick);
        return nv;
      });
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [norm]);
  const narrow = useNarrow();
  const W = narrow ? 360 : 600;
  const H = narrow ? 270 : 320;
  const fs = narrow ? 12 : 13;
  const m = { l: narrow ? 44 : 54, r: 12, t: 20, b: 42 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const ease = t * t * (3 - 2 * t);
  const sx = (lr: number, lam: number) => m.l + pw * ((1 - ease) * (lr / 250) + ease * (lam / 2.5));
  const sy = (sig: number, s: number) => H - m.b - ph * ((1 - ease) * (sig / 500) + ease * (s / 1.2));
  return (
    <Fig
      n={n}
      title="鋼の強さが違うと線も違う。σy で割ると、1本の線になる"
      caption="理想の柱の強さ = min(σy, σe)。左のままでは、鋼の種類ごとに別の線が要る。縦を σy で割り、横を λ = √(σy/σe) にすると、どの鋼も σcr/σy = min(1, 1/λ²) の同じ線に重なる。これが、座屈の式が「σy × 低減率(λ)」の形をしている理由。"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="鋼種による座屈曲線と無次元化">
        {[0, 100, 200, 300, 400, 500].map((v) => (
          <g key={`p${v}`} opacity={1 - ease}>
            <line x1={m.l} y1={H - m.b - ph * (v / 500)} x2={W - m.r} y2={H - m.b - ph * (v / 500)} stroke={C.grid} />
            <text x={m.l - 6} y={H - m.b - ph * (v / 500) + 4} fontSize={fs} textAnchor="end" fill={C.dim}>
              {v}
            </text>
          </g>
        ))}
        {[0, 50, 100, 150, 200, 250].map((v) => (
          <text key={`px${v}`} x={m.l + pw * (v / 250)} y={H - m.b + fs + 4} fontSize={fs} textAnchor="middle" fill={C.dim} opacity={1 - ease}>
            {v}
          </text>
        ))}
        {[0, 0.5, 1].map((v) => (
          <g key={`n${v}`} opacity={ease}>
            <line x1={m.l} y1={H - m.b - ph * (v / 1.2)} x2={W - m.r} y2={H - m.b - ph * (v / 1.2)} stroke={C.grid} />
            <text x={m.l - 6} y={H - m.b - ph * (v / 1.2) + 4} fontSize={fs} textAnchor="end" fill={C.dim}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 0.5, 1, 1.5, 2, 2.5].map((v) => (
          <text key={`nx${v}`} x={m.l + pw * (v / 2.5)} y={H - m.b + fs + 4} fontSize={fs} textAnchor="middle" fill={C.dim} opacity={ease}>
            {v}
          </text>
        ))}
        <line x1={m.l} y1={H - m.b} x2={W - m.r} y2={H - m.b} stroke={C.axis} />
        <line x1={m.l} y1={m.t - 8} x2={m.l} y2={H - m.b} stroke={C.axis} />
        <text x={m.l + 4} y={m.t - 8} fontSize={fs} fontWeight={700} fill={C.ink}>
          {ease < 0.5 ? '座屈する応力 σcr(N/mm²)' : '降伏に対する割合 σcr/σy'}
        </text>
        <text x={(m.l + W - m.r) / 2} y={H - 6} fontSize={fs} fontWeight={700} textAnchor="middle" fill={C.ink}>
          {ease < 0.5 ? '細長比 l/r' : '細長比パラメータ λ'}
        </text>
        {STEELS.map((s, k) => {
          const base = Math.PI * Math.sqrt(E / s.sy);
          const pts = Array.from({ length: 200 }, (_, i) => {
            const lr = 1 + (249 * i) / 199;
            const lam = lr / base;
            const sig = Math.min(s.sy, (Math.PI ** 2 * E) / (lr * lr));
            if (lam > 2.5 && ease > 0.98) return null;
            return `${sx(lr, Math.min(lam, 2.6)).toFixed(1)},${sy(sig, sig / s.sy).toFixed(1)}`;
          }).filter(Boolean);
          return <polyline key={k} points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={ease > 0.98 ? 3.5 - k * 0.8 : 2.6} opacity={ease > 0.98 && k > 0 ? 0.9 : 1} />;
        })}
        {ease < 0.3 &&
          STEELS.map((s, k) => (
            <text key={k} x={m.l + pw * 0.04} y={H - m.b - ph * (s.sy / 500) - 6} fontSize={fs} fontWeight={700} fill={s.color}>
              {s.name}
            </text>
          ))}
        {ease > 0.98 && (
          <text x={m.l + pw * (1.5 / 2.5)} y={H - m.b - ph * (0.62 / 1.2)} fontSize={fs} fontWeight={700} fill={C.ink}>
            3本が重なる: min(1, 1/λ²)
          </text>
        )}
      </svg>
      <Seg value={norm} options={[[false, 'そのまま(N/mm²)'], [true, 'σy で割る(無次元)']]} onChange={setNorm} />
    </Fig>
  );
}

/* ================= 図: 初期たわみの柱(ペリー・ロバートソン) ================= */

const IMPS: [number, string][] = [
  [0, 'なし'],
  [5000, 'L/5000'],
  [1000, 'L/1000'],
  [500, 'L/500'],
  [250, 'L/250'],
];

export function FigPerry({ n }: { n: string }) {
  const [imp, setImp] = useState(1000);
  const [lam, setLam] = useState(1);
  const [design, setDesign] = useState(false);
  const eOverFy = E / 235;
  const f = (l: number) => (imp ? perry(l, etaFromImp(l, imp, eOverFy)) : idealColumn(l));
  const s = f(lam);
  const eta = imp ? etaFromImp(lam, imp, eOverFy) : 0;
  const parts = edgeParts(s, lam, eta);
  let gap = 0;
  let gapAt = 1;
  for (let l = 0.05; l < 2.5; l += 0.01) {
    const d = idealColumn(l) - f(l);
    if (d > gap) {
      gap = d;
      gapAt = l;
    }
  }
  const seg = (w: number, color: string, label: string) => (
    <div className="flex h-full items-center justify-center overflow-hidden text-[11px] font-bold text-white" style={{ width: `${Math.max(0, w) * 100}%`, background: color }} title={label}>
      {w > 0.12 ? label : ''}
    </div>
  );
  return (
    <Fig
      n={n}
      title="初期たわみのある柱: 縁が降伏する平均応力(ペリー・ロバートソンの式)"
      caption="橙の破線が理想の柱、紫が初期たわみを入れた理論値。曲がりのない理想の柱との差は λ = 1 の付近でいちばん大きい。計算は σy = 235 N/mm²、E = 2.0×10⁵ N/mm²、長方形断面(c/r = √3)とした例。"
    >
      <Plot
        aria="ペリー・ロバートソンの式"
        x={[0, 2.5]}
        y={[0, 1.15]}
        xTicks={[0, 0.5, 1, 1.5, 2, 2.5]}
        yTicks={[0, 0.25, 0.5, 0.75, 1]}
        xLabel="細長比パラメータ λ"
        yLabel="σcr/σy"
        yFmt={(v) => v.toFixed(2)}
        series={[
          { f: idealColumn, color: C.orange, dash: '6 5', width: 2.2 },
          ...(design ? [{ f: dohshiOld, color: C.navy, width: 2.6 }] : []),
          { f, color: C.violet, width: 3 },
        ]}
        vlines={[[lam, C.red]]}
        dots={[
          [lam, s, C.red, 6],
          ...(imp ? ([[gapAt, f(gapAt), C.violet, 4]] as [number, number, string, number][]) : []),
        ]}
        notes={imp ? [[gapAt - 0.08, f(gapAt) - 0.12, `理想との差が最大(λ≒${gapAt.toFixed(2)})`, C.violet, 'end']] : []}
      />
      <Legend items={[[C.orange, '理想の柱 min(1, 1/λ²)', '6 5'], [C.violet, '初期たわみを入れた理論値'], ...(design ? ([[C.navy, '設計式(道示・平成24年版まで)']] as [string, string][]) : [])]} />
      <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-bold">初期たわみ v₀</p>
          <Seg value={imp} options={IMPS} onChange={setImp} />
          <Seg value={design} options={[[false, '理論だけ'], [true, '設計式も重ねる']]} onChange={setDesign} />
        </div>
        <Knob label="見る柱の細長比パラメータ λ" value={lam} min={0.1} max={2.4} step={0.01} show={lam.toFixed(2)} color={C.red} onChange={setLam} />
      </div>
      <div className="mt-3 rounded-lg border border-studio-600 p-2">
        <p className="text-sm font-bold">
          λ = {lam.toFixed(2)} の柱の縁の応力(限界のとき、合計 = σy)
        </p>
        <div className="mt-1 flex h-7 w-full overflow-hidden rounded">
          {seg(parts.axial, C.blue, `平均応力 ${pct(parts.axial)}`)}
          {seg(parts.bend, '#fb923c', `たわみの曲げ ${pct(parts.bend)}`)}
          {seg(parts.extra, C.orange, `増幅分 ${pct(parts.extra)}`)}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          平均応力 {pct(parts.axial)} + 初期たわみによる曲げ {pct(parts.bend)} + 軸力による増幅分 {pct(parts.extra)} = 100%(増幅の倍率 {Number.isFinite(parts.amp) ? parts.amp.toFixed(2) : '—'})。η = v₀c/r² = {eta.toFixed(3)}。
        </p>
      </div>
    </Fig>
  );
}

/* ================= 図: 計算の点の群れと設計式 ================= */

const BAND: [number, number, string][] = [
  [0.2, 2000, '#93c5fd'],
  [0.3, 1000, C.blue],
  [0.4, 1000, C.navy],
];

export function FigBand({ n }: { n: string }) {
  const [pts, setPts] = useState<[number, number, string][]>([]);
  const [ec, setEc] = useState(false);
  useEffect(() => {
    let alive = true;
    const lams = Array.from({ length: 19 }, (_, i) => 0.2 + i * 0.1);
    const jobs = lams.flatMap((l) => BAND.map((b) => [l, b] as const));
    let k = 0;
    const out: [number, number, string][] = [];
    const step = () => {
      if (!alive) return;
      const until = performance.now() + 12;
      while (k < jobs.length && performance.now() < until) {
        const [l, [r, imp, color]] = jobs[k++];
        const p = solveColumn({ lambda: l, resid: r, imp: 1 / imp, eOverFy: 200000 / 355, nStep: 200, nFlange: 31, nWeb: 9 });
        out.push([l, p.Pu, color]);
      }
      setPts([...out]);
      if (k < jobs.length) setTimeout(step, 0);
    };
    const id = setTimeout(step, 50);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);
  return (
    <Fig
      n={n}
      title="現実の柱の計算結果(点)と、設計式(線)"
      caption="点は、この教材の柱の計算(溶接 H形鋼、残留応力と初期たわみを入れた繊維モデル。映像3 と同じ計算)。設計式(紺)は、こうした結果の下側を通る。λ ≦ 0.2 で平ら、λ = 1 で2つの式がつながり、λ が大きいとオイラーの線に近づく。実際の設計式は、多数の座屈実験と解析に基づいて決められている。"
    >
      <Plot
        aria="計算の点と設計式"
        x={[0, 2.1]}
        y={[0, 1.15]}
        xTicks={[0, 0.2, 0.5, 1, 1.5, 2]}
        yTicks={[0, 0.25, 0.5, 0.75, 1]}
        xLabel="細長比パラメータ λ"
        yLabel="σcr/σy"
        yFmt={(v) => v.toFixed(2)}
        series={[
          { f: idealColumn, color: C.orange, dash: '6 5', width: 2 },
          ...(ec ? [{ f: (l: number) => eurocode(l, 0.34), color: '#db2777', width: 2, dash: '3 3' }, { f: (l: number) => eurocode(l, 0.49), color: '#9f1239', width: 2, dash: '3 3' }] : []),
          { f: dohshiOld, color: C.navy, width: 3 },
        ]}
        vlines={[
          [0.2, C.dim, 'λ=0.2'],
          [1, C.dim, 'λ=1.0'],
        ]}
        dots={pts.map(([x, y, c]) => [x, y, c, 4] as [number, number, string, number])}
      />
      <Legend
        items={[
          [C.orange, '理想の柱', '6 5'],
          [C.navy, '設計式(道示・平成24年版まで)'],
          ...(ec ? ([['#db2777', 'Eurocode 3 曲線 b', '3 3'], ['#9f1239', '同 曲線 c', '3 3']] as [string, string, string][]) : []),
        ]}
      />
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
        {BAND.map(([r, imp, c]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            残留応力 {r * 100}%・初期たわみ L/{imp}
          </span>
        ))}
        {pts.length < 57 && <span className="text-ink-dim">計算中… {pts.length}/57</span>}
      </p>
      <Seg value={ec} options={[[false, '道示だけ'], [true, 'Eurocode 3 も重ねる']]} onChange={setEc} />
    </Fig>
  );
}

/* ================= 図: 板の理想・現実・設計式 ================= */

export function FigPlate({ n }: { n: string }) {
  const [R, setR] = useState(1.4);
  const cross = 1.22;
  return (
    <Fig
      n={n}
      title="板: 理想の線、実際の強さの目安、設計式"
      caption="橙の破線が理想の板 min(1, 1/R²)。緑は、波打った後も縁で耐える分(有効幅)を見込んだ実際の強さの目安(Winter の式。Eurocode 3 の両縁支持板と同じ形)。紺が設計式。柱と違い、薄い板(R が大きい)では実際の強さが理想の線を上回る。設計式はその余力を当てにしない。"
    >
      <Plot
        aria="板の座屈曲線"
        x={[0, 2.5]}
        y={[0, 1.15]}
        xTicks={[0, 0.5, 0.7, 1, 1.5, 2, 2.5]}
        yTicks={[0, 0.25, 0.5, 0.75, 1]}
        xLabel="幅厚比パラメータ R"
        yLabel="σcr/σy"
        xFmt={(v) => (v === 0.7 ? '0.7' : String(v))}
        yFmt={(v) => v.toFixed(2)}
        bands={[
          [0.673, cross, 'rgba(225,29,72,0.07)', '理想より下'],
          [cross, 2.5, 'rgba(22,163,74,0.07)', '理想より上(余力)'],
        ]}
        series={[
          { f: idealPlate, color: C.orange, dash: '6 5', width: 2.2 },
          { f: plateWinter, color: C.green, width: 2.6 },
          { f: plateStrength, color: C.navy, width: 3 },
        ]}
        vlines={[[R, C.red]]}
        dots={[
          [R, plateWinter(R), C.green, 5],
          [R, plateStrength(R), C.navy, 5],
          [R, idealPlate(R), C.orange, 5],
        ]}
      />
      <Legend items={[[C.orange, '理想の板 min(1, 1/R²)', '6 5'], [C.green, '実際の強さの目安(有効幅)'], [C.navy, '設計式 0.5/R²(R > 0.7)']]} />
      <Knob label="見る板の R" value={R} min={0.3} max={2.4} step={0.01} show={R.toFixed(2)} color={C.red} onChange={setR} />
      <p className="text-sm">
        理想 <b className="num">{pct(idealPlate(R))}</b> ・ 実際の目安 <b className="num text-green-700">{pct(plateWinter(R))}</b> ・ 設計式 <b className="num" style={{ color: C.navy }}>{pct(plateStrength(R))}</b>
        {R > 0.7 && <span className="text-ink-dim">(設計式 = 理想の {pct(plateStrength(R) / idealPlate(R))})</span>}
      </p>
    </Fig>
  );
}

/* ================= 図: 軸力と曲げの相関 ================= */

export function FigInteraction({ n, initial = 3, point }: { n: string; initial?: 1 | 2 | 3; point?: [number, number] }) {
  const [step, setStep] = useState<1 | 2 | 3>(initial);
  const [lam, setLam] = useState(1.2);
  const [pb, setPb] = useState(0.8);
  const pe = 1 / (lam * lam);
  const pu = dohshiOld(lam);
  const designM = (nn: number) => (nn >= pu || nn >= 0.8 * pe ? 0 : pb * (1 - nn / pu) * (1 - nn / (0.8 * pe)));
  const curve = (g: (nn: number) => number, top: number) => Array.from({ length: 121 }, (_, i) => [g((top * i) / 120), (top * i) / 120] as [number, number]);
  const [n0, m0] = point ?? [0.18, 0.3];
  const U = n0 / pu + m0 / (pb * (1 - n0 / (0.8 * pe)));
  return (
    <Fig
      n={n}
      title="軸力と曲げ: 理論の形から、設計式へ"
      caption="縦は軸力、横は曲げ(どちらも σy に対する割合)。① 増幅を考えない足し算。② 縁の応力が降伏に達する条件に、軸力による増幅を入れた理論の形。③ 設計式: 軸力だけの端点を全体座屈の許容値 σcz に、曲げだけの端点を曲げの許容値に置き換え、σe を 0.8 倍して安全側にしたもの。ここでは局部座屈の低減なし(R ≦ 0.7)とした。"
    >
      <Plot
        aria="軸力と曲げの相関"
        x={[0, 1.1]}
        y={[0, 1.1]}
        xTicks={[0, 0.25, 0.5, 0.75, 1]}
        yTicks={[0, 0.25, 0.5, 0.75, 1]}
        xLabel="曲げ σbc/σy"
        yLabel="軸力 σc/σy"
        xFmt={(v) => v.toFixed(2)}
        yFmt={(v) => v.toFixed(2)}
        series={[
          { pts: [[0, 1], [1, 0]], color: C.gray, width: step === 1 ? 3 : 1.8, dash: step === 1 ? undefined : '5 4' },
          ...(step >= 2 ? [{ pts: curve((nn) => edgeYieldMoment(nn, pe), Math.min(1, pe)), color: C.orange, width: step === 2 ? 3 : 1.8, dash: step === 2 ? undefined : '5 4' }] : []),
          ...(step >= 3 ? [{ pts: curve(designM, Math.min(pu, 0.8 * pe)), color: C.violet, width: 3.2 }] : []),
        ]}
        dots={step === 3 ? [[m0, n0, C.ink, 6], [0, pu, C.violet, 5], [pb, 0, C.violet, 5]] : []}
        notes={
          step === 3
            ? [
                [0.03, pu + 0.04, `σcz/σy = ${pu.toFixed(2)}`, C.violet],
                [pb, 0.05, 'σb/σy', C.violet, 'middle'],
                [m0 + 0.03, n0 + 0.04, `U = ${U.toFixed(2)}`, C.ink],
              ]
            : []
        }
      />
      <Legend items={[[C.gray, '① 足し算だけ'], ...(step >= 2 ? ([[C.orange, '② 縁の降伏+増幅(理論の形)']] as [string, string][]) : []), ...(step >= 3 ? ([[C.violet, '③ 設計式(U = 1 の線)']] as [string, string][]) : [])]} />
      <Seg value={step} options={[[1, '① 足し算'], [2, '② 理論の形'], [3, '③ 設計式']]} onChange={setStep} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Knob label="柱の細長比パラメータ λ" value={lam} min={0.3} max={1.8} step={0.01} show={lam.toFixed(2)} color={C.violet} onChange={setLam} />
        <Knob label="曲げの許容値 σb/σy" value={pb} min={0.4} max={1} step={0.01} show={pb.toFixed(2)} color={C.violet} onChange={setPb} />
      </div>
    </Fig>
  );
}

/* ================= 図: 2回の割り引き(Q8) ================= */

export function FigBars({ n }: { n: string }) {
  const bars: [string, number, string][] = [
    ['降伏応力 σy(天井)', 250, '#64748b'],
    ['全体座屈応力 σcg', 200, C.blue],
    ['全体座屈の許容値 σcz', 120, C.red],
  ];
  const W = 520;
  const H = 210;
  const sc = 140 / 250;
  return (
    <Fig n={n} title="天井 σy から、2回割り引く(説明用の仮定値)" caption="σcg = 250 × 0.8(λ による低減)= 200。σcz = 200 × (150 ÷ 250)= 120。2回目に掛けているのは「使える断面の割合」で、安全率ではない。">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="2回の割り引き">
        {bars.map(([label, v, c], i) => {
          const x = 40 + i * 165;
          const h = v * sc;
          return (
            <g key={label}>
              <rect x={x} y={170 - h} width={90} height={h} fill={c} rx={3} />
              <text x={x + 45} y={162 - h} fontSize={16} fontWeight={700} textAnchor="middle" fill={C.ink}>
                {v}
              </text>
              <text x={x + 45} y={190} fontSize={12} textAnchor="middle" fill={C.ink}>
                {label}
              </text>
              {i > 0 && (
                <text x={x - 38} y={110} fontSize={12} fontWeight={700} textAnchor="middle" fill={C.violet}>
                  {i === 1 ? '× 0.8(λ)' : '× 150/250'}
                </text>
              )}
              {i > 0 && <text x={x - 38} y={128} fontSize={16} textAnchor="middle" fill={C.violet}>→</text>}
            </g>
          );
        })}
      </svg>
    </Fig>
  );
}

/* ================= 図: 低減率の2本の曲線(計算ツール・Q&A で使う) ================= */

export function CurvesPair({ lam, R, n }: { lam?: number; R?: number; n?: string }) {
  const mk = (title: string, xl: string, f: (v: number) => number, ideal: (v: number) => number, edges: number[], mark?: number) => (
    <div className="min-w-0">
      <p className="text-sm font-bold">{title}</p>
      <Plot
        aria={title}
        x={[0, 2]}
        y={[0, 1.15]}
        xTicks={[0, 0.5, 1, 1.5, 2]}
        yTicks={[0, 0.5, 1]}
        xLabel={xl}
        yLabel="低減率"
        yFmt={(v) => v.toFixed(1)}
        height={250}
        series={[
          { f: ideal, color: C.orange, dash: '6 5', width: 2 },
          { f, color: C.navy, width: 3 },
        ]}
        vlines={edges.map((e) => [e, C.dim, String(e)] as [number, string, string])}
        dots={mark !== undefined ? [[Math.min(2, mark), f(Math.min(2, mark)), C.red, 7]] : []}
      />
    </div>
  );
  const body = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {mk('全体座屈(柱): σcg/σy', '細長比パラメータ λ', dohshiOld, idealColumn, [0.2, 1], lam)}
        {mk('局部座屈(板): σcl/σy', '幅厚比パラメータ R', plateStrength, idealPlate, [0.7], R)}
      </div>
      <Legend items={[[C.navy, '設計式'], [C.orange, '弾性座屈 1/λ²・1/R²(上限 1.0)', '6 5']]} />
    </>
  );
  if (!n) return body;
  return (
    <Fig n={n} title="低減率の曲線" caption={lam !== undefined ? '赤い点が、いまの入力の位置。' : undefined}>
      {body}
    </Fig>
  );
}

