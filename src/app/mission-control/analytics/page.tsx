'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
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
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mock data for analytics
const monthlyGrowthData = [
  { month: 'Jan', partners: 5, customers: 12 },
  { month: 'Feb', partners: 8, customers: 24 },
  { month: 'Mar', partners: 12, customers: 45 },
  { month: 'Apr', partners: 15, customers: 78 }
];

const usageData = [
  { name: 'Voice Calls', value: 4300 },
  { name: 'SMS', value: 2800 },
  { name: 'Email', value: 1800 },
  { name: 'Web Chat', value: 3200 }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const dailyUsageData = [
  { day: 'Mon', calls: 120, messages: 85 },
  { day: 'Tue', calls: 145, messages: 97 },
  { day: 'Wed', calls: 132, messages: 104 },
  { day: 'Thu', calls: 165, messages: 115 },
  { day: 'Fri', calls: 180, messages: 126 },
  { day: 'Sat', calls: 95, messages: 72 },
  { day: 'Sun', calls: 85, messages: 63 }
];

const partnerPerformanceData = [
  { name: 'Acme Corp', customers: 45, usage: 1250, revenue: 4500 },
  { name: 'XYZ Industries', customers: 32, usage: 980, revenue: 3200 },
  { name: 'Global Services', customers: 28, usage: 850, revenue: 2800 },
  { name: 'Tech Solutions', customers: 22, usage: 720, revenue: 2200 },
  { name: 'Innovate Inc', customers: 18, usage: 650, revenue: 1800 }
];

export default function AnalyticsPage() {
  const { user } = useAdminAuth();
  const [timeRange, setTimeRange] = useState('month');

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Time Range:</span>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="quarter">Last Quarter</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Partners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">15</div>
                <p className="text-xs text-muted-foreground">
                  +25% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">145</div>
                <p className="text-xs text-muted-foreground">
                  +38% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Interactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12,450</div>
                <p className="text-xs text-muted-foreground">
                  +42% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$14,500</div>
                <p className="text-xs text-muted-foreground">
                  +18% from last month
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="growth" className="space-y-4">
            <TabsList>
              <TabsTrigger value="growth">Growth</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
              <TabsTrigger value="partners">Partner Performance</TabsTrigger>
            </TabsList>
            
            <TabsContent value="growth" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Growth Over Time</CardTitle>
                  <CardDescription>
                    Monthly growth of partners and customers
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthlyGrowthData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="partners"
                          stroke="#3B82F6"
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="customers"
                          stroke="#10B981"
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="usage" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Usage Distribution</CardTitle>
                    <CardDescription>
                      Distribution of different interaction types
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={usageData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {usageData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Usage</CardTitle>
                    <CardDescription>
                      Daily calls and messages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dailyUsageData}
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="calls" fill="#3B82F6" />
                          <Bar dataKey="messages" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="partners" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Partner Performance</CardTitle>
                  <CardDescription>
                    Top performing partners by customers, usage, and revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={partnerPerformanceData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="customers" fill="#3B82F6" />
                        <Bar dataKey="usage" fill="#10B981" />
                        <Bar dataKey="revenue" fill="#F59E0B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
