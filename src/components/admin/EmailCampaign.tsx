'use client';

import React, { useState, useEffect } from 'react';
import { Recipient } from '@/lib/emailCampaigns';
import { ProductUpdatesEmailData, SpecialEventsEmailData } from '@/lib/emailTemplates';
import EmailEditor from './EmailEditor';
import ProductUpdatesTemplate from './ProductUpdatesTemplate';
import SpecialEventsTemplate from './SpecialEventsTemplate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EmailCampaignProps {
  recipients?: Recipient[];
  onSendCampaign: (data: any) => Promise<any>;
  onGenerateWithAI?: (prompt: string, templateType: string) => Promise<string>;
}

const EmailCampaign: React.FC<EmailCampaignProps> = ({
  recipients = [],
  onSendCampaign,
  onGenerateWithAI
}) => {
  const [templateType, setTemplateType] = useState<'product-updates' | 'special-events' | 'custom'>('custom');
  const [subject, setSubject] = useState('');
  const [customHtml, setCustomHtml] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [previewRecipient, setPreviewRecipient] = useState<Recipient | null>(null);
  const [productUpdatesData, setProductUpdatesData] = useState<ProductUpdatesEmailData>({
    to: '',
    mainTitle: '',
    introduction: '',
    partnerFeatures: [],
    customerFeatures: [],
    platformUpdates: [],
    adminUpdates: [],
    events: [],
    conclusion: ''
  });
  const [specialEventsData, setSpecialEventsData] = useState<SpecialEventsEmailData>({
    to: '',
    mainTitle: '',
    introduction: '',
    events: [],
    conclusion: ''
  });
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<'all' | 'partners' | 'waitlist'>('all');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  // Filter recipients based on selected type
  const filteredRecipients = recipients.filter(recipient => {
    if (recipientType === 'all') return true;
    return recipient.type === recipientType;
  });

  // Handle recipient selection
  const handleRecipientSelect = (id: string) => {
    if (selectedRecipients.includes(id)) {
      setSelectedRecipients(selectedRecipients.filter(r => r !== id));
    } else {
      setSelectedRecipients([...selectedRecipients, id]);
    }
  };

  // Select/deselect all recipients
  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedRecipients(filteredRecipients.map(r => r.id));
    } else {
      setSelectedRecipients([]);
    }
  };

  // Generate email content with AI
  const handleGenerateWithAI = async (prompt: string) => {
    if (!onGenerateWithAI) return '';
    return onGenerateWithAI(prompt, templateType);
  };

  // Send the campaign
  const handleSendCampaign = async () => {
    if (selectedRecipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    if (!subject) {
      alert('Please enter a subject');
      return;
    }

    // Validate based on template type
    if (templateType === 'custom' && !customHtml && !htmlContent) {
      alert('Please enter email content');
      return;
    } else if (templateType === 'product-updates' && 
               (productUpdatesData.partnerFeatures?.length === 0 || !productUpdatesData.partnerFeatures) && 
               (productUpdatesData.customerFeatures?.length === 0 || !productUpdatesData.customerFeatures) && 
               (productUpdatesData.platformUpdates?.length === 0 || !productUpdatesData.platformUpdates) && 
               (productUpdatesData.adminUpdates?.length === 0 || !productUpdatesData.adminUpdates) && 
               (productUpdatesData.events?.length === 0 || !productUpdatesData.events)) {
      alert('Please add at least one section to your product updates email');
      return;
    } else if (templateType === 'special-events' && (!specialEventsData.events || specialEventsData.events.length === 0)) {
      alert('Please add at least one event to your special events email');
      return;
    }

    // Prepare campaign data
    const campaignData = {
      recipients: recipients.filter(r => selectedRecipients.includes(r.id)),
      subject,
      templateType,
      customHtml: templateType === 'custom' ? customHtml : undefined,
      htmlContent: templateType === 'custom' ? htmlContent : undefined,
      productUpdatesData: templateType === 'product-updates' ? {
        ...productUpdatesData,
        subject
      } : undefined,
      specialEventsData: templateType === 'special-events' ? {
        ...specialEventsData,
        subject
      } : undefined
    };

    setIsSending(true);
    setSendResult(null);

    try {
      const result = await onSendCampaign(campaignData);
      setSendResult(result);
    } catch (error) {
      console.error('Error sending campaign:', error);
      setSendResult({ success: false, error });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="email-campaign">
      <div className="campaign-header">
        <h2>Email Campaign</h2>
      </div>

      <div className="campaign-form">
        <div className="form-group">
          <label>Email Subject</label>
          <input
            type="text"
            className="form-control"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter email subject"
          />
        </div>

        <div className="form-group">
          <label>Template Type</label>
          <div className="template-selector">
            <button
              type="button"
              className={`template-option ${templateType === 'custom' ? 'active' : ''}`}
              onClick={() => setTemplateType('custom')}
            >
              Custom HTML
            </button>
            <button
              type="button"
              className={`template-option ${templateType === 'product-updates' ? 'active' : ''}`}
              onClick={() => setTemplateType('product-updates')}
            >
              Product Updates
            </button>
            <button
              type="button"
              className={`template-option ${templateType === 'special-events' ? 'active' : ''}`}
              onClick={() => setTemplateType('special-events')}
            >
              Special Events
            </button>
          </div>
        </div>

        <div className="template-content">
          {templateType === 'custom' && (
            <Tabs defaultValue="editor" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="editor">Basic Editor</TabsTrigger>
                <TabsTrigger value="html">HTML Template</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="editor">
                <EmailEditor
                  initialContent={customHtml}
                  onContentChange={setCustomHtml}
                  recipients={recipients}
                  onGenerateWithAI={handleGenerateWithAI}
                />
              </TabsContent>
              
              <TabsContent value="html">
                <div className="mb-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Available Variables</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Use these variables in your HTML template to personalize emails for each recipient:
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                      <li><code>{'{{'}</code>name<code>{'}}'}</code> - Recipient's name</li>
                      <li><code>{'{{'}</code>email<code>{'}}'}</code> - Recipient's email address</li>
                      <li><code>{'{{'}</code>businessName<code>{'}}'}</code> - Business name (for partners) or recipient name</li>
                      <li><code>{'{{'}</code>date<code>{'}}'}</code> - Current date</li>
                      <li><code>{'{{'}</code>year<code>{'}}'}</code> - Current year</li>
                      <li><code>{'{{'}</code>unsubscribe<code>{'}}'}</code> - Unsubscribe link</li>
                    </ul>
                  </div>
                  <textarea
                    className="form-control font-mono text-sm"
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    rows={20}
                    placeholder="Paste your HTML email template here..."
                    style={{ width: '100%', minHeight: '400px' }}
                  />
                </div>
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">HTML Email Tips</h4>
                  <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                    <li>Use inline CSS for styling as some email clients strip out style tags</li>
                    <li>Keep your design simple and test across different email clients</li>
                    <li>Use tables for layout instead of div elements for better compatibility</li>
                    <li>Avoid JavaScript as it's not supported in most email clients</li>
                  </ul>
                </div>
              </TabsContent>
              
              <TabsContent value="preview">
                <div className="mb-4">
                  <label className="block mb-2">Preview for recipient:</label>
                  <select
                    className="form-control mb-4"
                    value={previewRecipient?.id || ''}
                    onChange={(e) => {
                      const selected = recipients.find(r => r.id === e.target.value);
                      setPreviewRecipient(selected || null);
                    }}
                  >
                    <option value="">Select a recipient...</option>
                    {recipients.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.email})
                      </option>
                    ))}
                  </select>
                  
                  {previewRecipient && (
                    <div className="preview-container border p-4 rounded">
                      <div className="mb-2 p-2 bg-gray-100 rounded">
                        <strong>To:</strong> {previewRecipient.name} &lt;{previewRecipient.email}&gt;
                      </div>
                      <div className="mb-4 p-2 bg-gray-100 rounded">
                        <strong>Subject:</strong> {subject}
                      </div>
                      <div className="preview-content">
                        <iframe
                          srcDoc={htmlContent.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
                            // Trim whitespace from variable name
                            const trimmedVariable = variable.trim();
                            let value = match;
                            
                            if (trimmedVariable === 'name' && previewRecipient) {
                              value = previewRecipient.name;
                            } else if (trimmedVariable === 'email' && previewRecipient) {
                              value = previewRecipient.email;
                            } else if (trimmedVariable === 'businessName' && previewRecipient) {
                              // Use type assertion to access businessName
                              const businessName = (previewRecipient as any).businessName;
                              value = businessName || previewRecipient.name;
                            } else if (trimmedVariable === 'unsubscribe') {
                              value = '#unsubscribe-link';
                            } else if (trimmedVariable === 'date') {
                              value = new Date().toLocaleDateString();
                            } else if (trimmedVariable === 'year') {
                              value = new Date().getFullYear().toString();
                            }
                            return value;
                          })}
                          style={{ width: '100%', height: '500px', border: 'none' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
          
          {templateType === 'product-updates' && (
            <ProductUpdatesTemplate
              initialData={productUpdatesData}
              onDataChange={setProductUpdatesData}
            />
          )}
          
          {templateType === 'special-events' && (
            <SpecialEventsTemplate
              initialData={specialEventsData}
              onDataChange={setSpecialEventsData}
            />
          )}
        </div>

        <div className="recipients-section">
          <div className="recipients-header">
            <h3>Recipients</h3>
            <div className="recipient-filters">
              <select
                className="form-control"
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value as any)}
              >
                <option value="all">All Recipients</option>
                <option value="partners">Partners Only</option>
                <option value="waitlist">Waitlist Only</option>
              </select>
              
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handleSelectAll(true)}
              >
                Select All
              </button>
              
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handleSelectAll(false)}
              >
                Deselect All
              </button>
            </div>
          </div>
          
          <div className="recipients-list">
            {filteredRecipients.length === 0 ? (
              <p className="text-muted">No recipients found.</p>
            ) : (
              <table className="recipients-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipients.map((recipient) => (
                    <tr key={recipient.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(recipient.id)}
                          onChange={() => handleRecipientSelect(recipient.id)}
                        />
                      </td>
                      <td>{recipient.name}</td>
                      <td>{recipient.email}</td>
                      <td>
                        <span className={`badge ${recipient.type === 'partner' ? 'badge-primary' : 'badge-secondary'}`}>
                          {recipient.type === 'partner' ? 'Partner' : 'Waitlist'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="recipients-summary">
            <p>
              {selectedRecipients.length} of {filteredRecipients.length} recipients selected
            </p>
          </div>
        </div>

        <div className="campaign-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSendCampaign}
            disabled={isSending || selectedRecipients.length === 0}
          >
            {isSending ? 'Sending...' : 'Send Campaign'}
          </button>
        </div>

        {sendResult && (
          <div className={`send-result ${sendResult.success ? 'success' : 'error'}`}>
            {sendResult.success ? (
              <div>
                <h4>Campaign Sent Successfully</h4>
                <p>
                  Successfully sent to {sendResult.success} recipients.
                  {sendResult.failed > 0 && ` Failed to send to ${sendResult.failed} recipients.`}
                </p>
              </div>
            ) : (
              <div>
                <h4>Error Sending Campaign</h4>
                <p>There was an error sending your campaign. Please try again.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .email-campaign {
          width: 100%;
        }
        
        .campaign-header {
          margin-bottom: 1.5rem;
        }
        
        .campaign-header h2 {
          margin: 0;
          color: #f9fafb;
        }
        
        .campaign-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #f9fafb;
        }
        
        .form-control {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background-color: #111827;
          color: #f9fafb;
          font-size: 0.875rem;
        }
        
        .template-selector {
          display: flex;
          gap: 0.5rem;
        }
        
        .template-option {
          padding: 0.5rem 1rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background-color: #1f2937;
          color: #f9fafb;
          cursor: pointer;
          font-size: 0.875rem;
        }
        
        .template-option.active {
          background-color: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }
        
        .template-content {
          margin-bottom: 1.5rem;
          padding: 1.5rem;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          background-color: #1f2937;
        }
        
        .recipients-section {
          margin-bottom: 1.5rem;
          padding: 1.5rem;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          background-color: #1f2937;
        }
        
        .recipients-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .recipients-header h3 {
          margin: 0;
          color: #f9fafb;
        }
        
        .recipient-filters {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        
        .recipient-filters select {
          width: auto;
        }
        
        .recipients-list {
          margin-bottom: 1rem;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .recipients-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .recipients-table th,
        .recipients-table td {
          padding: 0.5rem;
          text-align: left;
          border-bottom: 1px solid #374151;
        }
        
        .recipients-table th {
          color: #9ca3af;
          font-weight: 500;
          font-size: 0.75rem;
          text-transform: uppercase;
        }
        
        .badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        .badge-primary {
          background-color: #3b82f6;
          color: white;
        }
        
        .badge-secondary {
          background-color: #6b7280;
          color: white;
        }
        
        .recipients-summary {
          color: #9ca3af;
          font-size: 0.875rem;
        }
        
        .campaign-actions {
          display: flex;
          justify-content: flex-end;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
        }
        
        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }
        
        .btn-primary {
          background-color: #3b82f6;
          color: white;
          border: none;
        }
        
        .btn-primary:disabled {
          background-color: #6b7280;
          cursor: not-allowed;
        }
        
        .btn-outline-secondary {
          background-color: transparent;
          color: #9ca3af;
          border: 1px solid #4b5563;
        }
        
        .text-muted {
          color: #9ca3af;
        }
        
        .send-result {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 0.375rem;
        }
        
        .send-result.success {
          background-color: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        
        .send-result.error {
          background-color: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        
        .send-result h4 {
          margin-top: 0;
          margin-bottom: 0.5rem;
          color: #f9fafb;
        }
        
        .send-result p {
          margin: 0;
          color: #d1d5db;
        }
      `}</style>
    </div>
  );
};

export default EmailCampaign;
