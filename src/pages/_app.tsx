import { CloudProvider } from "@/cloud/useCloud";
import { ConfigProvider } from "@/hooks/useConfig";
import { ConnectionProvider } from "@/hooks/useConnection";
import { ToastProvider } from "@/components/toast/ToasterProvider";
import Script from "next/script";

import "@livekit/components-styles/components/participant";
import type { AppProps } from "next/app";

import "../styles/globals.css";

export default function App(props: AppProps) {
  const { Component, pageProps } = props;
  return (
    <>
      <ToastProvider>
        <ConfigProvider>
          <CloudProvider>
            <ConnectionProvider>
              <Component {...pageProps} />
            </ConnectionProvider>
          </CloudProvider>
        </ConfigProvider>
      </ToastProvider>

      {/* Rewardful Tracking Script - Following official Next.js integration guide */}
      <Script
        src="https://r.wdfl.co/rw.js"
        data-rewardful={process.env.NEXT_PUBLIC_REWARDFUL_SUBDOMAIN || ''}
      />
      <Script
        id="rewardful-queue"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`
        }}
      />
    </>
  );
}
