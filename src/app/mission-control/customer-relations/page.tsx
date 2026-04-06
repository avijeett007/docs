'use client';

import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { 
  Search, 
  AlertTriangle, 
  // CheckCircle, // Unused 
  Users, 
  Link2, 
  Phone,
  RefreshCw,
  Eye,
  Wrench
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CustomerAnalysis {
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    userId: string;
  };
  relationships: {
    userOnboarding: Array<{
      partnerId: string;
      partnerName: string;
      hasCustomerId: boolean;
      userOnboardingId: string;
    }>;
    credentials: Array<{
      partnerId: string;
      partnerName: string;
      credentialId: string;
    }>;
    phoneNumbers: Array<{
      partnerId: string;
      phoneNumber: string;
      status: string;
    }>;
  };
  issues: {
    orphanedUserOnboarding: Array<{
      partnerId: string;
      partnerName: string;
      hasCustomerId: boolean;
      userOnboardingId: string;
    }>;
    phoneNumbersWithoutAccess: Array<{
      partnerId: string;
      phoneNumber: string;
      status: string;
    }>;
    hasIssues: boolean;
  };
}

interface CustomerSummary {
  totalCustomers: number;
  customersWithIssues: number;
  totalOrphanedUserOnboarding: number;
  totalPhoneNumbersWithoutAccess: number;
}

export default function CustomerRelationsPage() {
  const { user } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAnalysis | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [fixingCustomer, setFixingCustomer] = useState<string | null>(null);
  const [bulkAnalysis, setBulkAnalysis] = useState<CustomerAnalysis[]>([]);
  const [showBulkAnalysis, setShowBulkAnalysis] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Load summary statistics on page load
  useEffect(() => {
    if (user) {
      loadSummary();
    }
  }, [user]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const response = await fetch('/api/admin/customer-relations');

      if (response.status === 401) {
        setAuthError('Authentication failed. Please log out and log back in to Mission Control.');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSummary(data.data);
      } else {
        setAuthError(data.error || 'Failed to load summary');
      }
    } catch (error) {
      console.error('Error loading summary:', error);
      setAuthError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/customer-relations?action=search&query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeCustomer = async (customerId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/customer-relations?action=analyze&customerId=${customerId}`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        setSelectedCustomer(data.data[0]);
      }
    } catch (error) {
      console.error('Error analyzing customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixCustomerRelationships = async (customerId: string) => {
    try {
      setFixingCustomer(customerId);
      const response = await fetch('/api/admin/customer-relations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fix-all-for-customer',
          customerId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully fixed ${data.data.count} customer relationships!`);
        // Refresh the customer analysis
        await analyzeCustomer(customerId);
        // Refresh summary
        await loadSummary();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fixing customer relationships:', error);
      alert('Error fixing customer relationships');
    } finally {
      setFixingCustomer(null);
    }
  };

  const fixSingleRelationship = async (customerId: string, userOnboardingId: string) => {
    try {
      const response = await fetch('/api/admin/customer-relations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fix-customer-link',
          customerId,
          userOnboardingId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Customer relationship fixed successfully!');
        // Refresh the customer analysis
        await analyzeCustomer(customerId);
        // Refresh summary
        await loadSummary();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fixing single relationship:', error);
      alert('Error fixing relationship');
    }
  };

  const runBulkAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/customer-relations?action=analyze');
      const data = await response.json();

      if (data.success) {
        setBulkAnalysis(data.data);
        setShowBulkAnalysis(true);
      }
    } catch (error) {
      console.error('Error running bulk analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Customer Relations Manager</h1>
            <Button onClick={loadSummary} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Authentication Error */}
          {authError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {authError}
              </AlertDescription>
            </Alert>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalCustomers}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Customers with Issues</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{summary.customersWithIssues}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Broken UserOnboarding Links</CardTitle>
                  <Link2 className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{summary.totalOrphanedUserOnboarding}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Phone Numbers Without Access</CardTitle>
                  <Phone className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{summary.totalPhoneNumbersWithoutAccess}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search Section */}
          <Card>
            <CardHeader>
              <CardTitle>Search Customers</CardTitle>
              <CardDescription>
                Search for customers by email, first name, or last name to analyze their relationships
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email, first name, or last name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchCustomers()}
                />
                <Button onClick={searchCustomers} disabled={loading || !searchQuery.trim()}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Search Results:</h3>
                  {searchResults.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-4 border-2 rounded-lg bg-white border-gray-300 shadow-lg hover:shadow-xl transition-shadow">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-xl">{customer.email}</div>
                        <div className="text-base text-gray-800 mt-2">
                          <span className="font-semibold">{customer.firstName} {customer.lastName}</span>
                          <span className="mx-3 text-gray-600">•</span>
                          <span className="font-mono text-sm bg-gray-800 text-white px-3 py-1 rounded font-bold border-2 border-gray-600">ID: {customer.id}</span>
                        </div>
                        <div className="text-sm text-gray-700 mt-2 font-medium">
                          Created: {new Date(customer.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => analyzeCustomer(customer.id)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg font-semibold px-6 py-3"
                      >
                        <Eye className="h-5 w-5 mr-2" />
                        Analyze
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bulk Analysis Section */}
          <Card>
            <CardHeader>
              <CardTitle>Bulk Analysis</CardTitle>
              <CardDescription>
                Analyze all customers to find relationship issues across the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button onClick={runBulkAnalysis} disabled={loading}>
                  <Users className="h-4 w-4 mr-2" />
                  Analyze All Customers
                </Button>
                {showBulkAnalysis && (
                  <Button
                    variant="outline"
                    onClick={() => setShowBulkAnalysis(false)}
                  >
                    Hide Results
                  </Button>
                )}
              </div>

              {showBulkAnalysis && bulkAnalysis.length > 0 && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Found {bulkAnalysis.filter(a => a.issues.hasIssues).length} customers with issues out of {bulkAnalysis.length} analyzed
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {bulkAnalysis
                      .filter(analysis => analysis.issues.hasIssues)
                      .map((analysis) => (
                        <div key={analysis.customer.id} className="flex items-center justify-between p-4 border-2 rounded-lg bg-white border-red-400 shadow-lg hover:shadow-xl transition-shadow">
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 text-xl">{analysis.customer.email}</div>
                            <div className="text-base text-gray-800 mt-2">
                              <span className="font-semibold">{analysis.customer.firstName} {analysis.customer.lastName}</span>
                              <span className="mx-3 text-gray-600">•</span>
                              <span className="font-mono text-sm bg-gray-800 text-white px-3 py-1 rounded font-bold border-2 border-gray-600">ID: {analysis.customer.id}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {analysis.issues.orphanedUserOnboarding.length > 0 && (
                                <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-bold bg-red-200 text-red-900 border-2 border-red-400">
                                  <AlertTriangle className="h-4 w-4 mr-2" />
                                  {analysis.issues.orphanedUserOnboarding.length} broken UserOnboarding links
                                </span>
                              )}
                              {analysis.issues.phoneNumbersWithoutAccess.length > 0 && (
                                <span className="inline-flex items-center px-3 py-2 rounded-full text-sm font-bold bg-yellow-200 text-amber-900 border-2 border-yellow-400">
                                  <Phone className="h-4 w-4 mr-2" />
                                  {analysis.issues.phoneNumbersWithoutAccess.length} phone numbers without access
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-3 ml-4">
                            <Button
                              size="lg"
                              variant="outline"
                              onClick={() => {
                                setSelectedCustomer(analysis);
                                setShowBulkAnalysis(false);
                              }}
                              className="border-2 border-blue-600 text-blue-800 hover:bg-blue-100 font-semibold px-4 py-2"
                            >
                              <Eye className="h-5 w-5 mr-2" />
                              View Details
                            </Button>
                            <Button
                              size="lg"
                              onClick={() => fixCustomerRelationships(analysis.customer.id)}
                              disabled={fixingCustomer === analysis.customer.id}
                              className="bg-green-600 hover:bg-green-700 text-white shadow-lg font-semibold px-4 py-2"
                            >
                              <Wrench className={`h-5 w-5 mr-2 ${fixingCustomer === analysis.customer.id ? 'animate-spin' : ''}`} />
                              Fix
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Analysis */}
          {selectedCustomer && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Customer Analysis</CardTitle>
                    <CardDescription>
                      {selectedCustomer.customer.email} • ID: {selectedCustomer.customer.id}
                    </CardDescription>
                  </div>
                  {selectedCustomer.issues.hasIssues && (
                    <Button
                      onClick={() => fixCustomerRelationships(selectedCustomer.customer.id)}
                      disabled={fixingCustomer === selectedCustomer.customer.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Wrench className={`h-4 w-4 mr-2 ${fixingCustomer === selectedCustomer.customer.id ? 'animate-spin' : ''}`} />
                      Fix All Issues
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Info */}
                <div>
                  <h3 className="font-medium mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>Email:</strong> {selectedCustomer.customer.email}</div>
                    <div><strong>Name:</strong> {selectedCustomer.customer.firstName} {selectedCustomer.customer.lastName}</div>
                    <div><strong>User ID:</strong> {selectedCustomer.customer.userId}</div>
                    <div><strong>Customer ID:</strong> {selectedCustomer.customer.id}</div>
                  </div>
                </div>

                {/* Issues Alert */}
                {selectedCustomer.issues.hasIssues && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div>This customer has relationship issues that may prevent partners from accessing their data:</div>
                        {selectedCustomer.issues.orphanedUserOnboarding.length > 0 && (
                          <div>• {selectedCustomer.issues.orphanedUserOnboarding.length} UserOnboarding record(s) without customer links</div>
                        )}
                        {selectedCustomer.issues.phoneNumbersWithoutAccess.length > 0 && (
                          <div>• {selectedCustomer.issues.phoneNumbersWithoutAccess.length} phone number(s) without proper partner access</div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Issues Summary */}
                {selectedCustomer.issues.hasIssues && (
                  <div>
                    <h3 className="font-medium mb-2 text-red-600">Detected Issues</h3>
                    <div className="space-y-2">
                      {selectedCustomer.issues.orphanedUserOnboarding.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded">
                          <div className="font-medium text-red-800">Broken UserOnboarding Links</div>
                          <div className="text-sm text-red-600">
                            {selectedCustomer.issues.orphanedUserOnboarding.length} UserOnboarding record(s) are not linked to this customer,
                            preventing partners from seeing customer data like phone numbers.
                          </div>
                        </div>
                      )}
                      {selectedCustomer.issues.phoneNumbersWithoutAccess.length > 0 && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="font-medium text-amber-800">Phone Numbers Without Access</div>
                          <div className="text-sm text-amber-600">
                            {selectedCustomer.issues.phoneNumbersWithoutAccess.length} phone number(s) cannot be accessed by their associated partners
                            due to missing relationship records.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* UserOnboarding Relationships */}
                <div>
                  <h3 className="font-medium mb-2">UserOnboarding Relationships</h3>
                  {selectedCustomer.relationships.userOnboarding.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCustomer.relationships.userOnboarding.map((uo, index) => (
                        <div key={index} className={`flex items-center justify-between p-4 border-2 rounded-lg shadow-lg ${
                          uo.hasCustomerId
                            ? 'bg-white border-green-400'
                            : 'bg-white border-red-400'
                        }`}>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 text-lg">{uo.partnerName}</div>
                            <div className="text-base text-gray-800 mt-1 font-medium">Partner ID: {uo.partnerId}</div>
                            <div className="text-sm text-white font-mono bg-gray-800 px-3 py-1 rounded mt-2 inline-block font-bold border-2 border-gray-600">
                              UserOnboarding ID: {uo.userOnboardingId}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <Badge variant={uo.hasCustomerId ? "default" : "destructive"} className={
                              uo.hasCustomerId
                                ? "bg-green-200 text-green-900 border-2 border-green-400 px-3 py-2 text-sm font-bold"
                                : "bg-red-200 text-red-900 border-2 border-red-400 px-3 py-2 text-sm font-bold"
                            }>
                              {uo.hasCustomerId ? "✓ Linked" : "⚠ Broken Link"}
                            </Badge>
                            {!uo.hasCustomerId && (
                              <Button
                                size="lg"
                                variant="outline"
                                onClick={() => fixSingleRelationship(selectedCustomer.customer.id, uo.userOnboardingId)}
                                disabled={loading}
                                className="border-2 border-green-600 text-green-800 hover:bg-green-100 font-semibold px-4 py-2"
                              >
                                <Wrench className="h-4 w-4 mr-2" />
                                Fix
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No UserOnboarding relationships found</p>
                  )}
                </div>

                {/* Customer Credentials */}
                <div>
                  <h3 className="font-medium mb-2">Customer Credentials</h3>
                  {selectedCustomer.relationships.credentials.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCustomer.relationships.credentials.map((cred, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{cred.partnerName}</div>
                            <div className="text-sm text-gray-500">Partner ID: {cred.partnerId}</div>
                          </div>
                          <Badge variant="default">Active</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No customer credentials found</p>
                  )}
                </div>

                {/* Phone Numbers */}
                <div>
                  <h3 className="font-medium mb-2">Phone Numbers</h3>
                  {selectedCustomer.relationships.phoneNumbers.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCustomer.relationships.phoneNumbers.map((pn, index) => {
                        const hasAccess = selectedCustomer.issues.phoneNumbersWithoutAccess.find(
                          issue => issue.phoneNumber === pn.phoneNumber
                        ) === undefined;

                        return (
                          <div key={index} className={`flex items-center justify-between p-2 border rounded ${!hasAccess ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                            <div>
                              <div className="font-medium">{pn.phoneNumber}</div>
                              <div className="text-sm text-gray-500">Partner ID: {pn.partnerId}</div>
                              {!hasAccess && (
                                <div className="text-xs text-amber-600">⚠️ Partner cannot access this phone number</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={pn.status === 'active' ? "default" : "secondary"}>
                                {pn.status}
                              </Badge>
                              {!hasAccess && (
                                <Badge variant="outline" className="text-amber-600 border-yellow-300">
                                  No Access
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500">No phone numbers found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
