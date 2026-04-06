'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, Users, TrendingUp, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Partner {
  id: string;
  businessName: string;
  email: string;
}

interface AffiliateData {
  rewardfulId?: string;
  token?: string;
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  commissionRate: number;
  commissionDuration?: number;
  commissionTier: string;
  createdAt?: string;
  activatedAt?: string;
  lastConversionAt?: string;
  totalConversions: number;
  totalCommissionEarned: number;
}

interface AffiliateManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner;
  affiliateData?: AffiliateData;
  onSuccess?: () => void;
}

const COMMISSION_TIERS = [
  { value: 'public', label: 'Public (10% for 6 months)', rate: 10, duration: 6 },
  { value: 'free_signup', label: 'Free Signup (20% for 1 year)', rate: 20, duration: 12 },
  { value: 'subscriber', label: 'Subscriber (40% lifetime)', rate: 40, duration: null },
];

export default function AffiliateManagementModal({
  isOpen,
  onClose,
  partner,
  affiliateData,
  onSuccess,
}: AffiliateManagementModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    commissionTier: 'public',
    commissionRate: 10,
    commissionDuration: 6,
    status: 'ACTIVE' as 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  });

  useEffect(() => {
    if (affiliateData) {
      setFormData({
        commissionTier: affiliateData.commissionTier || 'public',
        commissionRate: Number(affiliateData.commissionRate) || 10,
        commissionDuration: affiliateData.commissionDuration || 6,
        status: affiliateData.status || 'ACTIVE',
      });
    }
  }, [affiliateData]);

  const handleTierChange = (tier: string) => {
    const tierConfig = COMMISSION_TIERS.find(t => t.value === tier);
    if (tierConfig) {
      setFormData(prev => ({
        ...prev,
        commissionTier: tier,
        commissionRate: tierConfig.rate,
        commissionDuration: tierConfig.duration || 0,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/affiliate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save affiliate settings');
      }

      const result = await response.json();

      toast({
        title: "✅ Affiliate Settings Saved",
        description: `${affiliateData?.rewardfulId ? 'Updated' : 'Created'} affiliate for ${partner.businessName}`,
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error saving affiliate:', error);
      toast({
        title: "❌ Save Failed",
        description: error.message || 'Failed to save affiliate settings',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setLoading(false);
    }
  };

  const isExistingAffiliate = !!affiliateData?.rewardfulId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
            {isExistingAffiliate ? 'Manage' : 'Create'} Affiliate - {partner.businessName}
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            {isExistingAffiliate
              ? 'Update affiliate settings and view performance metrics'
              : 'Set up affiliate program for this partner'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Partner Information */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Partner Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Business Name:</span>
              <div className="font-medium text-gray-900 dark:text-white">{partner.businessName}</div>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Email:</span>
              <div className="font-medium text-gray-900 dark:text-white">{partner.email}</div>
            </div>
          </div>
        </div>

        {/* Existing Affiliate Stats */}
        {isExistingAffiliate && affiliateData && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center text-gray-700 dark:text-gray-300">
                  <Users className="h-4 w-4 mr-2 text-blue-600" />
                  Total Conversions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{affiliateData.totalConversions}</div>
                {affiliateData.lastConversionAt && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Last: {format(new Date(affiliateData.lastConversionAt), 'MMM d, yyyy')}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center text-gray-700 dark:text-gray-300">
                  <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                  Commission Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${Number(affiliateData.totalCommissionEarned).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Rate: {affiliateData.commissionRate}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Status Badge for Existing Affiliates */}
        {isExistingAffiliate && affiliateData && (
          <div className="flex items-center justify-between mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status:</span>
              <Badge
                variant={affiliateData.status === 'ACTIVE' ? 'default' : 'secondary'}
                className={`${
                  affiliateData.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : affiliateData.status === 'SUSPENDED'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {affiliateData.status}
              </Badge>
            </div>
            {affiliateData.rewardfulId && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ID: {affiliateData.rewardfulId}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Commission Tier Selection */}
          <div className="space-y-2">
            <Label htmlFor="commissionTier" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Commission Tier
            </Label>
            <Select
              value={formData.commissionTier}
              onValueChange={handleTierChange}
            >
              <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <SelectValue placeholder="Select commission tier" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                {COMMISSION_TIERS.map((tier) => (
                  <SelectItem
                    key={tier.value}
                    value={tier.value}
                    className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Commission Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commissionRate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Commission Rate (%)
              </Label>
              <Input
                id="commissionRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.commissionRate}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  commissionRate: Number(e.target.value)
                }))}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commissionDuration" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Duration (months)
              </Label>
              <Input
                id="commissionDuration"
                type="number"
                min="0"
                value={formData.commissionDuration}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  commissionDuration: Number(e.target.value)
                }))}
                placeholder="0 for lifetime"
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                status: value as any
              }))}
            >
              <SelectTrigger className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                <SelectItem value="ACTIVE" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Active
                  </div>
                </SelectItem>
                <SelectItem value="INACTIVE" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                    Inactive
                  </div>
                </SelectItem>
                <SelectItem value="SUSPENDED" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                    Suspended
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Affiliate Link Display */}
          {isExistingAffiliate && affiliateData?.rewardfulId && (
            <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Referral Link
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  value={`https://knotie-ai.pro?via=${affiliateData.rewardfulId}`}
                  readOnly
                  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://knotie-ai.pro?via=${affiliateData.rewardfulId}`);
                    toast({
                      title: "✅ Copied!",
                      description: "Referral link copied to clipboard",
                      className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
                    });
                  }}
                  className="shrink-0"
                >
                  Copy
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isExistingAffiliate ? 'Update Affiliate' : 'Create Affiliate'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
