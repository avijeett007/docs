import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/benefits',
          '/features',
          '/pricing',
          '/solutions/',
          '/about',
          '/contact',
          '/blog',
          '/docs',
          '/releases',
          '/roadmap',
          '/partners',
          '/affiliates',
        ],
        disallow: [
          // API routes
          '/api/',
          
          // Admin and internal areas
          '/admin/',
          '/mission-control/',
          '/dashboard/',
          '/platform/',
          
          // Partner and customer portals
          '/partner/',
          '/customer/',
          '/whitelabel/',
          
          // Widget and internal tools
          '/widget/',
          '/welcome/',
          
          // Test routes
          '/test/',
          '/test-call/',
          '/test-function-calls/',
          '/test-integration/',
          '/test-migration-popup/',
          '/test-translations/',
          
          // Build and static files
          '/_next/',
          '/static/',
          
          // Test HTML files
          '/test-*.html',
        ],
      },
    ],
    sitemap: 'https://knotie-ai.pro/sitemap.xml',
  };
}
