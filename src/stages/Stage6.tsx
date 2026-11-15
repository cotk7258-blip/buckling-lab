import { useState } from 'react';
import { amplification, interaction, safetyFactor } from '../physics/beamcolumn.ts';
import { plateStrength } from '../physics/plate.ts';
import { EX, Stage6Show, strengthG, strengthGL } from '../three/stage6.ts';
import type { Lab6 } from '../three/stage6.ts';
import { Card, LabSlider, StoryShell, useShow } from '../ui/Story.tsx';
import type { SceneText } from '../ui/Story.tsx';
import { Tex } from '../ui/Tex.tsx';
import { Term } from '../ui/glossary.tsx';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const exStr = strengthGL(EX.lam, EX.R);

const SCENES: SceneText[] = [
  {
    kicker: '地図',
    head: '柱の座屈を、3つの確かめ方に整理する',
    body: '設計では、柱が座屈しないことを計算で確かめます。これを照査と呼びます。この章では、3つの照査を順に整理します。①板が波打たないか(局部座屈。軸力だけ)。②柱ごと曲がらないか(全体座屈。軸力だけ)。③上から押す力と、横から曲げる力を同時に受けても耐えられるか(軸力と曲げ)。最後に、どれも同じ「安全率」という物差しで測れることを見ます。まずは部品の名前から。柱は板でできていて、板にはリブ(補剛材)が付き、リブと角で区切られた1区画をパネルと呼びます。',
  },
  {
    kicker: '軸力だけ ①',
    head: '全体座屈。柱が、柱ごと曲がる',
    body: '上から押す力(軸力)だけを受ける柱で、いちばん大きな座屈です。柱全体が弓なりに曲がり、断面の形は四角いまま変わりません。起きやすさを決めるのは、柱の細長さ(細長比パラメータ)。STAGE 2 から STAGE 4 で見てきた座屈が、これです。',
  },
  {
    kicker: '軸力だけ ②',
    head: '局部座屈。板だけが波打つ',
    body: '同じく軸力だけを受ける柱で、柱はまっすぐ立ったまま、断面を作っている板が波打ちます。これが局部座屈です。リブがしっかりしていれば、リブの線と角は動かず、その間のパネルだけが波打ちます(パネル座屈)。起きやすさを決めるのは、パネルの幅と厚みの比(幅厚比パラメータ)。STAGE 5 で見た座屈です。',
  },
  {
    kicker: '軸力だけ ②の補足',
    head: 'リブごと波打つ。補剛板の全体座屈',
    body: 'リブが細くて弱いと、リブの線も一緒にたわんでしまい、板全体が大きな波になります。リブ付きの板(補剛板)が、板として丸ごと座屈するので、補剛板の全体座屈と呼びます。「全体」と付きますが、柱ごと曲がる全体座屈とは別物で、板の中の話です。リブに必要な硬さ(必要剛比)を持たせて防ぎます。',
  },
  {
    kicker: '軸力だけ ①と②',
    head: '局部座屈と全体座屈は、影響し合う',
    body: '板の薄い柱では、先に板が波打つことがあります。波打った板は応力の分布が偏り、板全体としての働きが落ちます(有効幅で評価します)。そのぶん柱の踏ん張りが落ち、柱ごとの座屈が早まります。局部座屈と全体座屈を別々に計算するだけでは、強さを過大に見積もることがある。これが、局部座屈と全体座屈の連成(連成座屈)です。なお、次に出てくる「軸力と曲げを同時に受ける柱」とは、着目する観点が違う話です。',
  },
  {
    kicker: '軸力だけの強さ',
    head: '全体座屈の強さ × 局部座屈の割合',
    body: '設計では、この連成を掛け算で見込みます。「局部座屈を考慮しない強さ」は、板は波打たないものとして全体座屈だけで決めた強さ(STAGE 4 の設計曲線)。「局部座屈を考慮した強さ」は、それに板の強さの割合を掛けたものです。この設計式では、R が 0.7 以下なら局部座屈による低減をしないので、2つは同じになります。ここで見せているのは設計上の低減の考え方で、連成座屈を直接計算したものではありません。実際の強さは、この掛け算と一致するとは限りません。',
  },
  {
    kicker: '軸力だけの安全率',
    head: '安全率 = 強さ ÷ 実際にかかる力',
    body: `強さが分かれば、照査は単純です。実際にかかる力が、強さより十分小さいことを確かめます。その余裕を表すのが安全率で、「いまの力を、あと何倍にできるか」という倍率です。この例の柱は、強さが降伏の ${pct(exStr)}、かかる力が ${pct(EX.n)} なので、安全率は ${(exStr / EX.n).toFixed(1)}。軸力だけなら、局部座屈も全体座屈も、この割り算ひとつで済みます。`,
  },
  {
    kicker: '軸力と曲げ ①',
    head: '曲げが加わると、余力を分け合う',
    body: '実際の柱は、上から押されるだけではありません。地震や風で横からも力を受け、曲げられます。軸力を受けている柱は、その分だけすでに力を使っているので、曲げに使える余力は減ります。グラフは、縦が軸力、横が曲げ。軸力だけなら縦軸の上の点、曲げだけなら横軸の右の点が限界で、その2点を結んだ線の内側なら耐えられる、というのが出発点です。',
  },
  {
    kicker: '軸力と曲げ ②',
    head: '軸力は、曲げを増幅する',
    body: 'ところが、話はそれで終わりません。横から押されて少し曲がった柱を上から押すと、STAGE 3 で見たとおり、押す力が「曲げる力」に化けて、曲がりがさらに大きくなります。軸力は、曲げを増幅するのです。増幅の倍率は 1 ÷ (1 − 軸力 ÷ オイラーの座屈荷重)。軸力が座屈荷重の半分なら2倍、8割なら5倍。そのぶん、耐えられる範囲は直線より内側へへこみます(紫の線)。',
  },
  {
    kicker: '軸力と曲げ ③',
    head: '照査の式と、安全率',
    body: 'ここまでを1行にしたのが、下の照査式です。第1項は軸力が使う分、第2項は増幅された曲げが使う分で、足して 1 以下なら耐えられます。安全率は、軸力だけのときと同じ考え方で求めます。いまの軸力と曲げを同じ割合で増やしていき、紫の線にぶつかるまでの倍率です。ただし増幅があるので、単純な割り算にはなりません。荷重を2倍にすると、曲げの項は2倍より大きくなるからです。',
  },
  {
    kicker: '実験室',
    head: '軸力と曲げを変えて、安全率を見る',
    body: '柱の細長さ、板の薄さ、かかる軸力と曲げを動かしてください。軸力を増やすと、黒い点が上へ動くだけでなく、紫の線に近づく速さが増します(増幅)。細長い柱ほどオイラーの座屈荷重が小さいので、増幅が強く効きます。',
  },
];

export default function Stage6() {
  const [scene, setScene] = useState(0);
  const [lab, setLab] = useState<Lab6>({ lam: 0.8, R: 0.6, n: 0.25, m: 0.25 });
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
  const pu = strengthGL(lab.lam, lab.R);
  const pe = 1 / (lab.lam * lab.lam);
  const k = amplification(lab.n, pe);
  const val = lab.n >= pu ? Infinity : interaction(lab.n, lab.m, pu, pe);
  const sf = safetyFactor(lab.n, lab.m, pu, pe);
  const ok = val <= 1;

  return (
    <StoryShell
      scene={scene}
      total={SCENES.length}
      text={SCENES[scene]}
      onScene={go}
      canvasRef={canvasRef}
      capRef={capRef}
      hint="柱の絵は、しくみを示す模式図です(曲がりと波は見やすく誇張)・横になぞると回り込めます"
      side={
        scene >= 7 ? (
          <div className="rounded-xl border border-studio-700 bg-studio-900 px-3 py-2 text-sm">
            <p className="text-xs font-bold text-ink-dim">
              <Term id="beamcol">軸力と曲げを受ける柱</Term>の<Term id="check">照査</Term>式
            </p>
            <div className="overflow-x-auto py-1 text-base">
              <Tex block>{String.raw`\dfrac{N}{N_u}+\dfrac{M}{M_u\left(1-\dfrac{N}{N_e}\right)}\le 1`}</Tex>
            </div>
            <ul className="space-y-0.5 text-xs leading-relaxed">
              <li>
                <Tex>{'N'}</Tex>、<Tex>{'M'}</Tex> … かかる軸力と曲げ
              </li>
              <li>
                <Tex>{'N_u'}</Tex> … 軸力だけのときの柱の強さ(全体座屈 × 局部座屈)
              </li>
              <li>
                <Tex>{'M_u'}</Tex> … 曲げだけのときの強さ
              </li>
              <li>
                <Tex>{'N_e'}</Tex> … <Term id="pe">オイラーの座屈荷重</Term>。<Tex>{String.raw`1/(1-N/N_e)`}</Tex> が<Term id="ampl">増幅</Term>の倍率
              </li>
            </ul>
            <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                耐えられる限界(増幅あり)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#94a3b8' }} />
                増幅を考えない直線
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
              <li>
                <Term id="panel" /> … リブの間
              </li>
              <li>
                <Term id="plateglobal" /> … リブごと
              </li>
              <li className="col-span-2">
                <Term id="coupled" /> … 板と柱が影響し合う
              </li>
            </ul>
            {scene >= 5 && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-studio-700 pt-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-comp" />
                  局部座屈を考慮しない強さ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                  局部座屈を考慮した強さ
                </span>
              </p>
            )}
          </div>
        )
      }
      lab={
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="柱と、かかる力">
            <LabSlider label="柱の細長さ(細長比パラメータ λ̄)" term="lambda" hint="大きいほど、ひょろ長い柱" value={lab.lam} min={0.2} max={2} step={0.05} show={lab.lam.toFixed(2)} color="#0284c7" onChange={(v) => change({ lam: v })} />
            <LabSlider label="板の薄さ(幅厚比パラメータ R)" term="R" hint="大きいほど、薄くて広い板" value={lab.R} min={0.3} max={2} step={0.05} show={lab.R.toFixed(2)} color="#6d28d9" onChange={(v) => change({ R: v })} />
            <LabSlider label="かかる軸力(上から押す力)" term="load" hint="降伏荷重に対する割合" value={lab.n} min={0} max={0.8} step={0.01} show={pct(lab.n)} color="#1f2a44" onChange={(v) => change({ n: v })} />
            <LabSlider label="かかる曲げ(横からの力)" term="beamcol" hint="曲げだけのときの強さに対する割合" value={lab.m} min={0} max={1} step={0.01} show={pct(lab.m)} color="#ea580c" onChange={(v) => change({ m: v })} />
          </Card>
          <Card title="照査の結果">
            <dl className="space-y-2 text-sm">
              <Row label={<><Term id="global">全体座屈</Term>だけの強さ</>} value={pct(g)} />
              <Row label={<><Term id="local">局部座屈</Term>の割合(設計で認める値)</>} value={`× ${l.toFixed(2)}`} />
              <Row label="軸力だけのときの柱の強さ" value={pct(pu)} />
              <Row label={<><Term id="ampl">曲げの増幅</Term></>} value={Number.isFinite(k) ? `${k.toFixed(2)} 倍` : '発散'} />
              <Row label={<><Term id="check">照査</Term>式の左辺(1 以下で OK)</>} value={Number.isFinite(val) ? val.toFixed(2) : '—'} />
              <div className="flex items-baseline justify-between gap-3 border-t border-studio-700 pt-2">
                <dt className="text-base font-bold">
                  <Term id="safety">安全率</Term>(あと何倍まで耐えるか)
                </dt>
                <dd className={`num text-3xl font-bold ${ok ? 'text-gold' : 'text-yield'}`}>{Number.isFinite(sf) ? sf.toFixed(2) : '—'}</dd>
              </div>
            </dl>
            <p className={`mt-2 text-base font-bold ${ok ? '' : 'text-yield'}`}>
              {!ok
                ? '耐えられません。いまの軸力と曲げは、限界の線の外側です。'
                : lab.m === 0
                  ? '曲げがないので、安全率は 強さ ÷ 軸力 の割り算そのものです。'
                  : `軸力と曲げを ${sf.toFixed(2)} 倍にすると、ちょうど限界になります。`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-dim">
              どれだけの安全率を求めるかは、規準が決めます。許容応力度で設計していた時代の道路橋示方書は、鋼の部材でおよそ 1.7 を基本にしていました(強さを 1.7 で割った値を、許してよい応力としていた)。
            </p>
          </Card>
        </div>
      }
      note="柱の絵は模式図で、曲がりや波の形・大きさは計算結果ではありません。強さの線: 局部座屈を考慮しない強さ = STAGE 4 の道路橋示方書(平成24年版まで)の柱の曲線。局部座屈の割合 = STAGE 5 の同じ版の両縁支持板の式(R ≦ 0.7 で 1.0、それより大きいと 0.5/R²)。考慮した強さはその積で、設計上の低減の考え方です(連成座屈を直接解析した値ではありません)。軸力と曲げの照査式は、設計規準で広く使われる相関式の形(軸力の項+増幅した曲げの項 ≦ 1)を、強さの水準で書いたものです。仮定: 曲げは一方向で、座屈する向きと同じ向き。曲げの強さは一定とし、横ねじれ座屈や、曲げに対する板の局部座屈は考えていません。増幅の倍率 1/(1−N/Ne) は、たわみがサインカーブに近いときの近似です。実際の規準の式は、曲げの向きが2つある場合や、曲げモーメントの分布による補正などを含みます。「複合座屈」という言葉は、文献によって、軸力と曲げを受ける部材の座屈を指す場合と、複数の座屈が影響し合うこと(連成)を指す場合があります。このサイトでは混同を避けるため、前者を「軸力と曲げを受ける柱」、後者を「局部座屈と全体座屈の連成」と呼び分けています。"
    />
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{label}</dt>
      <dd className="num text-lg font-bold">{value}</dd>
    </div>
  );
}
