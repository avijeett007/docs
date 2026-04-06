import { Metadata } from 'next';

// This is a dynamic metadata function for the whitelabel section
// It will be called on each request to generate metadata for the page
export async function generateMetadata(): Promise<Metadata> {
  // Attempt to get partner info from headers or cookies
  const partnerName = 'Partner';
  
  try {
    // In a server component, we could fetch this from an API or database
    // For now, we'll use a generic title that will be overridden by client-side JS
    return {
      title: `${partnerName} AI Portal`,
      description: 'AI-powered voice solutions for your business',
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'AI Portal',
      description: 'AI-powered voice solutions for your business',
    };
  }
}
