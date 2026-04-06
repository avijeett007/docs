'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import ApiKeyManager from '@/components/partner/ApiKeyManager';
import AiGatewayKeyManager from '@/components/partner/AiGatewayKeyManager';
import McpTokenModal from '@/components/partner/McpTokenModal';
import N8nTokenModal from '@/components/partner/N8nTokenModal';
import NeonContainer from '@/components/NeonContainer';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FiKey, FiInfo, FiAlertCircle, FiCode, FiLock, FiRefreshCw, FiUsers, FiCpu, FiSettings, FiZap, FiDownload, FiShield, FiCopy, FiCheck, FiChevronDown, FiChevronUp, FiTool, FiGitBranch } from 'react-icons/fi';

// Note: Metadata can't be exported from a client component
// The page title will be set by the browser based on the h1 content

// ─── Code Snippet Data ──────────────────────────────────────────────────────

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

const MCP_SNIPPETS = {
  curl_headers: `curl -X GET https://analytics.knotie-ai.pro/mcp/customers \\
  -H "X-API-Key: your_api_key_here" \\
  -H "X-Partner-Email: your_email@example.com"`,

  curl_auth: `curl -X GET https://analytics.knotie-ai.pro/mcp/customers \\
  -H "Authorization: Basic your_base64_auth_token"`,

  create_customer: `curl -X POST https://analytics.knotie-ai.pro/mcp/customers \\
  -H "Authorization: Basic your_base64_auth_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "enablePortalAccess": true
  }'`,
};

export default function ApiKeysPage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('Partner');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [showMcpDocs, setShowMcpDocs] = useState(false);
  const [showGatewayDocs, setShowGatewayDocs] = useState(false);
  const [snippetTab, setSnippetTab] = useState<'python' | 'nodejs' | 'curl'>('python');
  const [mcpSnippetTab, setMcpSnippetTab] = useState<'headers' | 'auth' | 'create'>('headers');
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [showN8nModal, setShowN8nModal] = useState(false);
  const [showMcpQuickRef, setShowMcpQuickRef] = useState(false);
  const [showN8nQuickRef, setShowN8nQuickRef] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('partner_token');
        if (!token) {
          router.push('/partner/login');
          return;
        }

        // Verify token with the server
        const response = await fetch('/api/partner/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
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
      } catch (error) {
        console.error('Authentication error:', error);
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

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  // ─── Reusable Code Block Component ─────────────────────────────────────────
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

  // ─── Collapsible Section Component ────────────────────────────────────────
  const CollapsibleSection = ({ title, icon, isOpen, onToggle, children, borderColor = 'border-gray-700' }: {
    title: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; children: React.ReactNode; borderColor?: string;
  }) => (
    <div className={`border ${borderColor} rounded-lg overflow-hidden`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800/80 transition-colors text-left">
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-white font-medium">{title}</span>
        </div>
        {isOpen ? <FiChevronUp className="h-4 w-4 text-gray-400" /> : <FiChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {isOpen && <div className="p-4 bg-gray-900/50">{children}</div>}
    </div>
  );

  // ─── Snippet Tab Button ───────────────────────────────────────────────────
  const SnippetTabBtn = ({ label, active, onClick }: { label: string; value?: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <Head>
        <title>API Keys & Integrations | Knotie AI Pro</title>
        <meta name="description" content="Manage API keys and AI Gateway for Knotie AI Pro" />
      </Head>
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="mb-2">
            <nav className="flex mb-4">
              <a href="/partner/dashboard" className="text-blue-400 hover:text-blue-300">Dashboard</a>
              <span className="mx-2 text-gray-500">/</span>
              <a href="/partner/settings" className="text-blue-400 hover:text-blue-300">Settings</a>
              <span className="mx-2 text-gray-500">/</span>
              <span className="text-gray-300">API Keys & Integrations</span>
            </nav>
            <h1 className="text-3xl font-bold text-white">API Keys & Integrations</h1>
            <p className="text-gray-400 mt-1">
              Manage platform API keys for automation and AI Gateway keys for LLM access.
            </p>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* Main Tabs                                                          */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <Tabs defaultValue="gateway" className="space-y-6">
            <TabsList className="bg-gray-800/80 border border-gray-700 p-1 h-auto">
              <TabsTrigger value="gateway" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white text-gray-300 px-4 py-2 gap-2">
                <FiCpu className="h-4 w-4" />
                AI Gateway
                <span className="ml-1 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full leading-none">Beta</span>
              </TabsTrigger>
              <TabsTrigger value="platform" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-300 px-4 py-2 gap-2">
                <FiKey className="h-4 w-4" />
                Platform API
              </TabsTrigger>
              <TabsTrigger value="mcp" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-gray-300 px-4 py-2 gap-2">
                <FiTool className="h-4 w-4" />
                MCP Tokens
              </TabsTrigger>
              <TabsTrigger value="n8n" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white text-gray-300 px-4 py-2 gap-2">
                <FiGitBranch className="h-4 w-4" />
                n8n Tokens
              </TabsTrigger>
            </TabsList>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* TAB 1: AI Gateway                                              */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <TabsContent value="gateway" className="space-y-6">
              {/* Hero Banner */}
              <div className="relative overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-900/30 via-gray-900 to-blue-900/30 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">OpenAI Compatible</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">🧪 Experimental Beta</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">AI Gateway</h2>
                  <p className="text-gray-300 text-sm max-w-2xl leading-relaxed">
                    Create metered LLM API keys for your customers. Use the standard OpenAI SDK — just change the <code className="text-purple-300 bg-purple-500/10 px-1 rounded">base_url</code> to <code className="text-purple-300 bg-purple-500/10 px-1 rounded">https://api.knotie.ai</code>. Budget controls, model access, and rate limits are built in.
                  </p>
                </div>
              </div>

              {/* Quick Start Code Snippets */}
              <div className="border border-purple-500/20 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-gray-700">
                  <h3 className="text-white font-medium text-sm flex items-center gap-2">
                    <FiCode className="h-4 w-4 text-purple-400" />
                    Quick Start — Use with OpenAI SDK
                  </h3>
                  <div className="flex gap-1">
                    <SnippetTabBtn label="Python" value="python" active={snippetTab === 'python'} onClick={() => setSnippetTab('python')} />
                    <SnippetTabBtn label="Node.js" value="nodejs" active={snippetTab === 'nodejs'} onClick={() => setSnippetTab('nodejs')} />
                    <SnippetTabBtn label="cURL" value="curl" active={snippetTab === 'curl'} onClick={() => setSnippetTab('curl')} />
                  </div>
                </div>
                <div className="p-4 bg-gray-900/50">
                  {snippetTab === 'python' && <CodeBlock code={AI_GATEWAY_SNIPPETS.python} id="gw-python" language="python" />}
                  {snippetTab === 'nodejs' && <CodeBlock code={AI_GATEWAY_SNIPPETS.nodejs} id="gw-nodejs" language="javascript" />}
                  {snippetTab === 'curl' && <CodeBlock code={AI_GATEWAY_SNIPPETS.curl} id="gw-curl" language="bash" />}
                  <p className="text-xs text-gray-500 mt-3">
                    Replace <code className="text-purple-400">sk-your-gateway-key</code> with a virtual key created below. Any model enabled for your tier can be used.
                  </p>
                </div>
              </div>

              {/* AI Gateway Key Manager */}
              <NeonContainer>
                <div className="p-6">
                  <AiGatewayKeyManager />
                </div>
              </NeonContainer>

              {/* Collapsible: How It Works */}
              <CollapsibleSection
                title="How It Works — Credits, Models & Controls"
                icon={<FiInfo className="h-5 w-5 text-purple-400" />}
                isOpen={showGatewayDocs}
                onToggle={() => setShowGatewayDocs(!showGatewayDocs)}
                borderColor="border-purple-500/20"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-green-500/20">
                    <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                      <span className="text-green-400">💰</span> Knotie Credits
                    </h4>
                    <ul className="text-xs text-gray-300 space-y-1.5">
                      <li>• <strong className="text-white">1 credit = 1 cent</strong> (100 credits = $1.00 USD)</li>
                      <li>• Pre-fund keys from your credit balance</li>
                      <li>• Real-time spend tracking per key</li>
                      <li>• Auto top-up available to prevent interruptions</li>
                    </ul>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-blue-500/20">
                    <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                      <span className="text-blue-400">🤖</span> Model Access
                    </h4>
                    <ul className="text-xs text-gray-300 space-y-1.5">
                      <li>• Models available based on your subscription tier</li>
                      <li>• GPT-4o, Claude, Gemini, and more</li>
                      <li>• Select specific models per key</li>
                      <li>• Admin configures model registry</li>
                    </ul>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-purple-500/20">
                    <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                      <span className="text-purple-400">🛡️</span> Budget Controls
                    </h4>
                    <ul className="text-xs text-gray-300 space-y-1.5">
                      <li>• Set per-key budget caps in credits</li>
                      <li>• Keys auto-pause when budget is exhausted</li>
                      <li>• Top up anytime from your balance</li>
                      <li>• Free tier includes a 20% platform fee</li>
                    </ul>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-orange-500/20">
                    <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                      <span className="text-orange-400">⚡</span> Rate Limits & Domains
                    </h4>
                    <ul className="text-xs text-gray-300 space-y-1.5">
                      <li>• Set RPM (requests per minute) per key</li>
                      <li>• Restrict keys to specific domains</li>
                      <li>• Assign keys to specific customers</li>
                      <li>• Full OpenAI API compatibility</li>
                    </ul>
                  </div>
                </div>
              </CollapsibleSection>
            </TabsContent>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* TAB 2: Platform API Keys                                       */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <TabsContent value="platform" className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg shrink-0"><FiKey className="h-5 w-5 text-blue-400" /></div>
                  <div>
                    <h3 className="text-white font-medium text-sm">Secure Authentication</h3>
                    <p className="text-xs text-gray-400 mt-1">API keys for programmatic access to your Knotie account and MCP endpoints.</p>
                  </div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-start gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg shrink-0"><FiLock className="h-5 w-5 text-green-400" /></div>
                  <div>
                    <h3 className="text-white font-medium text-sm">IP Restrictions</h3>
                    <p className="text-xs text-gray-400 mt-1">Lock keys to trusted IPs and monitor usage for enhanced security.</p>
                  </div>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg shrink-0"><FiRefreshCw className="h-5 w-5 text-purple-400" /></div>
                  <div>
                    <h3 className="text-white font-medium text-sm">Key Rotation</h3>
                    <p className="text-xs text-gray-400 mt-1">Rotate keys periodically. Revoke compromised keys instantly.</p>
                  </div>
                </div>
              </div>

              {/* API Key Manager */}
              <NeonContainer>
                <div className="p-6">
                  <div className="flex items-center mb-6">
                    <div className="p-2 bg-blue-500/20 rounded-lg mr-3"><FiKey className="h-5 w-5 text-blue-500" /></div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Your Platform API Keys</h2>
                      <p className="text-gray-400 mt-0.5 text-sm">Create and manage API keys for MCP and platform integrations</p>
                    </div>
                  </div>
                  <ApiKeyManager />
                </div>
              </NeonContainer>

              {/* Collapsible: Security Tips */}
              <CollapsibleSection
                title="Security Best Practices"
                icon={<FiAlertCircle className="h-5 w-5 text-amber-400" />}
                isOpen={showSecurityInfo}
                onToggle={() => setShowSecurityInfo(!showSecurityInfo)}
                borderColor="border-amber-500/20"
              >
                <ul className="list-disc list-inside text-gray-300 space-y-2 text-sm pl-2">
                  <li>Store API keys in environment variables — never in client-side code.</li>
                  <li>Rotate keys periodically and revoke unused ones immediately.</li>
                  <li>Use IP restrictions to limit access to trusted servers only.</li>
                  <li>Monitor API key usage regularly for suspicious activity.</li>
                  <li>Use the Authorization header method for MCP tool integrations.</li>
                </ul>
              </CollapsibleSection>

              {/* Collapsible: MCP Documentation */}
              <CollapsibleSection
                title="MCP API Documentation & Code Examples"
                icon={<FiCode className="h-5 w-5 text-blue-400" />}
                isOpen={showMcpDocs}
                onToggle={() => setShowMcpDocs(!showMcpDocs)}
                borderColor="border-blue-500/20"
              >
                <div className="space-y-6">
                  {/* What is MCP */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
                    <h3 className="text-white font-semibold mb-2 flex items-center">
                      <FiZap className="mr-2 h-4 w-4 text-blue-400" />
                      Model Context Protocol (MCP) API
                    </h3>
                    <p className="text-blue-100/90 text-sm leading-relaxed">
                      Automate customer creation, agent management, and portal access. Integrate with Claude, N8N, ChatGPT, and other AI platforms.
                    </p>
                    <div className="text-sm text-blue-200 bg-blue-500/10 rounded px-3 py-2 mt-3 font-mono">
                      Base URL: https://analytics.knotie-ai.pro/mcp/
                    </div>
                  </div>

                  {/* Capabilities Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { icon: <FiUsers className="h-4 w-4 text-green-400" />, title: 'Customers', items: ['Create customers', 'Portal access', 'Reset passwords'], border: 'border-green-500/20' },
                      { icon: <FiCpu className="h-4 w-4 text-blue-400" />, title: 'Agents', items: ['Map to customers', 'Profit multipliers', 'Multi-platform'], border: 'border-blue-500/20' },
                      { icon: <FiSettings className="h-4 w-4 text-purple-400" />, title: 'Features', items: ['Portal config', 'Team limits', 'Analytics'], border: 'border-purple-500/20' },
                      { icon: <FiCode className="h-4 w-4 text-orange-400" />, title: 'Real-time', items: ['SSE events', 'Live updates', 'Heartbeat'], border: 'border-orange-500/20' },
                    ].map(cap => (
                      <div key={cap.title} className={`bg-gray-800/50 rounded-lg p-3 border ${cap.border}`}>
                        <div className="flex items-center gap-2 mb-2">{cap.icon}<span className="text-white text-xs font-medium">{cap.title}</span></div>
                        <ul className="text-[11px] text-gray-400 space-y-0.5">{cap.items.map(i => <li key={i}>• {i}</li>)}</ul>
                      </div>
                    ))}
                  </div>

                  {/* Authentication Methods */}
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2"><FiShield className="h-4 w-4 text-green-400" /> Authentication</h4>
                    <div className="flex gap-2 mb-3">
                      <SnippetTabBtn label="Header Auth" value="headers" active={mcpSnippetTab === 'headers'} onClick={() => setMcpSnippetTab('headers')} />
                      <SnippetTabBtn label="Basic Auth" value="auth" active={mcpSnippetTab === 'auth'} onClick={() => setMcpSnippetTab('auth')} />
                      <SnippetTabBtn label="Create Customer" value="create" active={mcpSnippetTab === 'create'} onClick={() => setMcpSnippetTab('create')} />
                    </div>
                    {mcpSnippetTab === 'headers' && <CodeBlock code={MCP_SNIPPETS.curl_headers} id="mcp-headers" language="bash" />}
                    {mcpSnippetTab === 'auth' && <CodeBlock code={MCP_SNIPPETS.curl_auth} id="mcp-auth" language="bash" />}
                    {mcpSnippetTab === 'create' && <CodeBlock code={MCP_SNIPPETS.create_customer} id="mcp-create" language="bash" />}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mt-3">
                      <p className="text-xs text-blue-300">
                        <strong>💡 Tip:</strong> When you create a Platform API key above, the Authorization header is auto-generated for you.
                      </p>
                    </div>
                  </div>

                  {/* Doc Links */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { href: '/docs/quickstart', icon: <FiZap className="h-4 w-4 text-blue-400" />, title: 'Quick Start', desc: 'Get running in minutes' },
                      { href: '/docs/api-reference', icon: <FiCode className="h-4 w-4 text-blue-400" />, title: 'API Reference', desc: 'Full endpoint docs' },
                      { href: '/docs/postman-collection', icon: <FiDownload className="h-4 w-4 text-blue-400" />, title: 'Postman Collection', desc: 'Ready-to-use collection' },
                    ].map(link => (
                      <a key={link.href} href={link.href} className="block p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/80 transition-colors border border-blue-500/20 hover:border-blue-500/40">
                        <h4 className="text-white font-medium text-sm flex items-center gap-2">{link.icon}{link.title}</h4>
                        <p className="text-xs text-gray-400 mt-1">{link.desc}</p>
                      </a>
                    ))}
                  </div>
                </div>
              </CollapsibleSection>
            </TabsContent>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* TAB 3: MCP Tokens                                              */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <TabsContent value="mcp" className="space-y-6">
              {/* Hero Banner */}
              <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    <FiTool className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">MCP Tokens</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Model Context Protocol (MCP) tokens provide secure access to 100+ integrated tools through a
                      standardized JSON-RPC 2.0 interface. Use these tokens to connect your AI agents to external
                      tools and data sources.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-full">
                        <FiShield className="h-3 w-3" /> Scoped Permissions
                      </div>
                      <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-full">
                        <FiUsers className="h-3 w-3" /> Customer Assignment
                      </div>
                      <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-full">
                        <FiSettings className="h-3 w-3" /> Tool Selection
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manage Tokens Button */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium mb-1">Manage MCP Tokens</h4>
                    <p className="text-gray-400 text-sm">Create, view, and revoke MCP tokens for your AI agents and customers.</p>
                  </div>
                  <button
                    onClick={() => setShowMcpModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-500/20"
                  >
                    <FiTool className="h-4 w-4" />
                    Open Token Manager
                  </button>
                </div>
              </div>

              {/* Quick Reference */}
              <CollapsibleSection
                title="Quick Reference"
                icon={<FiCode className="h-5 w-5 text-purple-400" />}
                isOpen={showMcpQuickRef}
                onToggle={() => setShowMcpQuickRef(!showMcpQuickRef)}
                borderColor="border-purple-500/20"
              >
                <div className="space-y-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-purple-300 mb-2">Bearer Token Authentication</h5>
                    <div className="relative">
                      <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto font-mono">
{`curl -X POST https://your-domain.com/api/mcp \\
  -H "Authorization: Bearer mcp_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(`curl -X POST https://your-domain.com/api/mcp \\\n  -H "Authorization: Bearer mcp_your_token_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`, 'mcp-curl')}
                        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors"
                      >
                        {copiedSnippet === 'mcp-curl' ? <FiCheck className="h-3.5 w-3.5 text-green-400" /> : <FiCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-purple-300 mb-2">Key Features</h5>
                    <ul className="text-sm text-gray-400 space-y-2">
                      <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">•</span> Assign tokens to specific customers for isolated tool access</li>
                      <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">•</span> Select specific tools per token — restrict access to only what&apos;s needed</li>
                      <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">•</span> Set usage limits and expiration dates for security</li>
                      <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">•</span> Revoke tokens instantly if compromised</li>
                    </ul>
                  </div>
                </div>
              </CollapsibleSection>
            </TabsContent>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* TAB 4: n8n Tokens                                              */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <TabsContent value="n8n" className="space-y-6">
              {/* Hero Banner */}
              <div className="bg-gradient-to-r from-orange-900/40 to-amber-900/40 border border-orange-500/30 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-500/20 rounded-lg">
                    <FiGitBranch className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">n8n Workflow Tokens</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      n8n tokens enable your AI agents to trigger and interact with n8n workflow automations.
                      Create tokens to securely connect your agents to custom workflows for data processing,
                      integrations, and business automation.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/10 px-3 py-1.5 rounded-full">
                        <FiZap className="h-3 w-3" /> Workflow Automation
                      </div>
                      <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/10 px-3 py-1.5 rounded-full">
                        <FiUsers className="h-3 w-3" /> Customer Assignment
                      </div>
                      <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/10 px-3 py-1.5 rounded-full">
                        <FiLock className="h-3 w-3" /> Secure Access
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manage Tokens Button */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium mb-1">Manage n8n Tokens</h4>
                    <p className="text-gray-400 text-sm">Create, view, and revoke n8n workflow tokens for your AI agents and customers.</p>
                  </div>
                  <button
                    onClick={() => setShowN8nModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    <FiGitBranch className="h-4 w-4" />
                    Open Token Manager
                  </button>
                </div>
              </div>

              {/* Quick Reference */}
              <CollapsibleSection
                title="Quick Reference"
                icon={<FiCode className="h-5 w-5 text-orange-400" />}
                isOpen={showN8nQuickRef}
                onToggle={() => setShowN8nQuickRef(!showN8nQuickRef)}
                borderColor="border-orange-500/20"
              >
                <div className="space-y-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-orange-300 mb-2">Webhook Authentication</h5>
                    <div className="relative">
                      <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto font-mono">
{`curl -X POST https://your-n8n-instance.com/webhook/your-workflow \\
  -H "Authorization: Bearer n8n_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"trigger","data":{"key":"value"}}'`}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(`curl -X POST https://your-n8n-instance.com/webhook/your-workflow \\\n  -H "Authorization: Bearer n8n_your_token_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"trigger","data":{"key":"value"}}'`, 'n8n-curl')}
                        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors"
                      >
                        {copiedSnippet === 'n8n-curl' ? <FiCheck className="h-3.5 w-3.5 text-green-400" /> : <FiCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-orange-300 mb-2">Key Features</h5>
                    <ul className="text-sm text-gray-400 space-y-2">
                      <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span> Connect AI agents to n8n workflows for automated task execution</li>
                      <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span> Assign tokens to specific customers for isolated workflow access</li>
                      <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span> Configure webhook URLs and workflow IDs per token</li>
                      <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">•</span> Revoke tokens instantly if compromised</li>
                    </ul>
                  </div>
                </div>
              </CollapsibleSection>
            </TabsContent>

          </Tabs>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* Modals                                                             */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <McpTokenModal
            isOpen={showMcpModal}
            onClose={() => setShowMcpModal(false)}
            onTokenCreated={() => {}}
          />
          <N8nTokenModal
            isOpen={showN8nModal}
            onClose={() => setShowN8nModal(false)}
          />

        </div>
      </PartnerLayout>
    </>
  );
}
