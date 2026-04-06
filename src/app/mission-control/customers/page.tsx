'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  Search, 
  Mail, 
  Users,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: string;
  partnerId?: string;
  partnerName?: string;
  lastActive?: string;
}

export default function CustomersPage() {
  const { user } = useAdminAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        
        // Fetch customers from the API
        const response = await fetch('/api/admin/customers');
        if (!response.ok) {
          throw new Error('Failed to fetch customers');
        }
        const data = await response.json();
        
        // Use the data from the API
        const customersData = Array.isArray(data) ? data : (data.customers || []);
        
        setCustomers(customersData);
        setFilteredCustomers(customersData);
      } catch (err) {
        console.error('Error fetching customers:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching customers';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchCustomers();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.email.toLowerCase().includes(query) ||
          (customer.partnerName && customer.partnerName.toLowerCase().includes(query))
      );
      setFilteredCustomers(filtered);
    }
  }, [searchQuery, customers]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">{status}</Badge>;
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
            <h1 className="text-3xl font-bold tracking-tight">Customer Management</h1>
            <div className="text-sm text-gray-500">
              Total: {customers.length} customers
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Customers</CardTitle>
              <CardDescription>
                View and manage end customers using Knotie-AI through partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Search by name, email, or partner..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={handleSearch}
                  />
                </div>
                <Link href="/mission-control/email">
                  <Button>
                    <Mail className="mr-2 h-4 w-4" />
                    Email Campaign
                  </Button>
                </Link>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600"></div>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium">No customers found</h3>
                  {searchQuery ? (
                    <p>No results match your search criteria. Try a different search term.</p>
                  ) : (
                    <p>There are no customers in the system yet.</p>
                  )}
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Date Added</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.email}</TableCell>
                          <TableCell>{customer.partnerName || 'N/A'}</TableCell>
                          <TableCell>
                            {format(new Date(customer.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            {customer.lastActive ? format(new Date(customer.lastActive), 'MMM d, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>{getStatusBadge(customer.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <Link href={`/mission-control/customers/${customer.id}`}>
                                  <DropdownMenuItem>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    <span>View Details</span>
                                  </DropdownMenuItem>
                                </Link>
                                <Link href={`/mission-control/email?recipient=${customer.id}&type=customer`}>
                                  <DropdownMenuItem>
                                    <Mail className="mr-2 h-4 w-4" />
                                    <span>Send Email</span>
                                  </DropdownMenuItem>
                                </Link>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
