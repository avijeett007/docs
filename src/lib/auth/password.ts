import { compare, hash } from 'bcrypt';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await hash(password, saltRounds);
}

/**
 * Compare a plain text password with a hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await compare(password, hashedPassword);
}
