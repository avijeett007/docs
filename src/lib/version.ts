/**
 * Version utility for Knotie-AI Pro
 *
 * This module provides functions to get the current application version
 * from package.json or environment variables.
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Get the server version from package.json or environment variable
 * @returns The current application version
 */
export function getServerVersion(): string {
  try {
    // First try to get version from environment variable (useful for containerized deployments)
    if (process.env.APP_VERSION) {
      return process.env.APP_VERSION;
    }
    
    // Otherwise, try to read from package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || '0.0.0';
    }
    
    return '0.0.0';
  } catch (error) {
    logger.error('Error getting server version', error as Error, {
      operation: 'version'
    });
    return '0.0.0';
  }
}
