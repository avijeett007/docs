export type ToolCategory = 
  | 'Calendar'
  | 'Task Management'
  | 'Communication'
  | 'Project Management'
  | 'CRM'
  | 'Social Media'
  | 'Marketing'
  | 'Developer Tools';

export type ToolProvider = 'official' | 'community';

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  category: ToolCategory;
  provider: ToolProvider;
  publisher: {
    name: string;
    website?: string;
    email?: string;
  };
  documentation?: string;
  repository?: string;
  tags?: string[];
}

export interface AuthConfig {
  type: 'oauth2' | 'api_key' | 'basic';
  config: OAuth2Config | ApiKeyConfig | BasicAuthConfig;
}

export interface OAuth2Config {
  authUrl: string;
  tokenUrl: string;
  scope: string[];
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

export interface ApiKeyConfig {
  in: 'header' | 'query';
  name: string;
  description?: string;
}

export interface BasicAuthConfig {
  usernameField?: string;
  passwordField?: string;
}

export interface ConnectedTool extends ToolMetadata {
  userId: string;
  workspaceId: string;
  connectionId: string;
  authData: any;
  status: 'active' | 'inactive' | 'error';
  lastSynced?: Date;
  createdAt: Date;
  updatedAt: Date;
}
