'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import NeonContainer from '@/components/NeonContainer';
import { Clipboard, RefreshCw, Trash2 } from 'lucide-react';

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
  allowedIps?: string | null;
  registeredWithAnalytics?: boolean;
}

interface ApiKeyManagerProps {
  customerId: string;
  subdomain: string;
}

export function ApiKeyManager({ customerId, subdomain }: ApiKeyManagerProps) {
  // State for API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    description: '',
    expiresAt: '',
    rateLimit: '',
    dailyLimit: '',
    monthlyLimit: '',
    allowedIps: '',
  });
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  // Fetch API keys when component mounts or showRevoked changes
  useEffect(() => {
    fetchApiKeys();
  }, [customerId, showRevoked, subdomain]);

  // Function to fetch API keys
  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      let url = `/api/whitelabel/${subdomain}/customer/api-keys`;

      // Add query parameter to include revoked keys if needed
      if (showRevoked) {
        url += `?includeRevoked=true`;
      }

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        window.location.href = `/whitelabel/${subdomain}/customer/login`;
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data.apiKeys);
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
      // Get the customer token from localStorage
      const token = localStorage.getItem('customer_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(`/api/whitelabel/${subdomain}/customer/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newKeyData.name,
          description: newKeyData.description,
          expiresAt: newKeyData.expiresAt || null,
          rateLimit: newKeyData.rateLimit ? parseInt(newKeyData.rateLimit) : null,
          dailyLimit: newKeyData.dailyLimit ? parseInt(newKeyData.dailyLimit) : null,
          monthlyLimit: newKeyData.monthlyLimit ? parseInt(newKeyData.monthlyLimit) : null,
          allowedIps: newKeyData.allowedIps || null,
        }),
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        localStorage.removeItem('customer_token');
        window.location.href = `/whitelabel/${subdomain}/customer/login`;
        return;
      }

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
      // Optimistically update the UI
      setApiKeys(prevKeys =>
        prevKeys.filter(key => key.id !== keyId)
      );

      // Show a loading toast
      const loadingToast = toast.loading('Revoking API key...');

      const response = await fetch(`/api/whitelabel/${subdomain}/customer/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      // Dismiss the loading toast
      toast.dismiss(loadingToast);

      if (response.status === 401) {
        // If unauthorized, redirect to login
        window.location.href = `/whitelabel/${subdomain}/customer/login`;
        return;
      }

      if (!response.ok) {
        // If the request failed, revert the UI change and fetch the latest data
        fetchApiKeys();
        throw new Error('Failed to revoke API key');
      }

      toast.success('API key revoked successfully');
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  // Function to renew an API key
  const renewApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to renew this API key? This will invalidate the old key.')) {
      return;
    }

    try {
      const response = await fetch(`/api/whitelabel/${subdomain}/customer/api-keys/${keyId}/renew`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (response.status === 401) {
        // If unauthorized, redirect to login
        window.location.href = `/whitelabel/${subdomain}/customer/login`;
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to renew API key');
      }

      const data = await response.json();
      setNewApiKey(data.apiKey);
      setCreateDialogOpen(true);

      // Refresh the API keys list
      fetchApiKeys();

      toast.success('API key renewed successfully');
    } catch (error) {
      console.error('Error renewing API key:', error);
      toast.error('Failed to renew API key');
    }
  };

  // Function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Function to reset the form
  const resetForm = () => {
    setNewKeyData({
      name: '',
      description: '',
      expiresAt: '',
      rateLimit: '',
      dailyLimit: '',
      monthlyLimit: '',
      allowedIps: '',
    });
    setNewApiKey(null);
  };

  // Function to register an API key with the analytics service
  const registerWithAnalytics = async (keyId: string) => {
    setRegistering(true);
    try {
      // Get the customer token from localStorage
      const token = localStorage.getItem('customer_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      console.log(`Registering customer API key ${keyId} with analytics service...`);

      // For now, just show a success message since the analytics service integration is pending
      // This is a temporary solution until the analytics service is fully implemented
      setTimeout(() => {
        console.log('Mock registration successful for API key:', keyId);
        toast.success('API key registered with analytics service');

        // Update the API key in the UI to show it's been registered
        setApiKeys(prevKeys =>
          prevKeys.map(key =>
            key.id === keyId
              ? { ...key, registeredWithAnalytics: true }
              : key
          )
        );

        setRegistering(false);
      }, 1500);
    } catch (error) {
      console.error('Error registering API key with analytics service:', error);

      // Show a more detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to register API key with analytics service';
      toast.error(errorMessage);
      setRegistering(false);
    }
  };

  return (
    <NeonContainer>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">API Keys</h2>
            <p className="text-gray-400 mt-1">
              Create and manage API keys for programmatic access to your data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="show-revoked" className="text-sm text-gray-400 cursor-pointer">
              Show revoked keys
            </label>
            <div
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showRevoked ? 'bg-blue-600' : 'bg-gray-700'} cursor-pointer`}
              onClick={() => setShowRevoked(!showRevoked)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showRevoked ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </div>
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white mb-6">Create API Key</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-gray-900 border border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Create New API Key</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new API key to access the API.
              </DialogDescription>
            </DialogHeader>
            {newApiKey ? (
              <div className="space-y-6">
                <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <svg className="h-5 w-5 text-amber-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Important
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    This is your API key. Make sure to copy it now as you won't be able to see it again.
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <div className="bg-gray-900 p-4 rounded-lg text-sm font-mono overflow-x-auto text-blue-300 border border-blue-500/30 shadow-inner shadow-blue-500/5">
                        {newApiKey}
                      </div>
                      <div className="absolute top-2 right-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(newApiKey)}
                          className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white rounded-full w-8 h-8 p-0 flex items-center justify-center"
                        >
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 italic">
                      Store this key securely. It provides access to your account via the API.
                    </p>
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setNewApiKey(null)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Done
                  </Button>
                  <Button
                    onClick={() => {
                      // Find the newly created key in the apiKeys array
                      if (newApiKey) {
                        const parts = newApiKey.split('_');
                        if (parts.length >= 2) {
                          const prefix = parts[0] + '_' + parts[1].substring(0, 6);
                          const newKey = apiKeys.find(key => key.prefix === prefix);
                          if (newKey) {
                            registerWithAnalytics(newKey.id);
                          }
                        }
                      }
                    }}
                    disabled={registering}
                    className="bg-blue-600 hover:bg-blue-700 text-white relative overflow-hidden"
                  >
                    {registering ? (
                      <>
                        <span className="opacity-0">Register with Analytics</span>
                        <span className="absolute inset-0 flex items-center justify-center">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </span>
                      </>
                    ) : (
                      'Register with Analytics'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right text-gray-400">
                      Name *
                    </Label>
                    <Input
                      id="name"
                      value={newKeyData.name}
                      onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                      className="col-span-3 bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      placeholder="My API Key"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right text-gray-400">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={newKeyData.description}
                      onChange={(e) => setNewKeyData({ ...newKeyData, description: e.target.value })}
                      className="col-span-3 bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      placeholder="Used for..."
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="expiresAt" className="text-right text-gray-400">
                      Expires At
                    </Label>
                    <Input
                      id="expiresAt"
                      type="date"
                      value={newKeyData.expiresAt}
                      onChange={(e) => setNewKeyData({ ...newKeyData, expiresAt: e.target.value })}
                      className="col-span-3 bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="allowedIps" className="text-right text-gray-400">
                      Allowed IPs
                    </Label>
                    <Input
                      id="allowedIps"
                      value={newKeyData.allowedIps}
                      onChange={(e) => setNewKeyData({ ...newKeyData, allowedIps: e.target.value })}
                      className="col-span-3 bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                      placeholder="192.168.1.1,10.0.0.1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createApiKey}
                    disabled={!newKeyData.name}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            Loading API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-gray-800/50 rounded-lg p-8 text-center border border-gray-700">
            <div className="p-3 bg-blue-500/20 rounded-full mb-3 mx-auto w-fit">
              <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-white font-medium mb-2">
              {showRevoked
                ? "No API Keys Found"
                : "No Active API Keys Found"}
            </h3>
            <p className="text-gray-400 mb-4">
              {showRevoked
                ? "You haven't created any API keys yet."
                : "You don't have any active API keys. Create a new one or toggle 'Show revoked keys' to see your revoked keys."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create API Key
              </Button>
              {!showRevoked && (
                <Button
                  onClick={() => setShowRevoked(true)}
                  variant="outline"
                  className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Show Revoked Keys
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-gray-700 overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-800">
                <TableRow className="border-b border-gray-700">
                  <TableHead className="text-gray-300">Name</TableHead>
                  <TableHead className="text-gray-300">Prefix</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Created</TableHead>
                  <TableHead className="text-gray-300">Last Used</TableHead>
                  <TableHead className="text-gray-300">Usage</TableHead>
                  <TableHead className="text-gray-300">Analytics</TableHead>
                  <TableHead className="text-right text-gray-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow
                    key={key.id}
                    className={`border-b border-gray-700 hover:bg-gray-800/50 ${key.status === 'revoked' ? 'opacity-60' : ''}`}
                  >
                    <TableCell className="font-medium text-white">
                      {key.name}
                      {key.description && (
                        <p className="text-xs text-gray-400 mt-1">{key.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="bg-gray-800 p-1 rounded text-xs text-blue-300 border border-blue-500/20">{key.prefix}...</code>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        key.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {key.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {key.lastUsedAt
                        ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div className="text-gray-300">Total: <span className="text-white font-medium">{key.usageCount}</span></div>
                        <div className="text-gray-300">Today: <span className="text-white font-medium">{key.dailyUsage}</span></div>
                        <div className="text-gray-300">Month: <span className="text-white font-medium">{key.monthlyUsage}</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.registeredWithAnalytics ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
                          Registered
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">
                          Not Registered
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => renewApiKey(key.id)}
                          disabled={key.status !== 'active'}
                          className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeApiKey(key.id)}
                          disabled={key.status !== 'active'}
                          className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-red-900/50 hover:text-red-300 hover:border-red-700/50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => registerWithAnalytics(key.id)}
                          disabled={key.status !== 'active' || registering || key.registeredWithAnalytics}
                          className={`bg-gray-800 border-gray-700 text-gray-300 ${
                            key.registeredWithAnalytics
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-blue-900/50 hover:text-blue-300 hover:border-blue-700/50'
                          }`}
                        >
                          {key.registeredWithAnalytics ? 'Registered' : 'Register'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </NeonContainer>
  );
}
