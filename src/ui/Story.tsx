import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { ShowBase } from '../three/kit.ts';
import { Rich, Term } from './glossary.tsx';

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
      s.frame(dt);
      const el = capRef.current;
      if (el && el.textContent !== s.caption) {
        el.textContent = s.caption;
        el.style.opacity = s.caption ? '1' : '0';
      }
      cb.current?.(s);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
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
}) {
  const { scene, total, text } = props;
  const isLab = scene === total - 1;
  const labRef = useRef<HTMLDivElement>(null);
  return (
    <div className="mt-1">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-studio-600 bg-studio-950">
          <canvas ref={props.canvasRef} className="block h-[44dvh] min-h-[300px] w-full lg:h-[72dvh]" />
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
            <p className="text-[11px] font-bold tracking-[0.25em] text-comp sm:text-xs">
              {String(scene + 1).padStart(2, '0')} — {text.kicker}
            </p>
            <p className="mt-0.5 border-l-4 border-comp pl-2.5 text-[19px] font-bold leading-snug drop-shadow-[0_2px_4px_rgba(255,255,255,0.95)] sm:text-3xl">
              {text.head}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:gap-3">
          <p key={`b${scene}`} className="telop rounded-xl bg-studio-800/70 px-3 py-2 text-[14px] leading-relaxed text-ink sm:px-4 sm:py-3 sm:text-base">
            <Rich text={text.body} />
          </p>
          {isLab && props.lab && (
            <button
              onClick={() => labRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="h-12 rounded-xl bg-gold px-4 text-base font-bold text-white"
            >
              ▼ 下のスライダーで実験する
            </button>
          )}
          {props.side}
          {props.hint && (
            <p className="px-1 text-[11px] text-ink-dim">
              {props.hint}(<Term id="amp">誇張について</Term>)
            </p>
          )}
          <div className="sticky bottom-0 z-10 -mx-3 flex items-center gap-2 bg-studio-950/90 px-3 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:p-0">
            <button
              onClick={() => props.onScene(scene - 1)}
              disabled={scene === 0}
              className="h-12 whitespace-nowrap rounded-xl border border-studio-600 px-4 text-sm font-bold text-ink-dim disabled:opacity-30"
            >
              ◀ 戻る
            </button>
            <div className="flex flex-1 items-center justify-center gap-1" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === scene ? 'w-5 bg-comp' : 'w-1.5 bg-studio-600'}`} />
              ))}
            </div>
            {isLab ? (
              <button onClick={() => props.onScene(0)} className="h-12 whitespace-nowrap rounded-xl border border-studio-600 px-4 text-sm font-bold">
                最初から見る
              </button>
            ) : (
              <button onClick={() => props.onScene(scene + 1)} className="h-12 whitespace-nowrap rounded-xl bg-comp px-6 text-base font-bold text-studio-950">
                {scene === total - 2 ? '実験室へ ▶' : '次へ ▶'}
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
