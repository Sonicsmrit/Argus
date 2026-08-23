import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { actionLabel, exportAuditDossier, formatTicket } from '../utils/auditDossier';
import { useInvestigator } from '../context/InvestigatorContext';

const fetchJson = (url) => fetch(url).then((res) => res.json());

const ACTION_STYLES = {
  REJECT_FREEZE_TRANSACTION: { icon: 'block', chip: 'bg-error/10 text-error border-error/25' },
  ESCALATE_TO_COMMITTEE: { icon: 'gavel', chip: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  EXPORT_AUDIT_DOSSIER: { icon: 'download', chip: 'bg-primary-container/15 text-primary border-primary/25' },
};
const FALLBACK_STYLE = { icon: 'description', chip: 'bg-surface-container-high text-on-surface-variant border-outline-variant/20' };

const formatLoggedAt = (utc) => {
  try {
    return new Date(String(utc).replace(' ', 'T') + 'Z').toLocaleString();
  } catch {
    return utc;
  }
};

export default function AuditLedgerPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useInvestigator();

  // Polls lightly so decisions logged on entity profiles appear here live
  const { data, isLoading } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () => fetchJson('/api/audit-actions?limit=25'),
    refetchInterval: 10000,
  });

  const clearAll = useMutation({
    mutationFn: () => fetch('/api/audit-actions', { method: 'DELETE' }).then((res) => res.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-actions'] }),
  });

  const handleClearAll = () => {
    const n = data?.total ?? 0;
    if (n > 0 && window.confirm(`Clear all ${n} recorded decisions? This cannot be undone.`)) {
      clearAll.mutate();
    }
  };

  const actions = data?.actions || [];
  const total = data?.total ?? actions.length;

  const handleExport = () => {
    exportAuditDossier(actions, profile);
  };

  return (
    <div className="bg-surface-container rounded-3xl shadow-sm p-stack-lg flex flex-col border border-outline-variant/15">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[22px]">receipt_long</span>
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Compliance Audit Ledger</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-outline font-bold uppercase tracking-wider">
            {total} Decision{total === 1 ? '' : 's'} on file
          </span>
          <button
            onClick={handleClearAll}
            disabled={!actions.length || clearAll.isPending}
            className="bg-surface px-3.5 py-2 rounded-xl border border-outline-variant/25 hover:bg-error hover:text-white hover:border-error transition-all text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            {clearAll.isPending ? 'Clearing...' : 'Clear'}
          </button>
          <button
            onClick={handleExport}
            disabled={!actions.length}
            className="bg-surface px-3.5 py-2 rounded-xl border border-outline-variant/25 hover:bg-primary hover:text-white hover:border-primary transition-all text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Dossier (PDF)
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-xs font-mono text-outline">Loading audit trail...</div>
      ) : !actions.length ? (
        <div className="p-6 rounded-2xl bg-surface border border-outline-variant/15 text-center">
          <span className="material-symbols-outlined text-[28px] text-outline">history_toggle_off</span>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            No compliance decisions recorded yet.
            <br />
            Open an entity dossier and take an enforcement action &mdash; every decision lands here permanently.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {actions.map((a) => {
            const style = ACTION_STYLES[a.action] || FALLBACK_STYLE;
            return (
              <div
                key={a.id}
                className="p-3 rounded-2xl bg-surface border border-outline-variant/20 flex items-center gap-3 shadow-sm"
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${style.chip}`}>
                  <span className="material-symbols-outlined text-[16px]">{style.icon}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-primary">{formatTicket(a.id)}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${style.chip}`}>
                      {actionLabel(a.action)}
                    </span>
                  </div>
                  <button
                    onClick={() => a.entity_id && navigate(`/profile/${encodeURIComponent(a.entity_id)}`)}
                    disabled={!a.entity_id}
                    className="block mt-0.5 text-xs font-semibold text-on-surface truncate max-w-full hover:text-primary transition-colors disabled:hover:text-on-surface text-left no-underline"
                  >
                    {a.entity_name || a.entity_id || 'Unknown target'}
                  </button>
                </div>
                <span className="text-[10px] font-mono text-outline shrink-0">{formatLoggedAt(a.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
