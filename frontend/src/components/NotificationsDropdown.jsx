import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestigator } from '../context/InvestigatorContext';

export default function NotificationsDropdown({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { profile } = useInvestigator();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetch(`/api/notifications?homeCountry=${profile.homeCountry}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.notifications) {
            setNotifications(data.notifications);
          }
        })
        .catch((err) => console.error('Failed to load notifications:', err));
    }
  }, [isOpen, profile.homeCountry]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'UNREAD') return n.unread;
    if (filter === 'CRITICAL') return n.type === 'CRITICAL';
    return true;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleNotificationClick = (notif) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, unread: false } : n))
    );
    onClose();
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'CRITICAL':
        return { badge: 'bg-error-container text-on-error-container', icon: 'error', iconColor: 'text-error' };
      case 'CORROBORATION':
        return { badge: 'bg-tertiary-container text-on-tertiary-container', icon: 'verified_user', iconColor: 'text-tertiary' };
      case 'WARNING':
        return { badge: 'bg-secondary-container text-on-secondary-container', icon: 'bolt', iconColor: 'text-secondary' };
      default:
        return { badge: 'bg-surface-container text-on-surface-variant', icon: 'info', iconColor: 'text-primary' };
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-14 right-4 w-96 max-w-[90vw] bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/30 z-50 overflow-hidden animate-[fade-in_0.2s_ease-out]"
    >
      {/* Header */}
      <div className="p-4 px-5 bg-surface-container-low border-b border-outline-variant/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-headline-md text-sm font-bold text-on-surface">Sanctions &amp; Corridor Alerts</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-error text-white font-mono text-[10px] font-bold">
              {unreadCount} NEW
            </span>
          )}
        </div>
        <button
          onClick={markAllRead}
          className="text-[11px] font-mono text-primary font-bold hover:underline"
        >
          Mark all read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-2 px-3 border-b border-outline-variant/10 bg-surface/50 text-[11px] font-mono">
        {['ALL', 'UNREAD', 'CRITICAL'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full font-bold transition-all ${
              filter === f
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-outline-variant/10">
        {filteredNotifs.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
            No alerts in this category.
          </div>
        ) : (
          filteredNotifs.map((notif) => {
            const style = getTypeStyle(notif.type);
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 flex items-start gap-3 hover:bg-surface-container/60 transition-colors cursor-pointer relative ${
                  notif.unread ? 'bg-primary-container/5' : ''
                }`}
              >
                {notif.unread && (
                  <span className="w-2 h-2 rounded-full bg-primary absolute top-4 left-2"></span>
                )}
                <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center shrink-0 mt-0.5">
                  <span className={`material-symbols-outlined text-[18px] ${style.iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {style.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase ${style.badge}`}>
                      {notif.type}
                    </span>
                    <span className="text-[10px] font-mono text-outline">{notif.time}</span>
                  </div>
                  <h4 className="text-xs font-bold text-on-surface leading-snug">{notif.title}</h4>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-surface-container-low border-t border-outline-variant/15 text-center">
        <button
          onClick={() => {
            onClose();
            navigate(`/threat-briefing?from=${profile.homeCountry}&to=RU`);
          }}
          className="text-xs font-mono font-bold text-primary hover:underline flex items-center justify-center gap-1 w-full"
        >
          View Strategic Bilateral Intelligence &rarr;
        </button>
      </div>
    </div>
  );
}