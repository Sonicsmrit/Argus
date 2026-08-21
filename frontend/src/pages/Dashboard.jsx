import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobeWidget from '../components/GlobeWidget';
import { useInvestigator } from '../context/InvestigatorContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, homeCountryName } = useInvestigator();

  const [stats, setStats] = useState({
    entities: '1,176,742',
    articles: '1,222',
    matches: '1,416',
    sanctioned: '46,293',
    healthScore: 86,
  });

  const [checklistCountry, setChecklistCountry] = useState('RU');
  const [checklist, setChecklist] = useState([]);
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [signals, setSignals] = useState([]);

  // Fetch system status
  useEffect(() => {
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setStats((prev) => ({
            ...prev,
            entities: data.totalEntities ? data.totalEntities.toLocaleString() : prev.entities,
            articles: data.totalArticles ? data.totalArticles.toLocaleString() : prev.articles,
            matches: data.totalMatches ? data.totalMatches.toLocaleString() : prev.matches,
            sanctioned: data.totalSanctioned ? data.totalSanctioned.toLocaleString() : prev.sanctioned,
          }));
        }
      })
      .catch((err) => console.error('Failed to load status:', err));
  }, []);

  // Fetch dynamic checklist based on active country
  useEffect(() => {
    setLoadingChecklist(true);
    fetch(`/api/checklists/${checklistCountry.toLowerCase()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.checklist) {
          setChecklist(data.checklist);
        }
        setLoadingChecklist(false);
      })
      .catch((err) => {
        console.error('Checklist error:', err);
        setLoadingChecklist(false);
      });
  }, [checklistCountry]);

  // Fetch real media signals
  useEffect(() => {
    fetch('/api/media/signals?limit=3')
      .then((res) => res.json())
      .then((data) => {
        if (data?.signals) {
          setSignals(data.signals);
        }
      })
      .catch((err) => console.error('Signals error:', err));
  }, []);

  const toggleAction = (id) => {
    setChecklist((prev) => prev.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));
  };

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col w-full gap-stack-lg animate-[fade-in_0.4s_ease-out] pb-stack-lg">
      {/* Top Banner Row */}
      <div className="grid grid-cols-12 gap-gutter">
        {/* Left: Health Gauge + Summary (8 Cols) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
          <div className="bg-surface-container rounded-3xl shadow-sm p-stack-lg relative overflow-hidden flex flex-col lg:flex-row items-center gap-stack-lg border border-outline-variant/15">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            {/* Circular Gauge */}
            <div className="relative w-44 h-44 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 100 100">
                <circle className="text-surface-variant" cx="50" cy="50" fill="none" r="40" stroke="currentColor" strokeWidth="8"></circle>
                <circle
                  className="text-tertiary-container transition-all duration-1000 ease-out"
                  cx="50"
                  cy="50"
                  fill="none"
                  r="40"
                  stroke="currentColor"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - stats.healthScore / 100)}
                  strokeLinecap="round"
                  strokeWidth="8"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">{stats.healthScore}</span>
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mt-0.5">Health</span>
              </div>
            </div>

            {/* Text Summary */}
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary font-mono text-[11px] font-bold uppercase tracking-wider">
                  {profile.homeCountry} Jurisdiction ({homeCountryName})
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary font-mono text-[11px] font-bold uppercase tracking-wider">
                  AI Surveillance Active
                </span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 font-bold">Network Health is Optimal</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-5 text-sm">
                Global compliance score has increased by 4 points since last sweep. High-risk cross-border corridors flagged for mandatory screening under OFAC/EU export controls.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="bg-surface px-4 py-2 rounded-full shadow-sm flex items-center gap-2 border border-outline-variant/15">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container animate-pulse"></span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">Live Screening Active</span>
                </div>
                <div className="bg-surface px-4 py-2 rounded-full shadow-sm flex items-center gap-2 border border-outline-variant/15">
                  <span className="material-symbols-outlined text-outline text-[18px]">verified_user</span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">Dual-Layer Corroborated</span>
                </div>
                <div className="bg-surface px-4 py-2 rounded-full shadow-sm flex items-center gap-2 border border-outline-variant/15">
                  <span className="material-symbols-outlined text-outline text-[18px]">auto_awesome</span>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">Gemini AI Synthesized</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            <div
              onClick={() => navigate('/entity-intelligence')}
              className="bg-surface-container rounded-2xl shadow-sm p-stack-md flex flex-col relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border border-outline-variant/15 hover:-translate-y-0.5"
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-primary">
                <span className="material-symbols-outlined text-[110px]">group</span>
              </div>
              <span className="font-label-md text-label-md text-outline mb-1 font-semibold uppercase tracking-wider">Entities Screened</span>
              <span className="font-headline-lg text-headline-lg text-on-surface mb-1 font-bold">{stats.entities}</span>
              <div className="flex items-center gap-1 text-primary text-xs font-semibold">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                <span className="font-label-md text-label-md text-on-surface-variant">+12% this month</span>
              </div>
            </div>

            <div
              onClick={() => navigate('/entity-intelligence')}
              className="bg-surface-container rounded-2xl shadow-sm p-stack-md flex flex-col relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border border-outline-variant/15 hover:-translate-y-0.5"
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-secondary">
                <span className="material-symbols-outlined text-[110px]">article</span>
              </div>
              <span className="font-label-md text-label-md text-outline mb-1 font-semibold uppercase tracking-wider">Adverse Media Hits</span>
              <span className="font-headline-lg text-headline-lg text-on-surface mb-1 font-bold">{stats.articles}</span>
              <div className="flex items-center gap-1 text-secondary text-xs font-semibold">
                <span className="material-symbols-outlined text-[16px]">trending_flat</span>
                <span className="font-label-md text-label-md text-on-surface-variant">9 Scraper Collectors</span>
              </div>
            </div>

            <div
              onClick={() => navigate('/threat-briefing')}
              className="bg-surface-container rounded-2xl shadow-sm p-stack-md flex flex-col relative overflow-hidden group hover:shadow-md transition-all cursor-pointer border border-outline-variant/15 hover:-translate-y-0.5"
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-error">
                <span className="material-symbols-outlined text-[110px]">gavel</span>
              </div>
              <span className="font-label-md text-label-md text-outline mb-1 font-semibold uppercase tracking-wider">Active Sanctions</span>
              <span className="font-headline-lg text-headline-lg text-error mb-1 font-bold">{stats.sanctioned}</span>
              <div className="flex items-center gap-1 text-error text-xs font-semibold">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span className="font-label-md text-label-md text-on-surface-variant">OFAC &bull; EU &bull; UN &bull; UK</span>
              </div>
            </div>
          </div>

          {/* Embedded 3D Global Monitor with Real Country Polygons */}
          <div className="bg-surface-container rounded-3xl shadow-sm overflow-hidden flex flex-col h-[440px] border border-outline-variant/15">
            <div className="p-stack-md px-6 flex justify-between items-center bg-surface-container-low border-b border-outline-variant/10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[22px]">public</span>
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Global 3D Threat Monitor</h3>
              </div>
              <button
                onClick={() => navigate(`/threat-briefing?from=${profile.homeCountry}&to=RU`)}
                className="bg-primary-container text-on-primary-container font-button text-button px-4 py-2 rounded-xl hover:bg-primary transition-colors flex items-center gap-2 shadow-sm font-semibold text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">explore</span>
                Bilateral Corridor Analysis
              </button>
            </div>
            <div className="flex-1 w-full relative">
              <GlobeWidget />
            </div>
          </div>
        </div>

        {/* Right: AI Insights Sidebar & Dynamic Checklist (4 Cols) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
          {/* AI Real Signals Feed */}
          <div className="bg-surface-container rounded-3xl shadow-sm p-stack-lg flex flex-col relative overflow-hidden border border-outline-variant/15">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center text-white shadow-sm">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">AI Threat Insights</h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold">LIVE STREAM</span>
            </div>

            <div className="space-y-3.5">
              {signals.length > 0 ? (
                signals.map((sig, idx) => (
                  <div
                    key={sig.id || idx}
                    className="p-4 rounded-2xl bg-surface border border-outline-variant/15 shadow-sm hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] font-bold text-error uppercase tracking-wider px-2 py-0.5 rounded bg-error-container/20">
                        {sig.source} &bull; SCORE {sig.score}
                      </span>
                      <span className="text-[11px] text-outline font-mono">{sig.date || 'Recent'}</span>
                    </div>
                    <h4 className="font-bold text-on-surface text-xs mb-1 line-clamp-2 leading-snug">
                      {sig.headline}
                    </h4>
                    <p className="text-body-sm text-on-surface-variant text-[11px] leading-relaxed line-clamp-2 italic">
                      "{sig.context || `Target matched with ${sig.entityName} (${sig.entityCountries}).`}"
                    </p>
                    <button
                      onClick={() => navigate(`/entity-intelligence?country=${(sig.entityCountries || 'mx').split(';')[0]}`)}
                      className="mt-2 text-primary font-bold text-xs flex items-center gap-1 hover:underline font-mono"
                    >
                      Screen Entity ({sig.entityName}) &rarr;
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl bg-surface border border-outline-variant/15 text-xs text-on-surface-variant">
                  Loading real-time adverse signals...
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Investigator Checklist */}
          <div className="bg-surface-container rounded-3xl shadow-sm p-stack-lg flex flex-col border border-outline-variant/15">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Investigator Checklist</h3>
              <span className="text-xs font-mono text-outline font-bold">
                {completedCount} OF {checklist.length} COMPLETED
              </span>
            </div>

            {/* Country Selector Tabs for Checklist */}
            <div className="flex items-center gap-1 mb-4 p-1 bg-surface-container-low rounded-xl border border-outline-variant/15 text-xs font-mono">
              {[
                { code: 'RU', label: 'Russia' },
                { code: 'MX', label: 'Mexico' },
                { code: 'CN', label: 'China' },
                { code: 'IR', label: 'Iran' },
              ].map((c) => (
                <button
                  key={c.code}
                  onClick={() => setChecklistCountry(c.code)}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                    checklistCountry === c.code
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {loadingChecklist ? (
              <div className="p-6 text-center text-xs font-mono text-outline">
                Loading country compliance tasks...
              </div>
            ) : (
              <div className="space-y-2.5">
                {checklist.map((act) => (
                  <div
                    key={act.id}
                    className={`p-3.5 rounded-2xl flex items-start gap-3 transition-all border ${
                      act.done
                        ? 'bg-surface/50 border-outline-variant/10 text-on-surface-variant/60 line-through'
                        : 'bg-surface border-outline-variant/20 text-on-surface shadow-sm'
                    }`}
                  >
                    <button
                      onClick={() => toggleAction(act.id)}
                      className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                        act.done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-outline hover:border-primary bg-surface'
                      }`}
                    >
                      {act.done && <span className="material-symbols-outlined text-[14px]">check</span>}
                    </button>
                    <div className="flex-1 text-xs font-medium leading-snug min-w-0">
                      <span>{act.text}</span>
                      <button
                        onClick={() => navigate(act.link)}
                        className="block mt-1 text-primary font-bold hover:underline no-underline font-mono"
                      >
                        Execute Action &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}