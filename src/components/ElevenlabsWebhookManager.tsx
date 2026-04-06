'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ElevenlabsWebhookManagerProps {
  agentId: string;
  onWebhookConfigured?: () => void;
}

interface WebhookConfig {
  webhookEnabled: boolean;
  webhookSecretConfirmed: boolean;
  forwardToPreExisting: boolean;
  preExistingWebhookUrl?: string;
  webhookMode?: string;
  webhookUrl?: string;
}

export function ElevenlabsWebhookManager({ agentId, onWebhookConfigured }: ElevenlabsWebhookManagerProps) {
  const [config, setConfig] = useState<WebhookConfig>({
    webhookEnabled: false,
    webhookSecretConfirmed: false,
    forwardToPreExisting: true
  });
  const [webhookSecret, setWebhookSecret] = useState('');
  const [preExistingWebhookUrl, setPreExistingWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhookConfig();
  }, [agentId]);

  const fetchWebhookConfig = async () => {
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/elevenlabs-agents/${agentId}/webhook`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.webhookConfig);
        setPreExistingWebhookUrl(data.webhookConfig.preExistingWebhookUrl || '');
      }
    } catch (error) {
      console.error('Error fetching webhook config:', error);
      toast.error('Failed to load webhook configuration');
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(`${type} copied to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('partner_token');
      if (!token) return;

      const response = await fetch(`/api/partner/elevenlabs-agents/${agentId}/webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookEnabled: config.webhookEnabled,
          webhookSecret: webhookSecret || undefined,
          forwardToPreExisting: config.forwardToPreExisting,
          preExistingWebhookUrl: preExistingWebhookUrl || undefined,
          webhookMode: 'manual'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.agent);
        if (data.webhookSecret) {
          setWebhookSecret(data.webhookSecret);
        }
        toast.success(data.message || 'Webhook configuration saved');
        onWebhookConfigured?.();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to save webhook configuration');
      }
    } catch (error) {
      console.error('Error saving webhook config:', error);
      toast.error('Failed to save webhook configuration');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="space-y-6 text-white">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <AlertCircle className="h-5 w-5 text-blue-400" />
            ElevenLabs Webhook Setup
          </CardTitle>
          <CardDescription className="text-gray-300">
            Configure webhook settings for this ElevenLabs agent. You'll need to set up the webhook URL in your ElevenLabs dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="webhook-enabled" className="text-white">Enable Webhooks</Label>
              <p className="text-sm text-gray-400">
                Enable webhook processing for this agent
              </p>
            </div>
            <Switch
              id="webhook-enabled"
              checked={config.webhookEnabled}
              onCheckedChange={(checked) =>
                setConfig(prev => ({ ...prev, webhookEnabled: checked }))
              }
            />
          </div>

          {config.webhookEnabled && (
            <>
              {/* Webhook URL */}
              <div className="space-y-2">
                <Label className="text-white">Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={config.webhookUrl || 'Will be generated after saving'}
                    readOnly
                    className="font-mono text-sm bg-gray-700 border-gray-600 text-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => config.webhookUrl && handleCopy(config.webhookUrl, 'Webhook URL')}
                    disabled={!config.webhookUrl}
                    className="border-gray-600 text-white hover:bg-gray-700"
                  >
                    {copied === 'Webhook URL' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-gray-400">
                  Copy this URL and paste it in your ElevenLabs agent webhook configuration
                </p>
              </div>

              {/* Webhook Secret - Accept existing secret from ElevenLabs */}
              <div className="space-y-2">
                <Label className="text-white">ElevenLabs Webhook Secret</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="Paste the webhook secret from ElevenLabs dashboard"
                    className="font-mono text-sm bg-gray-700 border-gray-600 text-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => webhookSecret && handleCopy(webhookSecret, 'Webhook Secret')}
                    disabled={!webhookSecret}
                    className="border-gray-600 text-white hover:bg-gray-700"
                  >
                    {copied === 'Webhook Secret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-gray-400">
                  Get this secret from your ElevenLabs agent webhook settings and paste it here for verification
                </p>
              </div>

              {/* Forward to Pre-existing Webhook */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="forward-webhook" className="text-white">Forward to Existing Webhook</Label>
                    <p className="text-sm text-gray-400">
                      Forward webhook events to your existing webhook URL after processing
                    </p>
                  </div>
                  <Switch
                    id="forward-webhook"
                    checked={config.forwardToPreExisting}
                    onCheckedChange={(checked) =>
                      setConfig(prev => ({ ...prev, forwardToPreExisting: checked }))
                    }
                  />
                </div>

                {config.forwardToPreExisting && (
                  <div className="space-y-2">
                    <Label className="text-white">Your Webhook URL</Label>
                    <Input
                      value={preExistingWebhookUrl}
                      onChange={(e) => setPreExistingWebhookUrl(e.target.value)}
                      placeholder="https://your-domain.com/webhook"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                    <p className="text-sm text-gray-400">
                      We'll forward all webhook events to this URL after processing for analytics
                    </p>
                  </div>
                )}
              </div>

              {/* Setup Instructions */}
              <Alert className="bg-blue-900/20 border-blue-500/50">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-gray-300">
                  <div className="space-y-3">
                    <p className="font-medium text-white">Setup Instructions:</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Click "Save Configuration" below to generate your webhook URL</li>
                      <li>Copy the generated webhook URL</li>
                      <li>Go to your ElevenLabs dashboard → Agent Settings → Webhooks</li>
                      <li>Paste the webhook URL and configure your desired events</li>
                      <li>Copy the webhook secret from ElevenLabs and paste it above</li>
                      <li>Save the configuration again to complete setup</li>
                    </ol>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 border-blue-500 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => window.open('https://elevenlabs.io/docs/conversational-ai/webhooks', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View ElevenLabs Webhook Documentation
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveConfig}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>

          {/* Status */}
          {config.webhookSecretConfirmed && (
            <Alert className="bg-green-900/20 border-green-500/50">
              <Check className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300">
                Webhook configuration is active and ready to receive events from ElevenLabs.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
