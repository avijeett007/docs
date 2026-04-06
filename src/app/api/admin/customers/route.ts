import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic'; // Required because this route uses cookies

export async function GET(_req: NextRequest) {
  try {
    // Get the cookie header from the request
    const cookieStore = cookies();

    // Create a Supabase client with the cookie store - SECURITY: Use server-side only variables
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            cookie: cookieStore.toString(),
          },
        },
      }
    );

    console.log('Authenticating admin user with cookie-based auth...');

    // Verify the admin user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Admin authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Admin user authenticated successfully:', user.email);

    // Fetch customers from the database
    // In a real implementation, you would query your database for customer data
    // For now, we'll return mock data
    const mockCustomers = [
      {
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        createdAt: '2025-03-15T10:00:00Z',
        status: 'active',
        partnerId: 'p1',
        partnerName: 'Acme Corp',
        lastActive: '2025-04-02T14:30:00Z'
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        createdAt: '2025-03-18T09:15:00Z',
        status: 'active',
        partnerId: 'p2',
        partnerName: 'XYZ Industries',
        lastActive: '2025-04-01T11:45:00Z'
      },
      {
        id: '3',
        name: 'Michael Brown',
        email: 'michael@example.com',
        createdAt: '2025-03-20T14:20:00Z',
        status: 'inactive',
        partnerId: 'p1',
        partnerName: 'Acme Corp',
        lastActive: '2025-03-25T16:10:00Z'
      }
    ];

    // Return the customers data
    return NextResponse.json({ customers: mockCustomers });
  } catch (error) {
    console.error('Error in customers API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
