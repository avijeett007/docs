'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiZap, FiKey, FiCopy, FiPlus, FiInfo, FiAlertCircle, FiLoader, FiMail, FiCheckCircle, FiCreditCard } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import WhitelabelLayout from '@/components/whitelabel/WhitelabelLayout';
import { usePartnerBranding } from '@/lib/partnerBranding';

// ---- Types ----
interface GatewayModel {
  modelId: string;
  displayName: string;
  category: string;
  inputCreditsPerM: number;
  outputCreditsPerM: number;
}

interface GatewayKey {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  keyPrefix: string;
  virtualKey?: string;
  allowedModels: string[];
  budgetCreditsReserved: number;
  budgetCreditsUsed: number;
  totalRequests: number;
  createdAt: string;
}

// ---- Create Key Modal ----
function CreateKeyModal({
  models,
  onClose,
  onCreated,
}: {
  models: GatewayModel[];
  onClose: () => void;
  onCreated: (key: GatewayKey) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleModel = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const submit = async () => {
    if (!name.trim()) return toast.error('Please enter a name for the key.');
    if (selected.size === 0) return toast.error('Select at least one model.');
    setLoading(true);
    try {
      const res = await fetch('/api/whitelabel/ai-gateway/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), allowedModels: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create key');
      toast.success('API key created! Save the key — it will not be shown again.');
      onCreated(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const byCategory = models.reduce<Record<string, GatewayModel[]>>((acc, m) => {
    (acc[m.category] = acc[m.category] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Create API Key</h2>
          <p className="text-sm text-gray-400 mt-1">Give your key a name and choose which AI models it can access.</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Key Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My App Integration"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Allowed Models</label>
            {Object.entries(byCategory).map(([cat, ms]) => (
              <div key={cat} className="mb-3">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{cat}</p>
                <div className="space-y-1.5">
                  {ms.map(m => (
                    <button
                      key={m.modelId}
                      onClick={() => toggleModel(m.modelId)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors border ${selected.has(m.modelId) ? 'bg-violet-900/40 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
                    >
                      <span>{m.displayName}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:bg-gray-800">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <FiLoader className="animate-spin" size={14} /> : <FiKey size={14} />}
            {loading ? 'Creating…' : 'Create Key'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---- Key Card ----
function KeyCard({ k, onCopy }: { k: GatewayKey; onCopy: (text: string) => void }) {
  const isSuspended = k.status === 'suspended';
  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">{k.name}</p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{k.keyPrefix}••••••••</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          k.status === 'active' ? 'bg-emerald-900/40 text-emerald-300'
          : isSuspended ? 'bg-amber-900/40 text-amber-300'
          : 'bg-gray-700 text-gray-400'
        }`}>
          {isSuspended ? 'paused' : k.status}
        </span>
      </div>
      {isSuspended && (
        <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
          <FiAlertCircle className="text-amber-400 shrink-0" size={13} />
          <p className="text-xs text-amber-300">This key is paused. Top up your credits to resume access.</p>
          <a href="/whitelabel/billing" className="ml-auto text-xs text-amber-400 underline whitespace-nowrap hover:text-amber-200">Add Credits</a>
        </div>
      )}
      {k.virtualKey && (
        <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2 flex flex-col gap-1">
          <p className="text-xs text-amber-400 font-medium">⚠ Copy this key now — it won&apos;t be shown again</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-amber-300 font-mono break-all flex-1">{k.virtualKey}</p>
            <button onClick={() => onCopy(k.virtualKey!)} className="shrink-0 text-amber-400 hover:text-white">
              <FiCopy size={14} />
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500">Created {new Date(k.createdAt).toLocaleDateString()}</p>
    </div>
  );
}

// ---- Main Page ----
export default function CustomerAiGatewayPage() {
  const { branding } = usePartnerBranding();
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [keys, setKeys] = useState<GatewayKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [urlRequested, setUrlRequested] = useState(false);
  const [requestingUrl, setRequestingUrl] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsRes, keysRes, balanceRes] = await Promise.all([
        fetch('/api/whitelabel/ai-gateway/models'),
        fetch('/api/whitelabel/ai-gateway/keys'),
        fetch('/api/whitelabel/credits/balance'),
      ]);
      if (!modelsRes.ok || !keysRes.ok) {
        const err = await modelsRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load gateway data');
      }
      const [md, kd] = await Promise.all([modelsRes.json(), keysRes.json()]);
      setModels(md.models || []);
      setKeys(kd.keys || []);
      if (balanceRes.ok) {
        const bd = await balanceRes.json();
        if (bd.success) setCreditBalance(bd.data.creditBalance ?? 0);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreated = (newKey: GatewayKey) => {
    setKeys(prev => [newKey, ...prev]);
    setShowCreate(false);
  };

  const requestApiUrl = async () => {
    setRequestingUrl(true);
    try {
      const res = await fetch('/api/whitelabel/ai-gateway/request-url', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      setUrlRequested(true);
    } catch {
      toast.error('Could not send your request. Please try again.');
    } finally {
      setRequestingUrl(false);
    }
  };

  const accentColor = branding.primaryColor || '#7c3aed';

  return (
    <WhitelabelLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="rounded-2xl overflow-hidden relative bg-gradient-to-br from-gray-900 via-violet-950/40 to-gray-900 border border-violet-800/40 p-6">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-violet-600/20 border border-violet-500/30">
              <FiZap className="text-violet-400" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Gateway</h1>
              <p className="text-gray-400 text-sm mt-1">Generate API keys to call AI models directly from your applications. Usage is deducted from your AI Credit balance.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {['OpenAI Compatible', 'Pay with Credits', 'Instant Access'].map(tag => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-violet-900/40 border border-violet-700/40 text-violet-300">{tag}</span>
            ))}
          </div>
        </div>

        {/* Credits notice */}
        <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/40 rounded-xl px-4 py-3">
          <FiInfo className="text-blue-400 mt-0.5 shrink-0" size={16} />
          <p className="text-sm text-blue-300">
            Keep your <span className="font-semibold text-blue-200">AI Credits</span> topped up for uninterrupted access.
            {' '}Enable <span className="font-semibold text-blue-200">Auto-Pay</span> in{' '}
            <a href="/whitelabel/billing" className="underline hover:text-blue-100">Billing</a>{' '}
            so your keys are never paused unexpectedly.
          </p>
        </div>

        {/* Zero-credit warning */}
        {!loading && creditBalance !== null && creditBalance <= 0 && (
          <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-600/20 border border-amber-500/30 shrink-0">
                <FiCreditCard className="text-amber-400" size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-200">No AI Credits Available</h3>
                <p className="text-xs text-amber-300/80 mt-1">
                  Your credit balance is <span className="font-semibold text-amber-200">0</span>. API requests will be rejected until you top up. Add credits to start using the AI Gateway.
                </p>
              </div>
            </div>
            <a
              href="/whitelabel/billing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
            >
              <FiCreditCard size={14} />
              Add Credits
            </a>
          </div>
        )}

        {/* Keys section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FiKey size={16} className="text-gray-400" /> Your API Keys
            </h2>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: accentColor }}
            >
              <FiPlus size={14} /> Generate Key
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <FiLoader className="animate-spin text-violet-400" size={24} />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-4 flex items-center gap-3">
              <FiAlertCircle className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-6 py-12 text-center">
              <FiKey className="mx-auto text-gray-600 mb-3" size={28} />
              <p className="text-gray-400 text-sm">No API keys yet. Generate one to get started.</p>
              <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">
                Generate First Key
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {keys.map(k => (
                  <motion.div key={k.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <KeyCard k={k} onCopy={copyToClipboard} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* API Gateway URL request card */}
        {!loading && !error && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-violet-600/20 border border-violet-500/30 shrink-0">
                <FiMail className="text-violet-400" size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Need the API Gateway URL?</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Your API key is ready to use. To connect your application, you also need the gateway base URL.
                  Click below and our team will send it to you directly.
                </p>
              </div>
            </div>

            {urlRequested ? (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-700/50 rounded-lg px-4 py-3">
                <FiCheckCircle className="text-emerald-400 shrink-0" size={16} />
                <p className="text-sm text-emerald-300">Request sent! We&apos;ll get back to you soon.</p>
              </div>
            ) : (
              <button
                onClick={requestApiUrl}
                disabled={requestingUrl}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {requestingUrl ? <FiLoader className="animate-spin" size={14} /> : <FiMail size={14} />}
                {requestingUrl ? 'Sending…' : 'Request API Gateway URL'}
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateKeyModal
            models={models}
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </WhitelabelLayout>
  );
}

