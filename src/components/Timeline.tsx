"use client";
import React, { useRef, useState, useEffect } from "react";
import { useMotionValueEvent, useScroll, useTransform, motion } from "framer-motion";
import { Button } from "./ui/button";
import Image from "next/image";
import timelineConfig from "../config/timeline.json";
import releasesConfig from "../config/releases.json";

interface TimelineImage {
  src: string;
  alt: string;
}

interface TimelineContent {
  text: string;
  items: string[];
  images?: TimelineImage[];
}

interface TimelineEntry {
  title: string;
  type: "changelog" | "roadmap";
  content: TimelineContent;
}

interface TimelineCTA {
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
}

interface TimelineConfig {
  sections: TimelineEntry[];
  partnerCTA: TimelineCTA;
}

// Release interfaces
interface ReleaseFeature {
  title: string;
  icon: string;
  description: string;
  details?: string[];
}

interface Release {
  id: string;
  version: string;
  title: string;
  date: string;
  week: string;
  slug: string;
  theme: string;
  description: string;
  metaphor?: string;
  keyFeatures: ReleaseFeature[];
  category: string;
  seoKeywords: string[];
}

interface ReleasesConfig {
  releases: Release[];
  seoConfig: {
    baseTitle: string;
    baseDescription: string;
    keywords: string[];
  };
}

export const Timeline = () => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  const config = timelineConfig as TimelineConfig;
  const releases = releasesConfig as ReleasesConfig;

  // Convert releases to timeline format
  const releaseTimelineEntries: TimelineEntry[] = releases.releases.map((release) => ({
    title: `${release.date} - ${release.version}`,
    type: "changelog" as const,
    content: {
      text: `${release.title}: ${release.description}`,
      items: release.keyFeatures.map(feature => `✅ ${feature.title}: ${feature.description}`),
      images: []
    }
  }));

  // Combine releases with existing roadmap items (keeping future roadmap items)
  const futureRoadmapItems = config.sections.filter(item =>
    item.type === "roadmap" &&
    (item.title.includes("2025 - Q3") || item.title.includes("2025 - Q4") || item.title.includes("Week 21") || item.title.includes("Week 22") || item.title.includes("Week 23") || item.title.includes("Week 24"))
  );

  const combinedSections = [...releaseTimelineEntries, ...futureRoadmapItems];

  return (
    <div className="w-full font-sans md:px-10" ref={containerRef}>
      <div className="max-w-7xl mx-auto py-20 px-4 md:px-8 lg:px-10">
        <h2 className="text-lg md:text-4xl mb-4 text-white max-w-4xl">
          Our Journey & Vision
        </h2>
        <p className="text-gray-300 text-sm md:text-base max-w-sm">
          Track our progress and see what's coming next
        </p>
      </div>

      <div ref={ref} className="relative max-w-7xl mx-auto pb-20">
        {combinedSections.map((item, index) => (
          <div key={index} className="flex justify-start pt-10 md:pt-40 md:gap-10">
            <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
              <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-gray-900 flex items-center justify-center">
                <div className={`h-4 w-4 rounded-full ${
                  item.type === "changelog"
                    ? "bg-green-500/20 border-green-500"
                    : "bg-indigo-500/20 border-indigo-500"
                } border p-2`} />
              </div>
              <h3 className="hidden md:block text-xl md:pl-20 md:text-5xl font-bold text-gray-400">
                {item.title}
              </h3>
            </div>

            <div className="relative pl-20 pr-4 md:pl-4 w-full">
              <h3 className="md:hidden block text-2xl mb-4 text-left font-bold text-gray-400">
                {item.title}
              </h3>
              <div>
                <p className="text-white text-xs md:text-sm font-normal mb-4">
                  {item.content.text}
                </p>
                <div className="mb-8">
                  {item.content.items.map((listItem, idx) => (
                    <div key={idx} className="flex gap-2 items-center text-gray-300 text-xs md:text-sm mb-2">
                      {listItem}
                    </div>
                  ))}
                </div>
                {item.content.images && item.content.images.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {item.content.images.map((image, idx) => (
                      <div key={idx} className="relative h-40 md:h-60 w-full overflow-hidden rounded-lg shadow-xl">
                        <Image
                          src={image.src}
                          alt={image.alt}
                          fill
                          className="object-cover transform transition-transform duration-300 hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div
          style={{
            height: height + "px",
          }}
          className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-gray-700 to-transparent to-[99%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
        >
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t from-indigo-500 via-[#80caff] to-transparent from-[0%] via-[10%] rounded-full"
          />
        </div>
      </div>

      {/* Partner CTA Section */}
      <div className="max-w-7xl mx-auto py-20 px-4 md:px-8 lg:px-10 text-center">
        <h3 className="text-2xl md:text-3xl font-bold mb-4 text-white">
          {config.partnerCTA.title}
        </h3>
        <p className="text-gray-300 mb-8">
          {config.partnerCTA.description}
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Button
            onClick={() => window.location.href = config.partnerCTA.buttonLink}
            className="bg-indigo-500 text-white px-8 py-6 rounded-lg hover:bg-indigo-400 transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            {config.partnerCTA.buttonText}
          </Button>

          {config.partnerCTA.secondaryButtonText && config.partnerCTA.secondaryButtonLink && (
            <Button
              onClick={() => window.open(config.partnerCTA.secondaryButtonLink, '_blank')}
              className="bg-gray-700 text-white px-8 py-6 rounded-lg hover:bg-gray-600 transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
            >
              {config.partnerCTA.secondaryButtonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
