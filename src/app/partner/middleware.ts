import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

export async function middleware(request: NextRequest) {
  // Skip the change-password page itself
  if (request.nextUrl.pathname === '/partner/change-password') {
    return NextResponse.next();
  }

  const token = request.cookies.get('partner_token')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/partner/login', request.url));
  }

  try {
    const payload = await verifyJWT(token);
    
    if (!payload) {
      return NextResponse.redirect(new URL('/partner/login', request.url));
    }

    // If password hasn't been changed and trying to access other partner pages
    if (!payload.hasChangedPassword && request.nextUrl.pathname.startsWith('/partner/')) {
      return NextResponse.redirect(new URL('/partner/change-password', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // Invalid token, redirect to login
    return NextResponse.redirect(new URL('/partner/login', request.url));
  }
}

export const config = {
  matcher: ['/partner/:path*'],
};
