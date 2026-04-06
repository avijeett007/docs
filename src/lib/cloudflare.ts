/**
 * Cloudflare API integration for SSL for SaaS
 */

import { logger } from './logger';

/**
 * Add a custom hostname to Cloudflare SSL for SaaS
 * @param domain The custom domain to add
 * @returns The Cloudflare API response
 */
export async function addCustomHostname(domain: string): Promise<CloudflareResponse<CustomHostname>> {
  try {
    // Simplified request body with only the essential fields
    const requestBody = {
      hostname: domain,
      ssl: {
        method: 'http',
        type: 'dv'
      }
    };

    logger.info('Cloudflare API request', {
      operation: 'cloudflare',
      action: 'add_custom_hostname',
      domain,
      requestBody
    });

    // We'll store the subdomain in our database but won't use custom_origin_server
    // since it requires Enterprise SSL for SaaS
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Cloudflare API error', new Error(`${response.status} ${response.statusText}`), {
        operation: 'cloudflare',
        action: 'add_custom_hostname',
        domain,
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });

      try {
        // Try to parse the error as JSON
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          errors: errorJson.errors || [{ message: 'Unknown error' }],
          messages: errorJson.messages || [],
          result: null as any
        };
      } catch (parseError) {
        // If we can't parse the error as JSON, return a generic error
        return {
          success: false,
          errors: [{ message: `HTTP error: ${response.status} ${response.statusText}` }],
          messages: [],
          result: null as any
        };
      }
    }

    // Parse the successful response
    const jsonResponse = await response.json();
    logger.info('Cloudflare API response', {
      operation: 'cloudflare',
      action: 'add_custom_hostname',
      domain,
      success: jsonResponse.success,
      hostnameId: jsonResponse.result?.id
    });
    return jsonResponse;
  } catch (error) {
    logger.error('Error adding custom hostname to Cloudflare', error as Error, {
      operation: 'cloudflare',
      action: 'add_custom_hostname',
      domain
    });

    // Return a structured error response
    return {
      success: false,
      errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      messages: [],
      result: null as any
    };
  }
}

/**
 * Check the status of a custom hostname
 * @param hostnameId The Cloudflare hostname ID
 * @returns The Cloudflare API response
 */
export async function getCustomHostnameStatus(hostnameId: string): Promise<CloudflareResponse<CustomHostname>> {
  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Cloudflare API error', new Error(`${response.status} ${response.statusText}`), {
        operation: 'cloudflare',
        action: 'check_custom_hostname',
        hostnameId,
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });

      try {
        // Try to parse the error as JSON
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          errors: errorJson.errors || [{ message: 'Unknown error' }],
          messages: errorJson.messages || [],
          result: null as any
        };
      } catch (parseError) {
        // If we can't parse the error as JSON, return a generic error
        return {
          success: false,
          errors: [{ message: `HTTP error: ${response.status} ${response.statusText}` }],
          messages: [],
          result: null as any
        };
      }
    }

    // Parse the successful response
    const jsonResponse = await response.json();
    return jsonResponse;
  } catch (error) {
    logger.error('Error checking custom hostname status', error as Error, {
      operation: 'cloudflare',
      action: 'check_custom_hostname',
      hostnameId
    });

    // Return a structured error response
    return {
      success: false,
      errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      messages: [],
      result: null as any
    };
  }
}

/**
 * Delete a custom hostname
 * @param hostnameId The Cloudflare hostname ID
 * @returns The Cloudflare API response
 */
export async function deleteCustomHostname(hostnameId: string): Promise<CloudflareResponse<any>> {
  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames/${hostnameId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Cloudflare API error', new Error(`${response.status} ${response.statusText}`), {
        operation: 'cloudflare',
        action: 'delete_custom_hostname',
        hostnameId,
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });

      try {
        // Try to parse the error as JSON
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          errors: errorJson.errors || [{ message: 'Unknown error' }],
          messages: errorJson.messages || [],
          result: null as any
        };
      } catch (parseError) {
        // If we can't parse the error as JSON, return a generic error
        return {
          success: false,
          errors: [{ message: `HTTP error: ${response.status} ${response.statusText}` }],
          messages: [],
          result: null as any
        };
      }
    }

    // Parse the successful response
    const jsonResponse = await response.json();
    return jsonResponse;
  } catch (error) {
    logger.error('Error deleting custom hostname', error as Error, {
      operation: 'cloudflare',
      action: 'delete_custom_hostname',
      hostnameId
    });

    // Return a structured error response
    return {
      success: false,
      errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      messages: [],
      result: null as any
    };
  }
}

/**
 * List all custom hostnames
 * @returns The Cloudflare API response
 */
export async function listCustomHostnames(): Promise<CloudflareResponse<CustomHostname[]>> {
  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?per_page=50`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Check if the response is OK
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Cloudflare API error', new Error(`${response.status} ${response.statusText}`), {
        operation: 'cloudflare',
        action: 'list_custom_hostnames',
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });

      try {
        // Try to parse the error as JSON
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          errors: errorJson.errors || [{ message: 'Unknown error' }],
          messages: errorJson.messages || [],
          result: null as any
        };
      } catch (parseError) {
        // If we can't parse the error as JSON, return a generic error
        return {
          success: false,
          errors: [{ message: `HTTP error: ${response.status} ${response.statusText}` }],
          messages: [],
          result: null as any
        };
      }
    }

    // Parse the successful response
    const jsonResponse = await response.json();
    return jsonResponse;
  } catch (error) {
    logger.error('Error listing custom hostnames', error as Error, {
      operation: 'cloudflare',
      action: 'list_custom_hostnames'
    });

    // Return a structured error response
    return {
      success: false,
      errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      messages: [],
      result: null as any
    };
  }
}

// Constants
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

// Types
export interface CloudflareResponse<T> {
  success: boolean;
  errors: any[];
  messages: any[];
  result: T;
}

export interface CustomHostname {
  id: string;
  hostname: string;
  ssl: {
    status: string;
    method: string;
    type: string;
    settings: {
      min_tls_version: string;
    };
    validation_records: {
      txt_name: string;
      txt_value: string;
    }[];
  };
  status: string;
  verification_errors: string[];
  ownership_verification: {
    type: string;
    name: string;
    value: string;
  };
  created_at: string;
  custom_metadata?: Record<string, string>;
}
