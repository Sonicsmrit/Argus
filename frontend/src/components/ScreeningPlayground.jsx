import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const scoreTone = {
  100: 'bg-error text-white',
  90: 'bg-error/80 text-white',
  85: 'bg-tertiary text-on-tertiary-container',
  75: 'bg-primary-container text-on-primary-container',
  60: 'bg-surface-variant text-on-surface-variant',
};

export default function ScreeningPlayground() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState({});
  const [watchErr, setWatchErr] = useState(null);

  // Debounced live screening against the full 1.17M-entity registry
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/screen?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => setResults(data))
        .catch(() => setResults({ query: q, total: 0, results: [] }))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  // Mutation (not raw fetch) so the ['watchlist'] cache invalidates and the
  // Dashboard panel / Watchlist tab reflect new entries instantly.
  const watchMutation = useMutation({
    mutationFn: (entity) =>
      fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: entity.id,
          entityName: entity.name,
          countries: entity.countries || null,
        }),
      }).then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      }),
    onSuccess: (_, entity) => {
      setAdded((prev) => ({ ...prev, [entity.id]: true }));
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
    onError: () => setWatchErr('Could not add to watchlist'),
  });

  return (
    <section
      id="screening"
      className="w-full bg-gradient-to-br from-primary-container/30 via-surface-container-lowest to-tertiary-container/20 rounded-3xl shadow-sm border border-outline-variant/20 p-6 relative overflow-hidden mb-stack-lg scroll-mt-24"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[22px]">person_search</span>
          </div>
          <div>
            <h2 className="font-headline-md text-lg font-bold text-on-surface">
              Denied-Party Screening
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">
              LIVE PROBE &bull; FULL REGISTRY &bull; TIERED MATCH SCORING
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/watchlist')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary-container hover:brightness-105 text-xs font-bold text-on-secondary-container transition-all self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          Watchlist
        </button>
      </div>

      {/* Query input */}
      <div className="relative mb-4">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">
          search
        </span>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder='Type any name or alias — try "gazprom", "sinaloa", "rosneft"...'
          className="w-full h-13 min-h-[52px] pl-12 pr-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 text-body-md text-on-surface transition-all placeholder:text-outline/60"
        />
        {loading && (
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary animate-spin text-[20px]">
            progress_activity
          </span>
        )}
      </div>

      {watchErr && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-error-container/50 text-error text-xs font-bold">
          {watchErr}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="flex flex-col gap-2">
          <div className="px-1 font-mono text-[11px] text-outline uppercase tracking-wider">
            {results.total === 0
              ? `No registry hits for "${results.query}"`
              : `${results.total.toLocaleString()} match${results.total === 1 ? '' : 'es'} — showing top ${results.results.length}`}
          </div>
          {results.results.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-surface-container-lowest/80 rounded-2xl border border-outline-variant/15 hover:border-primary/25 transition-colors"
            >
              <span
                className={`shrink-0 w-11 h-9 flex items-center justify-center rounded-lg font-mono text-xs font-bold ${
                  scoreTone[r.score] || 'bg-surface-variant text-on-surface-variant'
                }`}
                title={`Match confidence ${r.score}/100`}
              >
                {r.score}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-on-surface truncate">{r.name}</span>
                  {r.matchedVia === 'alias' && (
                    <span className="px-1.5 py-0.5 rounded bg-tertiary-container text-tertiary font-mono text-[9px] font-bold">
                      ALIAS HIT
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-outline font-mono truncate mt-0.5">
                  {(r.countries || '—').toUpperCase()} &bull; {r.dataset?.toUpperCase()} &bull;{' '}
                  {(r.sanctions || '').slice(0, 90)}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => watchMutation.mutate(r)}
                  disabled={added[r.id] || watchMutation.isPending}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    added[r.id]
                      ? 'bg-primary-container/40 text-primary cursor-default'
                      : 'bg-surface-container-high hover:bg-secondary-container hover:text-on-secondary-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {added[r.id] ? 'check_circle' : 'add_alert'}
                  </span>
                  {added[r.id] ? 'Watching' : 'Watch'}
                </button>
                <button
                  onClick={() => navigate(`/profile/${r.id}`)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-surface-container-high hover:bg-primary hover:text-white text-on-surface-variant transition-all"
                >
                  Dossier
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
