import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import WatchlistPanel from '../components/WatchlistPanel';

export default function WatchlistPage() {
  const navigate = useNavigate();

  // Shared cache with WatchlistPanel; always revalidates on mount
  const { data } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => fetch('/api/watchlist').then((r) => r.json()),
    refetchInterval: 60 * 1000,
    refetchOnMount: 'always',
  });

  const items = data?.items || [];
  const flagged = items.filter((i) => i.freshHits > 0);
  const totalFreshHits = items.reduce((sum, i) => sum + (i.freshHits || 0), 0);

  const stats = [
    {
      label: 'MONITORED ENTITIES',
      value: items.length,
      tone: 'text-primary',
      icon: 'bookmark_added',
    },
    {
      label: 'FLAGGED (7D ACTIVITY)',
      value: flagged.length,
      tone: 'text-error',
      icon: 'crisis_alert',
    },
    {
      label: 'FRESH MEDIA HITS',
      value: totalFreshHits,
      tone: 'text-tertiary',
      icon: 'newspaper',
    },
  ];

  return (
    <div className="flex flex-col w-full animate-[fade-in_0.4s_ease-out] pb-stack-lg">
      {/* Header */}
      <section className="w-full flex flex-col gap-stack-lg relative z-10 mb-stack-lg">
        <div className="flex flex-col gap-2 w-full max-w-4xl">
          <div className="flex items-center gap-2 text-primary text-xs font-mono font-bold tracking-widest uppercase">
            <span className="material-symbols-outlined text-[16px]">notifications_active</span>
            Continuous Monitoring &bull; Live Fresh-Hit Detection
          </div>
          <h1 className="font-display-lg text-display-lg text-on-background font-bold leading-tight">
            Compliance Watchlist
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl text-sm">
            Entities under continuous adverse-media surveillance. A pulsing indicator flags targets
            with new corroborated mentions in the last 7 days across all eight live collector feeds.
          </p>
        </div>

        {/* Stats Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter w-full">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 bg-surface-container-low p-5 rounded-3xl shadow-sm border border-outline-variant/15"
            >
              <div className={`w-11 h-11 rounded-2xl bg-surface-container-high flex items-center justify-center ${s.tone}`}>
                <span className="material-symbols-outlined text-[24px]">{s.icon}</span>
              </div>
              <div className="flex flex-col">
                <span className={`font-display-lg text-3xl font-bold leading-none ${s.tone}`}>
                  {s.value.toLocaleString()}
                </span>
                <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mt-1.5">
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Monitored list */}
      <WatchlistPanel variant="full" />

      {/* Empty-state helper */}
      {items.length === 0 && (
        <button
          onClick={() => navigate('/entity-intelligence#screening')}
          className="mt-4 self-start flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-[18px]">person_search</span>
          Open the Screener to add entities
        </button>
      )}
    </div>
  );
}
