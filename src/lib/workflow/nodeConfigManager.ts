export interface NodeConfig {
  [key: string]: any;
}

export interface WorkflowNodeData {
  name: string;
  description: string;
  config: NodeConfig;
  isPublic?: boolean;
}

export interface WorkflowJSON {
  id: string;
  name: string;
  description: string;
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: WorkflowNodeData;
  }[];
  connections: {
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }[];
  settings: {
    autoSave: boolean;
    gridSnap: boolean;
    showGrid: boolean;
  };
  metadata: {
    version: string;
    createdAt: string;
    updatedAt: string;
    customerId?: string;
    partnerId?: string;
  };
}

export class NodeConfigManager {
  static generateNodeConfig(nodeType: string, customConfig: NodeConfig = {}): NodeConfig {
    const defaultConfigs: Record<string, NodeConfig> = {
      'knova-agent': {
        agentType: 'voice',
        channel: 'phone',
        voice: 'default',
        language: 'en-US',
        model: 'gpt-4',
        systemPrompt: '',
        tools: [],
        knowledgebase: null,
        maxDuration: 300,
        endpointUrl: '',
        authToken: ''
      },
      'vapi-agent': {
        apiKey: '',
        assistantId: '',
        phoneNumber: '',
        voiceId: 'jennifer',
        model: 'gpt-3.5-turbo',
        systemMessage: '',
        firstMessage: '',
        endCallMessage: ''
      },
      'retell-agent': {
        apiKey: '',
        agentId: '',
        phoneNumber: '',
        voice: 'Liam',
        language: 'en-US',
        responseFormat: 'text',
        interruption: true
      },
      'ultravox-agent': {
        apiKey: '',
        modelId: '',
        voice: 'default',
        language: 'en',
        temperature: 0.7,
        maxTokens: 1000
      },
      'note': {
        content: 'Double-click to edit this note...',
        backgroundColor: '#fbbf24',
        textColor: '#000000',
        fontSize: 'medium',
        width: 280,
        height: 160
      },
      'webhook-trigger': {
        url: '',
        method: 'POST',
        headers: {},
        authentication: 'none',
        timeout: 30000
      },
      'facebook': {
        appId: '',
        appSecret: '',
        pageId: '',
        accessToken: '',
        webhookUrl: '',
        verifyToken: ''
      },
      'ghl': {
        apiKey: '',
        locationId: '',
        pipelineId: '',
        stageId: '',
        webhookUrl: ''
      },
      'n8n': {
        webhookUrl: '',
        authentication: 'none',
        headers: {},
        method: 'POST'
      }
    };

    const defaultConfig = defaultConfigs[nodeType] || {};
    return { ...defaultConfig, ...customConfig };
  }

  static validateNodeConfig(nodeType: string, config: NodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (nodeType) {
      case 'knova-agent':
        if (!config.agentType) errors.push('Agent type is required');
        if (!config.channel) errors.push('Channel is required');
        if (!config.voice) errors.push('Voice is required');
        break;
      case 'vapi-agent':
        if (!config.apiKey) errors.push('API key is required');
        if (!config.assistantId) errors.push('Assistant ID is required');
        break;
      case 'retell-agent':
        if (!config.apiKey) errors.push('API key is required');
        if (!config.agentId) errors.push('Agent ID is required');
        break;
      case 'ultravox-agent':
        if (!config.apiKey) errors.push('API key is required');
        if (!config.modelId) errors.push('Model ID is required');
        break;
      case 'webhook-trigger':
        if (!config.url) errors.push('Webhook URL is required');
        break;
      case 'facebook':
        if (!config.appId) errors.push('App ID is required');
        if (!config.appSecret) errors.push('App Secret is required');
        break;
      case 'ghl':
        if (!config.apiKey) errors.push('API key is required');
        if (!config.locationId) errors.push('Location ID is required');
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static exportWorkflowToJSON(workflowData: any): WorkflowJSON {
    return {
      id: workflowData.id,
      name: workflowData.name,
      description: workflowData.description,
      nodes: workflowData.nodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          name: node.data.name,
          description: node.data.description,
          config: node.data.config || {},
          isPublic: node.data.isPublic || false
        }
      })),
      connections: workflowData.connections.map((conn: any) => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle
      })),
      settings: workflowData.settings,
      metadata: {
        version: '1.0.0',
        createdAt: workflowData.createdAt || new Date().toISOString(),
        updatedAt: workflowData.updatedAt || new Date().toISOString(),
        customerId: workflowData.customerId,
        partnerId: workflowData.partnerId
      }
    };
  }

  static importWorkflowFromJSON(json: WorkflowJSON): any {
    return {
      id: json.id,
      name: json.name,
      description: json.description,
      nodes: json.nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          name: node.data.name,
          description: node.data.description,
          config: node.data.config,
          isPublic: node.data.isPublic
        }
      })),
      connections: json.connections.map(conn => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle
      })),
      settings: json.settings,
      createdAt: json.metadata.createdAt,
      updatedAt: json.metadata.updatedAt,
      customerId: json.metadata.customerId,
      partnerId: json.metadata.partnerId
    };
  }

  static generateKnovaAgentJSON(config: NodeConfig): any {
    return {
      type: 'knova-agent',
      version: '1.0.0',
      config: {
        agent: {
          type: config.agentType || 'voice',
          name: config.name || 'Knova Assistant',
          description: config.description || 'AI Voice Assistant'
        },
        voice: {
          provider: 'elevenlabs',
          voiceId: config.voice || 'default',
          language: config.language || 'en-US',
          speed: config.voiceSpeed || 1.0,
          pitch: config.voicePitch || 1.0
        },
        model: {
          provider: 'openai',
          model: config.model || 'gpt-4',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 1000
        },
        system: {
          prompt: config.systemPrompt || '',
          instructions: config.instructions || '',
          personality: config.personality || 'helpful'
        },
        features: {
          tools: config.tools || [],
          knowledgebase: config.knowledgebase || null,
          interruption: config.interruption !== false,
          sentiment: config.sentiment !== false
        },
        channels: {
          phone: {
            enabled: config.channel === 'phone',
            number: config.phoneNumber || ''
          },
          web: {
            enabled: config.channel === 'web',
            widget: config.widget || {}
          },
          api: {
            enabled: config.channel === 'api',
            endpoint: config.endpointUrl || '',
            authToken: config.authToken || ''
          }
        },
        limits: {
          maxDuration: config.maxDuration || 300,
          maxConcurrent: config.maxConcurrent || 10,
          rateLimiting: config.rateLimiting || {}
        }
      }
    };
  }
}