import { NextResponse, NextRequest } from 'next/server';
import { saveUserAnswers, getUserAnswers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { userId, answers } = data;

    if (!userId || !answers) {
      return NextResponse.json(
        { error: 'userId and answers are required' },
        { status: 400 }
      );
    }

    const result = await saveUserAnswers({ userId, answers });
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error in user-answers PUT:', error);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    const result = await getUserAnswers(userId);
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error in user-answers GET:', error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
