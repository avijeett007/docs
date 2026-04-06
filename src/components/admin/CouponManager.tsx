'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Copy,
  Edit,
  Trash2,
  Plus,
  Calendar,
  Users,
  Ticket,
  DollarSign
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  discountType?: string;
  discountValue?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  campaignId?: string;
  lifetimeOfferPrice?: number;
  originalPrice?: number;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  campaign?: {
    id: string;
    name: string;
  };
}

export default function CouponManager() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'lifetime_offer',
    discountType: 'percentage',
    discountValue: '',
    maxUses: '',
    isActive: true,
    validFrom: '',
    validUntil: '',
    campaignId: 'none',
    lifetimeOfferPrice: '',
    originalPrice: '',
    videoUrl: '',
    stripePriceId: ''
  });

  // Fetch coupons
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/coupons');
      if (!response.ok) {
        throw new Error('Failed to fetch coupons');
      }
      const data = await response.json();
      setCoupons(data.coupons || []);
    } catch (err) {
      console.error('Error fetching coupons:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  // Fetch campaigns for dropdown
  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/admin/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  useEffect(() => {
    fetchCoupons();
    fetchCampaigns();
  }, []);

  // Generate random coupon code
  const generateCouponCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code: result });
  };

  // Save coupon
  const saveCoupon = async () => {
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          id: isEditing ? selectedCoupon?.id : undefined,
          discountValue: formData.discountValue ? parseFloat(formData.discountValue) : null,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          lifetimeOfferPrice: formData.lifetimeOfferPrice ? parseFloat(formData.lifetimeOfferPrice) : null,
          originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
          campaignId: formData.campaignId && formData.campaignId !== 'none' ? formData.campaignId : null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save coupon');
      }

      await response.json();
      
      toast({
        title: 'Success',
        description: `Coupon ${isEditing ? 'updated' : 'created'} successfully`,
        variant: 'default',
      });

      // Refresh coupons list
      await fetchCoupons();
      
      // Reset form
      resetForm();
    } catch (err) {
      console.error('Error saving coupon:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save coupon',
        variant: 'destructive',
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      type: 'lifetime_offer',
      discountType: 'percentage',
      discountValue: '',
      maxUses: '',
      isActive: true,
      validFrom: '',
      validUntil: '',
      campaignId: 'none',
      lifetimeOfferPrice: '',
      originalPrice: '',
      videoUrl: '',
      stripePriceId: ''
    });
    setIsEditing(false);
    setShowCreateForm(false);
    setSelectedCoupon(null);
  };

  // Delete coupon
  const deleteCoupon = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/coupons?id=${couponId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete coupon');
      }

      toast({
        title: 'Success',
        description: 'Coupon deleted successfully',
        variant: 'default',
      });

      // Refresh coupons list
      await fetchCoupons();
    } catch (err) {
      console.error('Error deleting coupon:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete coupon',
        variant: 'destructive',
      });
    }
  };

  // Copy coupon
  const copyCoupon = (coupon: Coupon) => {
    setFormData({
      code: `${coupon.code}_COPY`,
      name: `${coupon.name} (Copy)`,
      description: coupon.description || '',
      type: coupon.type,
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue?.toString() || '',
      maxUses: coupon.maxUses?.toString() || '',
      isActive: true,
      validFrom: '',
      validUntil: '',
      campaignId: coupon.campaignId || 'none',
      lifetimeOfferPrice: coupon.lifetimeOfferPrice?.toString() || '',
      originalPrice: coupon.originalPrice?.toString() || '',
      videoUrl: (coupon as any).videoUrl || '',
      stripePriceId: (coupon as any).stripePriceId || ''
    });
    setIsEditing(false);
    setShowCreateForm(true);
    setSelectedCoupon(null);
  };

  // Edit coupon
  const editCoupon = (coupon: Coupon) => {
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      type: coupon.type,
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue?.toString() || '',
      maxUses: coupon.maxUses?.toString() || '',
      isActive: coupon.isActive,
      validFrom: coupon.validFrom.split('T')[0], // Format for date input
      validUntil: coupon.validUntil.split('T')[0],
      campaignId: coupon.campaignId || 'none',
      lifetimeOfferPrice: coupon.lifetimeOfferPrice?.toString() || '',
      originalPrice: coupon.originalPrice?.toString() || '',
      videoUrl: (coupon as any).videoUrl || '',
      stripePriceId: (coupon as any).stripePriceId || ''
    });
    setIsEditing(true);
    setShowCreateForm(true);
    setSelectedCoupon(coupon);
  };

  // Get status badge
  const getStatusBadge = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = new Date(coupon.validUntil);
    
    if (!coupon.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    if (now < validFrom) {
      return <Badge variant="outline">Scheduled</Badge>;
    }
    
    if (now > validUntil) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return <Badge variant="destructive">Used Up</Badge>;
    }
    
    return <Badge variant="default">Active</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-2 border-gray-500 rounded-full border-t-transparent"></div>
        <span className="ml-2">Loading coupons...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <strong>Error:</strong> {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Coupon Manager</h2>
          <p className="text-gray-600">Create and manage promotional coupons for campaigns</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Coupon
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Coupon' : 'Create New Coupon'}</CardTitle>
            <CardDescription>
              {isEditing ? 'Update coupon details' : 'Create a new promotional coupon'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Coupon Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="coupon-code"
                    placeholder="Enter coupon code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                  <Button type="button" variant="outline" onClick={generateCouponCode}>
                    Generate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coupon-name">Coupon Name</Label>
                <Input
                  id="coupon-name"
                  placeholder="Enter coupon name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this coupon"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coupon-type">Coupon Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lifetime_offer">Lifetime Offer</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="free_trial">Free Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'discount' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="discount-type">Discount Type</Label>
                    <Select
                      value={formData.discountType}
                      onValueChange={(value) => setFormData({ ...formData, discountType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select discount type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount-value">
                      Discount Value {formData.discountType === 'percentage' ? '(%)' : '($)'}
                    </Label>
                    <Input
                      id="discount-value"
                      type="number"
                      placeholder="Enter discount value"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>

            {formData.type === 'lifetime_offer' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lifetime-price">Lifetime Offer Price ($)</Label>
                    <Input
                      id="lifetime-price"
                      type="number"
                      placeholder="499"
                      value={formData.lifetimeOfferPrice}
                      onChange={(e) => setFormData({ ...formData, lifetimeOfferPrice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="original-price">Original Price ($)</Label>
                    <Input
                      id="original-price"
                      type="number"
                      placeholder="2997"
                      value={formData.originalPrice}
                      onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="video-url">Promotional Video URL</Label>
                    <Input
                      id="video-url"
                      type="url"
                      placeholder="https://youtube.com/embed/..."
                      value={formData.videoUrl}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">YouTube embed URL for the lifetime offer page</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripe-price-id">Stripe Price ID</Label>
                    <Input
                      id="stripe-price-id"
                      type="text"
                      placeholder="price_1234567890"
                      value={formData.stripePriceId}
                      onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Custom Stripe price ID for this campaign</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-uses">Max Uses (Optional)</Label>
                <Input
                  id="max-uses"
                  type="number"
                  placeholder="Leave empty for unlimited"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid-from">Valid From</Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid-until">Valid Until</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign">Associated Campaign (Optional)</Label>
              <Select
                value={formData.campaignId}
                onValueChange={(value) => setFormData({ ...formData, campaignId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Campaign</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={saveCoupon} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isEditing ? 'Update Coupon' : 'Save Coupon'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupons List */}
      <div className="grid grid-cols-1 gap-4">
        {coupons.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center">
                <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No coupons yet</h3>
                <p className="text-gray-500 mb-4">Create your first promotional coupon to get started</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Coupon
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          coupons.map((coupon) => (
            <Card key={coupon.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{coupon.name}</h3>
                      <Badge variant="outline" className="font-mono">
                        {coupon.code}
                      </Badge>
                      {getStatusBadge(coupon)}
                    </div>

                    {coupon.description && (
                      <p className="text-gray-600 mb-3">{coupon.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Ticket className="h-4 w-4" />
                        <span>{coupon.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{coupon.usedCount}/{coupon.maxUses || '∞'} used</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Until {new Date(coupon.validUntil).toLocaleDateString()}</span>
                      </div>
                      {coupon.lifetimeOfferPrice && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          <span>${coupon.lifetimeOfferPrice}</span>
                        </div>
                      )}
                    </div>

                    {coupon.campaign && (
                      <div className="text-sm text-blue-600">
                        Campaign: {coupon.campaign.name}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCoupon(coupon)}
                      title="Copy coupon"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editCoupon(coupon)}
                      title="Edit coupon"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCoupon(coupon.id)}
                      title="Delete coupon"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
