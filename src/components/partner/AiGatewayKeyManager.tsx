'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import toast from 'react-hot-toast';
import { Clipboard, RefreshCw, Trash2, Plus, DollarSign, Zap, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiGatewayKey {
  id: string;
  name: string;
  description: string | null;
  status: string;
  keyPrefix: string;
  virtualKey?: string;
  allowedModels: string[];
  budgetUsd: number;
  budgetCreditsReserved: number;
  budgetCreditsUsed: number;
  totalSpendUsd: number;
  profitMultiplier: number;
  customerCreditPriceCents: number;
  adminFeePercent: number;
  autoTopUpEnabled: boolean;
  autoTopUpThresholdUsd: number | null;
  autoTopUpAmountUsd: number | null;
  rateLimit: number | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  allowedDomains: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastSyncedAt: string | null;
  totalRequests: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
  customerId: string | null;
}

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

interface GatewayConfig {
  enabled: boolean;
  models: SupportedModel[];
  maxKeysPerPartner: number | null;
  maxBudgetCapUsd: number | null;
  adminFeePercent: number;
  partnerTier: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
  customerId?: string;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('partner_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function spendPercent(spend: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((spend / budget) * 100));
}

function spendColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-green-500';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AiGatewayKeyManager() {
  // State
  const [keys, setKeys] = useState<AiGatewayKey[]>([]);
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpKeyId, setTopUpKeyId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [newVirtualKey, setNewVirtualKey] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBudgetCredits, setFormBudgetCredits] = useState('');
  const [formModels, setFormModels] = useState<string[]>([]);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formProfitMultiplier, setFormProfitMultiplier] = useState('1.0');
  const [formCustomerCreditPrice, setFormCustomerCreditPrice] = useState('');
  const [formAutoTopUp, setFormAutoTopUp] = useState(false);
  const [formAutoTopUpThreshold, setFormAutoTopUpThreshold] = useState('');
  const [formAutoTopUpAmount, setFormAutoTopUpAmount] = useState('');
  const [formDomains, setFormDomains] = useState('');
  const [creating, setCreating] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/ai-gateway/config', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // Config fetch errors are non-critical — UI degrades gracefully
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const url = showRevoked ? '/api/partner/ai-gateway/keys' : '/api/partner/ai-gateway/keys?status=active';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch {
      toast.error('Failed to fetch AI Gateway keys');
    } finally {
      setLoading(false);
    }
  }, [showRevoked]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/customers?limit=100', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const allCustomers = data.data || [];
        setCustomers(allCustomers);
      }
    } catch {
      // Customers list failure is non-critical — form will show empty dropdown
    }
  }, []);

  const fetchCreditBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/partner/credits/balance', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCreditBalance(data.data?.currentBalance ?? null);
      }
    } catch {
      // Balance fetch failure is non-critical — balance check will be skipped
    }
  }, []);


  useEffect(() => {
    fetchConfig();
    fetchKeys();
    fetchCustomers();
    fetchCreditBalance();
  }, [fetchConfig, fetchKeys, fetchCustomers, fetchCreditBalance]);

  // ─── Actions ──────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormBudgetCredits('');
    setFormModels([]); setFormCustomerId(''); setFormProfitMultiplier('1.0');
    setFormCustomerCreditPrice('');
    setFormAutoTopUp(false); setFormAutoTopUpThreshold(''); setFormAutoTopUpAmount('');
    setFormDomains('');
  };

  // Convert credits to USD (1 credit ≈ 1 cent, so 100 credits = $1.00)
  const creditsToUsd = (credits: number) => credits / 100;
  const budgetCredits = parseInt(formBudgetCredits) || 0;
  const budgetUsd = creditsToUsd(budgetCredits);
  const adminFee = config ? config.adminFeePercent : 0;
  const totalCreditsWithFee = Math.ceil(budgetCredits * (1 + adminFee / 100));

  const handleCreate = async () => {
    if (!formName.trim() || !formBudgetCredits || formModels.length === 0) {
      toast.error('Name, budget, and at least one model are required');
      return;
    }
    if (budgetCredits <= 0) {
      toast.error('Budget must be at least 1 credit');
      return;
    }
    // Check credit balance
    if (creditBalance !== null && totalCreditsWithFee > creditBalance) {
      toast.error(`Insufficient credits. Need ${totalCreditsWithFee} credits, you have ${creditBalance}`);
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, any> = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        budgetUsd,
        allowedModels: formModels,
        customerId: formCustomerId || undefined,
        isCustomerKey: !!formCustomerId,
        profitMultiplier: parseFloat(formProfitMultiplier) || 1.0,
        customerCreditPriceCents: parseFloat(formCustomerCreditPrice) || undefined,
        autoTopUpEnabled: formAutoTopUp,
        allowedDomains: formDomains.trim() || undefined,
      };
      if (formAutoTopUp) {
        body.autoTopUpThresholdUsd = parseFloat(formAutoTopUpThreshold) || undefined;
        body.autoTopUpAmountUsd = parseFloat(formAutoTopUpAmount) || undefined;
      }
      const res = await fetch('/api/partner/ai-gateway/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface specific, actionable messages for credit-related errors
        if (data.code === 'CUSTOMER_AI_CREDIT_DISABLED') {
          toast.error(
            'This customer does not have AI Credits enabled. Go to customer settings and enable AI Credits before creating a key.',
            { duration: 8000 }
          );
        } else if (data.code === 'CUSTOMER_INSUFFICIENT_AI_CREDITS') {
          toast.error(
            'This customer has 0 AI Credits. Add credits to their account first, then create the key.',
            { duration: 8000 }
          );
        } else if (data.code === 'CUSTOMER_NOT_FOUND') {
          toast.error('Selected customer was not found. Please refresh and try again.');
        } else {
          toast.error(data.error || 'Failed to create key');
        }
        return;
      }
      toast.success('AI Gateway key created!');
      setNewVirtualKey(data.virtualKey || null);
      setCreateOpen(false);
      resetForm();
      fetchKeys();
      fetchCreditBalance();
    } catch (err) {
      toast.error('Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleTopUp = async () => {
    if (!topUpKeyId || !topUpAmount) return;
    const topUpCredits = parseInt(topUpAmount) || 0;
    if (topUpCredits <= 0) { toast.error('Enter a valid credit amount'); return; }
    const topUpFee = config ? config.adminFeePercent : 0;
    const topUpTotalCredits = Math.ceil(topUpCredits * (1 + topUpFee / 100));
    if (creditBalance !== null && topUpTotalCredits > creditBalance) {
      toast.error(`Insufficient credits. Need ${topUpTotalCredits}, you have ${creditBalance}`);
      return;
    }
    try {
      const res = await fetch(`/api/partner/ai-gateway/keys/${topUpKeyId}/top-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ amountUsd: topUpCredits / 100 }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Top-up failed'); return; }
      toast.success('Budget topped up!');
      setTopUpOpen(false); setTopUpKeyId(null); setTopUpAmount('');
      fetchKeys();
      fetchCreditBalance();
    } catch { toast.error('Top-up failed'); }
  };

  const handleRegenerate = async (keyId: string) => {
    if (!confirm('Regenerate this key? The old key will stop working immediately.')) return;
    try {
      const res = await fetch(`/api/partner/ai-gateway/keys/${keyId}/regenerate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Regeneration failed'); return; }
      toast.success('Key regenerated!');
      setNewVirtualKey(data.virtualKey || null);
      fetchKeys();
    } catch { toast.error('Regeneration failed'); }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Revoke this key? This action cannot be undone. Unused credits will be refunded.')) return;
    try {
      const res = await fetch(`/api/partner/ai-gateway/keys/${keyId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Revoke failed'); return; }
      toast.success('Key revoked and credits refunded');
      fetchKeys();
    } catch { toast.error('Revoke failed'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleModel = (modelId: string) => {
    setFormModels(prev =>
      prev.includes(modelId) ? prev.filter(m => m !== modelId) : [...prev, modelId]
    );
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (!config) {
    return <div className="text-center py-8 text-gray-500">Loading AI Gateway configuration...</div>;
  }

  if (!config.enabled) {
    return (
      <div className="text-center py-12 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Gateway Not Available</h3>
        <p className="mt-2 text-sm text-gray-500">The AI Gateway is currently disabled. Contact support for more information.</p>
      </div>
    );
  }

  const activeKeys = keys.filter(k => k.status === 'active');

  return (
    <div className="space-y-6">
      {/* ── Virtual Key Success Banner ── */}
      {newVirtualKey && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">🔑 Your Virtual Key (shown once!)</h4>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Copy this key now. It will not be shown again.</p>
              <code className="mt-2 block text-sm bg-green-100 dark:bg-green-900 px-3 py-2 rounded font-mono break-all">
                {newVirtualKey}
              </code>
            </div>
            <div className="flex gap-2 ml-4">
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(newVirtualKey)}>
                <Clipboard className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewVirtualKey(null)}>Dismiss</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Gateway Keys</h3>
          <p className="text-sm text-gray-500">
            Manage LLM API keys for your customers. Tier: <span className="font-medium capitalize">{config.partnerTier.replace('_', ' ')}</span>
            {config.adminFeePercent > 0 && <span className="ml-2 text-amber-600">({config.adminFeePercent}% platform fee)</span>}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={config.maxKeysPerPartner !== null && activeKeys.length >= config.maxKeysPerPartner} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Create Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-gray-900 border border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Create AI Gateway Key</DialogTitle>
              <DialogDescription className="text-gray-400">Create a virtual LLM API key with a pre-funded budget.</DialogDescription>
              {creditBalance !== null && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded bg-gray-800 border border-gray-700">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-300">Your Balance: <span className="font-semibold text-green-400">{creditBalance.toLocaleString()} credits</span>
                    <span className="text-gray-500 ml-1">(${(creditBalance / 100).toFixed(2)})</span>
                  </span>
                </div>
              )}
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Name */}
              <div>
                <Label htmlFor="gw-name" className="text-gray-300">Key Name *</Label>
                <Input id="gw-name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Customer Chatbot" className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
              </div>
              {/* Description */}
              <div>
                <Label htmlFor="gw-desc" className="text-gray-300">Description</Label>
                <Input id="gw-desc" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Optional description" className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
              </div>
              {/* Budget in Knotie Credits */}
              <div>
                <Label htmlFor="gw-budget" className="text-gray-300">Budget (Knotie Credits) *</Label>
                <Input id="gw-budget" type="number" min="1" step="1" value={formBudgetCredits} onChange={e => setFormBudgetCredits(e.target.value)} placeholder="e.g. 1000 credits" className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
                {budgetCredits > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    ≈ ${budgetUsd.toFixed(2)} USD budget
                    {adminFee > 0 && (
                      <span className="text-amber-500"> · Total with {adminFee}% fee: {totalCreditsWithFee.toLocaleString()} credits (${(totalCreditsWithFee / 100).toFixed(2)})</span>
                    )}
                  </p>
                )}
                {creditBalance !== null && budgetCredits > 0 && totalCreditsWithFee > creditBalance && (
                  <p className="text-xs text-red-400 mt-1">
                    ⚠ Insufficient balance. You need {totalCreditsWithFee.toLocaleString()} credits but have {creditBalance.toLocaleString()}.
                  </p>
                )}
                {/* Cost Estimation Breakdown */}
                {budgetUsd > 0 && formModels.length > 0 && (
                  <div className="mt-2 bg-gray-800/50 border border-gray-700 rounded p-2">
                    <p className="text-xs font-medium text-gray-400 mb-1">💡 Estimated capacity per model:</p>
                    <div className="space-y-1">
                      {formModels.map(modelId => {
                        const model = config.models.find(m => m.modelId === modelId);
                        if (!model) return null;
                        const avgInputTokens = 500;
                        const avgOutputTokens = 200;
                        const costPerReq = (avgInputTokens * model.inputCostPer1MTokens + avgOutputTokens * model.outputCostPer1MTokens) / 1_000_000;
                        const estRequests = costPerReq > 0 ? Math.floor(budgetUsd / costPerReq) : 0;
                        const estInputTokens = budgetUsd > 0 ? Math.floor((budgetUsd / model.inputCostPer1MTokens) * 1_000_000) : 0;
                        return (
                          <div key={modelId} className="flex justify-between text-xs text-gray-400">
                            <span className="text-gray-300 truncate max-w-[140px]">{model.displayName}</span>
                            <span>~{estRequests.toLocaleString()} reqs · {(estInputTokens / 1_000_000).toFixed(1)}M input tokens</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 italic">Based on ~500 input + 200 output tokens per request</p>
                  </div>
                )}
              </div>
              {/* Models */}
              <div>
                <Label className="text-gray-300">Allowed Models *</Label>
                <div className="grid grid-cols-1 gap-2 mt-2 max-h-40 overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800">
                  {config.models.length === 0 ? (
                    <p className="text-xs text-gray-400">No models available for your tier.</p>
                  ) : config.models.map(m => (
                    <label key={m.modelId} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-700 p-1 rounded text-gray-300">
                      <input type="checkbox" checked={formModels.includes(m.modelId)} onChange={() => toggleModel(m.modelId)} className="rounded" />
                      <span className="font-medium text-white">{m.displayName}</span>
                      <span className="text-xs text-gray-400">({m.provider})</span>
                      <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${m.category === 'budget' ? 'bg-green-900 text-green-300' : m.category === 'mid_tier' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                        {m.category.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {/* ── Customer Billing Section ── */}
              <div className="border border-blue-500/20 rounded-lg p-4 space-y-3 bg-blue-950/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-400 text-sm">👤</span>
                  <Label className="text-blue-300 font-medium text-sm">Customer Billing (optional)</Label>
                </div>
                <p className="text-xs text-gray-400 -mt-1">Assign this key to a customer to track usage and charge their AI Credits with a profit markup.</p>

                {/* Customer Dropdown */}
                <div>
                  <Label htmlFor="gw-customer" className="text-gray-300 text-xs">Assign to Customer</Label>
                  {customers.length === 0 ? (
                    <p className="text-xs text-gray-500 mt-1">No customers found. Create customers first to enable billing.</p>
                  ) : (
                    <select id="gw-customer" value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}
                      className="w-full mt-1 rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20">
                      <option value="">No customer — usage charges your account only</option>
                      {customers.map(c => {
                        const cId = c.customerId || c.id;
                        return (
                          <option key={cId} value={cId}>{c.firstName} {c.lastName} {c.companyName ? ` (${c.companyName})` : ''} {c.email ? `— ${c.email}` : ''}</option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Profit Multiplier — only shown when customer is selected */}
                {formCustomerId && (
                  <div>
                    <Label htmlFor="gw-profit" className="text-gray-300 text-xs">Profit Multiplier</Label>
                    <Input id="gw-profit" type="number" min="0.1" step="0.1" value={formProfitMultiplier} onChange={e => setFormProfitMultiplier(e.target.value)} className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
                    <p className="text-xs text-gray-500 mt-1">Markup on raw LLM cost charged to the customer (1.0 = no markup, 1.5 = 50% markup, 2.0 = 100% markup)</p>
                  </div>
                )}

                {/* Customer Credit Price — only shown when customer is selected */}
                {formCustomerId && (
                  <div>
                    <Label htmlFor="gw-credit-price" className="text-gray-300 text-xs">Price of 1 AI Credit (in cents)</Label>
                    <Input id="gw-credit-price" type="number" min="0.01" step="0.01" placeholder="1" value={formCustomerCreditPrice} onChange={e => setFormCustomerCreditPrice(e.target.value)} className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
                    <p className="text-xs text-gray-500 mt-1">How much 1 Customer AI Credit is worth in cents. Default: 1 cent = 1 credit. Set to 5 if you sell credits at 5¢ each.</p>
                  </div>
                )}

                {/* Billing Preview */}
                {formCustomerId && budgetCredits > 0 && (() => {
                  const multiplier = parseFloat(formProfitMultiplier) || 1.0;
                  const creditPrice = parseFloat(formCustomerCreditPrice) || 1;
                  const customerCostCents = 100 * multiplier; // cents the customer pays for $1 LLM usage
                  const customerCreditsCharged = parseFloat((customerCostCents / creditPrice).toFixed(4));
                  return (
                  <div className="bg-gray-800/60 rounded-md p-3 border border-gray-700 space-y-1.5">
                    <p className="text-xs font-medium text-gray-300 mb-1">💡 Billing Preview (per $1.00 of LLM usage)</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Your cost (raw):</span>
                      <span className="text-white font-medium">100 credits ($1.00)</span>
                    </div>
                    {adminFee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-400">+ Platform fee ({adminFee}%):</span>
                        <span className="text-amber-300 font-medium">{adminFee} credits (${(adminFee / 100).toFixed(2)})</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Your total cost:</span>
                      <span className="text-white font-medium">{100 + adminFee} credits (${((100 + adminFee) / 100).toFixed(2)})</span>
                    </div>
                    <div className="border-t border-gray-700 my-1" />
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-400">Customer charged ({multiplier}x, {creditPrice}¢/credit):</span>
                      <span className="text-blue-300 font-semibold">{customerCreditsCharged} credits (${(customerCostCents / 100).toFixed(2)})</span>
                    </div>
                    {multiplier > 1.0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-400">Your profit per $1 usage:</span>
                        <span className="text-green-300 font-semibold">{parseFloat((100 * (multiplier - 1) - adminFee).toFixed(4))} credits (${((multiplier - 1 - adminFee / 100)).toFixed(2)})</span>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* No customer info */}
                {!formCustomerId && (
                  <p className="text-xs text-gray-500 italic">Without a customer, all usage costs are deducted from your Knotie Credit balance directly.</p>
                )}
              </div>
              {/* Auto Top-Up */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formAutoTopUp} onChange={e => setFormAutoTopUp(e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium text-gray-300">Enable Auto Top-Up</span>
                </label>
                {formAutoTopUp && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <Label htmlFor="gw-threshold" className="text-gray-300">Threshold (USD)</Label>
                      <Input id="gw-threshold" type="number" min="0.01" step="0.01" value={formAutoTopUpThreshold} onChange={e => setFormAutoTopUpThreshold(e.target.value)} placeholder="e.g. 2.00" className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
                    </div>
                    <div>
                      <Label htmlFor="gw-topup-amt" className="text-gray-300">Top-Up Amount (USD)</Label>
                      <Input id="gw-topup-amt" type="number" min="0.01" step="0.01" value={formAutoTopUpAmount} onChange={e => setFormAutoTopUpAmount(e.target.value)} placeholder="e.g. 5.00" className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
                    </div>
                  </div>
                )}
              </div>
              {/* Allowed Domains */}
              <div>
                <Label htmlFor="gw-domains" className="text-gray-300">Allowed Domains (optional)</Label>
                <Input id="gw-domains" value={formDomains} onChange={e => setFormDomains(e.target.value)} placeholder="e.g. example.com, app.example.com" className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list of domains that can use this key</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
                {creating ? 'Creating...' : 'Create Key'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Filter Toggle ── */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showRevoked} onChange={e => setShowRevoked(e.target.checked)} className="rounded" />
          Show revoked keys
        </label>
        <span className="text-xs text-gray-400">({activeKeys.length} active key{activeKeys.length !== 1 ? 's' : ''})</span>
      </div>

      {/* ── Keys Table ── */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading keys...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50 dark:bg-gray-900">
          <Zap className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-gray-500">No AI Gateway keys yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key Prefix</TableHead>
                <TableHead>Budget / Spend</TableHead>
                <TableHead>Models</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map(key => {
                const pct = spendPercent(key.totalSpendUsd, key.budgetUsd);
                const isExpanded = expandedKeyId === key.id;
                return (
                  <React.Fragment key={key.id}>
                  <TableRow className={`cursor-pointer ${key.status === 'revoked' ? 'opacity-50' : ''} ${isExpanded ? 'border-b-0' : ''}`} onClick={() => setExpandedKeyId(isExpanded ? null : key.id)}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <div>
                          <div className="font-medium">{key.name}</div>
                      {key.description && <div className="text-xs text-gray-400">{key.description}</div>}
                      {key.customerId && (
                        <div className="text-xs text-blue-400 mt-0.5">
                          👤 {(() => {
                            const cust = customers.find(c => c.customerId === key.customerId);
                            return cust ? `${cust.firstName} ${cust.lastName}` : 'Customer assigned';
                          })()}
                          {key.profitMultiplier > 1 && <span className="ml-1 text-amber-400">({key.profitMultiplier}x)</span>}
                        </div>
                      )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{key.keyPrefix}...</code>
                    </TableCell>
                    <TableCell>
                      <div className="w-36">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-300">${key.totalSpendUsd.toFixed(2)} spent</span>
                          <span className="text-gray-400">/ ${key.budgetUsd.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className={`h-2 rounded-full ${spendColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                          <span>{pct}% used</span>
                          <span className="text-green-400">${(key.budgetUsd - key.totalSpendUsd).toFixed(2)} left</span>
                        </div>
                        {key.totalRequests > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {key.totalRequests.toLocaleString()} req · {key.totalTokens.toLocaleString()} tokens
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.allowedModels.slice(0, 2).map(m => (
                          <span key={m} className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{m}</span>
                        ))}
                        {key.allowedModels.length > 2 && (
                          <span className="text-xs text-gray-400">+{key.allowedModels.length - 2}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${key.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                        {key.status}
                      </span>
                      {key.autoTopUpEnabled && key.status === 'active' && (
                        <span className="ml-1 text-xs text-blue-500" title="Auto top-up enabled">⟳</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {key.lastUsedAt ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true }) : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      {key.status === 'active' && (
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" title="Top Up" onClick={() => { setTopUpKeyId(key.id); setTopUpOpen(true); }}>
                            <DollarSign className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" title="Regenerate" onClick={() => handleRegenerate(key.id)}>
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" title="Revoke" className="text-red-500 hover:text-red-700" onClick={() => handleRevoke(key.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* ── Expandable Detail Row ── */}
                  {isExpanded && (
                    <TableRow className="bg-gray-800/50 hover:bg-gray-800/50">
                      <TableCell colSpan={7} className="p-0">
                        <div className="px-6 py-4 space-y-4">
                          {/* Key Configuration */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 block text-xs">Key Prefix</span>
                              <code className="text-gray-300">{key.keyPrefix}...</code>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Credits Reserved</span>
                              <span className="text-gray-300">{key.budgetCreditsReserved.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Credits Used</span>
                              <span className="text-gray-300">{(key.budgetCreditsUsed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Credits Remaining</span>
                              <span className={`${(key.budgetCreditsReserved - (key.budgetCreditsUsed ?? 0)) <= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {(key.budgetCreditsReserved - (key.budgetCreditsUsed ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Admin Fee</span>
                              <span className="text-gray-300">{key.adminFeePercent}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Profit Multiplier</span>
                              <span className="text-gray-300">{key.profitMultiplier}x</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Credit Price</span>
                              <span className="text-gray-300">{key.customerCreditPriceCents}¢/credit</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Rate Limit</span>
                              <span className="text-gray-300">{key.rateLimit ? `${key.rateLimit} RPM` : 'None'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Daily Limit</span>
                              <span className="text-gray-300">{key.dailyLimit ? `${key.dailyLimit} req` : 'None'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Monthly Limit</span>
                              <span className="text-gray-300">{key.monthlyLimit ? `${key.monthlyLimit} req` : 'None'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs">Expires</span>
                              <span className="text-gray-300">{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</span>
                            </div>
                          </div>

                          {/* Auto Top-Up Settings */}
                          {key.autoTopUpEnabled && (
                            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3">
                              <h5 className="text-xs font-semibold text-blue-300 mb-1">⟳ Auto Top-Up Enabled</h5>
                              <p className="text-xs text-gray-400">
                                When remaining budget falls below <span className="text-white">${key.autoTopUpThresholdUsd?.toFixed(2) ?? '—'}</span>,
                                automatically add <span className="text-white">${key.autoTopUpAmountUsd?.toFixed(2) ?? '—'}</span> to the budget.
                              </p>
                            </div>
                          )}

                          {/* Allowed Domains */}
                          {key.allowedDomains && (
                            <div>
                              <span className="text-gray-500 text-xs block mb-1">Allowed Domains</span>
                              <div className="flex flex-wrap gap-1">
                                {key.allowedDomains.split(',').map(d => (
                                  <span key={d.trim()} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{d.trim()}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* All Allowed Models */}
                          <div>
                            <span className="text-gray-500 text-xs block mb-1">Allowed Models ({key.allowedModels.length})</span>
                            <div className="flex flex-wrap gap-1">
                              {key.allowedModels.map(m => (
                                <span key={m} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{m}</span>
                              ))}
                            </div>
                          </div>

                          {/* Timestamps */}
                          <div className="flex gap-6 text-xs text-gray-500 border-t border-gray-700 pt-3">
                            <span>Created: {new Date(key.createdAt).toLocaleString()}</span>
                            <span>Updated: {new Date(key.updatedAt).toLocaleString()}</span>
                            {key.lastSyncedAt && <span>Last Synced: {formatDistanceToNow(new Date(key.lastSyncedAt), { addSuffix: true })}</span>}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Top-Up Dialog ── */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="sm:max-w-sm bg-gray-900 border border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Top Up Budget</DialogTitle>
            <DialogDescription className="text-gray-400">Add credits to this key&apos;s budget. Credits will be reserved from your balance.</DialogDescription>
            {creditBalance !== null && (
              <div className="flex items-center gap-2 mt-2 p-2 rounded bg-gray-800 border border-gray-700">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="text-sm text-gray-300">Your Balance: <span className="font-semibold text-green-400">{creditBalance.toLocaleString()} credits</span></span>
              </div>
            )}
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="topup-amount" className="text-gray-300">Amount (Knotie Credits)</Label>
            <Input id="topup-amount" type="number" min="1" step="1" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="e.g. 500 credits" className="bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20" />
            {topUpAmount && parseInt(topUpAmount) > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                ≈ ${(parseInt(topUpAmount) / 100).toFixed(2)} USD
                {config && config.adminFeePercent > 0 && (
                  <span className="text-amber-500"> · Total with {config.adminFeePercent}% fee: {Math.ceil(parseInt(topUpAmount) * (1 + config.adminFeePercent / 100)).toLocaleString()} credits</span>
                )}
              </p>
            )}
            {creditBalance !== null && topUpAmount && parseInt(topUpAmount) > 0 && (() => {
              const fee = config ? config.adminFeePercent : 0;
              const total = Math.ceil(parseInt(topUpAmount) * (1 + fee / 100));
              return total > creditBalance ? (
                <p className="text-xs text-red-400 mt-1">⚠ Insufficient balance. Need {total.toLocaleString()} credits.</p>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopUpOpen(false)} className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">Cancel</Button>
            <Button onClick={handleTopUp} disabled={!topUpAmount} className="bg-blue-600 hover:bg-blue-700 text-white">Top Up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}