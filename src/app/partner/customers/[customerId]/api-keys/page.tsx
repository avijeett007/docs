'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import Head from 'next/head';
import ApiKeyManager from '@/components/partner/ApiKeyManager';
import NeonContainer from '@/components/NeonContainer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { FiArrowLeft, FiKey, FiAlertCircle, FiLock, FiUser, FiShield } from 'react-icons/fi';

// Note: Metadata can't be exported from a client component
// The page title will be set by the browser based on the h1 content

interface CustomerApiKeysPageProps {
  params: {
    customerId: string;
  };
}

export default function CustomerApiKeysPage({ params }: CustomerApiKeysPageProps) {
  const { customerId } = params;
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState('Partner');

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        // Get partner token from localStorage
        const token = localStorage.getItem('partner_token');
        if (!token) {
          router.push('/partner/login');
          return;
        }

        // Get partner name from localStorage
        const storedName = localStorage.getItem('partner_name');
        if (storedName) {
          setPartnerName(storedName);
        }

        // Fetch customer details
        const response = await fetch(`/api/partner/customers/${customerId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('partner_token');
          router.push('/partner/login');
          return;
        }

        if (!response.ok) {
          if (response.status === 404) {
            notFound();
          }
          throw new Error('Failed to fetch customer');
        }

        const data = await response.json();
        setCustomer(data.data);
      } catch (error) {
        console.error('Error fetching customer:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [customerId, router]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    router.push('/partner/login');
  };

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </PartnerLayout>
    );
  }

  if (!customer) {
    return notFound();
  }

  const customerName = customer.firstName && customer.lastName
    ? `${customer.firstName} ${customer.lastName}`
    : customer.email;

  return (
    <>
      <Head>
        <title>API Keys for {customerName} | Knotie AI Pro</title>
        <meta name="description" content="Manage API keys for your customer" />
      </Head>
      <PartnerLayout partnerName={partnerName} onLogout={handleLogout}>
        <div className="space-y-6">
          <div className="mb-6">
            <nav className="flex mb-4">
              <a href="/partner/dashboard" className="text-blue-400 hover:text-blue-300">Dashboard</a>
              <span className="mx-2 text-gray-500">/</span>
              <a href="/partner/customers" className="text-blue-400 hover:text-blue-300">Customers</a>
              <span className="mx-2 text-gray-500">/</span>
              <a href={`/partner/customers/${customerId}`} className="text-blue-400 hover:text-blue-300">{customerName}</a>
              <span className="mx-2 text-gray-500">/</span>
              <span className="text-gray-300">API Keys</span>
            </nav>

            <div className="flex items-center gap-4 mb-4">
              <Button variant="outline" size="sm" asChild className="bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700">
                <Link href={`/partner/customers/${customerId}`}>
                  <FiArrowLeft className="h-4 w-4 mr-2" />
                  Back to Customer
                </Link>
              </Button>
            </div>

            <h1 className="text-3xl font-bold text-white">API Keys for {customerName}</h1>
            <p className="text-gray-400 mt-1">
              Create and manage API keys for this customer to access the Knotie AI Pro API programmatically.
            </p>
          </div>

          <div className="grid gap-6">
            {/* Customer Info */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                    <FiUser className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Customer Information</h2>
                    <p className="text-gray-400 mt-1">API access details for {customerName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Customer Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">Name</label>
                        <p className="text-white">{customer.firstName} {customer.lastName}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Company</label>
                        <p className="text-white">{customer.companyName || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Email</label>
                        <p className="text-white">{customer.email}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">API Access</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400">API Access Status</label>
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                          customer.enableAdvancedAnalytics
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-700/50 text-gray-400'
                        }`}>
                          {customer.enableAdvancedAnalytics ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">Access Level</label>
                        <p className="text-white">Customer-scoped access</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400">API Features</label>
                        <ul className="text-gray-300 space-y-1 text-sm">
                          <li className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${customer.enableAdvancedAnalytics ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                            Analytics API
                          </li>
                          <li className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${customer.enableDetailedCallAnalysis ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                            Call Analysis API
                          </li>
                          <li className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${customer.enableActionPointAnalysis ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                            Action Points API
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </NeonContainer>

            {/* Security Information */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-yellow-500/20 rounded-lg mr-3">
                    <FiShield className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Security Information</h2>
                    <p className="text-gray-400 mt-1">Important security guidelines for customer API keys</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-gray-300">
                    Customer API keys allow your customers to authenticate requests to the Knotie AI Pro API. These keys are scoped to the customer's account and can only access their data.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <h3 className="text-white font-medium mb-2 flex items-center">
                        <FiLock className="mr-2 h-4 w-4 text-blue-400" />
                        Security Best Practices
                      </h3>
                      <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 pl-2">
                        <li>Customer API keys provide access to the customer's data via the API.</li>
                        <li>Advise your customers to store API keys securely and not expose them in client-side code.</li>
                        <li>You can revoke customer API keys at any time if needed.</li>
                        <li>Use IP restrictions when possible to limit access to trusted servers.</li>
                      </ul>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <h3 className="text-white font-medium mb-2 flex items-center">
                        <FiAlertCircle className="mr-2 h-4 w-4 text-amber-400" />
                        Important Considerations
                      </h3>
                      <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 pl-2">
                        <li>Customer API keys are scoped to this customer's account only.</li>
                        <li>API keys should be treated as sensitive credentials.</li>
                        <li>Rotate keys periodically for enhanced security.</li>
                        <li>Monitor API usage for unusual patterns.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </NeonContainer>

            {/* API Key Manager */}
            <NeonContainer>
              <div className="p-6">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                    <FiKey className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Customer API Keys</h2>
                    <p className="text-gray-400 mt-1">Manage API keys for {customerName}</p>
                  </div>
                </div>

                <ApiKeyManager customerId={customerId} />
              </div>
            </NeonContainer>
          </div>
        </div>
      </PartnerLayout>
    </>
  );
}
