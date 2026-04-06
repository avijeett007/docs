'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import MigrationDashboard from '@/components/partner/MigrationDashboard';
import AgentImportModal from '@/components/partner/AgentImportModal';
import { Toaster } from 'react-hot-toast';

export default function MigrationPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    const name = localStorage.getItem('partner_name') || 'Partner';
    setPartnerName(name);

    if (!token) {
      router.push('/partner/login');
      return;
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  const handleImportComplete = () => {
    // Refresh the migration dashboard
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

      <main className="flex-1 pl-64 min-h-screen relative">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Agent Migration
              </h1>
              <p className="text-gray-400">
                Manage the migration of your agents from partner-level to agent-level API keys, 
                and import new agents from your provider accounts.
              </p>
            </div>

            {/* Migration Dashboard */}
            <MigrationDashboard 
              onImportClick={() => setShowImportModal(true)}
            />

            {/* Import Modal */}
            <AgentImportModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImportComplete={handleImportComplete}
            />
          </div>
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
