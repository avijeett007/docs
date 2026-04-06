import type { Metadata } from 'next';
import '../../styles/globals.css';

export const metadata: Metadata = {
  title: 'Knotie AI Widget',
  description: 'Embeddable Voice AI Widget',
  robots: 'noindex, nofollow', // Prevent indexing of widget pages
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{
          __html: `
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              overflow: hidden;
              height: 100vh;
              width: 100vw;
              margin: 0;
              padding: 0;
              background: transparent !important;
            }

            html, body {
              height: 100%;
              width: 100%;
            }

            #__next {
              height: 100%;
              width: 100%;
            }

            /* Hide Next.js error overlay for production widgets */
            nextjs-portal,
            [data-nextjs-dialog-overlay],
            [data-nextjs-toast],
            [data-nextjs-dialog],
            .nextjs__container_errors,
            .nextjs__container_build_error {
              display: none !important;
            }

            /* Hide any toast notifications */
            [data-sonner-toaster],
            [data-toast-viewport],
            .toaster,
            .toast {
              display: none !important;
            }
          `
        }} />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Disable Next.js error overlay for widgets
            if (typeof window !== 'undefined') {
              // Override console.error to prevent error overlays
              const originalError = console.error;
              console.error = function(...args) {
                // Still log to console for debugging
                originalError.apply(console, args);
                // But don't trigger error overlays
              };

              // Remove any existing error overlays
              const removeErrorOverlays = () => {
                const overlays = document.querySelectorAll(
                  'nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-toast], [data-nextjs-dialog], .nextjs__container_errors, .nextjs__container_build_error'
                );
                overlays.forEach(overlay => overlay.remove());
              };

              // Remove overlays on load and periodically
              document.addEventListener('DOMContentLoaded', removeErrorOverlays);
              setInterval(removeErrorOverlays, 1000);

              // Prevent error event propagation
              window.addEventListener('error', function(e) {
                e.stopPropagation();
                e.preventDefault();
                return false;
              }, true);

              // Prevent unhandled promise rejection overlays
              window.addEventListener('unhandledrejection', function(e) {
                e.stopPropagation();
                e.preventDefault();
                return false;
              }, true);
            }
          `
        }} />
      </head>
      <body suppressHydrationWarning>
        {/* Widget layout is completely independent - no Clerk provider */}
        <div suppressHydrationWarning>
          {children}
        </div>
      </body>
    </html>
  );
}
