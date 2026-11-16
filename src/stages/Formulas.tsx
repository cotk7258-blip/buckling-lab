import { useState } from 'react';
import type { ReactNode } from 'react';
import { check, globalRatio, loadFactor, localRatio } from '../physics/check.ts';
import type { CheckInput } from '../physics/check.ts';
import { Tex } from '../ui/Tex.tsx';

const TABS = ['3つの照査', '式の導出', '質問と回答', '計算してみる', '記号'] as const;
type Tab = (typeof TABS)[number];

export default function Formulas({ onStage, initial }: { onStage: (n: number) => void; initial?: string }) {
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(initial ?? '') ? (initial as Tab) : '3つの照査');
  return (
    <div className="mx-auto mt-2 max-w-4xl">
      <div className="sticky top-0 z-10 -mx-3 flex gap-1.5 overflow-x-auto bg-studio-950/95 px-3 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              window.scrollTo({ top: 0 });
            }}
            aria-current={tab === t ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${
              tab === t ? 'border-comp bg-comp text-white' : 'border-studio-600 bg-studio-900 text-ink-dim'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === '3つの照査' && <Overview go={setTab} onStage={onStage} />}
      {tab === '式の導出' && <Derivations onStage={onStage} />}
      {tab === '質問と回答' && <QandA go={setTab} onStage={onStage} />}
      {tab === '計算してみる' && <Calculator />}
      {tab === '記号' && <Symbols />}
      <p className="mt-8 px-1 text-xs leading-relaxed text-ink-dim">
        このページの式は、道路橋示方書(鋼橋。平成24年版まで)の流儀で書かれた、許容応力度の形の照査式です(局部座屈 R ≦ 0.7 で 1.0・それより大きいと 0.5/R²、全体座屈 λ ≦ 0.2 で 1.0・0.2〜1.0 で
        1.109−0.545λ・1.0 超で 1/(0.773+λ²)、組合せは使用割合の和)。実際の設計では、採用する基準の版と条文を必ず確認してください。数値例はすべて説明用の仮定値です。
      </p>
    </div>
  );
}

/* ---------- 共通の部品 ---------- */

function H({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-7 scroll-mt-16 border-l-4 border-comp pl-3 text-xl font-bold sm:text-2xl">
      {children}
    </h2>
  );
}
function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-2 rounded-xl bg-ink px-4 py-2.5 text-base font-bold leading-snug text-white">{children}</p>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[15px] leading-relaxed sm:text-base">{children}</p>;
}
function Box({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'key' | 'warn' }) {
  const c = tone === 'key' ? 'border-comp bg-studio-900' : tone === 'warn' ? 'border-yield bg-studio-900' : 'border-studio-600 bg-studio-900';
  return <div className={`mt-3 overflow-x-auto rounded-xl border-2 px-4 py-3 ${c}`}>{children}</div>;
}
function F({ children }: { children: string }) {
  return (
    <div className="overflow-x-auto py-1 text-lg">
      <Tex block>{children}</Tex>
    </div>
  );
}
function Step({ n, title, children }: { n: number | string; title: string; children: ReactNode }) {
  return (
    <div className="mt-3 flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-comp text-sm font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{title}</p>
        <div className="text-[15px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
function Movie({ n, label, onStage }: { n: number; label: string; onStage: (n: number) => void }) {
  return (
    <button onClick={() => onStage(n)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-comp px-3 py-2 text-sm font-bold text-comp">
      ▶ 映像で見る: {label}
    </button>
  );
}
function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border border-studio-600 bg-ink px-2 py-1.5 text-left font-bold text-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? 'bg-studio-800' : 'bg-studio-900'}>
              {r.map((c, j) => (
                <td key={j} className="border border-studio-600 px-2 py-1.5 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- 3つの照査 ---------- */

function Overview({ go, onStage }: { go: (t: Tab) => void; onStage: (n: number) => void }) {
  return (
    <div>
      <H>座屈の照査は、3段でつながっている</H>
      <Lead>局部座屈の許容値 σcl が、全体座屈と、軸力+曲げの照査の土台になる</Lead>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          ['① 局部座屈', '薄い板の波打ち', '軸力のみ', String.raw`\sigma_{cl}=\sigma_y\times\text{低減率}(R)`],
          ['② 全体座屈', '柱全体の曲がり', '軸力のみ', String.raw`\sigma_{cz}=\sigma_{cg}\times\dfrac{\sigma_{cl}}{\sigma_y}`],
          ['③ 複合座屈', '軸力と曲げの組合せ', '軸力+曲げ', String.raw`U=\dfrac{\sigma_c}{\sigma_{cz}}+\cdots\le 1`],
        ].map(([t, s, k, f]) => (
          <div key={t} className="rounded-xl border-2 border-studio-600 bg-studio-900 p-3">
            <p className="text-lg font-bold text-comp">{t}</p>
            <p className="text-sm font-bold">{s}</p>
            <p className="text-xs text-ink-dim">{k}</p>
            <div className="overflow-x-auto pt-1 text-sm">
              <Tex block>{f}</Tex>
            </div>
          </div>
        ))}
      </div>

      <H>① 局部座屈: 薄い板の波打ち(軸力のみ)</H>
      <Step n={1} title="幅厚比パラメータ R を求める">
        <F>{String.raw`R=\sqrt{\dfrac{\sigma_y}{\sigma_{el}}}=\dfrac{b}{t}\times\sqrt{\dfrac{\sigma_y}{E}\times\dfrac{12(1-\nu^2)}{\pi^2 k}}`}</F>
        b: 板の幅、t: 板厚(腐食があれば腐食後)、k: 支え方で決まる座屈係数(自由突出板 0.43、両縁支持板 4.0)。
      </Step>
      <Step n={2} title="R から低減率を選び、局部座屈の許容値 σcl を出す">
        <Table
          head={['R の範囲', '低減率 σcl/σy']}
          rows={[
            ['R ≦ 0.7', '1.0(低減なし)'],
            ['R > 0.7', <Tex>{String.raw`0.5/R^2`}</Tex>],
          ]}
        />
        <F>{String.raw`\sigma_{cl}=\sigma_y\times\text{低減率}`}</F>
      </Step>
      <Step n={3} title="安全率">
        <F>{String.raw`\text{安全率}=\dfrac{\sigma_{cl}}{\sigma_c}\quad(\sigma_c\text{: 発生する圧縮応力。1.0 以上で OK})`}</F>
      </Step>
      <Movie n={5} label="板の座屈" onStage={onStage} />

      <H>② 全体座屈: 柱全体の曲がり(軸力のみ)</H>
      <Step n={1} title="有効座屈長 l と、細長比パラメータ λ を求める">
        <F>{String.raw`l=\beta L,\qquad r=\sqrt{\dfrac{I}{A}},\qquad \lambda=\dfrac{1}{\pi}\sqrt{\dfrac{\sigma_y}{E}}\times\dfrac{l}{r}`}</F>
      </Step>
      <Step n={2} title="λ から低減率を選び、全体座屈応力 σcg を出す(局部座屈は考慮しない値)">
        <Table
          head={['λ の範囲', '低減率 σcg/σy', '傾向']}
          rows={[
            ['λ ≦ 0.2', '1.0(低減なし)', '降伏応力に近い'],
            ['0.2 < λ ≦ 1.0', <Tex>{String.raw`1.109-0.545\lambda`}</Tex>, '降伏と座屈の両方が影響'],
            ['1.0 < λ', <Tex>{String.raw`1/(0.773+\lambda^2)`}</Tex>, 'オイラー座屈が支配的'],
          ]}
        />
      </Step>
      <Step n={3} title="局部座屈の分を掛けて、全体座屈の許容値 σcz にする">
        <F>{String.raw`\sigma_{cz}=\sigma_{cg}\times\dfrac{\sigma_{cl}}{\sigma_{c0}}\qquad(\sigma_{c0}=\sigma_y)`}</F>
        なぜ掛けるのかは「質問と回答」の Q8 に。
      </Step>
      <Step n={4} title="安全率">
        <F>{String.raw`\text{安全率}=\dfrac{\sigma_{cz}}{\sigma_c}`}</F>
      </Step>
      <Movie n={4} label="設計曲線" onStage={onStage} />

      <H>③ 複合座屈: 軸力と曲げの組合せ</H>
      <Lead>軸力と2方向の曲げの「使用割合」を足し、合計が 1 以下であることを確かめる</Lead>
      <Box tone="key">
        <F>{String.raw`U=\dfrac{\sigma_c}{\sigma_{cz}}+\dfrac{\sigma_{bcy}}{\sigma_{bgy}\,\alpha_y}+\dfrac{\sigma_{bcz}}{\sigma_{b0}\,\alpha_z}\le 1`}</F>
        <F>{String.raw`\alpha_y=1-\dfrac{\sigma_c}{0.8\,\sigma_{ey}},\quad \alpha_z=1-\dfrac{\sigma_c}{0.8\,\sigma_{ez}},\quad \sigma_{e}=\dfrac{\pi^2E}{(l/r)^2}`}</F>
      </Box>
      <Table
        head={['項', '意味', '分母の意味']}
        rows={[
          ['第1項', '軸力の使用割合', '全体座屈の許容値 σcz(②の結果)'],
          ['第2項', '強軸 y まわりの曲げの使用割合', '横倒れ座屈の許容値 σbgy × αy'],
          ['第3項', '弱軸 z まわりの曲げの使用割合', '曲げの基準値 σb0 × αz'],
        ]}
      />
      <F>{String.raw`\text{安全率}=\dfrac{1}{U}`}</F>
      <P>
        軸力が増えると α が小さくなり、曲げの使用割合が大きくなります。適用条件は αy &gt; 0、αz &gt; 0(σc が 0.8σe より小さいこと)。引張の軸力や、局部座屈の照査は別の式で確かめます。
      </P>
      <Movie n={6} label="座屈の照査" onStage={onStage} />
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => go('式の導出')} className="rounded-lg bg-comp px-4 py-2.5 text-sm font-bold text-white">
          この式はどこから来たのか → 式の導出
        </button>
        <button onClick={() => go('計算してみる')} className="rounded-lg border border-comp px-4 py-2.5 text-sm font-bold text-comp">
          数字を入れて確かめる → 計算してみる
        </button>
      </div>
    </div>
  );
}

/* ---------- 式の導出 ---------- */

function Derivations({ onStage }: { onStage: (n: number) => void }) {
  return (
    <div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {[
          ['d1', '1 オイラー座屈'],
          ['d2', '2 応力の形と端部条件'],
          ['d3', '3 板の σel'],
          ['d4', '4 λ'],
          ['d5', '5 R'],
          ['d6', '6 低減率'],
          ['d7', '7 α'],
        ].map(([id, t]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-studio-600 bg-studio-900 px-3 py-1 font-bold text-comp">
            {t}
          </a>
        ))}
      </div>

      <H>導出の前に: 座屈は「釣合いの分かれ道」</H>
      <Lead>座屈は、「まっすぐ」と「曲がったまま」の両方で釣り合える荷重に達した瞬間に起こる</Lead>
      <Table
        head={['① 荷重が小さいうち', '② 座屈荷重に達する', '③ それを超えると']}
        rows={[['横から少し押して曲げても、手を離すと元に戻る。まっすぐな状態が安定。', '曲がった形のままでも力が釣り合う。まっすぐ/曲がる、の分かれ道。', 'わずかな曲がりが戻らず、どんどん大きくなる。これが座屈。']]}
      />
      <P>
        導出の方針は、柱も板も同じです。「少しだけ曲がった状態」を考え、その状態で力が釣り合う条件を式にします。曲がったまま釣り合える荷重のうち、最も小さいものが座屈荷重です。前提は、柱が完全にまっすぐで、荷重は断面の中心にかかり、材料はどこまでも弾性(力と変形が比例)であること。
      </P>
      <Movie n={2} label="オイラー座屈(曲げる力と戻す力の綱引き)" onStage={onStage} />

      <H id="d1">1. オイラー座屈: 曲がった柱の釣合い</H>
      <Step n={1} title="外力が曲げようとする力(モーメント)">
        位置 x で柱が y だけ横にずれると、軸力 P は「腕の長さ y」で柱を回そうとします。
        <F>{String.raw`M=P\times y`}</F>
      </Step>
      <Step n={2} title="柱が曲げに抵抗する力">
        梁の基本式です。y″ は曲がり具合(曲率)、EI は曲げ剛性(E は材料の硬さ、I は断面の曲げにくさ)。
        <F>{String.raw`\text{抵抗モーメント}=-EI\,y''`}</F>
        <Movie n={1} label="曲げとテコ(なぜ M = EI × 曲率 か)" onStage={onStage} />
      </Step>
      <Step n={3} title="2つが釣り合う条件">
        マイナスは「たわみを戻す向き」の意味です。移項すると、柱の釣合い式になります。
        <Box tone="key">
          <F>{String.raw`P\,y=-EI\,y''\quad\Longrightarrow\quad EI\,y''+P\,y=0`}</F>
        </Box>
      </Step>
      <Step n={4} title="式を整理して、解の形を見つける">
        両辺を EI で割り、k² = P/EI とおくと y″ + k²y = 0。これを y″ = −k²y と読むと、「曲がり具合は、ずれ y に比例して逆向き」。ずれが大きい所ほど強く元に戻る向きに曲がる形は、波(sin・cos)です。
        <F>{String.raw`y=A\sin kx+B\cos kx\qquad(\text{確かめ: }(\sin kx)''=-k^2\sin kx)`}</F>
      </Step>
      <Step n={5} title="両端の条件(両端ピン)を入れる">
        両端は横に動けないので、x = 0 と x = l で y = 0。
        <F>{String.raw`x=0:\;B=0\qquad x=l:\;A\sin kl=0`}</F>
      </Step>
      <Step n={6} title="分かれ道">
        A = 0 なら、まっすぐのまま(どんな荷重でも成り立つ)。A ≠ 0 で成り立つのは sin kl = 0、つまり kl = nπ(n = 1, 2, 3…)のときだけ。これが「曲がったまま釣り合える」荷重です。曲がりの大きさ A は決まらず、形だけが決まります。いちばん小さい n = 1 をとると、
        <F>{String.raw`kl=\pi\;\to\;k^2=\dfrac{\pi^2}{l^2}\;\to\;\dfrac{P}{EI}=\dfrac{\pi^2}{l^2}`}</F>
        <Box tone="key">
          <F>{String.raw`P_e=\dfrac{\pi^2EI}{l^2}\qquad(\text{オイラーの座屈荷重})`}</F>
        </Box>
        n = 2 は半波が2つの形で、荷重は4倍。π は、座屈の形がサインカーブであることから来ています。
      </Step>

      <H id="d2">2. 応力の形と、端部条件</H>
      <Step n={1} title="荷重を応力に直す">
        応力 = 荷重 ÷ 断面積。断面二次半径 r = √(I/A) を使うと I = A·r² なので、A が消えます。
        <F>{String.raw`\sigma_e=\dfrac{P_e}{A}=\dfrac{\pi^2E\,(A r^2)}{A\,l^2}`}</F>
        <Box tone="key">
          <F>{String.raw`\sigma_e=\dfrac{\pi^2E}{(l/r)^2}\qquad(\text{オイラー座屈応力})`}</F>
        </Box>
        l/r が細長比。細長比が2倍になると σe は 1/4。E と形(l/r)だけで決まり、σy は入りません。
      </Step>
      <Step n={2} title="端部の拘束は「有効座屈長」で表す">
        l を le に置き換えるだけです。拘束が強いほど曲がる区間が短くなり、σe が上がります。板では、この「支え方の効果」が係数 k に入ります。
        <Table
          head={['端部の条件', 'le', 'σe(両端ピン比)']}
          rows={[
            ['両端ピン', '1.0 l', '1 倍'],
            ['一端固定・他端ピン', '0.7 l', '約 2 倍'],
            ['両端固定', '0.5 l', '4 倍'],
            ['一端固定・他端自由', '2.0 l', '1/4 倍'],
          ]}
        />
      </Step>

      <H id="d3">3. 柱から板へ: 弾性局部座屈応力 σel</H>
      <Lead>長い板は「長さ b の帯(柱)」が並んだもの。オイラー式に2つの補正を掛けるだけで σel になる</Lead>
      <Step n={0} title="出発点">
        <F>{String.raw`\sigma_e=\dfrac{\pi^2E}{(l/r)^2},\qquad r=\sqrt{I/A}`}</F>
      </Step>
      <Step n={1} title="板の帯を、柱とみなす">
        幅 1・厚さ t の帯は長方形断面なので I = t³/12、A = t、r = t/√12。波1つの長さを b とすると (l/r)² = 12(b/t)²。
        <F>{String.raw`\sigma=\dfrac{\pi^2E}{12}\left(\dfrac{t}{b}\right)^2`}</F>
      </Step>
      <Step n={2} title="板は横に縮めない(ポアソン効果)">
        帯は隣の帯とつながっていて、幅方向に自由に縮めません。そのぶん少し硬くなります(ν = 0.3 で約 1.1 倍)。
        <F>{String.raw`\times\dfrac{1}{1-\nu^2}`}</F>
      </Step>
      <Step n={3} title="縁端の支え">
        両側の支えが波打ちを抑えます。その効果を係数 k で表します。
        <F>{String.raw`\times k`}</F>
        <Box tone="key">
          <F>{String.raw`\sigma_{el}=\dfrac{k\pi^2E}{12(1-\nu^2)}\left(\dfrac{t}{b}\right)^2`}</F>
        </Box>
        板の曲げ剛性 D = Et³/{'{'}12(1−ν²){'}'} で書くと σel = kπ²D/(b²t) で、同じ式です。
      </Step>
      <Table
        head={['縁端の支え方', 'k', '例']}
        rows={[
          ['両縁 単純支持', '4.0', '箱形断面の板など'],
          ['両縁 固定', '6.97', '理論上の上限側'],
          ['一縁 固定・一縁 自由', '1.28', '—'],
          ['一縁 単純支持・一縁 自由', '0.425(設計では 0.43)', '自由突出板(フランジの突出部など)'],
        ]}
      />
      <Table
        head={['要素', '柱(オイラー座屈)', '板(局部座屈)']}
        rows={[
          ['細長さ', 'l/r', 'b/t'],
          ['支え方', '有効座屈長 le', '係数 k(縁端支持+波の形)'],
          ['ポアソン比', 'なし', '1/(1−ν²)(約 1.1 倍)'],
          ['基本の形', 'π²E × (1/細長比)²', 'π²E × (t/b)² × 係数'],
        ]}
      />
      <P>片側が自由になるだけで k は約 1/10。同じ b/t でも σel は約 1/10 になります。</P>
      <Movie n={5} label="板の座屈(幅が半分で4倍、リブの効果)" onStage={onStage} />

      <H id="d4">4. λ(細長比パラメータ)の導出</H>
      <Lead>λ は「降伏応力 σy」と「オイラー座屈応力 σe」の比の平方根。σe の式を代入すると、照査で使う λ の式になる</Lead>
      <Step n={1} title="定義">
        降伏が先か、座屈が先かを測る物差しです。
        <F>{String.raw`\lambda=\sqrt{\dfrac{\sigma_y}{\sigma_e}}`}</F>
      </Step>
      <Step n={2} title="オイラー式を代入">
        <F>{String.raw`\dfrac{\sigma_y}{\sigma_e}=\sigma_y\div\dfrac{\pi^2E}{(l/r)^2}=\dfrac{\sigma_y\,(l/r)^2}{\pi^2E}`}</F>
      </Step>
      <Step n={3} title="平方根をとって、並べ替える">
        <Box tone="key">
          <F>{String.raw`\lambda=\dfrac{1}{\pi}\sqrt{\dfrac{\sigma_y}{E}}\times\dfrac{l}{r}`}</F>
        </Box>
        材料で決まる部分 √(σy/E) × 形で決まる細長比 l/r。
      </Step>
      <P>
        <strong>読み方</strong>: λ &lt; 1 なら σe &gt; σy で先に降伏(短く太い柱)。λ = 1 で座屈と降伏が同時。λ &gt; 1 なら先に弾性座屈(長く細い柱)。言いかえると、λ は「σe = σy になる基準の柱の、何倍細長いか」です。基準の柱の細長比は π√(E/σy)(σy = 235、E = 2.0×10⁵ N/mm² なら約 92)。
      </P>
      <P>
        <strong>なぜ √ をとるのか</strong>: 比べたいのは σy と σe(1 が境目)です。σe は細長比の2乗で効くので、比のままだと「面積の比」のような量になります。√ をとると判定は変えずに、「細長さ(辺の長さ)の比」の目盛りに直せます。面積が4倍の正方形の辺が2倍なのと同じです。
      </P>

      <H id="d5">5. R(幅厚比パラメータ)の導出</H>
      <Lead>R も λ と同じく「σy と σel の比」。σel の式を代入すると、照査で使う R の式になる</Lead>
      <Step n={1} title="定義">
        <F>{String.raw`R=\sqrt{\dfrac{\sigma_y}{\sigma_{el}}}`}</F>
      </Step>
      <Step n={2} title="σel を代入">
        <F>{String.raw`\dfrac{\sigma_y}{\sigma_{el}}=\dfrac{12(1-\nu^2)\,\sigma_y\,(b/t)^2}{k\pi^2E}`}</F>
      </Step>
      <Step n={3} title="平方根をとる">
        <Box tone="key">
          <F>{String.raw`R=\dfrac{b}{t}\times\sqrt{\dfrac{12(1-\nu^2)\,\sigma_y}{k\pi^2E}}`}</F>
        </Box>
      </Step>
      <Step n={4} title="λ と比べる">
        <F>{String.raw`R=\dfrac{1}{\pi}\sqrt{\dfrac{\sigma_y}{E}}\times\dfrac{b}{t}\times\sqrt{\dfrac{12(1-\nu^2)}{k}}`}</F>
        λ と同じ形です。l/r が b/t に替わり、補正 √{'{'}12(1−ν²)/k{'}'} が付くだけ。
      </Step>
      <P>
        <strong>読み方</strong>: R = 1 になる b/t が基準です(σy = 205、E = 2.06×10⁵ N/mm² のとき、自由突出板 k = 0.43 で約 19.8、両縁支持板 k = 4.0 で約 60)。R &gt; 1 なら降伏する前に弾性座屈。b/t だけでは鋼種や支え方の違う板を比べられませんが、R にすれば「R ≦ 0.7 なら低減なし」の1本の基準で判定できます。
      </P>

      <H id="d6">6. 低減率: 理論値から設計式へ</H>
      <Lead>設計曲線は、弾性座屈(理想状態の上限)を降伏で頭打ちにし、初期不整の分だけ下げた線</Lead>
      <P>
        弾性座屈の低減率は、定義から 1/λ²、1/R² です(σe/σy = 1/λ²)。設計式は、これを降伏(1.0)で頭打ちにし、初期たわみ・残留応力の影響を、座屈実験と解析に基づいて差し引いたものです。
      </P>
      <Curves />
      <Step n={1} title="局部座屈の R > 0.7 の式を読み替える">
        R² = σy/σel を代入すると、σy が打ち消し合います。
        <Box tone="key">
          <F>{String.raw`\sigma_{cl}=0.5\times\dfrac{\sigma_y}{R^2}=0.5\times\sigma_y\times\dfrac{\sigma_{el}}{\sigma_y}=0.5\times\sigma_{el}`}</F>
        </Box>
        つまり R &gt; 0.7 の許容値は、理想の平板の弾性座屈応力の「半分」です。
      </Step>
      <Step n={2} title="境界値は、区分式が「つながる点」">
        <Table
          head={['境界', '左側の式', '右側の式']}
          rows={[
            ['R = 0.7', '1.0', '0.5/0.7² = 1.02'],
            ['λ = 0.2', '1.0', '1.109 − 0.545×0.2 = 1.000'],
            ['λ = 1.0', '1.109 − 0.545 = 0.564', '1/(0.773+1) = 0.564'],
          ]}
        />
        0.5/R² が 1.0 になるのは R = √0.5 = 0.707。「低減式が降伏の上限とぶつかる点」を丸めた値が 0.7 です。
      </Step>
      <Movie n={3} label="理想と現実(なぜ理論値に届かないか)" onStage={onStage} />

      <H id="d7">7. α: 軸力が曲げを増やす効果</H>
      <Step n={1} title="初期たわみのある柱では、軸力で曲げが増える">
        少し曲がった柱を押すと、押す力 × ずれ の分だけ曲げが増え、たわみも曲げも次の倍率になります(P-δ 効果)。
        <F>{String.raw`\text{増幅}=\dfrac{1}{1-\sigma_c/\sigma_e}`}</F>
      </Step>
      <Step n={2} title="照査式の α は、その逆数にあたる">
        曲げの使用割合を α で割ることで、増幅された曲げで評価します。0.8 は σe を安全側に低く見る係数です。
        <Box tone="key">
          <F>{String.raw`\alpha=1-\dfrac{\sigma_c}{0.8\,\sigma_e}`}</F>
        </Box>
      </Step>
      <Table
        head={['α の状態', '式の扱い']}
        rows={[
          ['α が 1 に近い', '軸力による付加曲げの影響が小さい'],
          ['α が 0 に近づく', '曲げの項が急増。入力値の丸めに敏感になる。入力精度と適用条件を確認'],
          ['α ≦ 0', 'この照査式の適用範囲外(σc が 0.8σe 以上)。負の安全率を解釈しない'],
        ]}
      />
      <Movie n={6} label="座屈の照査(軸力は曲げを増幅する)" onStage={onStage} />
    </div>
  );
}

/** 低減率の曲線(全体座屈と局部座屈)。mark があればその位置に点を打つ */
function Curves({ lam, R }: { lam?: number; R?: number }) {
  const W = 300;
  const Hh = 190;
  const m = { l: 34, r: 8, t: 10, b: 30 };
  const X = (v: number) => m.l + (v / 2) * (W - m.l - m.r);
  const Y = (v: number) => Hh - m.b - (v / 1.2) * (Hh - m.t - m.b);
  const path = (f: (v: number) => number) =>
    Array.from({ length: 101 }, (_, i) => {
      const v = (2 * i) / 100;
      return `${X(v).toFixed(1)},${Y(Math.min(1.2, f(v))).toFixed(1)}`;
    }).join(' ');
  const plot = (title: string, xl: string, f: (v: number) => number, marks: number[], mark?: number) => (
    <div className="min-w-0">
      <p className="text-sm font-bold">{title}</p>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="block w-full" role="img" aria-label={title}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={m.l} y1={Y(v)} x2={W - m.r} y2={Y(v)} stroke="#d5dce8" />
            <text x={m.l - 5} y={Y(v) + 4} fontSize={11} textAnchor="end" fill="#55637b">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 0.5, 1, 1.5, 2].map((v) => (
          <text key={v} x={X(v)} y={Hh - m.b + 14} fontSize={11} textAnchor="middle" fill="#55637b">
            {v.toFixed(1)}
          </text>
        ))}
        <text x={(W + m.l) / 2} y={Hh - 2} fontSize={11} textAnchor="middle" fill="#1b2740">
          {xl}
        </text>
        <polyline points={path((v) => (v <= 0 ? 1 : Math.min(1, 1 / (v * v))))} fill="none" stroke="#ea580c" strokeWidth={2} strokeDasharray="6 4" />
        <polyline points={path(f)} fill="none" stroke="#1b2740" strokeWidth={2.5} />
        {marks.map((v) => (
          <g key={v}>
            <line x1={X(v)} y1={Y(0)} x2={X(v)} y2={Y(f(v))} stroke="#55637b" strokeDasharray="3 3" />
            <rect x={X(v) - 4} y={Y(f(v)) - 4} width={8} height={8} fill="#6d28d9" transform={`rotate(45 ${X(v)} ${Y(f(v))})`} />
          </g>
        ))}
        {mark !== undefined && <circle cx={X(Math.min(2, mark))} cy={Y(f(Math.min(2, mark)))} r={6} fill="#e11d48" stroke="#fff" strokeWidth={2} />}
      </svg>
    </div>
  );
  return (
    <div className="mt-3 rounded-xl border border-studio-600 bg-studio-900 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {plot('全体座屈(柱): σcg/σy と λ', '細長比パラメータ λ', globalRatio, [0.2, 1], lam)}
        {plot('局部座屈(板): σcl/σy と R', '幅厚比パラメータ R', localRatio, [0.7], R)}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
        <span>
          <span className="font-bold" style={{ color: '#1b2740' }}>
            ━
          </span>{' '}
          設計式
        </span>
        <span>
          <span className="font-bold text-tens">┅</span> 弾性座屈 1/λ²、1/R²(上限 1.0)
        </span>
        <span>
          <span className="font-bold text-gold">◆</span> 式が切り替わる境界
        </span>
      </p>
      <p className="mt-1 text-xs text-ink-dim">
        全体座屈は中間域(λ = 0.2〜1.0)で弾性座屈との差が最大で、λ が大きいと弾性座屈に近づきます。局部座屈は R &gt; 0.7 で常に弾性座屈の 50%。
      </p>
    </div>
  );
}

/* ---------- 質問と回答 ---------- */

function QA({ q, a, children }: { q: string; a: string; children: ReactNode }) {
  return (
    <details className="mt-3 rounded-xl border border-studio-600 bg-studio-900 open:border-comp">
      <summary className="cursor-pointer list-none px-4 py-3">
        <span className="block text-lg font-bold leading-snug">{q}</span>
        <span className="mt-1 block text-[15px] font-bold leading-snug text-comp">{a}</span>
        <span className="mt-1 block text-xs text-ink-dim">押すと、くわしい説明が開きます</span>
      </summary>
      <div className="border-t border-studio-600 px-4 pb-4 text-[15px] leading-relaxed">{children}</div>
    </details>
  );
}
function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}
function Sub({ children }: { children: ReactNode }) {
  return <p className="mt-3 font-bold text-ink">{children}</p>;
}

function QandA({ go, onStage }: { go: (t: Tab) => void; onStage: (n: number) => void }) {
  const el = (v: number) => (v <= 1 ? '1.0(頭打ち)' : (1 / (v * v)).toFixed(2));
  return (
    <div>
      <H>座屈式の考え方: よくある質問</H>
      <QA q="Q1 なぜ降伏応力が座屈評価に入るのか" a="座屈耐力の「天井」が降伏応力。低減率は、その何割まで使えるかを表すため。">
        <Sub>理由1 短い柱・厚い板は、座屈せず「降伏」で耐力が決まる</Sub>
        <UL items={['座屈しにくい部材でも、応力が σy に達すると断面が塑性化して耐力を失う。', 'よって耐力の上限は σy(σc0 = σy)。']} />
        <Sub>理由2 実際の座屈は「弾性」だけでは終わらない</Sub>
        <UL
          items={[
            '初期たわみ・残留応力があると、断面の一部が先に降伏し、理想の弾性座屈応力より低い応力で耐力を失う(非弾性座屈)。',
            '断面の一部が降伏し始める荷重は σy で決まるため、座屈耐力も σy に依存する。',
          ]}
        />
        <Sub>理由3 σy で割ると、鋼種によらず1本の曲線で整理できる</Sub>
        <UL items={['耐力を σcr/σy、細長さを R・λ(どちらも σy を含む)で表すと、試験結果が材料によらずまとまる。', '式が「σy × 低減率」の形をしているのはこのため。']} />
        <Sub>式の中の σy には2つの役割がある</Sub>
        <F>{String.raw`\text{① 掛ける側(耐力の天井): }\sigma_{cl}=\sigma_y\times\text{低減率}\qquad\text{② パラメータの中: }R=\sqrt{\sigma_y/\sigma_{el}},\;\lambda=\sqrt{\sigma_y/\sigma_e}`}</F>
        <Sub>補足 「降伏の進み方は σy で決まる」とは</Sub>
        <P>座屈は「曲がりへの抵抗」を失う現象です。抵抗を奪うのが降伏で、降伏がいつ始まるかを決めるのが σy です。</P>
        <F>{String.raw`\text{縁の応力}=\text{平均応力}+\text{残留応力}+\text{曲げによる付加応力}`}</F>
        <P>この縁の応力が σy に達した瞬間に降伏が始まります。つまり、降伏が始まるときの平均応力 = σy − 残留応力 − 付加応力。</P>
        <Table
          head={['N/mm²(説明用の仮定値)', 'σy = 205', 'σy = 315']}
          rows={[
            ['縁の残留応力(圧縮)', '60', '60'],
            ['曲げによる付加応力', '40', '40'],
            ['降伏が始まる平均応力', '105', '215'],
          ]}
        />
        <P>弾性座屈 σe = π²E/(l/r)² は E と形だけで決まり、σy を含みません。実際の耐力は「σe(曲がりやすさ)」と「σy(降伏の始まり)」の両方で決まるので、座屈式に σy が入ります。</P>
        <Movie n={3} label="理想と現実(先端が先に降伏する)" onStage={onStage} />
      </QA>

      <QA q="Q2 R 値の物理的意味は" a="降伏応力と弾性局部座屈応力の比。板の薄さを「材料・支え方」で正規化した指標。">
        <F>{String.raw`R=\sqrt{\sigma_y/\sigma_{el}}`}</F>
        <UL
          items={[
            'R < 1: 弾性座屈より先に降伏に達する(厚い・幅の狭い板)。',
            'R = 1: 理想状態なら、降伏と弾性座屈が同時に起こる。',
            'R > 1: 降伏する前に弾性座屈が起こる(薄い・幅の広い板)。',
          ]}
        />
        <Sub>幅厚比 b/t との関係: R は「b/t + 材料・支え方の補正」</Sub>
        <UL
          items={[
            '薄く幅広い板ほど波打ちやすい。σel は (t/b)² に比例する(b/t が2倍なら σel は 1/4)。',
            'これを R の定義に入れると、R は b/t に比例する。',
            '補正①材料: σy が高いほど R は大きい(降伏しにくい分、先に波打ちが問題になる)。',
            '補正②支え方: k が小さいほど R は大きい。同じ b/t でも、両縁支持(k = 4.0)の R は自由突出(k = 0.43)の約 1/3。',
            '全体座屈の λ も同じ構造(柱版の R)。',
          ]}
        />
        <button onClick={() => go('式の導出')} className="mt-3 rounded-lg border border-comp px-3 py-2 text-sm font-bold text-comp">
          R の導出を見る
        </button>
      </QA>

      <QA q="Q3 R = 0.7 や λ = 0.2・1.0 という境界値の根拠は" a="理論上の「しきい値」ではなく、試験データの下側に引いた区分式が「つながる点」。">
        <Sub>R = 0.7(局部座屈)</Sub>
        <UL items={['R > 0.7 の式 0.5/R² が 1.0 になるのは R = √0.5 = 0.707。「低減式が降伏の上限(1.0)とぶつかる点」を丸めた値。', 'R ≦ 0.7 の板は、初期たわみ・残留応力があっても降伏応力まで耐える範囲とされる。']} />
        <Sub>λ = 0.2 / 1.0(全体座屈)</Sub>
        <UL items={['λ = 0.2: 1.109 − 0.545×0.2 = 1.000。低減なしの領域とつながる点。', 'λ = 1.0: 1.109 − 0.545 = 0.564、1/(0.773+1) = 0.564。2つの式が連続する点。']} />
        <P>曲線の係数(0.5、1.109、0.545、0.773)は、座屈実験のデータと、初期不整を考慮した解析から定めた設計式です。実験の最大強度そのものではなく、下側に余裕を持たせた線です。係数の具体的な決め方(平均か下限か、対象の板種)は、採用する基準の解説と原論文で確認が必要です。</P>
        <Movie n={4} label="設計曲線(点の群れの下側に線を引く)" onStage={onStage} />
      </QA>

      <QA q="Q4 低減率の物理的意味は。安全率とどう違うのか" a="低減率 = 設計上の座屈耐力 ÷ 降伏応力。降伏応力の「何割まで使えるか」を表す。">
        <UL items={['低減率 1.0: 断面全体が降伏応力まで働ける(座屈の影響なし)。', '低減率 0.4: 平均応力が降伏応力の4割に達した時点で、それ以上の荷重を設計上は負担させない。']} />
        <Sub>低減が生じる原因</Sub>
        <UL items={['弾性座屈: 薄い・細長いほど、理想状態でも低い応力で座屈する。', '初期たわみ: 最初から曲がっているため、軸力で曲げが増幅される。', '残留応力: 溶接で生じた応力により、断面の一部が早く降伏する。']} />
        <Sub>安全率との違い</Sub>
        <UL items={['低減率 = 耐力そのものの見積もり(現象側)。', '安全率 = 見積もった耐力に対する設計上の余裕(ルール側)。']} />
        <P>ただし局部座屈の 0.5/R²(= 0.5σel)の 0.5 には、①初期たわみ・残留応力による耐力低下 と、②R が大きい板ほど増やした余裕(最大強度の後に急に耐力が落ちるため)の両方が含まれます。まとめると、「σcl/σy は設計上の耐力の低減。耐力低下と余裕を含むが、許容応力の安全率とは別に定められた係数」です。</P>
      </QA>

      <QA q="Q5 弾性座屈(理論値)と設計式は、どういう関係か" a="弾性座屈は「理想状態の上限」。設計式は降伏で頭打ちにし、初期不整の分だけ下げた曲線。">
        <UL
          items={[
            '弾性座屈の前提: 完全に平ら・まっすぐ、残留応力なし、材料は無限に弾性。',
            '太く短い部材: 弾性座屈応力は σy より大きいが、実際は降伏で頭打ち。',
            '中間の部材: 降伏と座屈が影響し合い、どちらの理論値よりも低い(差が最大)。',
            '細長い部材: 弾性座屈に近づくが、初期不整の分だけ下回る。',
          ]}
        />
        <Table
          head={['パラメータ', '弾性座屈(上限 1.0)', '設計式']}
          rows={[
            ...[1.0, 1.5].map((v) => [`局部 R = ${v.toFixed(1)}`, el(v), localRatio(v).toFixed(2)]),
            ...[0.5, 1.0, 1.5, 2.0].map((v) => [`全体 λ = ${v.toFixed(1)}`, el(v), globalRatio(v).toFixed(2)]),
          ]}
        />
        <Curves />
      </QA>

      <QA q="Q6 式は、どのような釣合い・理論から導かれているのか" a="弾性座屈は「曲がった状態での力の釣合い」から理論的に導かれる。低減曲線は、理論+試験の経験式。">
        <UL
          items={[
            <>柱(オイラー座屈): 少し曲がった柱で、外力による曲げ P·y と断面の抵抗曲げ EI·y″ が釣り合う。EI·y″ + P·y = 0 → Pe = π²EI/l²。</>,
            <>板(局部座屈): 板の曲げ剛性 D と面内圧縮力の釣合い。支持条件ごとに解くと係数 k が決まる → σel = kπ²E/{'{'}12(1−ν²){'}'} × (t/b)²。</>,
            '実際の耐力(低減曲線): 初期たわみのある柱では軸力で曲げが 1/(1−σ/σe) 倍に増える。縁の応力が σy に達した時を耐力とする考え方(ペリー・ロバートソン型)に、残留応力を含む試験・解析結果を合わせて定めた式。',
          ]}
        />
        <button onClick={() => go('式の導出')} className="mt-3 rounded-lg bg-comp px-3 py-2 text-sm font-bold text-white">
          微分方程式を解く過程まで見る → 式の導出
        </button>
      </QA>

      <QA q="Q7 この評価は特定の構造物に特有か。一般の鋼構造物でも同じか" a="座屈の考え方と式の形は、鋼構造物全般で共通。構造物ごとに違うのは「入力条件」の側。">
        <Sub>共通している点</Sub>
        <UL items={['弾性座屈理論(オイラー・板の座屈)と、「σy × 低減率」の評価体系は鋼構造物全般で共通。', 'ここでの区分式(R ≦ 0.7 / 0.5/R²、λ = 0.2・1.0)は、道路橋示方書(鋼橋)の基準耐荷力曲線と同じ形。']} />
        <Sub>基準による違い</Sub>
        <UL
          items={[
            '橋梁(道路橋示方書): ここで扱った形の曲線。',
            '建築(日本建築学会 鋼構造設計規準): 限界細長比 Λ を用いる別の形。板は幅厚比の制限値で管理。',
            '欧州(Eurocode 3): 初期不整の大きさが異なる複数の座屈曲線(a〜d)を、断面形状で使い分ける。',
            '物理は同じ。曲線の形・係数・安全率の扱いが基準ごとに異なる。',
          ]}
        />
        <Sub>構造物ごとに効いてくる入力条件の例</Sub>
        <UL items={['腐食: 板厚を腐食後の値で評価すると、b/t が大きくなり R が増える。', '荷重: その構造物に固有の荷重の組合せ。', '支持条件: 端部や中間の支えから有効座屈長(β・中間支持点)を決める。ここの設定で結果が大きく変わる。']} />
        <Movie n={4} label="設計曲線(各国の曲線の比較)" onStage={onStage} />
      </QA>

      <QA q="Q8 局部座屈の限界にも全体座屈の限界にも達していないのに、なぜ全体座屈の許容値をさらに下げるのか" a="掛けているのは「余裕」ではなく、断面の「実力の低減」。σcl/σy は「使える断面の割合」。">
        <F>{String.raw`\sigma_{cz}=\sigma_{cg}\times\dfrac{\sigma_{cl}}{\sigma_y}`}</F>
        <P>柱の耐力は2つの弱さで決まります。①柱全体が曲がる(λ)。②板が先に波打つ(σcl)。基準は、天井 σy から2回割り引く形で、両方を掛け算で効かせます。</P>
        <Table
          head={['説明用の仮定値', 'N/mm²']}
          rows={[
            ['降伏応力 σy(天井)', '250'],
            ['局部座屈を考慮しない全体座屈応力 σcg(柱が曲がる分を割引)', '200'],
            ['局部座屈の許容応力 σcl', '150'],
            ['局部座屈を考慮した全体座屈の許容値 σcz = 200 × (150 ÷ 250)', <strong className="text-yield">120</strong>],
          ]}
        />
        <UL
          items={[
            'σcg は「降伏まで断面を使える」前提の値。薄い板は局部座屈のため、断面に認められる応力が小さい(σcl < σy)。その「使える割合」(150 ÷ 250 = 0.6)を掛ける。',
            'σcl/σy は安全率(余裕を上乗せする係数)ではない。「局部座屈がすでに発生している」という意味でもない。',
          ]}
        />
        <Sub>「λ の中で σcl を使えばよいのでは?」との違い</Sub>
        <P>天井を σy から σcl に替え、λ′ = √(σcl/σe) で低減率を出す方式も考えられます(海外基準に近い考え方)。上の仮定値(λ = 0.567)で比べると次のとおりです。</P>
        <Table
          head={['', '掛け算の方式(ここでの式)', '天井を σcl にする方式']}
          rows={[
            ['λ の分子', 'σy(250)', 'σcl(150)'],
            ['λ', '0.567', '0.567 × √0.6 = 0.439'],
            ['低減率', '0.80', '0.87'],
            ['許容値', <strong>150 × 0.80 = 120</strong>, '150 × 0.87 ≒ 130'],
          ]}
        />
        <UL
          items={[
            '曲線は σy 用に作られている: 低減率の式は λ = √(σy/σe) で整理した試験結果に合わせた曲線。分子を替えるなら曲線も替える必要がある。',
            'σy を使う方が安全側: σcl < σy なので λ′ < λ。σy で λ を出す方が低減が大きく、許容値は小さめ(120 < 130)。',
            '分子だけ替えるのは片手落ち: 板が波打つと柱の曲げ剛性も落ち、σe 自体も下がる。σcl だけ入れても正確にはならない。',
          ]}
        />
        <Movie n={6} label="座屈の照査(局部座屈と全体座屈が影響し合う)" onStage={onStage} />
      </QA>

      <QA q="Q9 許容値に達したら、座屈が始まるのか" a="いいえ。「現象が始まる値」と「設計で許す値」は同じではない。許容値は変状の開始点ではない。">
        <Table
          head={['1 降伏応力', '2 座屈強度・座屈応力', '3 許容応力']}
          rows={[
            ['鋼材そのものが塑性化し始める目安。', '理想化した条件で、局部座屈(板の凹み)または全体座屈(柱全体の曲がり)が問題になる目安。', 'ばらつき、初期変形、残留応力、施工誤差などを考え、設計上これ以上は使わないとする境界。'],
            ['材料の性質', '現象側の目安', '設計で許す値(ルール)'],
          ]}
        />
        <UL
          items={[
            '許容値は「ここまでは設計上保証する」線。現象が始まる点とは別物。',
            '許容値に達しても、直ちに局部座屈・全体座屈が生じるとは限らない。',
            '設計上は「それを超えた領域の安全性を保証しない」という意味。',
            '実際の開始点は、初期たわみ・腐食・残留応力・接合・支持条件などで変わる。',
            '許容応力にどの程度の余裕(安全率)が含まれるかは、採用基準ごとに異なる。',
          ]}
        />
      </QA>

      <QA q="Q10 複合座屈の式で、α が 0 に近い、または負になったらどう読むか" a="α ≦ 0 は式の適用範囲外。負の安全率は解釈しない。α が 0 に近いときは、結果が入力値の丸めに敏感になる。">
        <F>{String.raw`\alpha=1-\dfrac{\sigma_c}{0.8\,\sigma_e}\qquad(\sigma_c<0.8\,\sigma_e\text{ が適用の前提})`}</F>
        <P>
          たとえば σc = 146.4、0.8σe = 147.1 N/mm²(説明用の値)なら α ≒ 0.005。曲げの使用割合は 1/α = 約 200 倍になり、σc が 0.5% 変わるだけで結果が大きく動きます。「安全率が 1 を大きく下回る」という結果を読む前に、式の適用条件と入力値の精度を確認します。α ≦ 0 は「σc が弾性座屈応力の8割以上」ということで、そもそも軸力だけで座屈に近い状態です。
        </P>
        <button onClick={() => go('計算してみる')} className="mt-3 rounded-lg border border-comp px-3 py-2 text-sm font-bold text-comp">
          軸力を上げて α の変化を確かめる
        </button>
      </QA>

      <QA q="Q11 安全率 = 1/U は、「いまの荷重を何倍にできるか」と同じか" a="軸力だけの照査では同じ。軸力と曲げの組合せでは、同じにならない(余裕があるときは 1/U より小さい)。">
        <P>
          軸力だけなら、安全率 = σcz ÷ σc で、荷重をその倍率にすればちょうど許容値に達します。組合せの式では、荷重を増やすと σc が増え、α が小さくなって、曲げの項が比例より速く増えます。そのため、余裕がある(U が 1 より小さい)とき、荷重を 1/U 倍にすると U は 1 を超えます。1/U は「使用割合の合計の逆数」という指標であり、荷重を増やせる倍率そのものではありません。α が 1 に近いうちは、2つはほぼ一致します。
        </P>
        <button onClick={() => go('計算してみる')} className="mt-3 rounded-lg border border-comp px-3 py-2 text-sm font-bold text-comp">
          2つの値を並べて確かめる
        </button>
      </QA>
    </div>
  );
}

/* ---------- 計算してみる ---------- */

const DEFAULT: CheckInput = { sy: 235, E: 200000, nu: 0.3, b: 200, t: 12, k: 0.43, slenderY: 40, slenderZ: 70, sc: 40, sbcy: 30, sbcz: 20, sbgy: 140 };

function Num(props: { label: ReactNode; unit?: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm">{props.label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(props.value) ? props.value : ''}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
          className="num w-24 rounded-lg border border-studio-600 bg-white px-2 py-1.5 text-right text-base font-bold"
        />
        <span className="w-14 text-xs text-ink-dim">{props.unit}</span>
      </span>
    </label>
  );
}
function Out({ label, value, big, bad }: { label: ReactNode; value: string; big?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-sm">{label}</span>
      <span className={`num font-bold ${big ? 'text-2xl' : 'text-base'} ${bad ? 'text-yield' : big ? 'text-comp' : ''}`}>{value}</span>
    </div>
  );
}

function Calculator() {
  const [i, setI] = useState<CheckInput>(DEFAULT);
  const set = (p: Partial<CheckInput>) => setI((o) => ({ ...o, ...p }));
  const r = check(i);
  const lf = loadFactor(i);
  const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const T = (s: string) => <Tex>{s}</Tex>;
  return (
    <div>
      <H>数字を入れて、3つの照査を通してみる</H>
      <P>初めの値は説明用の仮定値です。応力は N/mm²、長さは mm。式の形は「3つの照査」のとおりです。</P>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-xl border border-studio-600 bg-studio-900 p-3">
            <p className="font-bold">材料</p>
            <Num label={<>降伏応力 {T('\\sigma_y')}</>} unit="N/mm²" value={i.sy} onChange={(v) => set({ sy: v })} />
            <Num label={<>弾性係数 {T('E')}</>} unit="N/mm²" value={i.E} step={1000} onChange={(v) => set({ E: v })} />
          </div>
          <div className="rounded-xl border border-studio-600 bg-studio-900 p-3">
            <p className="font-bold">① 板(局部座屈)</p>
            <Num label={<>板の幅 {T('b')}</>} unit="mm" value={i.b} onChange={(v) => set({ b: v })} />
            <Num label={<>板厚 {T('t')}(腐食後)</>} unit="mm" value={i.t} onChange={(v) => set({ t: v })} />
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[
                [0.43, '自由突出板 k = 0.43'],
                [4, '両縁支持板 k = 4.0'],
              ].map(([k, t]) => (
                <button
                  key={k}
                  onClick={() => set({ k: k as number })}
                  aria-pressed={i.k === k}
                  className={`rounded-lg border px-2 py-2 text-sm font-bold ${i.k === k ? 'border-comp bg-studio-700' : 'border-studio-600 text-ink-dim'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-studio-600 bg-studio-900 p-3">
            <p className="font-bold">② 柱(全体座屈)</p>
            <Num label={<>細長比 {T('l_y/r_y')}(強軸)</>} value={i.slenderY} onChange={(v) => set({ slenderY: v })} />
            <Num label={<>細長比 {T('l_z/r_z')}(弱軸)</>} value={i.slenderZ} onChange={(v) => set({ slenderZ: v })} />
          </div>
          <div className="rounded-xl border border-studio-600 bg-studio-900 p-3">
            <p className="font-bold">③ 発生応力と、曲げの許容値</p>
            <Num label={<>軸方向圧縮応力 {T('\\sigma_c')}</>} unit="N/mm²" value={i.sc} onChange={(v) => set({ sc: v })} />
            <Num label={<>強軸まわりの曲げ {T('\\sigma_{bcy}')}</>} unit="N/mm²" value={i.sbcy} onChange={(v) => set({ sbcy: v })} />
            <Num label={<>弱軸まわりの曲げ {T('\\sigma_{bcz}')}</>} unit="N/mm²" value={i.sbcz} onChange={(v) => set({ sbcz: v })} />
            <Num label={<>横倒れ座屈の許容値 {T('\\sigma_{bgy}')}</>} unit="N/mm²" value={i.sbgy} onChange={(v) => set({ sbgy: v })} />
            <p className="text-xs text-ink-dim">曲げの基準値 σb0 は σy とします。σbgy は別途求めた値を入れてください。</p>
          </div>
          <button onClick={() => setI(DEFAULT)} className="rounded-lg border border-studio-600 px-3 py-2 text-sm text-ink-dim">
            初めの値に戻す
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border-2 border-studio-600 bg-studio-900 p-3">
            <p className="font-bold text-comp">① 局部座屈</p>
            <Out label={<>幅厚比 {T('b/t')}</>} value={f(i.b / i.t)} />
            <Out label={<>弾性局部座屈応力 {T('\\sigma_{el}')}</>} value={f(r.sel)} />
            <Out label={<>幅厚比パラメータ {T('R')}</>} value={f(r.R, 3)} />
            <Out label={<>低減率({r.R <= 0.7 ? 'R ≦ 0.7: 1.0' : 'R > 0.7: 0.5/R²'})</>} value={f(r.ratioL, 3)} />
            <Out label={<>局部座屈の許容値 {T('\\sigma_{cl}')}</>} value={f(r.scl)} big />
            <Out label={<>安全率 {T('\\sigma_{cl}/\\sigma_c')}</>} value={f(r.sfLocal, 2)} bad={r.sfLocal < 1} />
          </div>
          <div className="rounded-xl border-2 border-studio-600 bg-studio-900 p-3">
            <p className="font-bold text-comp">② 全体座屈</p>
            <Out label={<>細長比パラメータ {T('\\lambda')}(細長比の大きい軸)</>} value={f(r.lam, 3)} />
            <Out label={<>低減率({r.lam <= 0.2 ? 'λ ≦ 0.2' : r.lam <= 1 ? '0.2 < λ ≦ 1.0' : '1.0 < λ'})</>} value={f(r.ratioG, 3)} />
            <Out label={<>局部座屈を考慮しない {T('\\sigma_{cg}')}</>} value={f(r.scg)} />
            <Out label={<>× {T('\\sigma_{cl}/\\sigma_y')}(使える断面の割合)</>} value={`× ${f(r.ratioL, 3)}`} />
            <Out label={<>全体座屈の許容値 {T('\\sigma_{cz}')}</>} value={f(r.scz)} big />
            <Out label={<>安全率 {T('\\sigma_{cz}/\\sigma_c')}</>} value={f(r.sfGlobal, 2)} bad={r.sfGlobal < 1} />
          </div>
          <div className={`rounded-xl border-2 bg-studio-900 p-3 ${r.valid ? 'border-studio-600' : 'border-yield'}`}>
            <p className="font-bold text-comp">③ 複合座屈(軸力+曲げ)</p>
            <Out label={<>オイラー座屈応力 {T('\\sigma_{ey}')} / {T('\\sigma_{ez}')}</>} value={`${f(r.sey, 0)} / ${f(r.sez, 0)}`} />
            <Out label={<>{T('\\alpha_y')} / {T('\\alpha_z')}</>} value={`${f(r.alphaY, 3)} / ${f(r.alphaZ, 3)}`} bad={!r.valid} />
            {r.valid ? (
              <>
                <Out label="第1項 軸力の使用割合" value={f(r.u1, 3)} />
                <Out label="第2項 強軸まわりの曲げ" value={f(r.u2, 3)} />
                <Out label="第3項 弱軸まわりの曲げ" value={f(r.u3, 3)} />
                <Out label={<>使用割合の合計 {T('U')}(1 以下で OK)</>} value={f(r.U, 3)} big bad={r.U > 1} />
                <Out label={<>安全率 {T('1/U')}</>} value={f(r.sfCombined, 2)} bad={r.U > 1} />
                <Out label="参考: 荷重を同じ割合で増やせる倍率" value={f(lf, 2)} />
                <p className="mt-1 text-xs text-ink-dim">軸力が増えると α が小さくなるので、余裕があるとき「増やせる倍率」は 1/U より小さくなります(質問と回答 Q11)。</p>
              </>
            ) : (
              <p className="mt-1 text-sm font-bold text-yield">α が 0 以下です(σc が 0.8σe 以上)。この照査式の適用範囲外で、安全率は解釈しません(質問と回答 Q10)。</p>
            )}
          </div>
        </div>
      </div>
      <Curves lam={r.lam} R={r.R} />
      <p className="mt-1 text-xs text-ink-dim">赤い点が、いまの入力の位置です。</p>
    </div>
  );
}

/* ---------- 記号 ---------- */

function Symbols() {
  const T = (s: string) => <Tex>{s}</Tex>;
  return (
    <div>
      <H>記号一覧</H>
      <P>ここは式に出てくる記号の一覧です。言葉の意味(降伏、残留応力、有効幅など)は、映像のページで点線の付いた言葉を押すと説明が出ます。</P>
      <P>応力は N/mm²、長さは mm。R・λ・低減率・α・U は無次元です。添え字 c = 圧縮、t = 引張。y・z は曲げ・座屈を評価する軸(y = 強軸、z = 弱軸)。</P>
      <Sub>共通・局部座屈</Sub>
      <Table
        head={['記号', '意味', '補足']}
        rows={[
          [T('\\sigma_y'), '降伏応力。永久変形が生じ始める応力', '鋼種で決まる'],
          [T('E'), '弾性係数(ヤング係数)。弾性変形のしにくさ', '鋼で約 2.0〜2.06×10⁵ N/mm²'],
          [T('\\nu'), 'ポアソン比。縦と横のひずみの比', '鋼で 0.3'],
          [T('b,\;t'), '板の幅(自由突出板では突出幅)、板厚', 't は腐食があれば腐食後の厚さ'],
          [T('k'), '板の座屈係数。支え方と波の形で決まる', '自由突出板 0.43、両縁支持板 4.0。安全率ではない'],
          [T('\\sigma_{el}'), '弾性局部座屈応力(理想の平板の理論値)', T('k\\pi^2E/\\{12(1-\\nu^2)\\}\\times(t/b)^2')],
          [T('R'), '幅厚比パラメータ。板の座屈しやすさ', T('\\sqrt{\\sigma_y/\\sigma_{el}}')],
          [T('\\sigma_{cl}'), '局部座屈の許容応力', 'σy × 低減率(R ≦ 0.7 で 1.0、R > 0.7 で 0.5/R²)'],
        ]}
      />
      <Sub>全体座屈</Sub>
      <Table
        head={['記号', '意味', '補足']}
        rows={[
          [T('l,\;L,\;\\beta'), '有効座屈長、部材長、有効座屈長係数', T('l=\\beta L') ],
          [T('r'), '断面二次半径。断面の曲げにくさの指標', T('\\sqrt{I/A}')],
          [T('I,\;A'), '断面二次モーメント、断面積', ''],
          [T('l/r'), '細長比', 'λ(細長比パラメータ)とは別の量。取り違えに注意'],
          [T('\\sigma_e'), 'オイラー座屈応力', T('\\pi^2E/(l/r)^2')],
          [T('\\lambda'), '細長比パラメータ', T('\\sqrt{\\sigma_y/\\sigma_e}=\\frac{1}{\\pi}\\sqrt{\\sigma_y/E}\\times l/r')],
          [T('\\sigma_{cg}'), '局部座屈を考慮しない全体座屈応力', 'σy × 低減率(λ の区分式)'],
          [T('\\sigma_{c0}'), 'σcg の上限値', '= σy'],
          [T('\\sigma_{cz}'), '局部座屈を考慮した全体座屈の許容値', T('\\sigma_{cg}\\times\\sigma_{cl}/\\sigma_{c0}')],
        ]}
      />
      <Sub>複合座屈(軸力+曲げ)</Sub>
      <Table
        head={['記号', '意味', '補足']}
        rows={[
          [T('\\sigma_c'), '平均の軸方向圧縮応力', '軸力を断面積で割った値'],
          [T('\\sigma_{bcy},\;\\sigma_{bcz}'), 'y 軸・z 軸まわりの曲げによる圧縮側の縁応力', '断面の端の応力'],
          [T('\\sigma_{bgy}'), '局部座屈を考慮しない横倒れ座屈の許容応力', '横にねじれて倒れる座屈'],
          [T('\\sigma_{b0}'), 'σbgy の上限となる曲げの基準応力', '= σy'],
          [T('\\sigma_{ey},\;\\sigma_{ez}'), 'y 軸・z 軸のオイラー座屈応力', T('\\pi^2E/(l/r)^2')],
          [T('\\alpha_y,\;\\alpha_z'), '軸力による付加曲げの影響を表す係数', T('1-\\sigma_c/(0.8\\sigma_e)')],
          ['0.8', 'オイラー座屈応力に掛ける係数', '安全側に評価するための係数'],
          [T('U'), '使用割合の合計(3項の和)', 'U ≦ 1 で OK。安全率 = 1/U'],
        ]}
      />
    </div>
  );
}
