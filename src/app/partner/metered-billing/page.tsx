'use client';

import React, { useState } from 'react';
import {
  FiTrendingUp,
  FiUsers,
  FiSettings,
  FiDollarSign,
  FiBook,
  FiTool
} from 'react-icons/fi';
import MeteredBillingPlansManager from '@/components/partner/MeteredBillingPlansManager';
import CustomerBillingManager from '@/components/partner/CustomerBillingManager';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import MeteredBillingGuide from '@/components/partner/MeteredBillingGuide';

type TabType = 'plans' | 'customers' | 'settings';

export default function PartnerMeteredBillingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('plans');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(true);

  React.useEffect(() => {
    // Get partner name from localStorage
    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    // Fetch Stripe status
    fetchStripeStatus();
  }, []);

  const fetchStripeStatus = async () => {
    try {
      const response = await fetch('/api/partner/stripe/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStripeStatus(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    } finally {
      setStripeLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    window.location.href = '/partner/login';
  };

  const tabs = [
    {
      id: 'plans' as TabType,
      name: 'Billing Plans',
      icon: FiTrendingUp,
      description: 'Manage metered billing plans',
    },
    {
      id: 'customers' as TabType,
      name: 'Customer Billing',
      icon: FiUsers,
      description: 'Manage customer subscriptions',
    },
    {
      id: 'settings' as TabType,
      name: 'Billing Settings',
      icon: FiSettings,
      description: 'Configure billing preferences',
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'plans':
        return <MeteredBillingPlansManager className="max-w-7xl" stripeStatus={stripeStatus} />;
      
      case 'customers':
        return (
          <div className="max-w-7xl">
            {selectedCustomerId ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    ← Back to Customer List
                  </button>
                </div>
                <CustomerBillingManager customerId={selectedCustomerId} />
              </div>
            ) : (
              <CustomerListView onSelectCustomer={setSelectedCustomerId} />
            )}
          </div>
        );
      
      case 'settings':
        return <BillingSettingsView />;
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />

      <main className="flex-1 pl-64 min-h-screen relative">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold">Metered Billing</h1>
                <p className="text-gray-400 mt-1">
                  Manage usage-based billing plans and customer subscriptions
                </p>
              </div>
              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiBook className="w-4 h-4" />
                User Guide
              </button>
            </div>

            {/* Development Notice */}
            <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
              <div className="flex items-start gap-3">
                <FiTool className="w-5 h-5 text-amber-300 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-amber-200 font-semibold mb-1">🚧 Feature in Development</h3>
                  <p className="text-gray-200 text-sm mb-3">
                    Metered billing is currently under active development and not fully released for production use.
                    Some features may be incomplete or experience issues.
                  </p>
                  <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-lg p-3">
                    <h4 className="text-amber-200 font-medium text-sm mb-2">What's Working:</h4>
                    <ul className="text-gray-100 text-sm space-y-1 list-disc list-inside">
                      <li>Plan creation and management</li>
                      <li>Basic billing configuration</li>
                      <li>Stripe integration setup</li>
                    </ul>
                    <h4 className="text-amber-200 font-medium text-sm mb-2 mt-3">Coming Soon:</h4>
                    <ul className="text-gray-100 text-sm space-y-1 list-disc list-inside">
                      <li>Customer subscription assignment</li>
                      <li>Usage tracking and reporting</li>
                      <li>Automated billing processing</li>
                    </ul>
                  </div>
                  <p className="text-gray-300 text-xs mt-3">
                    💡 <strong className="text-amber-200">For production billing needs</strong>, please use the standard invoice billing system available in the customer management section.
                  </p>
                </div>
              </div>
            </div>

            {/* Stripe Integration Requirement */}
            {!stripeLoading && (!stripeStatus?.hasStripeAccount || !stripeStatus?.onboardingCompleted || !stripeStatus?.chargesEnabled) && (
              <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <FiSettings className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-amber-400 font-medium mb-2">Stripe Connect Required</h3>
                    <p className="text-amber-300 text-sm mb-3">
                      Metered billing requires Stripe Connect to process payments. Please complete your Stripe onboarding to enable billing features.
                    </p>
                    <div className="flex items-center gap-4">
                      <a
                        href="/partner/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg transition-colors text-sm font-medium"
                      >
                        <FiSettings className="w-4 h-4" />
                        Complete Stripe Setup
                      </a>
                      <div className="text-xs text-amber-300">
                        Status: {!stripeStatus?.hasStripeAccount ? 'Not Connected' :
                                !stripeStatus?.onboardingCompleted ? 'Onboarding Incomplete' :
                                !stripeStatus?.chargesEnabled ? 'Charges Disabled' : 'Unknown'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg mb-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id !== 'customers') {
                        setSelectedCustomerId(null);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white text-gray-900'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </main>

      {/* User Guide Modal */}
      <MeteredBillingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </div>
  );
}

// Customer List View Component
function CustomerListView({ onSelectCustomer }: { onSelectCustomer: (customerId: string) => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return;

        const response = await fetch('/api/partner/customers', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Filter customers to only show those with actual Customer records (customerId exists)
            const customersWithBilling = data.data.filter((customer: any) => customer.customerId);
            setCustomers(customersWithBilling);
          }
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading customers...</span>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Customer Billing Management</h2>
        </div>
        <div className="text-center py-12">
          <FiUsers className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Customers with Billing Records</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Customers need to have portal access enabled and billing records created before they can be managed here.
          </p>
          <a
            href="/partner/customers"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FiUsers className="w-4 h-4" />
            Manage Customers
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Customer Billing Management</h2>
        <div className="text-sm text-gray-400">
          {customers.length} customers with billing data
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => (
          <div
            key={customer.id}
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-all cursor-pointer hover:shadow-lg"
            onClick={() => onSelectCustomer(customer.customerId)}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <FiUsers className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">
                  {customer.companyName || `${customer.firstName || 'Unknown'} ${customer.lastName || 'Customer'}`}
                </h3>
                <p className="text-sm text-gray-400 truncate">{customer.email || 'No email'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Active Subscriptions</span>
                <span className="text-lg font-bold text-white">{customer.subscriptions || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Unbilled Amount</span>
                <span className="text-sm font-medium text-green-400">
                  ${(customer.unbilledAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-700">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  customer.subscriptions > 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {customer.subscriptions > 0 ? 'Active Billing' : 'No Subscriptions'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Billing Settings View Component
function BillingSettingsView() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Billing Settings</h2>
        <p className="text-gray-400">Configure your billing preferences and defaults</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Auto-Charge Settings */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FiDollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Auto-Charge Settings</h3>
              <p className="text-sm text-gray-400">Configure automatic payment processing</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Enable Auto-Charge by Default</span>
              <button className="w-12 h-6 bg-blue-600 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Retry Failed Payments</span>
              <button className="w-12 h-6 bg-blue-600 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Send Payment Reminders</span>
              <button className="w-12 h-6 bg-blue-600 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Metered Billing Defaults */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FiTrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Metered Billing Defaults</h3>
              <p className="text-sm text-gray-400">Default settings for new plans</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Default Billing Cycle</label>
              <select className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Default Pricing Model</label>
              <select className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
                <option value="flat">Flat Rate</option>
                <option value="tiered">Tiered Pricing</option>
                <option value="volume">Volume Pricing</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}
