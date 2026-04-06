"use client";
import React, { useState, useEffect } from 'react';
import { Star, Quote, ArrowRight, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReviewsMemberCounter } from '../ui/animated-counter';
import { ClientOnly } from '../ui/client-only';
import { HeroMemberCounter } from '../ui/animated-counter';

/**
 * Validates if a URL is from a trusted YouTube domain
 * @param hostname - The hostname to validate
 * @returns true if the hostname is a valid YouTube domain
 */
const isValidYouTubeDomain = (hostname: string): boolean => {
  const validDomains = ['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com'];
  return validDomains.includes(hostname);
};

/**
 * Extracts video ID from YouTube URL with strict domain validation
 * @param url - YouTube URL to parse
 * @returns Video ID or null if invalid
 */
const extractYouTubeVideoId = (url: string): string | null => {
  try {
    const urlObj = new URL(url);

    // Strict domain validation
    if (!isValidYouTubeDomain(urlObj.hostname)) {
      console.warn(`Invalid YouTube domain: ${urlObj.hostname}`);
      return null;
    }

    let videoId = '';

    // Extract video ID based on URL format
    if (urlObj.hostname === 'youtu.be' || urlObj.hostname === 'www.youtu.be') {
      videoId = urlObj.pathname.slice(1).split('?')[0];
    } else {
      videoId = urlObj.searchParams.get('v') || '';
    }

    // Validate video ID format (YouTube video IDs are 11 characters)
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return videoId;
    }

    console.warn(`Invalid YouTube video ID format: ${videoId}`);
    return null;
  } catch (error) {
    console.error('Error extracting YouTube video ID:', error);
    return null;
  }
};

/**
 * Converts YouTube URL to embed URL with timestamp support
 * @param url - YouTube URL with optional timestamp
 * @returns Embed URL or fallback placeholder URL
 */
const getYouTubeEmbedUrl = (url: string): string => {
  const FALLBACK_VIDEO_ID = 'dQw4w9WgXcQ'; // Fallback to a safe default video

  try {
    const urlObj = new URL(url);
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      console.error('Failed to extract valid video ID from URL:', url);
      return `https://www.youtube.com/embed/${FALLBACK_VIDEO_ID}`;
    }

    let startTime = 0;

    // Extract timestamp with validation
    const tParam = urlObj.searchParams.get('t');
    if (tParam) {
      // Parse formats like "42m22s", "3258s", "1h02m32s"
      const hours = tParam.match(/(\d+)h/);
      const minutes = tParam.match(/(\d+)m/);
      const seconds = tParam.match(/(\d+)s/);

      startTime =
        (hours ? parseInt(hours[1], 10) * 3600 : 0) +
        (minutes ? parseInt(minutes[1], 10) * 60 : 0) +
        (seconds ? parseInt(seconds[1], 10) : 0);

      // Validate timestamp is reasonable (not negative, not more than 24 hours)
      if (startTime < 0 || startTime > 86400) {
        console.warn(`Invalid timestamp: ${startTime}s, ignoring`);
        startTime = 0;
      }
    }

    return `https://www.youtube.com/embed/${videoId}${startTime ? `?start=${startTime}` : ''}`;
  } catch (error) {
    console.error('Error parsing YouTube URL:', error);
    return `https://www.youtube.com/embed/${FALLBACK_VIDEO_ID}`;
  }
};

/**
 * Gets YouTube thumbnail URL with multiple quality fallbacks
 * @param url - YouTube URL
 * @returns Thumbnail URL or placeholder image
 */
const getYouTubeThumbnail = (url: string): string => {
  const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"%3E%3Crect fill="%23374151" width="1280" height="720"/%3E%3Ctext fill="%239CA3AF" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EVideo Thumbnail%3C/text%3E%3C/svg%3E';

  try {
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      console.error('Failed to extract valid video ID for thumbnail:', url);
      return PLACEHOLDER_IMAGE;
    }

    // Return highest quality thumbnail URL
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  } catch (error) {
    console.error('Error getting YouTube thumbnail:', error);
    return PLACEHOLDER_IMAGE;
  }
};

const reviews = [
  {
    name: "Peter",
    company: "AI Prompt Net",
    role: "Owner (Europe)",
    content: "Knotie-AI Pro solved our biggest challenge - client retention. Before, clients would discover VAPI directly and cut us out. Now with the white-label platform, they see everything as our service. Game changer for European agencies.",
    rating: 5,
    avatar: "P",
    videoUrl: "https://www.youtube.com/watch?v=BJrXFMjMk48&t=42m22s",
    hasVideo: true
  },
  {
    name: "Marcelo",
    company: "Vibethink AI",
    role: "Founder (Colombia)",
    content: "The multi-provider comparison feature is incredible. We save 40% on costs by automatically choosing the cheapest provider for each client. Our margins improved dramatically since switching to Knotie-AI Pro.",
    rating: 5,
    avatar: "ME",
    videoUrl: "https://www.youtube.com/watch?v=FtWOhIEKQqE&t=3258s",
    hasVideo: true
  },
  {
    name: "Alfred",
    company: "Delaren Consulting",
    role: "AI Agency Owner",
    content: "Finally, a platform built for agencies by someone who understands our struggles. The GHL integration is seamless - our existing clients got Voice AI without changing their workflow. Perfect solution.",
    rating: 5,
    avatar: "A",
    videoUrl: "https://www.youtube.com/watch?v=-RoZyLR_v6E&t=1h02m32s",
    hasVideo: true
  },
  {
    name: "Sarah M.",
    company: "VoiceFlow Agency",
    role: "Founder",
    content: "The weekly livestreams and community support are amazing. Having direct access to the founder and getting help with implementation made all the difference for our agency.",
    rating: 5,
    avatar: "SM",
    hasVideo: false
  },
  {
    name: "David K.",
    company: "Smart Voice Solutions",
    role: "Co-Founder",
    content: "ROI was immediate. The platform pays for itself with just 2-3 clients. The N8N integration locked in our automation clients - they can't leave us now.",
    rating: 5,
    avatar: "DK",
    hasVideo: false
  },
  {
    name: "Lisa R.",
    company: "AI First Agency",
    role: "Managing Partner",
    content: "Setup was incredibly smooth. We had our first client portal live in under 20 minutes. The support team truly cares about our success - they're building in public and listening to feedback.",
    rating: 5,
    avatar: "LR",
    hasVideo: false
  }
];

const ReviewCard = ({
  review,
  index,
  onVideoClick,
  isDark
}: {
  review: typeof reviews[0],
  index: number,
  onVideoClick: (review: typeof reviews[0]) => void,
  isDark: boolean
}) => {
  const [thumbnailError, setThumbnailError] = React.useState(false);
  const [isImageLoading, setIsImageLoading] = React.useState(true);

  /**
   * Handles thumbnail loading errors with progressive quality fallback
   * Tries multiple quality levels before showing error state
   */
  const handleThumbnailError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;

    // Progressive quality fallback chain: maxres -> hq -> mq -> default -> error
    if (currentSrc.includes('maxresdefault')) {
      target.src = currentSrc.replace('maxresdefault', 'hqdefault');
    } else if (currentSrc.includes('hqdefault')) {
      target.src = currentSrc.replace('hqdefault', 'mqdefault');
    } else if (currentSrc.includes('mqdefault')) {
      target.src = currentSrc.replace('mqdefault', 'default');
    } else {
      // Final fallback - show error state
      setThumbnailError(true);
      setIsImageLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={`
        ${isDark
          ? 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-blue-400/20 hover:border-blue-400/40 hover:shadow-blue-500/10'
          : 'bg-white/80 border-gray-200/50 hover:border-teal-300/50 hover:shadow-teal-500/10'
        }
        backdrop-blur-md p-6 rounded-xl border transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl relative overflow-hidden
      `}
    >
      <div className="flex items-center mb-4">
        <div className={`
          w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center font-bold text-sm mr-4
          ${isDark ? 'text-white' : 'text-white'}
        `}>
          {review.avatar}
        </div>
        <div>
          <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{review.name}</h4>
          <p className={`text-sm ${isDark ? 'text-blue-200/70' : 'text-gray-600'}`}>{review.role}</p>
          <p className={`text-sm font-medium ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{review.company}</p>
        </div>
      </div>

      <div className="flex items-center mb-3">
        {[...Array(review.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
        ))}
      </div>

      <div className="relative">
        <Quote className={`w-6 h-6 absolute -top-2 -left-1 ${isDark ? 'text-blue-400/30' : 'text-teal-400/30'}`} />
        <p className={`leading-relaxed pl-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{review.content}</p>
      </div>

      {review.hasVideo && review.videoUrl && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          {/* Video thumbnail preview */}
          <div className="relative mb-3 rounded-lg overflow-hidden group cursor-pointer" onClick={() => onVideoClick(review)}>
            <div className="aspect-video bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center relative">
              {/* Loading state */}
              {isImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
                  <div className="w-12 h-12 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
              )}

              {/* YouTube thumbnail with progressive fallback */}
              {/* Note: Using <img> instead of Next.js <Image> because we need dynamic */}
              {/* progressive fallback (maxres -> hq -> mq -> default) which requires */}
              {/* runtime src manipulation in onError handler */}
              {!thumbnailError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getYouTubeThumbnail(review.videoUrl)}
                  alt={`${review.name} video testimonial`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  onLoad={() => setIsImageLoading(false)}
                  onError={handleThumbnailError}
                />
              ) : (
                // Final error state - show placeholder
                <div className="absolute inset-0 bg-gradient-to-br from-gray-700/50 to-gray-800/50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-600/50 rounded-full flex items-center justify-center mb-2 mx-auto">
                      <Play className="w-8 h-8 text-gray-400 fill-current" />
                    </div>
                    <p className="text-gray-400 text-xs">Video Preview</p>
                  </div>
                </div>
              )}

              {/* Play button overlay */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:bg-red-700 transition-colors shadow-lg">
                  <Play className="w-8 h-8 text-white fill-current ml-1" />
                </div>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </div>

          <button
            onClick={() => onVideoClick(review)}
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors group w-full justify-center"
          >
            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <Play className="w-3 h-3 text-blue-400 fill-current" />
            </div>
            <span>Watch Video Testimonial</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

// Video Modal Component with Error Boundary
const VideoModal = ({
  review,
  isOpen,
  onClose,
  isDark
}: {
  review: typeof reviews[0] | null,
  isOpen: boolean,
  onClose: () => void,
  isDark: boolean
}) => {
  const [videoError, setVideoError] = React.useState(false);

  // Reset error state when modal opens with new video
  React.useEffect(() => {
    if (isOpen) {
      setVideoError(false);
    }
  }, [isOpen, review?.videoUrl]);

  // Cleanup on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      // Cleanup function runs when component unmounts
      if (isOpen) {
        onClose();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!review || !isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-modal-title"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative ${
            isDark ? 'bg-gray-900' : 'bg-white'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10 ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900'
            }`}
            aria-label="Close video modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Video content */}
          <div className="mb-6">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {review.videoUrl && !videoError ? (
                <iframe
                  src={getYouTubeEmbedUrl(review.videoUrl)}
                  title={`${review.name} - ${review.company} Video Testimonial`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ border: 0 }}
                  onError={() => setVideoError(true)}
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-500/30 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <Play className="w-10 h-10 text-blue-400 fill-current" />
                    </div>
                    <p className="text-blue-200 text-lg font-medium mb-2">Video Testimonial</p>
                    <p className="text-gray-400 text-sm mb-4">
                      {videoError ? 'Unable to load video' : 'Video not available'}
                    </p>
                    {review.videoUrl && (
                      <a
                        href={review.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Watch on YouTube
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Review details */}
          <div className={`border-t pt-6 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-4">
                {review.avatar}
              </div>
              <div>
                <h4 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{review.name}</h4>
                <p className={`${isDark ? 'text-blue-200/70' : 'text-gray-600'}`}>{review.role}</p>
                <p className={`font-medium ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{review.company}</p>
              </div>
            </div>

            <div className="flex items-center mb-4">
              {[...Array(review.rating)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
              ))}
            </div>

            <p className={`leading-relaxed text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{review.content}</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const ReviewsSection = () => {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<typeof reviews[0] | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Only access theme context after mounting
    try {
      const themeContext = document.documentElement.classList.contains('dark');
      setIsDark(themeContext);
    } catch (error) {
      // Fallback to light theme if context is not available
      setIsDark(false);
    }
  }, []);

  // Show loading state during SSR
  if (!mounted) {
    return (
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4 animate-pulse"></div>
            <div className="h-6 bg-gray-200 rounded w-96 mx-auto animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="h-32 bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const handleVideoClick = (review: typeof reviews[0]) => {
    setSelectedVideo(review);
    setIsVideoModalOpen(true);
  };

  const closeVideoModal = () => {
    setIsVideoModalOpen(false);
    setSelectedVideo(null);
  };

  return (
    <section className={`py-20 px-4 relative overflow-hidden ${
      isDark
        ? 'bg-[#0A0A0B]'
        : 'bg-gradient-to-b from-[#F8FAFC] to-[#F2F9F9]/57'
    }`}>
      {/* Background Effects */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-transparent via-blue-900/5 to-transparent'
          : 'bg-gradient-to-b from-transparent via-teal-50/30 to-transparent'
      }`} />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          {/* 5 Stars */}
          <div className="flex justify-center items-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-cyan-400 fill-current" />
            ))}
          </div>

          {/* Main Title */}
          <h2 className={`text-4xl md:text-6xl font-bold mb-6 tracking-tight ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Trusted by Leading{' '}
            <span className="text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text">
              AI Agencies
            </span>
          </h2>

          {/* Subtitle */}
          <p className={`text-xl md:text-2xl mb-12 max-w-4xl mx-auto leading-relaxed ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Join <ClientOnly fallback={<span className="text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text font-bold">250+</span>}>
              <span className="text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text font-bold">
                <HeroMemberCounter />
              </span>
            </ClientOnly> agencies that are building the future using Voice AI with us.
          </p>
        </motion.div>

        {/* Testimonials Grid - Show only first 3 with video links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {reviews.slice(0, 3).map((review, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`
                rounded-xl p-6 border relative
                ${isDark
                  ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm'
                  : 'bg-white/80 border-gray-200/50 backdrop-blur-sm'
                }
              `}
            >
              {/* 5 Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-cyan-400 fill-current" />
                ))}
              </div>

              {/* Testimonial Content */}
              <blockquote className={`text-base mb-6 leading-relaxed ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                "{review.content}"
              </blockquote>

              {/* Author Info */}
              <div className="mb-4">
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {review.name}, {review.role}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {review.company}
                </div>
              </div>

              {/* Watch Video Link */}
              {review.hasVideo && review.videoUrl && (
                <button
                  onClick={() => handleVideoClick(review)}
                  className={`
                    inline-flex items-center gap-2 text-sm font-medium transition-colors
                    ${isDark
                      ? 'text-cyan-400 hover:text-cyan-300'
                      : 'text-cyan-600 hover:text-cyan-500'
                    }
                  `}
                >
                  Watch the full testimonial
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <button
            onClick={() => {
              // Scroll to the main Get Started button or open signup modal
              const getStartedButton = document.querySelector('[data-action="get-started"]');
              if (getStartedButton) {
                getStartedButton.scrollIntoView({ behavior: 'smooth' });
              } else {
                // Fallback: scroll to hero section
                const heroSection = document.getElementById('knotie-dashboard');
                if (heroSection) {
                  heroSection.scrollIntoView({ behavior: 'smooth' });
                }
              }
            }}
            className={`
              inline-flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 group
              ${isDark
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg hover:shadow-xl'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg hover:shadow-xl'
              }
            `}
          >
            <span>Start Building Your Voice AI Empire</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </motion.div>
      </div>

      {/* Video Modal */}
      <VideoModal
        review={selectedVideo}
        isOpen={isVideoModalOpen}
        onClose={closeVideoModal}
        isDark={isDark}
      />
    </section>
  );
};

export default ReviewsSection;
