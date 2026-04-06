'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Code,
  // Zap, // Unused
  Shield,
  Globe,
  ArrowRight,
  BookOpen,
  Cpu,
  Users,
  Settings,
  BarChart3,
  Menu,
  X,
  Link2
} from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { FaGithub, FaYoutube, FaTwitter } from 'react-icons/fa';

const DocsPage = () => {
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

  const features = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "Customer Management",
      description: "Create, manage, and onboard customers programmatically",
      link: "/docs/customer-management"
    },
    {
      icon: <Cpu className="w-6 h-6" />,
      title: "Agent Management",
      description: "Map and configure AI agents with custom profit multipliers",
      link: "/docs/agent-management"
    },
    {
      icon: <Settings className="w-6 h-6" />,
      title: "Feature Control",
      description: "Configure customer portal features and permissions",
      link: "/docs/feature-management"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Real-time Updates",
      description: "Server-Sent Events for live capability monitoring",
      link: "/docs/real-time"
    },
    {
      icon: <Link2 className="w-6 h-6" />,
      title: "MCP Integration",
      description: "Connect AI agents to 100+ tools via Model Context Protocol",
      link: "/docs/api-reference#mcp"
    }
  ];

  const useCases = [
    {
      title: "AI-Powered Ad Campaigns",
      description: "Automatically create customers from ad campaign leads and assign them AI agents",
      icon: "🎯"
    },
    {
      title: "Outbound Call Automation",
      description: "Run automated call campaigns and onboard prospects as customers",
      icon: "📞"
    },
    {
      title: "Lead Qualification",
      description: "Use AI agents to qualify leads and convert them to customers automatically",
      icon: "🔍"
    },
    {
      title: "Customer Onboarding",
      description: "Streamline customer onboarding with automated portal access and agent assignment",
      icon: "🚀"
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
              <Link href="/docs" className="text-white font-medium">
                Docs
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
                <Link href="/docs" className="text-white font-medium">
                  Documentation
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
        {/* Hero Section */}
        <div className="container mx-auto px-4 pt-24 pb-36">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center rounded-full border border-blue-400/30 px-6 py-2.5 text-sm text-blue-200
                             backdrop-blur-md bg-blue-900/10 mb-10 group hover:border-blue-400/50 transition-all duration-300">
                <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-3 group-hover:animate-ping"></span>
                Model Context Protocol (MCP) Enabled
              </div>

              <h1 className="text-6xl md:text-7xl font-bold text-white mb-8 tracking-tight leading-tight">
                Automate Your AI Business
                <span className="text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text
                               block mt-3 animate-gradient bg-[length:200%_auto]">
                  with Knotie AI Pro
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-blue-100/80 mb-14 max-w-2xl mx-auto leading-relaxed
                           font-light tracking-wide">
                Create fully automated AI-powered businesses with our comprehensive API.
                Manage customers, assign agents, and scale your operations programmatically.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
                <Link
                  href="/docs/quickstart"
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold
                          hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105
                          relative overflow-hidden group inline-flex items-center"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-teal-600 opacity-0
                                 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center justify-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Quick Start Guide
                  </span>
                </Link>
                <Link
                  href="/docs/api-reference"
                  className="px-8 py-3 rounded-lg border border-blue-400/30 text-blue-200 hover:border-blue-400/50
                           hover:text-white transition-all duration-300 inline-flex items-center gap-2"
                >
                  <Code className="w-5 h-5" />
                  API Reference
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Rest of the sections */}
        <div className="container mx-auto px-4 pb-20">
          {/* Key Features */}
          <div className="text-center mt-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="inline-flex items-center rounded-full border border-blue-400/30 px-4 py-2 text-sm text-blue-200 backdrop-blur-sm mb-4">
                <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2"></span>
                Powerful API Features
              </div>
              <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                Build AI Automation
                <span className="text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text block mt-2">
                  That Scales
                </span>
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
                {features.map((feature, index) => (
                  <Link
                    key={index}
                    href={feature.link}
                    className="group bg-gray-800/50 backdrop-blur-md p-6 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">
                      {feature.title}
                    </h4>
                    <p className="text-gray-300 text-sm mb-4">
                      {feature.description}
                    </p>
                    <div className="flex items-center text-blue-400 text-sm font-medium group-hover:text-blue-300">
                      Learn more <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Use Cases */}
          <div className="text-center mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="inline-flex items-center rounded-full border border-blue-400/30 px-4 py-2 text-sm text-blue-200 backdrop-blur-sm mb-4">
                <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2"></span>
                AI Automation Use Cases
              </div>
              <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                Real-World
                <span className="text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text block mt-2">
                  Applications
                </span>
              </h3>
              <div className="grid md:grid-cols-2 gap-8 mb-20">
                {useCases.map((useCase, index) => (
                  <div
                    key={index}
                    className="bg-gray-800/50 backdrop-blur-md p-6 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">{useCase.icon}</div>
                      <div>
                        <h4 className="text-xl font-bold text-white mb-2">
                          {useCase.title}
                        </h4>
                        <p className="text-gray-300">
                          {useCase.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Security & Reliability */}
          <div className="text-center mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-gray-800/30 rounded-2xl p-8 mb-16 border border-blue-500/20"
            >
              <div className="text-center mb-8">
                <Shield className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                  Enterprise-Grade
                  <span className="text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text block mt-2">
                    Security
                  </span>
                </h3>
                <p className="text-blue-100/80 max-w-2xl mx-auto text-lg">
                  Built with security and reliability in mind. Our API uses industry-standard
                  encryption, authentication, and monitoring to keep your data safe.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-blue-400" />
                  </div>
                  <h4 className="font-semibold text-white mb-2">Multiple Authentication Methods</h4>
                  <p className="text-gray-300 text-sm">API key headers or standard Authorization header - compatible with all MCP client tools</p>
                </div>
                <div className="text-center">
                  <div className="bg-green-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-green-400" />
                  </div>
                  <h4 className="font-semibold text-white mb-2">99.9% Uptime</h4>
                  <p className="text-gray-300 text-sm">Reliable infrastructure with comprehensive monitoring</p>
                </div>
                <div className="text-center">
                  <div className="bg-purple-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-purple-400" />
                  </div>
                  <h4 className="font-semibold text-white mb-2">Real-time Monitoring</h4>
                  <p className="text-gray-300 text-sm">Live updates and comprehensive analytics</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Getting Started */}
          <div className="text-center mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                Ready to Build
                <span className="text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text block mt-2">
                  AI Automation?
                </span>
              </h3>
              <p className="text-blue-100/80 mb-8 max-w-2xl mx-auto text-lg">
                Get started with our comprehensive documentation and tutorials.
                More endpoints and features are coming soon!
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8">
                <Link
                  href="/docs/quickstart"
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-teal-500 text-white font-semibold
                          hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105
                          relative overflow-hidden group inline-flex items-center"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-teal-600 opacity-0
                                 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <span className="relative flex items-center justify-center gap-2">
                    Start Building
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </Link>
                <Link
                  href="/partner/tutorials"
                  className="px-8 py-3 rounded-lg border border-blue-400/30 text-blue-200 hover:border-blue-400/50
                           hover:text-white transition-all duration-300"
                >
                  View Tutorials
                </Link>
              </div>

              {/* New External Documentation Section */}
              <div className="mt-12 p-6 bg-gradient-to-r from-blue-500/10 to-teal-500/10 rounded-xl border border-blue-500/20">
                <div className="text-center">
                  <div className="inline-flex items-center rounded-full border border-teal-400/30 px-4 py-2 text-sm text-teal-200 backdrop-blur-sm mb-4">
                    <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2"></span>
                    Comprehensive Documentation
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-4">
                    Complete Platform Documentation
                  </h4>
                  <p className="text-blue-100/80 mb-6 max-w-2xl mx-auto">
                    Access our comprehensive documentation site with detailed guides, tutorials,
                    architecture overviews, and step-by-step instructions for all platform features.
                  </p>
                  <a
                    href="https://docs.knotie-ai.pro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-3 rounded-lg bg-gradient-to-r from-teal-500 to-blue-500 text-white font-semibold
                            hover:from-teal-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105
                            relative overflow-hidden group inline-flex items-center"
                  >
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-teal-600 to-blue-600 opacity-0
                                   group-hover:opacity-100 transition-opacity duration-300"></span>
                    <span className="relative flex items-center justify-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Visit Documentation Site
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </a>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-500/10 rounded-lg inline-block border border-blue-500/20">
                <p className="text-blue-300 text-sm">
                  <strong>Coming Soon:</strong> MCP for customers, webhook management, and advanced analytics endpoints
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
