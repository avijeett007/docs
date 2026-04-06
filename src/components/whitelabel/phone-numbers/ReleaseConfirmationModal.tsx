'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, XCircle } from 'lucide-react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { getThemeConfig, PortalTheme } from '@/lib/portalThemes';

interface ReleaseConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  phoneNumber: string;
  isReleasing?: boolean;
}

export function ReleaseConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  phoneNumber,
  isReleasing = false,
}: ReleaseConfirmationModalProps) {
  const { branding } = usePartnerBranding();
  const themeConfig = branding?.themePreference ? getThemeConfig(branding.themePreference as PortalTheme) : getThemeConfig(PortalTheme.MODERN);

  const handleConfirm = () => {
    onConfirm();
    // Don't close the modal here - let the parent component handle it after the operation completes
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-red-400">
            <div className="p-2 bg-red-900/20 rounded-full">
              <AlertTriangle className="h-5 w-5" />
            </div>
            Release Phone Number
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number Display */}
          <div className="flex items-center gap-3 p-4 bg-gray-800 border border-gray-600 rounded-lg">
            <Phone className="h-5 w-5 text-gray-400" />
            <div>
              <div className="font-medium text-white">{phoneNumber}</div>
              <div className="text-sm text-gray-400">This number will be permanently released</div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h4 className="font-semibold text-red-400">Warning: This action cannot be undone</h4>
                <ul className="text-sm text-red-200 space-y-1">
                  <li>• You will lose access to this phone number immediately</li>
                  <li>• The number may become available to other customers</li>
                  <li>• All associated configurations will be removed</li>
                  <li>• No refund will be provided for remaining time</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Text */}
          <div className="text-center">
            <p className="text-gray-300">
              Are you absolutely sure you want to release this phone number?
            </p>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isReleasing}
            className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isReleasing}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            {isReleasing ? (
              <>
                <XCircle className="mr-2 h-4 w-4 animate-spin" />
                Releasing...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Release Number
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
