import { useState } from 'react';
import { panelWidth, plateR, plateState, plateStrength, plateTheory, plateWinter, sigmaEl } from '../physics/plate.ts';
import { SIGMA_Y, Stage5Show } from '../three/stage5.ts';
import type { Lab5 } from '../three/stage5.ts';
import { Card, LabSlider, StoryShell, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Tex } from '../ui/Tex.tsx';

const pct = (x: number) => `${Math.round(x * 100)}%`;

const SCENES: SceneText[] = [
  {
    kicker: '落とし穴',
    head: '薄く広げすぎると、板が波打つ',
    body: 'STAGE 1 で、鉄は真ん中から遠くに置くほど効くと言いました。それなら、板をどこまでも薄く広げればいいはずです。ところが薄い板でできた箱形の柱を押すと、柱はまっすぐなのに、板がベコベコと波打ちます。柱全体ではなく、板1枚1枚が座屈する。これを「局部座屈」と呼びます。',
  },
  {
    kicker: '板の座屈',
    head: '板は、正方形の波を作って逃げる',
    body: '箱の壁を1枚取り出して押してみます。両側の縁は隣の板に支えられているので、柱のように全体が弓なりになることはできません。代わりに、手前と奥へ交互にふくらむ波になります。波の1つは、ほぼ正方形。板の幅が、波の大きさを決めています。',
  },
  {
    kicker: '幅と厚み',
    head: '幅が半分なら、4倍の応力まで耐える',
    body: '波の大きさは板の幅で決まるので、幅の狭い板ほど波が小さく、きつく曲がらないと波打てません。だから座屈しにくい。幅が半分なら、4倍の応力(面積あたりの力)まで耐えます。厚みが2倍でも4倍です(板が受け持てる力でいえば8倍)。効くのは「幅 ÷ 厚み」(幅厚比)の2乗。柱の「細長さ」にあたるものが、板では「幅厚比」です。これを材料の強さも含めた物差しにしたものが、幅厚比パラメータ R。R が 1 のとき、波打ち始める応力がちょうど降伏と同じになります。',
  },
  {
    kicker: '有効幅',
    head: '波打った板は、縁の近くしか働かない',
    body: '座屈した板を応力の色で見ると、ふくらんだ真ん中は色が暗いままで、力をほとんど受けていません。働いているのは、支えられてまっすぐなままの縁の近くだけで、そこは赤(降伏)に達しています。板の一部しか効かなくなるので、これを「有効幅」と呼びます。効く板が減れば柱全体の踏ん張りも減り、柱全体の座屈を早める引き金になります。(色の分布は模式図です)',
  },
  {
    kicker: '補剛材',
    head: 'リブを1本足すだけで、4倍',
    body: '板を厚くせずに強くする方法があります。板の真ん中に、縦に細長い板(リブ、補剛材)を溶接する。するとリブの線では板が動けなくなり、1枚の広い板が「幅が半分の板2枚」に変わります。幅が半分なので、波打ち始める力は4倍。リブ2本なら幅は3分の1で9倍。わずかな鉄で、大きな効果です。',
  },
  {
    kicker: '頭打ち',
    head: '4倍になるのは理論値。強さには天井がある',
    body: '4倍、9倍と増えるのは、板が波打ち始める応力(座屈の理論値)です。強さには、材料の限界(降伏)という天井があります。一方、薄い板は波打ってもすぐには限界にならず、縁で耐え続けます(緑の線。前の場面の有効幅)。ただし、ここで示す旧い設計基準の線(青)は、その余力を当てにしません。残留応力と初期のゆがみも見込んで、理論値の半分までしか認めない、安全側の決め方です。この例の板は、リブ1本で設計の線が天井に届き、2本目は増やしません。',
  },
  {
    kicker: '条件',
    head: 'リブ自身が、十分に硬いこと',
    body: 'リブが効くのは、リブの線で板が動けなくなるからです。リブが細すぎると、リブごと板と一緒にたわんでしまい、幅を分けられません。リブには、板をまっすぐに保てるだけの硬さが要ります。設計では、必要な硬さ(必要剛比)を満たすことを確かめます。',
  },
  {
    kicker: '実験室',
    head: '幅・厚み・リブを変えて、押してみる',
    body: '板の幅と厚み、リブの本数を変えると、幅厚比パラメータ R と強さが変わります。グラフの紫の点が、いまの板です。押す強さを上げていくと、まず設計で認める強さを超え、薄い板は波打ち、やがて縁が降伏して限界に達します。',
  },
];

export default function Stage5() {
  const [scene, setScene] = useState(0);
  const [lab, setLab] = useState<Lab5>({ b: 1000, t: 12, ribs: 0, load: 0.3 });
  const { canvasRef, capRef, show } = useShow((c) => new Stage5Show(c));
  const go = (n: number) => {
    const next = Math.max(0, Math.min(SCENES.length - 1, n));
    setScene(next);
    show.current?.setScene(next);
  };
  const change = (p: Partial<Lab5>) => {
    const next = { ...lab, ...p };
    setLab(next);
    if (show.current) show.current.lab = next;
  };
  const bp = panelWidth(lab.b, lab.ribs);
  const R = plateR(bp, lab.t, SIGMA_Y);
  const R0 = plateR(lab.b, lab.t, SIGMA_Y);
  const strength = plateStrength(R);
  const strength0 = plateStrength(R0);
  const ps = plateState(lab.load, R);
  const state =
    ps === 'ok'
      ? '設計で認める範囲。板は平らなまま'
      : ps === 'overDesign'
        ? '設計で認める強さは超えた(板はまだ平ら)'
        : ps === 'buckled'
          ? '波打っているが、縁で耐えている'
          : R <= 0.673
            ? '限界。波打つ前に、板全体が降伏した'
            : '限界。縁が降伏した';

  return (
    <StoryShell
      scene={scene}
      total={SCENES.length}
      text={SCENES[scene]}
      onScene={go}
      canvasRef={canvasRef}
      capRef={capRef}
      hint="波の高さは見やすく誇張しています・横になぞると回り込めます"
      side={
        scene === 5 || scene === 7 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-studio-700 px-3 py-2 text-xs">
            <Chip color="#6d28d9" text="座屈の理論値" />
            <Chip color="#e11d48" text="降伏の天井" />
            <Chip color="#16a34a" text="実際の強さの目安" />
            <Chip color="#0284c7" text="設計で認める強さ" />
          </div>
        ) : undefined
      }
      lab={
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="板とリブ">
            <LabSlider label="板の幅 b" term="bt" value={lab.b} min={300} max={2000} step={50} show={`${lab.b} mm`} color="#6d28d9" onChange={(v) => change({ b: v })} />
            <LabSlider label="板の厚み t" value={lab.t} min={6} max={40} step={1} show={`${lab.t} mm`} color="#0284c7" onChange={(v) => change({ t: v })} />
            <div className="mt-3">
              <p className="text-base font-bold">縦のリブ(補剛材)</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    onClick={() => change({ ribs: n })}
                    aria-pressed={lab.ribs === n}
                    className={`h-11 rounded-lg border text-sm font-bold ${lab.ribs === n ? 'border-gold bg-gold/15 text-gold' : 'border-studio-600 text-ink-dim'}`}
                  >
                    {n === 0 ? 'なし' : `${n} 本`}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <LabSlider label="押す強さ" term="load" hint="降伏に対する割合" value={lab.load} min={0} max={1.05} step={0.01} show={pct(lab.load)} color="#0284c7" onChange={(v) => change({ load: v })} />
            </div>
            <p className="mt-1 text-base font-bold text-gold">{state}</p>
          </Card>
          <Card title="この板の強さ">
            <dl className="space-y-2 text-sm">
              <Row label="リブで分けた1枚の幅" value={`${Math.round(bp)} mm`} />
              <Row label="幅厚比(幅 ÷ 厚み)" value={(bp / lab.t).toFixed(1)} />
              <Row label="幅厚比パラメータ R" value={R.toFixed(2)} big />
              <Row label="波打ち始める応力(理論値)" value={pct(plateTheory(R))} />
              <Row label="実際の強さの目安(有効幅)" value={pct(plateWinter(R))} />
              <Row label="設計で認める強さ(旧基準)" value={pct(strength)} big />
            </dl>
            {lab.ribs > 0 && (
              <p className="mt-2 text-sm">
                リブなしに比べて、理論値は <strong className="num text-gold">{(lab.ribs + 1) ** 2} 倍</strong>、設計で認める強さは{' '}
                <strong className="num text-gold">{(strength / strength0).toFixed(1)} 倍</strong>。
              </p>
            )}
            <p className="mt-2 text-sm text-ink-dim">
              {R <= 0.7 ? 'R が 0.7 以下なので、設計上は波打つ影響を見込まなくてよい板です。これ以上リブを足しても、設計で認める強さは増えません。' : 'R が 0.7 より大きいので、設計上は波打つ影響を見込む板です。'}
            </p>
            <div className="mt-2 overflow-x-auto text-sm">
              <Tex block>{String.raw`R=\sqrt{\dfrac{\sigma_y}{\sigma_{el}}}=\dfrac{b}{t}\sqrt{\dfrac{\sigma_y}{E}\cdot\dfrac{12(1-\nu^2)}{\pi^2 k}}`}</Tex>
            </div>
            <p className="text-xs leading-relaxed text-ink-dim">
              R は「降伏」と「板の座屈」の勝負指標。σel = {Math.round(sigmaEl(bp, lab.t))} N/mm²(k = 4、ν = 0.3、E = 2.0×10⁵ N/mm²)、σy = {SIGMA_Y} N/mm²。
              リブは十分に硬いものとしています。
            </p>
          </Card>
        </div>
      }
      note="計算の前提: 一様な圧縮を受ける、両側の縁が支えられた長い板(座屈係数 k = 4)。強さの線は道路橋示方書(平成24年版まで)の両縁支持板の式(R ≦ 0.7 で 1.0、それより大きいと 0.5/R²)。式どおりだと R = 0.7 のすぐ上で 1.02 になるため、1.0 で頭打ちにして描いています。この式は残留応力・初期のゆがみを見込み、波打った後の余力を見込まない安全側の値で、現行の版では見直されています(平成29年版の式は出典で確認できていないため載せていません)。緑の線は Winter の有効幅の式(Eurocode 3 と同じ形。R ≦ 0.673 で 1.0、それより大きいと (R−0.22)/R²)。リブ付きの板は、リブを完全に硬い支えとみなして、区切られた板それぞれに上の式を当てた理想化で、道路橋示方書の補剛板の規定(別の曲線)とは異なります。場面の例は R = 1.4 の板。"
    />
  );
}

function Chip({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{label}</dt>
      <dd className={`num font-bold ${big ? 'text-2xl text-gold' : 'text-lg'}`}>{value}</dd>
    </div>
  );
}
