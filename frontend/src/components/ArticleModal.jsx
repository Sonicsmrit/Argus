import React, { useState, useEffect } from 'react';
import { 
  X, ExternalLink, Calendar, Newspaper, AlertCircle, ShieldAlert, 
  Sparkles, ShieldCheck, AlertTriangle, Layers, Building, Brain, ArrowRight, CheckCircle2 
} from 'lucide-react';

export default function ArticleModal({ entityId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('articles'); // 'articles' | 'ai_synthesis'
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    fetch(`/api/entities/${entityId}/articles`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
        // Automatically prefetch AI analysis
        fetchAiAnalysis(entityId);
      })
      .catch(err => {
        console.error('Failed to load entity articles:', err);
        setLoading(false);
      });
  }, [entityId]);

  const fetchAiAnalysis = (id) => {
    setLoadingAi(true);
    setAiError(null);
    fetch(`/api/ai/entity-analysis/${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.analysis) {
          setAiAnalysis(json.analysis);
        } else {
          setAiError(json.error || 'Failed to generate AI synthesis');
        }
        setLoadingAi(false);
      })
      .catch(err => {
        setAiError(err.message);
        setLoadingAi(false);
      });
  };

  if (!entityId) return null;

  const getCorroborationBadge = (status) => {
    switch (status) {
      case 'CORROBORATED_BOTH_LAYERS':
        return <span className="badge badge-critical"><Sparkles size={11} /> Dual-Layer Corroborated</span>;
      case 'HIGH_ADVERSE_SIGNAL':
        return <span className="badge badge-high"><AlertTriangle size={11} /> High Adverse Media Signal</span>;
      default:
        return <span className="badge badge-info"><ShieldAlert size={11} /> Official Sanctions Gazette</span>;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px'
    }} onClick={onClose}>
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
          border: '1px solid var(--border-bright)'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <ShieldAlert size={22} color="var(--risk-critical)" />
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>
                {data?.entity?.name || 'Loading target intelligence...'}
              </h2>
              {data?.entity?.schema && (
                <span className="badge badge-neutral">{data.entity.schema}</span>
              )}
              {data?.articles?.length > 0 && (
                <span className="badge badge-critical" style={{ padding: '2px 8px' }}>
                  {data.articles.length} Media Matches
                </span>
              )}
            </div>
            {data?.entity && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span><strong>Countries:</strong> {data.entity.countries ? data.entity.countries.toUpperCase() : 'N/A'}</span>
                <span>•</span>
                <span><strong>Sanctions Program:</strong> {data.entity.sanctions?.substring(0, 75) || 'Targeted Denied Party'}</span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px', borderRadius: '50%', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 28px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setActiveTab('articles')}
            className={`btn btn-sm ${activeTab === 'articles' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px' }}
          >
            <Newspaper size={14} /> Linked Investigative Press ({data?.articles?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('ai_synthesis')}
            className={`btn btn-sm ${activeTab === 'ai_synthesis' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', background: activeTab === 'ai_synthesis' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '' }}
          >
            <Brain size={14} /> 🤖 AI Threat Assessment & Synthesis
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
              Loading entity records...
            </div>
          ) : activeTab === 'articles' ? (
            /* TAB 1: Matched Articles */
            !data?.articles?.length ? (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                <AlertCircle size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ fontSize: '14px' }}>No direct adverse media hits matched in the current investigative corpus.</p>
                <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                  This entity is listed on official sanctions gazettes (Layer 1). Check the AI Synthesis tab for full risk profiling.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.articles.map((art, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '18px',
                      transition: 'border-color 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', lineHeight: 1.4 }}>
                        {art.headline}
                      </h4>
                      <a 
                        href={art.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ flexShrink: 0, padding: '5px 12px', fontSize: '11px' }}
                      >
                        Read Source <ExternalLink size={12} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>
                        {art.source}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} /> {art.date || 'Recent coverage'}
                      </span>
                      <span>•</span>
                      <span className={`badge ${art.matchLocation === 'headline' ? 'badge-critical' : 'badge-info'}`} style={{ fontSize: '10px' }}>
                        Matched in {art.matchLocation} ({art.matchName})
                      </span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--risk-high)' }}>
                        Relevance Score: {art.score}
                      </span>
                    </div>

                    {art.context && (
                      <div style={{
                        background: 'var(--bg-primary)',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--accent-blue)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        fontFamily: 'var(--font-mono)'
                      }}>
                        "{art.context}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* TAB 2: AI Synthesis */
            loadingAi ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div className="pulse" style={{ fontSize: '28px', marginBottom: '12px' }}>🤖</div>
                <div style={{ fontSize: '15px', color: '#fff', fontWeight: '600' }}>
                  Synthesizing Intelligence with Gemini AI...
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Cross-referencing official sanctions gazettes with investigative journalist findings.
                </div>
              </div>
            ) : aiError ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--risk-high)' }}>
                <AlertTriangle size={32} style={{ marginBottom: '10px' }} />
                <p>{aiError}</p>
                <button onClick={() => fetchAiAnalysis(entityId)} className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}>
                  Retry Analysis
                </button>
              </div>
            ) : aiAnalysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Threat Banner */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(239, 68, 68, 0.15))',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      AI COUNTERPARTY THREAT CATEGORY
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>
                      {aiAnalysis.threatCategory || 'High-Risk Sanctions Counterparty'}
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      {getCorroborationBadge(aiAnalysis.corroborationStatus)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      COUNTERPARTY RISK SCORE
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: aiAnalysis.counterpartyRiskScore >= 80 ? 'var(--risk-critical)' : 'var(--risk-high)', fontFamily: 'var(--font-mono)' }}>
                      {aiAnalysis.counterpartyRiskScore || 90}/100
                    </div>
                  </div>
                </div>

                {/* Entity Overview */}
                <div style={{ background: 'var(--bg-secondary)', padding: '18px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Target Profile & Geopolitical Role
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {aiAnalysis.entityOverview}
                  </p>
                </div>

                {/* Adverse Media Synthesis */}
                {aiAnalysis.adverseMediaSynthesis && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '18px 20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--risk-critical)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Newspaper size={15} /> Investigative Press Synthesis (Layer 2)
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      {aiAnalysis.adverseMediaSynthesis}
                    </p>
                  </div>
                )}

                {/* Corporate Network & 50% Rule Risks */}
                {aiAnalysis.corporateNetworkRisks?.length > 0 && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '18px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--risk-high)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building size={15} /> Shell Network & Beneficial Ownership Risks (50% Rule)
                    </h4>
                    <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {aiAnalysis.corporateNetworkRisks.map((risk, rIdx) => (
                        <li key={rIdx}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Compliance Screening Recommendation */}
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '18px 20px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} /> Actionable Screening Recommendation for Compliance Officers
                  </h4>
                  <p style={{ fontSize: '13px', color: '#fff', lineHeight: 1.6, fontWeight: '500' }}>
                    {aiAnalysis.screeningRecommendation}
                  </p>
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 28px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-muted)'
        }}>
          <div>
            OpenSanctions ID: <code style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>{data?.entity?.id}</code>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
