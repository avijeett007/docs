export const AGENT_STEPS = [
  {
    title: 'Agent Info',
    description: 'Basic details',
    fields: {
      name: {
        label: 'Agent Name',
        required: true,
        tooltip: 'A unique name to identify your agent'
      },
      type: {
        label: 'Agent Type',
        required: true,
        tooltip: 'The primary function of your agent',
        type: 'tile-selector',
        options: [
          { 
            value: 'inbound_phone', 
            label: 'Inbound Phone',
            description: 'Handle incoming customer calls with AI-powered responses',
            icon: 'phone-incoming'
          },
          { 
            value: 'outbound_phone', 
            label: 'Outbound Phone',
            description: 'Proactively reach out to customers for sales or support',
            icon: 'phone-outgoing'
          },
          { 
            value: 'website', 
            label: 'Website Voice Chat',
            description: 'Interactive voice and chat agent for website visitors',
            icon: 'message-mic'
          },
          { 
            value: 'mobile_app', 
            label: 'Mobile App',
            description: 'Provide in-app assistance and support for mobile users',
            icon: 'smartphone'
          }
        ]
      },
      voice: {
        label: 'Agent Voice',
        required: true,
        tooltip: 'The voice your agent will use',
        type: 'voice-selector'
      },
      warmupMessage: {
        label: 'Warmup Message',
        tooltip: 'Initial message the agent will use to start conversations'
      },
      aiToSpeakFirst: {
        label: 'AI to Speak First',
        tooltip: 'Enable if you want the AI to initiate conversations'
      },
      enableBackchanneling: {
        label: 'Enable Backchanneling',
        tooltip: 'Allow agent to provide verbal feedback during conversations'
      },
      speechNormalization: {
        label: 'Speech Normalization',
        tooltip: 'Normalize speech patterns for more natural conversations'
      }
    }
  },
  {
    title: 'Set Goals',
    description: 'Purpose & scope',
    fields: {
      knowledgebase: {
        label: 'Select Knowledgebase',
        type: 'knowledgebase-selector',
        tooltip: 'Choose a knowledgebase to give your agent access to specific information'
      },
      businessName: {
        label: 'Business Name',
        required: true,
        tooltip: 'Your company or organization name'
      },
      customerAttributes: {
        label: 'Customer Information to Collect',
        type: 'attribute-selector',
        tooltip: 'Select which customer information the AI agent should collect during conversations',
        options: [
          { 
            value: 'email', 
            label: 'Email Address',
            icon: 'mail'
          },
          { 
            value: 'phone', 
            label: 'Phone Number',
            icon: 'phone'
          },
          { 
            value: 'name', 
            label: 'Full Name',
            icon: 'user'
          },
          { 
            value: 'others', 
            label: 'Other Attributes',
            icon: 'plus-circle'
          }
        ]
      },
      customAttributes: {
        label: 'Custom Attributes',
        type: 'textarea',
        tooltip: 'Enter additional attributes to collect (comma separated)',
        dependsOn: {
          field: 'customerAttributes',
          value: 'others'
        }
      },
      purpose: {
        label: 'Agent Purpose',
        required: true,
        tooltip: 'The main objective of your agent',
        options: [
          { 
            value: 'inbound_phone', 
            label: 'Inbound Phone Support',
            description: 'Handle incoming customer service calls'
          },
          { 
            value: 'outbound_phone', 
            label: 'Outbound Sales',
            description: 'Make outbound sales and lead generation calls'
          },
          { 
            value: 'website', 
            label: 'Website Assistant',
            description: 'Provide real-time voice and chat support on your website'
          },
          { 
            value: 'mobile_app', 
            label: 'Mobile App Support',
            description: 'In-app voice support for mobile users'
          }
        ]
      },
      systemPrompt: {
        label: 'System Prompt',
        required: true,
        tooltip: 'Core instructions for your agent\'s behavior'
      },
      sendEmailsToUsers: {
        label: 'Send Emails to Users',
        tooltip: 'Send conversation summaries to users via email'
      }
    }
  },
  {
    title: 'Agent Actions',
    description: 'Configure Actions',
    fields: {
      agentActions: {
        label: 'Available Actions',
        type: 'action-selector',
        tooltip: 'Select actions your agent can perform',
        options: [
          {
            value: 'transfer',
            label: 'Call Transfer',
            icon: 'phone',
            description: 'Transfer calls to a specified phone number'
          },
          {
            value: 'function',
            label: 'Setup Function Calling',
            icon: 'code',
            description: 'Trigger workflows based on conversation context'
          }
        ]
      },
      savedActions: {
        label: 'Configured Actions',
        type: 'action-tiles',
        tooltip: 'Your saved agent actions'
      }
    }
  },
  {
    title: 'Go Live',
    description: 'Launch settings',
    fields: {
      channels: {
        label: 'Live Channels',
        tooltip: 'Platforms where your agent will be active',
        website: {
          label: 'Website',
          tooltip: 'Embed on your website'
        },
        phone: {
          label: 'Phone',
          tooltip: 'Enable phone conversations'
        }
      },
      webhookUrl: {
        label: 'Webhook URL',
        tooltip: 'Endpoint to receive agent events'
      },
      settings: {
        workingHours: {
          label: 'Set Working Hours',
          tooltip: 'Define when your agent is available'
        },
        maskPII: {
          label: 'Mask PII',
          tooltip: 'Automatically detect and mask sensitive information'
        },
        saveTranscripts: {
          label: 'Save Transcripts',
          tooltip: 'Store conversation transcripts'
        },
        callAnalysis: {
          label: 'Call Analysis',
          tooltip: 'Enable advanced conversation analytics'
        }
      }
    }
  }
];
