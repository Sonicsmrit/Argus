import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { 
  getBilateralRisk, 
  COUNTRY_NAMES, 
  REGIME_INFO 
} from '../data/bilateralRules';
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, ArrowRight, ArrowLeft, 
  Layers, FileText, CheckCircle2, XCircle, AlertOctagon, 
  ExternalLink, Building2, Package, Cpu, DollarSign, Scale, Database, HelpCircle,
  Brain, Sparkles, AlertCircle, RefreshCw, ListChecks, Shield
} from 'lucide-react';

export default function RiskEngine() {
  const { from, to } = useParams();
  const navigate = useNavigate();

  const fromCode = (from || 'US').toUpperCase();
  const toCode = (to || 'RU').toUpperCase();

  const fromName = COUNTRY_NAMES[fromCode] || fromCode;
  const toName = COUNTRY_NAMES[toCode] || toCode;

  const [countryStats, setCountryStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // AI Assessment State
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAi, setLoadingAi] = useState(true);
  const [aiError, setAiError] = useState(null);

  // Active view tab: 'ai_threats' | 'regulations'
  const [activeTab, setActiveTab] = useState('ai_threats');

  // Run deterministic bilateral rules engine
  const bilateralAssessment = getBilateralRisk(fromCode, toCode);

  useEffect(() => {
    // Fetch live layer 1 & 2 stats
    fetch('/api/countries/stats')
      .then(res => res.json())
      .then(data => {
        const targetStat = data.stats?.[toCode.toLowerCase()] || { entityCount: 0, mediaHitEntities: 0, mediaHitCount: 0 };
        setCountryStats(targetStat);
        setLoadingStats(false);
      })
      .catch(err => {
        console.error('Failed to load stats:', err);
        setLoadingStats(false);
      });

    // Fetch AI Bilateral Risk Assessment from Gemini
    fetchAiBilateralRisk();
  }, [fromCode, toCode]);

  const fetchAiBilateralRisk = () => {
    setLoadingAi(true);
    setAiError(null);

    fetch('/api/ai/bilateral-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromCode,
        to: toCode,
        fromName,
        toName,
        bilateralRisk: bilateralAssessment
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.analysis) {
          setAiAnalysis(data.analysis);
        } else {
          setAiError(data.error || 'Failed to generate AI analysis');
        }
        setLoadingAi(false);
      })
      .catch(err => {
        console.error('AI Fetch error:', err);
        setAiError(err.message);
        setLoadingAi(false);
      });
  };

  const getRiskBadge = (level, score) => {
    if (score >= 9 || level === 'COMPREHENSIVE' || level === 'CRITICAL') return <span className="badge badge-critical">CRITICAL RISK ({score}/10)</span>;
    if (score >= 7 || level === 'SECTORAL' || level === 'HIGH') return <span className="badge badge-high">HIGH RISK ({score}/10)</span>;
    if (score >= 4 || level === 'TARGETED' || level === 'ELEVATED') return <span className="badge badge-medium">ELEVATED RISK ({score}/10)</span>;
    if (score >= 2 || level === 'ARMS_EMBARGO' || level === 'MODERATE') return <span className="badge badge-info">MODERATE ({score}/10)</span>;
    return <span className="badge badge-low">LOW / STANDARD SCREENING ({score || 1}/10)</span>;
  };

  const getRiskMeterColor = (score) => {
    if (score >= 8) return 'var(--risk-critical)';
    if (score >= 6) return 'var(--risk-high)';
    if (score >= 4) return 'var(--risk-medium)';
    return 'var(--risk-low)';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Navbar />

      <main style={{ padding: '28px 40px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link 
            to="/" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: 'var(--accent-blue)', 
              fontSize: '13px', 
              textDecoration: 'none',
              marginBottom: '14px' 
            }}
          >
            <ArrowLeft size={14} /> Back to 3D Globe Selector
          </Link>

          {/* Trade Route Hero Banner */}
          <div className="glass-panel" style={{ padding: '24px 32px', background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-secondary) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                  Bilateral Compliance Assessment & AI Intelligence
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>{fromName}</span>
                    <span className="badge badge-neutral">{fromCode} (Origin)</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                    <ArrowRight size={24} color="var(--accent-blue)" />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>{toName}</span>
                    <span className="badge badge-critical">{toCode} (Destination)</span>
                  </div>
                </div>
              </div>

              {/* Overall Risk Score Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    OVERALL BILATERAL RISK
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    {getRiskBadge(bilateralAssessment.overallLevel, bilateralAssessment.overallRisk)}
                  </div>
                </div>

                <div 
                  className="risk-circle"
                  style={{
                    border: `3px solid ${getRiskMeterColor(bilateralAssessment.overallRisk)}`,
                    color: getRiskMeterColor(bilateralAssessment.overallRisk),
                    background: 'var(--bg-primary)'
                  }}
                >
                  {bilateralAssessment.overallRisk}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('ai_threats')}
              className={`btn btn-sm ${activeTab === 'ai_threats' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '13px',
                padding: '8px 16px',
                background: activeTab === 'ai_threats' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : ''
              }}
            >
              <Brain size={15} /> 🤖 AI Threat Assessment & Synthesis
            </button>
            <button
              onClick={() => setActiveTab('regulations')}
              className={`btn btn-sm ${activeTab === 'regulations' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              <Scale size={15} /> Legal Regimes & Sanctions Lists ({bilateralAssessment.regimes.length})
            </button>
          </div>

          <Link
            to={`/entities/${toCode}?from=${fromCode}`}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            <ShieldAlert size={14} /> Screen All {countryStats?.entityCount || 0} Denied Parties ({toCode}) <ArrowRight size={14} />
          </Link>
        </div>

        {/* TAB 1: AI THREATS & STRATEGIC BRIEFING */}
        {activeTab === 'ai_threats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {loadingAi ? (
              <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
                <div className="pulse" style={{ fontSize: '36px', marginBottom: '16px' }}>🤖</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>
                  Generating Strategic Bilateral Threat Assessment...
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Gemini AI is synthesizing OFAC, EU FSF, BIS export controls, and Layer 2 investigative press indicators for {fromName} → {toName}.
                </p>
              </div>
            ) : aiError ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderColor: 'var(--risk-high)' }}>
                <AlertTriangle size={36} color="var(--risk-high)" style={{ marginBottom: '12px' }} />
                <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '6px' }}>AI Assessment Unavailable</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{aiError}</p>
                <button onClick={fetchAiBilateralRisk} className="btn btn-secondary btn-sm">
                  <RefreshCw size={14} /> Retry Generation
                </button>
              </div>
            ) : aiAnalysis ? (
              <>
                {/* Executive Summary Card */}
                <div className="glass-panel" style={{ padding: '28px', borderLeft: `4px solid ${getRiskMeterColor(aiAnalysis.threatScore / 10)}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Brain size={20} color="var(--accent-blue)" />
                      <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                        Executive Compliance Briefing
                      </h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AI Threat Rating:</span>
                      <span className={`badge ${aiAnalysis.threatRating === 'CRITICAL' ? 'badge-critical' : aiAnalysis.threatRating === 'HIGH' ? 'badge-high' : 'badge-medium'}`} style={{ fontSize: '12px', padding: '3px 8px' }}>
                        {aiAnalysis.threatRating} ({aiAnalysis.threatScore || 85}/100)
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                    {aiAnalysis.executiveSummary}
                  </p>
                </div>

                {/* 2-Column Grid: Primary Threat Vectors + Compliance Action Plan */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
                  
                  {/* Left: Primary Threat Vectors */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                      <ShieldAlert size={18} color="var(--risk-critical)" />
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                        Primary Trade & Shipment Threat Vectors
                      </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {aiAnalysis.primaryThreatVectors?.map((tv, idx) => (
                        <div 
                          key={idx}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '16px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px', color: '#fff' }}>{tv.vector}</strong>
                            <span className={`badge ${tv.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`} style={{ fontSize: '10px' }}>
                              {tv.severity}
                            </span>
                          </div>
                          
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
                            {tv.description}
                          </p>

                          {tv.redFlags?.length > 0 && (
                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '6px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--risk-high)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Red Flags to Detect:
                              </div>
                              <ul style={{ paddingLeft: '18px', fontSize: '11px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {tv.redFlags.map((rf, rfIdx) => (
                                  <li key={rfIdx}>{rf}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Actionable Compliance Action Plan & Adverse Media Signal */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Compliance Action Plan */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                        <ListChecks size={18} color="var(--accent-cyan)" />
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                          Actionable Compliance Guardrails
                        </h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {aiAnalysis.complianceActionPlan?.map((plan, pIdx) => (
                          <div 
                            key={pIdx}
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '14px',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px'
                            }}
                          >
                            <div style={{
                              padding: '6px',
                              borderRadius: '50%',
                              background: plan.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              color: plan.priority === 'HIGH' ? 'var(--risk-critical)' : 'var(--accent-blue)',
                              marginTop: '2px'
                            }}>
                              <CheckCircle2 size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>
                                {plan.step}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                                {plan.recommendation}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Layer 2 Adverse Media Early-Warning Signal */}
                    {aiAnalysis.adverseMediaSignal && (
                      <div className="glass-panel" style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <Sparkles size={16} color="var(--risk-high)" />
                          <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                            Layer 2 Pre-Listing Intelligence Signal
                          </h4>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                          {aiAnalysis.adverseMediaSignal}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* TAB 2: LEGAL REGIMES & SANCTIONS PROGRAM DETAILS */}
        {activeTab === 'regulations' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '28px' }}>
            {/* Left Column: Regulatory Regime Breakdown */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={18} color="var(--accent-blue)" />
                  Origin Jurisdiction Regulatory Regimes
                </h2>
                <span className="badge badge-info" style={{ fontSize: '10px' }}>
                  {bilateralAssessment.regimes.length} Applicable Regimes
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {bilateralAssessment.regimes.map((regimeAssessment, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: '#fff' }}>
                          {REGIME_INFO[regimeAssessment.regime]?.name || regimeAssessment.regime}
                        </strong>
                        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                          {regimeAssessment.regime}
                        </span>
                      </div>
                      {getRiskBadge(regimeAssessment.level, regimeAssessment.riskScore)}
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '12px', lineHeight: 1.4 }}>
                      {regimeAssessment.summary}
                    </p>

                    {regimeAssessment.programs?.length > 0 && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Active Legal Programs:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {regimeAssessment.programs.map((prog, pIdx) => (
                            <span key={pIdx} className="badge badge-neutral" style={{ fontSize: '10px', textTransform: 'none' }}>
                              {prog}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                      <span>Legal Basis: <code>{regimeAssessment.legalBasis || 'General Export Controls'}</code></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HelpCircle size={11} /> Confidence: <strong>{regimeAssessment.confidence || 'HIGH'}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Layer 1 & 2 Metrics + Sector Restrictions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <Database size={18} color="var(--accent-cyan)" />
                  Screening Intelligence Metrics ({toName})
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      LAYER 1: SANCTIONED ENTITIES
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginTop: '6px' }}>
                      {loadingStats ? '...' : (countryStats?.entityCount?.toLocaleString() || '0')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Listed on OFAC, EU, UK, or UN lists
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--risk-critical)', fontFamily: 'var(--font-mono)' }}>
                      LAYER 2: ADVERSE MEDIA HITS
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--risk-critical)', marginTop: '6px' }}>
                      {loadingStats ? '...' : (countryStats?.mediaHitEntities?.toLocaleString() || '0')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Entities linked to investigative press
                    </div>
                  </div>
                </div>
              </div>

              {/* Sector Restrictions */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Package size={18} color="var(--accent-blue)" />
                  Restricted Sectors & Dual-Use Goods
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bilateralAssessment.regimes.flatMap(r => r.sectors || []).length > 0 ? (
                    Array.from(new Set(bilateralAssessment.regimes.flatMap(r => r.sectors || []))).map((sec, sIdx) => (
                      <div 
                        key={sIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <AlertOctagon size={15} color="var(--risk-high)" style={{ flexShrink: 0 }} />
                        <span>{sec}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      No broad sector embargoes active between this country pair. Standard denied-party screening applies.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Call to Action */}
        <div className="glass-panel" style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>
              Screen Individual Entities & Counterparties in {toName}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Dual-layer prioritized search: targets with corroborated investigative press hits appear first.
            </div>
          </div>

          <Link
            to={`/entities/${toCode}?from=${fromCode}`}
            className="btn btn-primary"
            style={{ padding: '12px 24px' }}
          >
            Open Denied-Party Screener ({toCode}) <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    </div>
  );
}
