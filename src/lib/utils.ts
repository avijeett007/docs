import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}



/**
 * Generate a secure password with specified length and character types
 */
export function generateSecurePassword(length = 12): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed O and I to avoid confusion
  const lowercase = 'abcdefghijkmnopqrstuvwxyz'; // Removed l to avoid confusion
  const numbers = '23456789'; // Removed 0 and 1 to avoid confusion
  const symbols = '@#$%^&*!-_=+';

  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';

  // Ensure at least one character from each group
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));

  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the password to avoid predictable pattern
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) {
    return `${Math.round(seconds)}s`;
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  return `${mins}m ${secs}s`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date(date).toLocaleDateString(undefined, options);
}

/**
 * Format a file size in bytes to a human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Color utility functions for handling gradients and color manipulation
export function hexToRgba(hex: string, alpha: number = 1): string {
  // Remove the hash if it exists
  hex = hex.replace('#', '');

  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Return the rgba value
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createGradient(color1: string, color2: string, direction: string = 'to-r'): string {
  return `bg-gradient-${direction} from-[${color1}] to-[${color2}]`;
}

export function getTextGradient(color1: string, color2: string): string {
  return `text-transparent bg-clip-text bg-gradient-to-r from-[${color1}] to-[${color2}]`;
}
