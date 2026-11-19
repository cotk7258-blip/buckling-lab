import { useState } from 'react';
import { SUPPORTS, Stage2Show } from '../three/stage2.ts';
import type { Lab2, Support } from '../three/stage2.ts';
import { Card, LabSlider, Steps, StoryShell, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Tex } from '../ui/Tex.tsx';

const SIDE2: Record<number, React.ReactNode> = {
  1: (
    <Steps
      title="真ん中の綱引き"
      steps={[
        ['曲げる力', String.raw`P\times y`],
        ['戻す力', String.raw`EI\times\dfrac{1}{R}=\dfrac{\pi^2EI}{l^2}\times y`, 'd1-k'],
        ['くらべる', String.raw`P\quad\text{と}\quad \dfrac{\pi^2EI}{l^2}`],
        ['座屈荷重', String.raw`P_e=\dfrac{\pi^2EI}{l^2}`, 'd1-pe'],
      ]}
      note="どちらにも y が掛かるので、y では勝負がつかない。式の横の「導き方」で、1/R が y に比例する理由と π の出どころを読めます。"
    />
  ),
  2: <Steps title="長さの効き方" steps={[['座屈荷重', String.raw`P_e=\dfrac{\pi^2EI}{l^2}`, 'd1-pe'], ['長さ2倍なら', String.raw`\dfrac{1}{4}`]]} note="長さの2乗に反比例。3倍なら 1/9。" />,
  3: (
    <Steps
      title="支え方 → 有効座屈長 le"
      steps={[
        ['両端ピン', 'le = 1.0 l', 'd2-le'],
        ['片方固定・片方ピン', 'le ≒ 0.7 l'],
        ['両端固定', 'le = 0.5 l'],
        ['片持ち', 'le = 2.0 l'],
        ['応力で書くと', String.raw`\sigma_e=\dfrac{\pi^2E}{(l_e/r)^2}`, 'd2-s'],
      ]}
      note="σe = Pe ÷ 断面積。r = √(I/A) は断面二次半径。"
    />
  ),
};

const SCENES: SceneText[] = [
  {
    kicker: '現象',
    head: '細い棒は、ある力で突然曲がる',
    body: '細い棒を上から押すと、しばらくはまっすぐ耐えます。ところが、ある力に達した瞬間、突然横へ曲がる。これが座屈。その力を「座屈荷重」と呼びます。',
  },
  {
    kicker: '綱引き',
    head: '曲げる力と、戻す力の綱引き',
    body: '柱がもし少し曲がったら、真ん中に2つの力が生まれます。曲げる力 P × y と、戻す力 EI × 1/R。曲がりを大きくしても、2つは同じ割合で増えるので、勝負はつきません。決めるのは押す力 P。P を上げて、柱で決まる π²EI/l² に追いついた所が座屈荷重です。',
  },
  {
    kicker: '長さ',
    head: '長さが2倍なら、座屈する力は4分の1',
    body: '同じだけ横にずれても、長い棒のカーブはゆるく、戻す力が弱い。座屈荷重は長さの2乗に反比例します。2倍なら4分の1、3倍なら9分の1。',
  },
  {
    kicker: '支え方',
    head: '支え方で、強さは16倍も変わる',
    body: '端を固定すると、曲がる形が変わります。どの形にもサインカーブ半分の部分(赤い線)があり、その長さを「有効座屈長」と呼びます。この波が短いほど強い。両端固定は4倍、片持ちは4分の1です。',
  },
  {
    kicker: '実験室',
    head: '支え方と長さを変えて、押してみる',
    body: '支え方と長さを選び、押す力を 100% まで上げると座屈します。短い柱では、先に材料が降伏してオイラーの式は使えません。その先は映像3・4 で。',
  },
];

// H-300×300×10×16、弱軸まわり
const E = 200000;
const I = (2 * 16 * 300 ** 3 + 268 * 10 ** 3) / 12;
const PY = (355 * (2 * 300 * 16 + 268 * 10)) / 1000; // kN

export default function Stage2() {
  const [scene, setScene] = useState(0);
  const [lab, setLab] = useState<Lab2>({ sup: 'pp', L: 8, load: 0.5, yieldFirst: false });
  const { canvasRef, capRef, show } = useShow((c) => new Stage2Show(c));
  const go = (n: number) => {
    const next = Math.max(0, Math.min(SCENES.length - 1, n));
    setScene(next);
    show.current?.setScene(next);
  };
  const peOf = (sup: Support, L: number) => (Math.PI ** 2 * E * I) / (SUPPORTS[sup].le * L * 1000) ** 2 / 1000; // kN
  const change = (p: Partial<Lab2>) => {
    const next = { ...lab, ...p };
    next.yieldFirst = peOf(next.sup, next.L) > PY;
    setLab(next);
    if (show.current) show.current.lab = next;
  };
  const info = SUPPORTS[lab.sup];
  const le = info.le * lab.L;
  const pe = peOf(lab.sup, lab.L);
  const cap = Math.min(pe, PY); // 理想の柱が耐えられる上限

  return (
    <StoryShell
      scene={scene}
      total={SCENES.length}
      text={SCENES[scene]}
      onScene={go}
      canvasRef={canvasRef}
      capRef={capRef}
      hint="曲がり方は見やすく誇張しています・横になぞると回り込めます"
      side={
        <>
          {SIDE2[scene]}
          {scene <= 3 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-studio-700 px-3 py-2 text-xs">
              <Chip2 color="#1f2a44" text="外力(押す力 P)" />
              <Chip2 color="#64748b" text="反力" />
              <Chip2 color="#ea580c" text="曲げる力 P × y" />
              <Chip2 color="#0284c7" text="戻す力 EI × 1/R" />
            </div>
          )}
        </>
      }
      lab={
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="支え方と長さ">
            <div className="grid grid-cols-2 gap-2">
              {(['cf', 'pp', 'fp', 'ff'] as Support[]).map((k) => (
                <button
                  key={k}
                  onClick={() => change({ sup: k })}
                  aria-pressed={lab.sup === k}
                  className={`rounded-lg border px-2 py-2 text-sm font-bold ${
                    lab.sup === k ? 'border-comp bg-studio-700' : 'border-studio-600 text-ink-dim'
                  }`}
                >
                  {SUPPORTS[k].name}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <LabSlider label="柱の長さ L" value={lab.L} min={4} max={16} step={0.5} show={`${lab.L.toFixed(1)} m`} color="#6d28d9" onChange={(v) => change({ L: v })} />
              <LabSlider
                label="押す力"
                term="pe"
                hint={lab.yieldFirst ? '降伏荷重に対する割合(この長さでは降伏が上限)' : '座屈荷重に対する割合。100% で座屈'}
                value={lab.load}
                min={0}
                max={1.2}
                step={0.01}
                show={`${Math.round(lab.load * 100)}%(${Math.round(cap * Math.min(lab.load, 1.2)).toLocaleString()} kN)`}
                color="#0284c7"
                onChange={(v) => change({ load: v })}
              />
            </div>
          </Card>
          <Card title="この柱の座屈荷重">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <dt>
                  有効座屈長 <Tex>{'l_e'}</Tex>(サインカーブ半分の長さ)
                </dt>
                <dd className="num text-lg font-bold">
                  {info.le.toFixed(info.le === 1 || info.le === 2 ? 1 : 2)} L = {le.toFixed(2)} m
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>両端ピンに比べた強さ</dt>
                <dd className="num text-2xl font-bold text-gold">{info.gain.toFixed(2)} 倍</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>
                  座屈荷重 <Tex>{String.raw`P_e=\pi^2EI/l_e^2`}</Tex>
                </dt>
                <dd className="num text-lg font-bold">{Math.round(pe).toLocaleString()} kN</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>降伏荷重(材料の限界)</dt>
                <dd className="num text-lg font-bold">{Math.round(PY).toLocaleString()} kN</dd>
              </div>
            </dl>
            <p className={`mt-2 text-sm font-bold ${pe > PY ? 'text-yield' : 'text-ideal'}`} style={{ color: pe > PY ? undefined : '#16a34a' }}>
              {pe > PY
                ? `オイラーの式が使えない長さです。計算上の座屈荷重は降伏荷重を超えますが、理想の柱でも降伏荷重 ${Math.round(PY).toLocaleString()} kN が上限。現実の柱は、さらに手前で座屈します(STAGE 3・4)。`
                : '座屈荷重が降伏荷重より小さいので、理想の柱の強さは座屈で決まります。現実の柱は、これより少し手前で座屈します(STAGE 3・4)。'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-dim">
              断面は H-300×300×10×16(弱軸まわり、I = {(I / 1e4).toLocaleString(undefined, { maximumFractionDigits: 0 })} cm⁴)、E = 2.0×10⁵ N/mm²、σy = 355 N/mm²。
              ここでの座屈荷重は、傷のない理想の柱の値です。
            </p>
          </Card>
        </div>
      }
      note="支え方ごとの強さ: 片持ち 1/4 倍、両端ピン 1 倍、片方固定・片方ピン 2.05 倍(有効座屈長 0.699L)、両端固定 4 倍。座屈の形は、片持ち 1−cos(πx/2L)、両端ピン sin(πx/L)、両端固定 (1−cos(2πx/L))/2、片方固定・片方ピンは tan(kL)=kL の解(kL=4.493)から。"
    />
  );
}

function Chip2({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}
