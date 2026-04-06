'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiKeyManager } from '@/components/customer/ApiKeyManager';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Loader2 } from 'lucide-react';
import { NeonContainer } from '@/components/ui/neon-container';

export default function ApiKeysPage({ params }: { params: { subdomain: string } }) {
  const { subdomain } = params;
  const router = useRouter();
  const { isAuthenticated, isLoading, customerId } = useCustomerAuth();
  const [apiAccessEnabled, setApiAccessEnabled] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    // Check if the customer has API access enabled
    const checkApiAccess = async () => {
      try {
        const response = await fetch(`/api/whitelabel/${subdomain}/customer/api-access`, {
          credentials: 'include'
        });

        if (!response.ok) {
          setApiAccessEnabled(false);
          setIsCheckingAccess(false);
          return;
        }

        const data = await response.json();
        setApiAccessEnabled(data.apiAccessEnabled);
        setIsCheckingAccess(false);
      } catch (error) {
        console.error('Error checking API access:', error);
        setApiAccessEnabled(false);
        setIsCheckingAccess(false);
      }
    };

    if (isAuthenticated && !isLoading) {
      checkApiAccess();
    }
  }, [isAuthenticated, isLoading, subdomain]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/whitelabel/${subdomain}/customer/login`);
    }
  }, [isAuthenticated, isLoading, router, subdomain]);

  if (isLoading || isCheckingAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (apiAccessEnabled === false) {
    return (
      <div className="container mx-auto py-10">
        <NeonContainer className="max-w-4xl mx-auto">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-3V6a3 3 0 00-3-3H9a3 3 0 00-3 3v3m9 0H6m9 0a3 3 0 013 3v3a3 3 0 01-3 3H6a3 3 0 01-3-3v-3a3 3 0 013-3h9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">API Access Not Enabled</h2>
            <p className="text-gray-400 mb-6">
              API access is not enabled for your account. Please contact your account manager to enable API access.
            </p>
            <Button
              onClick={() => router.push(`/whitelabel/${subdomain}/customer`)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Return to Dashboard
            </Button>
          </div>
        </NeonContainer>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">API Keys</h1>
        <p className="text-gray-400 mt-2">
          Manage your API keys for programmatic access to the platform.
        </p>
      </div>

      <div className="grid gap-8">
        <NeonContainer>
          <CardHeader>
            <CardTitle className="text-white">API Documentation</CardTitle>
            <CardDescription className="text-gray-400">
              Learn how to use our API to integrate with your systems.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-4">
              Our API allows you to programmatically access your data and integrate with your existing systems.
              Use the documentation below to get started.
            </p>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => window.open('/api-docs', '_blank')}
            >
              View API Documentation
            </Button>
          </CardContent>
        </NeonContainer>

        <ApiKeyManager customerId={customerId} subdomain={subdomain} />
      </div>
    </div>
  );
}
