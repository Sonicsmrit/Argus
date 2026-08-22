import React, { createContext, useContext, useState, useEffect } from 'react';
import { COUNTRY_NAMES } from '../data/bilateralRules';

const InvestigatorContext = createContext(null);

const DEFAULT_PROFILE = {
  name: 'Alex Rivet',
  role: 'Lead Sanctions Investigator',
  organization: 'Global Supply Chain Compliance',
  homeCountry: 'US',
  isConfigured: true,
};

export function InvestigatorProvider({ children }) {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('scrapeverse_investigator');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_PROFILE;
  });

  const [showModal, setShowModal] = useState(false);

  // Read-notification tracking, persisted across sessions so the bell dot
  // reflects reality instead of resetting on every reload.
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      const saved = localStorage.getItem('scrapeverse_read_notifications');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch (e) {
      return new Set();
    }
  });

  const markNotificationsRead = (ids) => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      (Array.isArray(ids) ? ids : [ids]).forEach((id) => next.add(id));
      try {
        localStorage.setItem('scrapeverse_read_notifications', JSON.stringify([...next]));
      } catch (e) { /* storage unavailable */ }
      return next;
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem('scrapeverse_investigator', JSON.stringify(profile));
    } catch (e) {}
  }, [profile]);

  const updateProfile = (newValues) => {
    setProfile((prev) => ({
      ...prev,
      ...newValues,
      isConfigured: true,
    }));
    setShowModal(false);
  };

  return (
    <InvestigatorContext.Provider
      value={{
        profile,
        updateProfile,
        showModal,
        openModal: () => setShowModal(true),
        closeModal: () => setShowModal(false),
        homeCountryName: COUNTRY_NAMES[profile.homeCountry] || profile.homeCountry,
        readNotificationIds,
        markNotificationsRead,
      }}
    >
      {children}
    </InvestigatorContext.Provider>
  );
}

export function useInvestigator() {
  const ctx = useContext(InvestigatorContext);
  if (!ctx) throw new Error('useInvestigator must be used within InvestigatorProvider');
  return ctx;
}