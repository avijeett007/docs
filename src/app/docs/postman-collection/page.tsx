'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  Play,
  Settings,
  Zap,
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { FaGithub, FaYoutube, FaTwitter } from 'react-icons/fa';

const PostmanCollectionPage = () => {
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

  const handleDownload = () => {
    // Create a download link for the Postman collection
    const collectionUrl = '/api/postman-collection';
    const link = document.createElement('a');
    link.href = collectionUrl;
    link.download = 'Knotie-AI-Pro-MCP-API.postman_collection.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      title: "Download Collection",
      description: "Download the Knotie AI Pro MCP API Postman collection",
      icon: <Download className="w-5 h-5" />
    },
    {
      number: 2,
      title: "Import to Postman",
      description: "Open Postman and import the downloaded collection file",
      icon: <Settings className="w-5 h-5" />
    },
    {
      number: 3,
      title: "Configure Variables",
      description: "Set your API key and partner email in the collection variables",
      icon: <Settings className="w-5 h-5" />
    },
    {
      number: 4,
      title: "Start Testing",
      description: "Run requests and explore the MCP API functionality",
      icon: <Play className="w-5 h-5" />
    }
  ];

  const features = [
    "✅ All MCP API endpoints included",
    "✅ Pre-configured authentication headers",
    "✅ Example request bodies and responses",
    "✅ Error handling test cases",
    "✅ Automation workflow examples",
    "✅ Environment variables for easy switching",
    "✅ Test scripts for validation",
    "✅ Production URL (Test environment coming soon)"
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
              <Link href="/docs/postman-collection" className="text-white font-medium">
                Postman Collection
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
                <Link href="/docs/postman-collection" className="text-white font-medium">
                  Postman Collection
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
                  Postman Collection
                </h1>
                <p className="mt-2 text-xl text-blue-100/80">
                  Ready-to-use Postman collection for Knotie AI Pro MCP API
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 pb-20">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <div className="bg-blue-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                <Download className="w-10 h-10 text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Get Started Instantly with Postman
              </h2>
              <p className="text-xl text-blue-100/80 max-w-2xl mx-auto mb-8">
                Download our comprehensive Postman collection to test and explore
                all Knotie AI Pro MCP API endpoints with pre-configured examples.
              </p>

              <button
                onClick={handleDownload}
                className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-8 py-4 rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-300 inline-flex items-center text-lg font-semibold"
              >
                <Download className="w-6 h-6 mr-3" />
                Download Postman Collection
              </button>

              <p className="text-gray-400 text-sm mt-4">
                Version 2.0.0 • Updated for latest MCP API features
              </p>
            </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            What's Included
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="grid md:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Setup Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Setup Instructions
          </h3>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Step connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-16 w-0.5 h-8 bg-gray-200"></div>
                )}

                <div className="flex items-start space-x-6">
                  {/* Step number */}
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    {step.number}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="text-blue-600">
                        {step.icon}
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {step.title}
                      </h4>
                    </div>
                    <p className="text-gray-600">
                      {step.description}
                    </p>

                    {/* Additional details for specific steps */}
                    {step.number === 2 && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          In Postman: <strong>File → Import → Choose Files</strong> and select the downloaded JSON file.
                        </p>
                      </div>
                    )}

                    {step.number === 3 && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">
                          Update these collection variables:
                        </p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• <code className="bg-gray-200 px-2 py-1 rounded">api_key</code>: Your partner API key</li>
                          <li>• <code className="bg-gray-200 px-2 py-1 rounded">partner_email</code>: Your registered email</li>
                          <li>• <code className="bg-gray-200 px-2 py-1 rounded">base_url</code>: Use production or development URL</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Collection Structure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Collection Structure
          </h3>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span className="font-semibold">Authentication</span>
              </div>
              <div className="ml-7 space-y-2 text-sm text-gray-600">
                <div>• Get Capabilities</div>
                <div>• Health Check</div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-600 rounded"></div>
                <span className="font-semibold">Customer Management</span>
              </div>
              <div className="ml-7 space-y-2 text-sm text-gray-600">
                <div>• Create Customer</div>
                <div>• Enable Portal Access</div>
                <div>• Reset Password</div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-purple-600 rounded"></div>
                <span className="font-semibold">Agent Management</span>
              </div>
              <div className="ml-7 space-y-2 text-sm text-gray-600">
                <div>• Map Agent to Customer</div>
                <div>• Unmap Agent</div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-orange-600 rounded"></div>
                <span className="font-semibold">Feature Management</span>
              </div>
              <div className="ml-7 space-y-2 text-sm text-gray-600">
                <div>• Update Customer Features</div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-red-600 rounded"></div>
                <span className="font-semibold">Error Handling Examples</span>
              </div>
              <div className="ml-7 space-y-2 text-sm text-gray-600">
                <div>• Duplicate Customer Test</div>
                <div>• Invalid API Key Test</div>
                <div>• Non-existent Resource Test</div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-yellow-600 rounded"></div>
                <span className="font-semibold">Automation Examples</span>
              </div>
              <div className="ml-7 space-y-2 text-sm text-gray-600">
                <div>• Complete Customer Workflow</div>
                <div>• SSE Stream Connection</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Additional Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Need Help?
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <Link
              href="/docs/quickstart"
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all group"
            >
              <Zap className="w-8 h-8 text-blue-600 mx-auto mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600">
                Quick Start Guide
              </h4>
              <p className="text-gray-600 text-sm">
                Step-by-step guide to get started with the MCP API
              </p>
            </Link>

            <Link
              href="/partner/tutorials"
              className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all group"
            >
              <ExternalLink className="w-8 h-8 text-blue-600 mx-auto mb-4" />
              <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600">
                Video Tutorials
              </h4>
              <p className="text-gray-600 text-sm">
                Watch detailed tutorials on API automation
              </p>
            </Link>
          </div>

          <div className="mt-8">
            <button
              onClick={handleDownload}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Collection Again
            </button>
          </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostmanCollectionPage;
