import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    // Find the partner by partner code
    const partner = await prisma.partner.findUnique({
      where: {
        partnerCode: params.code,
      },
      select: {
        businessName: true,
        logo: true,
      },
    });

    if (!partner) {
      return new NextResponse('Partner not found', { status: 404 });
    }

    // Run a raw query to get the branding fields
    const brandingFields = await prisma.$queryRaw`
      SELECT 
        "primary_color" as "primaryColor", 
        "secondary_color" as "secondaryColor", 
        "font_family" as "fontFamily", 
        "portal_title" as "portalTitle", 
        "portal_slogan" as "portalSlogan"
      FROM "partners" 
      WHERE "partner_code" = ${params.code}
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
      businessName: partner.businessName,
      logo: partner.logo,
      ...brandingData
    });
  } catch (error) {
    console.error('Error fetching partner:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
