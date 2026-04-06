'use client';

import React, { Suspense, ReactNode } from 'react';

interface SuspenseBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * A component that wraps its children in a Suspense boundary.
 * This is useful for pages that use client-side hooks like useSearchParams, usePathname, etc.
 * 
 * @example
 * ```tsx
 * // In your page component:
 * import { SuspenseBoundary } from '@/components/SuspenseBoundary';
 * 
 * export default function Page() {
 *   return (
 *     <SuspenseBoundary>
 *       <YourComponent />
 *     </SuspenseBoundary>
 *   );
 * }
 * ```
 */
export function SuspenseBoundary({ children, fallback }: SuspenseBoundaryProps) {
  return (
    <Suspense fallback={fallback || <DefaultFallback />}>
      {children}
    </Suspense>
  );
}

function DefaultFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}
