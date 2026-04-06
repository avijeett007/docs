'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clipboard, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';

interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  prefix: string;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  rateLimit: number | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  usageCount: number;
  dailyUsage: number;
  monthlyUsage: number;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    description: '',
    expiresAt: '',
  });
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  // Fetch API keys on component mount
  useEffect(() => {
    checkAccess();
    fetchApiKeys();
  }, []);

  // Check if customer has access to API keys
  const checkAccess = async () => {
    try {
      console.log('Checking API access...');
      const response = await fetch('/api/whitelabel/customer/api-access', {
        // Include credentials to send cookies with the request
        credentials: 'include',
      });
      console.log('API access response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('API access response data:', data);
        setHasAccess(data.hasApiAccess);
      } else {
        console.error('API access check failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking API access:', error);
      setHasAccess(false);
    }
  };

  // Function to fetch API keys
  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whitelabel/customer/api-keys', {
        // Include credentials to send cookies with the request
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  // Function to create a new API key
  const createApiKey = async () => {
    try {
      const payload = {
        name: newKeyData.name,
        description: newKeyData.description || undefined,
        expiresAt: newKeyData.expiresAt || undefined,
      };

      const response = await fetch('/api/whitelabel/customer/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include', // Include credentials to send cookies with the request
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const data = await response.json();
      setNewApiKey(data.apiKey);

      // Refresh the API keys list
      fetchApiKeys();

      toast.success('API key created successfully');
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    }
  };

  // Function to revoke an API key
  const revokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/whitelabel/customer/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include', // Include credentials to send cookies with the request
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      // Refresh the API keys list
      fetchApiKeys();

      toast.success('API key revoked successfully');
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  // Function to copy API key to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('API key copied to clipboard');
  };

  // Reset form data
  const resetForm = () => {
    setNewKeyData({
      name: '',
      description: '',
      expiresAt: '',
    });
    setNewApiKey(null);
  };

  if (!hasAccess) {
    return (
      <WhitelabelLayout>
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-bold mb-6">API Keys</h1>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h2 className="text-xl font-semibold mb-2">API Access Not Available</h2>
                <p className="text-muted-foreground">
                  API access is not enabled for your account. Please contact your service provider to enable this feature.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </WhitelabelLayout>
    );
  }

  return (
    <WhitelabelLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">API Keys</h1>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>API Key Management</CardTitle>
              <CardDescription>
                Create and manage API keys to access the API programmatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>
                  API keys allow you to authenticate requests to the API. Keep your API keys secure and do not share them in publicly accessible areas.
                </p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-amber-800 mb-2">Important Security Information</h3>
                  <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                    <li>API keys provide full access to your account via the API.</li>
                    <li>Store API keys securely and do not expose them in client-side code.</li>
                    <li>Rotate your API keys periodically for enhanced security.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your API Keys</h2>
            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>Create API Key</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key to access the API.
                  </DialogDescription>
                </DialogHeader>
                {newApiKey ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm font-medium text-amber-800 mb-2">
                        This is your API key. Make sure to copy it now as you won't be able to see it again.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="bg-yellow-100 p-2 rounded text-sm font-mono flex-1 overflow-x-auto">
                          {newApiKey}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(newApiKey)}
                        >
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setNewApiKey(null)}>
                      Done
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                          Name *
                        </Label>
                        <Input
                          id="name"
                          value={newKeyData.name}
                          onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                          className="col-span-3"
                          placeholder="My API Key"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                          Description
                        </Label>
                        <Textarea
                          id="description"
                          value={newKeyData.description}
                          onChange={(e) => setNewKeyData({ ...newKeyData, description: e.target.value })}
                          className="col-span-3"
                          placeholder="Used for..."
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="expiresAt" className="text-right">
                          Expires At
                        </Label>
                        <Input
                          id="expiresAt"
                          type="date"
                          value={newKeyData.expiresAt}
                          onChange={(e) => setNewKeyData({ ...newKeyData, expiresAt: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createApiKey} disabled={!newKeyData.name}>
                        Create
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No API keys found. Create one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">
                        {key.name}
                        {key.description && (
                          <p className="text-xs text-muted-foreground mt-1">{key.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted p-1 rounded text-xs">{key.prefix}...</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={key.status === 'active' ? 'default' : 'destructive'}>
                          {key.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {key.lastUsedAt
                          ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div>Total: {key.usageCount}</div>
                          <div>Today: {key.dailyUsage}</div>
                          <div>Month: {key.monthlyUsage}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeApiKey(key.id)}
                          disabled={key.status !== 'active'}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </WhitelabelLayout>
  );
}
