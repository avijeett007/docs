'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectToApiKeysPage() {
  const router = useRouter();

  // Redirect to the settings/api-keys page when component mounts
  useEffect(() => {
    router.push('/whitelabel/settings/api-keys');
  }, [router]);

  // Return a loading message while redirecting
  return (
    <div className="flex items-center justify-center h-screen">
      <p>Redirecting to API Keys page...</p>
    </div>
  );
}
