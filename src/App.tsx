import { useState } from 'react';
import Formulas from './stages/Formulas.tsx';
import Stage1 from './stages/Stage1.tsx';
import Stage2 from './stages/Stage2.tsx';
import Stage3 from './stages/Stage3.tsx';
import Stage4 from './stages/Stage4.tsx';
import Stage5 from './stages/Stage5.tsx';
import Stage6 from './stages/Stage6.tsx';

const STAGES = [
  { no: 0, title: '式と Q&A', sub: '導出・質問と回答' },
  { no: 1, title: '曲げとテコ', sub: 'なぜ H形なのか' },
  { no: 2, title: 'オイラー座屈', sub: '突然曲がる理由' },
  { no: 3, title: '理想と現実', sub: '理論より早い理由' },
  { no: 4, title: '設計曲線', sub: 'あの形の理由' },
  { no: 5, title: '板の座屈', sub: 'リブが効く理由' },
  { no: 6, title: '座屈の照査', sub: '軸力・曲げ・安全率' },
];

export default function App() {
  const [stage, setStage] = useState(0);
  const open = (n: number) => {
    setStage(n);
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="mx-auto max-w-7xl px-3 pb-12 sm:px-4">
      <header className="pt-3 pb-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="whitespace-nowrap text-xl font-bold tracking-wide">座屈ラボ</h1>
          <p className="text-xs text-ink-dim sm:text-sm">座屈の式の導出と質疑回答。映像でしくみも確かめられます</p>
        </div>
        <nav className="mt-2 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label="ステージ">
          {STAGES.map((s) => {
            const on = s.no === stage;
            return (
              <button
                key={s.no}
                onClick={() => setStage(s.no)}
                aria-current={on ? 'page' : undefined}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-left transition-colors ${
                  on
                    ? 'border-comp bg-studio-700 text-ink'
                    : 'border-studio-600 bg-studio-900 text-ink-dim hover:border-ink-dim'
                }`}
              >
                <span className="block text-[15px] font-bold leading-tight">
                  <span className="mr-1 text-xs opacity-60">{s.no === 0 ? '' : `映像${s.no}`}</span>
                  {s.title}
                </span>
                <span className="block text-[11px] leading-tight opacity-70">{s.sub}</span>
              </button>
            );
          })}
        </nav>
      </header>
      {stage === 0 ? (
        <Formulas onStage={open} />
      ) : stage === 1 ? (
        <Stage1 />
      ) : stage === 2 ? (
        <Stage2 />
      ) : stage === 3 ? (
        <Stage3 />
      ) : stage === 4 ? (
        <Stage4 />
      ) : stage === 5 ? (
        <Stage5 />
      ) : (
        <Stage6 />
      )}
    </div>
  );
}
