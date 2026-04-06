'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import {
  AlertCircle,
  // Settings, // Unused
  // Mail, // Unused
  // Key, // Unused
  Shield,
  User,
  // Users, // Unused
  // Bell, // Unused
  ExternalLink,
  Cpu,
  Plus,
  Trash2,
  Download,
  Search,
  Check,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import toast from 'react-hot-toast';

// ── Types for AI Gateway admin config ──
interface SupportedModel {
  modelId: string;
  displayName: string;
  provider: string;
  category: 'budget' | 'mid_tier' | 'premium';
  tierAccess: string[];
  enabled: boolean;
  inputCostPer1MTokens: number;
  outputCostPer1MTokens: number;
}

interface AdminGatewayConfig {
  gatewayEnabled: boolean;
  freeTierAdminFeePercent: number;
  supportedModels: SupportedModel[];
  maxBudgetCapUsd: number | null;
  globalRateLimitRpm: number | null;
  maxKeysPerPartner: number | null;
}

const TIER_OPTIONS = [
  { value: 'free_forever', label: 'Free Forever' },
  { value: 'starter', label: 'Starter (Solo Agency)' },
  { value: 'pro', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'lifetime', label: 'Lifetime' },
];

const CATEGORY_OPTIONS = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid_tier', label: 'Mid Tier' },
  { value: 'premium', label: 'Premium' },
];

const EMPTY_MODEL: SupportedModel = {
  modelId: '', displayName: '', provider: '', category: 'budget',
  tierAccess: ['free_forever', 'starter', 'pro', 'enterprise', 'lifetime'],
  enabled: true, inputCostPer1MTokens: 0, outputCostPer1MTokens: 0,
};

// ── LiteLLM model from proxy ──
interface LiteLLMModel {
  modelName: string;
  provider: string;
  mode: string;
  inputCostPer1MTokens: number | null;
  outputCostPer1MTokens: number | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
}

export default function SettingsPage() {
  const { user } = useAdminAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── AI Gateway State ──
  const [gwConfig, setGwConfig] = useState<AdminGatewayConfig | null>(null);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwSaving, setGwSaving] = useState(false);
  const [gwEnabled, setGwEnabled] = useState(true);
  const [gwAdminFee, setGwAdminFee] = useState('20');
  const [gwMaxBudget, setGwMaxBudget] = useState('');
  const [gwRateLimit, setGwRateLimit] = useState('');
  const [gwMaxKeys, setGwMaxKeys] = useState('');
  const [gwModels, setGwModels] = useState<SupportedModel[]>([]);
  const [addingModel, setAddingModel] = useState(false);
  const [newModel, setNewModel] = useState<SupportedModel>({ ...EMPTY_MODEL });

  // ── Credit API Keys State ──
  interface CreditApiKey {
    id: string;
    name: string;
    description: string | null;
    prefix: string;
    apiKey?: string;
    status: string;
    scopes: string[];
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
    usageCount: number;
    dailyUsage: number;
    rateLimit: number | null;
    dailyLimit: number | null;
  }
  const [creditApiKeys, setCreditApiKeys] = useState<CreditApiKey[]>([]);
  const [creditKeysLoading, setCreditKeysLoading] = useState(false);
  const [showCreateCreditKey, setShowCreateCreditKey] = useState(false);
  const [newCreditKeyName, setNewCreditKeyName] = useState('');
  const [newCreditKeyDesc, setNewCreditKeyDesc] = useState('');
  const [newCreditKeyExpiry, setNewCreditKeyExpiry] = useState('');
  const [newCreditKeyRateLimit, setNewCreditKeyRateLimit] = useState('');
  const [newCreditKeyDailyLimit, setNewCreditKeyDailyLimit] = useState('');
  const [newCreditKeyScopes, setNewCreditKeyScopes] = useState<string[]>(['credits']);
  const [createdCreditKey, setCreatedCreditKey] = useState<string | null>(null);
  const [creditKeyCreating, setCreditKeyCreating] = useState(false);

  // ── LiteLLM Sync State ──
  const [litellmModels, setLitellmModels] = useState<LiteLLMModel[]>([]);
  const [litellmLoading, setLitellmLoading] = useState(false);
  const [litellmSearch, setLitellmSearch] = useState('');
  const [litellmImportTier, setLitellmImportTier] = useState<Record<string, string[]>>({});
  const [litellmImportCategory, setLitellmImportCategory] = useState<Record<string, string>>({});
  const [showLitellmSync, setShowLitellmSync] = useState(false);

  const fetchGwConfig = useCallback(async () => {
    setGwLoading(true);
    try {
      const res = await fetch('/api/admin/ai-gateway/config', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load config');
      const data: AdminGatewayConfig = await res.json();
      setGwConfig(data);
      setGwEnabled(data.gatewayEnabled);
      setGwAdminFee(String(data.freeTierAdminFeePercent));
      setGwMaxBudget(data.maxBudgetCapUsd !== null ? String(data.maxBudgetCapUsd) : '');
      setGwRateLimit(data.globalRateLimitRpm !== null ? String(data.globalRateLimitRpm) : '');
      setGwMaxKeys(data.maxKeysPerPartner !== null ? String(data.maxKeysPerPartner) : '');
      setGwModels(data.supportedModels);
    } catch {
      toast.error('Failed to load AI Gateway configuration');
    } finally {
      setGwLoading(false);
    }
  }, []);

  // ── Credit API Keys Fetch ──
  const fetchCreditApiKeys = useCallback(async () => {
    setCreditKeysLoading(true);
    try {
      const res = await fetch('/api/admin/credit-api-keys', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch credit API keys');
      const data = await res.json();
      setCreditApiKeys(data.data?.keys || []);
    } catch (err) {
      console.error('Error fetching credit API keys:', err);
    } finally {
      setCreditKeysLoading(false);
    }
  }, []);

  const handleCreateCreditKey = async () => {
    if (!newCreditKeyName.trim()) { toast.error('Name is required'); return; }
    setCreditKeyCreating(true);
    try {
      const res = await fetch('/api/admin/credit-api-keys', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCreditKeyName.trim(),
          description: newCreditKeyDesc.trim() || undefined,
          expiresAt: newCreditKeyExpiry || undefined,
          rateLimit: newCreditKeyRateLimit ? parseInt(newCreditKeyRateLimit) : undefined,
          dailyLimit: newCreditKeyDailyLimit ? parseInt(newCreditKeyDailyLimit) : undefined,
          scopes: newCreditKeyScopes.length > 0 ? newCreditKeyScopes : ['credits'],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create key');
      setCreatedCreditKey(data.data.apiKey);
      toast.success('Credit API key created!');
      setNewCreditKeyName(''); setNewCreditKeyDesc(''); setNewCreditKeyExpiry('');
      setNewCreditKeyRateLimit(''); setNewCreditKeyDailyLimit(''); setNewCreditKeyScopes(['credits']);
      fetchCreditApiKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create key');
    } finally {
      setCreditKeyCreating(false);
    }
  };

  const handleRevokeCreditKey = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'revoked' : 'active';
    try {
      const res = await fetch('/api/admin/credit-api-keys', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update key');
      toast.success(`Key ${newStatus === 'revoked' ? 'revoked' : 'reactivated'}`);
      fetchCreditApiKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update key');
    }
  };

  const handleDeleteCreditKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const res = await fetch(`/api/admin/credit-api-keys?ids=${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete key');
      toast.success('Key deleted');
      fetchCreditApiKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete key');
    }
  };

  // Fetch gateway config on tab activation (lazy load)
  const [gwTabLoaded, setGwTabLoaded] = useState(false);
  const [creditKeysTabLoaded, setCreditKeysTabLoaded] = useState(false);
  const handleTabChange = useCallback((value: string) => {
    if (value === 'ai-gateway' && !gwTabLoaded) {
      setGwTabLoaded(true);
      fetchGwConfig();
    }
    if (value === 'credit-api-keys' && !creditKeysTabLoaded) {
      setCreditKeysTabLoaded(true);
      fetchCreditApiKeys();
    }
  }, [gwTabLoaded, fetchGwConfig, creditKeysTabLoaded, fetchCreditApiKeys]);

  const handleSaveGwSettings = async () => {
    setGwSaving(true);
    try {
      const body: Partial<AdminGatewayConfig> = {
        gatewayEnabled: gwEnabled,
        freeTierAdminFeePercent: parseFloat(gwAdminFee) || 20,
        maxBudgetCapUsd: gwMaxBudget ? parseFloat(gwMaxBudget) : null,
        globalRateLimitRpm: gwRateLimit ? parseInt(gwRateLimit) : null,
        maxKeysPerPartner: gwMaxKeys ? parseInt(gwMaxKeys) : null,
        supportedModels: gwModels,
      };
      const res = await fetch('/api/admin/ai-gateway/config', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      const updated: AdminGatewayConfig = await res.json();
      setGwConfig(updated);
      setGwModels(updated.supportedModels);
      toast.success('AI Gateway settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save AI Gateway settings');
    } finally {
      setGwSaving(false);
    }
  };

  const handleAddModel = () => {
    if (!newModel.modelId || !newModel.displayName || !newModel.provider) {
      toast.error('Model ID, display name, and provider are required');
      return;
    }
    if (gwModels.some(m => m.modelId === newModel.modelId)) {
      toast.error('A model with this ID already exists');
      return;
    }
    setGwModels(prev => [...prev, { ...newModel }]);
    setNewModel({ ...EMPTY_MODEL });
    setAddingModel(false);
  };

  const handleRemoveModel = (modelId: string) => {
    setGwModels(prev => prev.filter(m => m.modelId !== modelId));
  };

  const handleToggleModelEnabled = (modelId: string) => {
    setGwModels(prev => prev.map(m => m.modelId === modelId ? { ...m, enabled: !m.enabled } : m));
  };

  // ── LiteLLM Sync Functions ──
  const fetchLitellmModels = async () => {
    setLitellmLoading(true);
    try {
      const res = await fetch('/api/admin/ai-gateway/litellm-models', { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch models from LiteLLM');
      }
      const data = await res.json();
      setLitellmModels(data.models || []);
      setShowLitellmSync(true);
      toast.success(`Fetched ${data.totalDeduped} models from LiteLLM (${data.totalRaw} raw entries)`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to fetch LiteLLM models');
    } finally {
      setLitellmLoading(false);
    }
  };

  const autoCategorize = (inputCost: number | null): 'budget' | 'mid_tier' | 'premium' => {
    if (inputCost === null) return 'mid_tier';
    if (inputCost <= 0.50) return 'budget';
    if (inputCost <= 5.00) return 'mid_tier';
    return 'premium';
  };

  const handleImportModel = (lm: LiteLLMModel) => {
    if (gwModels.some(m => m.modelId === lm.modelName)) {
      toast.error(`"${lm.modelName}" is already in the registry`);
      return;
    }
    const tierAccess = litellmImportTier[lm.modelName] ||
      ['free_forever', 'starter', 'pro', 'enterprise', 'lifetime'];
    const category = (litellmImportCategory[lm.modelName] as SupportedModel['category']) ||
      autoCategorize(lm.inputCostPer1MTokens);

    const newSupportedModel: SupportedModel = {
      modelId: lm.modelName,
      displayName: lm.modelName.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || lm.modelName,
      provider: lm.provider,
      category,
      tierAccess,
      enabled: true,
      inputCostPer1MTokens: lm.inputCostPer1MTokens ?? 0,
      outputCostPer1MTokens: lm.outputCostPer1MTokens ?? 0,
    };
    setGwModels(prev => [...prev, newSupportedModel]);
    toast.success(`Added "${lm.modelName}" to registry. Remember to Save.`);
  };

  const filteredLitellmModels = litellmModels.filter(m => {
    if (!litellmSearch) return true;
    const q = litellmSearch.toLowerCase();
    return m.modelName.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q) ||
      m.mode.toLowerCase().includes(q);
  });

  const handleSaveSettings = (section: string) => {
    setError(null);
    setSuccessMessage(`${section} settings saved successfully`);

    // In a real implementation, this would send the settings to an API
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
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
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>

          {successMessage && (
            <Alert variant="default" className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Success</AlertTitle>
              <AlertDescription className="text-green-600">{successMessage}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="general" className="space-y-4" onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="admins">Admin Users</TabsTrigger>
              <TabsTrigger value="ai-gateway">AI Gateway</TabsTrigger>
              <TabsTrigger value="credit-api-keys">Admin API Keys</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure basic settings for your Knotie-AI Pro application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input id="company-name" defaultValue="Knotie-AI Pro" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="support-email">Support Email</Label>
                    <Input id="support-email" type="email" defaultValue="support@knotie-ai.pro" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website-url">Website URL</Label>
                    <Input id="website-url" type="url" defaultValue="https://knotie-ai.pro" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Default Timezone</Label>
                    <Select defaultValue="UTC">
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                        <p className="text-sm text-gray-500">Enable maintenance mode to temporarily disable the application</p>
                      </div>
                      <Switch id="maintenance-mode" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="ml-auto" onClick={() => handleSaveSettings('General')}>
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Settings</CardTitle>
                  <CardDescription>
                    Configure email service settings and templates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input id="smtp-host" defaultValue="smtp.example.com" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">SMTP Port</Label>
                    <Input id="smtp-port" defaultValue="587" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-username">SMTP Username</Label>
                    <Input id="smtp-username" defaultValue="noreply@knotie-ai.pro" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-password">SMTP Password</Label>
                    <Input id="smtp-password" type="password" defaultValue="••••••••••••" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from-email">From Email</Label>
                    <Input id="from-email" defaultValue="noreply@knotie-ai.pro" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from-name">From Name</Label>
                    <Input id="from-name" defaultValue="Knotie-AI Pro" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="email-tracking">Email Tracking</Label>
                        <p className="text-sm text-gray-500">Track email opens and clicks</p>
                      </div>
                      <Switch id="email-tracking" defaultChecked />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="mr-2">
                    Test Connection
                  </Button>
                  <Button onClick={() => handleSaveSettings('Email')}>
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Configure security settings for your application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                        <p className="text-sm text-gray-500">Require 2FA for all admin users</p>
                      </div>
                      <Switch id="two-factor" defaultChecked />
                    </div>
                  </div>

                  {/* Personal MFA Setup */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Your Multi-Factor Authentication</Label>
                        <p className="text-sm text-gray-500">
                          Set up MFA for your personal admin account
                        </p>
                      </div>
                      <Link href="/mission-control/settings/mfa">
                        <Button variant="outline" size="sm">
                          <Shield className="h-4 w-4 mr-2" />
                          Configure MFA
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      </Link>
                    </div>
                    <Alert className="mt-3">
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Security Recommendation</AlertTitle>
                      <AlertDescription>
                        Enable MFA on your admin account to protect against unauthorized access.
                        This adds an extra layer of security beyond just your password.
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="ip-restriction">IP Restriction</Label>
                        <p className="text-sm text-gray-500">Restrict admin access to specific IP addresses</p>
                      </div>
                      <Switch id="ip-restriction" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowed-ips">Allowed IP Addresses</Label>
                    <Textarea
                      id="allowed-ips"
                      placeholder="Enter IP addresses, one per line"
                      className="h-24"
                    />
                    <p className="text-xs text-gray-500">Leave empty to allow all IP addresses</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                    <Input id="session-timeout" type="number" defaultValue="60" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="audit-logging">Audit Logging</Label>
                        <p className="text-sm text-gray-500">Log all admin actions for security auditing</p>
                      </div>
                      <Switch id="audit-logging" defaultChecked />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="ml-auto" onClick={() => handleSaveSettings('Security')}>
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>
                    Configure when and how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="new-partner">New Partner Notifications</Label>
                        <p className="text-sm text-gray-500">Receive notifications when a new partner signs up</p>
                      </div>
                      <Switch id="new-partner" defaultChecked />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="new-customer">New Customer Notifications</Label>
                        <p className="text-sm text-gray-500">Receive notifications when a new customer is added</p>
                      </div>
                      <Switch id="new-customer" defaultChecked />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="waitlist-signup">Waitlist Signup Notifications</Label>
                        <p className="text-sm text-gray-500">Receive notifications for new waitlist signups</p>
                      </div>
                      <Switch id="waitlist-signup" defaultChecked />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="system-alerts">System Alerts</Label>
                        <p className="text-sm text-gray-500">Receive notifications for system errors and warnings</p>
                      </div>
                      <Switch id="system-alerts" defaultChecked />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notification-email">Notification Email</Label>
                    <Input id="notification-email" type="email" defaultValue="admin@knotie-ai.pro" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="ml-auto" onClick={() => handleSaveSettings('Notification')}>
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="admins" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Users</CardTitle>
                  <CardDescription>
                    Manage admin users and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">Admin User</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">Super Admin</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Button variant="ghost" size="sm">Edit</Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4">
                    <Button>
                      <User className="mr-2 h-4 w-4" />
                      Add New Admin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── AI Gateway Tab ── */}
            <TabsContent value="ai-gateway" className="space-y-4">
              {gwLoading ? (
                <div className="text-center py-12 text-gray-500">Loading AI Gateway configuration...</div>
              ) : !gwConfig ? (
                <div className="text-center py-12 text-gray-500">
                  <Cpu className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                  <p>Select this tab to load the AI Gateway configuration.</p>
                </div>
              ) : (
                <>
                  {/* Global Settings Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cpu className="h-5 w-5" />
                        AI Gateway Settings
                      </CardTitle>
                      <CardDescription>
                        Configure the AI Gateway feature, admin fees, and global guardrails.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Gateway Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Enable AI Gateway</Label>
                          <p className="text-sm text-gray-500">Allow partners to create LLM API keys</p>
                        </div>
                        <Switch checked={gwEnabled} onCheckedChange={setGwEnabled} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Admin Fee */}
                        <div className="space-y-2">
                          <Label htmlFor="gw-admin-fee">Free Tier Admin Fee (%)</Label>
                          <Input id="gw-admin-fee" type="number" min="0" max="100" step="0.1"
                            value={gwAdminFee} onChange={e => setGwAdminFee(e.target.value)} />
                          <p className="text-xs text-gray-500">Markup applied to free-tier partners (default: 20%)</p>
                        </div>

                        {/* Max Budget Cap */}
                        <div className="space-y-2">
                          <Label htmlFor="gw-max-budget">Max Budget Cap (USD)</Label>
                          <Input id="gw-max-budget" type="number" min="0" step="0.01"
                            value={gwMaxBudget} onChange={e => setGwMaxBudget(e.target.value)}
                            placeholder="No limit" />
                          <p className="text-xs text-gray-500">Maximum budget per key (leave empty for unlimited)</p>
                        </div>

                        {/* Rate Limit */}
                        <div className="space-y-2">
                          <Label htmlFor="gw-rate-limit">Global Rate Limit (RPM)</Label>
                          <Input id="gw-rate-limit" type="number" min="0" step="1"
                            value={gwRateLimit} onChange={e => setGwRateLimit(e.target.value)}
                            placeholder="No limit" />
                          <p className="text-xs text-gray-500">Requests per minute per key (leave empty for unlimited)</p>
                        </div>

                        {/* Max Keys per Partner */}
                        <div className="space-y-2">
                          <Label htmlFor="gw-max-keys">Max Keys per Partner</Label>
                          <Input id="gw-max-keys" type="number" min="0" step="1"
                            value={gwMaxKeys} onChange={e => setGwMaxKeys(e.target.value)}
                            placeholder="No limit" />
                          <p className="text-xs text-gray-500">Maximum number of active keys per partner (leave empty for unlimited)</p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button onClick={handleSaveGwSettings} disabled={gwSaving}>
                        {gwSaving ? 'Saving...' : 'Save Settings'}
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Model Registry Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Model Registry
                      </CardTitle>
                      <CardDescription>
                        Manage supported LLM models, pricing, and tier access controls.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Existing Models Table */}
                      {gwModels.length > 0 && (
                        <div className="border rounded-lg overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Model ID</th>
                                <th className="px-3 py-2 text-left font-medium">Display Name</th>
                                <th className="px-3 py-2 text-left font-medium">Provider</th>
                                <th className="px-3 py-2 text-left font-medium">Category</th>
                                <th className="px-3 py-2 text-left font-medium">Tier Access</th>
                                <th className="px-3 py-2 text-right font-medium">Input $/1M</th>
                                <th className="px-3 py-2 text-right font-medium">Output $/1M</th>
                                <th className="px-3 py-2 text-center font-medium">Enabled</th>
                                <th className="px-3 py-2 text-center font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {gwModels.map(model => (
                                <tr key={model.modelId} className={!model.enabled ? 'opacity-50' : ''}>
                                  <td className="px-3 py-2 font-mono text-xs">{model.modelId}</td>
                                  <td className="px-3 py-2">{model.displayName}</td>
                                  <td className="px-3 py-2 capitalize">{model.provider}</td>
                                  <td className="px-3 py-2">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      model.category === 'budget' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                      model.category === 'mid_tier' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                    }`}>
                                      {model.category.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {model.tierAccess.map(t => (
                                        <span key={t} className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                                          {t.replace('_', ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-xs">${model.inputCostPer1MTokens}</td>
                                  <td className="px-3 py-2 text-right font-mono text-xs">${model.outputCostPer1MTokens}</td>
                                  <td className="px-3 py-2 text-center">
                                    <Switch checked={model.enabled} onCheckedChange={() => handleToggleModelEnabled(model.modelId)} />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
                                      onClick={() => handleRemoveModel(model.modelId)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {gwModels.length === 0 && !addingModel && (
                        <div className="text-center py-8 border rounded-lg bg-gray-50 dark:bg-gray-900">
                          <Cpu className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">No models configured. Add models to allow partners to create API keys.</p>
                        </div>
                      )}

                      {/* Add Model Form */}
                      {addingModel && (
                        <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 space-y-3">
                          <h4 className="font-medium text-sm">Add New Model</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label htmlFor="nm-id">Model ID *</Label>
                              <Input id="nm-id" value={newModel.modelId} onChange={e => setNewModel(prev => ({ ...prev, modelId: e.target.value }))} placeholder="e.g. gpt-4o-mini" />
                            </div>
                            <div>
                              <Label htmlFor="nm-name">Display Name *</Label>
                              <Input id="nm-name" value={newModel.displayName} onChange={e => setNewModel(prev => ({ ...prev, displayName: e.target.value }))} placeholder="e.g. GPT-4o Mini" />
                            </div>
                            <div>
                              <Label htmlFor="nm-provider">Provider *</Label>
                              <Input id="nm-provider" value={newModel.provider} onChange={e => setNewModel(prev => ({ ...prev, provider: e.target.value }))} placeholder="e.g. openai" />
                            </div>
                            <div>
                              <Label>Category</Label>
                              <Select value={newModel.category} onValueChange={(v: any) => setNewModel(prev => ({ ...prev, category: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {CATEGORY_OPTIONS.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="nm-input-cost">Input Cost ($/1M tokens)</Label>
                              <Input id="nm-input-cost" type="number" min="0" step="0.01" value={newModel.inputCostPer1MTokens}
                                onChange={e => setNewModel(prev => ({ ...prev, inputCostPer1MTokens: parseFloat(e.target.value) || 0 }))} />
                            </div>
                            <div>
                              <Label htmlFor="nm-output-cost">Output Cost ($/1M tokens)</Label>
                              <Input id="nm-output-cost" type="number" min="0" step="0.01" value={newModel.outputCostPer1MTokens}
                                onChange={e => setNewModel(prev => ({ ...prev, outputCostPer1MTokens: parseFloat(e.target.value) || 0 }))} />
                            </div>
                          </div>
                          <div>
                            <Label className="mb-2 block">Tier Access</Label>
                            <div className="flex flex-wrap gap-3">
                              {TIER_OPTIONS.map(t => (
                                <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                  <input type="checkbox" className="rounded"
                                    checked={newModel.tierAccess.includes(t.value)}
                                    onChange={e => {
                                      setNewModel(prev => ({
                                        ...prev,
                                        tierAccess: e.target.checked
                                          ? [...prev.tierAccess, t.value]
                                          : prev.tierAccess.filter(x => x !== t.value),
                                      }));
                                    }} />
                                  {t.label}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" onClick={handleAddModel}>Add Model</Button>
                            <Button size="sm" variant="outline" onClick={() => { setAddingModel(false); setNewModel({ ...EMPTY_MODEL }); }}>Cancel</Button>
                          </div>
                        </div>
                      )}
                      {/* ── Import from LiteLLM Section ── */}
                      {showLitellmSync && (
                        <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              <Download className="h-4 w-4" />
                              Import from LiteLLM ({filteredLitellmModels.length} models)
                            </h4>
                            <Button size="sm" variant="ghost" onClick={() => setShowLitellmSync(false)}>Close</Button>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Search models by name, provider, or mode..."
                              value={litellmSearch}
                              onChange={e => setLitellmSearch(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          {litellmLoading ? (
                            <div className="text-center py-6">
                              <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
                              <p className="text-sm text-gray-500 mt-2">Fetching models from LiteLLM proxy...</p>
                            </div>
                          ) : (
                            <div className="max-h-[400px] overflow-y-auto border rounded">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Model</th>
                                    <th className="px-3 py-2 text-left font-medium">Provider</th>
                                    <th className="px-3 py-2 text-left font-medium">Mode</th>
                                    <th className="px-3 py-2 text-right font-medium">Input $/1M</th>
                                    <th className="px-3 py-2 text-right font-medium">Output $/1M</th>
                                    <th className="px-3 py-2 text-center font-medium">Category</th>
                                    <th className="px-3 py-2 text-center font-medium">Tier Access</th>
                                    <th className="px-3 py-2 text-center font-medium">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {filteredLitellmModels.map(lm => {
                                    const alreadyAdded = gwModels.some(m => m.modelId === lm.modelName);
                                    const category = litellmImportCategory[lm.modelName] || autoCategorize(lm.inputCostPer1MTokens);
                                    const tierAccess = litellmImportTier[lm.modelName] ||
                                      ['free_forever', 'starter', 'pro', 'enterprise', 'lifetime'];
                                    return (
                                      <tr key={lm.modelName} className={alreadyAdded ? 'opacity-40 bg-green-50 dark:bg-green-950' : ''}>
                                        <td className="px-3 py-2 font-mono text-xs">{lm.modelName}</td>
                                        <td className="px-3 py-2 capitalize text-xs">{lm.provider}</td>
                                        <td className="px-3 py-2 text-xs">{lm.mode}</td>
                                        <td className="px-3 py-2 text-right font-mono text-xs">
                                          {lm.inputCostPer1MTokens !== null ? `$${lm.inputCostPer1MTokens}` : 'N/A'}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-xs">
                                          {lm.outputCostPer1MTokens !== null ? `$${lm.outputCostPer1MTokens}` : 'N/A'}
                                        </td>
                                        <td className="px-3 py-1.5 text-center">
                                          <Select
                                            value={category}
                                            onValueChange={(v) => setLitellmImportCategory(prev => ({ ...prev, [lm.modelName]: v }))}
                                            disabled={alreadyAdded}
                                          >
                                            <SelectTrigger className="h-7 text-xs w-24">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {CATEGORY_OPTIONS.map(c => (
                                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="px-3 py-1.5 text-center">
                                          <div className="flex flex-wrap gap-0.5 justify-center">
                                            {TIER_OPTIONS.map(t => (
                                              <label key={t.value} className="text-[10px] cursor-pointer flex items-center gap-0.5">
                                                <input
                                                  type="checkbox"
                                                  className="rounded h-3 w-3"
                                                  disabled={alreadyAdded}
                                                  checked={tierAccess.includes(t.value)}
                                                  onChange={e => {
                                                    setLitellmImportTier(prev => {
                                                      const current = prev[lm.modelName] || [...tierAccess];
                                                      const updated = e.target.checked
                                                        ? [...current, t.value]
                                                        : current.filter(x => x !== t.value);
                                                      return { ...prev, [lm.modelName]: updated };
                                                    });
                                                  }}
                                                />
                                                {t.value.replace('_', ' ').slice(0, 4)}
                                              </label>
                                            ))}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          {alreadyAdded ? (
                                            <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                                              <Check className="h-3.5 w-3.5" /> Added
                                            </span>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={() => handleImportModel(lm)}
                                            >
                                              <Plus className="h-3 w-3 mr-1" /> Add
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {filteredLitellmModels.length === 0 && (
                                <div className="text-center py-4 text-sm text-gray-500">
                                  {litellmSearch ? 'No models match your search' : 'No models found from LiteLLM'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setAddingModel(true)} disabled={addingModel}>
                          <Plus className="h-4 w-4 mr-2" /> Add Manually
                        </Button>
                        <Button variant="outline" onClick={fetchLitellmModels} disabled={litellmLoading}>
                          {litellmLoading ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                          ) : (
                            <><Download className="h-4 w-4 mr-2" /> Import from LiteLLM</>
                          )}
                        </Button>
                      </div>
                      <Button onClick={handleSaveGwSettings} disabled={gwSaving}>
                        {gwSaving ? 'Saving...' : 'Save Model Registry'}
                      </Button>
                    </CardFooter>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ── Credit API Keys Tab ── */}
            <TabsContent value="credit-api-keys" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Admin API Keys
                  </CardTitle>
                  <CardDescription>
                    Create scoped API keys for external integrations — manage partner credits and trigger email campaigns programmatically.
                    Supports <code className="bg-gray-800 px-1 rounded text-xs text-blue-300">POST /api/v1/admin/credits</code> and <code className="bg-gray-800 px-1 rounded text-xs text-blue-300">POST /api/v1/admin/emails</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Created key display */}
                  {createdCreditKey && (
                    <Alert className="border-green-800 bg-green-950">
                      <Check className="h-4 w-4 text-green-400" />
                      <AlertTitle className="text-green-300">API Key Created</AlertTitle>
                      <AlertDescription className="text-green-400">
                        <p className="mb-2">Copy this key now — it won&apos;t be shown again:</p>
                        <code className="block bg-gray-900 p-2 rounded border border-gray-700 text-xs break-all select-all text-green-300">{createdCreditKey}</code>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => {
                          navigator.clipboard.writeText(createdCreditKey);
                          toast.success('Copied to clipboard');
                        }}>Copy Key</Button>
                        <Button size="sm" variant="ghost" className="mt-2 ml-2" onClick={() => setCreatedCreditKey(null)}>Dismiss</Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Create new key form */}
                  {showCreateCreditKey ? (
                    <div className="border border-gray-700 rounded-lg p-4 space-y-3 bg-gray-900">
                      <h4 className="font-medium text-gray-100">Create New Admin API Key</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Name *</Label>
                          <Input placeholder="e.g. CRM Integration" value={newCreditKeyName} onChange={e => setNewCreditKeyName(e.target.value)} />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Input placeholder="Optional description" value={newCreditKeyDesc} onChange={e => setNewCreditKeyDesc(e.target.value)} />
                        </div>
                        <div>
                          <Label>Expires At</Label>
                          <Input type="datetime-local" value={newCreditKeyExpiry} onChange={e => setNewCreditKeyExpiry(e.target.value)} />
                        </div>
                        <div>
                          <Label>Rate Limit (req/min)</Label>
                          <Input type="number" placeholder="e.g. 60" value={newCreditKeyRateLimit} onChange={e => setNewCreditKeyRateLimit(e.target.value)} />
                        </div>
                        <div>
                          <Label>Daily Limit</Label>
                          <Input type="number" placeholder="e.g. 1000" value={newCreditKeyDailyLimit} onChange={e => setNewCreditKeyDailyLimit(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          <Label className="mb-2 block">Scopes *</Label>
                          <div className="flex gap-4">
                            {[
                              { value: 'credits', label: '💳 Credits', desc: 'Manage partner credits' },
                              { value: 'email', label: '📧 Email Campaigns', desc: 'Send email campaigns' },
                              { value: 'all', label: '🔑 All Access', desc: 'Full API access' },
                            ].map(scope => (
                              <label key={scope.value} className="flex items-start gap-2 cursor-pointer bg-gray-800 rounded-lg p-2 px-3 border border-gray-700 hover:border-gray-500 transition-colors">
                                <input
                                  type="checkbox"
                                  className="mt-1 accent-blue-500"
                                  checked={newCreditKeyScopes.includes(scope.value)}
                                  onChange={e => {
                                    if (scope.value === 'all') {
                                      setNewCreditKeyScopes(e.target.checked ? ['all'] : ['credits']);
                                    } else {
                                      setNewCreditKeyScopes(prev => {
                                        const filtered = prev.filter(s => s !== 'all');
                                        return e.target.checked
                                          ? [...filtered, scope.value]
                                          : filtered.filter(s => s !== scope.value);
                                      });
                                    }
                                  }}
                                />
                                <div>
                                  <div className="text-sm font-medium text-gray-200">{scope.label}</div>
                                  <div className="text-xs text-gray-400">{scope.desc}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleCreateCreditKey} disabled={creditKeyCreating}>
                          {creditKeyCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Key'}
                        </Button>
                        <Button variant="outline" onClick={() => setShowCreateCreditKey(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => setShowCreateCreditKey(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Create New API Key
                    </Button>
                  )}

                  {/* Keys list */}
                  {creditKeysLoading ? (
                    <div className="text-center py-8 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading keys...</div>
                  ) : creditApiKeys.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No credit API keys created yet.</div>
                  ) : (
                    <div className="border border-gray-700 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900 border-b border-gray-700">
                          <tr>
                            <th className="text-left p-3 font-medium text-gray-300">Name</th>
                            <th className="text-left p-3 font-medium text-gray-300">Prefix</th>
                            <th className="text-left p-3 font-medium text-gray-300">Scopes</th>
                            <th className="text-left p-3 font-medium text-gray-300">Status</th>
                            <th className="text-left p-3 font-medium text-gray-300">Usage</th>
                            <th className="text-left p-3 font-medium text-gray-300">Created</th>
                            <th className="text-right p-3 font-medium text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditApiKeys.map(key => (
                            <tr key={key.id} className="border-b border-gray-700 last:border-0">
                              <td className="p-3">
                                <div className="font-medium text-gray-100">{key.name}</div>
                                {key.description && <div className="text-xs text-gray-400">{key.description}</div>}
                              </td>
                              <td className="p-3"><code className="text-xs bg-gray-900 text-gray-300 px-1 rounded">{key.prefix}...</code></td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1">
                                  {(key.scopes || ['credits']).map(s => (
                                    <span key={s} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                      s === 'all' ? 'bg-purple-900 text-purple-300' :
                                      s === 'email' ? 'bg-blue-900 text-blue-300' :
                                      'bg-gray-700 text-gray-300'
                                    }`}>{s}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  key.status === 'active' ? 'bg-green-900 text-green-300' :
                                  key.status === 'revoked' ? 'bg-red-900 text-red-300' :
                                  'bg-yellow-900 text-yellow-300'
                                }`}>{key.status}</span>
                              </td>
                              <td className="p-3 text-xs text-gray-400">
                                {key.usageCount} total{key.dailyLimit ? ` / ${key.dailyUsage} today` : ''}
                              </td>
                              <td className="p-3 text-xs text-gray-400">{new Date(key.createdAt).toLocaleDateString()}</td>
                              <td className="p-3 text-right">
                                <Button size="sm" variant="outline" className="mr-1"
                                  onClick={() => handleRevokeCreditKey(key.id, key.status)}>
                                  {key.status === 'active' ? 'Revoke' : 'Activate'}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteCreditKey(key.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* API Usage Guide */}
                  <div className="mt-6 border border-gray-700 rounded-lg p-4 bg-gray-900">
                    <h4 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" /> API Usage Guide
                    </h4>
                    <div className="text-sm text-gray-300 space-y-4">
                      <p><strong>Auth Header:</strong> <code className="bg-gray-800 px-1 rounded text-blue-300">X-API-Key: ack_your_key_here</code> or <code className="bg-gray-800 px-1 rounded text-blue-300">Authorization: Bearer ack_your_key_here</code></p>

                      {/* Credits API */}
                      <div className="border border-gray-700 rounded-lg p-3 bg-gray-950">
                        <h5 className="font-medium text-green-400 mb-2">💳 Credits API <span className="text-xs text-gray-500">(scope: credits)</span></h5>
                        <p className="mb-1"><strong>Endpoint:</strong> <code className="bg-gray-800 px-1 rounded text-blue-300">POST /api/v1/admin/credits</code></p>
                        <p className="mb-1"><strong>Operations:</strong> <code className="bg-gray-800 px-1 rounded text-blue-300">add</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">deduct</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">set_monthly</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">stop_monthly</code></p>
                        <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto text-green-400 mt-1">{JSON.stringify({
                          partnerEmail: "partner@example.com",
                          operation: "add",
                          amount: 500,
                          reason: "Monthly CRM bonus",
                          grantType: "one_time"
                        }, null, 2)}</pre>
                        <p className="mt-1"><strong>Check Balance:</strong> <code className="bg-gray-800 px-1 rounded text-blue-300">GET /api/v1/admin/credits?partnerEmail=partner@example.com</code></p>
                      </div>

                      {/* Email Campaign API */}
                      <div className="border border-gray-700 rounded-lg p-3 bg-gray-950">
                        <h5 className="font-medium text-blue-400 mb-2">📧 Email Campaign API <span className="text-xs text-gray-500">(scope: email)</span></h5>
                        <p className="mb-1"><strong>Endpoint:</strong> <code className="bg-gray-800 px-1 rounded text-blue-300">POST /api/v1/admin/emails</code></p>
                        <p className="mb-1"><strong>Target Types:</strong> <code className="bg-gray-800 px-1 rounded text-blue-300">active_partners</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">all_partners</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">all_waitlist</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">everyone</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">limited_partners</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">limited_waitlist</code></p>
                        <p className="mb-1 text-xs text-gray-400">💡 Use <code className="bg-gray-800 px-1 rounded text-blue-300">htmlContentBase64</code> for Base64-encoded HTML (recommended for complex templates)</p>
                        <p className="text-xs text-yellow-400 mb-1">⚠️ Test Mode: Set <code className="bg-gray-800 px-1 rounded">testMode: true</code> + <code className="bg-gray-800 px-1 rounded">testRecipientEmail</code> to preview before sending</p>
                        <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto text-green-400 mt-1">{JSON.stringify({
                          subject: "🚀 New Feature Launch",
                          htmlContentBase64: "PGgxPkhlbGxvIHt7bmFtZX19PC9oMT4=",
                          campaignName: "Feature Launch Q1",
                          targetType: "active_partners",
                          testMode: true,
                          testRecipientEmail: "cmo@company.com"
                        }, null, 2)}</pre>
                        <p className="mt-1 text-xs text-gray-400">Template variables: <code className="bg-gray-800 px-1 rounded text-blue-300">{'{{name}}'}</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">{'{{email}}'}</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">{'{{businessName}}'}</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">{'{{unsubscribe}}'}</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">{'{{date}}'}</code>, <code className="bg-gray-800 px-1 rounded text-blue-300">{'{{year}}'}</code></p>
                        <p className="mt-1"><strong>Campaign History:</strong> <code className="bg-gray-800 px-1 rounded text-blue-300">GET /api/v1/admin/emails?limit=20&amp;offset=0</code></p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}