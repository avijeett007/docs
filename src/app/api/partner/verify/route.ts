import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return new NextResponse('User ID is required', { status: 400 });
    }

    // Check if the user is a partner
    const partner = await prisma.partner.findFirst({
      where: {
        emailAddress: userId,
      },
    });

    if (!partner) {
      return new NextResponse('Not a partner', { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying partner:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
