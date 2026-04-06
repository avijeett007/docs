'use client';

import { useEffect, useRef } from 'react';

interface N8nChatAgent {
  id: string;
  name: string;
  customer_id: string;
  partner_id?: string;
}

interface WidgetConfig {
  title: string;
  subtitle: string;
  welcome_message: string;
  input_placeholder: string;
  mode: 'window' | 'fullscreen';
  show_welcome_screen: boolean;
  load_previous_session: boolean;
  allow_file_uploads: boolean;
  allowed_file_types: string;
  enable_streaming: boolean;
  css_primary_color: string;
  css_secondary_color: string;
  css_background_color: string;
  css_text_color: string;
  css_window_width: string;
  css_window_height: string;
  css_border_radius: string;
  css_toggle_size: string;
}

interface N8nChatPreviewProps {
  agent: N8nChatAgent;
  config: WidgetConfig;
}

export default function N8nChatPreview({ agent, config }: N8nChatPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const analyticsUrl = process.env.NEXT_PUBLIC_ANALYTICS_API_URL || 'https://analytics.knotie-ai.pro';

    // Get partner ID from localStorage (JWT token)
    const getPartnerId = () => {
      try {
        const token = localStorage.getItem('partner_token');
        if (!token) return null;

        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.partnerId;
      } catch (error) {
        console.error('Error getting partner ID:', error);
        return null;
      }
    };

    const partnerId = agent.partner_id || getPartnerId();
    if (!partnerId) {
      console.error('Partner ID not available for N8N chat preview');
      return;
    }

    const webhookUrl = `${analyticsUrl}/proxy/n8n-chat/${partnerId}/${agent.customer_id}/${agent.id}`;

    // Generate the complete HTML with embedded N8N widget
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>N8N Chat Widget Preview</title>
  <link href="https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css" rel="stylesheet" />
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      position: relative;
    }

    /* Simulated website content */
    .mock-website {
      opacity: 0.3;
      pointer-events: none;
    }

    .mock-header {
      height: 60px;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      margin: -20px -20px 20px -20px;
      padding: 0 20px;
      display: flex;
      align-items: center;
    }

    .mock-content {
      max-width: 800px;
    }

    .mock-line {
      height: 16px;
      background: #d1d5db;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .mock-line.short { width: 60%; }
    .mock-line.medium { width: 80%; }
    .mock-line.long { width: 100%; }

    .mock-block {
      height: 120px;
      background: #e5e7eb;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    /* Dynamic CSS Variables for N8N Chat */
    :root {
      --chat--color-primary: ${config.css_primary_color};
      --chat--color-primary-shade-50: ${config.css_primary_color}dd;
      --chat--color-primary-shade-100: ${config.css_primary_color}bb;
      --chat--color-secondary: ${config.css_secondary_color};
      --chat--color-secondary-shade-50: ${config.css_secondary_color}dd;
      --chat--color-white: ${config.css_background_color};
      --chat--color-light: #f2f4f8;
      --chat--color-light-shade-50: #e6e9f1;
      --chat--color-light-shade-100: #c2c5cc;
      --chat--color-medium: #d2d4d9;
      --chat--color-dark: ${config.css_text_color};
      --chat--color-disabled: #777980;
      --chat--color-typing: #404040;
      --chat--spacing: 1rem;
      --chat--border-radius: ${config.css_border_radius};
      --chat--transition-duration: 0.15s;
      --chat--window--width: ${config.css_window_width};
      --chat--window--height: ${config.css_window_height};
      --chat--header-height: auto;
      --chat--header--padding: var(--chat--spacing);
      --chat--header--background: var(--chat--color-dark);
      --chat--header--color: var(--chat--color-light);
      --chat--header--border-top: none;
      --chat--header--border-bottom: none;
      --chat--heading--font-size: 2em;
      --chat--subtitle--font-size: inherit;
      --chat--subtitle--line-height: 1.8;
      --chat--textarea--height: 50px;
      --chat--message--font-size: 1rem;
      --chat--message--padding: var(--chat--spacing);
      --chat--message--border-radius: var(--chat--border-radius);
      --chat--message-line-height: 1.8;
      --chat--message--bot--background: var(--chat--color-white);
      --chat--message--bot--color: var(--chat--color-dark);
      --chat--message--bot--border: none;
      --chat--message--user--background: var(--chat--color-secondary);
      --chat--message--user--color: var(--chat--color-white);
      --chat--message--user--border: none;
      --chat--message--pre--background: rgba(0, 0, 0, 0.05);
      --chat--toggle--background: ${config.css_primary_color};
      --chat--toggle--hover--background: ${config.css_primary_color}dd;
      --chat--toggle--active--background: ${config.css_primary_color}bb;
      --chat--toggle--color: var(--chat--color-white);
      --chat--toggle--size: ${config.css_toggle_size};
    }
  </style>
</head>
<body>
  <!-- Mock website content -->
  <div class="mock-website">
    <div class="mock-header">
      <div style="font-weight: bold; color: #374151;">Your Website</div>
    </div>
    <div class="mock-content">
      <div class="mock-line long"></div>
      <div class="mock-line medium"></div>
      <div class="mock-line short"></div>
      <div class="mock-block"></div>
      <div class="mock-line long"></div>
      <div class="mock-line short"></div>
      <div class="mock-line medium"></div>
    </div>
  </div>

  <!-- N8N Chat Widget Script -->
  <script type="module">
    import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

    try {
      createChat({
        webhookUrl: ${JSON.stringify(webhookUrl)},
        mode: ${JSON.stringify(config.mode)},
        showWelcomeScreen: ${config.show_welcome_screen},
        loadPreviousSession: false,
        allowFileUploads: ${config.allow_file_uploads},
        allowedFilesMimeTypes: ${JSON.stringify(config.allowed_file_types)},
        enableStreaming: ${config.enable_streaming},
        initialMessages: [${JSON.stringify(config.welcome_message)}],
        i18n: {
          en: {
            title: ${JSON.stringify(config.title)},
            subtitle: ${JSON.stringify(config.subtitle)},
            inputPlaceholder: ${JSON.stringify(config.input_placeholder)},
            getStarted: 'New Conversation',
            closeButtonTooltip: 'Close chat'
          }
        }
      });
    } catch (error) {
      console.error('Failed to initialize N8N chat:', error);
      document.body.innerHTML += '<div style="position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 12px; border-radius: 8px; z-index: 9999;">Chat widget failed to load</div>';
    }
  </script>
</body>
</html>`;

    // Write the HTML content to the iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
    }

  }, [agent, config]); // Re-run when agent or config changes

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Live Preview</h3>
        <p className="text-sm text-gray-400">
          This is how your widget will look and behave on your website. Changes update in real-time.
        </p>
      </div>

      <div className="flex-1 bg-white rounded-lg overflow-hidden border border-gray-600">
        <iframe
          ref={iframeRef}
          className="w-full h-full"
          style={{ minHeight: '500px' }}
          title="N8N Chat Widget Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>

      <div className="mt-4 text-xs text-gray-400">
        <p>💡 <strong>Tip:</strong> The widget is fully functional in preview mode. You can interact with it to test the experience.</p>
      </div>
    </div>
  );
}
