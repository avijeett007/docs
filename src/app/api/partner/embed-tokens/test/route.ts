import { NextRequest, NextResponse } from 'next/server';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

// Simple test endpoint to verify routing works
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Embed tokens test endpoint working',
    timestamp: new Date().toISOString(),
    url: request.url,
  });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: 'Embed tokens POST test endpoint working',
    timestamp: new Date().toISOString(),
    url: request.url,
  });
}
