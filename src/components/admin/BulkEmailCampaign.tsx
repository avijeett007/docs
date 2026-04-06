'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SimpleEmailTemplateManager from './SimpleEmailTemplateManager';

import { useToast } from '@/hooks/use-toast';
import { Check, AlertCircle, Send, Users, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CampaignManager from './CampaignManager';
import AdvancedRecipientSelector, { RecipientCriteria } from './AdvancedRecipientSelector';

interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  htmlContent: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'partner' | 'waitlist';
  businessName?: string;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  subject: string;
  htmlContent: string;
  status: string;
  sentCount: number;
  targetCount: number;
  recipientType: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function BulkEmailCampaign() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Campaign form state
  const [subject, setSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [recipientType, setRecipientType] = useState<'partner' | 'waitlist' | 'all'>('partner');
  const [campaignName, setCampaignName] = useState('');
  const [testMode, setTestMode] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Advanced recipient selection state
  const [recipientCriteria, setRecipientCriteria] = useState<RecipientCriteria>({ targetType: 'active_partners' });
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [useAdvancedTargeting, setUseAdvancedTargeting] = useState(true);

  // Recipients data
  const [partnerCount, setPartnerCount] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [previewRecipient, setPreviewRecipient] = useState<Recipient | null>(null);

  // Fetch recipient counts
  const fetchRecipientCounts = async () => {
    try {
      setLoading(true);

      // Fetch partner count
      const partnerResponse = await fetch('/api/admin/recipients?type=partner');
      if (!partnerResponse.ok) {
        throw new Error('Failed to fetch partners');
      }
      const partnerData = await partnerResponse.json();
      const partners = Array.isArray(partnerData) ? partnerData : (partnerData.recipients || []);
      setPartnerCount(partners.length);

      // Set a preview recipient for partners if available
      if (partners.length > 0) {
        setPreviewRecipient(partners[0]);
      }

      // Fetch waitlist count
      const waitlistResponse = await fetch('/api/admin/recipients?type=waitlist');
      if (!waitlistResponse.ok) {
        throw new Error('Failed to fetch waitlist members');
      }
      const waitlistData = await waitlistResponse.json();
      const waitlist = Array.isArray(waitlistData) ? waitlistData : (waitlistData.recipients || []);
      setWaitlistCount(waitlist.length);

      // Set a preview recipient for waitlist if no partner is available
      if (partners.length === 0 && waitlist.length > 0) {
        setPreviewRecipient(waitlist[0]);
      }
    } catch (err) {
      console.error('Error fetching recipient counts:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching recipient counts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipientCounts();
  }, []);

  // Handle template selection
  const handleTemplateSelect = (template: EmailTemplate) => {
    setSubject(template.subject);
    setEmailContent(template.htmlContent);
    setCampaignName(template.name);
    toast({
      title: 'Template Selected',
      description: `Template "${template.name}" has been loaded`,
      variant: 'default',
    });
  };

  // Toggle preview mode
  const togglePreview = () => {
    setPreviewMode(!previewMode);
  };

  // Handle advanced recipient selection
  const handleRecipientSelectionChange = (criteria: RecipientCriteria, recipients: Recipient[]) => {
    setRecipientCriteria(criteria);
    setSelectedRecipients(recipients);
  };

  // Process HTML content with recipient data for preview
  const processHtmlContent = (html: string, recipient: Recipient | null) => {
    if (!recipient) return html;

    let processedHtml = html;

    // Replace template variables with actual values
    processedHtml = processedHtml.replace(/\{\{([^}]+)\}\}/g, (match: string, variable: string) => {
      // Trim whitespace from variable name
      const trimmedVariable = variable.trim();

      // Handle different variable types
      if (trimmedVariable === 'name') {
        return recipient.name || '';
      } else if (trimmedVariable === 'email') {
        return recipient.email;
      } else if (trimmedVariable === 'businessName') {
        return recipient.businessName || recipient.name || '';
      } else if (trimmedVariable === 'unsubscribe') {
        return '#unsubscribe-link';
      } else if (trimmedVariable === 'date') {
        return new Date().toLocaleDateString();
      } else if (trimmedVariable === 'year') {
        return new Date().getFullYear().toString();
      }

      // Return the original match if no replacement is found
      return match;
    });

    // Also handle the [Name] format for backward compatibility
    if (recipient.name) {
      processedHtml = processedHtml.replace(/\[Name\]/g, recipient.name);
    }

    return processedHtml;
  };

  // Send bulk email
  const handleSendBulkEmail = async () => {
    if (!subject || !emailContent) {
      setError('Please provide both subject and email content');
      return;
    }

    try {
      setSendingEmail(true);
      setError(null);
      setSuccessMessage(null);

      const requestBody = useAdvancedTargeting ? {
        subject,
        htmlContent: emailContent,
        campaignName: campaignName || `Campaign ${new Date().toISOString()}`,
        testMode,
        // Advanced targeting parameters
        targetType: recipientCriteria.targetType,
        limit: recipientCriteria.limit,
        customLimit: recipientCriteria.customLimit,
      } : {
        subject,
        htmlContent: emailContent,
        recipientType,
        campaignName: campaignName || `Campaign ${new Date().toISOString()}`,
        testMode,
      };

      const response = await fetch('/api/admin/send-bulk-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send bulk email');
      }

      const data = await response.json();

      if (testMode) {
        setSuccessMessage(`Test email sent successfully to ${data.message}`);
      } else {
        const recipientInfo = useAdvancedTargeting ?
          `${selectedRecipients.length} recipients (${recipientCriteria.targetType})` :
          `${data.totalRecipients} recipients`;
        setSuccessMessage(`Campaign sent to ${recipientInfo}. Successfully sent ${data.successCount || data.totalRecipients} emails.`);
      }

      toast({
        title: testMode ? 'Test Email Sent' : 'Campaign Started',
        description: testMode
          ? 'Your test email has been sent successfully'
          : `Your campaign has been started. Emails will be sent to ${data.totalRecipients} recipients.`,
        variant: 'default',
      });
    } catch (err) {
      console.error('Error sending bulk email:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while sending the bulk email');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to send bulk email',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Save campaign as draft
  const saveCampaignAsDraft = async () => {
    if (!campaignName || !subject || !emailContent) {
      setError('Please provide campaign name, subject, and email content');
      return;
    }

    try {
      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignName,
          subject,
          htmlContent: emailContent,
          recipientType: useAdvancedTargeting ? recipientCriteria.targetType : recipientType,
          status: 'draft',
          description: useAdvancedTargeting ?
            `Advanced targeting: ${recipientCriteria.targetType}${recipientCriteria.limit ? ` (limit: ${recipientCriteria.limit})` : ''}${recipientCriteria.customLimit ? ` (custom: ${recipientCriteria.customLimit})` : ''}` :
            undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save campaign');
      }

      toast({
        title: 'Campaign Saved',
        description: 'Your campaign has been saved as a draft',
        variant: 'default',
      });

      setSuccessMessage('Campaign saved successfully as draft');
    } catch (err) {
      console.error('Error saving campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save campaign',
        variant: 'destructive',
      });
    }
  };

  // Handle campaign selection from campaign manager
  const handleCampaignSelect = (campaign: Campaign) => {
    setCampaignName(campaign.name);
    setSubject(campaign.subject);
    setEmailContent(campaign.htmlContent);
    setRecipientType(campaign.recipientType as 'partner' | 'waitlist' | 'all');
  };

  // Handle sending campaign from campaign manager
  const handleSendCampaignFromManager = async (campaign: Campaign) => {
    // Load campaign data
    setCampaignName(campaign.name);
    setSubject(campaign.subject);
    setEmailContent(campaign.htmlContent);
    setRecipientType(campaign.recipientType as 'partner' | 'waitlist' | 'all');

    // Send the campaign
    await handleSendBulkEmail();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Bulk Email Campaign</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Send emails to multiple recipients at once
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
          <CardDescription>
            Configure your email campaign settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert variant="default" className="mb-4 bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Success</AlertTitle>
              <AlertDescription className="text-green-600">{successMessage}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="compose" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="compose">Compose Email</TabsTrigger>
              <TabsTrigger value="templates">Use Template</TabsTrigger>
              <TabsTrigger value="campaigns">Manage Campaigns</TabsTrigger>
            </TabsList>

            <TabsContent value="templates">
              <SimpleEmailTemplateManager
                onSelectTemplate={(template) => {
                  setSubject(template.subject);
                  setEmailContent(template.htmlContent);
                  setCampaignName(template.name);
                }}
              />
            </TabsContent>

            <TabsContent value="campaigns">
              <CampaignManager
                onSelectCampaign={handleCampaignSelect}
                onSendCampaign={handleSendCampaignFromManager}
              />
            </TabsContent>

            <TabsContent value="compose">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input
                    id="campaign-name"
                    placeholder="Enter a name for this campaign"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                {/* Targeting Mode Toggle */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Targeting Mode</Label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targeting-mode"
                        checked={useAdvancedTargeting}
                        onChange={() => setUseAdvancedTargeting(true)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Advanced Targeting</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targeting-mode"
                        checked={!useAdvancedTargeting}
                        onChange={() => setUseAdvancedTargeting(false)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Simple Mode</span>
                    </label>
                  </div>
                </div>

                {/* Advanced Recipient Selector */}
                {useAdvancedTargeting ? (
                  <AdvancedRecipientSelector
                    onSelectionChange={handleRecipientSelectionChange}
                    initialCriteria={recipientCriteria}
                  />
                ) : (
                  /* Legacy Simple Recipient Selection */
                  <div className="space-y-2">
                    <Label>Recipient Group</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="partner"
                          name="recipient-type"
                          value="partner"
                          checked={recipientType === 'partner'}
                          onChange={() => setRecipientType('partner')}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="partner" className="cursor-pointer">
                          Partners ({partnerCount})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="waitlist"
                          name="recipient-type"
                          value="waitlist"
                          checked={recipientType === 'waitlist'}
                          onChange={() => setRecipientType('waitlist')}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="waitlist" className="cursor-pointer">
                          Waitlist Members ({waitlistCount})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="all"
                          name="recipient-type"
                          value="all"
                          checked={recipientType === 'all'}
                          onChange={() => setRecipientType('all')}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="all" className="cursor-pointer">
                          All Recipients ({partnerCount + waitlistCount})
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Email subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="content">Email Content (HTML)</Label>
                    <Button variant="outline" size="sm" onClick={togglePreview}>
                      {previewMode ? 'Edit HTML' : 'Preview'}
                    </Button>
                  </div>

                  {previewMode ? (
                    <div className="border rounded-md p-4 min-h-[300px] bg-white">
                      {previewRecipient ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: processHtmlContent(emailContent, previewRecipient)
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center p-4">
                            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                            <p className="text-gray-600">No recipient available for preview</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Textarea
                      id="content"
                      placeholder="Enter HTML content for your email"
                      className="min-h-[300px] font-mono"
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center space-x-2 pt-4">
            <input
              type="checkbox"
              id="test-mode"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="test-mode" className="cursor-pointer">
              Test Mode (sends to only one recipient)
            </Label>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={saveCampaignAsDraft}
              disabled={!campaignName || !subject || !emailContent}
              variant="outline"
              className="flex-1"
            >
              <Save className="mr-2 h-4 w-4" />
              Save as Draft
            </Button>

            <Button
              onClick={handleSendBulkEmail}
              disabled={sendingEmail || !subject || !emailContent}
              className="flex-1"
            >
              <Send className="mr-2 h-4 w-4" />
              {sendingEmail ? 'Sending...' : testMode ? 'Send Test Email' : 'Send Campaign'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
