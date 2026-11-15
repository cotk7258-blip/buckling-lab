import { useState } from 'react';
import { panelWidth, plateR, plateStrength, plateTheory, sigmaEl } from '../physics/plate.ts';
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
    head: '幅が半分なら、4倍まで耐える',
    body: '波の大きさは板の幅で決まるので、幅の狭い板ほど波が小さく、きつく曲がらないと波打てません。だから座屈しにくい。幅が半分なら4倍、厚みが2倍でも4倍です。効くのは「幅 ÷ 厚み」(幅厚比)の2乗。柱の「細長さ」にあたるものが、板では「幅厚比」です。',
  },
  {
    kicker: '有効幅',
    head: '波打った板は、縁の近くしか働かない',
    body: '座屈した板を応力の色で見ると、ふくらんだ真ん中は色が暗いままで、力をほとんど受けていません。働いているのは、支えられてまっすぐなままの縁の近くだけで、そこは赤(降伏)に達しています。板の一部しか効かなくなるので、これを「有効幅」と呼びます。効く板が減れば柱全体の踏ん張りも減り、柱全体の座屈を早める引き金になります。(色の分布は模式図です)',
  },
  {
    kicker: '補剛材',
    head: 'リブを1本足すだけで、4倍',
    body: '板を厚くせずに強くする方法があります。板の真ん中に、縦に細長い板(リブ、補剛材)を溶接する。するとリブの線では板が動けなくなり、1枚の広い板が「幅が半分の板2枚」に変わります。幅が半分なので、座屈する力は4倍。リブ2本なら幅は3分の1で9倍。わずかな鉄で、大きな効果です。',
  },
  {
    kicker: '頭打ち',
    head: '4倍になるのは理論値。強さは降伏で頭打ち',
    body: '4倍、9倍と増えるのは、座屈の理論値です。実際の強さには、材料の限界(降伏)という天井があります。設計で使う線は、R が 0.7 以下なら天井いっぱい、それより薄くて広い板は理論値の半分。半分になるのは、現実の板にも残留応力と初期のゆがみがあるからです(STAGE 3 と同じ理由)。この例の板はリブ1本で天井に届き、2本目は強さを増やしません。',
  },
  {
    kicker: '条件',
    head: 'リブ自身が、十分に硬いこと',
    body: 'リブが効くのは、リブの線で板が動けなくなるからです。リブが細すぎると、リブごと板と一緒にたわんでしまい、幅を分けられません。リブには、板をまっすぐに保てるだけの硬さが要ります。設計では、必要な硬さ(必要剛比)を満たすことを確かめます。',
  },
  {
    kicker: '実験室',
    head: '幅・厚み・リブを変えて、押してみる',
    body: '板の幅と厚み、リブの本数を変えると、幅厚比パラメータ R と強さが変わります。グラフの金色の点が、いまの板です。押す強さを上げていくと、薄い板は波打ち、やがて限界に達します。',
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
  const state = lab.load >= strength ? '限界に達した' : plateTheory(R) < 1 && lab.load >= plateTheory(R) ? '波打っている(座屈後)' : '平らなまま耐えている';

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
            <Chip color="#fbbf24" text="座屈の理論値" />
            <Chip color="#ff1f4b" text="降伏の天井" />
            <Chip color="#5cd0ff" text="設計の線" />
          </div>
        ) : undefined
      }
      lab={
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="板とリブ">
            <LabSlider label="板の幅 b" value={lab.b} min={300} max={2000} step={50} show={`${lab.b} mm`} color="#fbbf24" onChange={(v) => change({ b: v })} />
            <LabSlider label="板の厚み t" value={lab.t} min={6} max={40} step={1} show={`${lab.t} mm`} color="#5cd0ff" onChange={(v) => change({ t: v })} />
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
              <LabSlider label="押す強さ" hint="降伏に対する割合" value={lab.load} min={0} max={1.05} step={0.01} show={pct(lab.load)} color="#38bdf8" onChange={(v) => change({ load: v })} />
            </div>
            <p className="mt-1 text-base font-bold text-gold">{state}</p>
          </Card>
          <Card title="この板の強さ">
            <dl className="space-y-2 text-sm">
              <Row label="リブで分けた1枚の幅" value={`${Math.round(bp)} mm`} />
              <Row label="幅厚比(幅 ÷ 厚み)" value={(bp / lab.t).toFixed(1)} />
              <Row label="幅厚比パラメータ R" value={R.toFixed(2)} big />
              <Row label="座屈の理論値(降伏に対する割合)" value={pct(plateTheory(R))} />
              <Row label="強さ(設計の線)" value={pct(strength)} big />
            </dl>
            {lab.ribs > 0 && (
              <p className="mt-2 text-sm">
                リブなしに比べて、理論値は <strong className="num text-gold">{(lab.ribs + 1) ** 2} 倍</strong>、強さは{' '}
                <strong className="num text-gold">{(strength / strength0).toFixed(1)} 倍</strong>。
              </p>
            )}
            <p className="mt-2 text-sm text-ink-dim">
              {R <= 0.7 ? 'R が 0.7 以下なので、座屈より先に降伏が来ます。これ以上リブを足しても強さは増えません。' : 'R が 0.7 より大きいので、降伏の前に板が座屈します。'}
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
      note="計算の前提: 一様な圧縮を受ける、両側の縁が支えられた長い板(座屈係数 k = 4)。強さの線は道路橋示方書(平成24年版まで)の両縁支持板の式(R ≦ 0.7 で 1.0、それより大きいと 0.5/R²)。式どおりだと R = 0.7 のすぐ上で 1.02 になるため、1.0 で頭打ちにして描いています。平成29年版の式は出典で確認できていないため載せていません。場面の例は R = 1.4 の板。"
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
