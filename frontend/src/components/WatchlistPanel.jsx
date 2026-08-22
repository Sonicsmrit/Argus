import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function WatchlistPanel({ variant = 'compact' }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState(null);

  // Always revalidate on mount — a stale empty cache must never hide entries
  // added moments ago from the Screening Playground.
  const { data, isLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => fetch('/api/watchlist').then((r) => r.json()),
    refetchInterval: 60 * 1000,
    refetchOnMount: 'always',
  });

  const removeMutation = useMutation({
    mutationFn: (entityId) =>
      fetch(`/api/watchlist/${entityId}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setRemovingId(null);
    },
  });

  const items = data?.items || [];

  return (
    <div
      id="watchlist"
      className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/15 overflow-hidden scroll-mt-24"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface-container-low/60 border-b border-outline-variant/10">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-primary">visibility</span>
          <h3 className="font-headline-md text-sm font-bold text-on-surface uppercase tracking-wider">
            Continuous Monitoring Watchlist
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/entity-intelligence#screening')}
            className="flex items-center gap-1 text-[11px] font-mono font-bold text-primary hover:brightness-110 transition-all"
          >
            + ADD FROM SCREENER
          </button>
          {variant === 'compact' && (
            <button
              onClick={() => navigate('/watchlist')}
              className="flex items-center gap-1 text-[11px] font-mono font-bold text-on-surface-variant hover:text-primary transition-all"
            >
              VIEW ALL
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-8 flex flex-col items-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          <span className="font-mono text-xs">Syncing monitored entities...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <span className="material-symbols-outlined text-[36px] text-outline mb-2 block">
            notifications_paused
          </span>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            No entities under continuous monitoring. Screen a counterparty in Entity Intelligence and press{' '}
            <span className="font-bold text-primary">Watch</span> to track fresh adverse-media hits.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant/10">
          {items.map((w) => {
            const hasFresh = w.freshHits > 0;
            return (
              <div
                key={w.entity_id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 group transition-colors ${
                  hasFresh ? 'bg-error-container/10' : 'hover:bg-surface-container/40'
                }`}
              >
                {/* Pulse indicator */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {hasFresh && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-60"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        hasFresh ? 'bg-error' : 'bg-outline'
                      }`}
                    ></span>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/profile/${w.entity_id}`)}
                        className="text-sm font-bold text-on-surface hover:text-primary truncate transition-colors"
                      >
                        {w.entity_name || w.entity_id}
                      </button>
                      {hasFresh && (
                        <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-mono text-[9px] font-bold">
                          {w.freshHits} NEW HIT{w.freshHits === 1 ? '' : 'S'} (7D)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-outline truncate mt-0.5">
                      {w.latestMatch
                        ? `${w.latestMatch.source?.toUpperCase()} — "${(w.latestMatch.headline || '').slice(0, 70)}"`
                        : 'NO MEDIA MATCHES ON RECORD'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {w.latestMatch && (
                    <a
                      href={w.latestMatch.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high text-[11px] font-bold text-on-surface-variant hover:bg-primary hover:text-white transition-all"
                    >
                      Latest
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setRemovingId(w.entity_id);
                      removeMutation.mutate(w.entity_id);
                    }}
                    title="Stop monitoring"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-error-container hover:text-error transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {removingId === w.entity_id ? 'progress_activity' : 'notifications_off'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
