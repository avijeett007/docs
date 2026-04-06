'use client';

import React from 'react';
import PartnerSidebar from './PartnerSidebar';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';

interface GuidedPartnerSidebarProps {
  partnerName: string;
  onLogout: () => void;
  onCreditClaimClick?: (claim: any) => void;
}

export default function GuidedPartnerSidebar(props: GuidedPartnerSidebarProps) {
  const { role, isTeamMember } = usePartnerAuth();

  return (
    <>
      <PartnerSidebar {...props} userRole={role} isTeamMember={isTeamMember} />
    </>
  );
}