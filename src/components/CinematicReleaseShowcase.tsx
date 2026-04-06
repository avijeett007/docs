"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Button } from "./ui/button";
import { X, ExternalLink, Play, Pause } from "lucide-react";
import Link from "next/link";
import releasesConfig from "../config/releases.json";

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

export const CinematicReleaseShowcase = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const releases = (releasesConfig as ReleasesConfig).releases;

  // Intersection Observer for performance optimization
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (!entry.isIntersecting) {
          setIsAutoPlaying(false);
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Auto-play functionality with performance optimization
  useEffect(() => {
    if (!isAutoPlaying || releases.length === 0 || !isInView) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % releases.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, releases.length, isInView]);

  // Pause auto-play when user is not viewing the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsAutoPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Parallax scroll effect
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const handleCardClick = (release: Release) => {
    setSelectedRelease(release);
    setIsAutoPlaying(false);
  };

  const closeModal = () => {
    setSelectedRelease(null);
    setIsAutoPlaying(true);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "major-release":
        return "from-blue-500 to-purple-600";
      case "improvement-release":
        return "from-green-500 to-teal-600";
      case "velocity-release":
        return "from-orange-500 to-red-600";
      default:
        return "from-gray-500 to-gray-700";
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "major-release":
        return "Major Release";
      case "improvement-release":
        return "Enhancement";
      case "velocity-release":
        return "Velocity Update";
      default:
        return "Release";
    }
  };

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-gradient-to-b from-gray-900 via-black to-gray-900">
      {/* Hero Section */}
      <motion.div 
        style={{ y, opacity }}
        className="relative min-h-screen flex items-center justify-center px-4 py-20"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-teal-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent" />
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          {/* Cinematic Title */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent mb-4">
              Our Journey
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Building SaaS is really difficult, but we're doing it with passion and commitment. 
              <span className="block mt-2 text-blue-400 font-semibold">
                Witness the evolution of Knotie AI Pro.
              </span>
            </p>
          </motion.div>

          {/* Auto-play Controls */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="mb-12 flex items-center justify-center gap-4"
          >
            <Button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              variant="outline"
              size="sm"
              className="bg-gray-800/50 border-gray-600 text-white hover:bg-gray-700/50"
            >
              {isAutoPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {isAutoPlaying ? "Pause" : "Play"} Journey
            </Button>
            <span className="text-sm text-gray-400">
              {currentIndex + 1} of {releases.length}
            </span>
          </motion.div>

          {/* Release Cards Showcase */}
          <div className="relative">
            <div className="flex justify-center items-center min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotateY: 15 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="relative"
                >
                  <ReleaseCard 
                    release={releases[currentIndex]} 
                    onClick={() => handleCardClick(releases[currentIndex])}
                    isActive={true}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation Dots */}
            <div className="flex justify-center mt-8 gap-2">
              {releases.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsAutoPlaying(false);
                  }}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? "bg-blue-400 scale-125" 
                      : "bg-gray-600 hover:bg-gray-500"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.5 }}
            className="mt-16"
          >
            <p className="text-gray-400 mb-6">
              Explore each release in detail and see how we're revolutionizing Voice AI
            </p>
            <Button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Explore All Releases
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Release Detail Modal */}
      <AnimatePresence>
        {selectedRelease && (
          <ReleaseModal release={selectedRelease} onClose={closeModal} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Release Card Component
const ReleaseCard: React.FC<{
  release: Release;
  onClick: () => void;
  isActive: boolean;
}> = ({ release, onClick, isActive }) => {
  const categoryColor = getCategoryColor(release.category);
  const categoryBadge = getCategoryBadge(release.category);

  return (
    <motion.div
      onClick={onClick}
      className={`relative cursor-pointer group ${
        isActive ? "scale-100" : "scale-90 opacity-70"
      } transition-all duration-500`}
      whileHover={{ scale: isActive ? 1.05 : 0.95, rotateY: 5 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative w-80 h-96 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700/50">
        {/* Background Gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${categoryColor} opacity-10`} />
        
        {/* Content */}
        <div className="relative z-10 p-6 h-full flex flex-col">
          {/* Header */}
          <div className="mb-4">
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${categoryColor} text-white mb-3`}>
              {categoryBadge}
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">{release.version}</h3>
            <h4 className="text-lg text-blue-400 font-semibold mb-2">{release.title}</h4>
            <p className="text-sm text-gray-400">{release.date} • {release.week}</p>
          </div>

          {/* Theme */}
          <div className="flex-1">
            <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
              {release.theme}
            </p>
          </div>

          {/* Features Preview */}
          <div className="mt-4">
            <div className="flex flex-wrap gap-1 mb-4">
              {release.keyFeatures.slice(0, 3).map((feature, index) => (
                <span key={index} className="text-xs px-2 py-1 bg-gray-700/50 rounded-full text-gray-300">
                  {feature.icon} {feature.title}
                </span>
              ))}
              {release.keyFeatures.length > 3 && (
                <span className="text-xs px-2 py-1 bg-gray-700/50 rounded-full text-gray-400">
                  +{release.keyFeatures.length - 3} more
                </span>
              )}
            </div>
          </div>

          {/* Hover Effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Glow Effect */}
        <div className={`absolute -inset-1 bg-gradient-to-r ${categoryColor} rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
      </div>
    </motion.div>
  );
};

// Helper functions (moved outside component to avoid re-creation)
const getCategoryColor = (category: string) => {
  switch (category) {
    case "major-release":
      return "from-blue-500 to-purple-600";
    case "improvement-release":
      return "from-green-500 to-teal-600";
    case "velocity-release":
      return "from-orange-500 to-red-600";
    default:
      return "from-gray-500 to-gray-700";
  }
};

const getCategoryBadge = (category: string) => {
  switch (category) {
    case "major-release":
      return "Major Release";
    case "improvement-release":
      return "Enhancement";
    case "velocity-release":
      return "Velocity Update";
    default:
      return "Release";
  }
};

// Release Modal Component
const ReleaseModal: React.FC<{
  release: Release;
  onClose: () => void;
}> = ({ release, onClose }) => {
  const categoryColor = getCategoryColor(release.category);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateX: -15 }}
        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
        exit={{ scale: 0.8, opacity: 0, rotateX: 15 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Effects */}
        <div className={`absolute inset-0 bg-gradient-to-br ${categoryColor} opacity-5 rounded-2xl`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 p-8">
          {/* Header */}
          <div className="mb-8">
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r ${categoryColor} text-white mb-4`}>
              {getCategoryBadge(release.category)}
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">{release.version}</h2>
            <h3 className="text-2xl text-blue-400 font-semibold mb-3">{release.title}</h3>
            <div className="flex items-center gap-4 text-gray-400 mb-4">
              <span>{release.date}</span>
              <span>•</span>
              <span>{release.week}</span>
            </div>
            <p className="text-lg text-gray-300 leading-relaxed">{release.theme}</p>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h4 className="text-xl font-semibold text-white mb-4">Release Overview</h4>
            <p className="text-gray-300 leading-relaxed">{release.description}</p>

            {release.metaphor && (
              <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border-l-4 border-blue-500">
                <p className="text-gray-300 italic leading-relaxed">{release.metaphor}</p>
              </div>
            )}
          </div>

          {/* Key Features */}
          <div className="mb-8">
            <h4 className="text-xl font-semibold text-white mb-6">Key Features</h4>
            <div className="grid gap-6">
              {release.keyFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/30 hover:border-gray-600/50 transition-colors"
                >
                  <div className="text-2xl">{feature.icon}</div>
                  <div className="flex-1">
                    <h5 className="text-lg font-semibold text-white mb-2">{feature.title}</h5>
                    <p className="text-gray-300 mb-3">{feature.description}</p>
                    {feature.details && (
                      <ul className="space-y-1">
                        {feature.details.map((detail, detailIndex) => (
                          <li key={detailIndex} className="text-sm text-gray-400 flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700/50">
            <Link href={`/releases/${release.slug}`} className="flex-1">
              <Button className={`w-full bg-gradient-to-r ${categoryColor} hover:opacity-90 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300`}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full Release Page
              </Button>
            </Link>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800/50 py-3"
            >
              Close
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CinematicReleaseShowcase;
