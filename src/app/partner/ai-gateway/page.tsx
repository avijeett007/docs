'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AiGatewayKeyManager from '@/components/partner/AiGatewayKeyManager';
import NeonContainer from '@/components/NeonContainer';
import PartnerLayout from '@/components/partner/PartnerLayout';
import {
  FiCode, FiCpu, FiInfo, FiCopy, FiCheck,
  FiChevronDown, FiChevronUp, FiZap, FiShield, FiDollarSign,
  FiUsers, FiToggleLeft, FiToggleRight, FiSave, FiLoader
} from 'react-icons/fi';

const AI_GATEWAY_SNIPPETS = {
  python: `import openai

client = openai.OpenAI(
    api_key="sk-your-gateway-key",
    base_url="https://api.knotie.ai"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, what can you do?"}
    ]
)

print(response.choices[0].message.content)`,

  nodejs: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-your-gateway-key",
  baseURL: "https://api.knotie.ai",
});

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello, what can you do?" },
  ],
});

console.log(response.choices[0].message.content);`,

  curl: `curl https://api.knotie.ai/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-gateway-key" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello, what can you do?"}
    ]
  }'`,
};

export default function AiGatewayPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState<'python' | 'nodejs' | 'curl'>('python');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Customer self-service gateway settings
  const [gwSettingsLoading, setGwSettingsLoading] = useState(true);
  const [gwSettingsSaving, setGwSettingsSaving] = useState(false);
  const [gwSettingsSaved, setGwSettingsSaved] = useState(false);
  const [customerGatewayEnabled, setCustomerGatewayEnabled] = useState(false);
  const [customerGatewayForNewCustomers, setCustomerGatewayForNewCustomers] = useState(true);
  const [customerGatewayForExistingCustomers, setCustomerGatewayForExistingCustomers] = useState(true);
  const [gatewayProfitMultiplier, setGatewayProfitMultiplier] = useState('1.5');
  const [gatewayCreditToUsdCents, setGatewayCreditToUsdCents] = useState('1.0');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) { router.push('/partner/login'); return; }

        const response = await fetch('/api/partner/profile', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('partner_token');
            localStorage.removeItem('partner_name');
            router.push('/partner/login');
            return;
          }
          throw new Error('Failed to verify authentication');
        }

        const partnerData = await response.json();
        if (partnerData.businessName) {
          setPartnerName(partnerData.businessName);
          localStorage.setItem('partner_name', partnerData.businessName);
        }
        setIsAuthenticated(true);

        // Fetch gateway customer settings in parallel
        try {
          const gwRes = await fetch('/api/partner/ai-gateway/customer-settings', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (gwRes.ok) {
            const { settings } = await gwRes.json();
            setCustomerGatewayEnabled(settings.customerGatewayEnabled ?? false);
            setCustomerGatewayForNewCustomers(settings.customerGatewayForNewCustomers ?? true);
            setCustomerGatewayForExistingCustomers(settings.customerGatewayForExistingCustomers ?? true);
            setGatewayProfitMultiplier(String(settings.gatewayProfitMultiplier ?? '1.5'));
            setGatewayCreditToUsdCents(String(settings.gatewayCreditToUsdCents ?? '1.0'));
          }
        } finally {
          setGwSettingsLoading(false);
        }
      } catch {
        localStorage.removeItem('partner_token');
        localStorage.removeItem('partner_name');
        router.push('/partner/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuthentication();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const saveGatewaySettings = async () => {
    setGwSettingsSaving(true);
    setGwSettingsSaved(false);
    try {
      const token = localStorage.getItem('partner_token');
      const res = await fetch('/api/partner/ai-gateway/customer-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerGatewayEnabled,
          customerGatewayForNewCustomers,
          customerGatewayForExistingCustomers,
          gatewayProfitMultiplier: parseFloat(gatewayProfitMultiplier) || 1.5,
          gatewayCreditToUsdCents: parseFloat(gatewayCreditToUsdCents) || 1.0,
        }),
      });
      if (res.ok) {
        setGwSettingsSaved(true);
        setTimeout(() => setGwSettingsSaved(false), 3000);
      }
    } finally {
      setGwSettingsSaving(false);
    }
  };

  const SnippetTabBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );

  const CodeBlock = ({ code, id, language }: { code: string; id: string; language: string }) => (
    <div className="relative group">
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={() => copyToClipboard(code, id)}
          className="p-1.5 rounded bg-gray-700/80 hover:bg-gray-600 transition-colors text-gray-300 hover:text-white"
          title="Copy to clipboard"
        >
          {copiedSnippet === id ? <FiCheck className="h-3.5 w-3.5 text-green-400" /> : <FiCopy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
        <div className="flex items-center px-3 py-1.5 bg-gray-900 border-b border-gray-800">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{language}</span>
        </div>
        <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto leading-relaxed"><code>{code}</code></pre>
      </div>
    </div>
  );

  return (
    <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
      <div className="space-y-8">

        {/* ── Breadcrumb ── */}
        <nav className="flex text-sm">
          <a href="/partner/dashboard" className="text-blue-400 hover:text-blue-300">Dashboard</a>
          <span className="mx-2 text-gray-600">/</span>
          <span className="text-gray-300">AI Gateway</span>
        </nav>

        {/* ── Premium Hero ── */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/60 via-gray-900 to-blue-950/60 p-8">
          {/* Ambient glow blobs */}
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            {/* Icon */}
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <FiCpu className="w-8 h-8 text-purple-300" />
            </div>

            {/* Text */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">OpenAI Compatible</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">🧪 Beta</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-purple-300 via-white to-blue-300 bg-clip-text text-transparent">
                AI Gateway
              </h1>
              <p className="text-gray-300 max-w-2xl leading-relaxed">
                Create metered LLM API keys for your customers. Drop-in replacement for the OpenAI SDK —
                just change the <code className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded text-xs">base_url</code> to{' '}
                <code className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded text-xs">https://api.knotie.ai</code>.
                Budget controls, model access, and rate limits built in.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              {[
                { icon: <FiDollarSign className="w-3.5 h-3.5" />, label: 'Credit Budgets' },
                { icon: <FiShield className="w-3.5 h-3.5" />, label: 'Rate Limits' },
                { icon: <FiZap className="w-3.5 h-3.5" />, label: 'Auto Top-Up' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg">
                  {f.icon} {f.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Quick Start Code Snippets ── */}
        <div className="border border-purple-500/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-gray-700/60">
            <h3 className="text-white font-medium text-sm flex items-center gap-2">
              <FiCode className="h-4 w-4 text-purple-400" />
              Quick Start — Use with OpenAI SDK
            </h3>
            <div className="flex gap-1">
              <SnippetTabBtn label="Python" active={snippetTab === 'python'} onClick={() => setSnippetTab('python')} />
              <SnippetTabBtn label="Node.js" active={snippetTab === 'nodejs'} onClick={() => setSnippetTab('nodejs')} />
              <SnippetTabBtn label="cURL" active={snippetTab === 'curl'} onClick={() => setSnippetTab('curl')} />
            </div>
          </div>
          <div className="p-4 bg-gray-900/50">
            {snippetTab === 'python' && <CodeBlock code={AI_GATEWAY_SNIPPETS.python} id="gw-python" language="python" />}
            {snippetTab === 'nodejs' && <CodeBlock code={AI_GATEWAY_SNIPPETS.nodejs} id="gw-nodejs" language="javascript" />}
            {snippetTab === 'curl' && <CodeBlock code={AI_GATEWAY_SNIPPETS.curl} id="gw-curl" language="bash" />}
            <p className="text-xs text-gray-500 mt-3">
              Replace <code className="text-purple-400">sk-your-gateway-key</code> with a virtual key created below.
            </p>
          </div>
        </div>

        {/* ── AI Gateway Key Manager (premium wrapper) ── */}
        <NeonContainer>
          <div className="p-6">
            <AiGatewayKeyManager />
          </div>
        </NeonContainer>

        {/* ── Customer Self-Service Gateway Settings ── */}
        <div className="border border-blue-500/20 rounded-xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gray-800/60 border-b border-gray-700/60">
            <div className="flex items-center gap-3">
              <FiUsers className="h-5 w-5 text-blue-400" />
              <div>
                <h3 className="text-white font-semibold text-sm">Customer Self-Service API Keys</h3>
                <p className="text-gray-400 text-xs mt-0.5">
                  Let your customers generate their own gateway API keys directly from their portal.
                </p>
              </div>
            </div>
            {/* Master toggle */}
            {gwSettingsLoading ? (
              <FiLoader className="h-5 w-5 text-gray-500 animate-spin" />
            ) : (
              <button
                onClick={() => setCustomerGatewayEnabled(v => !v)}
                className="flex items-center gap-2 text-sm font-medium transition-colors focus:outline-none"
                aria-label="Toggle customer gateway"
              >
                {customerGatewayEnabled
                  ? <><FiToggleRight className="h-7 w-7 text-blue-400" /><span className="text-blue-400">Enabled</span></>
                  : <><FiToggleLeft className="h-7 w-7 text-gray-500" /><span className="text-gray-400">Disabled</span></>
                }
              </button>
            )}
          </div>

          {/* Expanded body — shown only when enabled */}
          {customerGatewayEnabled && !gwSettingsLoading && (
            <div className="p-5 bg-gray-900/50 space-y-5">

              {/* ── Credit Reserve Notice ── */}
              <div className="flex gap-3 bg-amber-950/40 border border-amber-700/50 rounded-lg px-4 py-3">
                <FiInfo className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 text-xs font-semibold mb-0.5">1,000 Knotie Credits reserved per customer key</p>
                  <p className="text-amber-400/80 text-xs leading-relaxed">
                    Each time a customer creates an AI Gateway key, <strong>1,000 Knotie Credits (~$10)</strong> are
                    reserved from your balance as a deposit to cover underlying provider costs.
                    If your balance drops below 1,000 credits, all customer keys are automatically suspended
                    and re-enabled once you top up. Ensure you maintain sufficient credits to avoid service interruptions.
                  </p>
                </div>
              </div>

              {/* Sub-toggles */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Apply to</p>
                {[
                  { label: 'New Customers', desc: 'Customers who sign up after you enable this', value: customerGatewayForNewCustomers, setter: setCustomerGatewayForNewCustomers },
                  { label: 'Existing Customers', desc: 'Customers who already have an account', value: customerGatewayForExistingCustomers, setter: setCustomerGatewayForExistingCustomers },
                ].map(({ label, desc, value, setter }) => (
                  <div key={label} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700/50">
                    <div>
                      <p className="text-white text-sm font-medium">{label}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
                    </div>
                    <button
                      onClick={() => setter(v => !v)}
                      className="flex items-center gap-1.5 text-sm font-medium transition-colors focus:outline-none"
                    >
                      {value
                        ? <><FiToggleRight className="h-6 w-6 text-green-400" /><span className="text-green-400 text-xs">On</span></>
                        : <><FiToggleLeft className="h-6 w-6 text-gray-500" /><span className="text-gray-400 text-xs">Off</span></>
                      }
                    </button>
                  </div>
                ))}
              </div>

              {/* Rate configuration */}
              <div className="pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Pricing Configuration</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-200">
                      Default Profit Multiplier
                    </label>
                    <p className="text-xs text-gray-500">Markup on raw LLM cost (e.g. 1.5 = 50% margin, 2.0 = 100% margin)</p>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={gatewayProfitMultiplier}
                        onChange={e => setGatewayProfitMultiplier(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="1.5"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">×</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-200">
                      AI Credit → USD Cents Rate
                    </label>
                    <p className="text-xs text-gray-500">How many cents customers pay per 1 AI credit (e.g. 1.0 = $0.01 per credit)</p>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={gatewayCreditToUsdCents}
                        onChange={e => setGatewayCreditToUsdCents(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="1.0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">¢</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {gwSettingsSaved && (
                  <span className="flex items-center gap-1.5 text-green-400 text-sm">
                    <FiCheck className="h-4 w-4" /> Settings saved
                  </span>
                )}
                <button
                  onClick={saveGatewaySettings}
                  disabled={gwSettingsSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {gwSettingsSaving
                    ? <><FiLoader className="h-4 w-4 animate-spin" /> Saving…</>
                    : <><FiSave className="h-4 w-4" /> Save Settings</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Disabled-state save (persist the OFF state too) */}
          {!customerGatewayEnabled && !gwSettingsLoading && (
            <div className="px-5 py-3 bg-gray-900/30 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Enable the toggle above to let customers generate their own AI Gateway keys from your whitelabel portal.
              </p>
              <button
                onClick={saveGatewaySettings}
                disabled={gwSettingsSaving}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-xs font-medium rounded-lg transition-colors ml-4 flex-shrink-0"
              >
                {gwSettingsSaving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiSave className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
          )}
        </div>

        {/* ── Collapsible: How It Works ── */}
        <div className="border border-purple-500/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800/80 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FiInfo className="h-5 w-5 text-purple-400" />
              <span className="text-white font-medium">How It Works — Credits, Models & Controls</span>
            </div>
            {showHowItWorks
              ? <FiChevronUp className="h-4 w-4 text-gray-400" />
              : <FiChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {showHowItWorks && (
            <div className="p-4 bg-gray-900/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { emoji: '💰', title: 'Knotie Credits', border: 'border-green-500/20', items: ['1 credit = 1 cent (100 credits = $1.00 USD)', 'Pre-fund keys from your credit balance', 'Real-time spend tracking per key', 'Auto top-up available to prevent interruptions'] },
                  { emoji: '🤖', title: 'Model Access', border: 'border-blue-500/20', items: ['Models available based on your subscription tier', 'GPT-4o, Claude, Gemini, and more', 'Select specific models per key', 'Admin configures model registry'] },
                  { emoji: '🛡️', title: 'Budget Controls', border: 'border-purple-500/20', items: ['Set per-key budget caps in credits', 'Keys auto-pause when budget is exhausted', 'Top up anytime from your balance', 'Free tier includes a 20% platform fee'] },
                  { emoji: '⚡', title: 'Rate Limits & Domains', border: 'border-orange-500/20', items: ['Set RPM (requests per minute) per key', 'Restrict keys to specific domains', 'Assign keys to specific customers', 'Full OpenAI API compatibility'] },
                ].map(card => (
                  <div key={card.title} className={`bg-gray-800/50 rounded-lg p-4 border ${card.border}`}>
                    <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                      <span>{card.emoji}</span> {card.title}
                    </h4>
                    <ul className="text-xs text-gray-300 space-y-1.5">
                      {card.items.map(i => <li key={i}>• {i}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </PartnerLayout>
  );
}

