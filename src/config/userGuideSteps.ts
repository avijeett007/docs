interface GuideStep {
  element?: string | null;
  intro: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  voice?: string;
}

interface GuideConfig {
  sidebar: {
    steps: GuideStep[];
  };
  dashboard: {
    steps: GuideStep[];
  };
  'ai-agents': {
    steps: GuideStep[];
  };
  settings: {
    steps: GuideStep[];
  };
  'settings-whitelabel': {
    steps: GuideStep[];
  };
  'settings-api-keys': {
    steps: GuideStep[];
  };
  customers: {
    steps: GuideStep[];
  };
  'ai-agents-retell': {
    steps: GuideStep[];
  };
  billing: {
    steps: GuideStep[];
  };
  credits: {
    steps: GuideStep[];
  };
  'ai-usage': {
    steps: GuideStep[];
  };
  'usage-analytics': {
    steps: GuideStep[];
  };
  marketing: {
    steps: GuideStep[];
  };
  tutorials: {
    steps: GuideStep[];
  };
  team: {
    steps: GuideStep[];
  };
}

export const userGuideSteps: GuideConfig = {
  sidebar: {
    steps: [
      {
        element: null,
        intro: "Welcome to Knotie-AI Pro! Let me guide you through your partner dashboard navigation and main features.",
        voice: "Welcome to Knotie-AI Pro! I'll guide you through your partner dashboard. First, let's explore the navigation menu, then we'll look at your main dashboard features."
      },
      {
        element: '[href="/partner/dashboard"]',
        intro: "This is your Dashboard - your central hub for monitoring all activities, metrics, and recent updates.",
        position: "right",
        voice: "The Dashboard is your command center. Here you can see an overview of your business metrics, recent customer activities, and important notifications."
      },
      {
        element: '[href="/partner/customers"]',
        intro: "Manage all your customers in one place. View their status, usage, and account details.",
        position: "right",
        voice: "In the Customer List, you can view all your customers, track their subscription status, and manage their accounts efficiently."
      },
      {
        element: '[href="/partner/billing"]',
        intro: "Track payments, view invoices, and manage your subscription details here.",
        position: "right",
        voice: "The Billing section helps you stay on top of your finances with detailed invoices, payment history, and subscription management."
      },
      {
        element: '[href="/partner/ai-usage"]',
        intro: "Monitor AI usage across your organization with detailed analytics and insights.",
        position: "right",
        voice: "Track how your AI agents are being used with real-time analytics. This helps you optimize performance and manage costs effectively."
      },
      {
        element: '[href="/partner/usage-analytics"]',
        intro: "Get deeper insights into usage patterns and trends with comprehensive analytics.",
        position: "right",
        voice: "Usage Analytics provides detailed reports and visualizations to help you understand usage patterns and make data-driven decisions."
      },
      {
        element: '[href="/partner/credits"]',
        intro: "View your credit balance and purchase additional credits when needed.",
        position: "right",
        voice: "Keep track of your available credits here. You can monitor usage and easily top up when running low to ensure uninterrupted service."
      },
      {
        element: '[href="/partner/ai-agents"]',
        intro: "The heart of your operations - configure, deploy, and manage your AI voice agents.",
        position: "right",
        voice: "This is where you create and manage your AI voice agents. Configure their behavior, integrate with your systems, and deploy them to handle customer interactions."
      },
      {
        element: '[href="/partner/marketing"]',
        intro: "Access marketing materials and tools to promote your AI-powered services.",
        position: "right",
        voice: "Find everything you need to market your services - from videos and social media posts to website templates and customer demos."
      },
      {
        element: '[href="/partner/tutorials"]',
        intro: "Learn how to make the most of the platform with step-by-step guides and video tutorials.",
        position: "right",
        voice: "Access comprehensive tutorials and documentation to master every feature of the platform and stay updated with new capabilities."
      },
      {
        element: '[href="/partner/team"]',
        intro: "Manage your team members, assign roles, and control access permissions.",
        position: "right",
        voice: "Add team members, define their roles, and manage permissions to ensure secure and efficient collaboration."
      },
      {
        element: '[href="/partner/settings"]',
        intro: "Configure your profile, API keys, and customize your white-label portal.",
        position: "right",
        voice: "Customize your experience with profile settings, API configurations, and white-label options to match your brand."
      },
      {
        element: "main",
        intro: "Dashboard Overview - Your business command center with key metrics and insights.",
        position: "center",
        voice: "This is your main dashboard area where you can monitor all aspects of your business. You'll see credit balances, key metrics, deal status, and marketing tools all in one place."
      },
      {
        element: ".fixed.bottom-4.right-4",
        intro: "Remember: You can visit any page and click this tour button to get a guided tour of that specific page. Each section has its own contextual help!",
        position: "left",
        voice: "Remember, you can go to any other page in the platform and click this tour button to get a guided tour specific to that page. Each section has its own contextual help to guide you through the features."
      }
    ]
  },
  dashboard: {
    steps: [
      {
        element: null,
        intro: "Welcome to your Dashboard! Let's explore the key features together.",
        voice: "Welcome to your Dashboard! This is where you'll monitor your business performance. I'll show you each section - you can click on any highlighted area to learn more about it."
      },
      {
        element: "main",
        intro: "Dashboard Overview - Monitor your business metrics, deals, credits, and marketing tools.",
        position: "center",
        voice: "This dashboard gives you a complete overview of your business. You can see key metrics, track deals, monitor credits, and access marketing materials all in one place."
      },
      {
        element: ".fixed.bottom-4.right-4",
        intro: "Remember: You can visit any page and click this tour button to get contextual help for that specific page!",
        position: "left",
        voice: "Remember, you can go to any other page in the platform and click this tour button to get a guided tour specific to that page. Each section has its own contextual help to guide you through the features."
      }
    ]
  },

  settings: {
    steps: [
      {
        element: null,
        intro: "Welcome to Settings - Let's focus on the essential settings for your agency: Profile, MFA, Email, and Stripe Connect.",
        voice: "Welcome to Settings! I'll guide you through the four most important settings for your agency: Profile Settings, Multi-Factor Authentication, Email Settings, and Stripe Connect."
      },
      {
        element: ".grid.gap-6 > div:nth-child(1)",
        intro: "Profile Settings - Update your business information and contact details.",
        position: "bottom",
        voice: "Start here to update your business information, contact details, and partnership settings. Click the Update Profile button to make changes to your agency details."
      },
      {
        element: ".grid.gap-6 > div:nth-child(4)",
        intro: "Security Settings with MFA - Essential security for your agency and required for Stripe Connect.",
        position: "bottom",
        voice: "Multi-Factor Authentication is crucial for your agency security and required for Stripe Connect. Enable MFA to protect your account and customer data with an extra layer of security."
      },
      {
        element: ".grid.gap-6 > div:nth-child(6)",
        intro: "Email Settings - Configure SMTP for white-label customer communications.",
        position: "bottom",
        voice: "Configure your SMTP server here to send white-label emails to your customers. This ensures all communications come from your domain, maintaining your professional brand image."
      },
      {
        element: ".grid.gap-6 > div:nth-child(7)",
        intro: "Stripe Connect - Set up payment processing to monetize your AI services.",
        position: "top",
        voice: "Stripe Connect allows you to process payments and monetize your AI services. This is essential for building a profitable agency business with recurring revenue."
      }
    ]
  },
  'settings-whitelabel': {
    steps: [
      {
        element: null,
        intro: "Welcome to White-Label Settings - Set up your branded customer portal for agency success.",
        voice: "Let's set up your white-label customer portal. This is where you'll configure your branding, domain, and customer experience to build your agency."
      },
      {
        element: ".bg-gray-900.border.border-gray-800.rounded-lg.p-6",
        intro: "Domain Settings - Configure how customers access your branded portal.",
        position: "bottom",
        voice: "First, let's configure your domain settings. You can enable your customer portal, set up a subdomain, or use your own custom domain for a professional appearance."
      },
      {
        element: "#customerPortalEnabled",
        intro: "Enable Customer Portal - Activate your branded portal for customers.",
        position: "right",
        voice: "Check this box to activate your branded customer portal. This creates a professional interface where your customers can access voice AI services under your brand."
      },
      {
        element: "#enableCustomerSignup",
        intro: "Customer Signup - Allow new customers to register directly through your portal.",
        position: "right",
        voice: "Enable this to let potential customers sign up directly through your branded portal, helping you grow your customer base automatically."
      },
      {
        element: "#voiceAiAgentEnabled",
        intro: "Interactive Voice AI Agent - Replace static elements with a live AI agent.",
        position: "right",
        voice: "This powerful feature replaces static buttons with an interactive AI agent that customers can talk to. It requires AI credits but provides an amazing customer experience."
      },
      {
        element: "#primaryColor",
        intro: "Brand Colors - Set your primary and secondary brand colors.",
        position: "top",
        voice: "Choose your brand colors to match your company's visual identity. These colors will be used throughout your customer portal for buttons, links, and accents."
      },
      {
        element: "button[type='submit']",
        intro: "Save Settings - Apply your branding configuration.",
        position: "top",
        voice: "Once you've configured everything, click Save Settings to apply your changes. Your branded customer portal will be ready for your customers to use."
      }
    ]
  },

  billing: {
    steps: [
      {
        element: null,
        intro: "Welcome to Billing - track your finances and manage subscriptions.",
        voice: "Let's explore the Billing section where you can monitor payments, view invoices, and manage your subscription."
      },
      {
        element: '[data-section="invoices"]',
        intro: "View and download all your invoices and payment history.",
        position: "bottom",
        voice: "Access all your invoices here. You can download them for your records and track your payment history."
      },
      {
        element: '[data-section="subscription"]',
        intro: "Manage your subscription plan and billing preferences.",
        position: "top",
        voice: "View your current subscription details and make changes to your plan or billing preferences."
      }
    ]
  },
  credits: {
    steps: [
      {
        element: null,
        intro: "Welcome to Credits - monitor and manage your AI usage credits.",
        voice: "Let's explore the Credits section where you can track your usage and purchase additional credits."
      },
      {
        element: '[data-section="balance"]',
        intro: "View your current credit balance and usage statistics.",
        position: "bottom",
        voice: "Monitor your available credits and see how they're being used across your AI agents and services."
      },
      {
        element: '[data-action="purchase-credits"]',
        intro: "Purchase additional credits when you need more capacity.",
        position: "left",
        voice: "Use this button to purchase more credits and ensure uninterrupted service for your AI agents."
      }
    ]
  },
  "ai-usage": {
    steps: [
      {
        element: null,
        intro: "Welcome to AI Usage Analytics - detailed insights into your AI agent performance.",
        voice: "Let's explore the AI Usage section where you can analyze performance and optimize your AI agents."
      },
      {
        element: '[data-section="usage-charts"]',
        intro: "View detailed charts and graphs of your AI agent usage patterns.",
        position: "bottom",
        voice: "These charts show you how your AI agents are performing over time, helping you identify trends and optimization opportunities."
      }
    ]
  },
  marketing: {
    steps: [
      {
        element: null,
        intro: "Welcome to Marketing - tools and materials to promote your services.",
        voice: "Let's explore the Marketing section where you can find promotional materials and tools."
      },
      {
        element: '[data-section="materials"]',
        intro: "Access marketing materials, videos, and promotional content.",
        position: "bottom",
        voice: "Find everything you need to market your AI services, from videos to social media content."
      }
    ]
  },
  tutorials: {
    steps: [
      {
        element: null,
        intro: "Welcome to Tutorials - learn how to maximize your platform usage.",
        voice: "Let's explore the Tutorials section where you can access guides and documentation."
      },
      {
        element: '[data-section="guides"]',
        intro: "Access step-by-step guides and video tutorials.",
        position: "bottom",
        voice: "Find comprehensive tutorials to help you master every feature of the platform."
      }
    ]
  },
  team: {
    steps: [
      {
        element: null,
        intro: "Welcome to Team Management - manage your team members and permissions.",
        voice: "Let's explore the Team Management section where you can add team members and manage access."
      },
      {
        element: '[data-section="team-list"]',
        intro: "View and manage all your team members and their roles.",
        position: "bottom",
        voice: "See all your team members, their roles, and manage their access permissions."
      },
      {
        element: '[data-action="invite-member"]',
        intro: "Invite new team members and assign them appropriate roles.",
        position: "left",
        voice: "Use this button to invite new team members and set up their access permissions."
      }
    ]
  },
  'settings-api-keys': {
    steps: [
      {
        element: null,
        intro: "Welcome to API Keys - Create and manage secure API access for automation and integrations.",
        voice: "Let's explore the API Keys section where you can create secure API keys for automation, integrations, and building AI-powered business workflows."
      },
      {
        element: ".space-y-6 > .grid.gap-6 > div:nth-child(1)",
        intro: "API Key Management - Overview of secure authentication and key features.",
        position: "bottom",
        voice: "This section explains the benefits of API keys: secure authentication, granular permissions, and easy key rotation for maintaining security best practices."
      },
      {
        element: ".space-y-6 > .grid.gap-6 > div:nth-child(2)",
        intro: "Security Information - Important guidelines for safe API key usage.",
        position: "bottom",
        voice: "Review these security guidelines to keep your API keys safe. Never share them publicly and monitor usage regularly for suspicious activity."
      },
      {
        element: ".space-y-6 > .grid.gap-6 > div:nth-child(3)",
        intro: "MCP API - Model Context Protocol for complete automation and AI integration.",
        position: "bottom",
        voice: "The MCP API is powerful for building automated AI businesses. You can create customers, manage agents, run ad campaigns, and integrate with AI tools like Claude and ChatGPT."
      },
      {
        element: ".space-y-6 > .grid.gap-6 > div:nth-child(4)",
        intro: "Your API Keys - Create and manage your actual API keys here.",
        position: "top",
        voice: "This is where you'll create and manage your actual API keys. Use these keys to authenticate your applications and automate your business processes."
      }
    ]
  },
  'usage-analytics': {
    steps: [
      {
        element: null,
        intro: "Welcome to Usage Analytics - Monitor your AI agent performance and costs.",
        voice: "Welcome to Usage Analytics! Here you can monitor your AI agent performance, track costs, and analyze usage patterns to optimize your business operations."
      },
      {
        element: ".grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4.gap-6",
        intro: "Overview Cards - Key metrics at a glance: credits used, total calls, duration, and efficiency.",
        position: "bottom",
        voice: "These overview cards show your key performance metrics: total credits used, number of calls, total duration, and efficiency rating. Monitor these to track your business performance."
      },
      {
        element: ".grid.grid-cols-1.lg\\:grid-cols-2.gap-6",
        intro: "Analytics Charts - Visual insights into your usage trends and provider distribution.",
        position: "bottom",
        voice: "These charts provide visual insights into your usage patterns. The daily usage trend shows how your business is growing, while the provider distribution helps you understand which AI platforms you use most."
      },
      {
        element: ".bg-gray-800.rounded-lg.p-6:has(h3:contains('Efficiency'))",
        intro: "Efficiency Metrics - Cost optimization insights for your AI operations.",
        position: "top",
        voice: "The efficiency metrics help you optimize costs by showing cost per call, cost per minute, and average call duration. Use these insights to improve your profit margins."
      }
    ]
  },
  'ai-agents': {
    steps: [
      {
        element: null,
        intro: "Welcome to AI Agents - Your hub for creating and managing AI-powered business workflows.",
        voice: "Welcome to AI Agents! This is where you can create and manage both AI workflow systems and voice AI agents to power your business automation."
      },
      {
        element: ".max-w-7xl.mx-auto.space-y-12 > div:nth-child(1)",
        intro: "AI Workflow Systems - Create automated business processes and bring your own agents.",
        position: "bottom",
        voice: "AI Workflow Systems let you create automated business processes. You can integrate with platforms like GoHighLevel and bring your own agents to create powerful automation workflows."
      },
      {
        element: ".max-w-7xl.mx-auto.space-y-12 > div:nth-child(2)",
        intro: "Voice AI Agents - Select platforms like Retell, VAPI, and Ultravox for conversational AI.",
        position: "top",
        voice: "Voice AI Agents are where you create conversational AI experiences. Choose from platforms like Retell, VAPI, and Ultravox to build voice agents that can handle customer interactions automatically."
      }
    ]
  },
  'ai-agents-retell': {
    steps: [
      {
        element: null,
        intro: "Welcome to Retell AI Agents - This interface is similar across all voice AI platforms (VAPI, Ultravox, etc.).",
        voice: "Welcome to Retell AI Agents! This interface works similarly across all voice AI platforms like VAPI, Ultravox, and others. The concepts and workflows you learn here apply to all voice AI agent management."
      },
      {
        element: ".flex.justify-between.items-center.mb-6",
        intro: "Agent Management Header - Import agents, manage API keys, and access webhooks.",
        position: "bottom",
        voice: "Use these controls to import agents from Retell, manage your API keys, and configure webhooks for real-time analytics. The same concepts apply to other voice AI platforms."
      },
      {
        element: ".grid.grid-cols-1.gap-6",
        intro: "Agent List - View and manage all your voice AI agents with customer assignments.",
        position: "top",
        voice: "This is your agent list where you can see all voice AI agents, their assigned customers, and management options. Each agent can be customized and assigned to specific customers for personalized experiences."
      }
    ]
  },
  customers: {
    steps: [
      {
        element: null,
        intro: "Welcome to Customer Management - Your hub for managing all customer accounts and onboarding.",
        voice: "Welcome to Customer Management! This is where you can view all your customers, onboard new ones, and manage their accounts and portal access."
      },
      {
        element: ".flex.justify-between.items-center.mb-6 .flex.gap-3",
        intro: "Customer Onboarding - Quick Onboard for fast setup or Full Onboarding for detailed configuration.",
        position: "bottom",
        voice: "Use Quick Onboard for fast customer setup, or Full Onboarding for detailed configuration. This is how you grow your customer base and start generating revenue."
      },
      {
        element: ".grid.grid-cols-1.gap-4",
        intro: "Customer List - View all customers with pricing, status, and portal management options.",
        position: "top",
        voice: "Your complete customer directory shows pricing, order status, and portal management options. Click on any customer to view detailed information and manage their account settings."
      }
    ]
  }
};