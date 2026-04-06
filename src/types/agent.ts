export interface AgentField {
  label: string;
  required?: boolean;
  tooltip?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
}

export interface AgentStep {
  title: string;
  description: string;
  fields: Record<string, AgentField>;
}

export interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface WeeklyWorkingHours {
  monday: WorkingHours;
  tuesday: WorkingHours;
  wednesday: WorkingHours;
  thursday: WorkingHours;
  friday: WorkingHours;
  saturday: WorkingHours;
  sunday: WorkingHours;
}

export interface WidgetConfig {
  id: string;
  agentId: string;
  userId: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  connectingColor: string;
  activeColor: string;
  endedColor: string;
  showBranding: boolean;
  showTranscript: boolean;
  showAvatar: boolean;
  showName: boolean;
  embedCode?: string;
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  apiKey?: string;
  config: Record<string, any>;
}

export interface AgentSettings {
  workingHours: boolean;
  weeklyWorkingHours?: WeeklyWorkingHours;
  maskPII: boolean;
  saveTranscripts: boolean;
  callAnalysis: boolean;
  designWidget?: boolean;
  selectedPhone?: string;
  widgetConfig?: WidgetConfig;
  tools?: ToolConfig[];
}

export interface AgentChannels {
  website: boolean;
  phone: boolean;
  mobile: boolean;
}

export interface AgentData {
  id: string;
  name: string;
  type: 'inbound_phone' | 'outbound_phone' | 'website' | 'mobile_app';
  voice: string;
  warmupMessage?: string;
  status: 'draft' | 'active' | 'inactive' | 'testing';
  businessName: string;
  purpose: string;
  knowledgeBase: string;
  knowledgeBaseId?: string;
  systemPrompt: string;
  aiToSpeakFirst: boolean;
  enableBackchanneling: boolean;
  speechNormalization: boolean;
  sendEmailsToUsers: boolean;
  channels: AgentChannels;
  webhookUrl: string;
  settings: AgentSettings;
  lastModified: string;
  currentStep: number;
  metadata: {
    clerkUserId: string;
    livekitRoomPrefix?: string;
    vectorDbCollection: string;
  };
  customerAttributes?: string[];
  customAttributes?: string;
  savedActions?: Record<string, {
    id: string;
    name: string;
    type: string;
    config: Record<string, any>;
  }>;
}
