import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ArticleModal from '../components/ArticleModal';
import { COUNTRY_NAMES } from '../data/bilateralRules';
import { 
  Search, Filter, ShieldAlert, Newspaper, ExternalLink, 
  ChevronLeft, ChevronRight, User, Building, Users, AlertCircle, ArrowLeft,
  Sparkles, Brain, ShieldCheck, AlertTriangle
} from 'lucide-react';

export default function EntityList() {
  const { country } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const fromCountry = searchParams.get('from') || 'US';
  const targetCountry = (country || 'RU').toUpperCase();
  
  const [entities, setEntities] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [selectedEntityId, setSelectedEntityId] = useState(null);

  const countryName = COUNTRY_NAMES[targetCountry] || targetCountry;

  useEffect(() => {
    fetchEntities();
  }, [targetCountry, page, listFilter]);

  const fetchEntities = () => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      page,
      limit,
      search,
      list: listFilter
    });

    fetch(`/api/countries/${targetCountry.toLowerCase()}/entities?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        setEntities(data.entities || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch entities:', err);
        setLoading(false);
      });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchEntities();
  };

  const getSchemaIcon = (schema) => {
    switch (schema?.toLowerCase()) {
      case 'person': return <User size={13} />;
      case 'company':
      case 'legalentity': return <Building size={13} />;
      default: return <Users size={13} />;
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Navbar />

      <main style={{ padding: '28px 40px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link 
            to={`/risk/${fromCountry}/${targetCountry}`} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: 'var(--accent-blue)', 
              fontSize: '13px', 
              textDecoration: 'none',
              marginBottom: '12px' 
            }}
          >
            <ArrowLeft size={14} /> Back to Bilateral Risk Assessment ({fromCountry} → {targetCountry})
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#fff' }}>
                  Sanctioned & Watchlisted Entities
                </h1>
                <span className="badge badge-critical" style={{ fontSize: '13px', padding: '4px 10px' }}>
                  {countryName} ({targetCountry})
                </span>
                <span className="badge badge-info" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  <Sparkles size={11} /> Significance-Ranked
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Screening <strong>{total.toLocaleString()}</strong> official sanctions targets. High-significance entities with <strong>both Layer 1 designations and Layer 2 investigative press hits</strong> are prioritized at the top.
              </p>
            </div>

            {/* Quick Country Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target:</span>
              <select 
                value={targetCountry}
                onChange={e => window.location.href = `/entities/${e.target.value}?from=${fromCountry}`}
                className="select"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                {['RU', 'IR', 'KP', 'CN', 'SY', 'CU', 'BY', 'VE', 'MM', 'MX', 'EC', 'IQ', 'LB', 'YE', 'US', 'GB'].map(code => (
                  <option key={code} value={code}>
                    {COUNTRY_NAMES[code] || code} ({code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '280px', maxWidth: '480px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search entity name, alias, or organization..."
                className="input"
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
          </form>

          {/* List Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={13} /> List Filter:
            </span>
            {[
              { id: '', label: 'All Regimes' },
              { id: 'ofac', label: 'US OFAC / SDN' },
              { id: 'eu', label: 'EU FSF' },
              { id: 'uk', label: 'UK OFSI' },
              { id: 'un', label: 'UN Security Council' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setListFilter(tab.id); setPage(1); }}
                className={`btn btn-sm ${listFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Entities Table */}
        <div className="table-container" style={{ marginBottom: '20px' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Entity Name & Status</th>
                <th style={{ width: '24%' }}>Official Sanctions Program</th>
                <th style={{ width: '34%' }}>Layer 2 Adverse Media Intelligence</th>
                <th style={{ width: '14%', textAlign: 'center' }}>AI Intelligence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                    Loading sanctions database...
                  </td>
                </tr>
              ) : entities.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                    <AlertCircle size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <p>No sanctioned entities found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                entities.map((item) => {
                  const isCorroborated = item.matchCount > 0;

                  return (
                    <tr key={item.id} style={{ background: isCorroborated ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                      {/* Entity Name & Schema */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{
                            padding: '6px',
                            borderRadius: '6px',
                            background: isCorroborated ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
                            color: isCorroborated ? 'var(--risk-critical)' : 'var(--text-secondary)',
                            marginTop: '2px'
                          }}>
                            {getSchemaIcon(item.schema)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {item.name}
                              {isCorroborated && (
                                <span className="badge badge-critical" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                  <Sparkles size={9} /> Corroborated
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                                {item.schema || 'Entity'}
                              </span>
                              {item.aliases && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Alias: {item.aliases.split(';')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sanctions details */}
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.sanctions ? (
                            <span>{item.sanctions.substring(0, 120)}...</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Official Denied Party List</span>
                          )}
                        </div>
                      </td>

                      {/* Adverse Media Hits */}
                      <td>
                        {isCorroborated && item.topMatch ? (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            padding: '10px 12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span className="badge badge-critical" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                {item.matchCount} Adverse Hit{item.matchCount > 1 ? 's' : ''}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--accent-cyan)' }}>
                                {item.topMatch.source}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                • {item.topMatch.date || 'Recent'}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#fff', fontWeight: '500', lineHeight: 1.3 }}>
                              "{item.topMatch.headline}"
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            No adverse press matches in current crawl
                          </div>
                        )}
                      </td>

                      {/* Action & AI Profile */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedEntityId(item.id)}
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '11px', padding: '5px 12px', width: '100%', maxWidth: '140px', background: isCorroborated ? 'linear-gradient(135deg, #dc2626, #991b1b)' : '' }}
                          >
                            <Brain size={12} /> {isCorroborated ? `Inspect (${item.matchCount})` : 'AI Profile'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <div>
            Showing <strong>{entities.length ? ((page - 1) * limit) + 1 : 0}</strong> - <strong>{Math.min(page * limit, total)}</strong> of <strong>{total.toLocaleString()}</strong> entities
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="btn btn-secondary btn-sm"
              style={{ opacity: page === 1 ? 0.5 : 1 }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="btn btn-secondary btn-sm"
              style={{ opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </main>

      {/* Article Detail & AI Synthesis Modal */}
      {selectedEntityId && (
        <ArticleModal 
          entityId={selectedEntityId}
          onClose={() => setSelectedEntityId(null)}
        />
      )}
    </div>
  );
}
