import { WorkflowData, WorkflowExecution } from '@/types/workflow';
import { WorkflowEngine } from './workflowEngine';

export interface WebhookEndpoint {
  id: string;
  workflowId: string;
  environment: 'test' | 'production';
  url: string;
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
  secretKey?: string;
}

export interface WebhookRequest {
  id: string;
  webhookId: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  timestamp: string;
  sourceIp: string;
  userAgent?: string;
}

export interface WebhookResponse {
  id: string;
  requestId: string;
  statusCode: number;
  body: any;
  executionId?: string;
  processingTime: number;
  timestamp: string;
}

export class WebhookManager {
  private static webhooks = new Map<string, WebhookEndpoint>();
  private static requests = new Map<string, WebhookRequest>();
  private static responses = new Map<string, WebhookResponse>();

  static generateWebhookUrl(workflowId: string, environment: 'test' | 'production'): WebhookEndpoint {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const baseUrl = process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL || 'https://api.knotie-ai.pro';
    
    const webhook: WebhookEndpoint = {
      id: webhookId,
      workflowId,
      environment,
      url: `${baseUrl}/webhooks/workflow/${workflowId}/${environment}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
      secretKey: this.generateSecretKey()
    };

    this.webhooks.set(webhookId, webhook);
    return webhook;
  }

  static getWebhooksByWorkflow(workflowId: string): WebhookEndpoint[] {
    return Array.from(this.webhooks.values()).filter(webhook => webhook.workflowId === workflowId);
  }

  static getWebhookById(webhookId: string): WebhookEndpoint | undefined {
    return this.webhooks.get(webhookId);
  }

  static updateWebhookStatus(webhookId: string, isActive: boolean): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      webhook.isActive = isActive;
      return true;
    }
    return false;
  }

  static deleteWebhook(webhookId: string): boolean {
    return this.webhooks.delete(webhookId);
  }

  static async processWebhookRequest(
    workflowId: string,
    environment: 'test' | 'production',
    method: string,
    headers: Record<string, string>,
    body: any,
    sourceIp: string
  ): Promise<{ statusCode: number; body: any; executionId?: string }> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Find webhook
    const webhook = Array.from(this.webhooks.values()).find(
      w => w.workflowId === workflowId && w.environment === environment && w.isActive
    );

    if (!webhook) {
      return {
        statusCode: 404,
        body: { error: 'Webhook not found or inactive' }
      };
    }

    // Log request
    const request: WebhookRequest = {
      id: requestId,
      webhookId: webhook.id,
      method,
      headers,
      body,
      timestamp: new Date().toISOString(),
      sourceIp,
      userAgent: headers['user-agent']
    };
    this.requests.set(requestId, request);

    try {
      // Validate webhook signature if secret key is present
      if (webhook.secretKey && headers['x-webhook-signature']) {
        const isValid = this.validateWebhookSignature(
          JSON.stringify(body),
          headers['x-webhook-signature'],
          webhook.secretKey
        );
        
        if (!isValid) {
          const response = this.createResponse(requestId, 401, { error: 'Invalid signature' }, startTime);
          return { statusCode: response.statusCode, body: response.body };
        }
      }

      // Execute workflow
      const executionResult = await WorkflowEngine.executeWorkflowFromWebhook(
        workflowId,
        body,
        headers
      );

      // Update webhook stats
      webhook.lastTriggered = new Date().toISOString();
      webhook.triggerCount++;

      const responseBody = {
        success: executionResult.success,
        executionId: executionResult.executionId,
        message: executionResult.success ? 'Workflow executed successfully' : 'Workflow execution failed',
        error: executionResult.error
      };

      const statusCode = executionResult.success ? 200 : 500;
      const response = this.createResponse(requestId, statusCode, responseBody, startTime, executionResult.executionId);

      return {
        statusCode: response.statusCode,
        body: response.body,
        executionId: executionResult.executionId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const response = this.createResponse(requestId, 500, { error: errorMessage }, startTime);
      
      return {
        statusCode: response.statusCode,
        body: response.body
      };
    }
  }

  private static createResponse(
    requestId: string,
    statusCode: number,
    body: any,
    startTime: number,
    executionId?: string
  ): WebhookResponse {
    const response: WebhookResponse = {
      id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId,
      statusCode,
      body,
      executionId,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    this.responses.set(response.id, response);
    return response;
  }

  private static generateSecretKey(): string {
    return `whsec_${Math.random().toString(36).substr(2, 32)}`;
  }

  private static validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // In a real implementation, you would use HMAC-SHA256 to validate the signature
    // For now, we'll just do a simple check
    const expectedSignature = `sha256=${Buffer.from(payload + secret).toString('base64')}`;
    return signature === expectedSignature;
  }

  static getWebhookRequests(webhookId: string, limit: number = 50): WebhookRequest[] {
    return Array.from(this.requests.values())
      .filter(req => req.webhookId === webhookId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  static getWebhookResponses(requestId: string): WebhookResponse[] {
    return Array.from(this.responses.values()).filter(res => res.requestId === requestId);
  }

  static getWebhookStats(webhookId: string): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageProcessingTime: number;
    lastTriggered?: string;
  } {
    const webhook = this.webhooks.get(webhookId);
    const requests = this.getWebhookRequests(webhookId);
    const responses = requests.flatMap(req => this.getWebhookResponses(req.id));

    const successfulRequests = responses.filter(res => res.statusCode >= 200 && res.statusCode < 300).length;
    const failedRequests = responses.filter(res => res.statusCode >= 400).length;
    const averageProcessingTime = responses.length > 0 
      ? responses.reduce((sum, res) => sum + res.processingTime, 0) / responses.length 
      : 0;

    return {
      totalRequests: requests.length,
      successfulRequests,
      failedRequests,
      averageProcessingTime,
      lastTriggered: webhook?.lastTriggered
    };
  }

  static testWebhook(webhookId: string, testPayload: any = {}): Promise<{
    success: boolean;
    statusCode: number;
    response: any;
    processingTime: number;
  }> {
    return new Promise((resolve) => {
      const webhook = this.webhooks.get(webhookId);
      if (!webhook) {
        resolve({
          success: false,
          statusCode: 404,
          response: { error: 'Webhook not found' },
          processingTime: 0
        });
        return;
      }

      const startTime = Date.now();
      
      // Simulate webhook call
      this.processWebhookRequest(
        webhook.workflowId,
        webhook.environment,
        'POST',
        { 'content-type': 'application/json' },
        testPayload || { test: true, timestamp: new Date().toISOString() },
        '127.0.0.1'
      ).then(result => {
        resolve({
          success: result.statusCode >= 200 && result.statusCode < 300,
          statusCode: result.statusCode,
          response: result.body,
          processingTime: Date.now() - startTime
        });
      }).catch(error => {
        resolve({
          success: false,
          statusCode: 500,
          response: { error: error.message },
          processingTime: Date.now() - startTime
        });
      });
    });
  }

  static regenerateWebhookUrl(webhookId: string): WebhookEndpoint | null {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;

    // Generate new secret key
    webhook.secretKey = this.generateSecretKey();
    
    return webhook;
  }

  static exportWebhookLogs(webhookId: string): {
    webhook: WebhookEndpoint;
    requests: WebhookRequest[];
    responses: WebhookResponse[];
    stats: any;
  } | null {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;

    const requests = this.getWebhookRequests(webhookId);
    const responses = requests.flatMap(req => this.getWebhookResponses(req.id));
    const stats = this.getWebhookStats(webhookId);

    return {
      webhook,
      requests,
      responses,
      stats
    };
  }

  static clearOldLogs(olderThanDays: number = 30): number {
    const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let cleared = 0;

    // Clear old requests
    for (const [id, request] of this.requests.entries()) {
      if (new Date(request.timestamp) < cutoffTime) {
        this.requests.delete(id);
        cleared++;
      }
    }

    // Clear old responses
    for (const [id, response] of this.responses.entries()) {
      if (new Date(response.timestamp) < cutoffTime) {
        this.responses.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}
