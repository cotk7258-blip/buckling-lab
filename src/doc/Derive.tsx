import type { ReactNode } from 'react';
import { FigColumnEq, FigLambdaRuler, FigModes, FigStrip } from './figs.tsx';
import { Eq, MovieLink, P, Step, TabLink, Table } from './ui.tsx';

function H({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-28 border-l-4 border-comp pl-3 text-[22px] font-bold leading-snug first:mt-6 sm:text-2xl">
      {children}
    </h2>
  );
}
function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-xl bg-ink px-4 py-3 text-[15px] font-bold leading-relaxed text-white sm:text-base">{children}</p>;
}
/* ---------- 式の導出 ---------- */

export default function Derive({ onStage, go }: { onStage: (n: number) => void; go: (t: string) => void }) {
  return (
    <div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {[
          ['d1', '1 オイラー座屈'],
          ['d2', '2 応力の形と端部条件'],
          ['d3', '3 板の σel'],
          ['d4', '4 λ'],
          ['d5', '5 R'],
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
      <MovieLink n={2} label="オイラー座屈(曲げる力と戻す力の綱引き)" onStage={onStage} />

      <H id="d1">1. オイラー座屈: 曲がった柱の釣合い</H>
      <P>まず図2-1 のボタンを ① から順に押して、2つの「回す力」が逆向きに釣り合う様子を見てください。下の手順1〜3 は、それを式で書いたものです。</P>
      <FigColumnEq />
      <Step n={1} title="外力が曲げようとする力(モーメント)">
        位置 x で柱が y だけ横にずれると、軸力 P は「腕の長さ y」で柱を回そうとします。
        <Eq tex={String.raw`M=P\times y`} />
      </Step>
      <Step n={2} title="柱が曲げに抵抗する力">
        梁の基本式です。y″ は曲がり具合(曲率)、EI は曲げ剛性(E は材料の硬さ、I は断面の曲げにくさ)。
        <Eq tex={String.raw`\text{抵抗モーメント}=-EI\,y''`} />
        <MovieLink n={1} label="曲げとテコ(なぜ M = EI × 曲率 か)" onStage={onStage} />
      </Step>
      <Step n={3} title="2つが釣り合う条件">
        外力は左回り、柱の踏ん張りは右回りに回そうとし、その大きさが等しい(図2-1 の④)。マイナスは、山なりのカーブで y″ が負になるのを、正の量(曲がり具合 1/R)に直すためのものです。移項すると、柱の釣合い式になります。
                  <Eq n="1" strong tex={String.raw`P\,y=-EI\,y''\quad\Longrightarrow\quad EI\,y''+P\,y=0`} note="柱の釣合い式" />
              </Step>
      <Step n={4} title="式を整理して、解の形を見つける">
        両辺を EI で割り、k² = P/EI とおくと y″ + k²y = 0。これを y″ = −k²y と読むと、「曲がり具合は、ずれ y に比例して逆向き」。ずれが大きい所ほど強く元に戻る向きに曲がる形は、波(sin・cos)です。
        <Eq tex={String.raw`y=A\sin kx+B\cos kx\qquad(\text{確かめ: }(\sin kx)''=-k^2\sin kx)`} />
      </Step>
      <Step n={5} title="両端の条件(両端ピン)を入れる">
        両端は横に動けないので、x = 0 と x = l で y = 0。
        <Eq tex={String.raw`x=0:\;B=0\qquad x=l:\;A\sin kl=0`} />
      </Step>
      <Step n={6} title="分かれ道">
        A = 0 なら、まっすぐのまま(どんな荷重でも成り立つ)。A ≠ 0 で成り立つのは sin kl = 0、つまり kl = nπ(n = 1, 2, 3…)のときだけ。これが「曲がったまま釣り合える」荷重です。曲がりの大きさ A は決まらず、形だけが決まります。いちばん小さい n = 1 をとると、
        <Eq tex={String.raw`kl=\pi\;\to\;k^2=\dfrac{\pi^2}{l^2}\;\to\;\dfrac{P}{EI}=\dfrac{\pi^2}{l^2}`} />
                  <Eq n="2" strong tex={String.raw`P_e=\dfrac{\pi^2EI}{l^2}`} note="オイラーの座屈荷重" />
                n = 2 は半波が2つの形で、荷重は4倍。π は、座屈の形がサインカーブであることから来ています。
      </Step>

      <FigModes />

      <H id="d2">2. 応力の形と、端部条件</H>
      <Step n={1} title="荷重を応力に直す">
        応力 = 荷重 ÷ 断面積。断面二次半径 r = √(I/A) を使うと I = A·r² なので、A が消えます。
        <Eq tex={String.raw`\sigma_e=\dfrac{P_e}{A}=\dfrac{\pi^2E\,(A r^2)}{A\,l^2}`} />
                  <Eq n="3" strong tex={String.raw`\sigma_e=\dfrac{\pi^2E}{(l/r)^2}`} note="オイラー座屈応力" />
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
      <FigStrip />
      <Step n={0} title="出発点">
        <Eq tex={String.raw`\sigma_e=\dfrac{\pi^2E}{(l/r)^2},\qquad r=\sqrt{I/A}`} />
      </Step>
      <Step n={1} title="板の帯を、柱とみなす">
        幅 1・厚さ t の帯は長方形断面なので I = t³/12、A = t、r = t/√12。波1つの長さを b とすると (l/r)² = 12(b/t)²。
        <Eq tex={String.raw`\sigma=\dfrac{\pi^2E}{12}\left(\dfrac{t}{b}\right)^2`} />
      </Step>
      <Step n={2} title="板は横に自由に変形できない(ポアソン効果)">
        帯1本だけなら、曲げたときに幅方向へも自由に伸び縮みできます(ポアソン効果)。板の中の帯は隣の帯とつながっているので、その横向きの変形が抑えられ、そのぶん少し硬くなります(ν = 0.3 で 1/(1−ν²) ≒ 1.1 倍)。
        <Eq tex={String.raw`\times\dfrac{1}{1-\nu^2}`} />
      </Step>
      <Step n={3} title="縁端の支え">
        両側の支えが波打ちを抑えます。その効果を係数 k で表します。
        <Eq tex={String.raw`\times k`} />
                  <Eq n="4" strong tex={String.raw`\sigma_{el}=\dfrac{k\pi^2E}{12(1-\nu^2)}\left(\dfrac{t}{b}\right)^2`} note="弾性局部座屈応力" />
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
      <P>片側が自由になるだけで k は約 1/9(0.425 ÷ 4)。同じ b/t でも σel は約 1/9 になります。</P>
      <MovieLink n={5} label="板の座屈(σel と R の導き方、設計式)" onStage={onStage} />

      <H id="d4">4. λ(細長比パラメータ)の導出</H>
      <Lead>λ は「降伏応力 σy」と「オイラー座屈応力 σe」の比の平方根。σe の式を代入すると、照査で使う λ の式になる</Lead>
      <Step n={1} title="定義">
        降伏が先か、座屈が先かを測る物差しです。
        <Eq tex={String.raw`\lambda=\sqrt{\dfrac{\sigma_y}{\sigma_e}}`} />
      </Step>
      <Step n={2} title="オイラー式を代入">
        <Eq tex={String.raw`\dfrac{\sigma_y}{\sigma_e}=\sigma_y\div\dfrac{\pi^2E}{(l/r)^2}=\dfrac{\sigma_y\,(l/r)^2}{\pi^2E}`} />
      </Step>
      <Step n={3} title="平方根をとって、並べ替える">
                  <Eq n="5" strong tex={String.raw`\lambda=\dfrac{1}{\pi}\sqrt{\dfrac{\sigma_y}{E}}\times\dfrac{l}{r}`} note="細長比パラメータ" />
                材料で決まる部分 √(σy/E) × 形で決まる細長比 l/r。
      </Step>
      <P>
        <strong>読み方</strong>: λ &lt; 1 なら σe &gt; σy で先に降伏(短く太い柱)。λ = 1 で座屈と降伏が同時。λ &gt; 1 なら先に弾性座屈(長く細い柱)。言いかえると、λ は「σe = σy になる基準の柱の、何倍細長いか」です。基準の柱の細長比は π√(E/σy)(σy = 235、E = 2.0×10⁵ N/mm² なら約 92)。
      </P>
      <P>
        <strong>なぜ √ をとるのか</strong>: 比べたいのは σy と σe(1 が境目)です。σe は細長比の2乗で効くので、比のままだと「面積の比」のような量になります。√ をとると判定は変えずに、「細長さ(辺の長さ)の比」の目盛りに直せます。面積が4倍の正方形の辺が2倍なのと同じです。
      </P>

      <FigLambdaRuler />

      <H id="d5">5. R(幅厚比パラメータ)の導出</H>
      <Lead>R も λ と同じく「σy と σel の比」。σel の式を代入すると、照査で使う R の式になる</Lead>
      <Step n={1} title="定義">
        <Eq tex={String.raw`R=\sqrt{\dfrac{\sigma_y}{\sigma_{el}}}`} />
      </Step>
      <Step n={2} title="σel を代入">
        <Eq tex={String.raw`\dfrac{\sigma_y}{\sigma_{el}}=\dfrac{12(1-\nu^2)\,\sigma_y\,(b/t)^2}{k\pi^2E}`} />
      </Step>
      <Step n={3} title="平方根をとる">
                  <Eq n="6" strong tex={String.raw`R=\dfrac{b}{t}\times\sqrt{\dfrac{12(1-\nu^2)\,\sigma_y}{k\pi^2E}}`} note="幅厚比パラメータ" />
              </Step>
      <Step n={4} title="λ と比べる">
        <Eq tex={String.raw`R=\dfrac{1}{\pi}\sqrt{\dfrac{\sigma_y}{E}}\times\dfrac{b}{t}\times\sqrt{\dfrac{12(1-\nu^2)}{k}}`} />
        λ と同じ形です。l/r が b/t に替わり、補正 √{'{'}12(1−ν²)/k{'}'} が付くだけ。
      </Step>
      <P>
        <strong>読み方</strong>: R = 1 になる b/t が基準です(σy = 205、E = 2.06×10⁵ N/mm² のとき、自由突出板 k = 0.43 で約 19.8、両縁支持板 k = 4.0 で約 60)。R &gt; 1 なら降伏する前に弾性座屈。b/t だけでは鋼種や支え方の違う板を比べられませんが、R にすれば「R ≦ 0.7 なら低減なし」の1本の基準で判定できます。
      </P>

      <div className="mt-8 rounded-xl border-2 border-comp bg-studio-900 p-4">
        <p className="text-lg font-bold">この先: 理論値から設計式へ</p>
        <p className="mt-1 text-[15px] leading-relaxed">
          ここまでで、理想の部材が座屈する応力(σe、σel)と、物差し(λ、R)がそろいました。現実の部材の弱さを入れて設計式に落とし込む流れ(初期たわみの理論、0.5/R² の意味、α と照査式の成り立ち)は、次の章にまとめています。
        </p>
        <TabLink to="理論から設計式へ" label="理論から設計式へ を読む" go={go} primary />
      </div>
    </div>
  );
}

