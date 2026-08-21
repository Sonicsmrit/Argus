import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Globe, AlertTriangle, Users, Database, Activity } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const [sysStatus, setSysStatus] = useState(null);

  useEffect(() => {
    fetch('/api/system/status')
      .then(res => res.json())
      .then(data => setSysStatus(data))
      .catch(() => {});
  }, []);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 28px',
      background: 'rgba(17, 23, 38, 0.9)',
      borderBottom: '1px solid var(--border-color)',
      backdropFilter: 'blur(10px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Brand & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7, #6366f1)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)'
          }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.02em', color: '#fff' }}>
                SCRAPE<span style={{ color: 'var(--accent-blue)' }}>VERSE</span>
              </span>
              <span className="badge badge-info" style={{ fontSize: '9px', padding: '2px 5px' }}>
                PRO
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Bilateral Sanctions & Adverse Media Intelligence
            </div>
          </div>
        </Link>

        {/* Breadcrumb / Nav items */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            to="/"
            className={`btn btn-sm ${location.pathname === '/' ? 'btn-secondary' : ''}`}
            style={{
              color: location.pathname === '/' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: location.pathname === '/' ? '1px solid var(--border-bright)' : 'none',
              background: location.pathname === '/' ? 'var(--bg-card)' : 'transparent'
            }}
          >
            <Globe size={14} /> 3D Globe
          </Link>
          {location.pathname.startsWith('/risk') && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Bilateral Risk Engine
              </span>
            </>
          )}
          {location.pathname.startsWith('/entities') && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Denied-Party Drilldown
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Live System Metrics Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {sysStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Database size={13} color="var(--accent-blue)" />
              <span>Layer 1:</span>
              <strong style={{ color: '#fff' }}>{sysStatus.totalEntities?.toLocaleString() || '1.17M'}</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Activity size={13} color="var(--accent-cyan)" />
              <span>Layer 2:</span>
              <strong style={{ color: '#fff' }}>{sysStatus.totalArticles?.toLocaleString() || '1,229'}</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <AlertTriangle size={13} color="var(--risk-high)" />
              <span>Adverse Hits:</span>
              <strong style={{ color: 'var(--risk-high)' }}>{sysStatus.totalMatches?.toLocaleString() || '1,416'}</strong>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '20px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              fontSize: '10px',
              color: 'var(--risk-low)'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--risk-low)' }} className="pulse" />
              9 Collectors Active
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
