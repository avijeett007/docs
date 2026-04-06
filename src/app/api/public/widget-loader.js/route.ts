import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Widget loader JavaScript that will be embedded on external sites
const WIDGET_LOADER_SCRIPT = `
(function() {
  'use strict';
  
  // Prevent multiple loads
  if (window.KnotieWidgetLoader) {
    return;
  }
  
  window.KnotieWidgetLoader = {
    version: '1.0.0',
    loaded: false,
    widgets: new Map(),
    
    // Initialize widget
    init: function(element, token) {
      if (!element || !token) {
        console.error('KnotieWidget: Missing element or token');
        return;
      }
      
      const widgetId = 'knotie-widget-' + Math.random().toString(36).substr(2, 9);
      element.id = element.id || widgetId;
      
      // Store widget reference
      this.widgets.set(element.id, {
        element: element,
        token: token,
        loaded: false
      });
      
      // Load widget configuration
      this.loadWidget(element.id);
    },
    
    // Load widget configuration and render
    loadWidget: function(widgetId) {
      const widget = this.widgets.get(widgetId);
      if (!widget) return;

      // Get the actual embedding domain (parent page domain)
      let origin;
      try {
        // Try to get parent page origin (works if same-origin or properly configured)
        origin = window.parent.location.origin;
      } catch (e) {
        // Fallback to current origin if cross-origin restrictions apply
        origin = window.location.origin;
        console.log('[Widget] Using fallback origin due to cross-origin restrictions');
      }

      // Also get referer for additional validation
      const referer = document.referrer;

      const apiUrl = '${process.env.WIDGET_APP_URL || 'https://knotie-ai.pro'}/api/public/widget-config';
      
      // Show loading state
      widget.element.innerHTML = \`
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #6B7280;
          font-size: 14px;
        ">
          <div style="
            width: 20px;
            height: 20px;
            border: 2px solid #E5E7EB;
            border-top: 2px solid #6366F1;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
          "></div>
          Loading...
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      \`;
      
      // Fetch widget configuration
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: widget.token,
          origin: origin,
          referer: referer,
          embedDomain: window.location.origin // The actual widget hosting domain
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.renderWidget(widgetId, data.config);
        } else {
          this.showError(widgetId, data.error || 'Failed to load widget');
        }
      })
      .catch(error => {
        console.error('KnotieWidget: Failed to load configuration', error);
        this.showError(widgetId, 'Failed to load widget configuration');
      });
    },
    
    // Render the actual widget
    renderWidget: function(widgetId, config) {
      const widget = this.widgets.get(widgetId);
      if (!widget) return;
      
      // Create iframe for security isolation
      const iframe = document.createElement('iframe');
      iframe.style.cssText = \`
        width: 100%;
        height: \${this.getWidgetHeight(config.widgetType)};
        border: none;
        border-radius: \${config.customization.appearance.borderRadius || 12}px;
        background: transparent;
      \`;

      // Add permissions for microphone, camera, and other media features
      iframe.allow = 'microphone; camera; autoplay; clipboard-read; clipboard-write; encrypted-media';
      iframe.setAttribute('allowfullscreen', '');

      // Set iframe source to widget renderer
      const widgetUrl = '${process.env.WIDGET_APP_URL || 'https://knotie-ai.pro'}/widget/' + widget.token;
      iframe.src = widgetUrl;
      
      // Replace loading content with iframe
      widget.element.innerHTML = '';
      widget.element.appendChild(iframe);
      
      widget.loaded = true;
      
      // Track widget load
      this.trackEvent(widget.token, 'widget_loaded', {
        origin: window.location.origin,
        widgetType: config.widgetType
      });
    },
    
    // Show error message
    showError: function(widgetId, message) {
      const widget = this.widgets.get(widgetId);
      if (!widget) return;
      
      widget.element.innerHTML = \`
        <div style="
          padding: 20px;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 8px;
          color: #DC2626;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          text-align: center;
        ">
          <strong>Widget Error:</strong> \${message}
        </div>
      \`;
    },
    
    // Get appropriate height for widget type
    getWidgetHeight: function(widgetType) {
      const heights = {
        'siri': '200px',
        'orb': '300px',
        'floaty': '80px',
        'minimal': '250px'
      };
      return heights[widgetType] || '200px';
    },
    
    // Track analytics events
    trackEvent: function(token, eventType, data) {
      const apiUrl = '${process.env.WIDGET_APP_URL || 'https://knotie-ai.pro'}/api/public/widget-analytics';
      
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          eventType: eventType,
          data: data,
          timestamp: Date.now()
        })
      }).catch(error => {
        console.warn('KnotieWidget: Failed to track event', error);
      });
    }
  };
  
  // Auto-initialize widgets on page load
  function initializeWidgets() {
    const widgets = document.querySelectorAll('[data-token]');
    widgets.forEach(function(element) {
      const token = element.getAttribute('data-token');
      if (token && !element.hasAttribute('data-knotie-initialized')) {
        element.setAttribute('data-knotie-initialized', 'true');
        window.KnotieWidgetLoader.init(element, token);
      }
    });
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidgets);
  } else {
    initializeWidgets();
  }
  
  // Watch for dynamically added widgets
  if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            if (node.hasAttribute && node.hasAttribute('data-token')) {
              const token = node.getAttribute('data-token');
              if (token && !node.hasAttribute('data-knotie-initialized')) {
                node.setAttribute('data-knotie-initialized', 'true');
                window.KnotieWidgetLoader.init(node, token);
              }
            }
            // Check child elements
            const childWidgets = node.querySelectorAll && node.querySelectorAll('[data-token]');
            if (childWidgets) {
              childWidgets.forEach(function(element) {
                const token = element.getAttribute('data-token');
                if (token && !element.hasAttribute('data-knotie-initialized')) {
                  element.setAttribute('data-knotie-initialized', 'true');
                  window.KnotieWidgetLoader.init(element, token);
                }
              });
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
`;

// GET /api/public/widget-loader.js - Serve the widget loader script
export async function GET(request: NextRequest) {
  const baseUrl = process.env.WIDGET_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://knotie-ai.pro';

  // Replace the hardcoded URLs with the actual base URL
  const dynamicScript = WIDGET_LOADER_SCRIPT
    .replace(/\$\{process\.env\.WIDGET_APP_URL \|\| 'https:\/\/knotie-ai\.pro'\}/g, baseUrl);

  return new NextResponse(dynamicScript, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
