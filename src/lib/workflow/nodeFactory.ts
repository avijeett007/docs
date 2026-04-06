import { WorkflowNode, NodeType, ConfigField } from '@/types/workflow';

// Base node class with common properties
export abstract class BaseNode {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract category: 'trigger' | 'action' | 'info' | 'integration';
  abstract icon: string;
  abstract color: string;

  // Common properties for all nodes
  tutorials: any[] = [];
  documentation: any[] = [];
  attachments: any[] = [];
  isPublic: boolean = false;
  logo?: string;

  abstract getConfigSchema(): ConfigField[];
  abstract getDefaultConfig(): Record<string, any>;
  abstract validate(config: Record<string, any>): { isValid: boolean; errors: string[] };
  abstract execute(config: Record<string, any>, input: any): Promise<any>;

  // Common methods
  createNode(position: { x: number; y: number }): WorkflowNode {
    return {
      id: `${this.id}-${Date.now()}`,
      type: this.id,
      position,
      data: {
        name: this.name,
        description: this.description,
        config: this.getDefaultConfig(),
        tutorials: this.tutorials,
        documentation: this.documentation,
        attachments: this.attachments,
        isPublic: this.isPublic,
        logo: this.logo
      }
    };
  }

  getNodeType(): NodeType {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      icon: this.icon,
      color: this.color,
      inputs: this.getInputPorts(),
      outputs: this.getOutputPorts(),
      configSchema: this.getConfigSchema()
    };
  }

  abstract getInputPorts(): any[];
  abstract getOutputPorts(): any[];
}

// Trigger Node Base Class
export abstract class TriggerNode extends BaseNode {
  category: 'trigger' = 'trigger';
  
  getInputPorts() {
    return []; // Trigger nodes typically don't have inputs
  }

  getOutputPorts() {
    return [
      { id: 'output', name: 'Trigger', type: 'trigger', required: false }
    ];
  }
}

// Action Node Base Class
export abstract class ActionNode extends BaseNode {
  category: 'action' = 'action';
  
  getInputPorts() {
    return [
      { id: 'input', name: 'Data', type: 'data', required: true }
    ];
  }

  getOutputPorts() {
    return [
      { id: 'output', name: 'Result', type: 'data', required: false }
    ];
  }
}

// Info Node Base Class
export abstract class InfoNode extends BaseNode {
  category: 'info' = 'info';
  
  getInputPorts() {
    return [
      { id: 'input', name: 'Data', type: 'data', required: false }
    ];
  }

  getOutputPorts() {
    return [
      { id: 'output', name: 'Data', type: 'data', required: false }
    ];
  }

  // Info nodes typically just pass data through
  async execute(config: Record<string, any>, input: any): Promise<any> {
    return input;
  }
}

// Integration Node Base Class
export abstract class IntegrationNode extends BaseNode {
  category: 'integration' = 'integration';
  
  getInputPorts() {
    return [
      { id: 'input', name: 'Data', type: 'data', required: true }
    ];
  }

  getOutputPorts() {
    return [
      { id: 'output', name: 'Result', type: 'data', required: false }
    ];
  }
}

// Webhook Trigger Node
export class WebhookTriggerNode extends TriggerNode {
  id = 'webhook-trigger';
  name = 'Webhook Trigger';
  description = 'Triggers workflow when webhook is called';
  icon = '🔗';
  color = 'bg-green-500';

  getConfigSchema(): ConfigField[] {
    return [
      {
        id: 'webhookUrl',
        name: 'webhookUrl',
        label: 'Webhook URL',
        type: 'text',
        required: false,
        defaultValue: ''
      },
      {
        id: 'method',
        name: 'method',
        label: 'HTTP Method',
        type: 'select',
        required: true,
        defaultValue: 'POST',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' }
        ]
      },
      {
        id: 'headers',
        name: 'headers',
        label: 'Headers',
        type: 'json',
        required: false,
        defaultValue: {}
      }
    ];
  }

  getDefaultConfig(): Record<string, any> {
    return {
      method: 'POST',
      headers: {},
      authentication: { type: 'none' }
    };
  }

  validate(config: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.method) {
      errors.push('HTTP method is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(config: Record<string, any>, input: any): Promise<any> {
    // Webhook trigger execution logic
    return {
      timestamp: new Date().toISOString(),
      method: config.method,
      data: input
    };
  }
}

// Facebook Integration Node
export class FacebookNode extends IntegrationNode {
  id = 'facebook';
  name = 'Facebook/Meta';
  description = 'Facebook Lead Generation and Ad Management';
  icon = '📱';
  color = 'bg-blue-500';

  getConfigSchema(): ConfigField[] {
    return [
      {
        id: 'appId',
        name: 'appId',
        label: 'App ID',
        type: 'text',
        required: true,
        defaultValue: ''
      },
      {
        id: 'pageId',
        name: 'pageId',
        label: 'Page ID',
        type: 'text',
        required: true,
        defaultValue: ''
      },
      {
        id: 'formId',
        name: 'formId',
        label: 'Form ID',
        type: 'text',
        required: false,
        defaultValue: ''
      },
      {
        id: 'leadFields',
        name: 'leadFields',
        label: 'Lead Fields',
        type: 'textarea',
        required: false,
        defaultValue: 'name\nemail\nphone'
      }
    ];
  }

  getDefaultConfig(): Record<string, any> {
    return {
      appId: '',
      pageId: '',
      formId: '',
      leadFields: ['name', 'email', 'phone'],
      webhookVerifyToken: ''
    };
  }

  validate(config: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.appId) {
      errors.push('Facebook App ID is required');
    }
    
    if (!config.pageId) {
      errors.push('Facebook Page ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(config: Record<string, any>, input: any): Promise<any> {
    // Facebook API integration logic
    return {
      leadId: `lead_${Date.now()}`,
      source: 'facebook',
      data: input,
      processedAt: new Date().toISOString()
    };
  }
}

// GHL Integration Node
export class GHLNode extends IntegrationNode {
  id = 'ghl';
  name = 'Go High Level';
  description = 'GHL CRM and Workflow Integration';
  icon = '🏢';
  color = 'bg-purple-500';

  getConfigSchema(): ConfigField[] {
    return [
      {
        id: 'apiKey',
        name: 'apiKey',
        label: 'API Key',
        type: 'text',
        required: true,
        defaultValue: ''
      },
      {
        id: 'locationId',
        name: 'locationId',
        label: 'Location ID',
        type: 'text',
        required: true,
        defaultValue: ''
      },
      {
        id: 'workflowId',
        name: 'workflowId',
        label: 'Workflow ID',
        type: 'text',
        required: false,
        defaultValue: ''
      }
    ];
  }

  getDefaultConfig(): Record<string, any> {
    return {
      apiKey: '',
      locationId: '',
      workflowId: '',
      contactFields: {},
      triggerActions: []
    };
  }

  validate(config: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.apiKey) {
      errors.push('GHL API Key is required');
    }
    
    if (!config.locationId) {
      errors.push('GHL Location ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(config: Record<string, any>, input: any): Promise<any> {
    // GHL API integration logic
    return {
      contactId: `contact_${Date.now()}`,
      workflowTriggered: !!config.workflowId,
      data: input,
      processedAt: new Date().toISOString()
    };
  }
}

// Knova Agent Action Node
export class KnovaAgentNode extends ActionNode {
  id = 'knova-agent';
  name = 'Knova AI Agent';
  description = 'AI Voice Agent for Customer Interactions';
  icon = '🤖';
  color = 'bg-indigo-500';

  getConfigSchema(): ConfigField[] {
    return [
      {
        id: 'customerId',
        name: 'customerId',
        label: 'Customer',
        type: 'select',
        required: true,
        defaultValue: '',
        options: [] // Will be populated dynamically
      },
      {
        id: 'agentName',
        name: 'agentName',
        label: 'Agent Name',
        type: 'text',
        required: true,
        defaultValue: ''
      },
      {
        id: 'voice',
        name: 'voice',
        label: 'Voice',
        type: 'select',
        required: true,
        defaultValue: 'alloy',
        options: [
          { label: 'Alloy', value: 'alloy' },
          { label: 'Echo', value: 'echo' },
          { label: 'Fable', value: 'fable' },
          { label: 'Onyx', value: 'onyx' },
          { label: 'Nova', value: 'nova' },
          { label: 'Shimmer', value: 'shimmer' }
        ]
      },
      {
        id: 'businessName',
        name: 'businessName',
        label: 'Business Name',
        type: 'text',
        required: true,
        defaultValue: ''
      },
      {
        id: 'phoneNumber',
        name: 'phoneNumber',
        label: 'Phone Number',
        type: 'select',
        required: true,
        defaultValue: '',
        options: [] // Will be populated dynamically
      },
      {
        id: 'instructions',
        name: 'instructions',
        label: 'Special Instructions',
        type: 'textarea',
        required: false,
        defaultValue: ''
      }
    ];
  }

  getDefaultConfig(): Record<string, any> {
    return {
      customerId: '',
      agentName: '',
      voice: 'alloy',
      businessInfo: {
        name: '',
        location: '',
        hours: '',
        services: [],
        specialOffers: []
      },
      phoneNumber: '',
      knowledgeBase: [],
      integrations: [],
      instructions: '',
      beforeInvoke: '',
      afterInvoke: ''
    };
  }

  validate(config: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.customerId) {
      errors.push('Customer selection is required');
    }

    if (!config.agentName) {
      errors.push('Agent name is required');
    }

    if (!config.voice) {
      errors.push('Voice selection is required');
    }

    if (!config.phoneNumber) {
      errors.push('Phone number is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(config: Record<string, any>, input: any): Promise<any> {
    // Knova Agent execution logic
    return {
      callId: `call_${Date.now()}`,
      agentId: config.agentName,
      phoneNumber: config.phoneNumber,
      status: 'initiated',
      data: input,
      processedAt: new Date().toISOString()
    };
  }
}

// N8N Integration Node
export class N8NNode extends IntegrationNode {
  id = 'n8n';
  name = 'N8N Integration';
  description = 'Connect to N8N workflows';
  icon = '⚡';
  color = 'bg-orange-500';

  getConfigSchema(): ConfigField[] {
    return [
      {
        id: 'workflowUrl',
        name: 'workflowUrl',
        label: 'Workflow URL',
        type: 'text',
        required: true,
        defaultValue: ''
      },
      {
        id: 'apiKey',
        name: 'apiKey',
        label: 'API Key',
        type: 'text',
        required: false,
        defaultValue: ''
      },
      {
        id: 'workflowId',
        name: 'workflowId',
        label: 'Workflow ID',
        type: 'text',
        required: false,
        defaultValue: ''
      },
      {
        id: 'inputData',
        name: 'inputData',
        label: 'Input Data Mapping',
        type: 'json',
        required: false,
        defaultValue: {}
      }
    ];
  }

  getDefaultConfig(): Record<string, any> {
    return {
      workflowUrl: '',
      apiKey: '',
      workflowId: '',
      inputData: {},
      outputMapping: {}
    };
  }

  validate(config: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.workflowUrl) {
      errors.push('N8N Workflow URL is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(config: Record<string, any>, input: any): Promise<any> {
    // N8N workflow execution logic
    return {
      executionId: `exec_${Date.now()}`,
      workflowUrl: config.workflowUrl,
      status: 'completed',
      data: input,
      processedAt: new Date().toISOString()
    };
  }
}

// Information Node
export class InformationNode extends InfoNode {
  id = 'info';
  name = 'Information Node';
  description = 'Documentation and tutorial node';
  icon = 'ℹ️';
  color = 'bg-gray-500';

  getConfigSchema(): ConfigField[] {
    return [
      {
        id: 'content',
        name: 'content',
        label: 'Content',
        type: 'textarea',
        required: true,
        defaultValue: ''
      },
      {
        id: 'contentType',
        name: 'contentType',
        label: 'Content Type',
        type: 'select',
        required: true,
        defaultValue: 'markdown',
        options: [
          { label: 'Markdown', value: 'markdown' },
          { label: 'HTML', value: 'html' }
        ]
      }
    ];
  }

  getDefaultConfig(): Record<string, any> {
    return {
      content: '',
      contentType: 'markdown',
      tutorials: [],
      documentation: [],
      attachments: [],
      isPublic: false
    };
  }

  validate(config: Record<string, any>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.content) {
      errors.push('Content is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Node Factory
export class NodeFactory {
  private static nodeTypes: Map<string, any> = new Map();

  static {
    this.nodeTypes.set('webhook-trigger', new WebhookTriggerNode());
    this.nodeTypes.set('facebook', new FacebookNode());
    this.nodeTypes.set('ghl', new GHLNode());
    this.nodeTypes.set('knova-agent', new KnovaAgentNode());
    this.nodeTypes.set('n8n', new N8NNode());
    this.nodeTypes.set('info', new InformationNode());
  }

  static registerNode(nodeType: BaseNode): void {
    this.nodeTypes.set(nodeType.id, nodeType);
  }

  static getNode(nodeId: string): BaseNode | undefined {
    return this.nodeTypes.get(nodeId);
  }

  static getAllNodeTypes(): NodeType[] {
    return Array.from(this.nodeTypes.values()).map(node => node.getNodeType());
  }

  static createNode(nodeId: string, position: { x: number; y: number }): WorkflowNode | null {
    const nodeType = this.getNode(nodeId);
    if (!nodeType) return null;
    
    return nodeType.createNode(position);
  }

  static validateNodeConfig(nodeId: string, config: Record<string, any>): { isValid: boolean; errors: string[] } {
    const nodeType = this.getNode(nodeId);
    if (!nodeType) {
      return { isValid: false, errors: ['Unknown node type'] };
    }
    
    return nodeType.validate(config);
  }

  static async executeNode(nodeId: string, config: Record<string, any>, input: any): Promise<any> {
    const nodeType = this.getNode(nodeId);
    if (!nodeType) {
      throw new Error(`Unknown node type: ${nodeId}`);
    }
    
    return nodeType.execute(config, input);
  }
}
