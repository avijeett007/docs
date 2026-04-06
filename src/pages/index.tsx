
import Head from "next/head";
import React, { useState, useEffect } from "react";
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import { useConnection } from "@/hooks/useConnection";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import KnotieDashboard from "@/components/KnotieDashboard";



// Component that uses Krisp inside LiveKitRoom context
function KrispEnabledRoom() {
  const krisp = useKrispNoiseFilter();

  // Enable noise filter by default when it becomes available
  useEffect(() => {
    if (!krisp.isNoiseFilterPending && !krisp.isNoiseFilterEnabled) {
      console.log('🎯 Krisp: Enabling noise filter by default');
      krisp.setNoiseFilterEnabled(true).catch((error) => {
        console.warn('⚠️ Krisp: Failed to enable noise filter:', error);
      });
    }
  }, [krisp, krisp.isNoiseFilterPending, krisp.isNoiseFilterEnabled, krisp.setNoiseFilterEnabled]);

  return (
    <>
      <StartAudio label="Start Audio" />
      <RoomAudioRenderer />
    </>
  );
}

function ConnectionWrapper() {
  const { wsUrl, token, connect, disconnect } = useConnection();
  const [shouldConnect, setShouldConnect] = useState(true);

  const handleConnect = async () => {
    console.log(' Index: Connection state toggle requested');
    if (token && wsUrl) {
      console.log(' Index: Currently connected, disconnecting...');
      setShouldConnect(false);  // First disconnect the room
      await disconnect();       // Then clear the connection details
    } else {
      console.log(' Index: Not connected, connecting...');
      setShouldConnect(true);
      await connect("env");
    }
  };

  return (
    <>
      {token && wsUrl ? (
        <LiveKitRoom
          token={token}
          serverUrl={wsUrl}
          connect={shouldConnect}
          // Only enable audio by default, video can be enabled later
          audio={true}
          video={false}
          onDisconnected={() => {
            console.log('✅ LiveKitRoom: Room disconnected successfully');
            // Ensure we clean up properly
            if (!shouldConnect) {
              disconnect();
            }
          }}
        >
          <KrispEnabledRoom />
        </LiveKitRoom>
      ) : null}
      <KnotieDashboard 
        onStartCall={handleConnect} 
        isConnected={Boolean(token && wsUrl && shouldConnect)}
      />
    </>
  );
}

export default function Home() {
  return (
    <div>
      <Head>
        {/* Primary Meta Tags */}
        <title>Knotie AI Pro - White-Label Voice AI Platform for Agencies | VAPI, Retell & Ultravox Integration</title>
        <meta name="title" content="Knotie AI Pro - White-Label Voice AI Platform for Agencies | VAPI, Retell & Ultravox Integration" />
        <meta name="description" content="Transform your agency with Knotie AI Pro's white-label voice AI platform. Integrate VAPI, Retell, and Ultravox agents seamlessly. Advanced analytics, customer portals, and profit controls for AI agencies." />
        <meta name="keywords" content="voice AI, white-label platform, VAPI integration, Retell AI, Ultravox, AI agents, conversational AI, voice assistants, AI agency platform, customer analytics, profit controls" />
        <meta name="robots" content="index, follow" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="language" content="English" />
        <meta name="author" content="SONTI LTD" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://knotie-ai.pro/" />
        <meta property="og:title" content="Knotie AI Pro - White-Label Voice AI Platform for Agencies" />
        <meta property="og:description" content="Transform your agency with Knotie AI Pro's white-label voice AI platform. Integrate VAPI, Retell, and Ultravox agents seamlessly with advanced analytics and profit controls." />
        <meta property="og:image" content="https://knotie-ai.pro/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Knotie AI Pro" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://knotie-ai.pro/" />
        <meta property="twitter:title" content="Knotie AI Pro - White-Label Voice AI Platform for Agencies" />
        <meta property="twitter:description" content="Transform your agency with Knotie AI Pro's white-label voice AI platform. Integrate VAPI, Retell, and Ultravox agents seamlessly." />
        <meta property="twitter:image" content="https://knotie-ai.pro/twitter-image.png" />
        <meta property="twitter:creator" content="@KnotieAI" />

        {/* Additional SEO Meta Tags */}
        <meta name="theme-color" content="#2563eb" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Canonical URL */}
        <link rel="canonical" href="https://knotie-ai.pro/" />

        {/* Favicon and Icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Knotie AI Pro",
              "alternateName": "SONTI LTD",
              "url": "https://knotie-ai.pro",
              "logo": "https://knotie-ai.pro/logo.png",
              "description": "White-label voice AI platform for agencies with VAPI, Retell, and Ultravox integration",
              "foundingDate": "2024",
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+44-808-501-3800",
                "contactType": "customer service",
                "email": "support@knotie-ai.pro"
              },
              "sameAs": [
                "https://twitter.com/KnotieAI",
                "https://github.com/avijeett007/knotie-ai-pro"
              ]
            })
          }}
        />

        {/* Structured Data - SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Knotie AI Pro",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "White-label voice AI platform for agencies with advanced analytics and customer management",
              "offers": {
                "@type": "Offer",
                "price": "149",
                "priceCurrency": "USD",
                "priceValidUntil": "2025-12-31"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "127"
              },
              "featureList": [
                "VAPI Integration",
                "Retell AI Integration",
                "Ultravox Integration",
                "White-label Customer Portals",
                "Advanced Analytics",
                "Profit Controls",
                "Multi-tenant Architecture"
              ]
            })
          }}
        />

        {/* Structured Data - WebSite with SearchAction */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Knotie AI Pro",
              "alternateName": "Knotie AI",
              "url": "https://knotie-ai.pro",
              "description": "The ultimate white-label voice AI platform for agencies. Integrate VAPI, Retell, Ultravox. Automate calls, appointments, and customer service with AI voice agents.",
              "publisher": {
                "@type": "Organization",
                "name": "SONTI LTD",
                "url": "https://knotie-ai.pro",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://knotie-ai.pro/og-image.png",
                  "width": 1200,
                  "height": 630
                },
                "sameAs": [
                  "https://twitter.com/KnotieAI",
                  "https://github.com/avijeett007/knotie-ai-pro"
                ],
                "contactPoint": {
                  "@type": "ContactPoint",
                  "telephone": "+44-808-501-3800",
                  "contactType": "Customer Service",
                  "email": "support@knotie-ai.pro",
                  "availableLanguage": "English"
                }
              },
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://knotie-ai.pro/search?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </Head>
      <main>
        <ConnectionWrapper />
      </main>
    </div>
  );
}