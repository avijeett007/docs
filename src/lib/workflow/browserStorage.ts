import { WorkflowData, KnovaAgentNodeData } from '@/types/workflow';
import { logger } from '../logger';

interface StoredWorkflow extends WorkflowData {
  partner_id: string;
  customer_id: string;
  workflow_uuid: string;
  created_at: string;
  updated_at: string;
}

interface StoredAgentConfig extends KnovaAgentNodeData {
  partner_id: string;
  customer_id: string;
  agent_uuid: string;
  workflow_uuid: string;
  created_at: string;
  updated_at: string;
}

export class BrowserStorageManager {
  private static WORKFLOW_KEY = 'knotie_workflows';
  private static AGENT_CONFIG_KEY = 'knotie_agent_configs';

  // Generate unique UUID with partner and customer info
  static generateWorkflowUUID(partnerId: string, customerId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `workflow_${partnerId}_${customerId}_${timestamp}_${random}`;
  }

  static generateAgentUUID(partnerId: string, customerId: string, workflowUuid: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `agent_${partnerId}_${customerId}_${workflowUuid}_${timestamp}_${random}`;
  }

  // Workflow Storage Methods
  static saveWorkflow(workflow: WorkflowData, partnerId: string, customerId: string): string {
    const workflows = this.getStoredWorkflows();
    const workflowUuid = workflow.id || this.generateWorkflowUUID(partnerId, customerId);
    
    const storedWorkflow: StoredWorkflow = {
      ...workflow,
      id: workflowUuid,
      partner_id: partnerId,
      customer_id: customerId,
      workflow_uuid: workflowUuid,
      created_at: workflow.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    workflows[workflowUuid] = storedWorkflow;
    localStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(workflows));
    
    logger.info('Workflow saved to browser storage', {
      operation: 'browser_storage',
      workflowUuid,
      partnerId,
      customerId,
      workflowName: workflow.name
    });

    return workflowUuid;
  }

  static getWorkflow(workflowUuid: string): StoredWorkflow | null {
    const workflows = this.getStoredWorkflows();
    return workflows[workflowUuid] || null;
  }

  static getWorkflowsByPartner(partnerId: string): StoredWorkflow[] {
    const workflows = this.getStoredWorkflows();
    return Object.values(workflows).filter(w => w.partner_id === partnerId);
  }

  static getWorkflowsByCustomer(partnerId: string, customerId: string): StoredWorkflow[] {
    const workflows = this.getStoredWorkflows();
    return Object.values(workflows).filter(w =>
      w.partner_id === partnerId && w.customer_id === customerId
    );
  }

  static getWorkflowByUuid(workflowUuid: string, partnerId: string): StoredWorkflow | null {
    const workflows = this.getStoredWorkflows();
    const workflow = workflows[workflowUuid];
    return (workflow && workflow.partner_id === partnerId) ? workflow : null;
  }

  static deleteWorkflow(workflowUuid: string, partnerId: string): boolean {
    const workflows = this.getStoredWorkflows();
    const workflow = workflows[workflowUuid];

    if (workflow && workflow.partner_id === partnerId) {
      delete workflows[workflowUuid];
      localStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(workflows));
      logger.info('Workflow deleted from browser storage', {
        operation: 'browser_storage',
        workflowUuid
      });
      return true;
    }

    return false;
  }

  static updateWorkflow(workflowUuid: string, partnerId: string, updates: Partial<WorkflowData>): boolean {
    const workflows = this.getStoredWorkflows();
    const workflow = workflows[workflowUuid];

    if (workflow && workflow.partner_id === partnerId) {
      workflows[workflowUuid] = {
        ...workflow,
        ...updates,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(workflows));
      logger.info('Workflow updated in browser storage', {
        operation: 'browser_storage',
        workflowUuid
      });
      return true;
    }

    return false;
  }

  private static getStoredWorkflows(): Record<string, StoredWorkflow> {
    try {
      const stored = localStorage.getItem(this.WORKFLOW_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      logger.error('Error reading workflows from storage', error as Error, {
        operation: 'browser_storage'
      });
      return {};
    }
  }

  // Agent Configuration Storage Methods
  static saveAgentConfig(
    agentConfig: KnovaAgentNodeData, 
    partnerId: string, 
    customerId: string, 
    workflowUuid: string
  ): string {
    const configs = this.getStoredAgentConfigs();
    const agentUuid = this.generateAgentUUID(partnerId, customerId, workflowUuid);
    
    const storedConfig: StoredAgentConfig = {
      ...agentConfig,
      partner_id: partnerId,
      customer_id: customerId,
      agent_uuid: agentUuid,
      workflow_uuid: workflowUuid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    configs[agentUuid] = storedConfig;
    localStorage.setItem(this.AGENT_CONFIG_KEY, JSON.stringify(configs));
    
    logger.info('Agent config saved to browser storage', {
      operation: 'browser_storage',
      agentUuid,
      partnerId,
      customerId,
      workflowUuid,
      agentName: agentConfig.agentName
    });

    return agentUuid;
  }

  static getAgentConfig(agentUuid: string): StoredAgentConfig | null {
    const configs = this.getStoredAgentConfigs();
    return configs[agentUuid] || null;
  }

  static getAgentConfigsByWorkflow(workflowUuid: string): StoredAgentConfig[] {
    const configs = this.getStoredAgentConfigs();
    return Object.values(configs).filter(c => c.workflow_uuid === workflowUuid);
  }

  static getAgentConfigsByCustomer(partnerId: string, customerId: string): StoredAgentConfig[] {
    const configs = this.getStoredAgentConfigs();
    return Object.values(configs).filter(c => 
      c.partner_id === partnerId && c.customer_id === customerId
    );
  }

  private static getStoredAgentConfigs(): Record<string, StoredAgentConfig> {
    try {
      const stored = localStorage.getItem(this.AGENT_CONFIG_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      logger.error('Error reading agent configs from storage', error as Error, {
        operation: 'browser_storage'
      });
      return {};
    }
  }

  // Utility Methods
  static clearAllData(): void {
    localStorage.removeItem(this.WORKFLOW_KEY);
    localStorage.removeItem(this.AGENT_CONFIG_KEY);
    logger.info('All workflow and agent data cleared from browser storage', {
      operation: 'browser_storage'
    });
  }

  static exportData(): { workflows: StoredWorkflow[], agentConfigs: StoredAgentConfig[] } {
    return {
      workflows: Object.values(this.getStoredWorkflows()),
      agentConfigs: Object.values(this.getStoredAgentConfigs())
    };
  }

  static getStorageStats(): { workflowCount: number, agentConfigCount: number, totalSize: string } {
    const workflows = this.getStoredWorkflows();
    const agentConfigs = this.getStoredAgentConfigs();
    
    const workflowData = localStorage.getItem(this.WORKFLOW_KEY) || '';
    const agentData = localStorage.getItem(this.AGENT_CONFIG_KEY) || '';
    const totalBytes = new Blob([workflowData + agentData]).size;
    
    return {
      workflowCount: Object.keys(workflows).length,
      agentConfigCount: Object.keys(agentConfigs).length,
      totalSize: `${(totalBytes / 1024).toFixed(2)} KB`
    };
  }
}
