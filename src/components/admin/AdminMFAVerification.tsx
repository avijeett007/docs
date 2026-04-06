'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, AlertCircle } from 'lucide-react';

interface AdminMFAVerificationProps {
  onVerificationSuccess: () => void;
  onCancel: () => void;
  supabase: any;
}

export default function AdminMFAVerification({ 
  onVerificationSuccess, 
  onCancel, 
  supabase 
}: AdminMFAVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Starting MFA verification...');

      // Get the current session to find MFA factors
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get current session');
      }

      if (!session) {
        throw new Error('No active session found');
      }

      console.log('Session found, listing MFA factors...');

      // List available MFA factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        console.error('Factors error:', factorsError);
        throw factorsError;
      }

      const verifiedFactor = factors?.totp?.find((factor: any) => factor.status === 'verified');

      if (!verifiedFactor) {
        throw new Error('No verified MFA factor found');
      }

      console.log('Creating MFA challenge...');

      // Create MFA challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id
      });

      if (challengeError) {
        console.error('Challenge error:', challengeError);
        throw challengeError;
      }

      console.log('Verifying MFA code...');

      // Verify the challenge with the user's code
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: challenge.id,
        code: verificationCode.trim()
      });

      if (verifyError) {
        console.error('Verify error:', verifyError);
        throw verifyError;
      }

      console.log('MFA verification successful:', verifyData);

      // MFA verification successful
      onVerificationSuccess();
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[400px] shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the verification code from your authenticator app to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerification} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
                autoComplete="one-time-code"
                autoFocus
              />
              <p className="text-xs text-gray-500 text-center">
                Open your authenticator app and enter the 6-digit code
              </p>
            </div>

            <div className="flex items-center justify-center text-sm text-gray-600 mb-4">
              <Smartphone className="h-4 w-4 mr-2" />
              Use your authenticator app
            </div>

            <div className="space-y-2">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Having trouble?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Make sure your device's time is synchronized</li>
              <li>• Try generating a new code in your authenticator app</li>
              <li>• Contact your system administrator if issues persist</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
