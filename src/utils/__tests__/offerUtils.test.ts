/**
 * Test file to verify offer expiration logic
 * This demonstrates how the offer expiration works
 */

import { isOfferExpired, getTimeRemaining, getFormattedOfferEndDate, OFFER_END_DATE } from '../offerUtils';

// Mock the current date for testing
const mockDate = (dateString: string) => {
  const mockDateInstance = new Date(dateString);
  const originalDate = Date;

  // Mock Date constructor
  global.Date = jest.fn(() => mockDateInstance) as any;

  // Mock Date.now()
  global.Date.now = jest.fn(() => mockDateInstance.getTime());

  // Copy static methods from original Date
  Object.setPrototypeOf(global.Date, originalDate);
};

describe('Offer Utils', () => {
  const originalDate = Date;

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  describe('isOfferExpired', () => {
    it('should return false when current date is before June 7, 2025', () => {
      // Mock date to be before the offer expires
      mockDate('2025-06-06T12:00:00');
      expect(isOfferExpired()).toBe(false);
    });

    it('should return true when current date is after June 7, 2025', () => {
      // Mock date to be after the offer expires
      mockDate('2025-06-08T12:00:00');
      expect(isOfferExpired()).toBe(true);
    });

    it('should return true when current date is exactly at expiration time', () => {
      // Mock date to be exactly at expiration
      mockDate('2025-06-07T23:59:59');
      expect(isOfferExpired()).toBe(false);

      // One second later
      mockDate('2025-06-08T00:00:00');
      expect(isOfferExpired()).toBe(true);
    });
  });

  describe('getTimeRemaining', () => {
    it('should return correct time remaining when offer is active', () => {
      // Mock date to be 1 day before expiration
      mockDate('2025-06-06T23:59:59');
      const timeRemaining = getTimeRemaining();

      expect(timeRemaining.days).toBe(1);
      expect(timeRemaining.hours).toBe(0);
      expect(timeRemaining.minutes).toBe(0);
      expect(timeRemaining.seconds).toBe(0);
    });

    it('should return zeros when offer has expired', () => {
      // Mock date to be after expiration
      mockDate('2025-06-08T12:00:00');
      const timeRemaining = getTimeRemaining();

      expect(timeRemaining.days).toBe(0);
      expect(timeRemaining.hours).toBe(0);
      expect(timeRemaining.minutes).toBe(0);
      expect(timeRemaining.seconds).toBe(0);
    });
  });

  describe('getFormattedOfferEndDate', () => {
    it('should return properly formatted date', () => {
      const formattedDate = getFormattedOfferEndDate();
      expect(formattedDate).toBe('June 7, 2025');
    });
  });

  describe('OFFER_END_DATE constant', () => {
    it('should be set to June 7, 2025', () => {
      expect(OFFER_END_DATE).toBe('2025-06-07T23:59:59');
    });
  });
});
