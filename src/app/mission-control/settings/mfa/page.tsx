'use client';

import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import AdminMFASetup from '@/components/admin/AdminMFASetup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export default function AdminMFASettingsPage() {
  const { user, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You must be logged in as an admin to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/mission-control/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/mission-control">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Mission Control
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Multi-Factor Authentication
              </h1>
              <p className="text-gray-600">
                Secure your admin account with an additional layer of protection
              </p>
            </div>
          </div>
        </div>

        {/* Admin Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Admin Account</CardTitle>
            <CardDescription>
              Currently logged in as: {user.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>User ID:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                {user.id}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* MFA Setup Component */}
        <AdminMFASetup />

        {/* Security Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Security Information</CardTitle>
            <CardDescription>
              Important information about multi-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">What is MFA?</h4>
                <p className="text-sm text-gray-600">
                  Multi-Factor Authentication adds an extra layer of security to your account 
                  by requiring a second form of verification in addition to your password.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Recommended Apps</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Google Authenticator</li>
                  <li>• Microsoft Authenticator</li>
                  <li>• Authy</li>
                  <li>• 1Password</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Security Benefits</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Protects against password breaches</li>
                  <li>• Prevents unauthorized access</li>
                  <li>• Meets security compliance requirements</li>
                  <li>• Provides audit trail for access</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Important Notes</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Keep your authenticator app secure</li>
                  <li>• Don't share verification codes</li>
                  <li>• Contact support if you lose access</li>
                  <li>• Regularly review your security settings</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
