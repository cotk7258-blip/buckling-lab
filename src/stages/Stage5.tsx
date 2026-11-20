import { useState } from 'react';
import { plateState, plateStrength, plateTheory, plateWinter, sigmaEl } from '../physics/plate.ts';
import { BT1, SIGMA_Y, Stage5Show, labR } from '../three/stage5.ts';
import type { Lab5 } from '../three/stage5.ts';
import { Card, LabSlider, Steps, StoryShell, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Tex } from '../ui/Tex.tsx';

const BT = Math.round(BT1);

const SCENES: SceneText[] = [
  {
    kicker: '現象',
    head: '柱はまっすぐなのに、板が波打つ',
    body: '薄い板でできた箱形の柱を押すと、柱はまっすぐなのに、板が波打ちます。これが局部座屈。柱の座屈と同じ順番で見ていきます。',
  },
  {
    kicker: '突然',
    head: '板も、ある応力で突然波打つ',
    body: '箱の壁を1枚取り出します。両側の縁は隣の板が支えています(緑)。押していくと、ある応力で突然波打つ。その応力が、弾性局部座屈応力 σel です。',
  },
  {
    kicker: '綱引き',
    head: '押し出す力と、戻す力の綱引き',
    body: '板がもし少し波打ったら、押す応力が波を押し出し(オレンジ)、板の曲げにくさと縁の支えが戻そうとします(青)。波を大きくしても2つは同じ割合で増えるので、波の大きさでは勝負が決まりません。決めるのは押す応力 σ。板で決まる σel に追いついた所で波打ちます。',
  },
  {
    kicker: '幅と厚み',
    head: '幅が半分なら、4倍の応力まで耐える',
    body: '幅の狭い板ほど、きつく曲がらないと波打てないので、戻す力が強い。幅が半分なら σel は4倍、厚みが2倍でも4倍です。柱の「長さ半分で4倍」と同じ形です。',
  },
  {
    kicker: 'σel の導出',
    head: '板は「細い柱の束」。オイラーの式に2つの補正',
    body: '板を、押す向きの細い帯に分けます。帯1本は、長さ b・厚さ t の柱。そのオイラーの式に、隣とつながる効果 1/(1−ν²) と、縁の支え k を掛けると σel になります。',
  },
  {
    kicker: '支え方',
    head: '支え方の効果は、係数 k に入る',
    body: '片側の縁が自由な板は、支えが片側だけなので、ずっと低い応力で波打ちます。k は両縁支持の 4 に対して 0.43、約9分の1。柱の有効座屈長にあたるのが、板の k です。',
  },
  {
    kicker: 'R の導出',
    head: '物差し R = √(σy/σel)',
    body: `厚みだけが違う板を10枚並べました。横軸は幅厚比パラメータ R = √(σy/σel)。柱の λ と同じ作り方で、R = 1 は σel がちょうど σy になる板です。両縁支持・σy = 355 なら、幅厚比 b/t ≒ ${BT}。`,
  },
  {
    kicker: '理想の板',
    head: '理想の板の強さは、2本の線の低い方',
    body: '厚い板(R < 1)は、波打つ前に降伏します。薄い板(R > 1)は σel で波打ちます。理想の板の強さは min(1, 1/R²)。柱とまったく同じ形です。',
  },
  {
    kicker: '現実の板 ①',
    head: '溶接のゆがみと残留応力で、早めに崩れる',
    body: '板は溶接で組み立てるので、残留応力とわずかな反りが残ります。反りは押すと大きくなり、中央は早く降伏に近づく。だから R = 1 の付近で、理想の線より下がります。柱と同じしくみです。',
  },
  {
    kicker: '現実の板 ②',
    head: '現実の板: R = 1 付近で下がり、薄い板は余力がある',
    body: 'R = 1 の付近では、柱と同じく理想より下がります。ところが薄い板は逆。波打ったあとも、支えられた縁が力を受け持つので、理想の線より上まで耐えます(深緑の点)。ここが柱との大きな違いです。',
  },
  {
    kicker: '板だけの理由',
    head: '波打つと、中央が働かず、縁に力が寄る',
    body: '波打つと、ふくらんだ中央は力を受けなくなり、増えた力は縁に寄ります。縁が σy に届いた所が限界。平均すると σy に届かないので、板には「σy × 低減率」までしか認めません(応力の並びは簡単なモデルによる模式図)。',
  },
  {
    kicker: '設計式',
    head: '設計式: R ≦ 0.7 で 1.0、R > 0.7 で 0.5/R²',
    body: '設計の線(青)は、R ≦ 0.7 なら低減なし、それより薄い板は 0.5/R²。これは「波打ち始める応力 σel の半分」です。R = 1 付近の低下を見込み、薄い板の余力は当てにしない、安全側の線と読めます(道路橋示方書・平成24年版までの式)。',
  },
  {
    kicker: '実験室',
    head: '幅・厚み・支え方を変えて、押してみる',
    body: '幅・厚み・支え方を変えると、R が変わり、板が横軸の上を動きます。厚い板はそのまま降伏し、薄い板は波打ってから限界に達します。',
  },
];

const SIDE: Record<number, React.ReactNode> = {
  1: <Steps title="弾性局部座屈応力" steps={[['', String.raw`\sigma_{el}=\dfrac{k\pi^2E}{12(1-\nu^2)}\left(\dfrac{t}{b}\right)^2`, 'd3']]} note="柱の σe にあたる値。" />,
  2: (
    <Steps
      title="綱引き(どちらも波の高さ w に比例)"
      steps={[
        ['押し出す力', String.raw`\propto\ \sigma\,t\times w`],
        ['戻す力', String.raw`\propto\ D\times\text{曲がり}\ \propto\ D\,w`],
        ['くらべる', String.raw`\sigma\quad\text{と}\quad\sigma_{el}`, 'd3'],
      ]}
      note="どちらにも w が掛かるので、波の高さでは勝負がつかない。σ が板で決まる σel に追いつけば波打つ。D は板の曲げにくさ。"
    />
  ),
  3: <Steps title="幅と厚みの効き方" steps={[['', String.raw`\sigma_{el}\ \propto\ \left(\dfrac{t}{b}\right)^2`], ['柱では', String.raw`\sigma_e\ \propto\ \left(\dfrac{1}{l/r}\right)^2`]]} />,
  4: (
    <Steps
      title="σel の導出: 帯を柱とみなす"
      steps={[
        ['出発点', String.raw`\sigma_e=\dfrac{\pi^2E}{(l/r)^2}`],
        ['帯 = 柱', String.raw`l\to b,\ r=\dfrac{t}{\sqrt{12}}\ \Rightarrow\ \dfrac{\pi^2E}{12}\left(\dfrac{t}{b}\right)^2`],
        ['横の変形を抑える', String.raw`\times\dfrac{1}{1-\nu^2}`],
        ['縁の支え', String.raw`\times k`],
        ['結果', String.raw`\sigma_{el}=\dfrac{k\pi^2E}{12(1-\nu^2)}\left(\dfrac{t}{b}\right)^2`, 'd3'],
      ]}
      note="帯の断面は幅 1・厚さ t なので r = t/√12。"
    />
  ),
  5: (
    <Steps
      title="支え方と k(長い板)"
      steps={[
        ['両縁 支持', 'k = 4.0'],
        ['両縁 固定', 'k = 6.97'],
        ['一縁 支持・一縁 自由', 'k = 0.425(設計では 0.43)'],
      ]}
      note="柱の有効座屈長にあたる。k が大きいほど強い。"
    />
  ),
  6: (
    <Steps
      title="R の導出(λ と同じ作り方)"
      steps={[
        ['定義', String.raw`R=\sqrt{\dfrac{\sigma_y}{\sigma_{el}}}`],
        ['σel を代入', String.raw`\dfrac{\sigma_y}{\sigma_{el}}=\dfrac{12(1-\nu^2)\,\sigma_y}{k\pi^2E}\left(\dfrac{b}{t}\right)^2`],
        ['平方根', String.raw`R=\dfrac{b}{t}\sqrt{\dfrac{12(1-\nu^2)\,\sigma_y}{k\pi^2E}}`, 'd5'],
        ['柱では', String.raw`\lambda=\dfrac{l}{r}\cdot\dfrac{1}{\pi}\sqrt{\dfrac{\sigma_y}{E}}`],
      ]}
      note={`両縁支持・σy = 355 N/mm² なら R = b/t ÷ ${BT}。`}
    />
  ),
  7: <Steps title="理想の板" steps={[['', String.raw`\dfrac{\sigma_{cr}}{\sigma_y}=\min\left(1,\ \dfrac{\sigma_{el}}{\sigma_y}\right)=\min\left(1,\ \dfrac{1}{R^2}\right)`, 'ds-p1']]} />,
  9: <Steps title="現実の板の強さの目安(両縁支持)" steps={[['Winter', String.raw`\dfrac{\sigma_u}{\sigma_y}=\dfrac{R-0.22}{R^2}\quad(R>0.673)`, 'ds-p2']]} note="有効幅の考え方による目安(Eurocode 3 の両縁支持板と同じ形)。" />,
  11: (
    <Steps
      title="設計式(道路橋示方書・平成24年版まで)"
      steps={[
        ['R ≦ 0.7', String.raw`\dfrac{\sigma_{cl}}{\sigma_y}=1.0`],
        ['R > 0.7', String.raw`\dfrac{\sigma_{cl}}{\sigma_y}=\dfrac{0.5}{R^2}=0.5\,\dfrac{\sigma_{el}}{\sigma_y}`, 'ds-p3'],
      ]}
      note="0.7 は 0.5/R² が 1.0 になる √0.5 ≒ 0.707 を丸めた値。0.5 は試験・解析と安全余裕から決めた係数(根拠は基準の解説で要確認)。"
    />
  ),
  8: (
    <Steps
      title="初期たわみは、押すと増える(柱と同じ)"
      steps={[
        ['はじめの反り', String.raw`w_0`],
        ['押したとき', String.raw`w=\dfrac{w_0}{1-\sigma/\sigma_{el}}`, 'ds-c3'],
        ['中央の応力', String.raw`\sigma+\sigma_{\text{残留}}+\text{反りによる曲げ}`],
      ]}
      note="σ が σel に近いほど反りが増える。R = 1 付近では降伏とも重なり、理想より手前で限界に。"
    />
  ),
  10: (
    <Steps
      title="縁に寄る応力と、有効幅"
      steps={[
        ['有効幅', String.raw`\dfrac{b_{\text{有効}}}{b}=\dfrac{\sigma_{\text{平均}}}{\sigma_{\text{縁}}}`, 'ds-p2'],
        ['縁が σy で限界', String.raw`\dfrac{\sigma_u}{\sigma_y}\approx\dfrac{1}{R}\quad(\text{von Kármán})`],
        ['この板 R = 1.6', String.raw`\dfrac{1}{1.6}=0.63`],
      ]}
      note="映像の応力の並びは、中央を σel で頭打ちにした簡単なモデル(限界の平均は 0.61σy)。"
    />
  ),
};

export default function Stage5() {
  const [scene, setScene] = useState(0);
  const [lab, setLab] = useState<Lab5>({ b: 900, t: 12, k: 4, load: 0.3 });
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
  const R = labR(lab);
  const free = lab.k < 1;
  const design = plateStrength(R);
  const ps = plateState(lab.load, R);
  const state = free
    ? lab.load >= Math.min(1, plateTheory(R))
      ? R <= 1
        ? '降伏した'
        : '波打った(σel に達した)'
      : '平らなまま耐えている'
    : ps === 'ok'
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
      hint="板の厚みと波の高さは見やすく誇張しています・なぞると回転(PC は右ドラッグで移動・ホイールで拡大縮小)"
      side={
        <>
          {SIDE[scene]}
          {(scene === 7 || scene === 9 || scene >= 11) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-studio-700 px-3 py-2 text-xs">
              <Chip color="#e11d48" text="降伏の天井 1.0" />
              <Chip color="#6d28d9" text="σel/σy = 1/R²" />
              <Chip color="#16a34a" text="理想の板" />
              {scene >= 9 && <Chip color="#0f766e" text="現実の板(目安)" />}
              {scene >= 11 && <Chip color="#0284c7" text="設計式" />}
            </div>
          )}
          {scene === 8 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-studio-700 px-3 py-2 text-xs">
              <Chip color="#0284c7" text="圧縮(中央側の残留応力+押す力)" />
              <Chip color="#ea580c" text="引張(溶接した縁の近く)" />
            </div>
          )}
          {scene === 10 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-studio-700 px-3 py-2 text-xs">
              <Chip color="#0284c7" text="幅方向の応力(板の上の柱)" />
              <Chip color="#e11d48" text="σy に届いた所" />
              <Chip color="#6d28d9" text="σel(波打ち始める応力)" />
            </div>
          )}
          {scene >= 1 && scene <= 5 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-studio-700 px-3 py-2 text-xs">
              <Chip color="#1f2a44" text="外力(押す力)" />
              <Chip color="#64748b" text="反力" />
              <Chip color="#ea580c" text="押し出す力" />
              <Chip color="#0284c7" text="戻す力(回復力)" />
              <Chip color="#16a34a" text="縁の支え" />
            </div>
          )}
        </>
      }
      lab={
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="板と支え方">
            <LabSlider label="板の幅 b" term="bt" value={lab.b} min={200} max={2000} step={50} show={`${lab.b} mm`} color="#6d28d9" onChange={(v) => change({ b: v })} />
            <LabSlider label="板の厚み t" value={lab.t} min={6} max={40} step={1} show={`${lab.t} mm`} color="#0284c7" onChange={(v) => change({ t: v })} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                [4, '両縁支持 k = 4.0'],
                [0.43, '自由突出 k = 0.43'],
              ].map(([k, t]) => (
                <button
                  key={k}
                  onClick={() => change({ k: k as number })}
                  aria-pressed={lab.k === k}
                  className={`h-11 rounded-lg border text-sm font-bold ${lab.k === k ? 'border-gold bg-gold/15 text-gold' : 'border-studio-600 text-ink-dim'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <LabSlider label="押す応力 σ/σy" term="load" value={lab.load} min={0} max={1.05} step={0.01} show={lab.load.toFixed(2)} color="#1f2a44" onChange={(v) => change({ load: v })} />
            </div>
            <p className="mt-1 text-base font-bold text-gold">{state}</p>
          </Card>
          <Card title="この板の数値">
            <dl className="space-y-2 text-sm">
              <Row label="幅厚比 b/t" value={(lab.b / lab.t).toFixed(1)} />
              <Row label={<>弾性局部座屈応力 <Tex>{'\\sigma_{el}'}</Tex></>} value={`${Math.round(sigmaEl(lab.b, lab.t, lab.k))} N/mm²`} />
              <Row label={<>幅厚比パラメータ <Tex>{'R=\\sqrt{\\sigma_y/\\sigma_{el}}'}</Tex></>} value={R.toFixed(2)} big />
              <Row label={<>理想 <Tex>{'\\min(1,1/R^2)'}</Tex></>} value={Math.min(1, plateTheory(R)).toFixed(2)} />
              {!free && <Row label="現実の板の目安(Winter)" value={plateWinter(R).toFixed(2)} />}
              <Row label={<>設計式 <Tex>{'\\sigma_{cl}/\\sigma_y'}</Tex></>} value={design.toFixed(2)} big />
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-ink-dim">
              σy = {SIGMA_Y} N/mm²、E = 2.0×10⁵ N/mm²、ν = 0.3。グラフの赤い点が、いまの板の設計式の値です。{free ? '自由突出板では、現実の板の目安(深緑)は表示していません(別の式になるため)。' : ''}
            </p>
          </Card>
        </div>
      }
      note={`計算の前提: 一様な圧縮を受ける長い板。σel = kπ²E/{12(1−ν²)} × (t/b)²(両縁支持 k = 4、自由突出 k = 0.43)。並べた板は R = 0.3〜2.1(両縁支持・σy = 355 N/mm² で b/t ≒ ${Math.round(BT1 * 0.3)}〜${Math.round(BT1 * 2.1)})。現実の板の点は Winter の有効幅の式(R ≦ 0.673 で 1.0、それより大きいと (R−0.22)/R²)による目安で、実験値ではありません。設計式は道路橋示方書(平成24年版まで)の形(R ≦ 0.7 で 1.0、それより大きいと 0.5/R²)。式どおりだと R = 0.7 のすぐ上で 1.02 になるため、1.0 で頭打ちにして描いています。平成29年版の式は出典で確認できていないため載せていません。板の色は応力の大きさ(波打った後の、縁に偏った分布は模式図)。`}
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

function Row({ label, value, big }: { label: React.ReactNode; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{label}</dt>
      <dd className={`num font-bold ${big ? 'text-2xl text-gold' : 'text-lg'}`}>{value}</dd>
    </div>
  );
}
