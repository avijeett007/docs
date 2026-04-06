'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  MoreHorizontal,
  Search,
  Mail,
  Eye,
  UserCheck,
  AlertCircle,
  Users2,
  DollarSign,
  Copy,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import AffiliateManagementModal from '@/components/admin/AffiliateManagementModal';

interface Partner {
  id: string;
  businessName: string;
  email: string;
  emailAddress?: string; // For backward compatibility
  createdAt: string;
  status: string;
  customersCount: number;
  profitMultiplier: number;
  logo?: string;
  manualSaasModeEnabled?: boolean;
  planId?: string;
  portalMode?: string;
  subdomain?: string | null;
  customDomain?: string | null;
  affiliate?: {
    rewardfulId?: string;
    status?: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    commissionRate?: number;
    commissionTier?: string;
    totalConversions?: number;
    totalCommissionEarned?: number;
    isAffiliate: boolean;
  };
  committedPartner?: {
    isCommitted: boolean;
    monthlyAmount: number | null;
    startDate: string | null;
    endDate: string | null;
  };
}

export default function PartnersPage() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [updatingPartners, setUpdatingPartners] = useState<Set<string>>(new Set());
  const [updatingCommittedPartners, setUpdatingCommittedPartners] = useState<Set<string>>(new Set());
  const [affiliateModalOpen, setAffiliateModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [committedPartnerModalOpen, setCommittedPartnerModalOpen] = useState(false);
  const [committedAmount, setCommittedAmount] = useState<string>('');
  const [invalidatingCache, setInvalidatingCache] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/partners');
        if (!response.ok) {
          throw new Error('Failed to fetch partners');
        }
        const data = await response.json();
        setPartners(data);
        setFilteredPartners(data);
      } catch (err: any) {
        console.error('Error fetching partners:', err);
        setError(err.message || 'An error occurred while fetching partners');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPartners();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPartners(partners);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = partners.filter(
        partner => 
          partner.businessName.toLowerCase().includes(query) || 
          partner.email.toLowerCase().includes(query)
      );
      setFilteredPartners(filtered);
    }
  }, [searchQuery, partners]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSaasModeToggle = async (partnerId: string, currentValue: boolean) => {
    const partner = partners.find(p => p.id === partnerId);
    const partnerName = partner?.businessName || 'Partner';

    try {
      setUpdatingPartners(prev => new Set(prev).add(partnerId));

      const response = await fetch(`/api/admin/partners/${partnerId}/saas-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          manualSaasModeEnabled: !currentValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update SaaS mode (${response.status})`);
      }

      const result = await response.json();

      // Update the partner in the local state
      setPartners(prev => prev.map(partner =>
        partner.id === partnerId
          ? { ...partner, manualSaasModeEnabled: !currentValue }
          : partner
      ));

      // Update filtered partners as well
      setFilteredPartners(prev => prev.map(partner =>
        partner.id === partnerId
          ? { ...partner, manualSaasModeEnabled: !currentValue }
          : partner
      ));

      // Show success toast
      toast({
        title: "✅ SaaS Mode Updated",
        description: `Manual SaaS mode ${!currentValue ? 'enabled' : 'disabled'} for ${partnerName}`,
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });

    } catch (error: any) {
      console.error('Error updating SaaS mode:', error);

      // Show error toast
      toast({
        title: "❌ Update Failed",
        description: error.message || 'Failed to update SaaS mode. Please try again.',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setUpdatingPartners(prev => {
        const newSet = new Set(prev);
        newSet.delete(partnerId);
        return newSet;
      });
    }
  };

  const handleAffiliateManagement = (partner: Partner) => {
    setSelectedPartner(partner);
    setAffiliateModalOpen(true);
  };

  const handleAffiliateSuccess = () => {
    // Refresh partners data
    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/admin/partners');
        if (response.ok) {
          const data = await response.json();
          setPartners(data);
          setFilteredPartners(data);
        }
      } catch (error) {
        console.error('Error refreshing partners:', error);
      }
    };
    fetchPartners();
  };

  const copyReferralLink = (rewardfulId: string, businessName: string) => {
    const referralLink = `https://knotie-ai.pro?via=${rewardfulId}`;
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "✅ Referral Link Copied!",
      description: `Link for ${businessName} copied to clipboard`,
      className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
    });
  };

  const handleInvalidateCache = async (partner: Partner) => {
    const partnerId = partner.id;
    const partnerName = partner.businessName;

    try {
      setInvalidatingCache(prev => new Set(prev).add(partnerId));

      // Call the admin endpoint to invalidate cache
      const response = await fetch(`/api/admin/partners/${partnerId}/invalidate-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const domains = data.domains.map((d: any) => d.domain).join(', ');
        toast({
          title: "✅ Cache Invalidated",
          description: `Cache cleared for ${partnerName} (${domains})`,
          className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
        });
      } else {
        throw new Error(data.error || data.message || 'Failed to invalidate cache');
      }
    } catch (error: any) {
      toast({
        title: "❌ Cache Invalidation Failed",
        description: error.message || 'Failed to invalidate domain cache',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setInvalidatingCache(prev => {
        const newSet = new Set(prev);
        newSet.delete(partnerId);
        return newSet;
      });
    }
  };

  const handleCommittedPartnerToggle = async (partnerId: string, currentValue: boolean, currentAmount: number | null) => {
    const partner = partners.find(p => p.id === partnerId);
    const partnerName = partner?.businessName || 'Partner';

    // If enabling committed partner, show modal to get amount
    if (!currentValue) {
      setSelectedPartner(partner || null);
      setCommittedAmount(currentAmount?.toString() || '99');
      setCommittedPartnerModalOpen(true);
      return;
    }

    // If disabling, just toggle off
    try {
      setUpdatingCommittedPartners(prev => new Set(prev).add(partnerId));

      const response = await fetch(`/api/admin/partners/${partnerId}/committed-partner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCommittedPartner: false }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update committed partner status (${response.status})`);
      }

      // Update local state
      setPartners(prev => prev.map(p =>
        p.id === partnerId
          ? { ...p, committedPartner: { ...p.committedPartner!, isCommitted: false } }
          : p
      ));
      setFilteredPartners(prev => prev.map(p =>
        p.id === partnerId
          ? { ...p, committedPartner: { ...p.committedPartner!, isCommitted: false } }
          : p
      ));

      toast({
        title: "✅ Committed Partner Disabled",
        description: `${partnerName} is no longer a committed partner`,
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });
    } catch (error: any) {
      toast({
        title: "❌ Update Failed",
        description: error.message || 'Failed to update committed partner status',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setUpdatingCommittedPartners(prev => {
        const newSet = new Set(prev);
        newSet.delete(partnerId);
        return newSet;
      });
    }
  };

  const handleCommittedPartnerSave = async () => {
    if (!selectedPartner) return;

    const amount = parseFloat(committedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "❌ Invalid Amount",
        description: "Please enter a valid monthly commitment amount",
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
      return;
    }

    try {
      setUpdatingCommittedPartners(prev => new Set(prev).add(selectedPartner.id));

      const response = await fetch(`/api/admin/partners/${selectedPartner.id}/committed-partner`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isCommittedPartner: true,
          committedMonthlyAmount: amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update committed partner status');
      }

      // Update local state
      setPartners(prev => prev.map(p =>
        p.id === selectedPartner.id
          ? { ...p, committedPartner: { isCommitted: true, monthlyAmount: amount, startDate: new Date().toISOString(), endDate: null } }
          : p
      ));
      setFilteredPartners(prev => prev.map(p =>
        p.id === selectedPartner.id
          ? { ...p, committedPartner: { isCommitted: true, monthlyAmount: amount, startDate: new Date().toISOString(), endDate: null } }
          : p
      ));

      toast({
        title: "✅ Committed Partner Enabled",
        description: `${selectedPartner.businessName} is now a committed partner at $${amount}/month`,
        className: "bg-green-900 border-green-700 text-green-100 shadow-lg",
      });

      setCommittedPartnerModalOpen(false);
      setSelectedPartner(null);
    } catch (error: any) {
      toast({
        title: "❌ Update Failed",
        description: error.message || 'Failed to update committed partner status',
        className: "bg-red-900 border-red-700 text-red-100 shadow-lg",
      });
    } finally {
      setUpdatingCommittedPartners(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedPartner.id);
        return newSet;
      });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search partners..."
                  className="pl-8 w-[250px]"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Partner Businesses</CardTitle>
              <CardDescription>
                Manage your platform partners and their settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600"></div>
                </div>
              ) : filteredPartners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? 'No partners found matching your search' : 'No partners found'}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Customers</TableHead>
                        <TableHead>Profit Multiplier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>SaaS Mode</TableHead>
                        <TableHead>Committed Partner</TableHead>
                        <TableHead>Affiliate</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPartners.map((partner) => (
                        <TableRow key={partner.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              {partner.logo ? (
                                <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                                  <Image 
                                    src={partner.logo} 
                                    alt={partner.businessName} 
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                  {partner.businessName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span>{partner.businessName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{partner.email}</TableCell>
                          <TableCell>{partner.customersCount}</TableCell>
                          <TableCell>{partner.profitMultiplier}x</TableCell>
                          <TableCell>
                            <Badge 
                              variant={partner.status === 'active' ? 'default' : 'secondary'}
                              className={
                                partner.status === 'active' 
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                              }
                            >
                              {partner.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <Switch
                                  checked={partner.manualSaasModeEnabled || false}
                                  onCheckedChange={() => handleSaasModeToggle(partner.id, partner.manualSaasModeEnabled || false)}
                                  disabled={updatingPartners.has(partner.id)}
                                  className="data-[state=checked]:bg-green-600"
                                />
                                {updatingPartners.has(partner.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="animate-spin h-3 w-3 border border-gray-300 rounded-full border-t-blue-600"></div>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {updatingPartners.has(partner.id)
                                  ? 'Updating...'
                                  : (partner.manualSaasModeEnabled ? 'Enabled' : 'Disabled')
                                }
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="relative">
                                <Switch
                                  checked={partner.committedPartner?.isCommitted || false}
                                  onCheckedChange={() => handleCommittedPartnerToggle(
                                    partner.id,
                                    partner.committedPartner?.isCommitted || false,
                                    partner.committedPartner?.monthlyAmount || null
                                  )}
                                  disabled={updatingCommittedPartners.has(partner.id)}
                                  className="data-[state=checked]:bg-purple-600"
                                />
                                {updatingCommittedPartners.has(partner.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="animate-spin h-3 w-3 border border-gray-300 rounded-full border-t-purple-600"></div>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500">
                                  {updatingCommittedPartners.has(partner.id)
                                    ? 'Updating...'
                                    : (partner.committedPartner?.isCommitted ? 'Committed' : 'Standard')
                                  }
                                </span>
                                {partner.committedPartner?.isCommitted && partner.committedPartner?.monthlyAmount && (
                                  <span className="text-xs text-purple-600 font-medium">
                                    ${partner.committedPartner.monthlyAmount}/mo
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {partner.affiliate?.isAffiliate ? (
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <Badge
                                      variant={partner.affiliate.status === 'ACTIVE' ? 'default' : 'secondary'}
                                      className={
                                        partner.affiliate.status === 'ACTIVE'
                                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                          : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                                      }
                                    >
                                      {partner.affiliate.commissionRate}%
                                      {partner.affiliate.commissionTier === 'subscriber' ? ' Lifetime' : ''}
                                    </Badge>
                                    <div className="text-xs text-gray-500">
                                      {partner.affiliate.totalConversions || 0} conversions
                                    </div>
                                  </div>
                                  {partner.affiliate.status === 'ACTIVE' && partner.affiliate.rewardfulId && (
                                    <div className="flex items-center space-x-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyReferralLink(partner.affiliate!.rewardfulId!, partner.businessName)}
                                        className="h-6 px-2 text-xs"
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copy Link
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.open(`https://knotie-ai.pro?via=${partner.affiliate!.rewardfulId}`, '_blank')}
                                        className="h-6 px-2 text-xs"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">
                                  Not Enrolled
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(partner.createdAt), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <Link href={`/mission-control/partners/${partner.id}`} passHref>
                                  <DropdownMenuItem>
                                    <Eye className="mr-2 h-4 w-4" />
                                    <span>View Details</span>
                                  </DropdownMenuItem>
                                </Link>
                                <Link href={`/mission-control/email?partner=${partner.id}`} passHref>
                                  <DropdownMenuItem>
                                    <Mail className="mr-2 h-4 w-4" />
                                    <span>Send Email</span>
                                  </DropdownMenuItem>
                                </Link>
                                {partner.affiliate?.isAffiliate && partner.affiliate.status === 'ACTIVE' && partner.affiliate.rewardfulId && (
                                  <DropdownMenuItem onClick={() => copyReferralLink(partner.affiliate!.rewardfulId!, partner.businessName)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    <span>Copy Referral Link</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleAffiliateManagement(partner)}>
                                  <Users2 className="mr-2 h-4 w-4" />
                                  <span>
                                    {partner.affiliate?.isAffiliate ? 'Manage Affiliate' : 'Create Affiliate'}
                                  </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleInvalidateCache(partner)}
                                  disabled={invalidatingCache.has(partner.id)}
                                >
                                  <RefreshCw className={`mr-2 h-4 w-4 ${invalidatingCache.has(partner.id) ? 'animate-spin' : ''}`} />
                                  <span>
                                    {invalidatingCache.has(partner.id) ? 'Invalidating Cache...' : 'Invalidate Domain Cache'}
                                  </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  <span>Toggle Status</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Affiliate Management Modal */}
      {selectedPartner && (
        <AffiliateManagementModal
          isOpen={affiliateModalOpen}
          onClose={() => {
            setAffiliateModalOpen(false);
            setSelectedPartner(null);
          }}
          partner={{
            id: selectedPartner.id,
            businessName: selectedPartner.businessName,
            email: selectedPartner.email || selectedPartner.emailAddress || '',
          }}
          affiliateData={selectedPartner.affiliate?.isAffiliate ? {
            rewardfulId: selectedPartner.affiliate.rewardfulId,
            status: selectedPartner.affiliate.status || 'PENDING',
            commissionRate: selectedPartner.affiliate.commissionRate || 10,
            commissionTier: selectedPartner.affiliate.commissionTier || 'public',
            totalConversions: selectedPartner.affiliate.totalConversions || 0,
            totalCommissionEarned: selectedPartner.affiliate.totalCommissionEarned || 0,
          } : undefined}
          onSuccess={handleAffiliateSuccess}
        />
      )}

      {/* Committed Partner Modal */}
      <Dialog open={committedPartnerModalOpen} onOpenChange={setCommittedPartnerModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Enable Committed Partner</DialogTitle>
            <DialogDescription className="text-gray-300">
              Set the monthly commitment amount for {selectedPartner?.businessName}.
              Committed partners get reduced AI credit rates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="committedAmount" className="text-right text-gray-200">
                Monthly Amount
              </Label>
              <div className="col-span-3 relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="committedAmount"
                  type="number"
                  min="1"
                  step="1"
                  value={committedAmount}
                  onChange={(e) => setCommittedAmount(e.target.value)}
                  className="pl-8 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  placeholder="99"
                />
              </div>
            </div>
            <div className="text-sm text-gray-300 ml-auto mr-4">
              <p className="font-medium text-purple-400">Committed Partner Benefits:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Essential Mode: 3 credits/min (vs 5 standard)</li>
                <li>Moderate Mode: 5 credits/min (vs 7 standard)</li>
                <li>Premium Mode: 7 credits/min (vs 10 standard)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCommittedPartnerModalOpen(false);
                setSelectedPartner(null);
              }}
              className="border-gray-600 text-gray-200 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommittedPartnerSave}
              disabled={updatingCommittedPartners.has(selectedPartner?.id || '')}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {updatingCommittedPartners.has(selectedPartner?.id || '') ? 'Saving...' : 'Enable Committed Partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
