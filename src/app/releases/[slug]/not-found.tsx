import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* 404 Animation */}
        <div className="mb-8">
          <h1 className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent mb-4">
            404
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
        </div>

        {/* Error Message */}
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Release Not Found
        </h2>
        <p className="text-xl text-gray-400 mb-8 leading-relaxed">
          The release you're looking for doesn't exist or may have been moved. 
          <br />
          Let's get you back to exploring our journey.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
            <Link href="/roadmap">
              <ArrowLeft className="w-4 h-4 mr-2" />
              View All Releases
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800/50 px-8 py-3">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </Button>
        </div>

        {/* Suggested Links */}
        <div className="mt-12 p-6 bg-gray-800/30 rounded-xl border border-gray-700/30">
          <h3 className="text-lg font-semibold text-white mb-4">Explore Our Latest Releases</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/releases/knot-5-0-reef-knot" className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm hover:bg-blue-600/30 transition-colors">
              Knot-5.0: The Reef Knot
            </Link>
            <Link href="/releases/knot-4-0-surge-splice" className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm hover:bg-purple-600/30 transition-colors">
              Knot-4.0: The Surge Splice
            </Link>
            <Link href="/releases/knot-3-0-slackline-patch" className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm hover:bg-green-600/30 transition-colors">
              Knot-3.0: The Slackline Patch
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
