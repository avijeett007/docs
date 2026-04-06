import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic'; // Required because this route uses cookies

export async function GET(_req: NextRequest) {
  try {
    // Get the cookie header from the request
    const cookieStore = cookies();
    const supabaseCookie = cookieStore.get('sb-knotie-pro-auth-token')?.value;

    if (!supabaseCookie) {
      console.error('Admin authentication failed: No supabase cookie found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create a Supabase client with the cookie - SECURITY: Use server-side only variables
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            cookie: `sb-knotie-pro-auth-token=${supabaseCookie}`,
          },
        },
      }
    );

    // Verify the admin user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Admin authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Admin user authenticated successfully:', user.email);

    // Fetch AI agents from the database
    // In a real implementation, you would query your database for AI agent data
    // For now, we'll return mock data
    const mockAgents = [
      {
        id: '1',
        name: 'Customer Service Agent',
        description: 'Handles general customer inquiries and support requests',
        status: 'active',
        createdAt: '2025-03-10T10:00:00Z',
        lastModified: '2025-04-01T14:30:00Z',
        voiceType: 'female',
        language: 'English',
        usageCount: 1245
      },
      {
        id: '2',
        name: 'Sales Representative',
        description: 'Handles product inquiries and sales processes',
        status: 'active',
        createdAt: '2025-03-12T11:15:00Z',
        lastModified: '2025-03-30T09:45:00Z',
        voiceType: 'male',
        language: 'English',
        usageCount: 987
      }
    ];

    // Return the AI agents data
    return NextResponse.json({ agents: mockAgents });
  } catch (error) {
    console.error('Error in AI agents API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
