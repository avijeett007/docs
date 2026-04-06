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
  Send, 
  Eye, 
  Plus,
  Calendar,
  Users,
  Mail
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  subject: string;
  htmlContent: string;
  status: string;
  sentCount: number;
  targetCount: number;
  recipientType: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignManagerProps {
  onSelectCampaign?: (campaign: Campaign) => void;
  onSendCampaign?: (campaign: Campaign) => void;
}

export default function CampaignManager({ onSelectCampaign, onSendCampaign }: CampaignManagerProps) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    htmlContent: '',
    recipientType: 'partner',
    status: 'draft'
  });

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Save campaign
  const saveCampaign = async () => {
    try {
      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          id: isEditing ? selectedCampaign?.id : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save campaign');
      }

      await response.json();
      
      toast({
        title: 'Success',
        description: `Campaign ${isEditing ? 'updated' : 'created'} successfully`,
        variant: 'default',
      });

      // Refresh campaigns list
      await fetchCampaigns();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        subject: '',
        htmlContent: '',
        recipientType: 'partner',
        status: 'draft'
      });
      setIsEditing(false);
      setShowCreateForm(false);
      setSelectedCampaign(null);
    } catch (err) {
      console.error('Error saving campaign:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save campaign',
        variant: 'destructive',
      });
    }
  };

  // Delete campaign
  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/campaigns?id=${campaignId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete campaign');
      }

      toast({
        title: 'Success',
        description: 'Campaign deleted successfully',
        variant: 'default',
      });

      // Refresh campaigns list
      await fetchCampaigns();
    } catch (err) {
      console.error('Error deleting campaign:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete campaign',
        variant: 'destructive',
      });
    }
  };

  // Copy campaign
  const copyCampaign = (campaign: Campaign) => {
    setFormData({
      name: `${campaign.name} (Copy)`,
      description: campaign.description || '',
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      recipientType: campaign.recipientType,
      status: 'draft'
    });
    setIsEditing(false);
    setShowCreateForm(true);
    setSelectedCampaign(null);
  };

  // Edit campaign
  const editCampaign = (campaign: Campaign) => {
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      recipientType: campaign.recipientType,
      status: campaign.status
    });
    setIsEditing(true);
    setShowCreateForm(true);
    setSelectedCampaign(campaign);
  };

  // Use campaign as template
  const handleUseCampaignAsTemplate = (campaign: Campaign) => {
    if (onSelectCampaign) {
      onSelectCampaign(campaign);
      toast({
        title: 'Template Loaded',
        description: `Campaign "${campaign.name}" has been loaded as a template`,
        variant: 'default',
      });
    }
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sending': return 'default';
      case 'completed': return 'default';
      case 'test': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-2 border-gray-500 rounded-full border-t-transparent"></div>
        <span className="ml-2">Loading campaigns...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaign Manager</h2>
          <p className="text-gray-600">Manage your email campaigns, templates, and history</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Campaign' : 'Create New Campaign'}</CardTitle>
            <CardDescription>
              {isEditing ? 'Update your campaign details' : 'Create a new email campaign or template'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  placeholder="Enter campaign name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient-type">Recipient Type</Label>
                <Select
                  value={formData.recipientType}
                  onValueChange={(value) => setFormData({ ...formData, recipientType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">Partners</SelectItem>
                    <SelectItem value="waitlist">Waitlist Members</SelectItem>
                    <SelectItem value="all">All Recipients</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of this campaign"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject line"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="html-content">HTML Content</Label>
              <Textarea
                id="html-content"
                placeholder="Enter HTML email content"
                className="min-h-[200px] font-mono"
                value={formData.htmlContent}
                onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={saveCampaign} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isEditing ? 'Update Campaign' : 'Save Campaign'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateForm(false);
                  setIsEditing(false);
                  setSelectedCampaign(null);
                  setFormData({
                    name: '',
                    description: '',
                    subject: '',
                    htmlContent: '',
                    recipientType: 'partner',
                    status: 'draft'
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns List */}
      <div className="grid grid-cols-1 gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
                <p className="text-gray-500 mb-4">Create your first email campaign to get started</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
                      <Badge variant={getStatusBadgeVariant(campaign.status)}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                    </div>

                    {campaign.description && (
                      <p className="text-gray-600 mb-3">{campaign.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span>{campaign.subject}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{campaign.recipientType}</span>
                      </div>
                      {campaign.sentAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Sent {new Date(campaign.sentAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {campaign.status === 'completed' && (
                      <div className="text-sm text-green-600">
                        Sent to {campaign.sentCount} of {campaign.targetCount} recipients
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUseCampaignAsTemplate(campaign)}
                      title="Use as template"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCampaign(campaign)}
                      title="Copy campaign"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editCampaign(campaign)}
                      title="Edit campaign"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    {onSendCampaign && campaign.status === 'draft' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onSendCampaign(campaign)}
                        title="Send campaign"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCampaign(campaign.id)}
                      title="Delete campaign"
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
