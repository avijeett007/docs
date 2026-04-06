'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Key,
  User,
  CheckCircle,
  Copy,
  ExternalLink,
  ArrowLeft,
  Code,
  Zap,
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { FaGithub, FaYoutube, FaTwitter } from 'react-icons/fa';

const QuickStartPage = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
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

  const steps = [
    {
      number: 1,
      title: "Create Your API Key",
      description: "Generate your partner API key from the Knotie AI Pro dashboard",
      icon: <Key className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <p className="text-blue-100/90">
            First, log in to your partner dashboard and navigate to the API Keys section:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-blue-100/90">
            <li>Go to <Link href="/partner/settings/api-keys" className="text-blue-400 hover:text-blue-300 underline">Partner Settings → API Keys</Link></li>
            <li>Click "Generate New API Key"</li>
            <li>Copy both credentials provided:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>API Key (starts with <code className="bg-gray-700/50 px-2 py-1 rounded text-blue-300">pkt_</code>)</li>
                <li>Authorization Header (for MCP client tools)</li>
              </ul>
            </li>
            <li>Store them securely - you won't see them again!</li>
          </ol>
          <div className="bg-blue-500/20 border border-blue-400/50 rounded-lg p-4 mb-4">
            <p className="text-blue-100 text-sm">
              <strong className="text-blue-50">💡 New Feature:</strong> We now provide both API key headers and a standard Authorization header for maximum compatibility with MCP client tools!
            </p>
          </div>
          <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-lg p-4">
            <p className="text-amber-100 text-sm">
              <strong className="text-amber-50">Important:</strong> Keep your credentials secure and never expose them in client-side code.
            </p>
          </div>
        </div>
      )
    },
    {
      number: 2,
      title: "Test Your Connection",
      description: "Verify your API key works by fetching your capabilities",
      icon: <CheckCircle className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          <p className="text-blue-100/90">
            Test your credentials with a simple capabilities request. Choose either method:
          </p>

          {/* Method 1: Headers */}
          <div>
            <h4 className="text-blue-300 font-medium mb-3">Method 1: Using Headers</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <button
                onClick={() => copyToClipboard(`curl -H "X-API-Key: YOUR_API_KEY" \\
     -H "X-Partner-Email: your@email.com" \\
     https://analytics.knotie-ai.pro/mcp/capabilities`, 'test-curl-headers')}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                {copiedCode === 'test-curl-headers' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
     -H "X-Partner-Email: your@email.com" \\
     https://analytics.knotie-ai.pro/mcp/capabilities`}
              </pre>
            </div>
          </div>

          {/* Method 2: Authorization Header */}
          <div>
            <h4 className="text-green-300 font-medium mb-3">Method 2: Using Authorization Header (Recommended)</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <button
                onClick={() => copyToClipboard(`curl -H "Authorization: Basic YOUR_AUTH_TOKEN" \\
     https://analytics.knotie-ai.pro/mcp/capabilities`, 'test-curl-auth')}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                {copiedCode === 'test-curl-auth' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -H "Authorization: Basic YOUR_AUTH_TOKEN" \\
     https://analytics.knotie-ai.pro/mcp/capabilities`}
              </pre>
            </div>
            <div className="mt-2 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <p className="text-green-300 text-xs">
                <strong>💡 Tip:</strong> Use the Authorization header generated in your partner portal - it's compatible with all MCP client tools!
              </p>
            </div>
          </div>

          <p className="text-blue-100/80 text-sm">
            Replace <code className="bg-gray-700/50 px-2 py-1 rounded text-blue-300">YOUR_API_KEY</code> with your actual API key,
            <code className="bg-gray-700/50 px-2 py-1 rounded ml-1 text-blue-300">your@email.com</code> with your registered partner email, or
            <code className="bg-gray-700/50 px-2 py-1 rounded ml-1 text-blue-300">YOUR_AUTH_TOKEN</code> with your Authorization header.
          </p>
        </div>
      )
    },
    {
      number: 3,
      title: "Create Your First Customer",
      description: "Programmatically create and onboard a new customer",
      icon: <User className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          <p className="text-blue-100/90">
            Create a customer using the MCP API. Choose your preferred authentication method:
          </p>

          {/* Method 1: Headers */}
          <div>
            <h4 className="text-blue-300 font-medium mb-3">Using Headers</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <button
                onClick={() => copyToClipboard(`curl -X POST \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-Partner-Email: your@email.com" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Corp"
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers`, 'create-customer-headers')}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                {copiedCode === 'create-customer-headers' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X POST \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-Partner-Email: your@email.com" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Corp"
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers`}
              </pre>
            </div>
          </div>

          {/* Method 2: Authorization Header */}
          <div>
            <h4 className="text-green-300 font-medium mb-3">Using Authorization Header</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <button
                onClick={() => copyToClipboard(`curl -X POST \\
  -H "Authorization: Basic YOUR_AUTH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Corp"
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers`, 'create-customer-auth')}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                {copiedCode === 'create-customer-auth' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X POST \\
  -H "Authorization: Basic YOUR_AUTH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Corp"
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers`}
              </pre>
            </div>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h4 className="font-semibold text-green-300 mb-2">Expected Response:</h4>
            <pre className="text-green-200 text-sm">
{`{
  "success": true,
  "customer_id": "uuid-here",
  "email": "customer@example.com",
  "message": "Customer created successfully"
}`}
            </pre>
          </div>
        </div>
      )
    },
    {
      number: 4,
      title: "Enable Portal Access",
      description: "Give your customer access to their dashboard with auto-generated credentials",
      icon: <Zap className="w-6 h-6" />,
      content: (
        <div className="space-y-6">
          <p className="text-blue-100/90">
            Enable portal access for your newly created customer:
          </p>

          {/* Method 1: Headers */}
          <div>
            <h4 className="text-blue-300 font-medium mb-3">Using Headers</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <button
                onClick={() => copyToClipboard(`curl -X POST \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-Partner-Email: your@email.com" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "CUSTOMER_ID_FROM_STEP_3",
    "send_email": false
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers/portal-access`, 'enable-portal-headers')}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                {copiedCode === 'enable-portal-headers' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X POST \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-Partner-Email: your@email.com" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "CUSTOMER_ID_FROM_STEP_3",
    "send_email": false
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers/portal-access`}
              </pre>
            </div>
          </div>

          {/* Method 2: Authorization Header */}
          <div>
            <h4 className="text-green-300 font-medium mb-3">Using Authorization Header</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <button
                onClick={() => copyToClipboard(`curl -X POST \\
  -H "Authorization: Basic YOUR_AUTH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "CUSTOMER_ID_FROM_STEP_3",
    "send_email": false
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers/portal-access`, 'enable-portal-auth')}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                {copiedCode === 'enable-portal-auth' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X POST \\
  -H "Authorization: Basic YOUR_AUTH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "CUSTOMER_ID_FROM_STEP_3",
    "send_email": false
  }' \\
  https://analytics.knotie-ai.pro/mcp/customers/portal-access`}
              </pre>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="font-semibold text-blue-300 mb-2">Response includes:</h4>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• Auto-generated secure password</li>
              <li>• Portal URL for customer access</li>
              <li>• Login credentials ready to share</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

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
              <Link href="/docs/quickstart" className="text-white font-medium">
                Quick Start
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
                <Link href="/docs/quickstart" className="text-white font-medium">
                  Quick Start Guide
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
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-4 mb-8">
              <Link
                href="/docs"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                  Quick Start Guide
                </h1>
                <p className="mt-2 text-xl text-blue-100/80">
                  Get up and running with Knotie AI Pro MCP API in minutes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 pb-20">
          <div className="max-w-4xl mx-auto">
            {/* Introduction */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 backdrop-blur-md">
                <div className="flex items-start space-x-3">
                  <Code className="w-6 h-6 text-blue-400 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      What You'll Learn
                    </h3>
                    <p className="text-blue-100/80">
                      This guide will walk you through creating your first automated customer onboarding
                      workflow using the Knotie AI Pro MCP API. You'll learn how to authenticate,
                      create customers, and enable portal access programmatically.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Steps */}
            <div className="space-y-12">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="relative"
                >
                  {/* Step connector line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-6 top-16 w-0.5 h-16 bg-blue-500/30"></div>
                  )}

                  <div className="flex items-start space-x-6">
                    {/* Step number */}
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {step.number}
                    </div>

                    {/* Step content */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="text-blue-400">
                          {step.icon}
                        </div>
                        <h3 className="text-xl font-bold text-white">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-blue-100/80 mb-6">
                        {step.description}
                      </p>
                      <div className="bg-gray-800/50 border border-blue-500/20 rounded-lg p-6 backdrop-blur-md">
                        {step.content}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Next Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-16 bg-gray-800/30 rounded-2xl p-8 border border-blue-500/20"
            >
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                🎉 Congratulations! What's Next?
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <Link
                  href="/docs/api-reference"
                  className="bg-gray-800/50 p-6 rounded-lg border border-blue-500/20 hover:border-blue-500/40 hover:bg-gray-800/70 transition-all group backdrop-blur-md"
                >
                  <h4 className="font-semibold text-white mb-2 group-hover:text-blue-400">
                    Explore Full API Reference
                  </h4>
                  <p className="text-gray-300 text-sm mb-4">
                    Discover all available endpoints for agent management, feature control, and more.
                  </p>
                  <div className="flex items-center text-blue-400 text-sm">
                    View Documentation <ExternalLink className="w-4 h-4 ml-1" />
                  </div>
                </Link>

                <Link
                  href="/partner/tutorials"
                  className="bg-gray-800/50 p-6 rounded-lg border border-blue-500/20 hover:border-blue-500/40 hover:bg-gray-800/70 transition-all group backdrop-blur-md"
                >
                  <h4 className="font-semibold text-white mb-2 group-hover:text-blue-400">
                    Watch Video Tutorials
                  </h4>
                  <p className="text-gray-300 text-sm mb-4">
                    Learn advanced automation techniques with step-by-step video guides.
                  </p>
                  <div className="flex items-center text-blue-400 text-sm">
                    Watch Tutorials <ExternalLink className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              </div>

              <div className="mt-8 text-center">
                <p className="text-blue-100/80 mb-4">
                  Ready to build AI automation? Download our Postman collection for easy testing:
                </p>
                <a
                  href="/docs/postman-collection"
                  className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-300 inline-flex items-center"
                >
                  Download Postman Collection
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickStartPage;
