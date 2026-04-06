'use client';

import { motion } from 'framer-motion';
import { FiStar, FiExternalLink } from 'react-icons/fi';
import { PartnerBranding } from '@/types/partner';

interface TestimonialsSectionProps {
  branding: PartnerBranding;
  getTranslation: (key: string, fallback?: string) => string;
}

// Testimonial keys for translation lookup
const testimonialKeys = ['sarah', 'mike', 'lisa'];

// Default testimonials for fallback
const defaultTestimonials = [
  { name: 'Sarah Johnson', role: 'Medical Practice Owner', content: 'Our AI receptionist has been a game-changer. We never miss appointments anymore, and patients love the 24/7 availability.', rating: 5, avatar: '👩‍⚕️' },
  { name: 'Mike Chen', role: 'Restaurant Manager', content: 'Reservations are handled perfectly, even during our busiest hours. It\'s like having a dedicated staff member who never takes a break.', rating: 5, avatar: '👨‍🍳' },
  { name: 'Lisa Rodriguez', role: 'Law Firm Partner', content: 'Professional, reliable, and always available. Our clients are impressed with the service quality and responsiveness.', rating: 5, avatar: '👩‍💼' }
];

export default function TestimonialsSection({ branding, getTranslation }: TestimonialsSectionProps) {
  // Build translated testimonials
  const buildTranslatedTestimonials = () => {
    return testimonialKeys.map((key, index) => ({
      name: getTranslation(`testimonials.items.${key}.name`, defaultTestimonials[index].name),
      role: getTranslation(`testimonials.items.${key}.role`, defaultTestimonials[index].role),
      content: getTranslation(`testimonials.items.${key}.content`, defaultTestimonials[index].content),
      rating: defaultTestimonials[index].rating,
      avatar: defaultTestimonials[index].avatar
    }));
  };

  // Parse custom testimonials if available, otherwise use translated defaults
  let testimonials = buildTranslatedTestimonials();

  if (branding.testimonials) {
    try {
      const customTestimonials = JSON.parse(branding.testimonials);
      if (Array.isArray(customTestimonials) && customTestimonials.length > 0) {
        testimonials = customTestimonials;
      }
    } catch (error) {
      console.warn('Failed to parse custom testimonials, using defaults');
    }
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {getTranslation('testimonials.title', 'What Our Customers Say')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {getTranslation('testimonials.subtitle', 'Join thousands of satisfied businesses who transformed their customer service with AI.')}
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating || 5)].map((_, i) => (
                  <FiStar
                    key={i}
                    className="text-yellow-400 fill-current"
                    size={16}
                  />
                ))}
              </div>

              {/* Content */}
              <blockquote className="text-gray-700 mb-6 italic">
                "{testimonial.content}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xl mr-4">
                  {testimonial.avatar || '👤'}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* More Testimonials Link - Only show if URL provided */}
        {branding.moreTestimonialsUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <a
              href={branding.moreTestimonialsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <span>{getTranslation('testimonials.readMore', 'Read More Reviews')}</span>
              <FiExternalLink className="w-4 h-4" />
            </a>
          </motion.div>
        )}

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8"
        >
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{getTranslation('testimonials.stats.callsHandled.value', '10,000+')}</div>
              <div className="text-gray-600">{getTranslation('testimonials.stats.callsHandled.label', 'Calls Handled')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{getTranslation('testimonials.stats.uptime.value', '99.9%')}</div>
              <div className="text-gray-600">{getTranslation('testimonials.stats.uptime.label', 'Uptime')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{getTranslation('testimonials.stats.availability.value', '24/7')}</div>
              <div className="text-gray-600">{getTranslation('testimonials.stats.availability.label', 'Availability')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{getTranslation('testimonials.stats.setupTime.value', '5 Min')}</div>
              <div className="text-gray-600">{getTranslation('testimonials.stats.setupTime.label', 'Setup Time')}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
