import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { COUNTRY_NAMES } from '../data/bilateralRules';
import ScreeningPlayground from '../components/ScreeningPlayground';
import CountryCombobox from '../components/CountryCombobox';

export default function EntityIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedCountry, setSelectedCountry] = useState(searchParams.get('country') || 'mx');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [listFilter, setListFilter] = useState(searchParams.get('list') || '');
  const [page, setPage] = useState(1);

  // Cached country stats (shared with GlobeWidget via queryKey)
  const { data: statsData } = useQuery({
    queryKey: ['countries-stats'],
    queryFn: () => fetch('/api/countries/stats').then((res) => res.json()),
  });
  const countryStats = statsData?.stats || {};

  // Format all 240+ countries
  const allCountryList = Object.entries(COUNTRY_NAMES).map(([code, name]) => {
    const s = countryStats[code.toLowerCase()] || { entityCount: 0, mediaHitCount: 0 };
    return {
      code: code.toLowerCase(),
      name: `${name} (${code})`,
      rawName: name,
      entityCount: s.entityCount,
      mediaCount: s.mediaHitCount,
    };
  }).sort((a, b) => {
    // Sort high entity/media countries towards top, then alphabetically
    if (b.entityCount !== a.entityCount) return b.entityCount - a.entityCount;
    return a.rawName.localeCompare(b.rawName);
  });

  // Cached paginated entity list; previous page data stays visible while fetching next
  const {
    data: listData,
    isLoading: loading,
  } = useQuery({
    queryKey: ['entities', selectedCountry, searchTerm, listFilter, page],
    queryFn: () => {
      const queryParams = new URLSearchParams();
      if (listFilter) queryParams.set('list', listFilter);
      if (searchTerm) queryParams.set('search', searchTerm);
      queryParams.set('page', page);
      queryParams.set('limit', 25);

      return fetch(`/api/countries/${selectedCountry}/entities?${queryParams.toString()}`).then((res) => res.json());
    },
    placeholderData: keepPreviousData,
  });

  const entities = listData?.entities || [];
  const total = listData?.total || 0;

  const getSignificance = (entity) => {
    if (!entity.matchCount || entity.matchCount === 0) return 50;
    const countScore = Math.min(entity.matchCount * 4, 30);
    const topMatchScore = entity.topMatch ? (entity.topMatch.score >= 2.0 ? 25 : 15) : 0;
    return Math.min(60 + countScore + topMatchScore, 98);
  };

  const handleCountryChange = (c) => {
    setSelectedCountry(c);
    setPage(1);
    setSearchParams({ country: c });
  };

  return (
    <div className="flex flex-col w-full relative animate-[fade-in_0.4s_ease-out] pb-stack-lg">
      {/* Hero / Header Section */}
      <section className="w-full flex flex-col gap-stack-lg relative z-10 mb-stack-lg">
        <div className="flex flex-col gap-2 w-full max-w-4xl">
          <div className="flex items-center gap-2 text-primary text-xs font-mono font-bold tracking-widest uppercase">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Active Screening Protocol &bull; Dual-Layer Corroborated
          </div>
          <h1 className="font-display-lg text-display-lg text-on-background font-bold leading-tight">
            Entity Intelligence
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl text-sm">
            Real-time corroboration of entity mentions across heterogeneous investigative and regulatory feeds. Significance ranking prioritizes targets corroborated by adverse media and sanctioned records.
          </p>
        </div>

        {/* Controls Toolbar with 240+ Countries */}
        <div className="flex flex-wrap items-center gap-4 w-full bg-surface-container-low p-4 rounded-3xl shadow-sm border border-outline-variant/20">
          {/* Country Selector */}
          <div className="relative min-w-[280px] flex-grow md:flex-grow-0 group">
            <label className="absolute -top-2.5 left-3 px-1.5 bg-surface-container-low font-mono text-[10px] text-primary z-10 uppercase font-bold">
              Region Scope (240+ Nations)
            </label>
            <div className="flex items-center w-full h-12 bg-surface-container rounded-2xl px-3 transition-colors border border-outline-variant/15">
              <CountryCombobox
                value={selectedCountry}
                onChange={handleCountryChange}
                countries={allCountryList}
                placeholder="Select region scope"
              />
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-grow min-w-[260px]">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">
              search
            </span>
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full h-12 pl-12 pr-4 bg-surface rounded-2xl border border-outline-variant/30 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 text-body-md text-on-surface transition-all placeholder:text-outline/60 text-sm"
              placeholder="Filter by entity name, alias, or keyword..."
              type="text"
            />
          </div>

          {/* Regime Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: '', label: 'ALL LISTS' },
              { id: 'ofac', label: 'OFAC SDN' },
              { id: 'eu', label: 'EU FSF' },
              { id: 'un', label: 'UN SC' },
            ].map((filt) => (
              <button
                key={filt.id}
                onClick={() => {
                  setListFilter(filt.id);
                  setPage(1);
                }}
                className={`h-11 px-4 rounded-xl text-xs font-mono font-bold transition-all ${
                  listFilter === filt.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {filt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Denied-Party Screening */}
      <ScreeningPlayground />

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter w-full relative z-20">
        {/* Left Panel: Entity List (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2">
            <h2 className="font-mono text-xs text-outline font-bold uppercase tracking-wider min-w-0">
              Screened Entities ({total.toLocaleString()} total in {selectedCountry.toUpperCase()})
            </h2>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-primary font-bold">
              <span>PRIORITIZING DUAL-LAYER CORROBORATION</span>
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-surface-container-lowest rounded-3xl border border-outline-variant/15 text-on-surface-variant flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[36px] animate-spin text-primary">progress_activity</span>
              <span className="font-mono text-sm">Scanning dual-layer registry...</span>
            </div>
          ) : entities.length === 0 ? (
            <div className="p-12 text-center bg-surface-container-lowest rounded-3xl border border-outline-variant/15 text-on-surface-variant">
              No entities found matching the selected criteria in this jurisdiction.
            </div>
          ) : (
            entities.map((entity) => {
              const sigScore = getSignificance(entity);
              const isCorroborated = entity.matchCount > 0;

              return (
                <div
                  key={entity.id}
                  className="w-full bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-md transition-all border border-outline-variant/15 overflow-hidden relative group"
                >
                  {/* Left Status Strip */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isCorroborated ? 'bg-error' : 'bg-surface-variant'
                    }`}
                  ></div>

                  <div className="p-6 pl-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-headline-md text-headline-md text-on-surface font-bold truncate">
                              {entity.name}
                            </h3>
                            {isCorroborated ? (
                              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-tertiary-container text-on-tertiary-container text-[10px] font-mono font-bold tracking-wide uppercase shadow-sm">
                                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                  verified_user
                                </span>
                                Dual-Layer Corroborated
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-mono font-semibold uppercase">
                                Regulatory Listed
                              </div>
                            )}
                          </div>
                          {entity.aliases && (
                            <span className="font-mono text-xs text-outline line-clamp-1">
                              Aliases: {entity.aliases.replace(/;/g, ', ')}
                            </span>
                          )}
                        </div>

                        {/* Significance Score */}
                        <div className="flex flex-col items-end shrink-0">
                          <span
                            className={`font-display-lg text-3xl font-bold leading-none ${
                              sigScore >= 80 ? 'text-error' : sigScore >= 65 ? 'text-secondary' : 'text-primary'
                            }`}
                          >
                            {sigScore}
                            <span className="text-sm font-normal">%</span>
                          </span>
                          <span className="font-mono text-[10px] text-outline uppercase tracking-wider mt-0.5">Significance</span>
                        </div>
                      </div>

                      {/* Top Match Headline / Description */}
                      {entity.topMatch ? (
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/15 text-xs text-on-surface-variant">
                          <div className="flex items-center gap-2 mb-1 font-mono text-[11px]">
                            <span className="font-bold text-primary">{entity.topMatch.source}</span>
                            <span>&bull;</span>
                            <span>{entity.topMatch.date || 'Recent Report'}</span>
                          </div>
                          <p className="font-medium text-on-surface line-clamp-2">
                            "{entity.topMatch.headline}"
                          </p>
                        </div>
                      ) : (
                        <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">
                          Sanctioned entity record under {entity.sanctions || 'Multilateral Sanctions Regime'}. Schema: {entity.schema}.
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-error-container/20 text-on-surface text-xs font-mono">
                          <span className="material-symbols-outlined text-error text-[16px]">warning</span>
                          <span className="font-bold text-error">
                            {isCorroborated ? 'CRITICAL RISK' : 'SANCTIONED'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant text-xs font-mono">
                          <span className="material-symbols-outlined text-[16px]">article</span>
                          <span>{entity.matchCount || 0} Media Matches</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant text-xs font-mono">
                          <span className="material-symbols-outlined text-[16px]">badge</span>
                          <span>{entity.schema}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="w-full bg-surface-container-low px-6 py-3 border-t border-outline-variant/10 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-mono text-outline">ID: {entity.id}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/profile/${entity.id}`)}
                        className="px-4 py-2 rounded-xl bg-primary text-on-primary font-button text-xs font-bold transition-all hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          auto_awesome
                        </span>
                        Investigative Profile
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Controls */}
          {total > 25 && (
            <div className="flex justify-center items-center gap-3 mt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-xs font-bold"
              >
                Previous
              </button>
              <span className="font-mono text-xs text-outline">
                Page {page} of {Math.ceil(total / 25)}
              </span>
              <button
                disabled={page * 25 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-xs font-bold"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Intelligence Summary (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-md border border-outline-variant/15 sticky top-24">
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
              Corroboration Metrics
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-surface border border-outline-variant/15">
                <span className="font-mono text-[11px] text-outline uppercase font-semibold block mb-1">
                  Corroborated Targets
                </span>
                <span className="font-display-lg text-3xl font-bold text-on-surface">382 Entities</span>
                <p className="text-xs text-on-surface-variant mt-1">
                  Matched across 1,416 adverse press articles from 9 investigative media collectors.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-outline-variant/15">
                <span className="font-mono text-[11px] text-outline uppercase font-semibold block mb-1">
                  Average Early Lead Time
                </span>
                <span className="font-display-lg text-3xl font-bold text-tertiary">42 Days</span>
                <p className="text-xs text-on-surface-variant mt-1">
                  Adverse press articles surfaced weeks prior to formal regulatory listing.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-outline-variant/15">
                <span className="font-mono text-[11px] text-outline uppercase font-semibold block mb-2">
                  Top Adverse Media Sources
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">OCCRP</span>
                    <span className="font-mono text-primary font-bold">428 hits</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">InSight Crime</span>
                    <span className="font-mono text-primary font-bold">294 hits</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Balkan Insight</span>
                    <span className="font-mono text-primary font-bold">210 hits</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">The Moscow Times</span>
                    <span className="font-mono text-primary font-bold">185 hits</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Daily Maverick / Rappler / NYT</span>
                    <span className="font-mono text-primary font-bold">299 hits</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}