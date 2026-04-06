import { WorkflowData, WorkflowExecution, ExecutionLog, WorkflowNode, WorkflowConnection } from '@/types/workflow';
import { NodeFactory } from './nodeFactory';
import { WorkflowValidator } from './workflowValidator';

export class WorkflowEngine {
  private static executions = new Map<string, WorkflowExecution>();

  static async executeWorkflow(
    workflow: WorkflowData, 
    triggerData: any, 
    triggerNodeId?: string
  ): Promise<WorkflowExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      input: triggerData,
      logs: []
    };

    this.executions.set(executionId, execution);

    try {
      // Validate workflow before execution
      const validation = WorkflowValidator.validateWorkflow(workflow);
      if (!validation.isValid) {
        throw new Error(`Workflow validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      this.addLog(execution, 'workflow', 'info', 'Workflow execution started', { triggerData });

      // Find trigger node
      const triggerNode = triggerNodeId 
        ? workflow.nodes.find(n => n.id === triggerNodeId)
        : workflow.nodes.find(n => n.type === 'webhook-trigger');

      if (!triggerNode) {
        throw new Error('No trigger node found in workflow');
      }

      // Execute workflow starting from trigger
      const result = await this.executeFromNode(workflow, triggerNode, triggerData, execution);

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.output = result;

      this.addLog(execution, 'workflow', 'info', 'Workflow execution completed', { result });

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      this.addLog(execution, 'workflow', 'error', 'Workflow execution failed', { error: execution.error });
    }

    return execution;
  }

  private static async executeFromNode(
    workflow: WorkflowData,
    currentNode: WorkflowNode,
    inputData: any,
    execution: WorkflowExecution
  ): Promise<any> {
    this.addLog(execution, currentNode.id, 'info', `Executing node: ${currentNode.data.name}`);

    try {
      // Execute current node
      const nodeResult = await NodeFactory.executeNode(currentNode.type, currentNode.data.config, inputData);
      
      this.addLog(execution, currentNode.id, 'info', 'Node executed successfully', { result: nodeResult });

      // Find next nodes to execute
      const nextConnections = workflow.connections.filter(conn => conn.source === currentNode.id);
      
      if (nextConnections.length === 0) {
        // End of workflow
        return nodeResult;
      }

      // Execute next nodes in sequence (for now, we'll execute them one by one)
      let finalResult = nodeResult;
      for (const connection of nextConnections) {
        const nextNode = workflow.nodes.find(n => n.id === connection.target);
        if (nextNode) {
          finalResult = await this.executeFromNode(workflow, nextNode, nodeResult, execution);
        }
      }

      return finalResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addLog(execution, currentNode.id, 'error', `Node execution failed: ${errorMessage}`);
      throw error;
    }
  }

  private static addLog(
    execution: WorkflowExecution,
    nodeId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    const log: ExecutionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodeId,
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    execution.logs.push(log);
  }

  static getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  static getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  static getExecutionsByWorkflow(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(exec => exec.workflowId === workflowId);
  }

  static cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
      this.addLog(execution, 'workflow', 'info', 'Workflow execution cancelled');
      return true;
    }
    return false;
  }

  // Webhook execution method
  static async executeWorkflowFromWebhook(
    workflowId: string,
    webhookData: any,
    headers: Record<string, string> = {}
  ): Promise<{ success: boolean; executionId?: string; error?: string }> {
    try {
      // In a real implementation, you would load the workflow from database
      // For now, we'll return a mock response
      const mockWorkflow: WorkflowData = {
        id: workflowId,
        name: 'Mock Workflow',
        description: 'Mock workflow for webhook execution',
        nodes: [
          {
            id: 'trigger-1',
            type: 'webhook-trigger',
            position: { x: 0, y: 0 },
            data: {
              name: 'Webhook Trigger',
              description: 'Webhook trigger node',
              config: { method: 'POST' }
            }
          }
        ],
        connections: [],
        settings: {
          autoSave: true,
          gridSnap: true,
          showGrid: true
        }
      };

      const execution = await this.executeWorkflow(mockWorkflow, webhookData);
      
      return {
        success: execution.status === 'completed',
        executionId: execution.id,
        error: execution.error
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Test execution method for development
  static async testWorkflow(workflow: WorkflowData, testData: any = {}): Promise<WorkflowExecution> {
    const defaultTestData = {
      timestamp: new Date().toISOString(),
      source: 'test',
      data: testData
    };

    return this.executeWorkflow(workflow, defaultTestData);
  }

  // Get execution statistics
  static getExecutionStats(workflowId?: string): {
    total: number;
    completed: number;
    failed: number;
    running: number;
    cancelled: number;
  } {
    const executions = workflowId 
      ? this.getExecutionsByWorkflow(workflowId)
      : this.getAllExecutions();

    return {
      total: executions.length,
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      running: executions.filter(e => e.status === 'running').length,
      cancelled: executions.filter(e => e.status === 'cancelled').length
    };
  }

  // Clear old executions (for memory management)
  static clearOldExecutions(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, execution] of this.executions.entries()) {
      const executionTime = new Date(execution.startedAt);
      if (executionTime < cutoffTime && execution.status !== 'running') {
        this.executions.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  // Generate execution report
  static generateExecutionReport(executionId: string): {
    execution: WorkflowExecution;
    summary: {
      duration: number;
      nodesExecuted: number;
      errors: number;
      warnings: number;
    };
  } | null {
    const execution = this.getExecution(executionId);
    if (!execution) return null;

    const startTime = new Date(execution.startedAt).getTime();
    const endTime = execution.completedAt ? new Date(execution.completedAt).getTime() : Date.now();
    const duration = endTime - startTime;

    const uniqueNodes = new Set(execution.logs.map(log => log.nodeId));
    const errors = execution.logs.filter(log => log.level === 'error').length;
    const warnings = execution.logs.filter(log => log.level === 'warn').length;

    return {
      execution,
      summary: {
        duration,
        nodesExecuted: uniqueNodes.size,
        errors,
        warnings
      }
    };
  }
}
