import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useInvestigator } from '../context/InvestigatorContext';

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { profile, openModal, homeCountryName } = useInvestigator();

  // Shares the ['system-status'] cache with the SystemStatus page — no extra fetch
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => fetch('/api/system/status').then((res) => res.json()),
    staleTime: 5 * 60 * 1000,
  });
  const sanctionedCount = status ? (status.totalSanctioned ?? 0).toLocaleString() : '—';
  const articleCount = status ? (status.totalArticles ?? 0).toLocaleString() : '—';

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/threat-briefing', label: 'Threat Briefing', icon: 'security' },
    { path: '/entity-intelligence', label: 'Entity Intelligence', icon: 'travel_explore' },
    { path: '/watchlist', label: 'Watchlist', icon: 'notifications_active' },
    { path: '/system-status', label: 'System Status', icon: 'sensors' },
  ];

  // User initials
  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AR';

  return (
    <>
      {/* Mobile backdrop: tap to dismiss the drawer */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-low z-[70] flex flex-col border-r border-outline-variant/30 select-none transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-[52px] h-[52px] rounded-2xl overflow-hidden shadow-md shrink-0">
          <img src="/argus-logo.png" alt="Argus logo" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="font-headline-md text-headline-md tracking-tight text-primary font-bold">Argus</span>
          <span className="text-[11px] font-mono text-outline tracking-wider uppercase">AI Sanctions Intel</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 mt-2 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined mr-4 text-[22px]">{item.icon}</span>
            <span className="font-button text-button">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Dual-Layer Status Pill */}
      <div className="mx-4 mb-3 p-3.5 bg-surface rounded-2xl border border-outline-variant/20 flex flex-col gap-1.5 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-on-surface-variant uppercase font-semibold">Dual-Layer Pipeline</span>
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE
          </span>
        </div>
        <div className="text-[12px] text-on-surface-variant">
          <span className="font-bold text-on-surface">{sanctionedCount}</span> Sanctioned &bull; <span className="font-bold text-on-surface">{articleCount}</span> Articles
        </div>
      </div>

      {/* User / Investigator Identity Card */}
      <div
        onClick={openModal}
        title="Click to edit your Investigator Profile & Home Jurisdiction"
        className="p-4 mx-2 mb-2 rounded-2xl border border-outline-variant/20 flex items-center gap-3 bg-surface hover:bg-surface-container-highest transition-all cursor-pointer shadow-sm group"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary text-white flex items-center justify-center font-bold text-sm ring-2 ring-primary/20 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
          {initials}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface truncate">{profile.name}</span>
            <span className="text-[10px] font-mono text-primary font-bold">{profile.homeCountry}</span>
          </div>
          <span className="text-[11px] text-on-surface-variant truncate">{profile.role}</span>
          <span className="text-[10px] text-outline truncate">{profile.organization}</span>
        </div>
        <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-primary transition-colors">
          settings
        </span>
      </div>
      </aside>
    </>
  );
}