/**
 * Utility functions for managing the limited-time offer
 */

// The exact end date and time for the limited offer
export const OFFER_END_DATE = '2025-06-01T23:59:59';

/**
 * Check if the limited-time offer has expired
 * @returns {boolean} True if the offer has expired, false otherwise
 */
export const isOfferExpired = (): boolean => {
  const targetDate = new Date(OFFER_END_DATE).getTime();
  const now = new Date().getTime();
  return now > targetDate;
};

/**
 * Get the time remaining until the offer expires
 * @returns {object} Object containing days, hours, minutes, and seconds remaining
 */
export const getTimeRemaining = () => {
  const targetDate = new Date(OFFER_END_DATE).getTime();
  const now = new Date().getTime();
  const difference = targetDate - now;

  if (difference > 0) {
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  } else {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
};

/**
 * Format the offer end date for display
 * @returns {string} Formatted date string
 */
export const getFormattedOfferEndDate = (): string => {
  return new Date(OFFER_END_DATE).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
