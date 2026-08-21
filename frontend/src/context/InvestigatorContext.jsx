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