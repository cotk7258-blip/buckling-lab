import { useState } from 'react';
import { plateStrength, plateTheory } from '../physics/plate.ts';
import { Stage6Show, strengthG, strengthGL } from '../three/stage6.ts';
import type { Lab6 } from '../three/stage6.ts';
import { Card, LabSlider, StoryShell, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Term } from '../ui/glossary.tsx';

const pct = (x: number) => `${Math.round(x * 100)}%`;

const SCENES: SceneText[] = [
  {
    kicker: '地図',
    head: '座屈には、大きさの違う種類がある',
    body: 'ここまで、柱が曲がる座屈と、板が波打つ座屈を別々に見てきました。実際の橋や建物の柱では、これらが同じ1本の中で起こります。箱形の柱で整理しましょう。柱は板でできていて、板にはリブ(補剛材)が付き、リブと角で区切られた1区画をパネルと呼びます。柱・板・パネル。座屈は、どの大きさでも起こります。',
  },
  {
    kicker: 'その1',
    head: '全体座屈。柱が、柱ごと曲がる',
    body: 'いちばん大きな座屈です。柱全体が弓なりに曲がります。断面の形は四角いまま変わりません。起きやすさを決めるのは、柱の細長さ(細長比パラメータ)。STAGE 2 から STAGE 4 で見てきた座屈が、これです。',
  },
  {
    kicker: 'その2',
    head: '局部座屈。板だけが波打つ',
    body: '柱はまっすぐ立ったまま、断面を作っている板が波打ちます。これが局部座屈です。リブがしっかりしていれば、リブの線と角は動かず、その間のパネルだけが波打ちます。これをパネル座屈と呼びます。起きやすさを決めるのは、パネルの幅と厚みの比(幅厚比パラメータ)。STAGE 5 で見た座屈です。',
  },
  {
    kicker: 'その3',
    head: 'リブごと波打つ。補剛板の全体座屈',
    body: 'リブが細くて弱いと、リブの線も一緒にたわんでしまい、板全体が大きな波になります。リブ付きの板(補剛板)が、板として丸ごと座屈するので、補剛板の全体座屈と呼びます。「全体」と付きますが、柱ごと曲がる全体座屈とは別物で、板の中の話です。リブに必要な硬さ(必要剛比)を持たせれば、これは防げます。',
  },
  {
    kicker: '組み合わせ',
    head: '連成座屈。板の座屈が、柱の座屈を早める',
    body: '板の薄い柱では、まず板が波打ちます。波打った板は縁の近くしか働かない(有効幅)ので、柱の踏ん張りが落ちます。すると、板が健全なら耐えられたはずの力で、柱ごと座屈してしまいます。局部座屈と全体座屈が連なって起きるので、連成座屈(複合座屈)と呼びます。別々に計算した強さの、どちらよりも弱くなるのが怖い所です。',
  },
  {
    kicker: '設計',
    head: '局部座屈を「考慮しない強さ」と「考慮した強さ」',
    body: '設計では、柱の強さを2通りに呼び分けます。「局部座屈を考慮しない強さ」は、板は波打たないものとして、全体座屈だけで決めた強さ(STAGE 4 の設計曲線)。「局部座屈を考慮した強さ」は、それに板の強さの割合を掛け算したものです。板が十分に厚ければ掛ける数は 1 で、2つは同じ。板が薄いほど、線は丸ごと下がります。連成座屈を、安全側の単純な掛け算で見込んでいるわけです。',
  },
  {
    kicker: '実験室',
    head: '柱の細長さと板の薄さを、同時に変える',
    body: '柱の細長さと、板の幅厚比パラメータを動かして、2つの強さを見比べてください。板を厚くして R を 0.7 以下にすれば、局部座屈は考えなくてよくなります。リブを足すのは、そのための手段です。',
  },
];

export default function Stage6() {
  const [scene, setScene] = useState(0);
  const [lab, setLab] = useState<Lab6>({ lam: 0.8, R: 1.0 });
  const { canvasRef, capRef, show } = useShow((c) => new Stage6Show(c));
  const go = (n: number) => {
    const next = Math.max(0, Math.min(SCENES.length - 1, n));
    setScene(next);
    show.current?.setScene(next);
  };
  const change = (p: Partial<Lab6>) => {
    const next = { ...lab, ...p };
    setLab(next);
    if (show.current) show.current.lab = next;
  };
  const g = strengthG(lab.lam);
  const l = plateStrength(lab.R);
  const gl = strengthGL(lab.lam, lab.R);

  return (
    <StoryShell
      scene={scene}
      total={SCENES.length}
      text={SCENES[scene]}
      onScene={go}
      canvasRef={canvasRef}
      capRef={capRef}
      hint="曲がりと波の大きさは見やすく誇張しています・横になぞると回り込めます"
      side={
        <div className="rounded-xl border border-studio-700 bg-studio-900 px-3 py-2 text-sm">
          <p className="text-xs font-bold text-ink-dim">座屈の種類(押すと説明)</p>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <li>
              <Term id="global" /> … 柱ごと
            </li>
            <li>
              <Term id="local" /> … 板が波打つ
            </li>
            <li>
              <Term id="panel" /> … リブの間
            </li>
            <li>
              <Term id="plateglobal" /> … リブごと
            </li>
            <li className="col-span-2">
              <Term id="coupled" /> … 板と柱が連なる
            </li>
          </ul>
        </div>
      }
      lab={
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="柱と板">
            <LabSlider
              label="柱の細長さ(細長比パラメータ λ̄)"
              term="lambda"
              hint="大きいほど、ひょろ長い柱"
              value={lab.lam}
              min={0.2}
              max={2}
              step={0.05}
              show={lab.lam.toFixed(2)}
              color="#0284c7"
              onChange={(v) => change({ lam: v })}
            />
            <LabSlider
              label="板の薄さ(幅厚比パラメータ R)"
              term="R"
              hint="大きいほど、薄くて広い板。0.7 以下なら波打たない"
              value={lab.R}
              min={0.3}
              max={2}
              step={0.05}
              show={lab.R.toFixed(2)}
              color="#6d28d9"
              onChange={(v) => change({ R: v })}
            />
          </Card>
          <Card title="この柱の強さ(降伏に対する割合)">
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt>
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-comp" />
                  <Term id="consider">局部座屈を考慮しない強さ</Term>(全体座屈だけ)
                </dt>
                <dd className="num text-xl font-bold">{pct(g)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt>板の強さの割合(設計で認める値)</dt>
                <dd className="num text-xl font-bold">× {l.toFixed(2)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt>
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-gold" />
                  <Term id="consider">局部座屈を考慮した強さ</Term>
                </dt>
                <dd className="num text-2xl font-bold text-gold">{pct(gl)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-base font-bold">
              {lab.R <= 0.7
                ? '板が十分に厚いので、局部座屈は考えなくてよい柱です。強さは全体座屈だけで決まります。'
                : plateTheory(lab.R) < 1
                  ? '板が薄く、降伏より先に板が波打ちます。連成座屈に注意が要る柱です。'
                  : '設計上、板が波打つ影響を見込む柱です。'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-dim">
              掛け算の形は道路橋示方書の考え方(許容軸方向圧縮応力度 = 局部座屈を考慮しない値 × 局部座屈に対する値 ÷ 上限値)にならっています。線はどちらも平成24年版までの式です。
            </p>
          </Card>
        </div>
      }
      note="この画面の柱は、しくみを示す模式図です(曲がりと波の形・大きさは計算結果ではありません)。「パネル」は、ここではリブと角で区切られた板の1区画を指します。橋の桁では、縦横の補剛材で囲まれた腹板の1区画もパネルと呼び、せん断で波打つ座屈もパネル座屈と呼ばれます。強さの線: 局部座屈を考慮しない強さ = STAGE 4 の道路橋示方書(平成24年版まで)の柱の曲線。板の強さの割合 = STAGE 5 の同じ版の両縁支持板の式(R ≦ 0.7 で 1.0、それより大きいと 0.5/R²)。考慮した強さはその積。実際の連成座屈の強さは、板の余力などでこの積と一致するとは限りません(設計上の安全側の見込み方です)。"
    />
  );
}
