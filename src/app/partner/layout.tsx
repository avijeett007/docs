'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import FloatingOnboardingProgress from '@/components/onboarding/FloatingOnboardingProgress';
import FloatingVideoIcon from '@/components/video/FloatingVideoIcon';
import MFAWarningModal from '@/components/mfa/MFAWarningModal';
import MFASetupModal from '@/components/mfa/MFASetupModal';
import { usePageVideo } from '@/hooks/usePageVideo';

export default function PartnerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { partnerId } = usePartnerAuth();
  const { video: pageVideo } = usePageVideo(pathname || '');
  const [showMFAWarning, setShowMFAWarning] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaWarning, setMfaWarning] = useState<{ isMandatory: boolean; message: string } | null>(null);

  const isPublicPartnerRoute = useMemo(() => {
    if (!pathname) {
      return true;
    }

    return [
      '/partner/login',
      '/partner/google-signup',
      '/partner/accept-invite',
      '/partner/change-password',
    ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }, [pathname]);

  useEffect(() => {
    const loadMFAStatus = async () => {
      if (isPublicPartnerRoute || showMFASetup) {
        setShowMFAWarning(false);
        setMfaWarning(null);
        return;
      }

      try {
        const response = await fetch('/api/partner/auth/mfa/setup', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          setShowMFAWarning(false);
          setMfaWarning(null);
          return;
        }

        const data = await response.json();
        const nextWarning = data.mfaWarning?.shouldShow ? data.mfaWarning : null;

        setMfaWarning(nextWarning);
        setShowMFAWarning(!!nextWarning);
      } catch {
        setShowMFAWarning(false);
        setMfaWarning(null);
      }
    };

    loadMFAStatus();
  }, [isPublicPartnerRoute, showMFASetup]);

  const handleSetupMFA = () => {
    setShowMFAWarning(false);
    setShowMFASetup(true);
  };

  const handleDismissMFAWarning = () => {
    setShowMFAWarning(false);
    setMfaWarning(null);
  };

  const handleMFASetupSuccess = () => {
    setShowMFASetup(false);
    setShowMFAWarning(false);
    setMfaWarning(null);
  };

  const isMFAModalBlocking = showMFAWarning || showMFASetup;

  return (
    <>
      {/* Original page content - unchanged */}
      <div
        aria-hidden={isMFAModalBlocking}
        className={isMFAModalBlocking ? 'pointer-events-none select-none' : undefined}
      >
        {children}
      </div>

      {/* Floating components overlay */}
      {partnerId && !isMFAModalBlocking && (
        <FloatingOnboardingProgress partnerId={partnerId} />
      )}

      {pageVideo && !isMFAModalBlocking && (
        <FloatingVideoIcon
          videoUrl={pageVideo.videoUrl}
          title={pageVideo.title}
          description={pageVideo.description}
          position={pageVideo.position}
        />
      )}

      <MFAWarningModal
        isOpen={showMFAWarning}
        isMandatory={mfaWarning?.isMandatory || false}
        message={mfaWarning?.message || ''}
        onSetupMFA={handleSetupMFA}
        onDismiss={handleDismissMFAWarning}
      />

      <MFASetupModal
        isOpen={showMFASetup}
        onClose={() => setShowMFASetup(false)}
        onSuccess={handleMFASetupSuccess}
      />
    </>
  );
}
