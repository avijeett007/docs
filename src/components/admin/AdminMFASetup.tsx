'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from './AdminAuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Shield,
  ShieldCheck,
  QrCode,
  Copy,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { isFeatureEnabled } from '@/config/featureFlags';

interface MFAStatus {
  mfaEnabled: boolean;
  mfaLastUsedAt: string | null;
}

interface MFASetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
  issuer: string;
  accountName: string;
}

export default function AdminMFASetup() {
  const { user } = useAdminAuth();
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<'status' | 'setup' | 'verify'>('status');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodesCount, setBackupCodesCount] = useState(0);

  // Check if MFA features are enabled
  const mfaEnabled = isFeatureEnabled('missionControlMFA.enabled');

  useEffect(() => {
    if (user && mfaEnabled) {
      fetchMFAStatus();
      fetchBackupCodesCount();
    }
  }, [user, mfaEnabled]);

  const fetchMFAStatus = async () => {
    try {
      const response = await fetch('/api/admin/auth/mfa/setup');
      if (response.ok) {
        const data = await response.json();
        setMfaStatus(data);
      }
    } catch (error) {
      console.error('Error fetching MFA status:', error);
    }
  };

  const fetchBackupCodesCount = async () => {
    try {
      const response = await fetch('/api/admin/auth/mfa/backup-codes');
      if (response.ok) {
        const data = await response.json();
        setBackupCodesCount(data.backupCodesCount);
      }
    } catch (error) {
      console.error('Error fetching backup codes count:', error);
    }
  };

  const startMFASetup = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/auth/mfa/setup', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to setup MFA');
      }

      const data = await response.json();
      setSetupData(data);
      setStep('setup');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const verifyMFASetup = async () => {
    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/auth/mfa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify MFA');
      }

      const data = await response.json();
      setSuccess(data.message);
      setStep('status');
      setVerificationCode('');
      setSetupData(null);
      await fetchMFAStatus();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to verify MFA');
    } finally {
      setLoading(false);
    }
  };

  const disableMFA = async () => {
    if (!password) {
      setError('Please enter your password to disable MFA');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disable MFA');
      }

      const data = await response.json();
      setSuccess(data.message);
      setPassword('');
      await fetchMFAStatus();
      setBackupCodesCount(0);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!password) {
      setError('Please enter your password to regenerate backup codes');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/auth/mfa/backup-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate backup codes');
      }

      const data = await response.json();
      setSetupData(prev => prev ? { ...prev, backupCodes: data.backupCodes } : null);
      setSuccess(data.message);
      setPassword('');
      setShowBackupCodes(true);
      await fetchBackupCodesCount();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Copied to clipboard');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      setError('Failed to copy to clipboard');
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes) return;

    const content = setupData.backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knotie-admin-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return null;
  }

  if (!mfaEnabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Multi-Factor Authentication
            </CardTitle>
            <CardDescription>
              Secure your admin account with two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                MFA features are currently disabled. Please contact your system administrator to enable this feature.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {step === 'status' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mfaStatus?.mfaEnabled ? (
                <ShieldCheck className="h-5 w-5 text-green-600" />
              ) : (
                <Shield className="h-5 w-5 text-gray-500" />
              )}
              Multi-Factor Authentication
              {mfaStatus?.mfaEnabled && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Enabled
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {mfaStatus?.mfaEnabled
                ? 'Your account is protected with two-factor authentication'
                : 'Add an extra layer of security to your admin account'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mfaStatus?.mfaEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-600">
                      {mfaStatus.mfaLastUsedAt
                        ? `Last used: ${new Date(mfaStatus.mfaLastUsedAt).toLocaleDateString()}`
                        : 'Never used'
                      }
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Backup Codes</h4>
                    <p className="text-sm text-gray-600">
                      {backupCodesCount} backup codes remaining
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBackupCodes(!showBackupCodes)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>

                {showBackupCodes && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                      <CardTitle className="text-sm">Regenerate Backup Codes</CardTitle>
                      <CardDescription>
                        Enter your password to generate new backup codes. This will invalidate all existing backup codes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="regenerate-password">Password</Label>
                        <Input
                          id="regenerate-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={regenerateBackupCodes}
                          disabled={loading || !password}
                          size="sm"
                        >
                          {loading ? 'Generating...' : 'Generate New Codes'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowBackupCodes(false);
                            setPassword('');
                          }}
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-red-600">Disable MFA</h4>
                      <p className="text-sm text-gray-600">
                        Remove two-factor authentication from your account
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setStep('verify')}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disable
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Enable Two-Factor Authentication</h3>
                <p className="text-gray-600 mb-6">
                  Protect your admin account with an additional layer of security using an authenticator app.
                </p>
                <Button onClick={startMFASetup} disabled={loading}>
                  {loading ? 'Setting up...' : 'Enable MFA'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'setup' && setupData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Setup Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Scan the QR code with your authenticator app or enter the key manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="inline-block p-4 bg-white border rounded-lg">
                <img
                  src={setupData.qrCodeUrl}
                  alt="MFA QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Manual Entry Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={setupData.manualEntryKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(setupData.manualEntryKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Backup Codes</Label>
              <p className="text-sm text-gray-600 mb-2">
                Save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backupCodes.map((code, index) => (
                    <div key={index} className="p-2 bg-white rounded border">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(setupData.backupCodes.join('\n'))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadBackupCodes}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code from your authenticator app"
                maxLength={6}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={verifyMFASetup}
                disabled={loading || !verificationCode}
              >
                {loading ? 'Verifying...' : 'Verify & Enable MFA'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('status');
                  setSetupData(null);
                  setVerificationCode('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'verify' && mfaStatus?.mfaEnabled && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Disable Multi-Factor Authentication</CardTitle>
            <CardDescription>
              Enter your password to disable MFA. This will remove all protection from your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> Disabling MFA will make your account less secure.
                Make sure you understand the security implications.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password to confirm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={disableMFA}
                disabled={loading || !password}
              >
                {loading ? 'Disabling...' : 'Disable MFA'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('status');
                  setPassword('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
