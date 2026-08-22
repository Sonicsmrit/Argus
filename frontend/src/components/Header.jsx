import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useInvestigator } from '../context/InvestigatorContext';
import NotificationsDropdown from './NotificationsDropdown';

export default function Header() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const navigate = useNavigate();
  const { profile, openModal, homeCountryName, readNotificationIds } = useInvestigator();

  // Same cached query the dropdown uses; drives the live unread badge
  const { data: notifData } = useQuery({
    queryKey: ['notifications', profile.homeCountry],
    queryFn: () =>
      fetch(`/api/notifications?homeCountry=${profile.homeCountry}`).then((res) => res.json()),
    staleTime: 60 * 1000,
  });
  const unreadCount = (notifData?.notifications || []).filter(
    (n) => Boolean(n.unread) && !readNotificationIds.has(n.id)
  ).length;

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      navigate(`/entity-intelligence?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-72 right-0 h-20 bg-surface z-40 flex items-center justify-between px-container-padding-desktop border-b border-outline-variant/15">
      {/* Quick Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center group">
          <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors text-[20px]">
            search
          </span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
            className="w-full h-11 pl-12 pr-4 bg-surface-container rounded-full border border-transparent focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/10 text-body-md text-on-surface outline-none transition-all placeholder:text-outline/70 shadow-sm"
            placeholder="Search all 46,293 entities, trade routes, or 1,222 adverse articles..."
            type="text"
          />
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3 relative">
        {/* Jurisdiction Badge */}
        <button
          onClick={openModal}
          title="Click to change your Home Origin Jurisdiction"
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-container/15 hover:bg-primary-container/25 text-primary text-xs font-mono font-bold border border-primary/20 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">travel_explore</span>
          <span>{profile.homeCountry} ({homeCountryName})</span>
          <span className="material-symbols-outlined text-[14px]">edit</span>
        </button>

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-mono border border-outline-variant/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>GEMINI AI ACTIVE</span>
        </div>

        {/* Notifications Toggle */}
        <div className="relative">
          <button 
            title="Sanctions & Corridor Notifications"
            onClick={() => setShowNotifs(!showNotifs)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors relative ${
              showNotifs
                ? 'bg-primary-container text-white'
                : 'hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-error text-white rounded-full ring-2 ring-surface text-[9px] font-mono font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Interactive Notifications Dropdown */}
          <NotificationsDropdown
            isOpen={showNotifs}
            onClose={() => setShowNotifs(false)}
          />
        </div>

        {/* System Telemetry */}
        <button 
          title="System Telemetry & Health"
          onClick={() => navigate('/system-status')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[22px]">sensors</span>
        </button>
      </div>
    </header>
  );
}