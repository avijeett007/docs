'use client';

import { N8nApiClient, N8nCredential, N8nCredentialData } from './client';
import { logger } from '@/lib/logger';

export interface KnotieCredentialConfig {
  customerToken: string;
  customerName: string;
  connectHubUrl: string;
}

export class KnotieCredentialManager {
  constructor(private n8nClient: N8nApiClient) {}

  /**
   * Create a Knotie API credential in N8N
   */
  async createKnotieCredential(config: KnotieCredentialConfig): Promise<N8nCredential> {
    try {
      const credentialData: N8nCredentialData = {
        name: `Knotie AI - ${config.customerName}`,
        type: 'knotieApi', // Matches n8n-nodes-knotie credential type
        data: {
          apiToken: config.customerToken,
          baseUrl: config.connectHubUrl,
        },
      };

      logger.info('Creating Knotie credential in N8N', {
        credentialName: credentialData.name,
        customerName: config.customerName,
      });

      const credential = await this.n8nClient.createCredential(credentialData);
      
      logger.info('Knotie credential created successfully', {
        credentialId: credential.id,
        credentialName: credential.name,
      });

      return credential;
    } catch (error) {
      logger.error('Failed to create Knotie credential', error as Error, {
        customerName: config.customerName,
      });
      throw error;
    }
  }

  /**
   * Update an existing Knotie API credential
   */
  async updateKnotieCredential(
    credentialId: string,
    config: Partial<KnotieCredentialConfig>
  ): Promise<N8nCredential> {
    try {
      const updateData: Partial<N8nCredentialData> = {};

      if (config.customerName) {
        updateData.name = `Knotie AI - ${config.customerName}`;
      }

      if (config.customerToken || config.connectHubUrl) {
        updateData.data = {};
        if (config.customerToken) {
          updateData.data.apiToken = config.customerToken;
        }
        if (config.connectHubUrl) {
          updateData.data.baseUrl = config.connectHubUrl;
        }
      }

      logger.info('Updating Knotie credential in N8N', {
        credentialId,
        updateFields: Object.keys(updateData),
      });

      const credential = await this.n8nClient.updateCredential(credentialId, updateData);
      
      logger.info('Knotie credential updated successfully', {
        credentialId: credential.id,
        credentialName: credential.name,
      });

      return credential;
    } catch (error) {
      logger.error('Failed to update Knotie credential', error as Error, {
        credentialId,
      });
      throw error;
    }
  }

  /**
   * Find existing Knotie credentials for a customer
   */
  async findKnotieCredentials(customerName?: string): Promise<N8nCredential[]> {
    try {
      const allCredentials = await this.n8nClient.getCredentials();
      
      // Filter for Knotie credentials
      let knotieCredentials = allCredentials.filter(
        cred => cred.type === 'knotieApi'
      );

      // Further filter by customer name if provided
      if (customerName) {
        const expectedName = `Knotie AI - ${customerName}`;
        knotieCredentials = knotieCredentials.filter(
          cred => cred.name === expectedName
        );
      }

      logger.info('Found Knotie credentials', {
        count: knotieCredentials.length,
        customerName,
      });

      return knotieCredentials;
    } catch (error) {
      logger.error('Failed to find Knotie credentials', error as Error, {
        customerName,
      });
      throw error;
    }
  }

  /**
   * Delete a Knotie credential
   */
  async deleteKnotieCredential(credentialId: string): Promise<void> {
    try {
      logger.info('Deleting Knotie credential', { credentialId });
      
      await this.n8nClient.deleteCredential(credentialId);
      
      logger.info('Knotie credential deleted successfully', { credentialId });
    } catch (error) {
      logger.error('Failed to delete Knotie credential', error as Error, {
        credentialId,
      });
      throw error;
    }
  }

  /**
   * Test a Knotie credential by attempting to use it
   */
  async testKnotieCredential(credentialId: string): Promise<boolean> {
    try {
      logger.info('Testing Knotie credential', { credentialId });
      
      // Get the credential details
      const credential = await this.n8nClient.getCredential(credentialId);
      
      if (credential.type !== 'knotieApi') {
        throw new Error('Credential is not a Knotie API credential');
      }

      // Test the credential by making a simple API call to Connect Hub
      const { apiToken, baseUrl } = credential.data;
      
      if (!apiToken || !baseUrl) {
        throw new Error('Credential is missing required data (apiToken or baseUrl)');
      }

      // Make a test request to Connect Hub
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      const isValid = response.ok;
      
      logger.info('Knotie credential test completed', {
        credentialId,
        isValid,
        statusCode: response.status,
      });

      return isValid;
    } catch (error) {
      logger.error('Failed to test Knotie credential', error as Error, {
        credentialId,
      });
      return false;
    }
  }

  /**
   * Get or create a Knotie credential for a customer
   */
  async getOrCreateKnotieCredential(config: KnotieCredentialConfig): Promise<N8nCredential> {
    try {
      // First, try to find existing credential
      const existingCredentials = await this.findKnotieCredentials(config.customerName);
      
      if (existingCredentials.length > 0) {
        const credential = existingCredentials[0];
        
        // Test if the existing credential is still valid
        const isValid = await this.testKnotieCredential(credential.id);
        
        if (isValid) {
          logger.info('Using existing Knotie credential', {
            credentialId: credential.id,
            customerName: config.customerName,
          });
          return credential;
        } else {
          // Update the existing credential with new token
          logger.info('Updating invalid Knotie credential', {
            credentialId: credential.id,
            customerName: config.customerName,
          });
          return await this.updateKnotieCredential(credential.id, config);
        }
      }

      // No existing credential found, create a new one
      logger.info('Creating new Knotie credential', {
        customerName: config.customerName,
      });
      return await this.createKnotieCredential(config);
    } catch (error) {
      logger.error('Failed to get or create Knotie credential', error as Error, {
        customerName: config.customerName,
      });
      throw error;
    }
  }
}
