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
  Clock,
  AlertCircle,
  UserCheck,
  Trash
} from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

interface WaitlistUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: string;
  businessName?: string;
  businessType?: string;
  waitlistNumber?: number;
  becamePartner?: boolean;
  daysSinceJoined?: number;
  referralCount?: number;
}

export default function WaitlistPage() {
  const { user } = useAdminAuth();
  const [waitlistUsers, setWaitlistUsers] = useState<WaitlistUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<WaitlistUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWaitlistUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/waitlist');
        if (!response.ok) {
          throw new Error('Failed to fetch waitlist users');
        }
        const data = await response.json();

        if (data.success && data.data) {
          // Transform data to match our interface
          const formattedData = data.data.members.map((member: any) => ({
            id: member.id,
            name: member.name || 'Unknown',
            email: member.email,
            createdAt: member.createdAt,
            status: member.status || 'PENDING',
            businessName: member.partnerInfo?.businessName,
            businessType: member.source,
            waitlistNumber: member.position,
            becamePartner: member.becamePartner,
            daysSinceJoined: member.daysSinceJoined,
            referralCount: member.referralCount || 0,
          }));

          setWaitlistUsers(formattedData);
          setFilteredUsers(formattedData);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching waitlist users:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching waitlist users';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchWaitlistUsers();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(waitlistUsers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = waitlistUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.businessName && user.businessName.toLowerCase().includes(query))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, waitlistUsers]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return <Badge className="bg-green-500 text-white font-semibold border-green-600">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-500 text-white font-semibold border-red-600">Rejected</Badge>;
      case 'PENDING':
      default:
        return <Badge className="bg-yellow-500 text-white font-semibold border-yellow-600">Pending</Badge>;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />
      <div className="flex-1 overflow-auto bg-gray-900">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-white">Waitlist Management</h1>
            <div className="text-sm text-gray-400">
              Total: {waitlistUsers.length} users
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Waitlist Users</CardTitle>
              <CardDescription className="text-gray-400">
                Manage users who have signed up for the waitlist
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Search by name, email, or business..."
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
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium">No waitlist users found</h3>
                  {searchQuery ? (
                    <p>No results match your search criteria. Try a different search term.</p>
                  ) : (
                    <p>There are no users on the waitlist yet.</p>
                  )}
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waitlist #</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Date Added</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((waitlistUser) => (
                        <TableRow key={waitlistUser.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              #{waitlistUser.waitlistNumber || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{waitlistUser.name}</TableCell>
                          <TableCell>{waitlistUser.email}</TableCell>
                          <TableCell>{waitlistUser.businessName || 'N/A'}</TableCell>
                          <TableCell>
                            {format(new Date(waitlistUser.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{getStatusBadge(waitlistUser.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <Link href={`/mission-control/email?recipient=${waitlistUser.id}&type=waitlist`}>
                                  <DropdownMenuItem>
                                    <Mail className="mr-2 h-4 w-4" />
                                    <span>Send Email</span>
                                  </DropdownMenuItem>
                                </Link>
                                <DropdownMenuItem>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  <span>Approve</span>
                                </DropdownMenuItem>
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
