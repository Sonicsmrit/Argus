import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import ThreatBriefing from './pages/ThreatBriefing';
import EntityIntelligence from './pages/EntityIntelligence';
import InvestigativeProfile from './pages/InvestigativeProfile';
import SystemStatus from './pages/SystemStatus';
import { InvestigatorProvider } from './context/InvestigatorContext';
import InvestigatorModal from './components/InvestigatorModal';

export default function App() {
  return (
    <InvestigatorProvider>
      <div className="bg-background font-body-md text-on-background min-h-screen">
        {/* Fixed Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="pl-72">
          <Header />
          <main className="relative pt-24 bg-background min-h-screen px-container-padding-desktop py-stack-lg">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/threat-briefing" element={<ThreatBriefing />} />
              <Route path="/threat-briefing/:from/:to" element={<ThreatBriefing />} />
              <Route path="/entity-intelligence" element={<EntityIntelligence />} />
              <Route path="/entity-intelligence/:country" element={<EntityIntelligence />} />
              <Route path="/profile/:id" element={<InvestigativeProfile />} />
              <Route path="/system-status" element={<SystemStatus />} />
              {/* Backward compatibility routes */}
              <Route path="/risk/:from/:to" element={<ThreatBriefing />} />
              <Route path="/entities/:country" element={<EntityIntelligence />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        {/* Global Investigator Onboarding & Settings Modal */}
        <InvestigatorModal />
      </div>
    </InvestigatorProvider>
  );
}