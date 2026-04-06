'use client';

import { useEffect, useState } from 'react';

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * ClientOnly component to prevent hydration mismatches
 *
 * This component ensures that certain content only renders on the client side,
 * preventing hydration errors when server and client render differently.
 *
 * Use cases:
 * - Dynamic content that changes based on client state
 * - Components that rely on browser APIs
 * - Content that should only appear after JavaScript loads
 *
 * @param children - Content to render after hydration
 * @param fallback - Content to show during SSR (should match expected layout)
 */
export const ClientOnly: React.FC<ClientOnlyProps> = ({ children, fallback = null }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
