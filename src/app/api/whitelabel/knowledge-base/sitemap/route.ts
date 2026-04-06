import { NextRequest, NextResponse } from 'next/server';
import { verifyOnboardingAuth } from '@/lib/onboardingAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const sitemapRequestSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
});

interface SitemapUrl {
  url: string;
  title?: string;
  lastModified?: string;
  changeFrequency?: string;
  priority?: string;
}

// Parse XML sitemap or sitemap index
async function parseSitemap(sitemapUrl: string): Promise<SitemapUrl[]> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Knotie-AI-Bot/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`);
    }

    const xmlText = await response.text();

    // Check if this is a sitemap index
    if (xmlText.includes('<sitemapindex')) {
      return await parseSitemapIndex(xmlText);
    }

    // Parse regular sitemap
    return await parseRegularSitemap(xmlText);
  } catch (error) {
    console.error('Error parsing sitemap:', error);
    throw error;
  }
}

// Parse sitemap index and fetch individual sitemaps
async function parseSitemapIndex(xmlText: string): Promise<SitemapUrl[]> {
  const urls: SitemapUrl[] = [];
  const sitemapMatches = xmlText.match(/<sitemap>(.*?)<\/sitemap>/gs);

  if (!sitemapMatches) {
    return urls;
  }

  // Limit to first 5 sitemaps to avoid timeout
  const limitedSitemaps = sitemapMatches.slice(0, 5);

  for (const sitemapMatch of limitedSitemaps) {
    const locMatch = sitemapMatch.match(/<loc>(.*?)<\/loc>/);
    if (locMatch) {
      const subSitemapUrl = locMatch[1].trim();

      try {
        const subSitemapUrls = await parseRegularSitemap(await fetchSitemapXml(subSitemapUrl));
        urls.push(...subSitemapUrls);

        // Limit total URLs to prevent timeout
        if (urls.length > 200) {
          break;
        }
      } catch (error) {
        console.error('Error parsing sub-sitemap:', subSitemapUrl, error);
        continue;
      }
    }
  }

  return urls;
}

// Fetch sitemap XML content
async function fetchSitemapXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Knotie-AI-Bot/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }

  return await response.text();
}

// Parse regular sitemap with <url> entries
async function parseRegularSitemap(xmlText: string): Promise<SitemapUrl[]> {
  const urls: SitemapUrl[] = [];
  const urlMatches = xmlText.match(/<url>(.*?)<\/url>/gs);

  if (urlMatches) {
    for (const urlMatch of urlMatches) {
      const locMatch = urlMatch.match(/<loc>(.*?)<\/loc>/);
      const lastmodMatch = urlMatch.match(/<lastmod>(.*?)<\/lastmod>/);
      const changefreqMatch = urlMatch.match(/<changefreq>(.*?)<\/changefreq>/);
      const priorityMatch = urlMatch.match(/<priority>(.*?)<\/priority>/);

      if (locMatch) {
        urls.push({
          url: locMatch[1].trim(),
          lastModified: lastmodMatch?.[1]?.trim(),
          changeFrequency: changefreqMatch?.[1]?.trim(),
          priority: priorityMatch?.[1]?.trim(),
        });
      }
    }
  }

  return urls;
}

// Try to find sitemap automatically
async function findSitemap(baseUrl: string): Promise<string | null> {
  const possibleSitemaps = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemaps.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
    `${baseUrl}/wp-sitemap.xml`, // WordPress default
    `${baseUrl}/sitemap-index.xml`, // Common alternative
    `${baseUrl}/robots.txt`, // Check robots.txt for sitemap reference
  ];

  for (const sitemapUrl of possibleSitemaps) {
    try {
      // Special handling for robots.txt
      if (sitemapUrl.endsWith('/robots.txt')) {
        const robotsSitemap = await checkRobotsForSitemap(baseUrl);
        if (robotsSitemap) {
          return robotsSitemap;
        }
        continue;
      }

      const response = await fetch(sitemapUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Knotie-AI-Bot/1.0',
        },
      });

      if (response.ok) {
        return sitemapUrl;
      }
    } catch (error) {
      // Continue to next possible sitemap
      continue;
    }
  }

  return null;
}

// Check robots.txt for sitemap references
async function checkRobotsForSitemap(baseUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/robots.txt`, {
      headers: {
        'User-Agent': 'Knotie-AI-Bot/1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const robotsText = await response.text();
    const sitemapMatch = robotsText.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);

    if (sitemapMatch) {
      return sitemapMatch[1].trim();
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Get page title by fetching the page
async function getPageTitle(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Knotie-AI-Bot/1.0',
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    return titleMatch?.[1]?.trim();
  } catch (error) {
    return undefined;
  }
}

// Basic web crawling for sites without sitemaps
async function crawlWebsite(baseUrl: string, maxPages: number = 10): Promise<SitemapUrl[]> {
  const visited = new Set<string>();
  const toVisit = [baseUrl];
  const pages: SitemapUrl[] = [];

  while (toVisit.length > 0 && pages.length < maxPages) {
    const currentUrl = toVisit.shift()!;

    if (visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    try {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'Knotie-AI-Bot/1.0',
        },
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);

      pages.push({
        url: currentUrl,
        title: titleMatch?.[1]?.trim() || 'Untitled Page',
      });

      // Extract links from the page (simple approach)
      const linkMatches = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi);

      if (linkMatches) {
        for (const linkMatch of linkMatches.slice(0, 5)) { // Limit to 5 links per page
          const hrefMatch = linkMatch.match(/href=["']([^"']+)["']/i);
          if (hrefMatch) {
            let linkUrl = hrefMatch[1];

            // Convert relative URLs to absolute
            if (linkUrl.startsWith('/')) {
              linkUrl = baseUrl + linkUrl;
            } else if (linkUrl.startsWith('./')) {
              linkUrl = baseUrl + linkUrl.substring(1);
            } else if (!linkUrl.startsWith('http')) {
              continue; // Skip invalid URLs
            }

            // Only crawl URLs from the same domain
            try {
              const linkDomain = new URL(linkUrl).origin;
              if (linkDomain === baseUrl && !visited.has(linkUrl)) {
                toVisit.push(linkUrl);
              }
            } catch (error) {
              // Skip invalid URLs
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error crawling ${currentUrl}:`, error);
      continue;
    }
  }

  return pages;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyOnboardingAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = sitemapRequestSchema.parse(body);

    // Normalize URL
    const baseUrl = new URL(url).origin;

    // Try to find sitemap
    const sitemapUrl = await findSitemap(baseUrl);

    if (!sitemapUrl) {
      // If no sitemap found, try basic web crawling
      const crawledPages = await crawlWebsite(baseUrl, 20); // Crawl up to 20 pages

      if (crawledPages.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            sitemapFound: false,
            baseUrl,
            pages: crawledPages,
            crawlMethod: 'web_crawl',
          },
        });
      }

      // If crawling also fails, return just the base URL
      const title = await getPageTitle(url);
      return NextResponse.json({
        success: true,
        data: {
          sitemapFound: false,
          baseUrl,
          pages: [{
            url,
            title: title || 'Untitled Page',
          }],
          crawlMethod: 'single_page',
        },
      });
    }

    // Parse sitemap
    const sitemapPages = await parseSitemap(sitemapUrl);

    // Limit to 500 pages (Retell's limit)
    const limitedPages = sitemapPages.slice(0, 500);

    // Get titles for pages that don't have them
    const pagesWithTitles = await Promise.all(
      limitedPages.slice(0, 20).map(async (page) => { // Only get titles for first 20 pages to avoid timeout
        if (!page.title) {
          const title = await getPageTitle(page.url);
          return { ...page, title: title || 'Untitled Page' };
        }
        return page;
      })
    );

    // Add remaining pages without fetching titles
    const remainingPages = limitedPages.slice(20).map(page => ({
      ...page,
      title: page.title || 'Untitled Page',
    }));

    const allPages = [...pagesWithTitles, ...remainingPages];

    return NextResponse.json({
      success: true,
      data: {
        sitemapFound: true,
        sitemapUrl,
        baseUrl,
        totalPages: sitemapPages.length,
        pages: allPages,
        crawlMethod: 'sitemap',
      },
    });

  } catch (error: any) {
    console.error('Error processing sitemap request:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process sitemap request' },
      { status: 500 }
    );
  }
}
