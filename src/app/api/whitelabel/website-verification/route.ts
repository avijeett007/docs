import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parse } from 'node-html-parser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Helper function to normalize URL
function normalizeUrl(url: string): string {
  if (!url) return url;

  // Remove any whitespace
  url = url.trim();

  // Add https:// if no protocol is present
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  return url;
}

const websiteVerificationSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  businessWebsite: z.string()
    .min(1, 'Website URL is required')
    .transform(normalizeUrl)
    .refine((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }, 'Valid website URL is required'),
  partnerId: z.string().min(1, 'Partner ID is required'),
  customerId: z.string().optional(),
});

interface WebsiteAnalysis {
  businessName: string;
  websiteTitle: string;
  businessDescription: string;
  businessCategory: string;
  contactInfo: {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  services: string[];
}

// Function to scrape website content
async function scrapeWebsite(url: string): Promise<string> {
  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KnotieAI-Bot/1.0; +https://knotie-ai.pro)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const root = parse(html);

    // Remove script and style elements
    root.querySelectorAll('script, style, noscript').forEach(el => el.remove());

    // Extract text content from key sections
    const title = root.querySelector('title')?.text?.trim() || '';
    const metaDescription = root.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    // Extract H1 text
    const h1Elements = root.querySelectorAll('h1');
    const h1Text = h1Elements.map(el => el.text.trim()).join(' ');

    // Extract H2 text (limit to first 5)
    const h2Elements = root.querySelectorAll('h2');
    const h2Text = h2Elements.slice(0, 5).map(el => el.text.trim()).join(' ');

    // Extract body text
    const bodyElement = root.querySelector('body');
    const bodyText = bodyElement?.text?.replace(/\s+/g, ' ').trim().substring(0, 2000) || '';

    return `Title: ${title}\nMeta Description: ${metaDescription}\nH1: ${h1Text}\nH2: ${h2Text}\nContent: ${bodyText}`;
  } catch (error) {
    console.error('Error scraping website:', error);
    throw new Error(`Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Function to analyze website content using Azure OpenAI
async function analyzeWebsiteContent(websiteContent: string, providedBusinessName: string): Promise<WebsiteAnalysis> {
  try {
    const prompt = `Analyze the following website content and extract business information. You must return ONLY a valid JSON object with no additional text, explanations, markdown formatting, or backticks.

Required JSON format:
{
  "businessName": "extracted or provided business name",
  "websiteTitle": "website title",
  "businessDescription": "brief description of what the business does",
  "businessCategory": "business category (e.g., Restaurant, Healthcare, Legal, Technology, etc.)",
  "contactInfo": {
    "phone": "phone number if found or null",
    "email": "email if found or null",
    "address": "address if found or null"
  },
  "services": ["array", "of", "services", "offered"]
}

Provided business name: ${providedBusinessName}
Website content:
${websiteContent}

CRITICAL: Return ONLY the JSON object. No markdown, no backticks, no additional text.`;

    // Direct Azure OpenAI API call
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini';

    if (!azureEndpoint || !azureApiKey) {
      console.warn('Azure OpenAI not configured, using fallback analysis');
      throw new Error('Azure OpenAI not configured');
    }

    const response = await fetch(`${azureEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureApiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst. Return only valid JSON responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI API failed: ${response.statusText}`);
    }

    const result = await response.json();
    let analysisText = result.choices?.[0]?.message?.content || '';

    try {
      // Clean up the response - remove markdown formatting and extra text
      analysisText = analysisText.trim();

      // Remove markdown code blocks if present
      if (analysisText.startsWith('```json')) {
        analysisText = analysisText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (analysisText.startsWith('```')) {
        analysisText = analysisText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Find JSON object boundaries
      const jsonStart = analysisText.indexOf('{');
      const jsonEnd = analysisText.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        analysisText = analysisText.substring(jsonStart, jsonEnd + 1);
      }

      return JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', analysisText);
      // Fallback analysis
      return {
        businessName: providedBusinessName,
        websiteTitle: 'Website Analysis',
        businessDescription: 'Business information extracted from website',
        businessCategory: 'General Business',
        contactInfo: {
          phone: null,
          email: null,
          address: null
        },
        services: [],
      };
    }
  } catch (error) {
    console.error('Error analyzing website content:', error);
    // Return fallback analysis
    return {
      businessName: providedBusinessName,
      websiteTitle: 'Website Analysis',
      businessDescription: 'Unable to analyze website content',
      businessCategory: 'General Business',
      contactInfo: {},
      services: [],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, businessWebsite, partnerId, customerId } = websiteVerificationSchema.parse(body);

    // Scrape the website
    const websiteContent = await scrapeWebsite(businessWebsite);

    // Analyze the content with AI
    const analysis = await analyzeWebsiteContent(websiteContent, businessName);

    // If customerId is provided, save the analysis to the database
    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          businessName: analysis.businessName,
          businessWebsite: businessWebsite,
          websiteTitle: analysis.websiteTitle,
          businessDescription: analysis.businessDescription,
          businessCategory: analysis.businessCategory,
          contactInfo: analysis.contactInfo,
          onboardingStep: 2, // Mark as completed step 1
        },
      });
    }

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('Website verification error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Website verification failed' },
      { status: 500 }
    );
  }
}
