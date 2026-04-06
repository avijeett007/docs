import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { partnerCode: string } }
) {
  try {
    const partnerCode = params.partnerCode;
    console.log('API: Fetching partner by code:', partnerCode);

    if (!partnerCode) {
      console.error('API: Partner code is missing');
      return new NextResponse('Partner code is required', { status: 400 });
    }

    // Find the partner by partner code with all needed fields
    const partner = await prisma.partner.findUnique({
      where: {
        partnerCode: partnerCode,
      },
      select: {
        businessName: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        portalTitle: true,
        portalSlogan: true,
      },
    });

    if (!partner) {
      console.error('API: Partner not found for code:', partnerCode);
      return new NextResponse('Partner not found', { status: 404 });
    }

    console.log('API: Partner found:', partner.businessName);
    
    // Return the partner data with proper branding
    return NextResponse.json({
      businessName: partner.businessName,
      logo: partner.logo,
      primaryColor: partner.primaryColor || '#3B82F6',
      secondaryColor: partner.secondaryColor || '#10B981',
      fontFamily: partner.fontFamily || 'Inter',
      portalTitle: partner.portalTitle || null,
      portalSlogan: partner.portalSlogan || null,
      // Enhanced Landing Page Configuration
      // @ts-ignore - New fields that TypeScript doesn't know about yet
      supportEmail: (partner as any).supportEmail || undefined,
      // @ts-ignore
      companyAddress: (partner as any).companyAddress || undefined,
      // @ts-ignore
      companyPhone: (partner as any).companyPhone || undefined,
      // @ts-ignore
      privacyPolicyUrl: (partner as any).privacyPolicyUrl || undefined,
      // @ts-ignore
      termsOfServiceUrl: (partner as any).termsOfServiceUrl || undefined,
      // @ts-ignore
      statusPageUrl: (partner as any).statusPageUrl || undefined,
      // Social Media Links
      // @ts-ignore
      twitterUrl: (partner as any).twitterUrl || undefined,
      // @ts-ignore
      linkedinUrl: (partner as any).linkedinUrl || undefined,
      // @ts-ignore
      facebookUrl: (partner as any).facebookUrl || undefined,
      // @ts-ignore
      instagramUrl: (partner as any).instagramUrl || undefined,
      // Footer Section Controls
      // @ts-ignore
      showQuickLinks: (partner as any).showQuickLinks !== false,
      // @ts-ignore
      showResources: (partner as any).showResources !== false,
      // @ts-ignore
      showNewsletter: (partner as any).showNewsletter !== false,
      // @ts-ignore
      showLegal: (partner as any).showLegal !== false,
      // @ts-ignore
      showSocialMedia: (partner as any).showSocialMedia !== false,
      // @ts-ignore
      showContactInfo: (partner as any).showContactInfo !== false
    });
  } catch (error) {
    console.error('Error fetching partner info:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
