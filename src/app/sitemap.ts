import { MetadataRoute } from 'next';
import releasesConfig from '@/config/releases.json';

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
  keyFeatures: any[];
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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://knotie-ai.pro';
  const releases = (releasesConfig as ReleasesConfig).releases;

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/benefits`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/roadmap`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/partners`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/releases`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/affiliates`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/security`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  // Dynamic release pages
  const releasePages = releases.map((release) => {
    // Parse the date string properly (e.g., "June 15th, 2025")
    const dateStr = release.date.replace(/(\d+)(st|nd|rd|th)/, '$1'); // Remove ordinal suffixes
    const parsedDate = new Date(dateStr);
    const lastModified = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    return {
      url: `${baseUrl}/releases/${release.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    };
  });

  return [...staticPages, ...releasePages];
}
