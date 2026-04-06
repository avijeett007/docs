import { WorkflowTemplate, WorkflowNode, WorkflowConnection } from '@/types/workflow';

export class WorkflowTemplateManager {
  private static templates: Map<string, WorkflowTemplate> = new Map();

  static {
    // Initialize with built-in templates
    this.initializeBuiltInTemplates();
  }

  private static initializeBuiltInTemplates() {
    // Facebook Lead Generation Template with GHL
    const facebookLeadGenTemplate: WorkflowTemplate = {
      id: 'facebook-leadgen-ghl',
      name: 'Facebook Lead Generation with GHL',
      description: 'Automated lead generation workflow with Facebook ads, GHL integration, and AI voice follow-up calls',
      category: 'Lead Generation',
      thumbnail: '/templates/facebook-leadgen.png',
      isPublic: true,
      createdBy: 'Knotie AI',
      tags: ['facebook', 'lead-generation', 'voice-ai', 'ghl', 'automation'],
      nodes: [
        {
          id: 'webhook-trigger-1',
          type: 'webhook-trigger',
          position: { x: 100, y: 200 },
          data: {
            name: 'Facebook Form Webhook',
            description: 'Receives lead data when someone fills out your Facebook lead form',
            config: {
              method: 'POST',
              headers: {},
              authentication: { type: 'none' }
            },
            tutorials: [
              {
                id: 'tut-1',
                title: 'Setting up Facebook Lead Ads',
                description: 'Learn how to create Facebook lead ads and connect them to this workflow',
                type: 'video',
                url: 'https://example.com/facebook-leadads-tutorial',
                duration: 15
              }
            ],
            documentation: [
              {
                id: 'doc-1',
                title: 'Facebook Webhook Integration Guide',
                content: '# Facebook Webhook Setup\n\nThis guide will help you set up Facebook lead ads to trigger this workflow...',
                type: 'markdown'
              }
            ],
            isPublic: true
          }
        },
        {
          id: 'facebook-info-1',
          type: 'info',
          position: { x: 450, y: 200 },
          data: {
            name: 'Facebook Marketing/Ad Campaign',
            description: 'Information and setup guide for Facebook marketing campaigns and lead ads',
            config: {
              content: '# Facebook Marketing Campaign Setup\n\nThis node contains information about setting up Facebook lead generation campaigns...',
              contentType: 'markdown'
            },
            tutorials: [
              {
                id: 'tut-2',
                title: 'Facebook App Configuration',
                description: 'How to set up your Facebook app and get the required credentials',
                type: 'video',
                url: 'https://example.com/facebook-app-setup',
                duration: 10
              }
            ],
            documentation: [
              {
                id: 'doc-2',
                title: 'Facebook API Configuration',
                content: '# Facebook API Setup\n\nTo use this node, you need to configure your Facebook app...',
                type: 'markdown'
              }
            ],
            isPublic: true
          }
        },
        {
          id: 'ghl-info-1',
          type: 'info',
          position: { x: 800, y: 200 },
          data: {
            name: 'GHL Workflow',
            description: 'Information about Go High Level workflow integration and setup',
            config: {
              content: '# GHL Workflow Integration\n\nThis node contains information about integrating with Go High Level workflows...',
              contentType: 'markdown'
            },
            tutorials: [
              {
                id: 'tut-3',
                title: 'GHL Integration Setup',
                description: 'Connect your Go High Level account and set up contact workflows',
                type: 'video',
                url: 'https://example.com/ghl-integration',
                duration: 12
              }
            ],
            documentation: [
              {
                id: 'doc-3',
                title: 'Go High Level API Guide',
                content: '# GHL API Integration\n\nThis guide covers how to integrate with Go High Level...',
                type: 'markdown'
              }
            ],
            attachments: [
              {
                id: 'att-1',
                name: 'GHL Workflow Template.json',
                type: 'json',
                size: 2048,
                url: 'https://example.com/ghl-template.json',
                description: 'Pre-built GHL workflow template for lead follow-up'
              }
            ],
            isPublic: true
          }
        },
        {
          id: 'knova-agent-1',
          type: 'knova-agent',
          position: { x: 1150, y: 200 },
          data: {
            name: 'Lead Follow-up Agent',
            description: 'AI voice agent that calls leads to qualify and schedule appointments',
            config: {
              customerId: '',
              agentName: 'Lead Qualifier',
              voice: 'alloy',
              businessInfo: {
                name: '',
                location: '',
                hours: 'Mon-Fri 9AM-5PM',
                services: [],
                specialOffers: []
              },
              phoneNumber: '',
              knowledgeBase: [],
              integrations: ['CRM', 'Calendar'],
              instructions: 'You are a friendly lead qualification agent. Your goal is to qualify the lead and schedule a consultation call.',
              beforeInvoke: 'Let me check our calendar for available times...',
              afterInvoke: 'Perfect! I\'ve scheduled your appointment and you\'ll receive a confirmation email shortly.'
            },
            tutorials: [
              {
                id: 'tut-4',
                title: 'AI Agent Configuration',
                description: 'Learn how to configure your AI agent for lead qualification calls',
                type: 'video',
                url: 'https://example.com/ai-agent-config',
                duration: 20
              },
              {
                id: 'tut-5',
                title: 'Lead Qualification Best Practices',
                description: 'Best practices for qualifying leads with AI voice agents',
                type: 'text',
                content: 'Here are the key strategies for effective lead qualification...'
              }
            ],
            documentation: [
              {
                id: 'doc-4',
                title: 'Knova Agent Setup Guide',
                content: '# Knova AI Agent Configuration\n\nThis comprehensive guide covers...',
                type: 'markdown'
              }
            ],
            attachments: [
              {
                id: 'att-2',
                name: 'Lead Qualification Script.pdf',
                type: 'pdf',
                size: 1024,
                url: 'https://example.com/qualification-script.pdf',
                description: 'Sample script for lead qualification calls'
              }
            ],
            isPublic: true
          }
        },
        {
          id: 'ghl-info-2',
          type: 'info',
          position: { x: 1500, y: 200 },
          data: {
            name: 'GHL Workflow',
            description: 'Final GHL workflow processing and completion steps',
            config: {
              content: '# GHL Workflow Completion\n\nThis node contains information about final GHL workflow steps...',
              contentType: 'markdown'
            },
            isPublic: true
          }
        }
      ],
      connections: [
        {
          id: 'conn-1',
          source: 'webhook-trigger-1',
          target: 'facebook-info-1',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-2',
          source: 'facebook-info-1',
          target: 'ghl-info-1',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-3',
          source: 'ghl-info-1',
          target: 'knova-agent-1',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-4',
          source: 'knova-agent-1',
          target: 'ghl-info-2',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ]
    };

    // Facebook Lead Generation Template with N8N
    const facebookLeadGenN8NTemplate: WorkflowTemplate = {
      id: 'facebook-leadgen-n8n',
      name: 'Facebook Lead Generation with N8N',
      description: 'Automated lead generation workflow with Facebook ads, N8N integration, and AI voice follow-up calls',
      category: 'Lead Generation',
      thumbnail: '/templates/facebook-leadgen-n8n.png',
      isPublic: true,
      createdBy: 'Knotie AI',
      tags: ['facebook', 'lead-generation', 'voice-ai', 'n8n', 'automation'],
      nodes: [
        {
          id: 'webhook-trigger-2',
          type: 'webhook-trigger',
          position: { x: 100, y: 200 },
          data: {
            name: 'Facebook Form Webhook',
            description: 'Receives lead data when someone fills out your Facebook lead form',
            config: {
              method: 'POST',
              headers: {},
              authentication: { type: 'none' }
            },
            isPublic: true
          }
        },
        {
          id: 'facebook-info-2',
          type: 'info',
          position: { x: 450, y: 200 },
          data: {
            name: 'Facebook Marketing/Ad Campaign',
            description: 'Information and setup guide for Facebook marketing campaigns and lead ads',
            config: {
              content: '# Facebook Marketing Campaign Setup\n\nThis node contains information about setting up Facebook lead generation campaigns...',
              contentType: 'markdown'
            },
            isPublic: true
          }
        },
        {
          id: 'n8n-info-1',
          type: 'info',
          position: { x: 800, y: 200 },
          data: {
            name: 'N8N Workflow',
            description: 'Information about N8N workflow integration and automation setup',
            config: {
              content: '# N8N Workflow Integration\n\nThis node contains information about integrating with N8N workflows...',
              contentType: 'markdown'
            },
            isPublic: true
          }
        },
        {
          id: 'knova-agent-2',
          type: 'knova-agent',
          position: { x: 1150, y: 200 },
          data: {
            name: 'Lead Follow-up Agent',
            description: 'AI voice agent that calls leads to qualify and schedule appointments',
            config: {
              customerId: '',
              agentName: 'Lead Qualifier',
              voice: 'alloy',
              businessInfo: {
                name: '',
                location: '',
                hours: 'Mon-Fri 9AM-5PM',
                services: [],
                specialOffers: []
              },
              phoneNumber: '',
              knowledgeBase: [],
              integrations: ['N8N', 'Calendar'],
              instructions: 'You are a friendly lead qualification agent. Your goal is to qualify the lead and schedule a consultation call.',
              beforeInvoke: 'Let me check our calendar for available times...',
              afterInvoke: 'Perfect! I\'ve scheduled your appointment and you\'ll receive a confirmation email shortly.'
            },
            isPublic: true
          }
        },
        {
          id: 'n8n-info-2',
          type: 'info',
          position: { x: 1500, y: 200 },
          data: {
            name: 'N8N Workflow',
            description: 'Final N8N workflow processing and completion steps',
            config: {
              content: '# N8N Workflow Completion\n\nThis node contains information about final N8N workflow steps...',
              contentType: 'markdown'
            },
            isPublic: true
          }
        }
      ],
      connections: [
        {
          id: 'conn-5',
          source: 'webhook-trigger-2',
          target: 'facebook-info-2',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-6',
          source: 'facebook-info-2',
          target: 'n8n-info-1',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-7',
          source: 'n8n-info-1',
          target: 'knova-agent-2',
          sourceHandle: 'output',
          targetHandle: 'input'
        },
        {
          id: 'conn-8',
          source: 'knova-agent-2',
          target: 'n8n-info-2',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ]
    };

    // E-commerce Customer Support Template
    const ecommerceSupport: WorkflowTemplate = {
      id: 'ecommerce-support-v1',
      name: 'E-commerce Customer Support',
      description: 'Automated customer support workflow for e-commerce businesses',
      category: 'Customer Support',
      thumbnail: '/templates/ecommerce-support.png',
      isPublic: true,
      createdBy: 'Knotie AI',
      tags: ['ecommerce', 'customer-support', 'automation'],
      nodes: [
        {
          id: 'webhook-trigger-2',
          type: 'webhook-trigger',
          position: { x: 100, y: 200 },
          data: {
            name: 'Support Request Webhook',
            description: 'Receives customer support requests from various channels',
            config: {
              method: 'POST',
              headers: {},
              authentication: { type: 'none' }
            },
            isPublic: true
          }
        },
        {
          id: 'knova-agent-2',
          type: 'knova-agent',
          position: { x: 450, y: 200 },
          data: {
            name: 'Customer Support Agent',
            description: 'AI agent that handles customer inquiries and support requests',
            config: {
              customerId: '',
              agentName: 'Support Assistant',
              voice: 'nova',
              businessInfo: {
                name: '',
                location: '',
                hours: '24/7',
                services: ['Order Support', 'Returns', 'Product Information'],
                specialOffers: []
              },
              phoneNumber: '',
              knowledgeBase: ['Product Catalog', 'FAQ', 'Return Policy'],
              integrations: ['CRM', 'Order Management'],
              instructions: 'You are a helpful customer support agent. Assist customers with their orders, returns, and product questions.',
              beforeInvoke: 'Let me look up your order information...',
              afterInvoke: 'I\'ve updated your order status. Is there anything else I can help you with?'
            },
            isPublic: true
          }
        }
      ],
      connections: [
        {
          id: 'conn-4',
          source: 'webhook-trigger-2',
          target: 'knova-agent-2',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ]
    };

    // Register templates
    this.templates.set(facebookLeadGenTemplate.id, facebookLeadGenTemplate);
    this.templates.set(facebookLeadGenN8NTemplate.id, facebookLeadGenN8NTemplate);
    this.templates.set(ecommerceSupport.id, ecommerceSupport);
  }

  static getAllTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  static getPublicTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.isPublic);
  }

  static getTemplatesByCategory(category: string): WorkflowTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.category === category);
  }

  static getTemplateById(id: string): WorkflowTemplate | undefined {
    return this.templates.get(id);
  }

  static searchTemplates(query: string): WorkflowTemplate[] {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(template =>
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  static getCategories(): string[] {
    const categories = new Set<string>();
    this.templates.forEach(template => categories.add(template.category));
    return Array.from(categories).sort();
  }

  static addTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  static removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  static createWorkflowFromTemplate(templateId: string): {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  } | null {
    const template = this.getTemplateById(templateId);
    if (!template) return null;

    // Create new IDs for nodes and connections to avoid conflicts
    const nodeIdMap = new Map<string, string>();
    
    const newNodes = template.nodes.map(node => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      nodeIdMap.set(node.id, newId);
      
      return {
        ...node,
        id: newId
      };
    });

    const newConnections = template.connections.map(connection => ({
      ...connection,
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: nodeIdMap.get(connection.source) || connection.source,
      target: nodeIdMap.get(connection.target) || connection.target
    }));

    return {
      nodes: newNodes,
      connections: newConnections
    };
  }

  static exportTemplate(templateId: string): string | null {
    const template = this.getTemplateById(templateId);
    if (!template) return null;
    
    return JSON.stringify(template, null, 2);
  }

  static importTemplate(templateJson: string): { success: boolean; error?: string; templateId?: string } {
    try {
      const template: WorkflowTemplate = JSON.parse(templateJson);
      
      // Validate template structure
      if (!template.id || !template.name || !template.nodes || !template.connections) {
        return { success: false, error: 'Invalid template structure' };
      }

      // Generate new ID if template already exists
      let finalId = template.id;
      let counter = 1;
      while (this.templates.has(finalId)) {
        finalId = `${template.id}_${counter}`;
        counter++;
      }

      const finalTemplate = { ...template, id: finalId };
      this.addTemplate(finalTemplate);

      return { success: true, templateId: finalId };
    } catch (error) {
      return { success: false, error: 'Invalid JSON format' };
    }
  }
}
