'use client';

import React, { useState } from 'react';
import {
  FiX,
  FiBook,
  FiDollarSign,
  FiUsers,
  FiBarChart,
  FiShield,
  FiCreditCard,
  FiAlertTriangle,
  FiCheckCircle,
  FiExternalLink
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

interface MeteredBillingGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MeteredBillingGuide({ isOpen, onClose }: MeteredBillingGuideProps) {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: FiBook },
    { id: 'creating-plans', title: 'Creating Plans', icon: FiDollarSign },
    { id: 'customer-management', title: 'Customer Management', icon: FiUsers },
    { id: 'monitoring', title: 'Monitoring & Analytics', icon: FiBarChart },
    { id: 'disputes', title: 'Handling Disputes', icon: FiAlertTriangle },
    { id: 'security', title: 'Security & Compliance', icon: FiShield },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex"
        >
          {/* Sidebar */}
          <div className="w-64 bg-gray-900/50 border-r border-gray-700 p-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">User Guide</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {activeSection === 'overview' && <OverviewSection />}
                {activeSection === 'creating-plans' && <CreatingPlansSection />}
                {activeSection === 'customer-management' && <CustomerManagementSection />}
                {activeSection === 'monitoring' && <MonitoringSection />}
                {activeSection === 'disputes' && <DisputesSection />}
                {activeSection === 'security' && <SecuritySection />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function OverviewSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Metered Billing Overview</h3>
        <p className="text-gray-300 text-lg leading-relaxed">
          Metered billing allows you to charge customers based on their actual usage of your services. 
          This creates a fair, transparent pricing model that scales with customer value.
        </p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiCheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-blue-400 font-medium mb-2">How It Works</h4>
            <ul className="text-blue-300 space-y-1 text-sm">
              <li>• Create flexible billing plans with different pricing models</li>
              <li>• Subscribe customers to plans that match their needs</li>
              <li>• Usage is automatically tracked from your analytics system</li>
              <li>• Invoices are generated based on actual consumption</li>
              <li>• Payments are processed through Stripe Connect</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <FiDollarSign className="w-8 h-8 text-green-400 mb-3" />
          <h4 className="font-semibold text-white mb-2">Flexible Pricing</h4>
          <p className="text-gray-400 text-sm">
            Support flat rate, tiered, and volume pricing models to match your business needs.
          </p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <FiBarChart className="w-8 h-8 text-blue-400 mb-3" />
          <h4 className="font-semibold text-white mb-2">Real-time Tracking</h4>
          <p className="text-gray-400 text-sm">
            Usage is tracked automatically and customers can see their consumption in real-time.
          </p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <FiShield className="w-8 h-8 text-purple-400 mb-3" />
          <h4 className="font-semibold text-white mb-2">Secure Processing</h4>
          <p className="text-gray-400 text-sm">
            All payments are processed securely through Stripe with no card data stored locally.
          </p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-amber-400 font-medium mb-2">Important Notes</h4>
            <ul className="text-amber-300 space-y-1 text-sm">
              <li>• Metered billing requires active Stripe Connect integration</li>
              <li>• Usage tracking must be enabled in your analytics settings</li>
              <li>• Customers need saved payment methods for auto-charging</li>
              <li>• Review your pricing carefully before activating plans</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatingPlansSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Creating Billing Plans</h3>
        <p className="text-gray-300 leading-relaxed">
          Learn how to create and configure metered billing plans for your customers.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
            Choose Your Metric Type
          </h4>
          <p className="text-gray-300 mb-3">Select what you want to measure and charge for:</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-600/50 rounded p-3">
              <strong className="text-white">Calls:</strong> <span className="text-gray-300">Charge per phone call</span>
            </div>
            <div className="bg-gray-600/50 rounded p-3">
              <strong className="text-white">Minutes:</strong> <span className="text-gray-300">Charge per minute of usage</span>
            </div>
            <div className="bg-gray-600/50 rounded p-3">
              <strong className="text-white">Leads:</strong> <span className="text-gray-300">Charge per lead generated</span>
            </div>
            <div className="bg-gray-600/50 rounded p-3">
              <strong className="text-white">Custom:</strong> <span className="text-gray-300">Define your own metrics</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
            Select Pricing Model
          </h4>
          <div className="space-y-3">
            <div className="border border-gray-600 rounded p-3">
              <h5 className="font-medium text-white mb-1">Flat Rate</h5>
              <p className="text-gray-300 text-sm mb-2">Same price per unit regardless of usage volume.</p>
              <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">
                Example: $0.05 per call
              </div>
            </div>
            <div className="border border-gray-600 rounded p-3">
              <h5 className="font-medium text-white mb-1">Tiered Pricing</h5>
              <p className="text-gray-300 text-sm mb-2">Different rates for different usage tiers.</p>
              <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">
                Example: First 100 calls at $0.10, next 400 at $0.08, 500+ at $0.05
              </div>
            </div>
            <div className="border border-gray-600 rounded p-3">
              <h5 className="font-medium text-white mb-1">Volume Pricing</h5>
              <p className="text-gray-300 text-sm mb-2">Rate determined by total usage volume.</p>
              <div className="bg-gray-800 rounded p-2 text-sm text-gray-300">
                Example: 1-100 calls: $0.10 each, 101-500: $0.08 each
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
            Configure Advanced Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-white mb-2">Included Units</h5>
              <p className="text-gray-300">Free allowance per billing period (e.g., first 50 minutes free)</p>
            </div>
            <div>
              <h5 className="font-medium text-white mb-2">Minimum Charge</h5>
              <p className="text-gray-300">Ensure minimum monthly revenue (e.g., $10 minimum)</p>
            </div>
            <div>
              <h5 className="font-medium text-white mb-2">Maximum Charge</h5>
              <p className="text-gray-300">Cap monthly charges for customer protection</p>
            </div>
            <div>
              <h5 className="font-medium text-white mb-2">Billing Cycle</h5>
              <p className="text-gray-300">Daily, weekly, monthly, or quarterly billing</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiCheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-green-400 font-medium mb-2">Best Practices</h4>
            <ul className="text-green-300 space-y-1 text-sm">
              <li>• Start with simple flat-rate pricing and evolve to tiered models</li>
              <li>• Include some free units to reduce customer acquisition friction</li>
              <li>• Set reasonable minimum charges to ensure profitability</li>
              <li>• Test your pricing with a small group before full rollout</li>
              <li>• Clearly communicate pricing to customers before they subscribe</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerManagementSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Customer Management</h3>
        <p className="text-gray-300 leading-relaxed">
          Learn how to subscribe customers to plans and manage their billing lifecycle.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Subscribing Customers</h4>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">1</span>
              <div>
                <strong className="text-white">Navigate to Customer Billing:</strong>
                <p className="text-gray-300">Go to Billing & Invoices → Customer Billing tab</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">2</span>
              <div>
                <strong className="text-white">Select Customer:</strong>
                <p className="text-gray-300">Click on the customer you want to subscribe to a plan</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">3</span>
              <div>
                <strong className="text-white">Add Subscription:</strong>
                <p className="text-gray-300">Click "Add Subscription" and select from your active plans</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">4</span>
              <div>
                <strong className="text-white">Monitor Usage:</strong>
                <p className="text-gray-300">Track customer usage and projected costs in real-time</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Managing Subscriptions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h5 className="font-medium text-white">Subscription Actions:</h5>
              <ul className="text-gray-300 space-y-1">
                <li>• <strong>Pause:</strong> Temporarily stop usage tracking</li>
                <li>• <strong>Resume:</strong> Reactivate paused subscriptions</li>
                <li>• <strong>Cancel:</strong> End subscription (processes final bill)</li>
                <li>• <strong>Modify:</strong> Change plan settings or limits</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h5 className="font-medium text-white">Usage Monitoring:</h5>
              <ul className="text-gray-300 space-y-1">
                <li>• View real-time usage statistics</li>
                <li>• Monitor projected monthly costs</li>
                <li>• Track billing period progress</li>
                <li>• Review usage history and trends</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Payment Method Requirements</h4>
          <p className="text-gray-300 mb-3">
            For automatic billing to work, customers must have:
          </p>
          <ul className="text-gray-300 space-y-1 text-sm">
            <li>• At least one active payment method saved</li>
            <li>• A default payment method selected</li>
            <li>• Auto-charge enabled on their account</li>
          </ul>
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <p className="text-amber-300 text-sm">
              <strong>Note:</strong> If a customer doesn't have auto-charge set up, invoices will be sent for manual payment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonitoringSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Monitoring & Analytics</h3>
        <p className="text-gray-300 leading-relaxed">
          Track usage, monitor billing performance, and analyze customer behavior.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Real-time Usage Tracking</h4>
          <p className="text-gray-300 mb-3">
            Usage is automatically tracked from your analytics system and updated in real-time:
          </p>
          <ul className="text-gray-300 space-y-1 text-sm">
            <li>• Call events are processed immediately via webhooks</li>
            <li>• Usage appears in customer dashboards within seconds</li>
            <li>• Billing calculations are updated continuously</li>
            <li>• Customers can see their current usage and projected costs</li>
          </ul>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Key Metrics to Monitor</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-white mb-2">Revenue Metrics:</h5>
              <ul className="text-gray-300 space-y-1">
                <li>• Monthly recurring revenue (MRR)</li>
                <li>• Average revenue per user (ARPU)</li>
                <li>• Usage-based revenue growth</li>
                <li>• Plan performance comparison</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-white mb-2">Usage Metrics:</h5>
              <ul className="text-gray-300 space-y-1">
                <li>• Average usage per customer</li>
                <li>• Usage distribution across tiers</li>
                <li>• Peak usage periods</li>
                <li>• Customer usage trends</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Billing Cycle Management</h4>
          <p className="text-gray-300 mb-3">
            The system automatically processes billing cycles:
          </p>
          <ol className="text-gray-300 space-y-2 text-sm">
            <li><strong>1. Usage Aggregation:</strong> Collect all usage for the billing period</li>
            <li><strong>2. Cost Calculation:</strong> Apply pricing tiers and calculate charges</li>
            <li><strong>3. Invoice Generation:</strong> Create invoices with detailed breakdowns</li>
            <li><strong>4. Payment Processing:</strong> Attempt auto-charge or send for manual payment</li>
            <li><strong>5. Period Advancement:</strong> Start new billing period for active subscriptions</li>
          </ol>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiBarChart className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-blue-400 font-medium mb-2">Analytics Integration</h4>
            <p className="text-blue-300 text-sm">
              Metered billing integrates seamlessly with your existing analytics system. 
              Usage data flows automatically from your voice AI providers through webhooks 
              to the billing system, ensuring accurate and timely billing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DisputesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Handling Billing Disputes</h3>
        <p className="text-gray-300 leading-relaxed">
          Learn best practices for managing billing disputes and maintaining customer relationships.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-red-400 font-medium mb-2">Common Dispute Scenarios</h4>
              <ul className="text-red-300 space-y-1 text-sm">
                <li>• Customer questions usage calculations</li>
                <li>• Disputes about call duration or quality</li>
                <li>• Billing tier misunderstandings</li>
                <li>• Technical issues causing incorrect charges</li>
                <li>• Subscription cancellation timing disputes</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Dispute Resolution Process</h4>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">1</span>
              <div>
                <strong className="text-white">Gather Information:</strong>
                <p className="text-gray-300">Review usage logs, call records, and billing calculations</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">2</span>
              <div>
                <strong className="text-white">Use Stripe Dashboard:</strong>
                <p className="text-gray-300">Access detailed transaction data in your Stripe Connect dashboard</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">3</span>
              <div>
                <strong className="text-white">Document Everything:</strong>
                <p className="text-gray-300">Keep records of all communications and evidence</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">4</span>
              <div>
                <strong className="text-white">Resolve Quickly:</strong>
                <p className="text-gray-300">Aim to resolve disputes within 24-48 hours</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Using Stripe Connect Dashboard</h4>
          <p className="text-gray-300 mb-3">
            Your Stripe Connect dashboard provides powerful tools for dispute management:
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <FiCreditCard className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Transaction Details:</strong>
                <p className="text-gray-300">View complete payment history and metadata</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FiBarChart className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Usage Breakdown:</strong>
                <p className="text-gray-300">See detailed usage data that led to charges</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FiExternalLink className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-white">Refund Processing:</strong>
                <p className="text-gray-300">Issue partial or full refunds directly from Stripe</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiCheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-green-400 font-medium mb-2">Best Practices</h4>
              <ul className="text-green-300 space-y-1 text-sm">
                <li>• Respond to disputes promptly and professionally</li>
                <li>• Provide clear explanations with supporting data</li>
                <li>• Offer partial refunds for legitimate concerns</li>
                <li>• Use disputes as learning opportunities to improve processes</li>
                <li>• Maintain detailed logs for future reference</li>
                <li>• Consider implementing usage alerts to prevent surprises</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-4">Security & Compliance</h3>
        <p className="text-gray-300 leading-relaxed">
          Understand how payment data is handled securely and compliance requirements.
        </p>
      </div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiShield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-green-400 font-medium mb-2">Payment Data Security</h4>
            <p className="text-green-300 text-sm mb-3">
              <strong>We do not store any customer or partner payment information.</strong> 
              All sensitive payment data is handled exclusively by Stripe, a PCI DSS Level 1 certified provider.
            </p>
            <ul className="text-green-300 space-y-1 text-sm">
              <li>• Credit card numbers are never stored in our systems</li>
              <li>• Payment methods are tokenized by Stripe</li>
              <li>• All payment processing happens on Stripe's secure infrastructure</li>
              <li>• We only store non-sensitive metadata and transaction references</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Data We Store</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-white mb-2">Safe to Store:</h5>
              <ul className="text-gray-300 space-y-1">
                <li>• Last 4 digits of card numbers</li>
                <li>• Card brand (Visa, Mastercard, etc.)</li>
                <li>• Expiration month/year</li>
                <li>• Stripe payment method IDs</li>
                <li>• Transaction metadata</li>
                <li>• Usage metrics and billing calculations</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-white mb-2">Never Stored:</h5>
              <ul className="text-gray-300 space-y-1">
                <li>• Full credit card numbers</li>
                <li>• CVV/CVC codes</li>
                <li>• Bank account numbers</li>
                <li>• PIN numbers</li>
                <li>• Any sensitive authentication data</li>
                <li>• Raw payment credentials</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Stripe Connect Integration</h4>
          <p className="text-gray-300 mb-3">
            We use Stripe Connect Express accounts for secure payment processing:
          </p>
          <ul className="text-gray-300 space-y-2 text-sm">
            <li>• <strong>Express Accounts:</strong> Simplified onboarding with Stripe handling compliance</li>
            <li>• <strong>Platform Fees:</strong> We charge a small platform fee on top of Stripe's fees</li>
            <li>• <strong>Direct Payouts:</strong> Funds are deposited directly to your bank account</li>
            <li>• <strong>Dispute Handling:</strong> Stripe manages chargebacks and disputes</li>
            <li>• <strong>Compliance:</strong> Stripe handles PCI compliance requirements</li>
          </ul>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Platform Fees</h4>
          <p className="text-gray-300 mb-3">
            Our platform charges are transparent and competitive:
          </p>
          <div className="bg-gray-800 rounded p-3 text-sm">
            <div className="text-white mb-2"><strong>Standard Fees:</strong></div>
            <ul className="text-gray-300 space-y-1">
              <li>• Stripe Processing: 2.9% + $0.30 per transaction</li>
              <li>• Platform Fee: 1% of transaction value</li>
              <li>• No monthly fees or setup costs</li>
              <li>• Volume discounts available for high-volume partners</li>
            </ul>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Compliance Requirements</h4>
          <ul className="text-gray-300 space-y-2 text-sm">
            <li>• <strong>PCI DSS:</strong> Handled by Stripe (Level 1 certified)</li>
            <li>• <strong>GDPR:</strong> Customer data processing agreements in place</li>
            <li>• <strong>SOX:</strong> Financial controls and audit trails maintained</li>
            <li>• <strong>Data Retention:</strong> Billing data retained per legal requirements</li>
            <li>• <strong>Encryption:</strong> All data encrypted in transit and at rest</li>
          </ul>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiCheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-blue-400 font-medium mb-2">Security Best Practices</h4>
            <ul className="text-blue-300 space-y-1 text-sm">
              <li>• Regularly review your Stripe dashboard for unusual activity</li>
              <li>• Enable two-factor authentication on your Stripe account</li>
              <li>• Monitor webhook endpoints for security issues</li>
              <li>• Keep your API keys secure and rotate them regularly</li>
              <li>• Review customer payment method changes promptly</li>
              <li>• Report any suspicious activity immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
