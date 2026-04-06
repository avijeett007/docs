import { WorkflowData, WorkflowNode, WorkflowConnection } from '@/types/workflow';

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  data: WorkflowData;
  createdAt: string;
  createdBy: string;
  changelog: string;
  isActive: boolean;
}

export interface WorkflowBackup {
  id: string;
  workflowId: string;
  data: WorkflowData;
  createdAt: string;
  type: 'manual' | 'auto' | 'pre-deploy';
  description?: string;
}

export interface WorkflowExportData {
  metadata: {
    exportedAt: string;
    exportedBy: string;
    version: string;
    type: 'workflow' | 'template';
  };
  workflow: WorkflowData;
  dependencies?: string[];
  instructions?: string;
}

export class WorkflowDataManager {
  private static workflows = new Map<string, WorkflowData>();
  private static versions = new Map<string, WorkflowVersion[]>();
  private static backups = new Map<string, WorkflowBackup[]>();

  // Core CRUD Operations
  static saveWorkflow(workflow: WorkflowData): { success: boolean; error?: string } {
    try {
      // Validate workflow data
      const validation = this.validateWorkflowData(workflow);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Generate ID if new workflow
      if (!workflow.id) {
        workflow.id = this.generateWorkflowId();
      }

      // Update timestamps
      const now = new Date().toISOString();
      if (!workflow.createdAt) {
        workflow.createdAt = now;
      }
      workflow.updatedAt = now;

      // Create backup before saving
      this.createAutoBackup(workflow);

      // Save workflow
      this.workflows.set(workflow.id, { ...workflow });

      // Create version if significant changes
      this.createVersionIfNeeded(workflow);

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static getWorkflow(workflowId: string): WorkflowData | null {
    return this.workflows.get(workflowId) || null;
  }

  static getAllWorkflows(): WorkflowData[] {
    return Array.from(this.workflows.values());
  }

  static deleteWorkflow(workflowId: string): boolean {
    const deleted = this.workflows.delete(workflowId);
    if (deleted) {
      // Clean up versions and backups
      this.versions.delete(workflowId);
      this.backups.delete(workflowId);
    }
    return deleted;
  }

  static duplicateWorkflow(workflowId: string, newName?: string): WorkflowData | null {
    const original = this.getWorkflow(workflowId);
    if (!original) return null;

    const duplicate: WorkflowData = {
      ...original,
      id: this.generateWorkflowId(),
      name: newName || `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: original.nodes.map(node => ({
        ...node,
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })),
      connections: original.connections.map(conn => ({
        ...conn,
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))
    };

    // Update connection references to new node IDs
    const nodeIdMap = new Map<string, string>();
    original.nodes.forEach((originalNode, index) => {
      nodeIdMap.set(originalNode.id, duplicate.nodes[index].id);
    });

    duplicate.connections = duplicate.connections.map(conn => ({
      ...conn,
      source: nodeIdMap.get(conn.source) || conn.source,
      target: nodeIdMap.get(conn.target) || conn.target
    }));

    this.saveWorkflow(duplicate);
    return duplicate;
  }

  // Export/Import Operations
  static exportWorkflow(workflowId: string, includeMetadata: boolean = true): string | null {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) return null;

    const exportData: WorkflowExportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'current-user', // Would be replaced with actual user
        version: '1.0.0',
        type: 'workflow'
      },
      workflow,
      dependencies: this.extractDependencies(workflow),
      instructions: this.generateExportInstructions(workflow)
    };

    if (!includeMetadata) {
      return JSON.stringify(workflow, null, 2);
    }

    return JSON.stringify(exportData, null, 2);
  }

  static importWorkflow(jsonData: string, options: {
    overwrite?: boolean;
    generateNewIds?: boolean;
    validateBeforeImport?: boolean;
  } = {}): { success: boolean; workflowId?: string; error?: string } {
    try {
      const data = JSON.parse(jsonData);
      
      // Determine if it's a full export or just workflow data
      const workflow: WorkflowData = data.workflow || data;

      // Validate imported data
      if (options.validateBeforeImport !== false) {
        const validation = this.validateWorkflowData(workflow);
        if (!validation.isValid) {
          return { success: false, error: validation.error };
        }
      }

      // Generate new IDs if requested or if workflow already exists
      if (options.generateNewIds || (this.workflows.has(workflow.id) && !options.overwrite)) {
        workflow.id = this.generateWorkflowId();
        
        // Generate new node IDs
        const nodeIdMap = new Map<string, string>();
        workflow.nodes = workflow.nodes.map(node => {
          const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          nodeIdMap.set(node.id, newId);
          return { ...node, id: newId };
        });

        // Update connection references
        workflow.connections = workflow.connections.map(conn => ({
          ...conn,
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: nodeIdMap.get(conn.source) || conn.source,
          target: nodeIdMap.get(conn.target) || conn.target
        }));
      }

      // Save imported workflow
      const saveResult = this.saveWorkflow(workflow);
      if (!saveResult.success) {
        return saveResult;
      }

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      return { success: false, error: 'Invalid JSON format' };
    }
  }

  // Version Management
  static createVersion(workflowId: string, changelog: string): WorkflowVersion | null {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) return null;

    const versions = this.versions.get(workflowId) || [];
    const newVersion: WorkflowVersion = {
      id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId,
      version: versions.length + 1,
      data: { ...workflow },
      createdAt: new Date().toISOString(),
      createdBy: 'current-user', // Would be replaced with actual user
      changelog,
      isActive: true
    };

    // Deactivate previous versions
    versions.forEach(v => v.isActive = false);
    versions.push(newVersion);
    this.versions.set(workflowId, versions);

    return newVersion;
  }

  static getVersions(workflowId: string): WorkflowVersion[] {
    return this.versions.get(workflowId) || [];
  }

  static restoreVersion(workflowId: string, versionId: string): boolean {
    const versions = this.getVersions(workflowId);
    const version = versions.find(v => v.id === versionId);
    
    if (!version) return false;

    // Create backup of current state
    const currentWorkflow = this.getWorkflow(workflowId);
    if (currentWorkflow) {
      this.createManualBackup(currentWorkflow, 'Pre-restore backup');
    }

    // Restore version data
    const saveResult = this.saveWorkflow(version.data);
    return saveResult.success;
  }

  // Backup Management
  static createManualBackup(workflow: WorkflowData, description?: string): WorkflowBackup {
    const backup: WorkflowBackup = {
      id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId: workflow.id,
      data: { ...workflow },
      createdAt: new Date().toISOString(),
      type: 'manual',
      description
    };

    const backups = this.backups.get(workflow.id) || [];
    backups.push(backup);
    this.backups.set(workflow.id, backups);

    // Keep only last 10 manual backups
    const manualBackups = backups.filter(b => b.type === 'manual');
    if (manualBackups.length > 10) {
      const toRemove = manualBackups.slice(0, manualBackups.length - 10);
      const filteredBackups = backups.filter(b => !toRemove.includes(b));
      this.backups.set(workflow.id, filteredBackups);
    }

    return backup;
  }

  private static createAutoBackup(workflow: WorkflowData): void {
    const backup: WorkflowBackup = {
      id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId: workflow.id,
      data: { ...workflow },
      createdAt: new Date().toISOString(),
      type: 'auto'
    };

    const backups = this.backups.get(workflow.id) || [];
    backups.push(backup);
    this.backups.set(workflow.id, backups);

    // Keep only last 5 auto backups
    const autoBackups = backups.filter(b => b.type === 'auto');
    if (autoBackups.length > 5) {
      const toRemove = autoBackups.slice(0, autoBackups.length - 5);
      const filteredBackups = backups.filter(b => !toRemove.includes(b));
      this.backups.set(workflow.id, filteredBackups);
    }
  }

  static getBackups(workflowId: string): WorkflowBackup[] {
    return this.backups.get(workflowId) || [];
  }

  static restoreBackup(workflowId: string, backupId: string): boolean {
    const backups = this.getBackups(workflowId);
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) return false;

    const saveResult = this.saveWorkflow(backup.data);
    return saveResult.success;
  }

  // Utility Methods
  private static generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static validateWorkflowData(workflow: WorkflowData): { isValid: boolean; error?: string } {
    if (!workflow.name || workflow.name.trim() === '') {
      return { isValid: false, error: 'Workflow name is required' };
    }

    if (!Array.isArray(workflow.nodes)) {
      return { isValid: false, error: 'Workflow nodes must be an array' };
    }

    if (!Array.isArray(workflow.connections)) {
      return { isValid: false, error: 'Workflow connections must be an array' };
    }

    // Validate node structure
    for (const node of workflow.nodes) {
      if (!node.id || !node.type || !node.position || !node.data) {
        return { isValid: false, error: 'Invalid node structure' };
      }
    }

    // Validate connection structure
    for (const connection of workflow.connections) {
      if (!connection.id || !connection.source || !connection.target) {
        return { isValid: false, error: 'Invalid connection structure' };
      }
    }

    return { isValid: true };
  }

  private static createVersionIfNeeded(workflow: WorkflowData): void {
    const versions = this.getVersions(workflow.id);
    const lastVersion = versions[versions.length - 1];

    // Create version if this is the first save or if significant changes detected
    if (!lastVersion || this.hasSignificantChanges(lastVersion.data, workflow)) {
      this.createVersion(workflow.id, 'Auto-generated version');
    }
  }

  private static hasSignificantChanges(oldWorkflow: WorkflowData, newWorkflow: WorkflowData): boolean {
    // Simple change detection - in a real app, this would be more sophisticated
    return (
      oldWorkflow.nodes.length !== newWorkflow.nodes.length ||
      oldWorkflow.connections.length !== newWorkflow.connections.length ||
      JSON.stringify(oldWorkflow.nodes) !== JSON.stringify(newWorkflow.nodes) ||
      JSON.stringify(oldWorkflow.connections) !== JSON.stringify(newWorkflow.connections)
    );
  }

  private static extractDependencies(workflow: WorkflowData): string[] {
    const dependencies = new Set<string>();
    
    workflow.nodes.forEach(node => {
      // Extract dependencies based on node type
      switch (node.type) {
        case 'facebook':
          dependencies.add('Facebook API');
          break;
        case 'ghl':
          dependencies.add('Go High Level API');
          break;
        case 'knova-agent':
          dependencies.add('Knova AI Agent');
          break;
        case 'n8n':
          dependencies.add('N8N Integration');
          break;
      }
    });

    return Array.from(dependencies);
  }

  private static generateExportInstructions(workflow: WorkflowData): string {
    return `
# Workflow Import Instructions

This workflow contains ${workflow.nodes.length} nodes and ${workflow.connections.length} connections.

## Setup Requirements:
${this.extractDependencies(workflow).map(dep => `- ${dep}`).join('\n')}

## Import Steps:
1. Ensure all required integrations are configured
2. Import this workflow file
3. Configure each node with your specific credentials
4. Test the workflow before activating

## Notes:
- Review all node configurations after import
- Update webhook URLs to match your environment
- Test with sample data before production use
    `.trim();
  }

  // Bulk Operations
  static exportMultipleWorkflows(workflowIds: string[]): string | null {
    const workflows = workflowIds.map(id => this.getWorkflow(id)).filter(Boolean) as WorkflowData[];
    
    if (workflows.length === 0) return null;

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'current-user',
        version: '1.0.0',
        type: 'bulk-export',
        count: workflows.length
      },
      workflows
    };

    return JSON.stringify(exportData, null, 2);
  }

  static clearAllData(): void {
    this.workflows.clear();
    this.versions.clear();
    this.backups.clear();
  }

  static getStorageStats(): {
    totalWorkflows: number;
    totalVersions: number;
    totalBackups: number;
    storageSize: number;
  } {
    const totalVersions = Array.from(this.versions.values()).reduce((sum, versions) => sum + versions.length, 0);
    const totalBackups = Array.from(this.backups.values()).reduce((sum, backups) => sum + backups.length, 0);
    
    // Estimate storage size (in bytes)
    const workflowsSize = JSON.stringify(Array.from(this.workflows.values())).length;
    const versionsSize = JSON.stringify(Array.from(this.versions.values())).length;
    const backupsSize = JSON.stringify(Array.from(this.backups.values())).length;

    return {
      totalWorkflows: this.workflows.size,
      totalVersions,
      totalBackups,
      storageSize: workflowsSize + versionsSize + backupsSize
    };
  }
}
