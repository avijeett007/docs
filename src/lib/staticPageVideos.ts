export interface PageVideo {
  id: string;
  pageUrl: string;
  title: string;
  description?: string;
  videoUrl: string;
  isActive: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

// Static video mappings for development (will be replaced by database)
export const STATIC_PAGE_VIDEOS: Record<string, PageVideo> = {
  '/partner/settings/whitelabel': {
    id: '1',
    pageUrl: '/partner/settings/whitelabel',
    title: 'Customize Your Pod',
    description: 'Learn how to set up your whitelabel portal with subdomain or custom domain',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
    isActive: true,
    position: 'bottom-right'
  },
  '/partner/customers': {
    id: '2',
    pageUrl: '/partner/customers',
    title: 'Onboard Your First Customer',
    description: 'Step-by-step guide to creating your first customer account',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
    isActive: true,
    position: 'bottom-right'
  },
  '/partner/ai-agents': {
    id: '3',
    pageUrl: '/partner/ai-agents',
    title: 'Import an Agent',
    description: 'How to create an AI agent using any provider (Retell, VAPI, Ultravox, ElevenLabs, GHL)',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
    isActive: true,
    position: 'bottom-right'
  },
  '/partner/ai-usage': {
    id: '4',
    pageUrl: '/partner/ai-usage',
    title: 'Review Analytics',
    description: 'Understanding your analytics dashboard and customer portal access',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
    isActive: true,
    position: 'bottom-right'
  },
  '/partner/settings': {
    id: '5',
    pageUrl: '/partner/settings',
    title: 'Setup Your Payments',
    description: 'How to integrate your Stripe Connect account for payments',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
    isActive: true,
    position: 'bottom-right'
  }
};

// Server-side function for getting static page videos
export function getStaticPageVideo(path: string): PageVideo | null {
  return STATIC_PAGE_VIDEOS[path] || null;
}
