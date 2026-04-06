import { NextResponse, NextRequest } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { isAdmin, makeUserAdmin, removeAdminRole, listAdmins } from '@/lib/admin';
import { z } from 'zod';

const adminActionSchema = z.object({
  action: z.enum(['make-admin', 'remove-admin']),
  email: z.string().email()
});

export async function GET(request: NextRequest) {
  try {
    // Verify the current user is an admin
    const auth = await getAuth(request);
    if (!auth.userId || !(await isAdmin(auth.userId))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const admins = await listAdmins();
    return NextResponse.json(admins);
  } catch (error) {
    console.error('Error listing admins:', error);
    return NextResponse.json(
      { error: 'Failed to list admins' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email } = adminActionSchema.parse(body);

    // Verify the current user is an admin
    const auth = await getAuth(request);
    if (!auth.userId || !(await isAdmin(auth.userId))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (action === 'make-admin') {
      await makeUserAdmin(email);
      return NextResponse.json({ message: 'User promoted to admin' });
    } else {
      await removeAdminRole(email);
      return NextResponse.json({ message: 'Admin role removed' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
    console.error('Error handling admin action:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
