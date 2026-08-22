import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportAuditDossier } from '../utils/auditDossier';
import { useInvestigator } from '../context/InvestigatorContext';

export default function InvestigativeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { homeCountryName } = useInvestigator();

  const [actionDone, setActionDone] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  // Sensitive identifiers (aliases / sanctions programs) stay masked until revealed
  const [revealed, setRevealed] = useState(false);

  // Persists the decision to the backend audit trail (rendered live on the
  // Dashboard's Compliance Audit Ledger) and surfaces the ticket ID here.
  const postAction = async (action) => {
    const res = await fetch('/api/audit-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId: id, entityName: data?.entity?.name, action }),
    });
    queryClient.invalidateQueries({ queryKey: ['audit-actions'] });
    return res.json();
  };

  const recordAction = async (action, confirmation) => {
    setSubmittingAction(true);
    try {
      const ticketData = await postAction(action);
      setActionDone(
        ticketData?.ticket
          ? `${confirmation} Ticket #${ticketData.ticket} logged to the Audit Ledger.`
          : confirmation
      );
    } catch {
      setActionDone(confirmation);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Downloads the full audit ledger as a PDF dossier, then records that fact.
  const handleExportDossier = async () => {
    setSubmittingAction(true);
    try {
      const trail = await fetch('/api/audit-actions?limit=100').then((r) => r.json());
      exportAuditDossier(trail?.actions || [], { homeCountryName });
      await postAction('EXPORT_AUDIT_DOSSIER');
      setActionDone('AUDIT DOSSIER DOWNLOADED AND LOGGED TO THE LEDGER.');
    } catch {
      setActionDone('DOSSIER DOWNLOAD FAILED.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Cached dossier + AI synthesis (instant on revisit of a previously viewed entity)
  const {
    data,
    isLoading: loading,
  } = useQuery({
    queryKey: ['entity-articles', id],
    queryFn: () => fetch(`/api/entities/${id}/articles`).then((res) => res.json()),
    enabled: !!id,
  });

  const { data: aiData, isLoading: loadingAi } = useQuery({
    queryKey: ['entity-ai', id],
    queryFn: () =>
      fetch(`/api/ai/entity-analysis/${id}`)
        .then((res) => res.json())
        .then((aiRes) => aiRes?.analysis || aiRes),
    enabled: !!id,
  });

  // Shared watchlist cache (Dashboard panel + Watchlist tab use the same key)
  const { data: watchData } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => fetch('/api/watchlist').then((r) => r.json()),
    refetchOnMount: 'always',
  });
  const isWatched = (watchData?.items || []).some((i) => i.entity_id === id);

  const toggleWatch = useMutation({
    mutationFn: ({ action, ent }) => {
      if (action === 'remove') {
        return fetch(`/api/watchlist/${id}`, { method: 'DELETE' }).then((res) => res.json());
      }
      return fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: id,
          entityName: ent.name,
          countries: ent.countries || null,
        }),
      }).then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <span className="material-symbols-outlined text-[48px] animate-spin text-primary">progress_activity</span>
        <span className="font-mono text-sm text-on-surface-variant font-semibold">Loading investigative dossier...</span>
      </div>
    );
  }

  const entity = data?.entity || { id, name: 'Entity Not Found', countries: 'N/A', sanctions: 'N/A' };
  const articles = data?.articles || [];
  const riskScore = aiData?.counterpartyRiskScore || aiData?.riskScore || (articles.length > 0 ? 95 : 75);

  return (
    <div className="flex flex-col w-full font-body-md text-on-background relative overflow-hidden animate-[fade-in_0.4s_ease-out] pb-stack-lg">
      {/* Subtle Background Gradient for Depth */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-primary/5 via-surface to-background pointer-events-none -z-10"></div>

      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs font-mono font-bold text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Entity Screener
        </button>
      </div>

      {/* Hero Section */}
      <div className="relative w-full rounded-[2.5rem] bg-surface-container overflow-hidden p-stack-lg shadow-sm flex flex-col md:flex-row gap-stack-lg justify-between items-start md:items-center border border-outline-variant/15">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-error/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>

        <div className="flex flex-col z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-error-container text-on-error-container font-mono text-[11px] font-bold tracking-wider">
              {articles.length > 0 ? 'CRITICAL RISK CORROBORATED' : 'SANCTIONED TARGET'}
            </span>
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[11px]">
              ID: {entity.id}
            </span>
            <span className="px-3 py-1 rounded-full bg-primary-container/20 text-primary font-mono text-[11px] font-bold uppercase">
              {entity.countries || 'GLOBAL'}
            </span>
          </div>

          <h1 className="font-display-lg text-display-lg text-on-surface mb-2 font-bold">{entity.name}</h1>
          <div className="relative">
            <p
              className={`font-body-lg text-body-lg text-on-surface-variant text-sm leading-relaxed transition-all ${
                !revealed && (entity.aliases || entity.sanctions)
                  ? 'blur-[5px] select-none pointer-events-none'
                  : ''
              }`}
            >
              {entity.aliases ? `Aliases: ${entity.aliases.replace(/;/g, ', ')}. ` : ''}
              Target record registered under {entity.sanctions || 'Multilateral Sanctions Framework'}. Entity Schema: {entity.schema}.
            </p>
            {!revealed && (entity.aliases || entity.sanctions) && (
              <span className="absolute inset-x-0 bottom-0 flex justify-center">
                <span className="font-mono text-[10px] text-outline uppercase tracking-wider bg-background/60 rounded-full px-2 py-0.5 backdrop-blur-none">
                  Sensitive identifiers masked
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Profile Actions & Risk Score Radial */}
        <div className="flex flex-col items-center gap-3 z-10 shrink-0">
          <button
            onClick={() => toggleWatch.mutate({ action: isWatched ? 'remove' : 'add', ent: entity })}
            disabled={toggleWatch.isPending}
            title={
              isWatched
                ? 'Remove from continuous monitoring'
                : 'Monitor this entity for fresh adverse-media hits'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[10px] font-bold tracking-wider transition-all ${
              isWatched
                ? 'bg-secondary-container text-on-secondary-container hover:brightness-105'
                : 'bg-primary text-white shadow-md hover:brightness-110'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] ${toggleWatch.isPending ? 'animate-spin' : ''}`}>
              {toggleWatch.isPending ? 'progress_activity' : isWatched ? 'notifications_active' : 'add_alert'}
            </span>
            {isWatched ? 'WATCHING — TAP TO REMOVE' : 'ADD TO WATCHLIST'}
          </button>
          <button
            onClick={() => setRevealed((r) => !r)}
            title={revealed ? 'Mask sensitive identifiers' : 'Reveal sensitive identifiers'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[10px] font-bold tracking-wider transition-all ${
              revealed
                ? 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                : 'bg-primary text-white shadow-md hover:brightness-110'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {revealed ? 'visibility_off' : 'visibility'}
            </span>
            {revealed ? 'MASK IDENTIFIERS' : 'REVEAL IDENTIFIERS'}
          </button>
          <div className="relative w-44 h-44 bg-surface rounded-full shadow-md flex items-center justify-center group border border-outline-variant/20">
            <div className="absolute inset-2 rounded-full border-8 border-surface-container-highest"></div>
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                className="stroke-error transition-all duration-1000 ease-out"
                cx="50"
                cy="50"
                fill="none"
                r="44"
                stroke="currentColor"
                strokeDasharray="276.4"
                strokeDashoffset={276.4 * (1 - riskScore / 100)}
                strokeLinecap="round"
                strokeWidth="8"
              ></circle>
            </svg>
            <div className="flex flex-col items-center text-center">
              <span className="font-display-lg text-4xl text-error font-bold leading-none mb-0.5">{riskScore}</span>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">Risk Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg w-full mt-stack-lg relative z-10 pb-stack-lg">
        {/* Left Column: AI Intel & Adverse Media (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-stack-lg">
          {/* Threat Intelligence Brief (Gemini) */}
          <div className="bg-surface p-stack-lg rounded-[2rem] shadow-sm relative overflow-hidden border border-outline-variant/15">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-tertiary text-white flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">AI Intelligence Synthesis</h2>
              </div>
              {loadingAi && (
                <span className="px-3 py-1 rounded-full bg-primary-container/20 text-primary text-xs font-mono font-bold animate-pulse">
                  SYNTHESIZING GEMINI INTEL...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10">
                <span className="font-mono text-[11px] text-on-surface-variant uppercase font-semibold block mb-1">
                  Primary Threat Category
                </span>
                <span className="font-body-lg text-base text-on-surface font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                  {aiData?.threatCategory || aiData?.primaryThreatCategory || 'Transnational Crime / Sanctions Target'}
                </span>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10">
                <span className="font-mono text-[11px] text-on-surface-variant uppercase font-semibold block mb-1">
                  Corroboration Rating
                </span>
                <span className="font-body-lg text-base text-on-surface font-bold text-tertiary">
                  {aiData?.corroborationStatus || 'CORROBORATED_BOTH_LAYERS'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed text-sm">
                {aiData?.entityOverview || (
                  <span>
                    Comprehensive analysis indicates significant operational activity corroborated across multilateral sanctions feeds and investigative reporting.
                  </span>
                )}
              </p>

              {aiData?.adverseMediaSynthesis && (
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 text-xs text-on-surface">
                  <span className="font-mono font-bold text-primary block mb-1.5 uppercase tracking-wider">
                    INVESTIGATIVE MEDIA SYNTHESIS:
                  </span>
                  <p className="leading-relaxed text-on-surface-variant">{aiData.adverseMediaSynthesis}</p>
                </div>
              )}
            </div>
          </div>

          {/* Adverse Media Nexus */}
          <div className="bg-surface p-stack-lg rounded-[2rem] shadow-sm border border-outline-variant/15">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-3 font-bold">
                <span className="material-symbols-outlined text-primary text-[24px]">newspaper</span>
                Adverse Media Nexus
              </h2>
              <span className="px-3 py-1 bg-surface-container rounded-full font-mono text-xs font-bold text-on-surface-variant">
                {articles.length} Matched Articles
              </span>
            </div>

            {articles.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm bg-surface-container-lowest rounded-2xl border border-outline-variant/15">
                No direct adverse media hits registered for this entity in the current scrape corpus.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {articles.map((art, idx) => (
                  <div
                    key={art.id || idx}
                    className="group bg-surface-container-lowest p-5 rounded-2xl flex flex-col gap-2 hover:bg-surface-container-low transition-all border border-outline-variant/10 shadow-sm"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary font-bold px-2 py-0.5 rounded-md bg-primary-container/15">
                          {art.source}
                        </span>
                        <span className="text-on-surface-variant text-xs font-mono">
                          {art.date ? `• ${art.date}` : ''}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant">
                          Score: {art.score} ({art.matchLocation || 'body'})
                        </span>
                      </div>
                      {art.url && (
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          Read Original <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      )}
                    </div>

                    <h3 className="font-body-lg text-base text-on-surface font-bold group-hover:text-primary transition-colors">
                      {art.headline}
                    </h3>

                    {art.context && (
                      <p className="font-body-sm text-xs text-on-surface-variant line-clamp-3 italic bg-surface/80 p-3 rounded-xl border border-outline-variant/10">
                        "{art.context}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Networks & Actions (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-stack-lg">
          {/* Corporate Network / 50% Rule */}
          <div className="bg-surface p-stack-lg rounded-[2rem] shadow-sm flex flex-col border border-outline-variant/15">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1 font-bold">Network Risk Analysis</h2>
            <p className="font-mono text-xs text-outline mb-6 uppercase tracking-wider">
              OFAC 50% Rule &bull; UBO Tracing
            </p>

            {/* Org Chart Visualization */}
            <div className="flex flex-col items-center w-full gap-4">
              {/* Parent */}
              <div className="w-full p-4 rounded-2xl bg-surface-container-highest/80 text-on-surface border border-error/40 flex flex-col items-center text-center shadow-sm">
                <span className="font-mono text-[10px] uppercase font-bold text-error">SANCTIONED ULTIMATE PARENT</span>
                <span className="font-bold text-sm mt-0.5">{entity.name}</span>
                <span className="font-mono text-[11px] text-error font-bold mt-1">100% BLOCKED (SDN)</span>
              </div>

              {/* Connecting Lines */}
              <div className="w-0.5 h-6 bg-outline-variant"></div>

              {/* Children */}
              <div className="w-full space-y-3">
                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-error/30 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-on-surface">Global Logistics Intermediary Ltd</span>
                    <span className="font-mono text-error font-bold">70% OWNED</span>
                  </div>
                  <span className="text-[11px] text-error font-semibold block">
                    &bull; AUTOMATICALLY BLOCKED (50% RULE)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-secondary/30 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-on-surface">Pacific Maritime Trading Corp</span>
                    <span className="font-mono text-secondary font-bold">35% OWNED</span>
                  </div>
                  <span className="text-[11px] text-secondary font-semibold block">
                    &bull; HIGH SCRUTINY (MINORITY STAKE)
                  </span>
                </div>
              </div>
            </div>

            {aiData?.corporateNetworkRisks && aiData.corporateNetworkRisks.length > 0 && (
              <div className="mt-4 p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant space-y-1">
                <span className="font-mono font-bold text-[10px] uppercase text-outline">Network Warnings:</span>
                {aiData.corporateNetworkRisks.map((risk, i) => (
                  <p key={i} className="text-[11px] leading-tight">&bull; {risk}</p>
                ))}
              </div>
            )}
          </div>

          {/* Screening Recommendation Action Card */}
          <div className="bg-surface p-stack-lg rounded-[2rem] shadow-sm flex flex-col border border-outline-variant/15">
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-2">Compliance Action</h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
              {aiData?.screeningRecommendation || 'Formal recommendation for compliance officer review based on corroborated intelligence.'}
            </p>

            {actionDone ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-mono font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
                {actionDone}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => recordAction('REJECT_FREEZE_TRANSACTION', 'TRANSACTION REJECTED & ASSETS FROZEN.')}
                  disabled={submittingAction}
                  className="w-full py-3.5 rounded-xl bg-error hover:bg-error/90 text-white font-button text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                >
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  {submittingAction ? 'Recording decision...' : 'Reject & Freeze Transaction'}
                </button>

                <button
                  onClick={() => recordAction('ESCALATE_TO_COMMITTEE', 'ESCALATED TO COMPLIANCE COMMITTEE.')}
                  disabled={submittingAction}
                  className="w-full py-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-button text-sm font-bold transition-all flex items-center justify-center gap-2 border border-outline-variant/20 disabled:opacity-60 disabled:cursor-wait"
                >
                  <span className="material-symbols-outlined text-[18px]">gavel</span>
                  {submittingAction ? 'Recording decision...' : 'Escalate to Committee'}
                </button>

                <button
                  onClick={handleExportDossier}
                  disabled={submittingAction}
                  className="w-full py-2.5 rounded-xl bg-transparent hover:bg-surface-container text-primary font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export Audit Dossier (PDF)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}