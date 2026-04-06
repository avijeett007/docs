'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiEdit2,
  FiUser,
  FiSettings,
  FiBarChart2,
  FiMessageSquare,
  FiKey,
  FiGlobe
} from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';

interface CustomerDetailProps {
  params: {
    customerId: string;
  };
}

interface CustomerData {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  monthlyCallVolume: string;
  estimatedPrice: number;
  priceBreakdown: string;
  orderStatus: string;
  userId: string;
  isOnboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  dealStatus?: string;
  billingType?: string;
  agreedPrice?: number | null;
  enableAdvancedAnalytics?: boolean;
  enableDetailedCallAnalysis?: boolean;
  enableActionPointAnalysis?: boolean;
  customerPortalEnabled?: boolean;
  showKnowledgeBase?: boolean;
  showIntegration?: boolean;
  showDocsAndMedia?: boolean;
  showScheduleMeeting?: boolean;
  showPricingInformation?: boolean;
  maxTeamMembers?: number;
  enableTeamMembers?: boolean;
}

export default function CustomerDetail({ params }: CustomerDetailProps) {
  const { customerId } = params;
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState('Partner');

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
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

        const response = await fetch(`/api/partner/customers/${customerId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cookie': `partner_token=${token}`
          }
        });

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
        toast.error('Failed to fetch customer details');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [customerId, router]);

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={() => {
        localStorage.removeItem('partner_token');
        router.push('/partner/login');
      }}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </PartnerLayout>
    );
  }

  if (!customer) {
    return notFound();
  }

  const customerName = customer.companyName ||
    (customer.firstName && customer.lastName ?
      `${customer.firstName} ${customer.lastName}` :
      customer.email);

  return (
    <PartnerLayout partnerName={partnerName} onLogout={() => {
      localStorage.removeItem('partner_token');
      router.push('/partner/login');
    }}>
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/partner/customers">
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{customerName}</h1>
          <Badge variant={customer.customerPortalEnabled ? "default" : "secondary"}>
            {customer.customerPortalEnabled ? "Portal Enabled" : "Portal Disabled"}
          </Badge>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <FiUser className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="settings">
              <FiSettings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="analytics" disabled={!customer.enableAdvancedAnalytics}>
              <FiBarChart2 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="conversations">
              <FiMessageSquare className="h-4 w-4 mr-2" />
              Conversations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
                <CardDescription>Basic information about the customer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Name</h3>
                    <p className="text-lg">{customer.firstName} {customer.lastName}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Company</h3>
                    <p className="text-lg">{customer.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Email</h3>
                    <p className="text-lg">{customer.email}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Monthly Call Volume</h3>
                    <p className="text-lg">{customer.monthlyCallVolume}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Order Status</h3>
                    <p className="text-lg">{customer.orderStatus}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Deal Status</h3>
                    <p className="text-lg">{customer.dealStatus || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing Information</CardTitle>
                <CardDescription>Pricing details for this customer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Estimated Price</h3>
                    <p className="text-lg">${customer.estimatedPrice?.toLocaleString() || '0'}/month</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Billing Type</h3>
                    <p className="text-lg">{customer.billingType || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Agreed Price</h3>
                    <p className="text-lg">${customer.agreedPrice?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Features</CardTitle>
                  <CardDescription>Enabled features for this customer</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between">
                      <span>Advanced Analytics</span>
                      <Badge variant={customer.enableAdvancedAnalytics ? "default" : "secondary"}>
                        {customer.enableAdvancedAnalytics ? "Enabled" : "Disabled"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Detailed Call Analysis</span>
                      <Badge variant={customer.enableDetailedCallAnalysis ? "default" : "secondary"}>
                        {customer.enableDetailedCallAnalysis ? "Enabled" : "Disabled"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Action Point Analysis</span>
                      <Badge variant={customer.enableActionPointAnalysis ? "default" : "secondary"}>
                        {customer.enableActionPointAnalysis ? "Enabled" : "Disabled"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Team Members</span>
                      <Badge variant={customer.enableTeamMembers ? "default" : "secondary"}>
                        {customer.enableTeamMembers ? `Enabled (${customer.maxTeamMembers || 0})` : "Disabled"}
                      </Badge>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Portal Settings</CardTitle>
                  <CardDescription>Customer portal configuration</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between">
                      <span>Customer Portal</span>
                      <Badge variant={customer.customerPortalEnabled ? "default" : "secondary"}>
                        {customer.customerPortalEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Knowledge Base</span>
                      <Badge variant={customer.showKnowledgeBase ? "default" : "secondary"}>
                        {customer.showKnowledgeBase ? "Visible" : "Hidden"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Integration</span>
                      <Badge variant={customer.showIntegration ? "default" : "secondary"}>
                        {customer.showIntegration ? "Visible" : "Hidden"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Docs & Media</span>
                      <Badge variant={customer.showDocsAndMedia ? "default" : "secondary"}>
                        {customer.showDocsAndMedia ? "Visible" : "Hidden"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Schedule Meeting</span>
                      <Badge variant={customer.showScheduleMeeting ? "default" : "secondary"}>
                        {customer.showScheduleMeeting ? "Visible" : "Hidden"}
                      </Badge>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Pricing Information</span>
                      <Badge variant={customer.showPricingInformation ? "default" : "secondary"}>
                        {customer.showPricingInformation ? "Visible" : "Hidden"}
                      </Badge>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:bg-gray-800/30 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FiEdit2 className="h-5 w-5 mr-2" />
                    Edit Customer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 mb-4">
                    Update customer information and settings
                  </p>
                  <Button asChild>
                    <Link href={`/partner/customers/${customerId}/edit`}>
                      Edit Customer
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className={`hover:bg-gray-800/30 transition-colors ${!customer.enableAdvancedAnalytics ? 'opacity-50' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FiKey className="h-5 w-5 mr-2" />
                    API Keys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 mb-4">
                    Manage API keys for this customer
                  </p>
                  <Button asChild disabled={!customer.enableAdvancedAnalytics}>
                    <Link href={`/partner/customers/${customerId}/api-keys`}>
                      Manage API Keys
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className={`hover:bg-gray-800/30 transition-colors ${!customer.customerPortalEnabled ? 'opacity-50' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FiGlobe className="h-5 w-5 mr-2" />
                    Portal Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 mb-4">
                    Manage customer portal access
                  </p>
                  <Button asChild disabled={!customer.customerPortalEnabled}>
                    <Link href={`/partner/customers/${customerId}/portal`}>
                      Manage Portal
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Customer Settings</CardTitle>
                <CardDescription>Manage customer settings</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Settings content will be implemented in a future update.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>Customer analytics and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Analytics content will be implemented in a future update.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversations">
            <Card>
              <CardHeader>
                <CardTitle>Conversations</CardTitle>
                <CardDescription>Customer conversation history</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Conversations content will be implemented in a future update.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PartnerLayout>
  );
}
