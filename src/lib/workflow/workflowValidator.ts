import { WorkflowData, WorkflowNode, WorkflowConnection, ValidationResult, ValidationError } from '@/types/workflow';
import { NodeFactory } from './nodeFactory';

export class WorkflowValidator {
  static validateWorkflow(workflow: WorkflowData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate nodes
    const nodeErrors = this.validateNodes(workflow.nodes);
    errors.push(...nodeErrors);

    // Validate connections
    const connectionErrors = this.validateConnections(workflow.nodes, workflow.connections);
    errors.push(...connectionErrors);

    // Validate workflow structure
    const structureErrors = this.validateWorkflowStructure(workflow.nodes, workflow.connections);
    errors.push(...structureErrors);

    // Check for warnings
    const workflowWarnings = this.checkWarnings(workflow.nodes, workflow.connections);
    warnings.push(...workflowWarnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateNodes(nodes: WorkflowNode[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for duplicate node IDs
    const nodeIds = new Set<string>();
    for (const node of nodes) {
      if (nodeIds.has(node.id)) {
        errors.push({
          nodeId: node.id,
          message: `Duplicate node ID: ${node.id}`,
          severity: 'error'
        });
      }
      nodeIds.add(node.id);
    }

    // Validate each node's configuration
    for (const node of nodes) {
      const nodeValidation = NodeFactory.validateNodeConfig(node.type, node.data.config);
      if (!nodeValidation.isValid) {
        for (const error of nodeValidation.errors) {
          errors.push({
            nodeId: node.id,
            message: error,
            severity: 'error'
          });
        }
      }

      // Check required fields
      if (!node.data.name || node.data.name.trim() === '') {
        errors.push({
          nodeId: node.id,
          field: 'name',
          message: 'Node name is required',
          severity: 'error'
        });
      }

      // Validate position
      if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        errors.push({
          nodeId: node.id,
          field: 'position',
          message: 'Invalid node position',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  private static validateConnections(nodes: WorkflowNode[], connections: WorkflowConnection[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    // Check for duplicate connection IDs
    const connectionIds = new Set<string>();
    for (const connection of connections) {
      if (connectionIds.has(connection.id)) {
        errors.push({
          connectionId: connection.id,
          message: `Duplicate connection ID: ${connection.id}`,
          severity: 'error'
        });
      }
      connectionIds.add(connection.id);
    }

    // Validate each connection
    for (const connection of connections) {
      // Check if source node exists
      if (!nodeIds.has(connection.source)) {
        errors.push({
          connectionId: connection.id,
          message: `Source node not found: ${connection.source}`,
          severity: 'error'
        });
      }

      // Check if target node exists
      if (!nodeIds.has(connection.target)) {
        errors.push({
          connectionId: connection.id,
          message: `Target node not found: ${connection.target}`,
          severity: 'error'
        });
      }

      // Check for self-connections
      if (connection.source === connection.target) {
        errors.push({
          connectionId: connection.id,
          message: 'Node cannot connect to itself',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  private static validateWorkflowStructure(nodes: WorkflowNode[], connections: WorkflowConnection[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for at least one trigger node
    const triggerNodes = nodes.filter(node => node.type === 'webhook-trigger');
    if (triggerNodes.length === 0) {
      errors.push({
        message: 'Workflow must have at least one trigger node',
        severity: 'error'
      });
    }

    // Check for circular dependencies
    const circularDependencies = this.detectCircularDependencies(nodes, connections);
    if (circularDependencies.length > 0) {
      for (const cycle of circularDependencies) {
        errors.push({
          message: `Circular dependency detected: ${cycle.join(' -> ')}`,
          severity: 'error'
        });
      }
    }

    // Check for orphaned nodes (nodes with no connections)
    if (nodes.length > 1) {
      const connectedNodes = new Set<string>();
      for (const connection of connections) {
        connectedNodes.add(connection.source);
        connectedNodes.add(connection.target);
      }

      for (const node of nodes) {
        if (!connectedNodes.has(node.id) && node.type !== 'webhook-trigger') {
          errors.push({
            nodeId: node.id,
            message: 'Node is not connected to the workflow',
            severity: 'warning'
          });
        }
      }
    }

    return errors;
  }

  private static checkWarnings(nodes: WorkflowNode[], connections: WorkflowConnection[]): ValidationError[] {
    const warnings: ValidationError[] = [];

    // Check for nodes without descriptions
    for (const node of nodes) {
      if (!node.data.description || node.data.description.trim() === '') {
        warnings.push({
          nodeId: node.id,
          field: 'description',
          message: 'Node description is recommended for better documentation',
          severity: 'warning'
        });
      }
    }

    // Check for multiple trigger nodes
    const triggerNodes = nodes.filter(node => node.type === 'webhook-trigger');
    if (triggerNodes.length > 1) {
      warnings.push({
        message: 'Multiple trigger nodes detected. Consider using a single entry point.',
        severity: 'warning'
      });
    }

    // Check for nodes with no outputs
    const nodeOutputs = new Map<string, number>();
    for (const connection of connections) {
      nodeOutputs.set(connection.source, (nodeOutputs.get(connection.source) || 0) + 1);
    }

    for (const node of nodes) {
      if (node.type !== 'knova-agent' && (nodeOutputs.get(node.id) || 0) === 0) {
        warnings.push({
          nodeId: node.id,
          message: 'Node has no output connections',
          severity: 'warning'
        });
      }
    }

    return warnings;
  }

  private static detectCircularDependencies(nodes: WorkflowNode[], connections: WorkflowConnection[]): string[][] {
    const graph = new Map<string, string[]>();
    const cycles: string[][] = [];

    // Build adjacency list
    for (const node of nodes) {
      graph.set(node.id, []);
    }

    for (const connection of connections) {
      const neighbors = graph.get(connection.source) || [];
      neighbors.push(connection.target);
      graph.set(connection.source, neighbors);
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor); // Complete the cycle
          cycles.push(cycle);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  static validateNodeConnection(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    sourceHandle?: string,
    targetHandle?: string
  ): { isValid: boolean; error?: string } {
    // Note: sourceHandle and targetHandle are reserved for future use
    void sourceHandle;
    void targetHandle;
    // Check if connection is allowed based on node types
    const sourceNodeType = NodeFactory.getNode(sourceNode.type);
    const targetNodeType = NodeFactory.getNode(targetNode.type);

    if (!sourceNodeType || !targetNodeType) {
      return { isValid: false, error: 'Unknown node type' };
    }

    // Trigger nodes can only be source nodes
    if (targetNode.type === 'webhook-trigger') {
      return { isValid: false, error: 'Trigger nodes cannot be targets' };
    }

    // Info nodes can connect to anything
    if (sourceNode.type === 'info' || targetNode.type === 'info') {
      return { isValid: true };
    }

    // Check specific connection rules
    const connectionRules = this.getConnectionRules();
    const rule = connectionRules.get(sourceNode.type);
    
    if (rule && !rule.allowedTargets.includes(targetNode.type)) {
      return { 
        isValid: false, 
        error: `${sourceNode.type} cannot connect to ${targetNode.type}` 
      };
    }

    return { isValid: true };
  }

  private static getConnectionRules(): Map<string, { allowedTargets: string[] }> {
    return new Map([
      ['webhook-trigger', { allowedTargets: ['facebook', 'ghl', 'knova-agent', 'n8n', 'info'] }],
      ['facebook', { allowedTargets: ['ghl', 'knova-agent', 'n8n', 'info'] }],
      ['ghl', { allowedTargets: ['knova-agent', 'n8n', 'info'] }],
      ['knova-agent', { allowedTargets: ['n8n', 'info'] }],
      ['n8n', { allowedTargets: ['facebook', 'ghl', 'knova-agent', 'info'] }],
      ['info', { allowedTargets: ['facebook', 'ghl', 'knova-agent', 'n8n', 'info'] }]
    ]);
  }
}
