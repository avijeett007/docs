"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Tag, ExternalLink, Share2, Download } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import Head from "next/head";

interface ReleaseFeature {
  title: string;
  icon: string;
  description: string;
  details?: string[];
}

interface ActionRequired {
  title: string;
  description: string;
  items: string[];
}

interface InfrastructureFix {
  title: string;
  description: string;
}

interface BugFix {
  title: string;
  description: string;
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
  milestone?: string;
  keyFeatures: ReleaseFeature[];
  actionRequired?: ActionRequired;
  infrastructureFixes?: InfrastructureFix[];
  bugFixes?: BugFix[];
  upcomingFeatures?: string[];
  category: string;
  seoKeywords: string[];
}

interface ReleasePageProps {
  release: Release;
}

export const ReleasePage: React.FC<ReleasePageProps> = ({ release }) => {
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
        return "Enhancement Release";
      case "velocity-release":
        return "Velocity Update";
      default:
        return "Release";
    }
  };

  const categoryColor = getCategoryColor(release.category);
  const categoryBadge = getCategoryBadge(release.category);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${release.version}: ${release.title} - Knotie AI Pro`,
          text: release.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": `${release.version}: ${release.title}`,
    "description": release.description,
    "author": {
      "@type": "Organization",
      "name": "Knotie AI Pro Team",
      "url": "https://knotie-ai.pro"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Knotie AI Pro",
      "logo": {
        "@type": "ImageObject",
        "url": "https://knotie-ai.pro/logo.png"
      }
    },
    "datePublished": release.date,
    "dateModified": release.date,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://knotie-ai.pro/releases/${release.slug}`
    },
    "keywords": release.seoKeywords.join(", "),
    "articleSection": "Technology",
    "about": [
      {
        "@type": "Thing",
        "name": "Voice AI",
        "description": "Artificial Intelligence technology for voice interactions"
      },
      {
        "@type": "Thing",
        "name": "SaaS Platform",
        "description": "Software as a Service platform for Voice AI agencies"
      }
    ]
  };

  return (
    <>
      <Head>
        <title>{release.version}: {release.title} - Knotie AI Pro Release Notes</title>
        <meta name="description" content={release.description} />
        <meta name="keywords" content={`Knotie AI Pro, ${release.seoKeywords.join(', ')}`} />
        <meta property="og:title" content={`${release.version}: ${release.title} - Knotie AI Pro`} />
        <meta property="og:description" content={release.description} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={release.date} />
        <meta property="article:tag" content="Voice AI" />
        <meta property="article:tag" content="Knotie AI Pro" />
        {release.seoKeywords.map((keyword, index) => (
          <meta key={index} property="article:tag" content={keyword} />
        ))}
        <link rel="canonical" href={`https://knotie-ai.pro/releases/${release.slug}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute inset-0 bg-gradient-to-br ${categoryColor} opacity-5`} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent" />
          
          {/* Animated particles */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 4 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          {/* Navigation */}
          <nav className="sticky top-0 z-20 backdrop-blur-lg bg-gray-900/90 border-b border-gray-800/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <Link href="/roadmap" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Roadmap</span>
                </Link>
                
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800/50"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="relative py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                {/* Category Badge */}
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r ${categoryColor} text-white mb-6`}>
                  {categoryBadge}
                </div>

                {/* Title */}
                <h1 className="text-5xl md:text-7xl font-bold mb-4">
                  <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    {release.version}
                  </span>
                </h1>
                <h2 className="text-3xl md:text-4xl font-bold text-blue-400 mb-6">
                  {release.title}
                </h2>

                {/* Meta Information */}
                <div className="flex flex-wrap items-center gap-6 text-gray-400 mb-8">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{release.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    <span>{release.week}</span>
                  </div>
                </div>

                {/* Theme */}
                <p className="text-xl md:text-2xl text-gray-300 leading-relaxed mb-8">
                  {release.theme}
                </p>

                {/* Description */}
                <div className="prose prose-lg prose-invert max-w-none">
                  <p className="text-gray-300 leading-relaxed text-lg">
                    {release.description}
                  </p>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Metaphor Section */}
          {release.metaphor && (
            <section className="py-16 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="relative p-8 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/30 backdrop-blur-sm"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${categoryColor} opacity-5 rounded-2xl`} />
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold text-white mb-4">The Story Behind the Name</h3>
                    <p className="text-gray-300 leading-relaxed text-lg italic">
                      {release.metaphor}
                    </p>
                  </div>
                </motion.div>
              </div>
            </section>
          )}

          {/* Milestone Section */}
          {release.milestone && (
            <section className="py-16 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="relative p-8 bg-gradient-to-r from-green-900/20 to-teal-900/20 rounded-2xl border border-green-700/30 backdrop-blur-sm"
                >
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold text-green-400 mb-4">🚀 Milestone Achievement</h3>
                    <p className="text-gray-300 leading-relaxed text-lg">
                      {release.milestone}
                    </p>
                  </div>
                </motion.div>
              </div>
            </section>
          )}

          {/* Key Features Section */}
          <section className="py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <h3 className="text-4xl font-bold text-white mb-4">What's New in This Release</h3>
                <p className="text-xl text-gray-400">
                  Discover the powerful features that unlock new possibilities for your Voice AI Agency
                </p>
              </motion.div>

              <div className="grid gap-8 md:grid-cols-2">
                {release.keyFeatures.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="group relative p-8 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700/30 backdrop-blur-sm hover:border-gray-600/50 transition-all duration-300"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${categoryColor} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />
                    
                    <div className="relative z-10">
                      {/* Feature Icon */}
                      <div className="text-4xl mb-4">{feature.icon}</div>
                      
                      {/* Feature Title */}
                      <h4 className="text-2xl font-bold text-white mb-4">{feature.title}</h4>
                      
                      {/* Feature Description */}
                      <p className="text-gray-300 leading-relaxed mb-6">
                        {feature.description}
                      </p>
                      
                      {/* Feature Details */}
                      {feature.details && (
                        <div className="space-y-3">
                          <h5 className="text-lg font-semibold text-blue-400">Key Benefits:</h5>
                          <ul className="space-y-2">
                            {feature.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start gap-3 text-gray-300">
                                <span className="text-blue-400 mt-1 text-sm">▶</span>
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Bug Fixes Section */}
          {release.bugFixes && release.bugFixes.length > 0 && (
            <section className="py-16 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h3 className="text-3xl font-bold text-white mb-8">🔧 Bug Fixes & Enhancements</h3>
                  <div className="space-y-6">
                    {release.bugFixes.map((fix, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        className="p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-xl border border-green-700/30 hover:border-green-600/50 transition-all duration-300"
                      >
                        <h4 className="text-xl font-semibold text-green-400 mb-3 flex items-center gap-3">
                          <span className="text-green-400">✅</span>
                          {fix.title}
                        </h4>
                        <p className="text-gray-300 leading-relaxed">{fix.description}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </section>
          )}

          {/* Infrastructure Fixes Section */}
          {release.infrastructureFixes && release.infrastructureFixes.length > 0 && (
            <section className="py-16 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h3 className="text-3xl font-bold text-white mb-8">Infrastructure Improvements</h3>
                  <div className="space-y-6">
                    {release.infrastructureFixes.map((fix, index) => (
                      <div key={index} className="p-6 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl border border-yellow-700/30">
                        <h4 className="text-xl font-semibold text-amber-400 mb-3">✅ {fix.title}</h4>
                        <p className="text-gray-300 leading-relaxed">{fix.description}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </section>
          )}

          {/* Action Required Section */}
          {release.actionRequired && (
            <section className="py-16 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="relative p-8 bg-gradient-to-r from-red-900/20 to-pink-900/20 rounded-2xl border border-red-700/30 backdrop-blur-sm"
                >
                  <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-red-400 mb-4">
                      🚨 {release.actionRequired.title}
                    </h3>
                    <p className="text-gray-300 leading-relaxed text-lg mb-6">
                      {release.actionRequired.description}
                    </p>
                    <div className="space-y-3">
                      <h4 className="text-xl font-semibold text-white">Required Actions:</h4>
                      <ul className="space-y-2">
                        {release.actionRequired.items.map((item, index) => (
                          <li key={index} className="flex items-start gap-3 text-gray-300">
                            <span className="text-red-400 mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>
          )}

          {/* Upcoming Features Section */}
          {release.upcomingFeatures && release.upcomingFeatures.length > 0 && (
            <section className="py-16 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h3 className="text-3xl font-bold text-white mb-8">🔮 Upcoming Features</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {release.upcomingFeatures.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        viewport={{ once: true }}
                        className="p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-700/30 hover:border-blue-600/50 transition-all duration-300"
                      >
                        <p className="text-gray-300 leading-relaxed flex items-start gap-3">
                          <span className="text-blue-400 mt-1 text-sm">▶</span>
                          <span>{feature}</span>
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </section>
          )}

          {/* SEO Content Section */}
          <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-gray-900/50 to-black/50">
            <div className="max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h3 className="text-3xl font-bold text-white mb-8">
                  Empowering Voice AI Agencies with Knotie AI Pro
                </h3>

                <div className="prose prose-lg prose-invert max-w-none space-y-6">
                  <p className="text-gray-300 leading-relaxed">
                    <strong>Knotie AI Pro</strong> continues to revolutionize the Voice AI industry by providing
                    cutting-edge solutions for Voice AI Agencies and marketing agencies. This release demonstrates
                    our commitment to supporting Voice AI reselling partners with enterprise-grade tools and
                    seamless integrations.
                  </p>

                  <p className="text-gray-300 leading-relaxed">
                    Whether you're working with <strong>VAPI</strong>, <strong>Retell</strong>, or <strong>Ultravox</strong>,
                    our platform provides unified management capabilities that streamline your Voice AI operations.
                    From advanced analytics to white-label solutions, we're building the future of Voice AI technology.
                  </p>

                  <p className="text-gray-300 leading-relaxed">
                    Join thousands of Voice AI Agencies who trust Knotie AI Pro to power their business growth.
                    Our platform combines the best of Voice AI innovation with practical business tools,
                    making it easier than ever to succeed in the rapidly evolving Voice AI landscape.
                  </p>
                </div>

                {/* Keywords Section */}
                <div className="mt-12 p-6 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <h4 className="text-lg font-semibold text-white mb-4">Related Topics</h4>
                  <div className="flex flex-wrap gap-2">
                    {release.seoKeywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-sm hover:bg-gray-600/50 transition-colors"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Call to Action Section */}
          <section className="py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h3 className="text-4xl font-bold text-white mb-6">
                  Ready to Experience {release.version}?
                </h3>
                <p className="text-xl text-gray-400 mb-8">
                  Join the Voice AI revolution and see how these features can transform your agency
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    className={`bg-gradient-to-r ${categoryColor} hover:opacity-90 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300`}
                  >
                    <Link href="/partners">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Become a Partner
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800/50 px-8 py-3"
                  >
                    <Link href="/roadmap">
                      View All Releases
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Footer Navigation */}
          <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <Link
                  href="/roadmap"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to All Releases
                </Link>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Share this release:</span>
                  <Button
                    onClick={handleShare}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default ReleasePage;
