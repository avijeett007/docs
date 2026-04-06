import { NextRequest, NextResponse } from 'next/server';
import { enforceAdminMFA } from '@/lib/admin-mfa-enforcement';

/**
 * Middleware to protect Mission Control API routes with MFA enforcement
 * Usage: Call this at the beginning of any protected API route
 */
export async function protectAdminRoute(request: NextRequest): Promise<NextResponse | null> {
  const mfaResult = await enforceAdminMFA(request);
  
  if (!mfaResult.success) {
    if (mfaResult.mfaRequired) {
      // MFA verification required
      return NextResponse.json(
        { 
          error: mfaResult.error,
          mfaRequired: true,
          user: mfaResult.user
        },
        { status: 403 }
      );
    }
    
    // Authentication failed
    return NextResponse.json(
      { error: mfaResult.error },
      { status: 401 }
    );
  }
  
  // Access granted - return null to continue with the route handler
  return null;
}

/**
 * Higher-order function to wrap API route handlers with MFA protection
 */
export function withAdminMFAProtection(
  handler: (request: NextRequest, mfaResult: any) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const protectionResult = await protectAdminRoute(request);
    
    if (protectionResult) {
      // Protection failed, return the error response
      return protectionResult;
    }
    
    // Get the MFA result for the handler
    const mfaResult = await enforceAdminMFA(request);
    
    // Call the original handler with the MFA result
    return handler(request, mfaResult);
  };
}
