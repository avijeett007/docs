import { headers } from 'next/headers';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || '';

async function syncWithGHL(email: string, firstName: string, userId: string) {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_BASE_URL = process.env.NEXT_PUBLIC_GOHIGHLEVEL_API_URL;

  if (!GHL_API_KEY || !GHL_BASE_URL) {
    console.log('GHL integration not configured, skipping sync');
    return { action: 'skipped' };
  }

  try {
    // First check if contact exists
    const lookupResponse = await fetch(
      `${GHL_BASE_URL}/contacts/lookup?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
        },
      }
    );

    if (!lookupResponse.ok) {
      const errorText = await lookupResponse.text();
      console.error('GHL API Error:', errorText);
      return { action: 'error', error: errorText };
    }

    const lookupData = await lookupResponse.json();
  
    if (lookupData.contacts?.[0]) {
      const contact = lookupData.contacts[0];
      const currentTags = contact.tags || [];
      
      // Check if already registered
      if (currentTags.includes('knotie-ai-pro-registered')) {
        return {
          ghlContactId: contact.id,
          action: 'none'
        };
      }

      // Update existing contact
      const updateResponse = await fetch(`${GHL_BASE_URL}/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tags: [...currentTags, 'knotie-ai-pro-registered'],
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('GHL API Error:', errorText);
        return { action: 'error', error: errorText };
      }

      return {
        ghlContactId: contact.id,
        action: 'updated'
      };
    }

    // Create new contact
    const createResponse = await fetch(`${GHL_BASE_URL}/contacts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        firstName,
        tags: ['knotie-ai-pro-registered'],
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('GHL API Error:', errorText);
      return { action: 'error', error: errorText };
    }

    const createData = await createResponse.json();
    return {
      ghlContactId: createData.contact?.id,
      action: 'created'
    };
  } catch (error) {
    console.error('GHL API Error:', error);
    return { action: 'error', error: String(error) };
  }
}

export async function POST(req: Request) {
  try {
    const headerPayload = headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Missing svix headers', { status: 400 });
    }

    const payload = await req.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(webhookSecret);
    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      return new Response('Invalid signature', { status: 400 });
    }

    // Handle user creation or sign in
    if (evt.type === 'user.created') {  
      const { id, email_addresses, first_name } = evt.data;
      const primaryEmail = email_addresses[0]?.email_address;

      if (!primaryEmail) {
        return new Response('No email address found', { status: 400 });
      }

      // Check if we've already processed this user
      const existingCustomer = await prisma.customer.findUnique({
        where: { userId: id }
      });

      if (existingCustomer) {
        return new Response('Customer already processed', { status: 200 });
      }

      // Create customer record first
      const customer = await prisma.customer.create({
        data: {
          userId: id,
          email: primaryEmail,
          firstName: first_name || null,
        },
      });

      // Start GHL sync in the background without waiting
      syncWithGHL(primaryEmail, first_name || '', id)
        .then(({ ghlContactId, action }) => {
          if (action !== 'error' && action !== 'skipped' && ghlContactId) {
            // Update customer with GHL contact ID if sync was successful
            return prisma.customer.update({
              where: { id: customer.id },
              data: {
                ghlContactId,
                isGhlSynced: true,
                ghlSyncedAt: new Date(),
              },
            });
          }
        })
        .catch(console.error); // Log any errors but don't block the response
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Webhook error', { status: 500 });
  }
}
