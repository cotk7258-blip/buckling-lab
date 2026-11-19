import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { ShowBase } from '../three/kit.ts';
import { Rich, Term } from './glossary.tsx';
import { FitTex } from './Tex.tsx';

/** 「式と Q&A」のページを、指定のタブで開く(App が受け取る) */
export function openFormulas(tab: string, id?: string) {
  window.dispatchEvent(new CustomEvent('open-formulas', { detail: { tab, id } }));
}

/** 「式と Q&A」の節の id から、その節のあるタブを開いて節へ飛ぶ */
export function openDerivation(id: string) {
  const tab = id.startsWith('ds-') ? '理論から設計式へ' : id.startsWith('ov-') ? '3つの照査' : id.startsWith('q') ? '質問と回答' : '式の導出';
  openFormulas(tab, id);
}

/** 式の横に置く「導き方」へのリンク */
export function DeriveLink({ id, label = '導き方' }: { id: string; label?: string }) {
  return (
    <button onClick={() => openDerivation(id)} className="shrink-0 rounded-md border border-comp/40 px-1.5 py-0.5 text-[11px] font-bold leading-none text-comp">
      {label} ›
    </button>
  );
}

export type Clip = { p: number; done: boolean; loop: boolean } | null;

/**
 * 場面の動きの進み具合を画面に書く(毎フレーム呼ぶ)。root は data-shell を付けた枠。
 * 上端のバー(data-clip-bar)、テロップの札(data-clip-label)、見終えたら「次へ」(data-next)を光らせる。
 */
export function updateClip(root: Element | null, clip: Clip) {
  if (!root) return;
  const track = root.querySelector<HTMLElement>('[data-clip-track]');
  const bar = root.querySelector<HTMLElement>('[data-clip-bar]');
  const label = root.querySelector<HTMLElement>('[data-clip-label]');
  const next = root.querySelector<HTMLElement>('[data-next]');
  if (!clip) {
    if (track) track.style.opacity = '0';
    if (label) label.style.visibility = 'hidden';
    next?.setAttribute('data-done', '0');
    return;
  }
  if (track) track.style.opacity = '1';
  if (bar) {
    bar.style.width = `${(clip.done && !clip.loop ? 1 : clip.p) * 100}%`;
    bar.style.background = clip.done ? '#16a34a' : '';
  }
  if (label) {
    label.style.visibility = 'visible';
    const text = clip.done ? (clip.loop ? '✓ 見終わり ↻ くり返し中' : '✓ 見終わり ↻ もう一度') : `▶ 再生中 ${Math.round(clip.p * 100)}%`;
    if (label.textContent !== text) label.textContent = text;
    label.dataset.done = clip.done ? '1' : '0';
  }
  next?.setAttribute('data-done', clip.done ? '1' : '0');
}

/** 映像の上端の、場面の動きの進み具合のバー(映像の枠の中に置く) */
export function ClipBar() {
  return (
    <div data-clip-track className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-studio-700/60 transition-opacity" style={{ opacity: 0 }} aria-hidden>
      <div data-clip-bar className="h-full bg-comp" style={{ width: '0%' }} />
    </div>
  );
}

/** テロップの右に出す札。押すとその場面を最初から再生する */
export function ClipLabel({ onReplay }: { onReplay?: () => void }) {
  return (
    <button
      type="button"
      data-clip-label
      onClick={onReplay}
      className="pointer-events-auto shrink-0 rounded-full border border-studio-600 bg-white/90 px-2 py-0.5 text-[11px] font-bold tracking-normal text-ink-dim data-[done=1]:border-green-600 data-[done=1]:text-green-700"
      style={{ visibility: 'hidden' }}
    />
  );
}

export interface SceneText {
  kicker: string;
  head: string;
  body: string;
}

/**
 * 3D の舞台を作って毎フレーム動かす。canvasRef を <canvas> に、capRef を説明文の <p> に付ける。
 * onFrame は描いた直後に呼ばれる(画面の数字を更新するのに使う)。
 */
export function useShow<T extends ShowBase>(make: (c: HTMLCanvasElement) => T, onFrame?: (show: T) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);
  const show = useRef<T | null>(null);
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    const s = make(canvasRef.current!);
    show.current = s;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 隠れているあいだ(「式と Q&A」を開いている間)は描かない
      if (!canvasRef.current?.clientWidth) {
        raf = requestAnimationFrame(tick);
        return;
      }
      s.frame(dt);
      const el = capRef.current;
      if (el && el.textContent !== s.caption) {
        el.textContent = s.caption;
        el.style.opacity = s.caption ? '1' : '0';
      }
      cb.current?.(s);
      updateClip(canvasRef.current?.closest('[data-shell]') ?? null, s.clip());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onReplay = () => {
      s.clock = 0;
    };
    window.addEventListener('replay-scene', onReplay);
    return () => {
      window.removeEventListener('replay-scene', onReplay);
      cancelAnimationFrame(raf);
      s.dispose();
      show.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { canvasRef, capRef, show };
}

/** 番組仕立ての枠: 映像+見出しのテロップ、語り、横の欄、進行のボタン、最後の実験室 */
export function StoryShell(props: {
  scene: number;
  /** 場面の数(実験室を含む) */
  total: number;
  text: SceneText;
  onScene: (n: number) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  capRef: RefObject<HTMLParagraphElement | null>;
  /** 映像の上に重ねる物 */
  overlay?: ReactNode;
  /** 語りの下に置く欄 */
  side?: ReactNode;
  /** 最後の場面(実験室)で下に出す操作 */
  lab?: ReactNode;
  hint?: string;
  note?: string;
  /** 最後の場面へ進むボタンの文(既定は「実験室へ ▶」) */
  labLabel?: string;
}) {
  const { scene, total, text } = props;
  const isLab = scene === total - 1;
  const labRef = useRef<HTMLDivElement>(null);
  const frac = (scene + 1) / total;
  // 場面の札を押したら、その場面を最初から再生する(ShowBase の時計を 0 に戻す)
  const replay = () => window.dispatchEvent(new CustomEvent('replay-scene'));
  // 進み具合を App に知らせる(ナビのメーターと「映像に戻る」の表示に使う)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('scene-change', { detail: { scene, total } }));
  }, [scene, total]);
  return (
    <div className="mt-1 pb-20 lg:pb-0" data-shell>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-studio-600 bg-studio-950">
          <canvas ref={props.canvasRef} className="block h-[44dvh] min-h-[300px] w-full lg:h-[72dvh]" />
          <ClipBar />
          <p
            ref={props.capRef}
            className="pointer-events-none absolute inset-x-3 top-3 text-center text-base font-bold leading-snug text-ink drop-shadow-[0_2px_4px_rgba(255,255,255,0.95)] transition-opacity duration-300 sm:top-5 sm:text-2xl"
            style={{ opacity: 0 }}
          />
          {props.overlay}
          <div
            key={scene}
            className="telop pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-studio-950 via-studio-950/85 to-transparent px-3 pb-2.5 pt-10 sm:px-5 sm:pb-4"
            aria-live="polite"
          >
            <p className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[0.25em] text-comp sm:text-xs">
              <span className="min-w-0 truncate">
                {String(scene + 1).padStart(2, '0')}
                <span className="opacity-60"> / {String(total).padStart(2, '0')}</span> — {text.kicker}
              </span>
              <ClipLabel onReplay={replay} />
            </p>
            <p className="mt-0.5 border-l-4 border-comp pl-2.5 text-[19px] font-bold leading-snug drop-shadow-[0_2px_4px_rgba(255,255,255,0.95)] sm:text-3xl">
              {text.head}
            </p>
          </div>
        </div>

        {/* PC では映像と同じ高さの欄にし、進行のボタンをその下端に固定する(中身が長ければ欄の中で送る) */}
        <div className="flex min-w-0 flex-col gap-2 lg:h-[72dvh] lg:gap-3 lg:overflow-y-auto lg:pr-1">
          <p key={`b${scene}`} className="telop rounded-xl bg-studio-800/70 px-3 py-2 text-[14px] leading-relaxed text-ink sm:px-4 sm:py-3 sm:text-base">
            <Rich text={text.body} />
          </p>
          {isLab && props.lab && (
            <button
              onClick={() => labRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="h-12 rounded-xl bg-gold px-4 text-base font-bold text-white"
            >
              {props.labLabel ? '▼ 下のボタンから、式と計算へ' : '▼ 下のスライダーで実験する'}
            </button>
          )}
          {props.side}
          {props.hint && (
            <p className="px-1 text-[11px] text-ink-dim">
              {props.hint}(<Term id="amp">誇張について</Term>)
            </p>
          )}
          {!isLab && (
            <p className="px-1 text-xs">
              <button onClick={() => openFormulas('式の導出')} className="font-bold text-comp underline">
                式の導出・質問と回答を読む(補足)
              </button>
              <span className="text-ink-dim"> … 読んだら「映像に戻る」でこの場面へ</span>
            </p>
          )}
          <div className="fixed inset-x-0 bottom-0 z-20 mt-auto flex items-center gap-2 border-t border-studio-700 bg-studio-950/95 px-3 py-2 backdrop-blur lg:sticky lg:z-10 lg:border-t-0 lg:mx-0 lg:px-0 lg:pt-2 lg:pb-0">
            <button
              onClick={() => props.onScene(scene - 1)}
              disabled={scene === 0}
              className="h-12 whitespace-nowrap rounded-xl border border-studio-600 px-4 text-sm font-bold text-ink-dim disabled:opacity-30"
            >
              ◀ 戻る
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1" aria-label={`場面 ${scene + 1} / ${total}(${Math.round(frac * 100)}%)`}>
              <div className="flex items-center justify-center gap-1" aria-hidden>
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === scene ? 'w-4 bg-comp' : i < scene ? 'w-1.5 bg-comp/50' : 'w-1.5 bg-studio-600'}`} />
                ))}
              </div>
              <span className="num text-[11px] font-bold leading-none text-ink-dim">
                {scene + 1} / {total} ・ {Math.round(frac * 100)}%
              </span>
            </div>
            {isLab ? (
              <button onClick={() => props.onScene(0)} className="h-12 whitespace-nowrap rounded-xl border border-studio-600 px-4 text-sm font-bold">
                最初から見る
              </button>
            ) : (
              <button data-next onClick={() => props.onScene(scene + 1)} className="h-12 whitespace-nowrap rounded-xl bg-comp px-6 text-base font-bold text-studio-950">
                {scene === total - 2 ? (props.labLabel ?? '実験室へ ▶') : '次へ ▶'}
              </button>
            )}
          </div>
        </div>
      </div>
      {isLab && props.lab && (
        <div ref={labRef} className="mt-3 scroll-mt-3">
          {props.lab}
        </div>
      )}
      {props.note && (
        <details className="mt-4 px-1 text-xs leading-relaxed text-ink-dim">
          <summary className="cursor-pointer py-1 text-sm font-bold">計算の前提を見る</summary>
          {props.note}
        </details>
      )}
    </div>
  );
}

/** 実験室のスライダー */
export function LabSlider(props: {
  label: string;
  /** 押すと説明が出る用語の id */
  term?: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show: string;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-base font-bold">{props.term ? <Term id={props.term}>{props.label}</Term> : props.label}</span>
        <span className="num text-lg font-bold" style={{ color: props.color }}>
          {props.show}
        </span>
      </span>
      {props.hint && <span className="block text-xs text-ink-dim">{props.hint}</span>}
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{ ['--thumb' as string]: props.color }}
      />
    </label>
  );
}

export function Card(props: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-studio-600 bg-studio-900 p-4">
      {props.title && <h3 className="mb-2 text-base font-bold">{props.title}</h3>}
      {props.children}
    </div>
  );
}

/** 映像の横に出す、式の積み上げ(導出の段) */
/** 式の積み上げの札。各行の3つ目は「式と Q&A」の節の id(式の横に「導き方」のリンクを出す) */
export function Steps(props: { title: string; steps: ([string, string] | [string, string, string])[]; note?: string }) {
  return (
    <div className="rounded-xl border border-studio-700 bg-studio-900 px-3 py-2">
      <p className="text-xs font-bold text-ink-dim">{props.title}</p>
      <ol className="mt-1 space-y-1">
        {props.steps.map(([lab, tex, id], i) => (
          <li key={i} className="flex items-center gap-2">
            {lab && <span className="w-20 shrink-0 text-[11px] font-bold leading-tight text-comp">{lab}</span>}
            <FitTex className="flex-1 text-[15px]">{tex}</FitTex>
            {id && <DeriveLink id={id} />}
          </li>
        ))}
      </ol>
      {props.note && <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">{props.note}</p>}
    </div>
  );
}
