import { prisma } from '@/lib/prisma';
import NewsletterSubscriberList from '@/components/admin/NewsletterSubscriberList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Newsletter Subscribers - Admin Dashboard',
  description: 'Manage newsletter subscribers',
};

export default async function NewsletterSubscribersPage() {
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-gray-900/50 rounded-lg shadow-xl p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold mb-2">Newsletter Subscribers</h1>
                <p className="text-gray-400">
                  Manage and monitor your newsletter subscriber list
                </p>
              </div>
              <div className="text-gray-400">
                Total Subscribers: <span className="text-blue-400 font-semibold">{subscribers.length}</span>
              </div>
            </div>
            
            <NewsletterSubscriberList initialSubscribers={subscribers} />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading newsletter subscribers:', error);
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white p-8">
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-300">
          <h2 className="text-xl font-semibold mb-2">Error Loading Subscribers</h2>
          <p>Unable to load newsletter subscribers. Please try again later.</p>
        </div>
      </div>
    );
  }
}
