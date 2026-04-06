'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Users,
  Cpu,
  Settings,
  BarChart3,
  Shield,
  // Globe, // Unused
  Menu,
  X,
  Link2
} from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { FaGithub, FaYoutube, FaTwitter } from 'react-icons/fa';

const APIReferencePage = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState('capabilities');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [animationPosition, setAnimationPosition] = useState({ x: 0, y: 0 });
  const [focusIntensity, setFocusIntensity] = useState(1);

  // Enhanced background animation effect
  useEffect(() => {
    const positionInterval = setInterval(() => {
      setAnimationPosition({
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
      });
    }, 3000);

    const intensityInterval = setInterval(() => {
      setFocusIntensity(prev => prev === 1 ? 1.2 : 1);
    }, 2000);

    return () => {
      clearInterval(positionInterval);
      clearInterval(intensityInterval);
    };
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Function to render social icons
  const renderSocialIcons = () => {
    const socialLinks = [
      { icon: FaGithub, url: 'https://github.com', hoverColor: 'white' },
      { icon: FaYoutube, url: 'https://youtube.com', hoverColor: 'red-500' },
      { icon: FaTwitter, url: 'https://twitter.com', hoverColor: 'blue-400' }
    ];

    return socialLinks.map((item, index) => {
      const IconComponent = item.icon;
      return (
        <a
          key={index}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-gray-400 hover:text-${item.hoverColor} transition-colors duration-200`}
        >
          <IconComponent size={20} />
        </a>
      );
    });
  };

  const endpoints = [
    {
      id: 'capabilities',
      category: 'Authentication',
      icon: <Shield className="w-5 h-5" />,
      method: 'GET',
      path: '/mcp/capabilities',
      title: 'Get Capabilities',
      description: 'Retrieve available MCP capabilities and partner information',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true }
      ],
      response: {
        "partner_id": "uuid",
        "partner_name": "Your Business Name",
        "partner_email": "your@email.com",
        "capabilities": [
          {
            "name": "create_customer",
            "description": "Create new customers",
            "endpoint": "/mcp/customers"
          }
        ],
        "total_capabilities": 6,
        "last_updated": "2024-01-01T00:00:00Z"
      }
    },
    {
      id: 'create-customer',
      category: 'Customer Management',
      icon: <Users className="w-5 h-5" />,
      method: 'POST',
      path: '/mcp/customers',
      title: 'Create Customer',
      description: 'Create a new customer for your partner account',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "email": "customer@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "company_name": "Acme Corp"
      },
      response: {
        "success": true,
        "customer_id": "uuid",
        "email": "customer@example.com",
        "message": "Customer created successfully"
      }
    },
    {
      id: 'enable-portal',
      category: 'Customer Management',
      icon: <Users className="w-5 h-5" />,
      method: 'POST',
      path: '/mcp/customers/portal-access',
      title: 'Enable Portal Access',
      description: 'Enable customer portal access with auto-generated credentials',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "customer_id": "uuid",
        "send_email": false
      },
      response: {
        "success": true,
        "email": "customer@example.com",
        "portal_url": "https://subdomain.knotie-ai.pro",
        "password": "auto-generated-password",
        "message": "Portal access enabled successfully"
      }
    },
    {
      id: 'reset-password',
      category: 'Customer Management',
      icon: <Users className="w-5 h-5" />,
      method: 'POST',
      path: '/mcp/customers/reset-password',
      title: 'Reset Password',
      description: 'Reset customer portal password',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "customer_id": "uuid",
        "send_email": false
      },
      response: {
        "success": true,
        "new_password": "new-auto-generated-password",
        "message": "Password reset successfully"
      }
    },
    {
      id: 'map-agent',
      category: 'Agent Management',
      icon: <Cpu className="w-5 h-5" />,
      method: 'POST',
      path: '/mcp/agents/map',
      title: 'Map Agent to Customer',
      description: 'Assign an AI agent to a customer with custom profit multiplier',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "agent_id": "agent_12345",
        "customer_id": "uuid",
        "agent_type": "retell",
        "profit_multiplier": 1.5
      },
      response: {
        "success": true,
        "message": "Agent agent_12345 mapped to customer successfully"
      }
    },
    {
      id: 'unmap-agent',
      category: 'Agent Management',
      icon: <Cpu className="w-5 h-5" />,
      method: 'DELETE',
      path: '/mcp/agents/{agent_id}/mapping',
      title: 'Unmap Agent',
      description: 'Remove agent assignment from customer',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true }
      ],
      params: [
        { name: 'agent_type', value: 'retell', required: true }
      ],
      response: {
        "success": true,
        "message": "Agent agent_12345 unmapped successfully"
      }
    },
    {
      id: 'update-features',
      category: 'Feature Management',
      icon: <Settings className="w-5 h-5" />,
      method: 'PUT',
      path: '/mcp/customers/features',
      title: 'Update Customer Features',
      description: 'Configure customer portal features and permissions',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "customer_id": "uuid",
        "features": {
          "enableAdvancedAnalytics": true,
          "enableDetailedCallAnalysis": false,
          "enableActionPointAnalysis": true,
          "enableApiAccess": true,
          "showKnowledgeBase": false,
          "showIntegration": true,
          "showDocsAndMedia": false,
          "showScheduleMeeting": true,
          "showApiKeys": true,
          "showPricingInformation": false,
          "enableTeamMembers": true,
          "maxTeamMembers": 5
        }
      },
      response: {
        "success": true,
        "message": "Customer features updated successfully"
      }
    },
    {
      id: 'sse-stream',
      category: 'Real-time',
      icon: <BarChart3 className="w-5 h-5" />,
      method: 'GET',
      path: '/mcp/stream',
      title: 'SSE Stream',
      description: 'Server-Sent Events stream for real-time capability updates',
      headers: [
        { name: 'X-API-Key', value: 'pkt_your_api_key', required: true },
        { name: 'X-Partner-Email', value: 'your@email.com', required: true },
        { name: 'Accept', value: 'text/event-stream', required: true }
      ],
      response: {
        "type": "heartbeat",
        "timestamp": "2024-01-01T00:00:00Z",
        "partner_id": "uuid",
        "status": "connected"
      }
    },
    // MCP Integration Endpoints (all methods use unified /api/mcp endpoint)
    {
      id: 'mcp',
      category: 'MCP Integration',
      icon: <Link2 className="w-5 h-5" />,
      method: 'POST',
      path: 'https://mcp.knotie-ai.pro/api/mcp',
      title: 'MCP Initialize',
      description: 'Initialize MCP session and receive server capabilities (JSON-RPC 2.0). All MCP methods use this single endpoint.',
      headers: [
        { name: 'Authorization', value: 'Bearer YOUR_MCP_TOKEN', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
          "protocolVersion": "2024-11-05",
          "capabilities": {},
          "clientInfo": {
            "name": "your-client",
            "version": "1.0.0"
          }
        },
        "id": 1
      },
      response: {
        "jsonrpc": "2.0",
        "result": {
          "protocolVersion": "2024-11-05",
          "serverInfo": {
            "name": "knotie-mcp-server",
            "version": "1.0.0"
          },
          "capabilities": {
            "tools": {}
          }
        },
        "id": 1
      }
    },
    {
      id: 'mcp-initialized',
      category: 'MCP Integration',
      icon: <Link2 className="w-5 h-5" />,
      method: 'POST',
      path: 'https://mcp.knotie-ai.pro/api/mcp',
      title: 'MCP Initialized Notification',
      description: 'Client notification sent after receiving InitializeResult (JSON-RPC 2.0 notification). This has NO id field and receives 202 Accepted response.',
      headers: [
        { name: 'Authorization', value: 'Bearer YOUR_MCP_TOKEN', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
      },
      response: "202 Accepted (no response body)"
    },
    {
      id: 'mcp-tools-list',
      category: 'MCP Integration',
      icon: <Link2 className="w-5 h-5" />,
      method: 'POST',
      path: 'https://mcp.knotie-ai.pro/api/mcp',
      title: 'MCP List Tools',
      description: 'List all available tools for the customer (JSON-RPC 2.0). Uses the unified MCP endpoint.',
      headers: [
        { name: 'Authorization', value: 'Bearer YOUR_MCP_TOKEN', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "jsonrpc": "2.0",
        "method": "tools/list",
        "params": {},
        "id": 2
      },
      response: {
        "jsonrpc": "2.0",
        "result": {
          "tools": [
            {
              "name": "gmail_send_email",
              "description": "Send an email via Gmail",
              "inputSchema": {
                "type": "object",
                "properties": {
                  "to": { "type": "string" },
                  "subject": { "type": "string" },
                  "body": { "type": "string" }
                },
                "required": ["to", "subject", "body"]
              }
            }
          ]
        },
        "id": 2
      }
    },
    {
      id: 'mcp-tools-call',
      category: 'MCP Integration',
      icon: <Link2 className="w-5 h-5" />,
      method: 'POST',
      path: 'https://mcp.knotie-ai.pro/api/mcp',
      title: 'MCP Call Tool',
      description: 'Execute a tool with the specified parameters (JSON-RPC 2.0). Each call consumes 0.03 AI credits. Uses the unified MCP endpoint.',
      headers: [
        { name: 'Authorization', value: 'Bearer YOUR_MCP_TOKEN', required: true },
        { name: 'Content-Type', value: 'application/json', required: true }
      ],
      body: {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
          "name": "gmail_send_email",
          "arguments": {
            "to": "recipient@example.com",
            "subject": "Hello from MCP",
            "body": "This email was sent via MCP integration."
          }
        },
        "id": 3
      },
      response: {
        "jsonrpc": "2.0",
        "result": {
          "content": [
            {
              "type": "text",
              "text": "Email sent successfully to recipient@example.com"
            }
          ]
        },
        "id": 3
      }
    }
  ];

  const categories = [...new Set(endpoints.map(e => e.category))];

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'POST': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'PUT': return 'bg-yellow-500/20 text-amber-400 border border-yellow-500/30';
      case 'DELETE': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const activeEndpointData = endpoints.find(e => e.id === activeEndpoint);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-900 to-black overflow-hidden flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-blue-400/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Logo />

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center justify-center flex-1 space-x-8">
              <Link href="/" className="text-gray-300 hover:text-white transition-colors duration-200">
                Home
              </Link>
              <Link href="/docs" className="text-gray-300 hover:text-white transition-colors duration-200">
                API Docs
              </Link>
              <Link href="/docs/api-reference" className="text-white font-medium">
                API Reference
              </Link>
              <Link href="/partner/tutorials" className="text-gray-300 hover:text-white transition-colors duration-200">
                Tutorials
              </Link>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-4">
                {renderSocialIcons()}
                <Link
                  href="/partner/login"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 transition-all duration-300"
                >
                  Partner Login
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden text-gray-300 hover:text-white"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4">
              <div className="flex flex-col space-y-4">
                <Link href="/" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Home
                </Link>
                <Link href="/docs" className="text-gray-300 hover:text-white transition-colors duration-200">
                  API Documentation
                </Link>
                <Link href="/docs/api-reference" className="text-white font-medium">
                  API Reference
                </Link>
                <Link href="/partner/tutorials" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Tutorials
                </Link>
                <Link
                  href="/partner/login"
                  className="block w-full px-3 py-2 rounded-md text-base font-medium bg-gradient-to-r from-blue-500 to-teal-500 text-white hover:from-blue-600 hover:to-teal-600 text-center"
                >
                  Partner Login
                </Link>
                <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
                  {renderSocialIcons()}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Enhanced background animation effect */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                     w-[1200px] h-[1200px]
                     bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,rgba(147,51,234,0.1)_25%,rgba(20,184,166,0.1)_50%,transparent_100%)]
                     rounded-full blur-[130px]
                     transition-all duration-1500 ease-in-out opacity-60"
          style={{
            transform: `translate(calc(-50% + ${animationPosition.x}px), calc(-50% + ${animationPosition.y}px)) scale(${focusIntensity})`,
          }}
        />

        {/* Additional ambient light */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.1) 0%, transparent 50%)',
            animation: 'pulse 8s infinite'
          }}
        />
      </div>

      {/* Enhanced floating particles effect */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${20 + Math.random() * 15}s`,
              opacity: 0.3 + Math.random() * 0.7,
              transform: `scale(${0.5 + Math.random()})`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header Section */}
        <div className="container mx-auto px-4 pt-12 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center space-x-4 mb-8">
              <Link
                href="/docs"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                  API Reference
                </h1>
                <p className="mt-2 text-xl text-blue-100/80">
                  Complete reference for Knotie AI Pro MCP API endpoints
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="container mx-auto px-4 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-md rounded-lg border border-blue-500/20 p-8 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Shield className="w-6 h-6 mr-3 text-blue-400" />
                Authentication
              </h2>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Method 1: Headers */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Method 1: Header-based Authentication</h3>
                  <p className="text-gray-300 mb-4">Use separate headers for API key and partner email:</p>
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                    <div className="text-blue-300">X-API-Key: <span className="text-green-300">pkt_your_api_key</span></div>
                    <div className="text-blue-300">X-Partner-Email: <span className="text-green-300">your@email.com</span></div>
                    <div className="text-blue-300">Content-Type: <span className="text-green-300">application/json</span></div>
                  </div>
                </div>

                {/* Method 2: Authorization Header */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Method 2: Authorization Header (Recommended)</h3>
                  <p className="text-gray-300 mb-4">Standard Authorization header compatible with MCP client tools:</p>
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                    <div className="text-blue-300">Authorization: <span className="text-green-300">Basic base64(api_key:email)</span></div>
                    <div className="text-blue-300">Content-Type: <span className="text-green-300">application/json</span></div>
                  </div>
                  <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-300">
                      <strong>💡 Tip:</strong> When you create an API key in the partner portal, we automatically generate the Authorization header for you!
                    </p>
                  </div>
                </div>
              </div>

              {/* Example */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">Example Request</h3>
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                  <div className="text-gray-400"># Using Authorization header (recommended)</div>
                  <div className="text-blue-300">curl -H <span className="text-green-300">"Authorization: Basic your_auth_token"</span> \</div>
                  <div className="text-blue-300 ml-4">-H <span className="text-green-300">"Content-Type: application/json"</span> \</div>
                  <div className="text-blue-300 ml-4"><span className="text-amber-300">https://analytics.knotie-ai.pro/mcp/capabilities</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 pb-20">
          <div className="max-w-7xl mx-auto">
            <div className="flex gap-8">
              {/* Sidebar */}
              <div className="w-80 flex-shrink-0">
                <div className="bg-gray-800/50 backdrop-blur-md rounded-lg border border-blue-500/20 p-6 sticky top-8">
                  <h3 className="font-semibold text-white mb-4">Endpoints</h3>

                  {categories.map(category => (
                    <div key={category} className="mb-6">
                      <h4 className="text-sm font-medium text-blue-300 uppercase tracking-wide mb-3">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {endpoints.filter(e => e.category === category).map(endpoint => (
                          <button
                            key={endpoint.id}
                            onClick={() => setActiveEndpoint(endpoint.id)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              activeEndpoint === endpoint.id
                                ? 'bg-blue-500/20 border border-blue-500/40'
                                : 'hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`text-xs px-2 py-1 rounded font-medium ${getMethodColor(endpoint.method)}`}>
                                {endpoint.method}
                              </div>
                              <div className="text-blue-400">
                                {endpoint.icon}
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="font-medium text-white text-sm">
                                {endpoint.title}
                              </div>
                              <div className="text-xs text-gray-400 font-mono">
                                {endpoint.path}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1">
                {activeEndpointData && (
                  <motion.div
                    key={activeEndpoint}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-800/50 backdrop-blur-md rounded-lg border border-blue-500/20 p-8"
                  >
                    {/* Endpoint Header */}
                    <div className="mb-8">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className={`px-3 py-1 rounded font-medium ${getMethodColor(activeEndpointData.method)}`}>
                          {activeEndpointData.method}
                        </div>
                        <code className="bg-gray-700/50 px-3 py-1 rounded font-mono text-sm text-blue-300">
                          https://analytics.knotie-ai.pro{activeEndpointData.path}
                        </code>
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {activeEndpointData.title}
                      </h2>
                      <p className="text-blue-100/80">
                        {activeEndpointData.description}
                      </p>
                    </div>

                    {/* Headers */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-white mb-4">Headers</h3>
                      <div className="bg-gray-700/30 rounded-lg p-4">
                        {activeEndpointData.headers.map((header, index) => (
                          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-600/30 last:border-b-0">
                            <div className="flex items-center space-x-2">
                              <code className="text-sm font-mono text-blue-400">{header.name}</code>
                              {header.required && (
                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30">Required</span>
                              )}
                            </div>
                            <code className="text-sm text-gray-300">{header.value}</code>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Query Parameters */}
                    {activeEndpointData.params && (
                      <div className="mb-8">
                        <h3 className="text-lg font-semibold text-white mb-4">Query Parameters</h3>
                        <div className="bg-gray-700/30 rounded-lg p-4">
                          {activeEndpointData.params.map((param, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-600/30 last:border-b-0">
                              <div className="flex items-center space-x-2">
                                <code className="text-sm font-mono text-blue-400">{param.name}</code>
                                {param.required && (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30">Required</span>
                                )}
                              </div>
                              <code className="text-sm text-gray-300">{param.value}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Request Body */}
                    {activeEndpointData.body && (
                      <div className="mb-8">
                        <h3 className="text-lg font-semibold text-white mb-4">Request Body</h3>
                        <div className="bg-gray-900 rounded-lg p-4 relative">
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(activeEndpointData.body, null, 2), `body-${activeEndpoint}`)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-white"
                          >
                            {copiedCode === `body-${activeEndpoint}` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <pre className="text-green-400 text-sm overflow-x-auto">
                            {JSON.stringify(activeEndpointData.body, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Response */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-white mb-4">Response</h3>
                      <div className="bg-gray-900 rounded-lg p-4 relative">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(activeEndpointData.response, null, 2), `response-${activeEndpoint}`)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        >
                          {copiedCode === `response-${activeEndpoint}` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <pre className="text-green-400 text-sm overflow-x-auto">
                          {JSON.stringify(activeEndpointData.response, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* cURL Examples */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">cURL Examples</h3>

                      {/* Headers Method */}
                      <div className="mb-6">
                        <h4 className="text-md font-medium text-blue-300 mb-3">Using Headers (Traditional)</h4>
                        <div className="bg-gray-900 rounded-lg p-4 relative">
                          <button
                            onClick={() => {
                              const curlCommand = `curl -X ${activeEndpointData.method} \\
  ${activeEndpointData.headers.map(h => `-H "${h.name}: ${h.value}"`).join(' \\\n  ')} \\
  ${activeEndpointData.body ? `-d '${JSON.stringify(activeEndpointData.body)}' \\` : ''}
  https://analytics.knotie-ai.pro${activeEndpointData.path}${activeEndpointData.params ? `?${activeEndpointData.params.map(p => `${p.name}=${p.value}`).join('&')}` : ''}`;
                              copyToClipboard(curlCommand, `curl-headers-${activeEndpoint}`);
                            }}
                            className="absolute top-2 right-2 text-gray-400 hover:text-white"
                          >
                            {copiedCode === `curl-headers-${activeEndpoint}` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X ${activeEndpointData.method} \\
  ${activeEndpointData.headers.map(h => `-H "${h.name}: ${h.value}"`).join(' \\\n  ')} \\
  ${activeEndpointData.body ? `-d '${JSON.stringify(activeEndpointData.body)}' \\` : ''}
  https://analytics.knotie-ai.pro${activeEndpointData.path}${activeEndpointData.params ? `?${activeEndpointData.params.map(p => `${p.name}=${p.value}`).join('&')}` : ''}`}
                          </pre>
                        </div>
                      </div>

                      {/* Authorization Header Method */}
                      <div>
                        <h4 className="text-md font-medium text-green-300 mb-3">Using Authorization Header (Recommended)</h4>
                        <div className="bg-gray-900 rounded-lg p-4 relative">
                          <button
                            onClick={() => {
                              const authHeaders = activeEndpointData.headers.filter(h => h.name !== 'X-API-Key' && h.name !== 'X-Partner-Email');
                              const curlCommand = `curl -X ${activeEndpointData.method} \\
  -H "Authorization: Basic your_auth_token" \\
  ${authHeaders.map(h => `-H "${h.name}: ${h.value}"`).join(' \\\n  ')} \\
  ${activeEndpointData.body ? `-d '${JSON.stringify(activeEndpointData.body)}' \\` : ''}
  https://analytics.knotie-ai.pro${activeEndpointData.path}${activeEndpointData.params ? `?${activeEndpointData.params.map(p => `${p.name}=${p.value}`).join('&')}` : ''}`;
                              copyToClipboard(curlCommand, `curl-auth-${activeEndpoint}`);
                            }}
                            className="absolute top-2 right-2 text-gray-400 hover:text-white"
                          >
                            {copiedCode === `curl-auth-${activeEndpoint}` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X ${activeEndpointData.method} \\
  -H "Authorization: Basic your_auth_token" \\
  ${activeEndpointData.headers.filter(h => h.name !== 'X-API-Key' && h.name !== 'X-Partner-Email').map(h => `-H "${h.name}: ${h.value}"`).join(' \\\n  ')} \\
  ${activeEndpointData.body ? `-d '${JSON.stringify(activeEndpointData.body)}' \\` : ''}
  https://analytics.knotie-ai.pro${activeEndpointData.path}${activeEndpointData.params ? `?${activeEndpointData.params.map(p => `${p.name}=${p.value}`).join('&')}` : ''}`}
                          </pre>
                        </div>
                        <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                          <p className="text-xs text-green-300">
                            <strong>💡 Note:</strong> Replace "your_auth_token" with the Authorization header generated in your partner portal when creating an API key.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIReferencePage;
