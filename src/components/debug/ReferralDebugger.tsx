'use client';

/**
 * @deprecated This debug component is not used in the application UI and is scheduled for removal.
 * TODO: Delete this file and its associated route src/app/api/debug/referral/route.ts in a future cleanup sprint.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Copy, Database, Users, DollarSign } from 'lucide-react';

interface DebugData {
  totalAffiliates: number;
  activeAffiliates: number;
  totalConversions: number;
  paidConversions: number;
}

/**
 * ReferralDebugger Component
 * 
 * DEVELOPMENT ONLY - Remove before production
 * Add this component to any page during development to debug referral system
 */
export default function ReferralDebugger() {
  const { toast } = useToast();
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralId, setReferralId] = useState('');
  const [testEmail, setTestEmail] = useState('');

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  useEffect(() => {
    // Check for referral ID in localStorage
    const storedReferralId = localStorage.getItem('rewardful_referral');
    if (storedReferralId) {
      setReferralId(storedReferralId);
    }
  }, []);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/referral?action=overview');
      if (response.ok) {
        const result = await response.json();
        setDebugData(result.data);
      } else {
        throw new Error('Failed to fetch debug data');
      }
    } catch (error: any) {
      toast({
        title: "❌ Debug Error",
        description: error.message,
        className: "bg-red-900 border-red-700 text-red-100",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTestAffiliate = async () => {
    try {
      const response = await fetch('/api/debug/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_test_affiliate',
          email: testEmail || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "✅ Test Affiliate Created",
          description: `Created: ${result.data.businessName}`,
          className: "bg-green-900 border-green-700 text-green-100",
        });
        fetchDebugData();
      } else {
        throw new Error('Failed to create test affiliate');
      }
    } catch (error: any) {
      toast({
        title: "❌ Creation Failed",
        description: error.message,
        className: "bg-red-900 border-red-700 text-red-100",
      });
    }
  };

  const copyReferralId = () => {
    if (referralId) {
      navigator.clipboard.writeText(referralId);
      toast({
        title: "✅ Copied",
        description: "Referral ID copied to clipboard",
        className: "bg-green-900 border-green-700 text-green-100",
      });
    }
  };

  const clearReferralId = () => {
    localStorage.removeItem('rewardful_referral');
    setReferralId('');
    toast({
      title: "🗑️ Cleared",
      description: "Referral ID cleared from localStorage",
      className: "bg-blue-900 border-blue-700 text-blue-100",
    });
  };

  const testReferralLink = () => {
    const testUrl = `${window.location.origin}?via=test_affiliate_${Date.now()}`;
    window.open(testUrl, '_blank');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 bg-yellow-50 border-yellow-200 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-yellow-800 flex items-center">
            <Database className="h-4 w-4 mr-2" />
            Referral Debugger
          </CardTitle>
          <CardDescription className="text-xs text-yellow-700">
            Development Only - Remove before production
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Current Referral ID */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-yellow-800">Current Referral ID</Label>
            <div className="flex items-center space-x-2">
              <Input
                value={referralId || 'None'}
                readOnly
                className="text-xs bg-white"
              />
              {referralId && (
                <Button size="sm" variant="outline" onClick={copyReferralId}>
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
            {referralId && (
              <Button size="sm" variant="destructive" onClick={clearReferralId} className="w-full">
                Clear Referral ID
              </Button>
            )}
          </div>

          {/* Debug Stats */}
          {debugData && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-2 rounded border">
                <div className="text-xs text-gray-600">Affiliates</div>
                <div className="font-bold text-sm">{debugData.activeAffiliates}/{debugData.totalAffiliates}</div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="text-xs text-gray-600">Conversions</div>
                <div className="font-bold text-sm">{debugData.paidConversions}/{debugData.totalConversions}</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button 
              size="sm" 
              onClick={fetchDebugData} 
              disabled={loading}
              className="w-full"
            >
              {loading && <RefreshCw className="h-3 w-3 mr-2 animate-spin" />}
              Refresh Debug Data
            </Button>

            <Button 
              size="sm" 
              variant="outline" 
              onClick={testReferralLink}
              className="w-full"
            >
              Test Referral Link
            </Button>

            <div className="flex space-x-2">
              <Input
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="text-xs"
              />
              <Button size="sm" onClick={createTestAffiliate}>
                Create Test
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="text-xs space-y-1">
            <div className="font-medium text-yellow-800">Quick Links:</div>
            <div className="space-y-1">
              <a 
                href="/mission-control/partners" 
                target="_blank"
                className="block text-blue-600 hover:underline"
              >
                → Mission Control Partners
              </a>
              <button 
                onClick={() => window.open('http://localhost:5555', '_blank')}
                className="block text-blue-600 hover:underline"
              >
                → Prisma Studio
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
