'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Eye, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface RecipientCriteria {
  targetType: 'all_partners' | 'active_partners' | 'pending_partners' | 'approved_partners' | 'rejected_partners' | 'all_waitlist' | 'everyone' | 'limited_partners' | 'limited_waitlist' | 'custom_waitlist';
  limit?: number;
  customLimit?: number;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'partner' | 'waitlist';
  businessName?: string;
  approvalStatus?: string;
}

interface AdvancedRecipientSelectorProps {
  onSelectionChange: (criteria: RecipientCriteria, recipients: Recipient[]) => void;
  initialCriteria?: RecipientCriteria;
}

export default function AdvancedRecipientSelector({ 
  onSelectionChange, 
  initialCriteria 
}: AdvancedRecipientSelectorProps) {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<RecipientCriteria>(
    initialCriteria || { targetType: 'active_partners' }
  );
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [stats, setStats] = useState({
    totalPartners: 0,
    activePartners: 0,
    pendingPartners: 0,
    approvedPartners: 0,
    rejectedPartners: 0,
    totalWaitlist: 0
  });

  // Predefined limit options
  const limitOptions = [10, 20, 30, 50, 100];

  // Fetch recipient statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/recipient-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching recipient stats:', error);
    }
  };

  // Fetch recipients based on criteria
  const fetchRecipients = async (currentCriteria: RecipientCriteria) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        targetType: currentCriteria.targetType,
        ...(currentCriteria.limit && { limit: currentCriteria.limit.toString() }),
        ...(currentCriteria.customLimit && { customLimit: currentCriteria.customLimit.toString() })
      });

      const response = await fetch(`/api/admin/recipients-advanced?${params}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Recipients API error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch recipients (${response.status})`);
      }

      const data = await response.json();
      setRecipients(data.recipients || []);
      onSelectionChange(currentCriteria, data.recipients || []);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch recipients',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize component
  useEffect(() => {
    fetchStats();
    fetchRecipients(criteria);
  }, []);

  // Handle criteria change
  const handleCriteriaChange = (newCriteria: Partial<RecipientCriteria>) => {
    const updatedCriteria = { ...criteria, ...newCriteria };
    setCriteria(updatedCriteria);
    fetchRecipients(updatedCriteria);
  };

  // Get description for current selection
  const getSelectionDescription = () => {
    switch (criteria.targetType) {
      case 'all_partners':
        return `All partners (${stats.totalPartners} recipients)`;
      case 'active_partners':
        return `Active partners only (${stats.activePartners} recipients)`;
      case 'pending_partners':
        return `Pending partners only (${stats.pendingPartners} recipients)`;
      case 'approved_partners':
        return `Approved partners only (${stats.approvedPartners} recipients)`;
      case 'rejected_partners':
        return `Rejected partners only (${stats.rejectedPartners} recipients)`;
      case 'all_waitlist':
        return `All waitlist members (${stats.totalWaitlist} recipients)`;
      case 'everyone':
        return `Everyone - partners and waitlist (${stats.activePartners + stats.totalWaitlist} recipients)`;
      case 'limited_partners':
        return `First ${criteria.limit} active partners`;
      case 'limited_waitlist':
        return `First ${criteria.limit} waitlist members`;
      case 'custom_waitlist':
        return `First ${criteria.customLimit} waitlist members`;
      default:
        return 'Select targeting criteria';
    }
  };

  // Get estimated recipient count
  const getEstimatedCount = () => {
    switch (criteria.targetType) {
      case 'all_partners':
        return stats.totalPartners;
      case 'active_partners':
        return stats.activePartners;
      case 'pending_partners':
        return stats.pendingPartners;
      case 'approved_partners':
        return stats.approvedPartners;
      case 'rejected_partners':
        return stats.rejectedPartners;
      case 'all_waitlist':
        return stats.totalWaitlist;
      case 'everyone':
        return stats.activePartners + stats.totalWaitlist;
      case 'limited_partners':
        return Math.min(criteria.limit || 0, stats.activePartners);
      case 'limited_waitlist':
        return Math.min(criteria.limit || 0, stats.totalWaitlist);
      case 'custom_waitlist':
        return Math.min(criteria.customLimit || 0, stats.totalWaitlist);
      default:
        return 0;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Advanced Recipient Targeting
        </CardTitle>
        <CardDescription>
          Choose exactly who should receive your email campaign
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Type Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Target Audience</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Partners Options */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Partners</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="active_partners"
                    checked={criteria.targetType === 'active_partners'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Active Partners Only</span>
                  <Badge variant="secondary">{stats.activePartners}</Badge>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="pending_partners"
                    checked={criteria.targetType === 'pending_partners'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Pending Partners Only</span>
                  <Badge variant="outline" className="bg-yellow-50 text-amber-700 border-yellow-200">{stats.pendingPartners}</Badge>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="approved_partners"
                    checked={criteria.targetType === 'approved_partners'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Approved Partners Only</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{stats.approvedPartners}</Badge>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="rejected_partners"
                    checked={criteria.targetType === 'rejected_partners'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Rejected Partners Only</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{stats.rejectedPartners}</Badge>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="all_partners"
                    checked={criteria.targetType === 'all_partners'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">All Partners</span>
                  <Badge variant="secondary">{stats.totalPartners}</Badge>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="limited_partners"
                    checked={criteria.targetType === 'limited_partners'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Limited Partners</span>
                </label>
              </div>
            </div>

            {/* Waitlist Options */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Waitlist</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="all_waitlist"
                    checked={criteria.targetType === 'all_waitlist'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">All Waitlist</span>
                  <Badge variant="secondary">{stats.totalWaitlist}</Badge>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="limited_waitlist"
                    checked={criteria.targetType === 'limited_waitlist'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Limited Waitlist</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value="custom_waitlist"
                    checked={criteria.targetType === 'custom_waitlist'}
                    onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Custom Number</span>
                </label>
              </div>
            </div>
          </div>

          {/* Everyone Option */}
          <div className="pt-2 border-t">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="targetType"
                value="everyone"
                checked={criteria.targetType === 'everyone'}
                onChange={(e) => handleCriteriaChange({ targetType: e.target.value as any })}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">Everyone (Partners + Waitlist)</span>
              <Badge variant="default">{stats.activePartners + stats.totalWaitlist}</Badge>
            </label>
          </div>
        </div>

        {/* Limit Selection for Limited Options */}
        {(criteria.targetType === 'limited_partners' || criteria.targetType === 'limited_waitlist') && (
          <div className="space-y-2">
            <Label>Select Limit</Label>
            <div className="flex flex-wrap gap-2">
              {limitOptions.map((limit) => (
                <Button
                  key={limit}
                  variant={criteria.limit === limit ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCriteriaChange({ limit })}
                >
                  {limit}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Number Input */}
        {criteria.targetType === 'custom_waitlist' && (
          <div className="space-y-2">
            <Label htmlFor="custom-limit">Custom Number of Waitlist Members</Label>
            <Input
              id="custom-limit"
              type="number"
              min="1"
              max={stats.totalWaitlist}
              placeholder="Enter number"
              value={criteria.customLimit || ''}
              onChange={(e) => handleCriteriaChange({ customLimit: parseInt(e.target.value) || undefined })}
            />
          </div>
        )}

        {/* Selection Summary */}
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            <strong>Selection:</strong> {getSelectionDescription()}
            <br />
            <strong>Estimated Recipients:</strong> {getEstimatedCount()} emails will be sent
          </AlertDescription>
        </Alert>

        {/* Preview Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowPreview(!showPreview);
              if (!showPreview) {
                fetchRecipients(criteria);
              }
            }}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {showPreview ? 'Hide Preview' : 'Preview Recipients'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStats}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh Stats
          </Button>
        </div>

        {/* Recipients Preview */}
        {showPreview && (
          <div className="space-y-2">
            <h4 className="font-medium">Recipients Preview ({recipients.length})</h4>
            <div className="max-h-60 overflow-y-auto border rounded-md p-3 space-y-1">
              {recipients.length === 0 ? (
                <p className="text-gray-500 text-sm">No recipients found</p>
              ) : (
                recipients.map((recipient) => (
                  <div key={recipient.id} className="flex items-center justify-between text-sm">
                    <span>{recipient.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{recipient.email}</span>
                      <Badge variant={recipient.type === 'partner' ? 'default' : 'secondary'}>
                        {recipient.type}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
