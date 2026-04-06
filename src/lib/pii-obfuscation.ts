/**
 * PII (Personally Identifiable Information) Obfuscation Utilities
 * 
 * This module provides functions to safely obfuscate sensitive data in logs
 * while maintaining enough information for debugging purposes.
 */

export interface ObfuscationOptions {
  /** Show first N characters */
  showFirst?: number;
  /** Show last N characters */
  showLast?: number;
  /** Character to use for masking */
  maskChar?: string;
  /** Minimum length before obfuscation kicks in */
  minLength?: number;
}

/**
 * Obfuscate a phone number for logging
 * Example: +447476941501 -> +44****1501
 */
export function obfuscatePhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return 'N/A';
  
  // Keep country code and last 4 digits visible
  if (phoneNumber.length <= 6) {
    return phoneNumber.replace(/./g, '*');
  }
  
  const countryCodeLength = phoneNumber.startsWith('+') ? 3 : 2; // +44 or 44
  const visibleStart = phoneNumber.substring(0, countryCodeLength);
  const visibleEnd = phoneNumber.substring(phoneNumber.length - 4);
  const maskedLength = phoneNumber.length - countryCodeLength - 4;
  
  return `${visibleStart}${'*'.repeat(maskedLength)}${visibleEnd}`;
}

/**
 * Obfuscate a person's name for logging
 * Example: "Davis Conda" -> "D**** C****"
 */
export function obfuscateName(name: string | null | undefined): string {
  if (!name || name.trim() === '') return 'N/A';
  
  const trimmedName = name.trim();
  
  // Handle single names
  if (!trimmedName.includes(' ')) {
    if (trimmedName.length <= 1) return trimmedName;
    return `${trimmedName[0]}${'*'.repeat(trimmedName.length - 1)}`;
  }
  
  // Handle multiple names (first last, or first middle last, etc.)
  const nameParts = trimmedName.split(' ').filter(part => part.length > 0);
  
  return nameParts.map(part => {
    if (part.length <= 1) return part;
    return `${part[0]}${'*'.repeat(part.length - 1)}`;
  }).join(' ');
}

/**
 * Obfuscate an email address for logging
 * Example: "user@example.com" -> "u***@e******.com"
 */
export function obfuscateEmail(email: string | null | undefined): string {
  if (!email) return 'N/A';
  
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email.replace(/./g, '*');
  
  const obfuscatedLocal = localPart.length <= 1 
    ? localPart 
    : `${localPart[0]}${'*'.repeat(localPart.length - 1)}`;
  
  const domainParts = domain.split('.');
  const obfuscatedDomain = domainParts.map((part, index) => {
    // Keep TLD visible (.com, .org, etc.)
    if (index === domainParts.length - 1) return part;
    
    return part.length <= 1 
      ? part 
      : `${part[0]}${'*'.repeat(part.length - 1)}`;
  }).join('.');
  
  return `${obfuscatedLocal}@${obfuscatedDomain}`;
}

/**
 * Obfuscate a UUID/ID for logging (show first 8 and last 4 characters)
 * Example: "eb36cbc2-7ccd-401c-9163-7a35bc3e4477" -> "eb36cbc2-****-****-****-****bc3e4477"
 */
export function obfuscateId(id: string | null | undefined): string {
  if (!id) return 'N/A';
  
  if (id.length <= 12) {
    // For short IDs, show first 4 and last 4
    const visibleLength = Math.min(4, Math.floor(id.length / 3));
    return `${id.substring(0, visibleLength)}${'*'.repeat(id.length - visibleLength * 2)}${id.substring(id.length - visibleLength)}`;
  }
  
  // For UUIDs and longer IDs
  return `${id.substring(0, 8)}****-****-****-****${id.substring(id.length - 4)}`;
}

/**
 * Generic obfuscation function with customizable options
 */
export function obfuscateGeneric(
  value: string | null | undefined, 
  options: ObfuscationOptions = {}
): string {
  if (!value) return 'N/A';
  
  const {
    showFirst = 2,
    showLast = 2,
    maskChar = '*',
    minLength = 4
  } = options;
  
  if (value.length < minLength) {
    return maskChar.repeat(value.length);
  }
  
  const visibleStart = value.substring(0, showFirst);
  const visibleEnd = value.substring(value.length - showLast);
  const maskedLength = Math.max(0, value.length - showFirst - showLast);
  
  return `${visibleStart}${maskChar.repeat(maskedLength)}${visibleEnd}`;
}

/**
 * Obfuscate multiple PII fields in a structured way for debug logging
 */
export function obfuscateDebugData(data: {
  phoneNumber?: string;
  customerName?: string;
  email?: string;
  partnerId?: string;
  customerId?: string;
  [key: string]: any;
}) {
  return {
    ...data,
    phoneNumber: data.phoneNumber ? obfuscatePhoneNumber(data.phoneNumber) : undefined,
    customerName: data.customerName ? obfuscateName(data.customerName) : undefined,
    email: data.email ? obfuscateEmail(data.email) : undefined,
    partnerId: data.partnerId ? obfuscateId(data.partnerId) : undefined,
    customerId: data.customerId ? obfuscateId(data.customerId) : undefined,
  };
}

/**
 * Create a debug-safe version of customer data for logging
 */
export function createDebugSafeCustomer(customer: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  id?: string;
  [key: string]: any;
}) {
  const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  
  return {
    ...customer,
    firstName: customer.firstName ? obfuscateName(customer.firstName) : null,
    lastName: customer.lastName ? obfuscateName(customer.lastName) : null,
    fullName: fullName ? obfuscateName(fullName) : 'N/A',
    email: customer.email ? obfuscateEmail(customer.email) : null,
    id: customer.id ? obfuscateId(customer.id) : undefined,
  };
}
