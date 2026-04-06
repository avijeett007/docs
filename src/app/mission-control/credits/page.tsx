'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { useToast } from '@/hooks/use-toast';
import {
  FiDollarSign,
  FiUsers,
  FiTrendingUp,
  FiAlertTriangle,
  FiSearch,
  FiPlus,
  FiMinus,
  FiRefreshCw,
  FiEye,
  FiStopCircle,
  FiCalendar
} from 'react-icons/fi';

interface CreditOverview {
  totalPartners: number;
  activePartners: number;
  totalCreditsInSystem: number;
  totalCreditsPurchased: number;
  totalCreditsUsed: number;
  averageCreditBalance: number;
  totalMonthlyAllocation: number;
  usageRate: number;
}

interface Partner {
  id: string;
  businessName: string;
  emailAddress: string;
  creditBalance: number;
  monthlyCreditAllocation: number;
  lastCreditAllocationDate: string | null;
  lowCreditThreshold: number;
  totalCreditsPurchased: number;
  totalCreditsUsed: number;
  approvalStatus: string;
  subscriptionStatus: string;
  isLowCredit: boolean;
  usageRate: number;
  recentTransactions: any[];
}

// Transaction interface removed as it's not currently used
// Can be re-added when transaction history feature is implemented

export default function MissionControlCreditsPage() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const [overview, setOverview] = useState<CreditOverview | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [lowCreditPartners, setLowCreditPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creditFilter, setCreditFilter] = useState('all');
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [creditOperation, setCreditOperation] = useState<'add' | 'deduct' | 'set_monthly' | 'stop_monthly'>('add');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [grantType, setGrantType] = useState<'one_time' | 'monthly_recurring'>('one_time');
  const [recurringMonths, setRecurringMonths] = useState('');
  const [monthlyAllocation, setMonthlyAllocation] = useState('');
  const [recurringGrants, setRecurringGrants] = useState<any[]>([]);
  const [showApiGuide, setShowApiGuide] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOverview();
      fetchPartners();
      fetchRecurringGrants();
    }
  }, [searchTerm, statusFilter, creditFilter, user]);

  const fetchOverview = async () => {
    try {
      const response = await fetch('/api/admin/credits/overview');
      const data = await response.json();

      if (data.success) {
        setOverview(data.data.overview);
        setLowCreditPartners(data.data.lowCreditPartners);
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    }
  };

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: searchTerm,
        status: statusFilter,
        creditFilter,
        page: '1',
        limit: '20'
      });

      const response = await fetch(`/api/admin/credits/partners?${params}`);
      const data = await response.json();

      if (data.success) {
        setPartners(data.data.partners);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreditOperation = async () => {
    if (!selectedPartner || !creditReason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Validation based on operation type
    if ((creditOperation === 'add' || creditOperation === 'deduct') && !creditAmount) {
      toast({
        title: "Validation Error",
        description: "Please enter an amount",
        variant: "destructive"
      });
      return;
    }

    if (creditOperation === 'set_monthly' && !monthlyAllocation) {
      toast({
        title: "Validation Error",
        description: "Please enter monthly allocation amount",
        variant: "destructive"
      });
      return;
    }

    if (creditOperation === 'add' && grantType === 'monthly_recurring' && !recurringMonths) {
      toast({
        title: "Validation Error",
        description: "Please specify duration for recurring credits",
        variant: "destructive"
      });
      return;
    }

    try {
      const requestBody: any = {
        partnerId: selectedPartner.id,
        operation: creditOperation,
        reason: creditReason,
        adminEmail: user?.email || 'admin@knotie-ai.pro'
      };

      // Add operation-specific fields
      if (creditOperation === 'add' || creditOperation === 'deduct') {
        requestBody.amount = parseInt(creditAmount);

        if (creditOperation === 'add') {
          requestBody.grantType = grantType;
          if (grantType === 'monthly_recurring' && recurringMonths) {
            requestBody.recurringMonths = parseInt(recurringMonths);
          }
        }
      }

      if (creditOperation === 'set_monthly') {
        requestBody.monthlyAllocation = parseInt(monthlyAllocation);
      }

      const response = await fetch('/api/admin/credits/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        setShowCreditModal(false);
        resetModalState();
        fetchOverview();
        fetchPartners();
        fetchRecurringGrants();
        toast({
          title: "Success",
          description: data.message || 'Operation completed successfully',
        });
      } else {
        toast({
          title: "Operation Failed",
          description: data.error || 'An error occurred',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error performing credit operation:', error);
      toast({
        title: "Network Error",
        description: 'Failed to perform operation. Please try again.',
        variant: "destructive"
      });
    }
  };

  const fetchRecurringGrants = async () => {
    try {
      const response = await fetch('/api/admin/credits/recurring-grants');
      const data = await response.json();

      if (data.success) {
        setRecurringGrants(data.data.grants);
      }
    } catch (error) {
      console.error('Error fetching recurring grants:', error);
    }
  };

  const resetModalState = () => {
    setCreditAmount('');
    setCreditReason('');
    setSelectedPartner(null);
    setGrantType('one_time');
    setRecurringMonths('');
    setMonthlyAllocation('');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };



  if (!user) {
    return null;
  }

  if (loading && !overview) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Credit Management</h1>
          <p className="text-gray-400">Monitor and manage partner credit balances</p>
        </div>

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Credits</p>
                  <p className="text-2xl font-bold">{formatNumber(overview.totalCreditsInSystem)}</p>
                </div>
                <FiDollarSign className="text-green-500 text-2xl" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800 rounded-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Active Partners</p>
                  <p className="text-2xl font-bold">{overview.activePartners}</p>
                </div>
                <FiUsers className="text-blue-500 text-2xl" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800 rounded-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Usage Rate</p>
                  <p className="text-2xl font-bold">{overview.usageRate}%</p>
                </div>
                <FiTrendingUp className="text-purple-500 text-2xl" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800 rounded-lg p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Low Credit Alerts</p>
                  <p className="text-2xl font-bold">{lowCreditPartners.length}</p>
                </div>
                <FiAlertTriangle className="text-red-500 text-2xl" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search partners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={creditFilter}
              onChange={(e) => setCreditFilter(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Credits</option>
              <option value="low">Low Credits</option>
              <option value="high">High Credits</option>
              <option value="zero">Zero Credits</option>
            </select>

            <button
              onClick={fetchPartners}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FiRefreshCw className="text-sm" />
              Refresh
            </button>
          </div>
        </div>

        {/* Developer API Guide */}
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-8">
          <button
            onClick={() => setShowApiGuide(!showApiGuide)}
            className="w-full p-6 flex justify-between items-center text-left hover:bg-gray-750 transition-colors"
          >
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                📡 Developer API Guide
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Use the Credit API to manage partner credits from your CRM or external systems
              </p>
            </div>
            <span className="text-gray-400 text-xl">{showApiGuide ? '▲' : '▼'}</span>
          </button>

          {showApiGuide && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-700 pt-4">
              {/* Step 1 */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Step 1: Generate an API Key</h3>
                <p className="text-gray-300 text-sm">
                  Go to <span className="text-blue-400 font-medium">Settings → Credit API Keys</span> tab and click
                  <span className="bg-gray-700 px-2 py-0.5 rounded text-xs ml-1">Create New API Key</span>.
                  Give it a descriptive name (e.g. &quot;CRM Integration&quot;). Copy the key immediately — it will only be shown once.
                </p>
              </div>

              {/* Step 2 */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Step 2: Authenticate Your Requests</h3>
                <p className="text-gray-300 text-sm mb-2">Include the API key in every request using one of these headers:</p>
                <pre className="bg-gray-900 p-3 rounded text-xs text-green-400 overflow-x-auto">
{`X-API-Key: ack_your_key_here
# or
Authorization: Bearer ack_your_key_here`}
                </pre>
              </div>

              {/* Step 3 */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Step 3: Add Credits (One-Time)</h3>
                <p className="text-gray-300 text-sm mb-2">Send a POST request to add credits to a partner by their email:</p>
                <pre className="bg-gray-900 p-3 rounded text-xs text-green-400 overflow-x-auto">
{`POST /api/v1/admin/credits
Content-Type: application/json
X-API-Key: ack_your_key_here

{
  "partnerEmail": "partner@example.com",
  "operation": "add",
  "amount": 500,
  "reason": "Welcome bonus from CRM",
  "grantType": "one_time"
}`}
                </pre>
              </div>

              {/* Step 4 */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Step 4: Set Up Recurring Credits</h3>
                <p className="text-gray-300 text-sm mb-2">To grant monthly recurring credits:</p>
                <pre className="bg-gray-900 p-3 rounded text-xs text-green-400 overflow-x-auto">
{`POST /api/v1/admin/credits
Content-Type: application/json
X-API-Key: ack_your_key_here

{
  "partnerEmail": "partner@example.com",
  "operation": "add",
  "amount": 200,
  "reason": "Monthly partner allocation",
  "grantType": "monthly_recurring",
  "recurringMonths": 12
}`}
                </pre>
              </div>

              {/* Step 5 */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Step 5: Deduct Credits</h3>
                <pre className="bg-gray-900 p-3 rounded text-xs text-green-400 overflow-x-auto">
{`POST /api/v1/admin/credits
Content-Type: application/json
X-API-Key: ack_your_key_here

{
  "partnerEmail": "partner@example.com",
  "operation": "deduct",
  "amount": 50,
  "reason": "Service charge"
}`}
                </pre>
              </div>

              {/* Step 6 */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Step 6: Check Balance</h3>
                <p className="text-gray-300 text-sm mb-2">Use a GET request to check a partner&apos;s credit balance:</p>
                <pre className="bg-gray-900 p-3 rounded text-xs text-green-400 overflow-x-auto">
{`GET /api/v1/admin/credits?partnerEmail=partner@example.com
X-API-Key: ack_your_key_here`}
                </pre>
              </div>

              {/* Other Operations */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Other Operations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-900 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1 font-medium">Set Monthly Allocation</p>
                    <pre className="text-xs text-green-400">
{`{
  "partnerEmail": "...",
  "operation": "set_monthly",
  "monthlyAllocation": 300,
  "reason": "Updated plan"
}`}
                    </pre>
                  </div>
                  <div className="bg-gray-900 p-3 rounded">
                    <p className="text-xs text-gray-400 mb-1 font-medium">Stop Monthly Allocation</p>
                    <pre className="text-xs text-green-400">
{`{
  "partnerEmail": "...",
  "operation": "stop_monthly",
  "reason": "Plan cancelled"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Response Format */}
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">Response Format</h3>
                <p className="text-gray-300 text-sm mb-2">All responses follow this structure:</p>
                <pre className="bg-gray-900 p-3 rounded text-xs text-green-400 overflow-x-auto">
{`{
  "success": true,
  "message": "Successfully added 500 credits for Acme Corp",
  "data": {
    "partnerEmail": "partner@example.com",
    "partnerId": "uuid-...",
    "operation": "add",
    "amount": 500,
    "newBalance": 1500,
    "reason": "Welcome bonus",
    "timestamp": "2026-03-14T10:00:00.000Z"
  }
}`}
                </pre>
              </div>

              {/* Tips */}
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
                <h4 className="text-yellow-400 font-medium mb-2">💡 Tips</h4>
                <ul className="text-sm text-yellow-200/80 space-y-1 list-disc list-inside">
                  <li>API keys start with <code className="bg-gray-800 px-1 rounded">ack_</code> prefix</li>
                  <li>The full API key is only shown once at creation — store it securely</li>
                  <li>You can set rate limits and daily limits when creating a key</li>
                  <li>Revoked keys can be reactivated from Settings → Credit API Keys</li>
                  <li>All operations are logged in the partner&apos;s transaction history</li>
                  <li>Use <code className="bg-gray-800 px-1 rounded">metadata</code> field to attach custom data (e.g. CRM deal ID)</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Active Recurring Grants */}
        {recurringGrants.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Active Recurring Grants</h2>
                <p className="text-gray-400 text-sm">Monthly recurring credit grants currently active</p>
              </div>
              <button
                onClick={fetchRecurringGrants}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors"
              >
                <FiRefreshCw className="text-sm" />
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Partner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Monthly Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Granted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Next Grant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {recurringGrants.map((grant) => (
                    <tr key={grant.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-white">{grant.partnerName}</div>
                          <div className="text-sm text-gray-400">{grant.partnerEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {formatNumber(grant.creditsGranted)}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {formatNumber(grant.totalGranted)}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {grant.nextGrantDate ? new Date(grant.nextGrantDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {grant.recurringEndDate ? new Date(grant.recurringEndDate).toLocaleDateString() : 'No end date'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            if (confirm('Are you sure you want to cancel this recurring grant?')) {
                              try {
                                const response = await fetch(`/api/admin/credits/recurring-grants?grantId=${grant.id}`, {
                                  method: 'DELETE'
                                });
                                const data = await response.json();
                                if (data.success) {
                                  fetchRecurringGrants();
                                  fetchPartners();
                                  toast({
                                    title: "Success",
                                    description: 'Recurring grant cancelled successfully',
                                  });
                                } else {
                                  toast({
                                    title: "Error",
                                    description: data.error || 'Failed to cancel grant',
                                    variant: "destructive"
                                  });
                                }
                              } catch (error) {
                                toast({
                                  title: "Network Error",
                                  description: 'Error cancelling grant. Please try again.',
                                  variant: "destructive"
                                });
                              }
                            }
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Partners Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold">Partners</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Partner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Credit Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Monthly Allocation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usage Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {partners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-white">{partner.businessName}</div>
                        <div className="text-sm text-gray-400">{partner.emailAddress}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium ${partner.isLowCredit ? 'text-red-400' : 'text-white'}`}>
                        {formatNumber(partner.creditBalance)}
                        {partner.isLowCredit && <FiAlertTriangle className="inline ml-1 text-red-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {formatNumber(partner.monthlyCreditAllocation)}
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {partner.usageRate}%
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        partner.approvalStatus === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {partner.approvalStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedPartner(partner);
                            setCreditOperation('add');
                            setShowCreditModal(true);
                          }}
                          className="p-1 text-green-400 hover:text-green-300"
                          title="Add Credits"
                        >
                          <FiPlus />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPartner(partner);
                            setCreditOperation('deduct');
                            setShowCreditModal(true);
                          }}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Deduct Credits"
                        >
                          <FiMinus />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPartner(partner);
                            setCreditOperation('set_monthly');
                            setMonthlyAllocation(partner.monthlyCreditAllocation.toString());
                            setShowCreditModal(true);
                          }}
                          className="p-1 text-blue-400 hover:text-blue-300"
                          title="Set Monthly Allocation"
                        >
                          <FiCalendar />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPartner(partner);
                            setCreditOperation('stop_monthly');
                            setShowCreditModal(true);
                          }}
                          className="p-1 text-orange-400 hover:text-orange-300"
                          title="Stop Monthly Allocation"
                        >
                          <FiStopCircle />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-gray-300"
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Enhanced Credit Operation Modal */}
        {showCreditModal && selectedPartner && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-4">
                {creditOperation === 'add' && 'Add Credits'}
                {creditOperation === 'deduct' && 'Deduct Credits'}
                {creditOperation === 'set_monthly' && 'Set Monthly Allocation'}
                {creditOperation === 'stop_monthly' && 'Stop Monthly Allocation'}
              </h3>

              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Partner: {selectedPartner.businessName}</p>
                <p className="text-sm text-gray-400">Current Balance: {formatNumber(selectedPartner.creditBalance)}</p>
                <p className="text-sm text-gray-400">Monthly Allocation: {formatNumber(selectedPartner.monthlyCreditAllocation)}</p>
              </div>

              {/* Amount field for add/deduct operations */}
              {(creditOperation === 'add' || creditOperation === 'deduct') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Enter amount"
                  />
                </div>
              )}

              {/* Grant type selection for add operation */}
              {creditOperation === 'add' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Credit Type</label>
                  <select
                    value={grantType}
                    onChange={(e) => setGrantType(e.target.value as 'one_time' | 'monthly_recurring')}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="one_time">One-time Credit</option>
                    <option value="monthly_recurring">Monthly Recurring Credit</option>
                  </select>
                </div>
              )}

              {/* Recurring duration for monthly recurring credits */}
              {creditOperation === 'add' && grantType === 'monthly_recurring' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Duration (Months)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={recurringMonths}
                    onChange={(e) => setRecurringMonths(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Enter number of months (1-60)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Credits will be added monthly for this duration
                  </p>
                </div>
              )}

              {/* Monthly allocation field for set_monthly operation */}
              {creditOperation === 'set_monthly' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Monthly Allocation</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyAllocation}
                    onChange={(e) => setMonthlyAllocation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="Enter monthly allocation amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Set to 0 to disable monthly allocation
                  </p>
                </div>
              )}

              {/* Warning for stop_monthly operation */}
              {creditOperation === 'stop_monthly' && (
                <div className="mb-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                  <p className="text-sm text-orange-300">
                    ⚠️ This will stop all monthly credit allocations and cancel any active recurring grants for this partner.
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Reason</label>
                <textarea
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter reason for this operation"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreditModal(false);
                    resetModalState();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreditOperation}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    creditOperation === 'add'
                      ? 'bg-green-600 hover:bg-green-700'
                      : creditOperation === 'deduct'
                      ? 'bg-red-600 hover:bg-red-700'
                      : creditOperation === 'set_monthly'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {creditOperation === 'add' && 'Add Credits'}
                  {creditOperation === 'deduct' && 'Deduct Credits'}
                  {creditOperation === 'set_monthly' && 'Set Allocation'}
                  {creditOperation === 'stop_monthly' && 'Stop Allocation'}
                </button>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
