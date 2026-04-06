import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { sendEmail, sendWaitlistEmail } from '@/lib/email';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const { name, email, referralCode } = await req.json();

    // Basic validation
    if (!name || !email) {
      return NextResponse.json(
        { message: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Check if email already exists in the waitlist
    const existingUser = await prisma.waitlist.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'This email is already on our waitlist' },
        { status: 409 }
      );
    }

    // Generate unique referral code
    const newReferralCode = nanoid(8);
    
    // Get the current count of waitlist entries to calculate position
    const waitlistCount = await prisma.waitlist.count();
    
    // Default position at the end of the waitlist
    let position = waitlistCount + 1;
    let referredByUserId = null;
    
    // If user was referred, update the referring user's referral count and adjust position
    if (referralCode) {
      const referringUser = await prisma.waitlist.findUnique({
        where: { referralCode },
      });
      
      if (referringUser) {
        // Update the referring user's referral count
        await prisma.waitlist.update({
          where: { id: referringUser.id },
          data: { 
            referralCount: { increment: 1 },
            // Improve their position by 5 for each referral as mentioned in the email template
            position: {
              decrement: 5
            }
          },
        });
        
        // Store the referring user's ID
        referredByUserId = referringUser.id;
        
        // Position boost for being referred
        position = waitlistCount; // One position better than default
      }
    }
    
    // Rebalance positions if needed (ensure no negative or duplicate positions)
    await rebalancePositions();

    // Add to waitlist database
    const newWaitlistEntry = await prisma.waitlist.create({
      data: {
        name,
        email,
        source: referralCode ? 'referral' : 'landing_page',
        referralCode: newReferralCode,
        referredBy: referredByUserId,
        position,
      },
    });

    // Send waitlist confirmation email using new function
    try {
      await sendWaitlistEmail({
        to: email,
        name,
        position,
        referralCode: newReferralCode
      });
    } catch (emailError) {
      console.error('Failed to send waitlist email:', emailError);
      // We still want to return success even if the email fails
    }

    // Optional: Send notification to admin about new waitlist sign-up
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@knotie.ai',
        subject: 'New Waitlist Signup',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <h2>New Waitlist Signup</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Position:</strong> #${position}</p>
            <p><strong>Referral Code:</strong> ${newReferralCode}</p>
            <p><strong>Referred By:</strong> ${referredByUserId || 'N/A'}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Source:</strong> ${referralCode ? 'referral' : 'landing_page'}</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // We still want to return success even if the email fails
    }

    return NextResponse.json(
      { 
        message: 'Successfully added to waitlist', 
        id: newWaitlistEntry.id,
        position,
        referralCode: newReferralCode
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in waitlist API:', error);
    return NextResponse.json(
      { message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Helper function to rebalance positions and ensure no duplicates or negatives
async function rebalancePositions() {
  // Get all waitlist entries sorted by position
  const allEntries = await prisma.waitlist.findMany({
    orderBy: { position: 'asc' },
  });
  
  // Check if any positions are negative or duplicate
  let needsRebalancing = false;
  const positions = new Set<number>();
  
  for (const entry of allEntries) {
    if (entry.position <= 0 || positions.has(entry.position)) {
      needsRebalancing = true;
      break;
    }
    positions.add(entry.position);
  }
  
  // If rebalancing is needed, reassign positions sequentially
  if (needsRebalancing) {
    for (let i = 0; i < allEntries.length; i++) {
      await prisma.waitlist.update({
        where: { id: allEntries[i].id },
        data: { position: i + 1 },
      });
    }
  }
}
