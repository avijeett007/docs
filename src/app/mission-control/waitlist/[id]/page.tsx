'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { 
  ArrowLeft, 
  Mail, 
  Calendar, 
  Users, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

interface WaitlistMemberDetails {
  id: string;
  name: string;
  email: string;
  position: number;
  status: string;
  source: string;
  referralCode: string;
  referralCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  daysSinceJoined: number;
  becamePartner: boolean;
  partnerInfo?: {
    id: string;
    businessName: string;
    createdAt: string;
    subscriptionStatus: string;
    approvalStatus: string;
  };
  referrals: Array<{
    id: string;
    name: string;
    email: string;
    position: number;
  }>;
}

export default function WaitlistMemberDetailsPage() {
  const { user } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const [member, setMember] = useState<WaitlistMemberDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemberDetails = async () => {
      if (!params?.id || !user) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/admin/waitlist/${params?.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch member details');
        }
        const data = await response.json();
        setMember(data.data);
      } catch (err) {
        console.error('Error fetching member details:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMemberDetails();
  }, [params?.id, user]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'APPROVED': { className: 'bg-green-500 text-white font-semibold border-green-600', label: 'Approved' },
      'PENDING': { className: 'bg-yellow-500 text-white font-semibold border-yellow-600', label: 'Pending' },
      'REJECTED': { className: 'bg-red-500 text-white font-semibold border-red-600', label: 'Rejected' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white">Loading member details...</div>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <div className="flex-1 overflow-auto bg-gray-900">
          <div className="p-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Member not found'}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />
      <div className="flex-1 overflow-auto bg-gray-900">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-gray-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Waitlist
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  {member.name}
                </h1>
                <p className="text-gray-400">Waitlist Position #{member.position}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge(member.status)}
              {member.becamePartner && (
                <Badge className="bg-blue-500 text-white font-semibold border-blue-600">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Partner
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Information */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-3 text-gray-400" />
                    <span className="text-gray-300">{member.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-3 text-gray-400" />
                    <span className="text-gray-300">
                      Joined {format(new Date(member.createdAt), 'MMM d, yyyy')} 
                      <span className="text-gray-500 ml-2">({member.daysSinceJoined} days ago)</span>
                    </span>
                  </div>
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 mr-3 text-gray-400" />
                    <span className="text-gray-300">Source: {member.source || 'Unknown'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Partner Status */}
              {member.becamePartner && member.partnerInfo && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <UserCheck className="h-5 w-5 mr-2" />
                      Partner Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Business Name</p>
                      <p className="text-sm text-gray-200">{member.partnerInfo.businessName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">Became Partner</p>
                      <p className="text-sm text-gray-200">
                        {format(new Date(member.partnerInfo.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">Status</p>
                      <Badge 
                        className={
                          member.partnerInfo.approvalStatus === 'APPROVED' 
                            ? 'bg-green-500 text-white font-semibold border-green-600'
                            : member.partnerInfo.approvalStatus === 'PENDING'
                              ? 'bg-yellow-500 text-white font-semibold border-yellow-600'
                              : 'bg-red-500 text-white font-semibold border-red-600'
                        }
                      >
                        {member.partnerInfo.approvalStatus}
                      </Badge>
                    </div>
                    <div className="pt-2">
                      <Link href={`/mission-control/partners/${member.partnerInfo.id}`}>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Partner Details
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {member.notes && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300 whitespace-pre-wrap">{member.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Stats & Referrals */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Position</span>
                    <span className="text-white font-semibold">#{member.position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Referrals</span>
                    <span className="text-white font-semibold">{member.referralCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Days Waiting</span>
                    <span className="text-white font-semibold">{member.daysSinceJoined}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Referral Code */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Referral Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 font-mono text-sm bg-gray-700 p-2 rounded">
                    {member.referralCode}
                  </p>
                </CardContent>
              </Card>

              {/* Referrals */}
              {member.referrals && member.referrals.length > 0 && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <Users className="h-5 w-5 mr-2" />
                      Referrals ({member.referrals.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {member.referrals.map((referral) => (
                      <div key={referral.id} className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-200">{referral.name}</p>
                          <p className="text-xs text-gray-400">{referral.email}</p>
                        </div>
                        <Badge variant="outline" className="text-gray-300 border-gray-600">
                          #{referral.position}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
