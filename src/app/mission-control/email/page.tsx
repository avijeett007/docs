'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SimpleEmailTemplateManager from '@/components/admin/SimpleEmailTemplateManager';
import BulkEmailCampaign from '@/components/admin/BulkEmailCampaign';

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'partner' | 'waitlist';
}

export default function EmailCampaignPage() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [recipientType, setRecipientType] = useState<'partner' | 'waitlist'>('partner');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/recipients?type=${recipientType}`);
        if (!response.ok) {
          throw new Error('Failed to fetch recipients');
        }
        const data = await response.json();
        // Handle both formats: direct array or {recipients: [...]} object
        setRecipients(Array.isArray(data) ? data : (data.recipients || []));
      } catch (err) {
        console.error('Error fetching recipients:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching recipients';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchRecipients();
    }
  }, [user, recipientType]);

  const handleRecipientTypeChange = (value: string) => {
    setRecipientType(value as 'partner' | 'waitlist');
    setSelectedRecipientId('');
  };

  const handleSendEmail = async () => {
    if (!selectedRecipientId || !subject || !emailContent) {
      setError('Please select a recipient and provide both subject and email content');
      return;
    }

    try {
      setSendingEmail(true);
      setError(null);
      setSuccessMessage(null);

      const selectedRecipient = recipients.find((r) => r.id === selectedRecipientId);
      if (!selectedRecipient) {
        throw new Error('Selected recipient not found');
      }

      const response = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: selectedRecipient.email,
          subject,
          html: emailContent,
          recipientName: selectedRecipient.name,
          recipientType: selectedRecipient.type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to send email');
      }

      setSuccessMessage(`Email successfully sent to ${selectedRecipient.name} (${selectedRecipient.email})`);
      toast({
        title: 'Email Sent',
        description: `Your email has been sent to ${selectedRecipient.email}`,
        variant: 'default',
      });
    } catch (err) {
      console.error('Error sending email:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while sending the email';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const togglePreview = () => {
    setPreviewMode(!previewMode);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          </div>

          <Tabs defaultValue="compose" className="space-y-4">
            <TabsList>
              <TabsTrigger value="compose">Compose Email</TabsTrigger>
              <TabsTrigger value="templates">Email Templates</TabsTrigger>
              <TabsTrigger value="template-manager">Template Manager</TabsTrigger>
              <TabsTrigger value="bulk-campaign">Bulk Campaign</TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Send Individual Email</CardTitle>
                  <CardDescription>
                    Compose and send an email to a specific partner or waitlist member
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

                  <div className="space-y-2">
                    <Label htmlFor="recipient-type">Recipient Type</Label>
                    <Select
                      value={recipientType}
                      onValueChange={handleRecipientTypeChange}
                    >
                      <SelectTrigger id="recipient-type">
                        <SelectValue placeholder="Select recipient type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="partner">Partners</SelectItem>
                        <SelectItem value="waitlist">Waitlist Members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipient">Recipient</Label>
                    {loading ? (
                      <div className="flex items-center space-x-2 h-10">
                        <div className="animate-spin h-4 w-4 border-2 border-gray-500 rounded-full border-t-transparent"></div>
                        <span className="text-sm text-gray-500">Loading recipients...</span>
                      </div>
                    ) : (
                      <Select
                        value={selectedRecipientId}
                        onValueChange={setSelectedRecipientId}
                      >
                        <SelectTrigger id="recipient">
                          <SelectValue placeholder="Select a recipient" />
                        </SelectTrigger>
                        <SelectContent>
                          {recipients.map((recipient) => (
                            <SelectItem key={recipient.id} value={recipient.id}>
                              {recipient.name} ({recipient.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Email subject"
                      value={subject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
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
                        {selectedRecipientId ? (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: emailContent.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
                                const trimmedVariable = variable.trim();
                                const selectedRecipient = recipients.find(r => r.id === selectedRecipientId);

                                if (!selectedRecipient) return match;

                                if (trimmedVariable === 'name') {
                                  return selectedRecipient.name;
                                } else if (trimmedVariable === 'email') {
                                  return selectedRecipient.email;
                                } else if (trimmedVariable === 'businessName') {
                                  return (selectedRecipient as any).businessName || selectedRecipient.name;
                                } else if (trimmedVariable === 'unsubscribe') {
                                  return '#unsubscribe-link';
                                } else if (trimmedVariable === 'date') {
                                  return new Date().toLocaleDateString();
                                } else if (trimmedVariable === 'year') {
                                  return new Date().getFullYear().toString();
                                }

                                return match;
                              })
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center p-4">
                              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                              <p className="text-gray-600">Please select a recipient to preview personalized content</p>
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
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEmailContent(e.target.value)}
                      />
                    )}
                  </div>

                  <Button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !selectedRecipientId || !subject || !emailContent}
                    className="w-full"
                  >
                    {sendingEmail ? 'Sending...' : 'Send Email'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Templates</CardTitle>
                  <CardDescription>
                    Reusable email templates for common communications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => {
                        setSubject('Welcome to Knotie-AI Pro!');
                        setEmailContent(`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://knotie-ai.pro/logo.png" alt="Knotie-AI Pro Logo" style="max-width: 150px; height: auto;" />
  </div>

  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin-top: 0; font-size: 24px;">Welcome to Knotie-AI Pro!</h1>

    <p style="font-size: 16px; line-height: 1.5;">Hi [Name],</p>

    <p style="font-size: 16px; line-height: 1.5;">Thank you for joining Knotie-AI Pro! We're excited to have you on board.</p>

    <p style="font-size: 16px; line-height: 1.5;">Here are some resources to help you get started:</p>

    <ul style="font-size: 16px; line-height: 1.5;">
      <li>Check out our <a href="https://knotie-ai.pro/docs" style="color: #2563eb;">documentation</a></li>
      <li>Watch our <a href="https://knotie-ai.pro/tutorials" style="color: #2563eb;">tutorial videos</a></li>
      <li>Join our <a href="https://knotie-ai.pro/community" style="color: #2563eb;">community</a></li>
    </ul>

    <p style="font-size: 16px; line-height: 1.5;">If you have any questions, please don't hesitate to reach out to our support team.</p>

    <p style="font-size: 16px; line-height: 1.5; margin-bottom: 0;">Best regards,<br><strong>The Knotie-AI Pro Team</strong></p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
    <p>© 2025 Knotie-AI Pro. All rights reserved.</p>
  </div>
</div>
                        `);
                      }}>
                        <CardHeader>
                          <CardTitle className="text-base">Welcome Email</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-500">Standard welcome email for new users</p>
                        </CardContent>
                      </Card>

                      <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => {
                        setSubject('Important Update from Knotie-AI Pro');
                        setEmailContent(`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://knotie-ai.pro/logo.png" alt="Knotie-AI Pro Logo" style="max-width: 150px; height: auto;" />
  </div>

  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin-top: 0; font-size: 24px;">Important Update</h1>

    <p style="font-size: 16px; line-height: 1.5;">Hi [Name],</p>

    <p style="font-size: 16px; line-height: 1.5;">We wanted to inform you about some important updates to our platform:</p>

    <ul style="font-size: 16px; line-height: 1.5;">
      <li>New feature: [Feature description]</li>
      <li>Improved performance for [Description]</li>
      <li>Fixed issue with [Description]</li>
    </ul>

    <p style="font-size: 16px; line-height: 1.5;">These changes will be effective starting [Date]. Please let us know if you have any questions.</p>

    <p style="font-size: 16px; line-height: 1.5; margin-bottom: 0;">Best regards,<br><strong>The Knotie-AI Pro Team</strong></p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
    <p>© 2025 Knotie-AI Pro. All rights reserved.</p>
  </div>
</div>
                        `);
                      }}>
                        <CardHeader>
                          <CardTitle className="text-base">Platform Update</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-500">Announcement for platform updates and new features</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="template-manager" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Template Manager</CardTitle>
                  <CardDescription>
                    Create and manage reusable email templates for your communications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SimpleEmailTemplateManager
                    onSelectTemplate={(template) => {
                      setSubject(template.subject);
                      setEmailContent(template.htmlContent);
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bulk-campaign" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Bulk Email Campaign</CardTitle>
                  <CardDescription>
                    Send emails to multiple recipients at once, such as all partners or waitlist members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BulkEmailCampaign />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
