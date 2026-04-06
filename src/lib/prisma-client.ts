/**
 * This file re-exports the Prisma client from db.ts to avoid import issues
 */
import { prisma, db } from './db';

export { prisma, db };
export default prisma;
