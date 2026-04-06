/**
 * Phone Number Validation Utility
 * Uses libphonenumber-js for international phone number validation
 * Supports all countries globally
 */

import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  isPossiblePhoneNumber,
  CountryCode,
  PhoneNumber,
} from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  isPossible: boolean;
  formattedNumber: string | null;
  e164Format: string | null;
  countryCode: string | null;
  nationalNumber: string | null;
  error: string | null;
}

/**
 * Validates a phone number and returns detailed validation result
 * @param phoneNumber - The phone number to validate (can include country code)
 * @param defaultCountry - Optional default country code (e.g., 'US', 'IN', 'GB')
 * @returns PhoneValidationResult with validation details
 */
export function validatePhoneNumber(
  phoneNumber: string,
  defaultCountry?: CountryCode
): PhoneValidationResult {
  const result: PhoneValidationResult = {
    isValid: false,
    isPossible: false,
    formattedNumber: null,
    e164Format: null,
    countryCode: null,
    nationalNumber: null,
    error: null,
  };

  if (!phoneNumber || phoneNumber.trim() === '') {
    result.error = 'Phone number is required';
    return result;
  }

  try {
    // Clean the phone number - keep only digits and + sign
    let cleanedNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with + for international format
    if (!cleanedNumber.startsWith('+')) {
      cleanedNumber = '+' + cleanedNumber;
    }

    // Parse the phone number
    const parsed: PhoneNumber | undefined = parsePhoneNumberFromString(
      cleanedNumber,
      defaultCountry
    );

    if (!parsed) {
      result.error = 'Invalid phone number format';
      return result;
    }

    // Check if the number is possible (correct length for the country)
    result.isPossible = parsed.isPossible();
    
    // Check if the number is valid (correct format for the country)
    result.isValid = parsed.isValid();

    if (!result.isPossible) {
      result.error = 'Phone number has incorrect length for this country';
      return result;
    }

    if (!result.isValid) {
      result.error = 'Phone number format is invalid for this country';
      return result;
    }

    // Get formatted versions
    result.formattedNumber = parsed.formatInternational();
    result.e164Format = parsed.format('E.164');
    result.countryCode = parsed.country || null;
    result.nationalNumber = parsed.nationalNumber || null;

    return result;
  } catch (error) {
    result.error = 'Unable to validate phone number';
    return result;
  }
}

/**
 * Simple validation check - returns true if phone number is valid
 * @param phoneNumber - The phone number to validate
 * @param defaultCountry - Optional default country code
 * @returns boolean indicating if the phone number is valid
 */
export function isPhoneNumberValid(
  phoneNumber: string,
  defaultCountry?: CountryCode
): boolean {
  const result = validatePhoneNumber(phoneNumber, defaultCountry);
  return result.isValid;
}

/**
 * Formats a phone number to E.164 format (e.g., +14155552671)
 * @param phoneNumber - The phone number to format
 * @param defaultCountry - Optional default country code
 * @returns E.164 formatted number or null if invalid
 */
export function formatToE164(
  phoneNumber: string,
  defaultCountry?: CountryCode
): string | null {
  const result = validatePhoneNumber(phoneNumber, defaultCountry);
  return result.e164Format;
}

/**
 * Gets a user-friendly error message for phone validation
 * @param phoneNumber - The phone number to validate
 * @returns Error message or null if valid
 */
export function getPhoneValidationError(phoneNumber: string): string | null {
  const result = validatePhoneNumber(phoneNumber);
  return result.error;
}

