'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

interface WebhookManagerProps {
  agentId: string;
  provider: 'vapi' | 'retell' | 'retell_chat' | 'ultravox';
  analyticsAgentId: string | null;
  webhookEnabled: boolean;
  webhookUrl: string | null;
  webhookMode?: 'manual' | 'automatic';
  preExistingWebhookUrl: string | null;
  forwardToPreExisting: boolean;
  onUpdate: (data: {
    webhookEnabled: boolean;
    webhookMode: 'manual' | 'automatic';
    preExistingWebhookUrl?: string;
    forwardToPreExisting: boolean;
  }) => Promise<boolean>;
}

export function WebhookManager({
  agentId,
  provider,
  analyticsAgentId,
  webhookEnabled,
  webhookUrl,
  webhookMode,
  preExistingWebhookUrl,
  forwardToPreExisting,
  onUpdate,
}: WebhookManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [mode, setMode] = useState<'manual' | 'automatic'>(webhookEnabled && webhookUrl ? 'manual' : 'automatic');
  const [newWebhookEnabled, setNewWebhookEnabled] = useState(true); // Always enabled when configuring
  const [newPreExistingWebhookUrl, setNewPreExistingWebhookUrl] = useState(preExistingWebhookUrl || '');
  const [newForwardToPreExisting, setNewForwardToPreExisting] = useState(forwardToPreExisting);
  const [manualConfirmation, setManualConfirmation] = useState(false);
  const [step, setStep] = useState<'config' | 'confirm'>('config');

  // Reset state when props change
  useEffect(() => {
    // Always keep enabled state as true for configuration
    setNewPreExistingWebhookUrl(preExistingWebhookUrl || '');
    setNewForwardToPreExisting(forwardToPreExisting);
    setStep('config');
    setManualConfirmation(false);
    // Update mode based on the current webhook configuration
    if (webhookEnabled && webhookUrl) {
      setMode(webhookMode || 'manual');
    }
  }, [webhookEnabled, webhookUrl, webhookMode, preExistingWebhookUrl, forwardToPreExisting]);

  // Reset step and confirmation when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setStep('config');
      setManualConfirmation(false);
    }
  }, [isOpen]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Webhook URL copied to clipboard');
    }
  };

  const handleSave = async () => {
    // If in config step and manual mode, go to confirmation step
    if (step === 'config' && mode === 'manual' && newWebhookEnabled) {
      // Validate inputs
      if (newPreExistingWebhookUrl && !isValidUrl(newPreExistingWebhookUrl)) {
        toast.error('Please enter a valid pre-existing webhook URL');
        return;
      }

      setStep('confirm');
      return;
    }

    setIsUpdating(true);
    try {
      // For manual mode, check if user confirmed updating the webhook URL
      if (mode === 'manual' && !manualConfirmation && step === 'confirm') {
        toast.error('Please confirm that you have updated the webhook URL');
        setIsUpdating(false);
        return;
      }

      const success = await onUpdate({
        webhookEnabled: newWebhookEnabled,
        webhookMode: mode,
        preExistingWebhookUrl: newPreExistingWebhookUrl || undefined,
        forwardToPreExisting: newForwardToPreExisting,
      });

      if (success) {
        toast.success('Webhook configuration updated successfully');
        setIsOpen(false);
        setStep('config');
        setManualConfirmation(false);
      } else {
        toast.error('Failed to update webhook configuration');
      }
    } catch (error) {
      console.error('Error updating webhook configuration:', error);
      toast.error('An error occurred while updating webhook configuration');
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper function to validate URLs
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <>
      <div className="flex items-center space-x-2 w-full" data-agent-id={agentId}>
        <Button
          variant={webhookEnabled ? "default" : "outline"}
          onClick={() => setIsOpen(true)}
          className="text-xs w-full flex items-center justify-center gap-2"
        >
          {webhookEnabled ? (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span>Manage Webhook</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-gray-500"></span>
              <span>Configure Webhook</span>
            </>
          )}
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] bg-gray-900 border border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">Configure Webhook</DialogTitle>
            <DialogDescription className="text-gray-400">
              Choose how to set up your webhook to receive real-time data from your {provider.toUpperCase()} agent.
            </DialogDescription>
          </DialogHeader>

          {step === 'config' ? (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="webhook-url" className="text-white">Webhook URL</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="webhook-url"
                    value={webhookUrl || ''}
                    readOnly
                    className="flex-1 bg-gray-800 border-gray-700 text-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="border-gray-700 hover:bg-gray-800 text-white"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-gray-400">
                  Use this URL to receive webhook events from your {provider.toUpperCase()} agent.
                </p>
              </div>

              <Tabs defaultValue={mode} onValueChange={(value) => setMode(value as 'manual' | 'automatic')}>
                <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                  <TabsTrigger
                    value="manual"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Manual Setup
                  </TabsTrigger>
                  <TabsTrigger
                    value="automatic"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Automatic Setup
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="manual">
                  <div className="space-y-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-300">
                        Manually configure the webhook URL in your {provider.toUpperCase()} dashboard.
                      </p>
                      <ol className="list-decimal list-inside text-sm mt-2 space-y-1 text-gray-300">
                        <li>Copy the webhook URL above</li>
                        <li>Go to your {provider.toUpperCase()} dashboard</li>
                        <li>Find your agent settings</li>
                        <li>Paste the URL in the webhook configuration section</li>
                        <li>Save your changes</li>
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="existing-webhook" className="text-white">Do you already have a webhook configured?</Label>
                      <Input
                        id="existing-webhook"
                        placeholder="Enter your existing webhook URL"
                        value={newPreExistingWebhookUrl}
                        onChange={(e) => setNewPreExistingWebhookUrl(e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                      {newPreExistingWebhookUrl && (
                        <div className="flex items-center space-x-2 mt-2">
                          <Checkbox
                            id="forward-existing"
                            checked={newForwardToPreExisting}
                            onCheckedChange={(checked) => setNewForwardToPreExisting(checked as boolean)}
                            className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <Label htmlFor="forward-existing" className="text-sm text-gray-300">
                            Forward webhook data to your existing webhook URL
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="automatic">
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-gray-300">
                      We'll automatically update your {provider.toUpperCase()} agent's webhook configuration.
                    </p>
                    <p className="text-sm text-gray-300">
                      If you already have a webhook configured, we'll save it and can forward events to it.
                    </p>
                    <div className="bg-yellow-900/30 p-3 rounded-md border border-yellow-700">
                      <p className="text-sm text-amber-500">
                        Note: This requires your {provider.toUpperCase()} API key to be configured in your account settings.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="bg-blue-900/30 p-4 rounded-md border border-blue-700">
                <h3 className="text-lg font-medium text-white mb-2">Manual Setup Confirmation</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Please confirm that you have updated the webhook URL in your {provider.toUpperCase()} dashboard.
                </p>

                <div className="bg-gray-800 p-3 rounded-md mb-4">
                  <p className="text-sm font-mono text-white break-all">{webhookUrl}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manual-confirmation"
                    checked={manualConfirmation}
                    onCheckedChange={(checked) => setManualConfirmation(checked as boolean)}
                    className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="manual-confirmation" className="text-sm text-gray-300">
                    I confirm that I have updated the webhook URL in my {provider.toUpperCase()} dashboard
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {step === 'config' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="border-gray-700 hover:bg-gray-800 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {isUpdating ? 'Saving...' : mode === 'manual' && newWebhookEnabled ? 'Next' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep('config')}
                  className="border-gray-700 hover:bg-gray-800 text-white"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isUpdating || !manualConfirmation}
                  className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? 'Saving...' : 'Complete Setup'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
