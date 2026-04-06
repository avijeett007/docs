import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper function to normalize business name for comparison
const normalizeBusinessName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export async function GET(
  request: Request,
  { params }: { params: { businessName: string } }
) {
  try {
    const businessName = params.businessName;

    if (!businessName) {
      return new NextResponse('Business name is required', { status: 400 });
    }

    // Find all partners
    const partners = await prisma.partner.findMany({
      select: {
        businessName: true,
        partnerCode: true,
        logo: true,
      },
    });

    // Find the partner with a matching normalized business name
    const normalizedSearchName = normalizeBusinessName(businessName);
    const matchedPartner = partners.find(
      (partner) => normalizeBusinessName(partner.businessName) === normalizedSearchName
    );

    if (!matchedPartner) {
      return new NextResponse('Partner not found', { status: 404 });
    }

    // Now that we have the partner code, get the full partner details including branding
    const partnerCode = matchedPartner.partnerCode;

    // Run a raw query to get the branding fields
    const brandingFields = await prisma.$queryRaw`
      SELECT 
        "primary_color" as "primaryColor", 
        "secondary_color" as "secondaryColor", 
        "font_family" as "fontFamily", 
        "portal_title" as "portalTitle", 
        "portal_slogan" as "portalSlogan"
      FROM "partners" 
      WHERE "partner_code" = ${partnerCode}
    `;

    // Merge the branding fields with the partner object
    const brandingData = Array.isArray(brandingFields) && brandingFields.length > 0 
      ? brandingFields[0] 
      : {
          primaryColor: '#3B82F6', // Default blue
          secondaryColor: '#10B981', // Default teal
          fontFamily: 'Inter', // Default font
          portalTitle: null,
          portalSlogan: null
        };

    return NextResponse.json({
      businessName: matchedPartner.businessName,
      logo: matchedPartner.logo,
      ...brandingData
    });
  } catch (error) {
    console.error('Error fetching partner info by business name:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
