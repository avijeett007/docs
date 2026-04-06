import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/admin-route-protection';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const DEFAULT_BUCKET = 'files';

// GET /api/admin/partners/[id]/phone-activations/download?path=...
// Generates a signed URL for downloading a phone activation document from Supabase Storage
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await protectAdminRoute(request);
    if (authResult) return authResult;

    const storagePath = request.nextUrl.searchParams.get('path');

    if (!storagePath) {
      return NextResponse.json(
        { error: 'Missing path parameter' },
        { status: 400 }
      );
    }

    // Security: ensure the storage path belongs to this partner
    const partnerId = params.id;
    if (!storagePath.startsWith(`${partnerId}/`)) {
      return NextResponse.json(
        { error: 'Access denied: document does not belong to this partner' },
        { status: 403 }
      );
    }

    // Generate a signed URL valid for 1 hour
    const { data, error } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      console.error('Failed to generate signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        url: data.signedUrl,
      },
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}

