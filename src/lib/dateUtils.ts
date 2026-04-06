import { logger } from './logger';

/**
 * Helper function to get default start date (7 days ago)
 */
export function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

/**
 * Helper function to format dates for the analytics API
 * @param isoDateString ISO date string to format
 * @param isStartDate Whether this is a start date (true) or end date (false)
 * @returns Formatted date string in YYYY-MM-DDThh:mm:ss format
 */
export function formatDateForAnalytics(isoDateString: string, isStartDate: boolean): string {
  try {
    const date = new Date(isoDateString);
    
    // Set to start or end of day if specified
    if (isStartDate) {
      date.setHours(0, 0, 0, 0); // Start of day
    } else {
      date.setHours(23, 59, 59, 0); // End of day
    }
    
    // Format as YYYY-MM-DDThh:mm:ss (without milliseconds)
    return date.toISOString().split('.')[0];
  } catch (error) {
    logger.error('Error formatting date', error as Error, {
      operation: 'date_utils',
      isoDateString,
      isStartDate
    });
    // Return a fallback date if parsing fails
    const fallback = new Date();
    if (isStartDate) {
      fallback.setDate(fallback.getDate() - 7);
      fallback.setHours(0, 0, 0, 0);
    } else {
      fallback.setHours(23, 59, 59, 0);
    }
    return fallback.toISOString().split('.')[0];
  }
}
