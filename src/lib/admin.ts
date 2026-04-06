import { prisma } from './prisma';

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  return user?.role === 'admin';
}

export async function makeUserAdmin(email: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: { role: 'admin' }
  });
}

export async function removeAdminRole(email: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: { role: 'user' }
  });
}

export async function listAdmins() {
  return prisma.user.findMany({
    where: { role: 'admin' },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });
}
