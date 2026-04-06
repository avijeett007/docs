'use client';

import React from 'react';
import { FiCheck, FiClock, FiUsers, FiZap, FiSettings, FiDatabase, FiGlobe } from 'react-icons/fi';

export default function WorkflowSummary() {
  const features = [
    {
      category: "Core Workflow System",
      items: [
        { name: "N8N-Style Visual Designer", status: "complete", icon: FiSettings },
        { name: "Drag & Drop Node Interface", status: "complete", icon: FiZap },
        { name: "Real-time Flow Validation", status: "complete", icon: FiCheck },
        { name: "Visual Connection System", status: "complete", icon: FiZap }
      ]
    },
    {
      category: "Node Types & Integrations",
      items: [
        { name: "Webhook Trigger Nodes", status: "complete", icon: FiGlobe },
        { name: "Facebook/Meta Integration", status: "complete", icon: FiUsers },
        { name: "Go High Level (GHL) Integration", status: "complete", icon: FiDatabase },
        { name: "Knova AI Agent Nodes", status: "complete", icon: FiUsers },
        { name: "N8N Integration Nodes", status: "complete", icon: FiSettings },
        { name: "Information/Documentation Nodes", status: "complete", icon: FiDatabase }
      ]
    },
    {
      category: "Agent Configuration",
      items: [
        { name: "Customer Selection System", status: "complete", icon: FiUsers },
        { name: "Voice & Phone Number Setup", status: "complete", icon: FiSettings },
        { name: "Business Information Config", status: "complete", icon: FiDatabase },
        { name: "Knowledge Base Integration", status: "complete", icon: FiDatabase },
        { name: "Advanced Agent Instructions", status: "complete", icon: FiSettings }
      ]
    },
    {
      category: "Workflow Templates",
      items: [
        { name: "Facebook Lead Generation Template", status: "complete", icon: FiUsers },
        { name: "E-commerce Support Template", status: "complete", icon: FiDatabase },
        { name: "Template Import/Export System", status: "complete", icon: FiDatabase },
        { name: "Template Preview & Selection", status: "complete", icon: FiSettings }
      ]
    },
    {
      category: "Execution & Webhooks",
      items: [
        { name: "Workflow Execution Engine", status: "complete", icon: FiZap },
        { name: "Webhook URL Generation", status: "complete", icon: FiGlobe },
        { name: "Test & Production Environments", status: "complete", icon: FiSettings },
        { name: "Webhook Testing Interface", status: "complete", icon: FiCheck },
        { name: "Execution Logging & Monitoring", status: "complete", icon: FiClock }
      ]
    },
    {
      category: "Data Management",
      items: [
        { name: "JSON Configuration Storage", status: "complete", icon: FiDatabase },
        { name: "Workflow Versioning System", status: "complete", icon: FiClock },
        { name: "Automatic & Manual Backups", status: "complete", icon: FiDatabase },
        { name: "Export/Import Functionality", status: "complete", icon: FiDatabase },
        { name: "Storage Statistics & Management", status: "complete", icon: FiSettings }
      ]
    },
    {
      category: "Node Documentation System",
      items: [
        { name: "Tutorial Management", status: "complete", icon: FiDatabase },
        { name: "Documentation Attachments", status: "complete", icon: FiDatabase },
        { name: "Public Node Sharing", status: "complete", icon: FiGlobe },
        { name: "Step-by-step Guides", status: "complete", icon: FiCheck }
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'text-green-400';
      case 'in-progress':
        return 'text-amber-400';
      case 'planned':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return '✅';
      case 'in-progress':
        return '🔄';
      case 'planned':
        return '📋';
      default:
        return '❓';
    }
  };

  const totalFeatures = features.reduce((sum, category) => sum + category.items.length, 0);
  const completedFeatures = features.reduce((sum, category) => 
    sum + category.items.filter(item => item.status === 'complete').length, 0
  );
  const completionPercentage = Math.round((completedFeatures / totalFeatures) * 100);

  return (
    <div className="max-w-6xl mx-auto p-8 bg-gray-900 text-white">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          🤖 Knova Agent Workflow System
        </h1>
        <p className="text-xl text-gray-300 mb-6">
          Complete N8N-style workflow designer for AI-powered business automation
        </p>
        
        {/* Progress Summary */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-medium">Implementation Progress</span>
            <span className="text-2xl font-bold text-green-400">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>{completedFeatures} of {totalFeatures} features complete</span>
            <span>Ready for production use</span>
          </div>
        </div>
      </div>

      {/* Feature Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {features.map((category, categoryIndex) => (
          <div key={categoryIndex} className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-blue-400">
              {category.category}
            </h3>
            <div className="space-y-3">
              {category.items.map((item, itemIndex) => {
                const IconComponent = item.icon;
                return (
                  <div key={itemIndex} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                    <span className="text-lg">{getStatusIcon(item.status)}</span>
                    <IconComponent className={`w-5 h-5 ${getStatusColor(item.status)}`} />
                    <span className="flex-1 text-gray-200">{item.name}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.status === 'complete' 
                        ? 'bg-green-500/20 text-green-400' 
                        : item.status === 'in-progress'
                        ? 'bg-yellow-500/20 text-amber-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Key Highlights */}
      <div className="mt-12 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-8 border border-blue-500/20">
        <h3 className="text-2xl font-bold mb-6 text-center">🚀 Key Achievements</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">6</div>
            <div className="text-gray-300">Node Types</div>
            <div className="text-sm text-gray-400">Trigger, Action, Info, Integration</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">2</div>
            <div className="text-gray-300">Built-in Templates</div>
            <div className="text-sm text-gray-400">Facebook Lead Gen, E-commerce Support</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">100%</div>
            <div className="text-gray-300">Feature Complete</div>
            <div className="text-sm text-gray-400">Ready for production deployment</div>
          </div>
        </div>
      </div>

      {/* Technical Architecture */}
      <div className="mt-12 bg-gray-800 rounded-lg p-8">
        <h3 className="text-2xl font-bold mb-6 text-center">🏗️ Technical Architecture</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-lg font-semibold mb-4 text-blue-400">Frontend Components</h4>
            <ul className="space-y-2 text-gray-300">
              <li>• React + TypeScript workflow designer</li>
              <li>• Drag & drop canvas with real-time validation</li>
              <li>• Modal-based node configuration</li>
              <li>• Template selection & preview system</li>
              <li>• Webhook management interface</li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4 text-green-400">Backend Systems</h4>
            <ul className="space-y-2 text-gray-300">
              <li>• Node factory pattern for extensibility</li>
              <li>• Workflow execution engine</li>
              <li>• Version control & backup system</li>
              <li>• Webhook processing & routing</li>
              <li>• JSON-based configuration storage</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-12 bg-yellow-500/10 rounded-lg p-8 border border-yellow-500/20">
        <h3 className="text-2xl font-bold mb-6 text-center text-amber-400">🎯 Ready for Launch</h3>
        <div className="text-center text-gray-300">
          <p className="text-lg mb-4">
            The Knova Agent Workflow System is now complete and ready for production deployment!
          </p>
          <p className="text-sm text-gray-400">
            All core features have been implemented including the visual designer, node system, 
            templates, execution engine, and data management capabilities.
          </p>
        </div>
      </div>
    </div>
  );
}
