import { useState } from 'react';
import { SUPPORTS, Stage2Show } from '../three/stage2.ts';
import type { Lab2, Support } from '../three/stage2.ts';
import { Card, LabSlider, StoryShell, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Tex } from '../ui/Tex.tsx';

const SCENES: SceneText[] = [
  {
    kicker: '現象',
    head: '細い棒は、ある力で突然曲がる',
    body: '細い棒を上からゆっくり押していきます。棒はしばらく、まっすぐのまま耐えます。ところが力がある大きさに達した瞬間、突然横へ曲がります。少しずつ曲がっていくのではなく、境目がはっきりある。これが座屈です。その境目の力を「座屈荷重」と呼びます。',
  },
  {
    kicker: '綱引き',
    head: '曲げる力と、戻す力の綱引き',
    body: '棒が横にずれると、2つの力が生まれます。ひとつは、ずれた棒をさらに曲げようとする力(押す力 × ずれ)。もうひとつは、曲げられた棒がまっすぐに戻ろうとする力(踏ん張り × 曲がり具合)。大事なのは、どちらも「ずれ」に比例すること。だから勝ち負けはずれの大きさでは決まらず、押す力の大きさだけで決まります。ちょうど互角になる力が、座屈荷重です。境目がはっきりあるのは、このためです。',
  },
  {
    kicker: '長さ',
    head: '長さが2倍なら、座屈する力は4分の1',
    body: '同じだけ横にずれても、長い棒はゆるいカーブ、短い棒はきついカーブになります。戻す力はカーブのきつさで決まるので、長い棒ほど戻す力が弱い。カーブのきつさは長さの2乗に反比例するので、長さが2倍なら座屈する力は4分の1、3倍なら9分の1です。',
  },
  {
    kicker: 'π の出どころ',
    head: '座屈の形は、サインカーブ',
    body: '両端をピンで支えた棒は、サインカーブの半分の形に曲がります。この形の「傾き」をとると両端で最大・真ん中でゼロの波になり、もう一度「傾きの変わり方」をとると、もとと同じ形で向きが逆の波に戻ります。山なりのカーブは傾きがだんだん減っていくので、マイナスが付くわけです。真ん中のカーブのきつさは「ずれ × (π ÷ 長さ)²」。座屈荷重の式に π² が出てくるのは、波の形がサインカーブだからです。',
  },
  {
    kicker: '式にする',
    head: 'オイラーの座屈荷重',
    body: '戻す力 = 踏ん張り(EI)× カーブのきつさ(ずれ × π²/L²)。曲げる力 = 押す力 P × ずれ。この2つが互角になる P が座屈荷重です。両辺の「ずれ」が消えて、下の式が残ります。',
  },
  {
    kicker: '支え方',
    head: '支え方で、強さは16倍も変わる',
    body: '同じ棒でも、両端の支え方で座屈する力は大きく変わります。端を固定すると、そこでは傾くことができないので、曲がる形が変わるからです。どの形にも、サインカーブ半分にあたる部分(赤い線)があります。その長さを「有効座屈長」と呼びます。両端固定なら棒の半分なので4倍強く、片持ちなら棒の2倍なので4分の1。支え方の違いは、すべて「波の長さ」の違いに置きかえられます。',
  },
  {
    kicker: '実験室',
    head: '支え方と長さを変えて、押してみる',
    body: '支え方と長さを選ぶと、座屈荷重が出ます。押す力を 100% まで上げると座屈します。短い柱では、計算上の座屈荷重が降伏荷重(材料が元に戻らなくなる限界の力)を超えてしまい、オイラーの式は使えません。その先の話が STAGE 3 と STAGE 4 です。',
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
        scene === 4 ? (
          <div className="rounded-2xl border border-studio-600 bg-studio-900 p-3">
            <div className="overflow-x-auto text-xl">
              <Tex block>{String.raw`P_e = \dfrac{\pi^2 E I}{L^2}`}</Tex>
            </div>
            <ul className="mt-1 space-y-1.5 text-sm">
              <li>
                <Tex>{String.raw`\pi^2`}</Tex> … 座屈の形がサインカーブだから
              </li>
              <li>
                <Tex>{'EI'}</Tex> … 曲げへの踏ん張り(材料の硬さ × 断面の形)
              </li>
              <li>
                <Tex>{'L^2'}</Tex> … 長いほどカーブがゆるく、戻す力が弱い
              </li>
            </ul>
            <p className="mt-2 text-xs text-ink-dim">
              支え方が違うときは、L の代わりに有効座屈長 <Tex>{'l_e'}</Tex>(サインカーブ半分の長さ)を使います。
            </p>
          </div>
        ) : undefined
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
