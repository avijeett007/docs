export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    name: string;
    description: string;
    config: Record<string, any>;
    agentId?: string; // For agent nodes
    agentData?: any; // Cached agent data
    tutorials?: Tutorial[];
    documentation?: Documentation[];
    attachments?: Attachment[];
    isPublic?: boolean;
    logo?: string;
  };
  selected?: boolean;
  dragging?: boolean;
}

export interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: 'default' | 'smoothstep' | 'straight';
  animated?: boolean;
  style?: React.CSSProperties;
}

export interface WorkflowData {
  id: string;
  name: string;
  description: string;
  status?: 'active' | 'inactive' | 'draft';
  customerId?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  settings: WorkflowSettings;
  webhookUrls?: {
    test: string;
    production: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowSettings {
  autoSave: boolean;
  gridSnap: boolean;
  showGrid: boolean;
  gridSize?: number;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'text' | 'interactive';
  url?: string;
  content?: string;
  duration?: number;
}

export interface Documentation {
  id: string;
  title: string;
  content: string;
  type: 'markdown' | 'html' | 'pdf';
  url?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  description?: string;
}

export interface NodeType {
  id: string;
  name: string;
  description: string;
  category: 'trigger' | 'action' | 'info' | 'integration' | 'agent';
  icon: string;
  color: string;
  inputs: NodePort[];
  outputs: NodePort[];
  configSchema: ConfigField[];
  isAgentNode?: boolean;
  agentProvider?: 'vapi' | 'retell' | 'ultravox' | 'knova' | 'ghl';
}

export interface NodePort {
  id: string;
  name: string;
  type: 'data' | 'trigger' | 'webhook';
  required: boolean;
}

export interface ConfigField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'file' | 'json';
  required: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  isPublic: boolean;
  createdBy: string;
  tags: string[];
}

// Node-specific data interfaces
export interface FacebookNodeData {
  apiKey?: string;
  appId?: string;
  pageId?: string;
  formId?: string;
  leadFields: string[];
  webhookVerifyToken?: string;
}

export interface GHLNodeData {
  apiKey?: string;
  locationId?: string;
  workflowId?: string;
  contactFields: Record<string, string>;
  triggerActions: string[];
}

export interface KnovaAgentNodeData {
  customerId?: string;
  agentName?: string;
  agentType?: 'inbound' | 'outbound';
  communicationChannel?: 'web' | 'telephony';
  voice?: string;
  businessInfo?: {
    name: string;
    location: string;
    hours: string;
    services: string[];
    specialOffers: string[];
  };
  phoneNumber?: string;
  knowledgeBase: string[];
  integrations: string[];
  instructions?: string;
  customGreeting?: string;
  beforeInvoke?: string;
  afterInvoke?: string;
  sellsProducts?: boolean;
  products?: Array<{
    id: string;
    name: string;
    description: string;
    price?: string;
    features: string[];
  }>;
  services?: Array<{
    id: string;
    name: string;
    description: string;
    duration?: string;
    price?: string;
  }>;
  useKnowledgeBaseForProducts?: boolean;
  productKnowledgeBase?: string[];
  // Business hours and operational settings
  agentOperationalHours?: 'business' | '24/7' | 'custom';
  customOperationalHours?: {
    from: string;
    to: string;
  };
  // Voice and speech settings
  language?: string;
  enableBackchannel?: boolean;
  backchannelWords?: string[];
  enableSpeechNormalization?: boolean;
  // Voicemail settings (telephony only)
  voicemailDetection?: 'hangup' | 'leave_message';
  voicemailMessage?: string;
  // Custom word learning
  enableCustomWords?: boolean;
  customWords?: Record<string, string>;
  // Background audio
  enableBackgroundAudio?: boolean;
  backgroundAudioType?: 'ambient' | 'thinking';
  backgroundAudioFile?: string;
  selectedBackgroundAudio?: string;
  // Advanced Voice AI settings
  advancedSettings?: {
    customSystemPrompt?: string;
    voiceAIConfig?: {
      room_name?: string;
      participant_name?: string;
      api_key?: string;
      api_secret?: string;
      ws_url?: string;
      turn_servers?: Array<{
        urls: string[];
        username?: string;
        credential?: string;
      }>;
      audio_config?: {
        sample_rate?: number;
        channels?: number;
        bitrate?: number;
      };
      voice_activity_detection?: {
        enabled?: boolean;
        threshold?: number;
      };
      interruption_handling?: {
        enabled?: boolean;
        threshold?: number;
      };
    };
  };
}

export interface N8NNodeData {
  workflowUrl?: string;
  apiKey?: string;
  workflowId?: string;
  inputData: Record<string, any>;
  outputMapping: Record<string, string>;
}

export interface WebhookTriggerNodeData {
  webhookUrl?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'api-key';
    credentials?: Record<string, string>;
  };
}

export interface InfoNodeData {
  content: string;
  contentType: 'markdown' | 'html';
  tutorials: Tutorial[];
  documentation: Documentation[];
  attachments: Attachment[];
  isPublic: boolean;
}

// Canvas interaction types
export interface CanvasPosition {
  x: number;
  y: number;
}

export interface DragState {
  isDragging: boolean;
  dragType: 'node' | 'canvas' | 'connection';
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

export interface SelectionState {
  selectedNodes: string[];
  selectedConnections: string[];
}

// Workflow execution types
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  logs: ExecutionLog[];
}

export interface ExecutionLog {
  id: string;
  nodeId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, any>;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  nodeId?: string;
  connectionId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  nodeId?: string;
  connectionId?: string;
  message: string;
}

// Workflow versioning and backup types
export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  data: WorkflowData;
  createdAt: Date;
  changelog?: string;
}

export interface WorkflowBackup {
  id: string;
  workflowId: string;
  data: WorkflowData;
  createdAt: Date;
  type: 'manual' | 'auto';
  description?: string;
}

// Agent-specific data interfaces for workflow nodes
export interface VAPIAgentData {
  id: string;
  name: string;
  voice: any;
  model: any;
  firstMessage: string;
  voicemailMessage: string;
  endCallMessage: string;
  recordingEnabled: boolean;
  clientMessages: string[];
  serverMessages: string[];
  endCallPhrases: string[];
  customerId: string;
  isActive: boolean;
}

export interface RetellAgentData {
  id: string;
  name: string;
  voiceId: string;
  voiceModel?: string;
  responseEngine: any;
  voiceConfig: any;
  callConfig: any;
  language: string;
  recordingEnabled: boolean;
  customerId: string | null;
  isActive: boolean;
}

export interface UltravoxAgentData {
  id: string;
  name: string;
  systemPrompt?: string;
  temperature: number;
  model: string;
  voice?: string;
  externalVoice?: any;
  languageHint?: string;
  recordingEnabled: boolean;
  maxDuration?: string;
  timeExceededMessage?: string;
  selectedTools?: any[];
  callTemplate?: any;
  customerId?: string;
  isActive: boolean;
}

// Note node specific interface
export interface NoteNodeData {
  content: string;
  backgroundColor: string;
  textColor: string;
  fontSize: 'small' | 'medium' | 'large';
  width: number;
  height: number;
}
