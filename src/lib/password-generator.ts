import crypto from 'crypto';

export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each required character type
  password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // uppercase
  password += getRandomChar('abcdefghijklmnopqrstuvwxyz'); // lowercase
  password += getRandomChar('0123456789'); // number
  password += getRandomChar('!@#$%^&*'); // special char
  
  // Fill the rest with random characters
  while (password.length < length) {
    password += charset[crypto.randomInt(0, charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function getRandomChar(charset: string): string {
  return charset[crypto.randomInt(0, charset.length)];
}
