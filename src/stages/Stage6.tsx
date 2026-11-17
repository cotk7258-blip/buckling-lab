import { useState } from 'react';
import { EX, Stage6Show, strengthGL } from '../three/stage6.ts';
import { Card, StoryShell, openFormulas, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Tex } from '../ui/Tex.tsx';
import { Term } from '../ui/glossary.tsx';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const exStr = strengthGL(EX.lam, EX.R);

const SCENES: SceneText[] = [
  {
    kicker: '地図',
    head: '座屈の照査は、3段でつながっている',
    body: '設計では、柱が座屈しないことを計算で確かめます。これを照査と呼びます。①局部座屈(板が波打たないか。軸力のみ)。②全体座屈(柱ごと曲がらないか。軸力のみ)。③複合座屈(軸力と曲げを同時に受けても耐えられるか)。①の結果が②に、②の結果が③に入っていきます。柱は薄い板でできているので、柱ごと曲がる座屈(全体座屈)と、板が波打つ座屈(局部座屈)の両方を確かめます。',
  },
  {
    kicker: '② 全体座屈',
    head: '全体座屈。柱が、柱ごと曲がる',
    body: '軸力だけを受ける柱で、いちばん大きな座屈です。柱全体が弓なりに曲がり、断面の形は変わりません。起きやすさを決めるのは、細長比パラメータ λ。λ から低減率を選び、局部座屈を考慮しない全体座屈応力 σcg = σy × 低減率 を出します(映像2〜4)。',
  },
  {
    kicker: '① 局部座屈',
    head: '局部座屈。板だけが波打つ',
    body: '同じく軸力だけを受ける柱で、柱はまっすぐ立ったまま、断面を作っている板が波打ちます。角は動かず、その間の板が波打ちます。起きやすさを決めるのは、幅厚比パラメータ R。R から低減率を選び、局部座屈の許容値 σcl = σy × 低減率 を出します(映像5)。',
  },
  {
    kicker: '① と ②',
    head: '局部座屈と全体座屈は、影響し合う',
    body: '板の薄い柱では、先に板が波打つことがあります。波打った板は応力の分布が偏り、板全体としての働きが落ちます(有効幅で評価します)。そのぶん柱の踏ん張りが落ち、柱ごとの座屈が早まります。局部座屈と全体座屈を別々に計算するだけでは、強さを過大に見積もることがあります。',
  },
  {
    kicker: '② の許容値',
    head: 'σcz = σcg × σcl/σy',
    body: '設計では、この影響を掛け算で見込みます。全体座屈応力 σcg に、局部座屈の分 σcl/σy(使える断面の割合)を掛けたものが、全体座屈の許容値 σcz です。R が 0.7 以下なら σcl = σy なので、掛ける数は 1 で σcz = σcg。これは設計上の低減の考え方で、局部座屈と全体座屈の連成を直接計算したものではありません。',
  },
  {
    kicker: '軸力だけの安全率',
    head: '安全率 = 許容値 ÷ 発生応力',
    body: `許容値が分かれば、照査は単純です。発生する圧縮応力 σc が、許容値より小さいことを確かめます。その余裕が安全率で、1.0 以上なら OK。この例の柱は、σcz が降伏の ${pct(exStr)}、σc が ${pct(EX.n)} なので、安全率は ${(exStr / EX.n).toFixed(1)}。軸力だけなら、局部座屈は σcl ÷ σc、全体座屈は σcz ÷ σc の割り算ひとつで済みます。`,
  },
  {
    kicker: '③ 複合座屈',
    head: '曲げが加わると、余力を分け合う',
    body: '実際の柱は、上から押されるだけではありません。地震や風、水圧などで横からも力を受け、曲げられます。軸力と曲げを同時に受ける照査が、複合座屈です。考え方は「使用割合」。軸力が許容値の何割を使い、曲げが許容値の何割を使うかを足して、合計が 1 以下なら OK。グラフは縦が軸力、横が曲げで、どちらもそれだけを受けるときの許容値を 100% としています。',
  },
  {
    kicker: '③ 複合座屈',
    head: '軸力は、曲げを増幅する',
    body: 'ところが、足し算だけでは足りません。横から押されて少し曲がった柱を上から押すと、押す力が「曲げる力」に化けて、曲がりがさらに大きくなります。軸力は、曲げを増幅するのです。照査式では、曲げの使用割合を α = 1 − σc ÷ (0.8σe) で割って、この増幅を入れます。軸力が増えるほど α は小さくなり、曲げが大きく効きます。耐えられる範囲は、直線より内側へへこみます(紫の線)。',
  },
  {
    kicker: '③ 複合座屈',
    head: '使用割合の合計 U と、安全率 1/U',
    body: 'ここまでを1行にしたのが、下の照査式です。第1項は軸力の使用割合で、分母は②の許容値 σcz。第2項は、α で割った曲げの使用割合。合計 U が 1 以下なら OK で、安全率は 1/U です。黒い点が、いま柱にかかっている軸力と曲げ。紫の線までの余裕が、安全率にあたります。α が 0 以下(σc が 0.8σe 以上)になると、この式は使えません。',
  },
  {
    kicker: '計算へ',
    head: '数字を入れて、3つの照査を通してみる',
    body: 'ここまでの式に実際の数字を入れると、R・σcl・λ・σcg・σcz・α・U と安全率が順に出ます。「式と Q&A」の計算ツールで確かめてください。式がどこから来たのか(導出)と、よくある質問への回答も同じページにあります。',
  },
];

export default function Stage6() {
  const [scene, setScene] = useState(0);
  const { canvasRef, capRef, show } = useShow((c) => new Stage6Show(c));
  const go = (n: number) => {
    const next = Math.max(0, Math.min(SCENES.length - 1, n));
    setScene(next);
    // 3D の場面3(補剛板の全体座屈)は使わないので、3 以降は1つ先の番号を渡す
    show.current?.setScene(next >= 3 ? next + 1 : next);
  };

  return (
    <StoryShell
      scene={scene}
      total={SCENES.length}
      text={SCENES[scene]}
      onScene={go}
      canvasRef={canvasRef}
      capRef={capRef}
      labLabel="計算へ ▶"
      hint="柱の絵は、しくみを示す模式図です(曲がりと波は見やすく誇張)・横になぞると回り込めます"
      side={
        scene >= 6 ? (
          <div className="rounded-xl border border-studio-700 bg-studio-900 px-3 py-2 text-sm">
            <p className="text-xs font-bold text-ink-dim">
              <Term id="beamcol">複合座屈</Term>の<Term id="check">照査</Term>式(曲げが1方向の場合)
            </p>
            <div className="overflow-x-auto py-1 text-base">
              <Tex block>{String.raw`U=\dfrac{\sigma_c}{\sigma_{cz}}+\dfrac{\sigma_{bc}}{\sigma_{b}\,\alpha}\le 1,\qquad \alpha=1-\dfrac{\sigma_c}{0.8\,\sigma_e}`}</Tex>
            </div>
            <ul className="space-y-0.5 text-xs leading-relaxed">
              <li>
                <Tex>{'\\sigma_c'}</Tex>、<Tex>{'\\sigma_{bc}'}</Tex> … 発生する軸方向圧縮応力と、曲げによる圧縮縁応力
              </li>
              <li>
                <Tex>{'\\sigma_{cz}'}</Tex> … 全体座屈の許容値(<Tex>{'\\sigma_{cg}\\times\\sigma_{cl}/\\sigma_y'}</Tex>)
              </li>
              <li>
                <Tex>{'\\sigma_b'}</Tex> … 曲げの許容値。<Tex>{'\\sigma_e'}</Tex> … <Term id="pe">オイラー座屈応力</Term>
              </li>
              <li>
                <Term id="safety">安全率</Term> = <Tex>{'1/U'}</Tex>
              </li>
            </ul>
            <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-gold" />U = 1 の線(α あり)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#94a3b8' }} />α を考えない直線
              </span>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-studio-700 bg-studio-900 px-3 py-2 text-sm">
            <p className="text-xs font-bold text-ink-dim">軸力だけを受ける柱の座屈(押すと説明)</p>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <li>
                <Term id="global" /> … 柱ごと
              </li>
              <li>
                <Term id="local" /> … 板が波打つ
              </li>
            </ul>
            {scene >= 4 && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-studio-700 pt-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-comp" />
                  σcg(局部座屈を考慮しない)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                  σcz(局部座屈を考慮した許容値)
                </span>
              </p>
            )}
          </div>
        )
      }
      lab={
        <Card title="式と数字で確かめる">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openFormulas('計算してみる')} className="h-12 rounded-xl bg-comp px-5 text-base font-bold text-white">
              計算してみる(3つの照査を通す)
            </button>
            <button onClick={() => openFormulas('式の導出')} className="h-12 rounded-xl border border-comp px-5 text-base font-bold text-comp">
              式の導出を読む
            </button>
            <button onClick={() => openFormulas('質問と回答')} className="h-12 rounded-xl border border-comp px-5 text-base font-bold text-comp">
              質問と回答を読む
            </button>
          </div>
        </Card>
      }
      note="柱の絵は模式図で、曲がりや波の形・大きさは計算結果ではありません。式は「式と Q&A」のページと同じです(道路橋示方書・平成24年版までの流儀。局部座屈 R ≦ 0.7 で 1.0、それより大きいと 0.5/R²。全体座屈は λ の区分式。複合座屈は使用割合の和で、α = 1 − σc/(0.8σe))。この映像では、曲げは1方向で、座屈する向きと同じ軸としています。2方向の曲げを含む式は「式と Q&A」を見てください。「複合座屈」という言葉は、文献によっては、複数の座屈が影響し合うこと(局部座屈と全体座屈の連成など)を指して使われることもあります。"
    />
  );
}
