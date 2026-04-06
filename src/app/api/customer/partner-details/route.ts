import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerAuth } from '@/lib/auth/customerAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Use customer authentication instead of Clerk
    const authResult = await verifyCustomerAuth(req);

    if (!authResult) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the partner details using the customer's partnerId
    const partner = await prisma.partner.findUnique({
      where: { id: authResult.partnerId }
    });

    if (!partner) {
      return new NextResponse('Partner not found', { status: 404 });
    }

    // Transform the data to match the PartnerBranding interface
    return NextResponse.json({
      email: partner.emailAddress,
      businessName: partner.businessName,
      contactName: partner.contactName,
      logo: partner.logo,
      // @ts-ignore - New field that TypeScript doesn't know about yet
      logoSize: (partner as any).logoSize || 'medium',
      // @ts-ignore - New field that TypeScript doesn't know about yet
      favicon: (partner as any).favicon,
      primaryColor: partner.primaryColor,
      secondaryColor: partner.secondaryColor,
      fontFamily: partner.fontFamily,
      portalTitle: partner.portalTitle,
      portalSlogan: partner.portalSlogan,
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
      // Landing Page Content
      // @ts-ignore
      features: (partner as any).features || undefined,
      // @ts-ignore
      testimonials: (partner as any).testimonials || undefined,
      // @ts-ignore
      faqs: (partner as any).faqs || undefined,
      // @ts-ignore
      trustIndicators: (partner as any).trustIndicators || undefined,
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
      showContactInfo: (partner as any).showContactInfo !== false,
      // @ts-ignore
      showCommunity: (partner as any).showCommunity || false,
      // @ts-ignore
      communityUrl: (partner as any).communityUrl || undefined,
      // @ts-ignore
      moreTestimonialsUrl: (partner as any).moreTestimonialsUrl || undefined,
      // SaaS Portal Configuration
      // @ts-ignore
      characterName: (partner as any).characterName || undefined,
      // @ts-ignore
      freeTrialEnabled: (partner as any).freeTrialEnabled !== false, // Default to true
      // @ts-ignore
      freeAiCredits: (partner as any).freeAiCredits || 50,
      // @ts-ignore
      pricingModel: (partner as any).pricingModel || 'subscription',
      // @ts-ignore
      payAsYouGoRate: (partner as any).payAsYouGoRate || 0.10
    });
  } catch (error) {
    console.error('Error fetching partner details:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
