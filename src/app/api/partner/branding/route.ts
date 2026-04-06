import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { DomainCacheInvalidationService } from '@/lib/domain-cache-invalidation';

export async function POST(request: NextRequest) {
  try {
    // Verify token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ message: 'Server error: JWT secret not configured' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, jwtSecret) as { partnerId: string };
    } catch (error) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const partnerId = decodedToken.partnerId;

    // Get partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      return NextResponse.json({ message: 'Partner not found' }, { status: 404 });
    }

    // Process form data
    const formData = await request.formData();
    
    // Extract branding data
    const primaryColor = formData.get('primaryColor') as string;
    const secondaryColor = formData.get('secondaryColor') as string;
    const fontFamily = formData.get('fontFamily') as string;
    const portalTitle = formData.get('portalTitle') as string;
    const portalSlogan = formData.get('portalSlogan') as string;
    const logoFileEntry = formData.get('logo');
    const logoFile = (logoFileEntry && typeof logoFileEntry !== 'string') ? logoFileEntry as File : null;
    const removeLogo = formData.get('removeLogo') === 'true';

    // Prepare update data
    const updateData: any = {
      primaryColor,
      secondaryColor,
      fontFamily,
      portalTitle,
      portalSlogan,
    };

    // Handle logo upload if provided
    if (logoFile) {
      // Convert logo to base64
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Logo = `data:${logoFile.type};base64,${buffer.toString('base64')}`;
      
      // Set the logo as base64 string
      updateData.logo = base64Logo;
    } else if (removeLogo) {
      // If removeLogo is true, set logo to null
      updateData.logo = null;
    }

    // Update partner in database
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: updateData,
    });

    // Invalidate domain cache for branding changes
    try {
      await DomainCacheInvalidationService.invalidatePartnerCache(partnerId, {
        branding: true // Branding data changed
      });
      console.log('✅ Domain cache invalidated for partner branding update');
    } catch (cacheError) {
      console.error('⚠️ Failed to invalidate domain cache:', cacheError);
      // Don't fail the request if cache invalidation fails
    }

    // Return updated partner data
    return NextResponse.json(updatedPartner);
  } catch (error) {
    console.error('Error updating partner branding:', error);
    return NextResponse.json(
      { message: 'Failed to update branding settings' },
      { status: 500 }
    );
  }
}
