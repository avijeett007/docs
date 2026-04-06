'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

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

interface EmailTemplateManagerProps {
  onSelectTemplate?: (template: EmailTemplate) => void;
}

export default function EmailTemplateManager({ onSelectTemplate }: EmailTemplateManagerProps) {
  const { toast } = useToast();

  // Use template
  const handleUseTemplate = (template: EmailTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      toast({
        title: 'Template Selected',
        description: `Template "${template.name}" has been loaded`,
        variant: 'default',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Email Templates</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a template to use in your email campaign
          </p>
        </div>
        <Button onClick={() => {
          toast({
            title: 'Template Creation',
            description: 'Please use the template list below to select a template',
            variant: 'default',
          });
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => handleUseTemplate({
          id: '1',
          name: 'Welcome Email',
          description: 'Standard welcome email for new users',
          subject: 'Welcome to Knotie-AI Pro!',
          htmlContent: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://knotie-ai.pro/logo.png" alt="Knotie-AI Pro Logo" style="max-width: 150px; height: auto;" />
  </div>

  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin-top: 0; font-size: 24px;">Welcome to Knotie-AI Pro!</h1>

    <p style="font-size: 16px; line-height: 1.5;">Hi {{name}},</p>

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
          `,
          category: 'welcome',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })}>
          <CardHeader>
            <CardTitle className="text-base">Welcome Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Standard welcome email for new users</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => handleUseTemplate({
          id: '2',
          name: 'Platform Update',
          description: 'Announcement for platform updates and new features',
          subject: 'Important Update from Knotie-AI Pro',
          htmlContent: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://knotie-ai.pro/logo.png" alt="Knotie-AI Pro Logo" style="max-width: 150px; height: auto;" />
  </div>

  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #2563eb; margin-top: 0; font-size: 24px;">Important Update</h1>

    <p style="font-size: 16px; line-height: 1.5;">Hi {{name}},</p>

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
          `,
          category: 'update',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })}>
          <CardHeader>
            <CardTitle className="text-base">Platform Update</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Announcement for platform updates and new features</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
