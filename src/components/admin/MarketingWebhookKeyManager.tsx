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
  Key,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface MarketingWebhookApiKey {
  id: string;
  name: string;
  description?: string;
  prefix: string;
  status: 'active' | 'inactive' | 'expired';
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  rateLimit?: number;
  dailyLimit?: number;
  usageCount: number;
  dailyUsage: number;
  lastResetAt: string;
  allowedOrigins: string[];
  metadata: any;
  apiKey?: string; // Only present when creating
}

export default function MarketingWebhookKeyManager() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<MarketingWebhookApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<MarketingWebhookApiKey | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expiresAt: '',
    rateLimit: '',
    dailyLimit: '',
    allowedOrigins: '',
    metadata: ''
  });

  // Fetch webhook API keys
  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/marketing-webhook-keys');
      if (!response.ok) {
        throw new Error('Failed to fetch webhook API keys');
      }
      const data = await response.json();
      setKeys(data.data.keys || []);
    } catch (err) {
      console.error('Error fetching webhook API keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch webhook API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Create new webhook API key
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description || undefined,
        rateLimit: formData.rateLimit ? parseInt(formData.rateLimit) : undefined,
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit) : undefined,
        allowedOrigins: formData.allowedOrigins 
          ? formData.allowedOrigins.split(',').map(s => s.trim()).filter(s => s)
          : [],
        metadata: formData.metadata ? JSON.parse(formData.metadata) : {}
      };

      if (formData.expiresAt) {
        payload.expiresAt = new Date(formData.expiresAt).toISOString();
      }

      const response = await fetch('/api/admin/marketing-webhook-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create webhook API key');
      }

      toast({
        title: 'Success',
        description: 'Webhook API key created successfully',
      });

      // Show the API key to the user
      setShowApiKey(data.data.apiKey);
      
      // Reset form and refresh list
      setFormData({
        name: '',
        description: '',
        expiresAt: '',
        rateLimit: '',
        dailyLimit: '',
        allowedOrigins: '',
        metadata: ''
      });
      setShowCreateForm(false);
      fetchKeys();

    } catch (err) {
      console.error('Error creating webhook API key:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create webhook API key',
        variant: 'destructive',
      });
    }
  };

  // Update webhook API key
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey) return;

    try {
      const payload: any = {
        name: formData.name,
        description: formData.description || undefined,
        rateLimit: formData.rateLimit ? parseInt(formData.rateLimit) : null,
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit) : null,
        allowedOrigins: formData.allowedOrigins 
          ? formData.allowedOrigins.split(',').map(s => s.trim()).filter(s => s)
          : [],
        metadata: formData.metadata ? JSON.parse(formData.metadata) : {}
      };

      if (formData.expiresAt) {
        payload.expiresAt = new Date(formData.expiresAt).toISOString();
      }

      const response = await fetch(`/api/admin/marketing-webhook-keys/${selectedKey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update webhook API key');
      }

      toast({
        title: 'Success',
        description: 'Webhook API key updated successfully',
      });

      setIsEditing(false);
      setSelectedKey(null);
      fetchKeys();

    } catch (err) {
      console.error('Error updating webhook API key:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update webhook API key',
        variant: 'destructive',
      });
    }
  };

  // Delete webhook API key
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the webhook API key "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/marketing-webhook-keys/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete webhook API key');
      }

      toast({
        title: 'Success',
        description: 'Webhook API key deleted successfully',
      });

      fetchKeys();

    } catch (err) {
      console.error('Error deleting webhook API key:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete webhook API key',
        variant: 'destructive',
      });
    }
  };

  // Toggle key status
  const handleToggleStatus = async (key: MarketingWebhookApiKey) => {
    const newStatus = key.status === 'active' ? 'inactive' : 'active';
    
    try {
      const response = await fetch(`/api/admin/marketing-webhook-keys/${key.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update webhook API key status');
      }

      toast({
        title: 'Success',
        description: `Webhook API key ${newStatus === 'active' ? 'activated' : 'deactivated'}`,
      });

      fetchKeys();

    } catch (err) {
      console.error('Error updating webhook API key status:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update webhook API key status',
        variant: 'destructive',
      });
    }
  };

  // Copy API key to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
    });
  };

  // Start editing
  const startEdit = (key: MarketingWebhookApiKey) => {
    setSelectedKey(key);
    setFormData({
      name: key.name,
      description: key.description || '',
      expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString().slice(0, 16) : '',
      rateLimit: key.rateLimit?.toString() || '',
      dailyLimit: key.dailyLimit?.toString() || '',
      allowedOrigins: key.allowedOrigins.join(', '),
      metadata: JSON.stringify(key.metadata, null, 2)
    });
    setIsEditing(true);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" />Inactive</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Marketing Webhook API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Marketing Webhook API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Marketing Webhook API Keys
              </CardTitle>
              <CardDescription>
                Manage API keys for external marketing funnel integrations
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create API Key
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* API Key Display Dialog */}
      {showApiKey && (
        <Dialog open={!!showApiKey} onOpenChange={() => setShowApiKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New API Key Created</DialogTitle>
              <DialogDescription>
                Please copy this API key now. You won't be able to see it again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 rounded-lg">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono break-all">{showApiKey}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(showApiKey)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Store this API key securely. It will be used to authenticate webhook requests from your marketing funnels.
                </AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Webhook API Key</CardTitle>
            <CardDescription>
              Create a new API key for marketing funnel integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., GHL Campaign 2024"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expiresAt">Expires At</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this API key"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rateLimit">Rate Limit (per minute)</Label>
                  <Input
                    id="rateLimit"
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData({ ...formData, rateLimit: e.target.value })}
                    placeholder="50"
                    min="1"
                    max="1000"
                  />
                </div>
                <div>
                  <Label htmlFor="dailyLimit">Daily Limit</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                    placeholder="10000"
                    min="1"
                    max="100000"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="allowedOrigins">Allowed Origins (comma-separated)</Label>
                <Input
                  id="allowedOrigins"
                  value={formData.allowedOrigins}
                  onChange={(e) => setFormData({ ...formData, allowedOrigins: e.target.value })}
                  placeholder="gohighlevel.com, clickfunnels.com"
                />
              </div>

              <div>
                <Label htmlFor="metadata">Metadata (JSON)</Label>
                <Textarea
                  id="metadata"
                  value={formData.metadata}
                  onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                  placeholder='{"campaign": "summer2024", "source": "ghl"}'
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  Create API Key
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Keys List */}
      <div className="grid gap-4">
        {keys.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No webhook API keys found</p>
                <p className="text-sm">Create your first API key to get started</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{key.name}</h3>
                      {getStatusBadge(key.status)}
                    </div>
                    {key.description && (
                      <p className="text-sm text-gray-600">{key.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Prefix: <code className="bg-gray-100 px-1 rounded">{key.prefix}_***</code></span>
                      <span>Created: {formatDate(key.createdAt)}</span>
                      {key.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Expires: {formatDate(key.expiresAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Total: {key.usageCount}
                      </span>
                      <span>Today: {key.dailyUsage}</span>
                      {key.rateLimit && <span>Rate: {key.rateLimit}/min</span>}
                      {key.dailyLimit && <span>Daily: {key.dailyLimit}</span>}
                      {key.lastUsedAt && <span>Last used: {formatDate(key.lastUsedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleStatus(key)}
                      disabled={key.status === 'expired'}
                    >
                      {key.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(key)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(key.id, key.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Form */}
      {isEditing && selectedKey && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Webhook API Key</CardTitle>
            <CardDescription>
              Update settings for "{selectedKey.name}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-expiresAt">Expires At</Label>
                  <Input
                    id="edit-expiresAt"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-rateLimit">Rate Limit (per minute)</Label>
                  <Input
                    id="edit-rateLimit"
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData({ ...formData, rateLimit: e.target.value })}
                    min="1"
                    max="1000"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-dailyLimit">Daily Limit</Label>
                  <Input
                    id="edit-dailyLimit"
                    type="number"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                    min="1"
                    max="100000"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-allowedOrigins">Allowed Origins (comma-separated)</Label>
                <Input
                  id="edit-allowedOrigins"
                  value={formData.allowedOrigins}
                  onChange={(e) => setFormData({ ...formData, allowedOrigins: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-metadata">Metadata (JSON)</Label>
                <Textarea
                  id="edit-metadata"
                  value={formData.metadata}
                  onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  Update API Key
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedKey(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
