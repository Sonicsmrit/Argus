import React, { useState, useEffect } from 'react';
import { useInvestigator } from '../context/InvestigatorContext';
import { COUNTRY_NAMES } from '../data/bilateralRules';
import CountryCombobox from './CountryCombobox';

export default function InvestigatorModal() {
  const { profile, updateProfile, showModal, closeModal } = useInvestigator();

  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const [organization, setOrganization] = useState(profile.organization);
  const [homeCountry, setHomeCountry] = useState(profile.homeCountry);

  // The modal stays mounted (returns null when hidden), so local state would
  // go stale after the profile changes elsewhere. Re-sync on every open.
  useEffect(() => {
    if (showModal) {
      setName(profile.name);
      setRole(profile.role);
      setOrganization(profile.organization);
      setHomeCountry(profile.homeCountry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  if (!showModal) return null;

  const allCountries = Object.entries(COUNTRY_NAMES)
    .map(([code, cName]) => ({ code, name: cName }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfile({
      name: name.trim() || 'Alex Rivet',
      role: role.trim() || 'Compliance Officer',
      organization: organization.trim() || 'Global Trade Compliance',
      homeCountry: homeCountry || 'US',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-[fade-in_0.2s_ease-out]">
      <div className="bg-surface-container-lowest max-w-xl w-full rounded-[2.5rem] p-8 shadow-2xl border border-outline-variant/30 flex flex-col gap-6 relative overflow-hidden">
        {/* Decorative ambient blur */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-tertiary text-white flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[26px]">badge</span>
            </div>
            <div>
              <h2 className="font-headline-md text-xl font-bold text-on-surface">Investigator Identity &amp; Jurisdiction</h2>
              <p className="text-xs text-on-surface-variant">Configure your operational base to calibrate bilateral risk models.</p>
            </div>
          </div>
          {profile.isConfigured && (
            <button
              onClick={closeModal}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors text-outline"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold text-on-surface-variant mb-1.5 uppercase">
                Investigator Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-11 px-4 bg-surface rounded-xl border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                placeholder="e.g. Alex Rivet"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-on-surface-variant mb-1.5 uppercase">
                Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="w-full h-11 px-4 bg-surface rounded-xl border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                placeholder="e.g. Lead Sanctions Analyst"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-on-surface-variant mb-1.5 uppercase">
              Organization / Company
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full h-11 px-4 bg-surface rounded-xl border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
              placeholder="e.g. Global Freight Logistics, Horizon Maritime"
            />
          </div>

          {/* Primary Home Country Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono font-bold text-primary uppercase">
                Home Legal Jurisdiction (Origin State)
              </label>
              <span className="text-[11px] text-outline font-mono">240+ COUNTRIES</span>
            </div>

            <div className="p-3 bg-surface rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
              <CountryCombobox
                value={homeCountry}
                onChange={setHomeCountry}
                countries={allCountries}
                placeholder="Select your jurisdiction"
              />
            </div>
            <p className="text-[11px] text-on-surface-variant/80 mt-1.5 leading-relaxed">
              Your home jurisdiction sets applicable trade embargoes (OFAC, EU, UK OFSI) and secondary sanctions exposure on outbound shipments.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 mt-2">
            {profile.isConfigured && (
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold font-button transition-all shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              Save Identity &amp; Calibrate Engine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}