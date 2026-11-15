import { useState } from 'react';
import { H_GAIN, Stage1Show } from '../three/stage1.ts';
import type { LabState } from '../three/stage1.ts';
import { Card, LabSlider, StoryShell, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Tex } from '../ui/Tex.tsx';

const GAIN = Math.round(H_GAIN);

const SCENES: SceneText[] = [
  {
    kicker: 'ふしぎ',
    head: '同じ定規が、向きで別物になる',
    body: '定規は、平らな向きには簡単にしなります。ところが立てて同じ力をかけても、びくともしません。幅 30 mm・厚み 2 mm の定規なら、立てると約 225 倍も曲がりにくくなります。材料も量も変わっていないのに、なぜでしょう。',
  },
  {
    kicker: '曲がるとは',
    head: '曲がるとは、外が伸びて内が縮むこと',
    body: '線を引いた太い棒を曲げてみます。外側の線は伸び、内側の線は縮みます。真ん中の線だけは長さが変わりません(中立軸)。そして伸び縮みの量は、真ん中から離れるほど大きくなります。曲げは、棒の中の「伸び」と「縮み」の組み合わせです。',
  },
  {
    kicker: 'バネで見る',
    head: '伸び縮みするなら、バネの束で考えられる',
    body: '棒を薄く輪切りにした1枚を、バネの束に置きかえます。曲がるということは、輪切りの面が傾くこと。上のバネは伸びて引き戻し(引張)、下のバネは縮んで押し返します(圧縮)。どちらも、傾きを元に戻す向きです。これが曲げに対する「踏ん張り」の正体です。',
  },
  {
    kicker: 'テコ',
    head: '遠いバネは、2回おいしい',
    body: '真ん中から遠いバネほど大きく伸び縮みするので、出す力が大きい。さらに、面を回す効き目は「力 × 腕の長さ」で、その腕も真ん中からの距離です。だから効き目は距離の2乗。真ん中から3倍遠いバネは、9倍効きます。真ん中のバネは、曲げに対してはほとんど役に立っていません。',
  },
  {
    kicker: '3乗',
    head: '高さを2倍にすると、踏ん張りは8倍',
    body: '断面の高さを2倍にすると、3つのことが同時に起きます。バネの数が2倍。端のバネの伸び縮みが2倍。端のバネの腕が2倍。掛け合わせて 2×2×2 = 8倍です。幅を2倍にしてもバネの数が2倍になるだけなので、踏ん張りは2倍。定規を立てると別物になるのは、このためです。',
  },
  {
    kicker: 'だから H形',
    head: '鉄は、真ん中から遠くに置くほど効く',
    body: `真ん中のバネが曲げの役に立たないなら、その鉄を上下の端へ移せばいい。同じ量の鉄でも、H形にすると踏ん張りは約${GAIN}倍になります。上下の板(フランジ)が踏ん張り、真ん中の薄い板(ウェブ)が2枚をつなぐ。H形鋼のあの形は、曲げに強くするための形です。ただし、薄く広げすぎると別の問題が起きます(STAGE 5)。`,
  },
  {
    kicker: '式にする',
    head: '曲げに抵抗する力 = 硬さ × 形 × 曲がり具合',
    body: 'ここまでの話を1行にしたのが、この式です。E は材料の硬さ(バネ1本の硬さ)、I は形の踏ん張りやすさ(バネの並び方)、曲率は曲がり具合。下の記号を押すと、その意味の絵が出ます。',
  },
  {
    kicker: '実験室',
    head: '断面の形を変えて、曲げてみる',
    body: '幅と高さを変えて、踏ん張り(I)の変わり方を確かめてください。高さを2倍にすると8倍、幅を2倍にすると2倍です。強く曲げると、縁から赤くなります(降伏。材料が元に戻らなくなる限界で、STAGE 3 で詳しく見ます)。',
  },
];

const TERMS = [
  { tex: 'E', name: 'ヤング係数', plain: '材料の硬さ(バネ1本の硬さ)' },
  { tex: 'I', name: '断面二次モーメント', plain: '断面の踏ん張りやすさ(バネの並び方)' },
  { tex: String.raw`\dfrac{1}{R}`, name: '曲率', plain: '曲がり具合(R は曲がりの半径)' },
];

export default function Stage1() {
  const [scene, setScene] = useState(0);
  const [focus, setFocus] = useState(-1);
  const [lab, setLab] = useState<LabState>({ b: 100, h: 150, k: 0.006 });
  const { canvasRef, capRef, show } = useShow((c) => new Stage1Show(c));
  const go = (n: number) => {
    const next = Math.max(0, Math.min(SCENES.length - 1, n));
    setScene(next);
    setFocus(-1);
    if (show.current) {
      show.current.focus = -1;
      show.current.setScene(next);
    }
  };
  const pick = (i: number) => {
    const v = focus === i ? -1 : i;
    setFocus(v);
    if (show.current) show.current.focus = v;
  };
  const change = (p: Partial<LabState>) => {
    const next = { ...lab, ...p };
    setLab(next);
    if (show.current) show.current.lab = next;
  };
  const I = (lab.b * lab.h ** 3) / 12; // mm⁴
  const I0 = (100 * 150 ** 3) / 12;
  const edge = ((lab.k / 1000) * lab.h) / 2 / (355 / 200000); // 縁のひずみ ÷ 降伏ひずみ
  const My = (355 * lab.b * lab.h ** 2) / 6 / 1e6; // 縁が降伏するときの曲げモーメント kN·m
  // 降伏するまでは M = EI/R。それを超えると、長方形断面では My·(1.5 − 0.5/(縁の比)²) で頭打ち(最大 1.5 My)
  const M = edge <= 1 ? (200000 * I * (lab.k / 1000)) / 1e6 : My * (1.5 - 0.5 / (edge * edge));

  return (
    <StoryShell
      scene={scene}
      total={SCENES.length}
      text={SCENES[scene]}
      onScene={go}
      canvasRef={canvasRef}
      capRef={capRef}
      hint="曲がり方は見やすく誇張しています。バネの絵は、しくみを示す模式図です・横になぞると回り込めます"
      side={
        scene === 6 ? (
          <div className="rounded-2xl border border-studio-600 bg-studio-900 p-3">
            <div className="overflow-x-auto text-xl">
              <Tex block>{String.raw`M = E \times I \times \dfrac{1}{R}`}</Tex>
            </div>
            <div className="mt-1 grid gap-2">
              {TERMS.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => pick(i)}
                  aria-pressed={focus === i}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                    focus === i ? 'border-gold bg-gold/15' : 'border-studio-600'
                  }`}
                >
                  <span className="w-10 shrink-0 text-center text-lg">
                    <Tex>{t.tex}</Tex>
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{t.plain}</span>
                    <span className="block text-xs text-ink-dim">{t.name}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-dim">M は曲げモーメント(曲げに抵抗して踏ん張る力)。押さなければ、3つを順に映します。</p>
          </div>
        ) : undefined
      }
      lab={
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="断面と曲げ具合">
            <LabSlider label="高さ h" term="I" hint="曲げる向きの寸法。3乗で効く" value={lab.h} min={50} max={300} step={10} show={`${lab.h} mm`} color="#6d28d9" onChange={(v) => change({ h: v })} />
            <LabSlider label="幅 b" hint="1乗で効く" value={lab.b} min={50} max={300} step={10} show={`${lab.b} mm`} color="#0284c7" onChange={(v) => change({ b: v })} />
            <LabSlider
              label="曲げ具合(曲率)"
              term="curv"
              hint="曲がりの半径 R の逆数"
              value={lab.k}
              min={0}
              max={0.03}
              step={0.001}
              show={lab.k > 0 ? `R = ${Math.round(1 / lab.k)} m` : 'まっすぐ'}
              color="#ea580c"
              onChange={(v) => change({ k: v })}
            />
          </Card>
          <Card title="この断面の踏ん張り">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <dt>
                  踏ん張りやすさ <Tex>{'I = bh^3/12'}</Tex>
                </dt>
                <dd className="num text-lg font-bold">{(I / 1e4).toLocaleString(undefined, { maximumFractionDigits: 0 })} cm⁴</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>はじめの断面(100×150)の</dt>
                <dd className="num text-2xl font-bold text-gold">{(I / I0).toFixed(I / I0 < 10 ? 2 : 1)} 倍</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>
                  抵抗する力 M(鋼){edge > 1 && <span className="ml-1 text-yield">降伏後</span>}
                </dt>
                <dd className="num text-lg font-bold">{M.toFixed(M < 10 ? 1 : 0)} kN·m</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>縁の応力(降伏に対する割合)</dt>
                <dd className={`num text-lg font-bold ${edge >= 1 ? 'text-yield' : ''}`}>{Math.round(Math.min(edge, 9.99) * 100)}%</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-ink-dim">
              鋼(E = 2.0×10⁵ N/mm²、σy = 355 N/mm²)の長方形断面。M = EI/R は、縁が降伏するまで(100% まで)成り立つ式です。それを超えると赤い部分はもう力を増やせないので、抵抗する力は頭打ちになります(長方形では、縁が降伏したときの 1.5 倍まで)。
            </p>
          </Card>
        </div>
      }
      note={`H形と長方形の比較: H-300×300×10×16 を強軸まわりに曲げた場合と、同じ断面積で幅 100 mm の長方形との比(約${GAIN}倍)。定規の「約 225 倍」は (幅/厚み)² = (30/2)² です。絵の定規も同じ比率で描いています。`}
    />
  );
}
