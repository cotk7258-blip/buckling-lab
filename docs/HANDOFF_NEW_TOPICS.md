# 引き継ぎ書: 座屈ラボの作りで、別の構造力学・解析手法の解説ページを作る

作成 2026-11-20。座屈ラボ(このリポジトリ)で作り込んだ「番組仕立ての 3D 解説 + 補足の文書ページ」の形式・操作性・見せ方を、別の題材(構造力学のほかの分野、FEM などの解析手法)に引き継ぐための書類。**新しいセッションの Claude は、作業を始める前にこれを全部読むこと。** あわせて `CLAUDE.md`(座屈ラボの決定の記録)も読む。

---

## 0. 新しいセッションの始め方

1. この書類と `CLAUDE.md` を読む。
2. **最初にユーザーに確かめること**(§1)を聞く。答えが出るまで大きな作業を始めない。
3. 題材が決まったら、§11 の「最初の一手」に沿って、場面の構成案(表)を先に出して合意をとる。ユーザーは「案 → 合意 → 作り込み → 細かい指摘 → 直す」の流れで進める。
4. 1つ直すたびに `npm run build` → `npm test` → 画面の撮影(§9)で確かめ → `CLAUDE.md` に日付つきで記録 → commit → main に push、を繰り返す。

---

## 1. 最初にユーザーに確かめること(未決定)

| 決めること | 選択肢と考え |
|---|---|
| どこに作るか | **A. 新しいリポジトリ**(座屈ラボのコードを土台にコピーし、題材の部分を差し替える)。サイトごとに独立し、座屈ラボを壊さない。**B. 座屈ラボの中にシリーズを足す**(ヘッダーに「座屈」「FEM」などの切り替えを足す)。共通部品の改良が両方に効くが、App.tsx・ナビ・進み具合の保存が複雑になる。おすすめは A(部品は §4〜§6 のとおり小さくまとまっていて、コピーしやすい)。 |
| 公開先・名前 | 座屈ラボは組織 `kouzourikigaku` の GitHub Pages(個人名が URL に出ないように組織へ移した)。新しいサイトも同じ組織に作るか。**公開(Pages の有効化・リポジトリの公開)はユーザーの了承を得てから。** |
| 題材と順番 | §10 の候補から。ユーザーの関心: FEM の出力(最大ミーゼス応力)と座屈の許容値の比べ方を質問したことがある(座屈ラボのセッション中)。ダムゲートなど鋼構造の照査が実務。 |
| 読み手 | 座屈ラボは「一般の人〜部下の技術者」。ユーザーは部下への共有を前提にファクトチェックを頼んだことがある。 |
| 基準・資料 | 道路橋示方書など、式を載せる基準の版。ユーザーの資料(PDF)があればもらう。**資料の実案件名・個人名・報告書の実数値は公開ページに載せない。** |

---

## 2. ユーザーについて(好み・品質の基準・やり取りのくせ)

- **返答は日本語**。ユーザーはスマホからも見る(縦画面を基準に組む)。
- 品質の基準は「**NHK 特番の解説動画の質**」「**万人が短時間で分かる**」。文章が長い・図の意図が読めない・唐突、は必ず指摘される。
- 指摘は短い文で来る(例「w が図中のどこなのか全く分からない」「中央が降伏しているようにしか見えない」)。**指摘の背後の原則を汲んで、同じ問題が他の場面にもないか直す**(例: 1つの映像の矢印の長さを直したら、同じ作りの別の映像も直すよう言われた)。
- 物の見え方への要求が具体的:
  - 力の矢印は**向きと位置**が分かるように。**長さは量に比例**させる(戻す力が 1/4 なら矢印も 1/4)。
  - 「どこのことか」を図で示す(式の l は図のどの長さか → 紫の寸法線。波の高さ w → 板を切って断面に寸法)。
  - 立体の**厚み**が見えること(縁の面を濃い色に、裏にも格子)。
  - 誇張した所は画面に断る(「厚みは本当の 3 倍、比は正しい」など)。
- 説明の筋へのこだわり:
  - **用語は、絵で意味を見せてから使う**。
  - 似た話は**同じ順番・同じ形の式**でそろえる(柱 P×y ↔ 板 σt×w、EI ↔ D、le ↔ k)。∝ で逃げず「=」でそろえる。
  - 呼び方を一度決めたら固定(例「戻す力」「柱が持つ本来の戻す力(上限)」)。
  - 数値は必要なときだけ(「σy に数値を設定する必要ある? ややこしくなるだけ」で外した)。
  - 導出の細部は映像でなく補足ページへ。映像からは「導き方 ›」で補足の**節の頭**へ飛ばす(途中に飛ばさない)。
- 操作性: 再生位置のつまみ・一時停止・場面の番号ボタン・カメラの回転/移動/拡大・初期値ボタン、はどれもユーザーの依頼で入れたもの。新しいサイトでも最初から入れる。
- 進め方: 大きな変更は案を表で出して合意をとってから。小さな直しはすぐ実装して push。**PR は作らない**(main に直接 push する運用)。
- 正確さ: 力学は正確に。基準の式は版を明記し、出典で確かめていない式は載せない。設計式を現象の断定として書かない(「〜では低減しない」「〜と読める」)。
- ファクトチェックを頼まれることがある: 画面の文章を全部抜き出して読み、数値は計算で検算する。文脈を持たない別の Claude にレビューさせたこともある(Codex は作業環境から呼べない)。

---

## 3. 技術の構成

- Vite 8 + React 19 + TypeScript 7 + Tailwind 4(`@tailwindcss/vite`)+ three.js 0.187 + KaTeX 0.19。
- `npm run build` = `tsc --noEmit && vite build`(型チェック込み。**使っていない変数・関数はエラー**)。`npm test` = `node --test src/physics/*.test.ts`。
- `vite.config.ts` は `base: './'`(Pages のサブフォルダで動く)。`.github/workflows/deploy.yml` が main への push で test → build → Pages へ出す。
- クラウドの作業環境から公開 URL には接続できない。見た目は `npx vite preview --port 4173` + Playwright で撮る(§9)。

### ファイルの役割(座屈ラボ)

| ファイル | 役割 | 引き継ぎで |
|---|---|---|
| `src/App.tsx` | ヘッダー(「映像で学ぶ」「式と Q&A」)、映像の並び(`STAGES`)、進み具合(localStorage)、映像 ⇄ 補足の行き来と「映像に戻る」 | 題材名と `STAGES` を差し替え |
| `src/ui/Story.tsx` | 番組の枠 `StoryShell`、`useShow`、進行・一時停止・再生位置・場面ボタン・視点ボタン、`Steps`(式の札)、`DeriveLink`、`LabSlider`・`Card` | **そのまま使う** |
| `src/ui/Tex.tsx` | `Tex`・`FitTex`(幅に収まるよう 0.6 倍まで縮める) | そのまま |
| `src/ui/glossary.tsx` | 用語のポップアップ(`GLOSSARY`・`Term`・`Rich`・`GlossaryProvider`。`src/main.tsx` で App 全体を包む。KaTeX の CSS も main.tsx で読み込む) | 仕組みはそのまま、中身を差し替え |
| `src/three/kit.ts` | `ShowBase`(場面の時計・カメラ・説明文)と小道具(矢印・札・線・管・グラフの軸) | **そのまま使う** |
| `src/three/view.ts` | 見る人のカメラ調整(`VIEW`・`bindCamera`、localStorage `buckling-lab-view`) | そのまま(保存キーは新サイト名に) |
| `src/three/common.ts` | レンダラー、背景色、応力の色の表 `writeStressColor`、光る材質 | そのまま |
| `src/three/stageN.ts` | 各映像の 3D(`ShowBase` を継承) | 題材ごとに新しく |
| `src/stages/StageN.tsx` | 各映像の場面の文・横の札・重ねるカード・実験室 | 題材ごとに新しく |
| `src/stages/Formulas.tsx` + `src/doc/*` | 補足ページ(章のタブ)と文書の部品 | 部品はそのまま、章は新しく |
| `src/physics/*` | 計算(繊維モデル、設計式など)とテスト | 題材ごとに新しく |
| `src/three/stage.ts`・`explain.ts`・`section.ts` | 映像3 だけの特別な作り(`ShowBase` を使わない古い作り) | **手本にしない**。新しい映像は `ShowBase` で作る |

手本にするなら `src/three/stage2.ts` + `src/stages/Stage2.tsx`(式のカード・天秤・寸法線・矢印の長さ)、`src/three/stage5.ts` + `src/stages/Stage5.tsx`(断面を切る、狭い画面への対応、場面番号の読み替え)。

---

## 4. 映像(番組仕立て)の作り方

### 4.1 画面の構成(`StoryShell`)

- 左(スマホは上): 3D のキャンバス。上端に再生位置のバー(緑)と丸いつまみ、上部中央に説明文(caption、場面の中で変わる)、右上に「視点」「初期値」、下にテロップ(見出し `head`・場面名 `kicker`・「03 / 14」)と再生状態の札(「▶ 再生中 45%」「✓ 見終わり」)。
- 右(スマホは下): 語り(`body`)、横の欄(`side`。式の札 `Steps` や凡例)、下端に「◀ 戻る」・場面の番号ボタン・「次へ ▶」(PC は欄の下端に sticky、スマホは画面下端に fixed)。
- 最後の場面は実験室(スライダーで操作。`lab` に入れる)。
- 映像の上に重ねる物は `overlay`(式のカードなど)。

```tsx
<StoryShell
  scene={scene} total={SCENES.length} text={SCENES[scene]} onScene={go}
  canvasRef={canvasRef} capRef={capRef}
  overlay={scene === 1 ? <TugOverlay phase={phase} /> : undefined}
  hint="〇〇は見やすく誇張しています・なぞると回転・2本指で移動と拡大縮小(PC は右ドラッグ・ホイール)"
  side={<>{SIDE[scene]}{/* 凡例 */}</>}
  lab={/* 実験室のスライダー */}
/>
```

`SceneText = { kicker: string; head: string; body: string }`。

### 4.2 3D(`ShowBase` を継承)

```ts
export class StageNShow extends ShowBase {
  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.addFloor(-0.05);
    // 物を作って this.scene.add(...)。場面ごとに THREE.Group を分け、show() で出し分ける
    this.setScene(0);
  }
  protected tick(dt: number) {
    const s = this.sceneIndex;
    const c = this.clock; // この場面に入ってからの秒(一時停止中は進まない)
    if (s === 0) {
      const t = this.cyc(16, c);   // 16 秒でくり返す場面(場面の長さの記録も兼ねる)
      // const t = this.once(15, c); // 一度だけ流れる場面
      const p = ramp(t, 1, 6);     // 1→6 秒でなめらかに 0→1
      this.caption = t < 5 ? '〇〇を押す' : '〇〇が起きた';
      this.look(0, 1.5, 3, 2.4, 20, 10); // 収めたい範囲(中心 x,y、半分の幅・高さ)と向き(横 az°、見下ろし el°)
    }
  }
}
```

- **場面の長さは必ず `cyc`(くり返し)か `once`(一度だけ)で決める**(tick の中で最初に呼んだもの)。これが再生バー・見終わり・つまみの移動・一時停止に使われる。`c % T` を直接書かない。
- カメラは `look` で目標を置くだけ(なめらかに寄る)。見る人の回転・移動・拡大は `ShowBase` が上乗せする。場面が変わると回した向きは元に戻る。
- 場面の中の流れは「行ったり来たりしない1本の流れ」にする(ユーザーの指摘)。秒で区切り、区切りごとに caption を変える。

### 4.3 小道具(`kit.ts`)

| 関数 | 使い方 |
|---|---|
| `ramp(t, a, b)` / `smooth` | a→b 秒で 0→1(なめらか) |
| `arrow(color)` → `setArrow(g, x, y0, len, z)`(縦)/ `placeArrow(g, x, y, z, dx, dy)`(xy 面)/ `aimArrow(g, x, y, z, dx, dy, dz)`(任意の向き)/ `tintArrow` | 力の矢印。**長さを量に比例**させる |
| `label(text, color, wide)` → Sprite | 札(常に手前に描く)。長い文は `wide` を 1.4〜2.6 にしないと切れる。各ステージに `tag(text, color, size, wide)` の小さな包みを作るのが慣例 |
| `line(color, dashed)` / `setLine` | 細い線(1px)。目立たせたい線は細い箱(BoxGeometry 0.03 幅)か `tube` |
| `tube(pts, r, color)` / `drawTube(m, frac)` | 太い線(グラフの曲線、断面の形)。途中まで描ける |
| `axisGuide({...})` | グラフの壁の軸の意味(「← 太く短い / 細く長い →」と縦書き「耐えられる力(強さ)→」)。**グラフには必ず付ける** |

`common.ts`: `writeStressColor(out, o, s, mix, steel)`(応力 s = −1〜1 を色に。圧縮 = 青、引張 = オレンジ、|s|→1 で降伏 = 赤)、`BG`、`makeRenderer`(`localClippingEnabled = true` 済み)。

### 4.4 映像に重ねる式のカード(座屈ラボで定着した見せ方)

- 3D 側に段階を持たせる: `info = { phase: -1, p: 0 }` を tick で書く(場面に入るたびに -1 に戻す)。
- React 側は `useShow` の第2引数(毎フレーム呼ばれる)で `setPhase((old) => old === ph ? old : ph)`(段階が変わったときだけ描き直す)。毎フレーム変わる数字・天秤の傾きは `ref` に直接書く(`textContent`・`style.transform`)。
- カードは段階ごとに1枚ずつ足す。前の式を残して「組み上げる」。消える項は `\cancel` に赤い斜線(KaTeX、`\textcolor{#e11d48}{\cancel{...}}`)。
- 比べる場面は**天秤**(SVG。左の皿 = 外力側「変えられる」、右の皿 = 物で決まる側「一定」。傾き・% ・状態の文を毎フレーム)。
- 式の中の記号を図の物と同じ色にして、下に「l = 柱の長さ(図の紫の寸法)」のように一言。
- 絵はカードを避けて右へ寄せる(stage5.ts の `shiftRight(group, d, az)`: カメラの向きに合わせて右へ。`look` の cx だけでは横向きのカメラで効かない)。
- **スマホ**: 式のカードは「いちばん新しい1枚だけ」(古いカードに `hidden sm:block`。Stage5.tsx の `OLD`)。縦長に近い画面(幅/高さ < 1.2、stage5.ts の `isNarrow`)ではカメラを少し引く。札が右端で切れないか必ず撮って確かめる。
- カードの箱: `pointer-events-none absolute left-2 top-16 flex w-[44%] max-w-[290px] flex-col gap-1.5`、1枚は `rounded-xl border bg-white/92 px-2.5 py-1.5 shadow-sm backdrop-blur-sm`。見出し 11px 太字(力の色)、注記 10px。

### 4.5 横の式の札(`Steps`)と補足へのリンク

```tsx
<Steps title="綱引き" steps={[
  ['押し出す力', String.raw`\sigma t\times w`],
  ['戻す力', String.raw`D\times\dfrac{1}{R}=\dfrac{k\pi^2D}{b^2}\times w`],
  ['t で割る', String.raw`\sigma_{el}=\dfrac{k\pi^2D}{t\,b^2}`, 'd3'], // 3つ目 = 補足の節の id → 「導き方 ›」
]} note="1〜2文の注記" />
```

- 2つ目は KaTeX。**日本語を入れるときは `\text{…}` で包む。**
- 3つ目の id の頭で開くタブが決まる(`openDerivation`。座屈ラボでは `ds-` 理論から設計式へ / `ov-` 3つの照査 / `ax` 強軸と弱軸 / `q` 質問と回答 / それ以外 式の導出)。新サイトでは Story.tsx の `openDerivation` の表を書き換える。
- **リンク先は導出の節の頭**(手順の途中の id は使わない)。

### 4.6 操作(全映像で共通。Story.tsx・view.ts・kit.ts にある。手を入れずに使える)

- 再生位置: 上端のバーを押す・つまみをドラッグ(離した所で一時停止)。つまみを押す / **映像を短く押す** = 一時停止 ⇄ 再生(真ん中に ❚❚/▶ が一瞬出る)。テロップ横の札 = その場面を最初から。
- 場面の番号ボタン(①②…、最後は「実」)。見終えたら「次へ」が光る。
- カメラ: 左ドラッグ = 回転、右ドラッグ(Shift+左)= 平行移動、ホイール = 寄る・引く。指は1本で横 = 回り込み(縦はページのスクロール)、2本 = ピンチで寄る・引く + 平行移動。「視点」(＋−↑↓←→⟲)と「初期値」。
- 補足ページを開いても映像は隠すだけ(3D は描かない)。「映像に戻る」で同じ場面・同じスクロール位置へ。

---

## 5. 補足ページ(式と Q&A)の作り方

- `src/stages/Formulas.tsx` が章のタブ(`TABS`)と前後の章ボタン。章の中身は `src/doc/*.tsx`。
- 部品(`src/doc/ui.tsx`):
  - `Section({ id, no, title, lead, goal, needs })`: 節。**goal = この節で導く式、needs = 使う式(押すとその節へ)**。導出のまとまりが分かるよう、章の冒頭に地図(Derive.tsx の `DeriveMap`)。
  - `Step`(手順)、`Eq({ n, tex, note })`(式。FitTex で縮む)、`P`、`Fig({ n, title })`(図番号は「章-番号」)、`Callout({ tone })`、`Table({ head, rows, note })`、`UL`、`Toc`、`Knob`・`Seg`(計算ツールの入力)、`MovieLink`(映像へ)、`TabLink`、`NeedChip`。
  - `Plot`・`Legend`(`src/doc/Plot.tsx`、2D のグラフ。`xHint`・`yHint` で軸の意味)。
  - 図解は `src/doc/figs.tsx`(SVG)。3D の図を補足に置くときは `ShowBase` の図を `useShow` で(`src/doc/Axes.tsx` + `src/three/axes.ts` が手本。補足の 3D は `data-shell` の外なので再生バーの操作は効かない)。
- 章の順の考え方(座屈ラボ): 手順の全体像 → 理論式の導出 → 理論から設計式へ(① 理想の限界 → ② 物差しをそろえる → ③ 現実の弱さを理論で見積もる → ④ 結果の下側に設計式)→ 質問と回答 → 計算してみる → 記号。
- 数字を入れる計算ツールは1か所だけ(重複させない)。同じ式は1か所に置き、ほかはリンク。

---

## 6. 用語のポップアップ(`glossary.tsx`)

```ts
plateD: {
  title: '板の曲げ剛性',
  short: '板の曲げにくさ D。柱の EI にあたる(幅1あたり)。', // ひとことで
  body: '…',            // くわしく
  ex: '…',              // たとえ(任意)
  sym: 'D = Et³/{12(1−ν²)}',
  see: ['I', 'E'],      // 関連
  match: ['板の曲げにくさ'], // 本文から自動で拾う書き方
},
```

- `<Term id>` で押せる言葉、`<Rich text>` で文中の用語を自動で拾う(同じ用語は最初の1回)。語り・凡例・スライダー名に使う。
- **新しい用語・記号を画面に出したら必ず足す。** 記号だけの表示は避け、言葉で書く。

---

## 7. 見た目のルール

- 背景は明るい灰青 `#eef2f8`、文字は濃紺。黒基調にしない(「難しそう」と言われて変えた)。
- 色の意味(全映像で共通。新サイトでも守る):

| 色 | 意味 |
|---|---|
| 濃紺 `#1f2a44` | 外力(押す力) |
| 灰 `#64748b` | 反力 |
| オレンジ `#ea580c` | 外力による力(曲げる力・押し出す力)、引張 |
| 青 `#0284c7` | 戻す力(回復力)、圧縮 |
| 赤 `#e11d48` | 降伏、限界、消す・超えた |
| 紫 `#6d28d9` | 目印・注目・寸法線(Tailwind 名は `gold` のまま) |
| 緑 `#16a34a` | 理想、縁の支え |
| 濃い青 `#1e3a8a` | 座屈ラボの「柱が持つ本来の戻す力(上限)」専用 |
| 縁の面 `#2b3a55` | 板の厚みを見せる濃い色 |

- Tailwind のテーマ(`src/index.css` の `@theme`): `comp` #0b6fc2(主の青。ボタン・選択中)、`tens` #c2410c、`yield` #e11d48、`gold` #6d28d9(紫)、`ink` #1b2740・`ink-dim` #55637b、`studio-600〜950`(明るい灰の段階。950 が地、900 が白いカード)。フォントは Hiragino Sans / Noto Sans JP など。
- 3D の札・グラフの下地は `toneMapped: false, fog: false`(灰色がかるのを防ぐ)。
- 文字の大きさ: テロップ 15〜18px 太字、カードの見出し 11px、注記 10px。スマホで読めるか撮って確かめる。

---

## 8. 文章のルール

- 語り(body)は 2〜4文。テロップ(head)は1行。横の札の注記は1〜2文。細かい説明・導出は補足へ。
- 言葉は平易に(「曲げる力」「戻す力」。モーメントとは書かない、など)。式は「=」でそろえる。
- 必要な断りは短く残す(模式図・誇張・近似・「要確認」)。
- 基準の式は版を明記。確かめていない式は載せない。設計式を現象の断定として書かない。
- 「折れる」を使わない(座屈は「座屈した」)。

---

## 9. 確かめ方(撮影)

```bash
npm run build && npm test
(nohup npx vite preview --port 4173 >/dev/null 2>&1 &); sleep 3
node <scratchpad>/shot.cjs <scratchpad> '[[場面番号, 再生位置0〜1, "名前", 止めるか], ...]' '[[1300,760,"pc"],[390,800,"sp"]]'
```

撮影スクリプトの骨格(座屈ラボで使ったもの。映像のボタン名と場面ボタンの番号で移動する):

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const [out, shotsJson, sizesJson] = process.argv.slice(2);
  for (const [w, h, tg] of JSON.parse(sizesJson)) {
    const pg = await b.newPage({ viewport: { width: w, height: h } });
    await pg.goto('http://localhost:4173/'); await pg.waitForTimeout(800);
    await pg.locator('button').filter({ hasText: '映像の名前' }).first().click(); await pg.waitForTimeout(500);
    for (const [sc, f, name, freeze] of JSON.parse(shotsJson)) {
      await pg.locator('[data-shell] button').filter({ hasText: new RegExp('^' + (sc + 1) + '$') }).first().click();
      await pg.evaluate(() => document.querySelector('[data-shell] canvas').scrollIntoView());
      await pg.waitForTimeout(1200);
      const bb = await pg.locator('[data-clip-track]').first().boundingBox();
      const x = bb.x + bb.width * f;
      if (freeze) { // つまみをドラッグ = その位置で一時停止(ぴったりの絵が撮れる)
        await pg.mouse.move(x - 20, bb.y + 4); await pg.mouse.down(); await pg.mouse.move(x, bb.y + 4, { steps: 4 }); await pg.mouse.up();
      } else await pg.mouse.click(x, bb.y + 4);
      await pg.waitForTimeout(freeze ? 3000 : 6000);
      await pg.screenshot({ path: `${out}/c-${tg}-${name}.png` });
      if (freeze) { await pg.locator('[data-clip-label]').first().click(); await pg.waitForTimeout(200); }
    }
    await pg.close();
  }
  await b.close();
})();
```

- 撮った画像は PIL で並べて1枚にしてから見る(PC は映像の部分 `crop((26,143,787,692))`、スマホは `crop((0,0,390,560))`)。
- swiftshader では描画が遅く、場面の時計が実時間より遅れる。**ぴったりの瞬間を撮るときはつまみのドラッグで止める**(上の freeze)。なめらかに寄る値(カメラ・振幅)は止めると途中のまま写る。
- 最後の場面の番号ボタンは「実」なので、数字では押せない。
- 式の見切れ: `.katex` の右端が枠・画面を超えないかを Playwright で全場面・全タブ調べる(PC 1300 幅・スマホ 390 幅)。`overflow-x-auto` で式を包まない(スクロールバーを出さない)。

---

## 10. 新しい題材の候補と、座屈ラボからつながる見せ方

座屈ラボの土台(鋼 = バネの束、曲げる力と戻す力の綱引き、理想 → 現実 → 設計)を使い回せる題材から始めると、見る人もつながる。

**FEM(有限要素法)の解説**(ユーザーの実務に近い)
1. 現象: 複雑な形の部材に荷重 → どこがどれだけ変形するか分からない
2. 細かく切る(要素分割・節点)
3. 要素 = バネ(座屈ラボの映像1 のバネの束につなげる)。1本のバネの剛性 k
4. つなぐ = 剛性を足し合わせる(全体剛性マトリクス K)。釣り合い K u = F
5. 支え(境界条件)を入れて解く → 変位 → ひずみ → 応力
6. 応力の見方(コンター、ミーゼス応力の意味)
7. メッシュの細かさと答えの収束、応力の特異点(角・点荷重で「無限に大きくなる」)
8. 線形と非線形、固有値座屈解析(座屈ラボの座屈荷重とのつながり)
9. FEM の結果と許容値の比べ方(ユーザーが以前に質問した「最大ミーゼス応力と座屈の許容値を比べて安全率を出してよいか」への答えを、映像と補足の Q&A で)
10. 実験室: 要素の数を変えて答えが収束する様子

**構造力学のほかの分野**: はりのたわみと曲げモーメント図・せん断力図、トラスと節点の釣り合い、ねじり(閉断面と開断面)、せん断遅れ・有効幅、疲労、溶接継手、補剛板。どれも「現象 → 綱引き(釣り合い)→ 効く寸法 → 支え方 → 理想 → 現実 → 設計式 → 実験室」の型に当てはめられる。

場面の構成案は、座屈ラボの柱と板で合意した「同じ順番」の考え方(柱の説明と板の説明を対応表で並べた)を手本に、表で出す。

---

## 11. 最初の一手(チェックリスト)

1. §1 を聞く。
2. (A なら)新しいリポジトリを作り、座屈ラボから `package.json`・`vite.config.ts`・`tsconfig.json`・`index.html`・`.github/workflows/deploy.yml`・`src/main.tsx`・`src/index.css`・`src/ui/*`・`src/three/{kit,view,common}.ts`・`src/doc/{ui,Plot}.tsx` をコピー。`src/stages/Formulas.tsx` と `src/App.tsx` は骨格だけ残して中身を空に。`GLOSSARY` は共通の用語(応力・圧縮・引張・降伏・ヤング係数など)だけ残す。localStorage のキー(`buckling-lab-progress`・`buckling-lab-view`)を新サイト名に変える。
3. 題材の場面構成案を表で出して合意。
4. 映像1 を1本だけ作り、PC とスマホで撮って見せる。型ができたら残りへ。
5. 新サイトの `CLAUDE.md` を作り、決めたこと・ユーザーの指摘・直した点を日付つきで書き足していく(座屈ラボの `CLAUDE.md` の書き方を踏襲。「ユーザーの言葉」を引用して残すと、次のセッションが意図を取り違えない)。

---

## 12. 落とし穴(座屈ラボで実際に踏んだもの)

- **Python のヒアドキュメントでファイルを書き換えるとき**、通常の文字列の中の `\t`(`\textcolor`・`\times`)や `\f` がタブ・改ページに化ける。`r'''…'''` を使うか、書いた後に `grep -nP "\t"` で確かめる。
- `tsc` は使っていない変数・private メソッドをエラーにする。古い場面を消したら、その場面だけで使っていた関数・フィールドも消す。
- KaTeX の中の日本語は `\text{…}`。式が幅に入らないときは `FitTex`(0.6 倍まで)→ それでも入らなければ式を分ける。
- three.js: `transparent` を切り替えたら `material.needsUpdate = true`。BoxGeometry の面ごとに色を変えるには材質の配列(+x, −x, +y, −y, +z, −z の順)。クリッピングの平面はワールド座標(グループを動かしたらその分を足す)。
- 札(Sprite)は常に手前に描かれる。長い文字は `wide` を上げないと端で切れる。
- 形を毎フレーム作り直す管(`tube`)は、値を丸めた鍵が変わったときだけ作り直す(古いジオメトリは `dispose`)。
- 「見る人のカメラ調整」は映像3 の説明用の場面(explain.ts)には効かない(古い作り)。新しい映像はすべて `ShowBase` で作る。
- 場面の数を変えると、localStorage に保存した「見た割合」が古い場面番号のままになる(大きな害はない)。
- 場面の番号を並べ替えるときは、3D 側の番号の読み替え表(stage5.ts の `MAP`)・横の札(`SIDE` のキー)・凡例の条件・重ねるカードの条件をすべて合わせる。

---

## 13. 座屈ラボで答えが出ていない提案(参考)

- 質問と回答への Q12 以降の追加(軸力だけで照査する意味、局部 ≧ 全体 ≧ 複合の安全率の大小、FEM のミーゼス応力と座屈の許容値の比べ方)を提案したが、ユーザーは返事をしていない。FEM のサイトを作るなら、この3つは有力な Q&A の種。
- 曲がりの半径の記号 R を ρ に変える提案(幅厚比パラメータ R と紛れるため)も返事がない。新しいサイトでは最初から記号が重ならないようにする(座屈ラボの「記号」タブを見て、同じ文字を別の意味で使わない)。

---

## 14. git と公開

- 作業は main に直接 commit・push(ユーザーの運用)。PR は頼まれたときだけ。
- commit の最後には、そのセッションの system の案内にある帰属の行(`Co-Authored-By: …` と `Claude-Session: …`)を付ける。
- push すると GitHub Actions が Pages へ出し、数分〜10分ほどで同じ URL に反映される(ブラウザのキャッシュで古く見えることがある)。
- ユーザーのメールアドレスなど個人の情報は、外部サービスへの送信やページに出さない。
