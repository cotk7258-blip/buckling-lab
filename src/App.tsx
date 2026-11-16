import { useEffect, useState } from 'react';
import Formulas from './stages/Formulas.tsx';
import Stage1 from './stages/Stage1.tsx';
import Stage2 from './stages/Stage2.tsx';
import Stage3 from './stages/Stage3.tsx';
import Stage4 from './stages/Stage4.tsx';
import Stage5 from './stages/Stage5.tsx';
import Stage6 from './stages/Stage6.tsx';

const STAGES = [
  { no: 1, title: '曲げとテコ', sub: 'なぜ H形なのか' },
  { no: 2, title: 'オイラー座屈', sub: '突然曲がる理由' },
  { no: 3, title: '理想と現実', sub: '理論より早い理由' },
  { no: 4, title: '設計曲線', sub: 'あの形の理由' },
  { no: 5, title: '板の座屈', sub: 'リブが効く理由' },
  { no: 6, title: '座屈の照査', sub: '軸力・曲げ・安全率' },
];

export default function App() {
  const [stage, setStage] = useState(0);
  const [tab, setTab] = useState({ name: '3つの照査', n: 0 });
  const open = (n: number) => {
    setStage(n);
    window.scrollTo({ top: 0 });
  };
  // 映像のページから「式と Q&A」の指定のタブを開く
  useEffect(() => {
    const on = (e: Event) => {
      setTab((t) => ({ name: (e as CustomEvent<string>).detail, n: t.n + 1 }));
      open(0);
    };
    window.addEventListener('open-formulas', on);
    return () => window.removeEventListener('open-formulas', on);
  }, []);
  const movie = stage > 0;
  const big = (on: boolean) =>
    `rounded-xl border-2 px-4 py-2 text-left transition-colors ${on ? 'border-comp bg-comp text-white' : 'border-studio-600 bg-studio-900 text-ink'}`;
  return (
    <div className="mx-auto max-w-7xl px-3 pb-12 sm:px-4">
      <header className="pt-3 pb-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="whitespace-nowrap text-xl font-bold tracking-wide">座屈ラボ</h1>
          <div className="flex gap-2">
            <button onClick={() => open(0)} aria-current={!movie ? 'page' : undefined} className={big(!movie)}>
              <span className="block text-[15px] font-bold leading-tight">式と Q&amp;A</span>
              <span className="block text-[11px] leading-tight opacity-80">照査・導出・質問と回答</span>
            </button>
            <button onClick={() => open(stage || 1)} aria-current={movie ? 'page' : undefined} className={big(movie)}>
              <span className="block text-[15px] font-bold leading-tight">映像で学ぶ</span>
              <span className="block text-[11px] leading-tight opacity-80">3D でしくみを見る(6本)</span>
            </button>
          </div>
        </div>
        {movie && (
          <nav className="mt-2 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label="映像">
            {STAGES.map((s) => {
              const on = s.no === stage;
              return (
                <button
                  key={s.no}
                  onClick={() => open(s.no)}
                  aria-current={on ? 'page' : undefined}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-left transition-colors ${
                    on ? 'border-comp bg-studio-700 text-ink' : 'border-studio-600 bg-studio-900 text-ink-dim hover:border-ink-dim'
                  }`}
                >
                  <span className="block text-[15px] font-bold leading-tight">
                    <span className="mr-1 text-xs opacity-60">{s.no}</span>
                    {s.title}
                  </span>
                  <span className="block text-[11px] leading-tight opacity-70">{s.sub}</span>
                </button>
              );
            })}
          </nav>
        )}
      </header>
      {stage === 0 ? (
        <Formulas key={tab.n} initial={tab.name} onStage={open} />
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
