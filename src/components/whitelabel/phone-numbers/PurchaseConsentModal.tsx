'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, DollarSign, Phone, Shield, Clock } from 'lucide-react';
import { usePartnerBranding } from '@/lib/partnerBranding';

interface PurchaseConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  phoneNumber: string;
  monthlyPrice: number;
  setupFee: number;
  currency?: string;
  countryCode: string;
  numberType: string;
  loading?: boolean;
}

export default function PurchaseConsentModal({
  isOpen,
  onClose,
  onConfirm,
  phoneNumber,
  monthlyPrice,
  setupFee,
  currency = 'USD',
  countryCode,
  numberType,
  loading = false
}: PurchaseConsentModalProps) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { branding } = usePartnerBranding();

  const totalCost = monthlyPrice + setupFee;
  const canProceed = consentGiven && termsAccepted;

  const handleConfirm = () => {
    if (canProceed) {
      onConfirm();
    }
  };

  const handleClose = () => {
    setConsentGiven(false);
    setTermsAccepted(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: branding.primaryColor }}>
            <AlertTriangle className="h-5 w-5" />
            Confirm Phone Number Purchase
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Purchase Summary */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="font-semibold mb-3 text-white">Purchase Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-300">Phone Number:</span>
                </div>
                <span className="font-mono text-white">{phoneNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Country:</span>
                <span className="text-white">{countryCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Number Type:</span>
                <span className="text-white capitalize">{numberType}</span>
              </div>
              <div className="border-t border-gray-600 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Monthly Cost:</span>
                  <span className="text-white">{(monthlyPrice / 100).toFixed(2)} {currency.toUpperCase()}/month</span>
                </div>
                {setupFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Setup Fee:</span>
                    <span className="text-white">{(setupFee / 100).toFixed(2)} {currency.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-semibold text-lg border-t border-gray-600 pt-2 mt-2">
                  <span className="text-white">Total Cost:</span>
                  <span style={{ color: branding.primaryColor }}>{(totalCost / 100).toFixed(2)} {currency.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Important Notices */}
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-semibold text-amber-200">Important Notice</h4>
                <ul className="text-sm text-amber-100 space-y-1">
                  <li>• This purchase will be processed immediately</li>
                  <li>• The phone number will be available for <strong>inbound calls only</strong> initially</li>
                  <li>• Outbound calling requires business address verification and compliance approval</li>
                  <li>• Monthly charges will be automatically processed</li>
                  <li>• You can release the number at any time, but setup fees are non-refundable</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Compliance Notice */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-200">Compliance & Verification</h4>
                <p className="text-sm text-blue-100">
                  After purchase, you'll need to submit business documentation and address verification 
                  to enable outbound calling. This process typically takes 1-3 business days for approval.
                </p>
              </div>
            </div>
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="cost-consent"
                checked={consentGiven}
                onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-1"
              />
              <Label htmlFor="cost-consent" className="text-sm text-gray-200 leading-relaxed">
                I understand and consent to the purchase of phone number <strong>{phoneNumber}</strong> for
                a total cost of <strong>{(totalCost / 100).toFixed(2)} {currency.toUpperCase()}</strong> (including any setup fees),
                with monthly recurring charges of <strong>{(monthlyPrice / 100).toFixed(2)} {currency.toUpperCase()}</strong>.
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms-consent"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-1"
              />
              <Label htmlFor="terms-consent" className="text-sm text-gray-200 leading-relaxed">
                I acknowledge that this number will initially be inbound-only and requires business 
                verification for outbound capabilities. I agree to the terms and conditions of phone number usage.
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canProceed || loading}
              className="flex-1"
              style={{ 
                backgroundColor: canProceed ? branding.primaryColor : 'rgb(75 85 99)',
                borderColor: canProceed ? branding.primaryColor : 'rgb(75 85 99)'
              }}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Confirm Purchase
                </div>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
