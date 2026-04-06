import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReleasePage from '@/components/ReleasePage';
import releasesConfig from '@/config/releases.json';

interface ReleaseFeature {
  title: string;
  icon: string;
  description: string;
  details?: string[];
}

interface ActionRequired {
  title: string;
  description: string;
  items: string[];
}

interface InfrastructureFix {
  title: string;
  description: string;
}

interface BugFix {
  title: string;
  description: string;
}

interface Release {
  id: string;
  version: string;
  title: string;
  date: string;
  week: string;
  slug: string;
  theme: string;
  description: string;
  metaphor?: string;
  milestone?: string;
  keyFeatures: ReleaseFeature[];
  actionRequired?: ActionRequired;
  infrastructureFixes?: InfrastructureFix[];
  bugFixes?: BugFix[];
  upcomingFeatures?: string[];
  category: string;
  seoKeywords: string[];
}

interface ReleasesConfig {
  releases: Release[];
  seoConfig: {
    baseTitle: string;
    baseDescription: string;
    keywords: string[];
  };
}

interface PageProps {
  params: {
    slug: string;
  };
}

// Generate static params for all releases
export async function generateStaticParams() {
  const releases = (releasesConfig as ReleasesConfig).releases;
  
  return releases.map((release) => ({
    slug: release.slug,
  }));
}

// Generate metadata for each release page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const releases = (releasesConfig as ReleasesConfig).releases;
  const release = releases.find((r) => r.slug === params.slug);

  if (!release) {
    return {
      title: 'Release Not Found - Knotie AI Pro',
      description: 'The requested release could not be found.',
    };
  }

  const title = `${release.version}: ${release.title} - Knotie AI Pro Release Notes`;
  const description = `${release.description} Discover the latest Voice AI features and improvements in ${release.version}.`;
  const keywords = [
    'Knotie AI Pro',
    ...release.seoKeywords,
    'Voice AI Agents',
    'Voice AI Industry',
    'VAPI',
    'Retell',
    'Ultravox',
    'Voice AI Reselling',
    'Voice AI Agencies',
    'AI Agencies',
    'Marketing Agencies',
  ].join(', ');

  return {
    title,
    description,
    keywords,
    authors: [{ name: 'Knotie AI Pro Team' }],
    creator: 'Knotie AI Pro',
    publisher: 'Knotie AI Pro',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL('https://knotie-ai.pro'),
    alternates: {
      canonical: `/releases/${release.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/releases/${release.slug}`,
      siteName: 'Knotie AI Pro',
      type: 'article',
      publishedTime: release.date,
      authors: ['Knotie AI Pro Team'],
      tags: release.seoKeywords,
      images: [
        {
          url: '/images/og-release-default.png',
          width: 1200,
          height: 630,
          alt: `${release.version}: ${release.title}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@knotieaipro',
      images: ['/images/og-release-default.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    category: 'Technology',
  };
}

export default function ReleasePageRoute({ params }: PageProps) {
  const releases = (releasesConfig as ReleasesConfig).releases;
  const release = releases.find((r) => r.slug === params.slug);

  if (!release) {
    notFound();
  }

  return <ReleasePage release={release} />;
}

// Enable static generation
export const dynamic = 'force-static';
export const revalidate = false;
