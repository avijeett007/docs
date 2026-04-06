// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Partner } from '@prisma/client';

// Extend the Partner type from Prisma to include our custom fields
declare global {
  namespace PrismaJson {
    interface Partner extends Partner {
      customDomain?: string | null;
      customDomainVerified: boolean;
      customDomainStatus?: string | null;
      customDomainVerificationToken?: string | null;
      customDomainVerificationStartedAt?: Date | null;
      customDomainTarget?: string | null;
      customDomainCloudflareId?: string | null;
      customDomainHttpValidationUrl?: string | null;
      customDomainHttpValidationBody?: string | null;
    }
  }
}

// Extend the Partner update input to include our custom fields
declare module '@prisma/client' {
  interface Prisma {
    PartnerUpdateInput: {
      customDomain?: string | null;
      customDomainVerified?: boolean;
      customDomainStatus?: string | null;
      customDomainVerificationToken?: string | null;
      customDomainVerificationStartedAt?: Date | null;
      customDomainTarget?: string | null;
      customDomainCloudflareId?: string | null;
      customDomainHttpValidationUrl?: string | null;
      customDomainHttpValidationBody?: string | null;
    }
  }
}
