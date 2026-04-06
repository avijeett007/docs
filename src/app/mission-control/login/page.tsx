'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminLoginPage() {
  const { signIn, verifyMFA, mfaRequired, pendingMFAUserId } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'mfa'>('login');

  // Sync local step with global MFA state
  useEffect(() => {
    if (mfaRequired && pendingMFAUserId) {
      setStep('mfa');
    } else {
      setStep('login');
    }
  }, [mfaRequired, pendingMFAUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error.message);
      } else if (result.mfaRequired) {
        setStep('mfa');
      } else {
        // Successful login - redirect will be handled by the auth provider
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during sign in';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingMFAUserId) {
      setError('Invalid session. Please try logging in again.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error } = await verifyMFA(mfaCode, isBackupCode, pendingMFAUserId);
      if (error) {
        setError(error.message);
      } else {
        // Successful MFA verification - redirect will be handled by the auth provider
        console.log('MFA verification successful');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during MFA verification';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px] shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Mission Control</CardTitle>
          <CardDescription className="text-center">
            {step === 'login'
              ? 'Enter your credentials to access the admin panel'
              : 'Enter your two-factor authentication code'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'login' ? (
            <form onSubmit={handleSubmit}>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMFASubmit}>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mfa-code">
                    {isBackupCode ? 'Backup Code' : 'Authentication Code'}
                  </Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    placeholder={isBackupCode ? 'Enter backup code' : 'Enter 6-digit code'}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    maxLength={isBackupCode ? 8 : 6}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="backup-code"
                    checked={isBackupCode}
                    onChange={(e) => {
                      setIsBackupCode(e.target.checked);
                      setMfaCode('');
                    }}
                    className="rounded"
                  />
                  <Label htmlFor="backup-code" className="text-sm">
                    Use backup code instead
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStep('login');
                    setMfaCode('');
                    setIsBackupCode(false);
                    setError(null);
                  }}
                >
                  Back to Login
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-gray-500">
            Secure access for authorized personnel only
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
