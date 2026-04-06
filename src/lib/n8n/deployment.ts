'use client';

import { N8nApiClient, N8nWorkflow, N8nCredential } from './client';
import { KnotieCredentialManager } from './credentials';
import { logger } from '@/lib/logger';

export interface WorkflowProduct {
  id: string;
  name: string;
  description: string;
  workflowJson: any;
  category: string;
  difficulty: string;
  tags: string[];
  requiredNodes: string[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
}

export interface DeploymentResult {
  success: boolean;
  workflowId?: string;
  credentialId?: string;
  error?: string;
  details?: any;
}

export class WorkflowDeploymentEngine {
  constructor(
    private n8nClient: N8nApiClient,
    private credentialManager: KnotieCredentialManager
  ) {}

  /**
   * Deploy a workflow product to a customer's N8N instance
   */
  async deployWorkflow(
    product: WorkflowProduct,
    customer: Customer,
    knotieToken: string,
    connectHubUrl: string
  ): Promise<DeploymentResult> {
    try {
      logger.info('Starting workflow deployment', {
        productId: product.id,
        productName: product.name,
        customerId: customer.id,
        customerName: customer.name,
      });

      // Step 1: Create or get Knotie credential
      const credential = await this.credentialManager.getOrCreateKnotieCredential({
        customerToken: knotieToken,
        customerName: customer.name,
        connectHubUrl,
      });

      logger.info('Knotie credential ready', {
        credentialId: credential.id,
        credentialName: credential.name,
      });

      // Step 2: Prepare workflow for deployment
      const workflowData = await this.prepareWorkflowForDeployment(
        product,
        customer,
        credential.id
      );

      // Step 3: Deploy workflow to N8N
      const deployedWorkflow = await this.n8nClient.createWorkflow(workflowData);

      logger.info('Workflow deployed successfully', {
        workflowId: deployedWorkflow.id,
        workflowName: deployedWorkflow.name,
        productId: product.id,
        customerId: customer.id,
      });

      // Step 4: Activate the workflow if it should be auto-activated
      if (this.shouldAutoActivateWorkflow(product)) {
        try {
          await this.n8nClient.activateWorkflow(deployedWorkflow.id);
          logger.info('Workflow activated automatically', {
            workflowId: deployedWorkflow.id,
          });
        } catch (activationError) {
          logger.warn('Failed to auto-activate workflow', {
            workflowId: deployedWorkflow.id,
            error: activationError instanceof Error ? activationError.message : 'Unknown error',
          });
          // Don't fail the deployment if activation fails
        }
      }

      return {
        success: true,
        workflowId: deployedWorkflow.id,
        credentialId: credential.id,
        details: {
          workflowName: deployedWorkflow.name,
          credentialName: credential.name,
          activated: this.shouldAutoActivateWorkflow(product),
        },
      };
    } catch (error) {
      logger.error('Workflow deployment failed', error as Error, {
        productId: product.id,
        customerId: customer.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error',
      };
    }
  }

  /**
   * Prepare workflow JSON for deployment by updating credentials and customer-specific data
   */
  private async prepareWorkflowForDeployment(
    product: WorkflowProduct,
    customer: Customer,
    credentialId: string
  ): Promise<Partial<N8nWorkflow>> {
    try {
      // Clone the workflow JSON to avoid modifying the original
      const workflowJson = JSON.parse(JSON.stringify(product.workflowJson));

      // Update workflow metadata
      const workflowName = `${product.name} - ${customer.name}`;
      const workflowData: Partial<N8nWorkflow> = {
        name: workflowName,
        nodes: workflowJson.nodes || [],
        connections: workflowJson.connections || {},
        settings: workflowJson.settings || {},
        staticData: workflowJson.staticData || {},
        tags: [
          ...(workflowJson.tags || []),
          'knotie-deployed',
          `customer-${customer.id}`,
          `product-${product.id}`,
        ],
        active: false, // Start inactive, activate separately if needed
      };

      // Update Knotie nodes to use the customer's credential
      if (workflowData.nodes) {
        workflowData.nodes = workflowData.nodes.map((node: any) => {
          if (node.type === 'n8n-nodes-knotie.knotie') {
            return {
              ...node,
              credentials: {
                ...node.credentials,
                knotieApi: credentialId,
              },
              parameters: {
                ...node.parameters,
                // Add customer-specific parameters if needed
                customerId: customer.id,
                customerName: customer.name,
              },
            };
          }
          return node;
        });
      }

      logger.info('Workflow prepared for deployment', {
        workflowName,
        nodeCount: workflowData.nodes?.length || 0,
        hasConnections: Object.keys(workflowData.connections || {}).length > 0,
      });

      return workflowData;
    } catch (error) {
      logger.error('Failed to prepare workflow for deployment', error as Error, {
        productId: product.id,
        customerId: customer.id,
      });
      throw error;
    }
  }

  /**
   * Determine if a workflow should be auto-activated after deployment
   */
  private shouldAutoActivateWorkflow(product: WorkflowProduct): boolean {
    // Check if the workflow has trigger nodes that should be activated
    const workflowJson = product.workflowJson;
    
    if (!workflowJson.nodes) {
      return false;
    }

    // Look for trigger nodes (webhook, cron, etc.)
    const hasTriggerNodes = workflowJson.nodes.some((node: any) => {
      return node.type && (
        node.type.includes('trigger') ||
        node.type.includes('webhook') ||
        node.type.includes('cron') ||
        node.type.includes('schedule')
      );
    });

    return hasTriggerNodes;
  }

  /**
   * Undeploy a workflow (delete from N8N)
   */
  async undeployWorkflow(workflowId: string): Promise<DeploymentResult> {
    try {
      logger.info('Starting workflow undeployment', { workflowId });

      // First, deactivate the workflow if it's active
      try {
        await this.n8nClient.deactivateWorkflow(workflowId);
        logger.info('Workflow deactivated', { workflowId });
      } catch (deactivationError) {
        // Workflow might already be inactive, continue with deletion
        logger.warn('Failed to deactivate workflow (might already be inactive)', {
          workflowId,
          error: deactivationError instanceof Error ? deactivationError.message : 'Unknown error',
        });
      }

      // Delete the workflow
      await this.n8nClient.deleteWorkflow(workflowId);

      logger.info('Workflow undeployed successfully', { workflowId });

      return {
        success: true,
        details: {
          workflowId,
          action: 'deleted',
        },
      };
    } catch (error) {
      logger.error('Workflow undeployment failed', error as Error, {
        workflowId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown undeployment error',
      };
    }
  }

  /**
   * Update a deployed workflow with new product version
   */
  async updateDeployedWorkflow(
    workflowId: string,
    product: WorkflowProduct,
    customer: Customer,
    credentialId: string
  ): Promise<DeploymentResult> {
    try {
      logger.info('Starting workflow update', {
        workflowId,
        productId: product.id,
        customerId: customer.id,
      });

      // Prepare updated workflow data
      const workflowData = await this.prepareWorkflowForDeployment(
        product,
        customer,
        credentialId
      );

      // Update the workflow in N8N
      const updatedWorkflow = await this.n8nClient.updateWorkflow(workflowId, workflowData);

      logger.info('Workflow updated successfully', {
        workflowId: updatedWorkflow.id,
        workflowName: updatedWorkflow.name,
      });

      return {
        success: true,
        workflowId: updatedWorkflow.id,
        credentialId,
        details: {
          workflowName: updatedWorkflow.name,
          action: 'updated',
        },
      };
    } catch (error) {
      logger.error('Workflow update failed', error as Error, {
        workflowId,
        productId: product.id,
        customerId: customer.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown update error',
      };
    }
  }
}
