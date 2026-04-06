'use client';

import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import MarketingWebhookKeyManager from '@/components/admin/MarketingWebhookKeyManager';
import TierConfigurationManager from '@/components/admin/TierConfigurationManager';
import PageVideoManager from '@/components/admin/PageVideoManager';
import DailyChallengesManager from '@/components/admin/DailyChallengesManager';
// import { PrismaClient } // Unused from '@prisma/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Users, UserCheck, Clock, TrendingUp } from 'lucide-react';
// Custom loading spinner component

interface DashboardStats {
  waitlistCount: number;
  partnerCount: number;
  customerCount: number;
  growthData: {
    date: string;
    partners: number;
  }[];
}

export default function AdminDashboard() {
  const { user } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/dashboard-stats');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard statistics');
        }
        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        console.error('Error fetching dashboard stats:', err);
        setError(err.message || 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600"></div>
            </div>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <p className="text-red-600">{error}</p>
              </CardContent>
            </Card>
          ) : stats ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Waitlist Users
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.waitlistCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Users waiting for access
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Active Partners
                    </CardTitle>
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.partnerCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Registered partner businesses
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Customers
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.customerCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Total end customers
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="growth" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="growth">Partner Growth</TabsTrigger>
                  <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
                  <TabsTrigger value="webhook-keys">Marketing Webhook Keys</TabsTrigger>
                  <TabsTrigger value="tier-config">Tier Configuration</TabsTrigger>
                  <TabsTrigger value="video-management">Video Management</TabsTrigger>
                  <TabsTrigger value="daily-challenges">Daily Challenges</TabsTrigger>
                </TabsList>
                <TabsContent value="growth" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Partner Growth Over Time</CardTitle>
                      <CardDescription>
                        Number of new partners registered by month
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={stats.growthData}
                            margin={{
                              top: 5,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="partners"
                              stroke="#3B82F6"
                              activeDot={{ r: 8 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="usage" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Agent Usage</CardTitle>
                      <CardDescription>
                        Voice AI and telephony usage across all partners
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'VAPI', usage: 4300 },
                              { name: 'Retell', usage: 2800 },
                            ]}
                            margin={{
                              top: 5,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="usage" fill="#10B981" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="webhook-keys" className="space-y-4">
                  <MarketingWebhookKeyManager />
                </TabsContent>
                <TabsContent value="tier-config" className="space-y-4">
                  <TierConfigurationManager />
                </TabsContent>
                <TabsContent value="video-management" className="space-y-4">
                  <PageVideoManager />
                </TabsContent>
                <TabsContent value="daily-challenges" className="space-y-4">
                  <DailyChallengesManager />
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
