/**
 * Generate a secure but memorable temporary password
 * Format: Word + Number + Special Character (e.g., "Sunset7!", "Ocean3#", "River9@")
 */
export function generateSecurePassword(): string {
  const words = [
    'Sunset', 'Ocean', 'River', 'Mountain', 'Forest', 'Garden', 'Bridge', 'Castle',
    'Diamond', 'Golden', 'Silver', 'Crystal', 'Thunder', 'Lightning', 'Rainbow', 'Starlight',
    'Phoenix', 'Dragon', 'Eagle', 'Tiger', 'Lion', 'Wolf', 'Bear', 'Falcon',
    'Harmony', 'Victory', 'Freedom', 'Journey', 'Adventure', 'Discovery', 'Wonder', 'Magic'
  ];
  
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const specialChars = ['!', '@', '#', '$', '%', '&', '*'];
  
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
  const randomSpecial = specialChars[Math.floor(Math.random() * specialChars.length)];
  
  return `${randomWord}${randomNumber}${randomSpecial}`;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
