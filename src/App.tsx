import { useState } from 'react';
import Stage1 from './stages/Stage1.tsx';
import Stage2 from './stages/Stage2.tsx';
import Stage3 from './stages/Stage3.tsx';
import Stage4 from './stages/Stage4.tsx';

const STAGES = [
  { no: 1, title: '曲げとテコ', sub: 'なぜ M = EI × 曲率 なのか' },
  { no: 2, title: 'オイラー座屈', sub: 'π² と支え方の実験室' },
  { no: 3, title: '理想 vs 現実', sub: '理論より早く折れる理由' },
  { no: 4, title: '設計曲線', sub: 'あの形はどこから来たか' },
  { no: 5, title: '板の座屈', sub: '補剛材はなぜ効くのか' },
];

export default function App() {
  const [stage, setStage] = useState(3);
  return (
    <div className="mx-auto max-w-7xl px-3 pb-12 sm:px-4">
      <header className="pt-3 pb-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-wide">座屈ラボ</h1>
          <p className="text-sm text-ink-dim">柱はなぜ、理論より早く折れるのか</p>
        </div>
        <nav className="mt-2 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label="ステージ">
          {STAGES.map((s) => {
            const on = s.no === stage;
            return (
              <button
                key={s.no}
                onClick={() => setStage(s.no)}
                aria-current={on ? 'page' : undefined}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-left transition-colors ${
                  on
                    ? 'border-comp bg-studio-700 text-ink'
                    : 'border-studio-600 bg-studio-900 text-ink-dim hover:border-ink-dim'
                }`}
              >
                <span className="text-[10px] opacity-70">{s.no} </span>
                <span className="text-sm font-bold">{s.title}</span>
              </button>
            );
          })}
        </nav>
      </header>
      {stage === 1 ? (
        <Stage1 />
      ) : stage === 2 ? (
        <Stage2 />
      ) : stage === 3 ? (
        <Stage3 />
      ) : stage === 4 ? (
        <Stage4 />
      ) : (
        <div className="mt-8 rounded-xl border border-studio-600 bg-studio-900 p-8 text-center">
          <p className="text-lg font-bold">
            STAGE {stage} {STAGES[stage - 1].title}
          </p>
          <p className="mt-1 text-ink-dim">{STAGES[stage - 1].sub}</p>
          <p className="mt-4 text-ink-dim">このステージは制作中です。まず STAGE 3 をお試しください。</p>
        </div>
      )}
    </div>
  );
}
