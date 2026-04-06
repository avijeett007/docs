'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiStar } from 'react-icons/fi';

interface Testimonial {
  name: string;
  company: string;
  role: string;
  content: string;
  rating: number;
}

interface TestimonialsBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TestimonialsBuilder({ value, onChange }: TestimonialsBuilderProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // Parse initial value
  useEffect(() => {
    try {
      if (value && value.trim()) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setTestimonials(parsed);
        }
      }
    } catch (error) {
      console.error('Error parsing testimonials JSON:', error);
    }
  }, [value]);

  // Update parent when testimonials change
  useEffect(() => {
    if (testimonials.length > 0) {
      onChange(JSON.stringify(testimonials, null, 2));
    } else {
      onChange('');
    }
  }, [testimonials, onChange]);

  const addTestimonial = () => {
    const newTestimonial: Testimonial = {
      name: '',
      company: '',
      role: '',
      content: '',
      rating: 5
    };
    setTestimonials([...testimonials, newTestimonial]);
  };

  const removeTestimonial = (index: number) => {
    setTestimonials(testimonials.filter((_, i) => i !== index));
  };

  const updateTestimonial = (index: number, field: keyof Testimonial, value: any) => {
    const updated = [...testimonials];
    updated[index] = { ...updated[index], [field]: value };
    setTestimonials(updated);
  };

  const renderStarRating = (testimonialIndex: number, currentRating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => updateTestimonial(testimonialIndex, 'rating', star)}
            className={`p-1 rounded transition-colors ${
              star <= currentRating
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-gray-600 hover:text-gray-500'
            }`}
          >
            <FiStar className={`w-4 h-4 ${star <= currentRating ? 'fill-current' : ''}`} />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-400">({currentRating}/5)</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium">Testimonials Section</h4>
        <button
          type="button"
          onClick={addTestimonial}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Testimonial
        </button>
      </div>

      {testimonials.length === 0 ? (
        <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400">No testimonials added yet. Click "Add Testimonial" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <span className="text-green-400 font-semibold text-sm">
                      {testimonial.name ? testimonial.name.charAt(0).toUpperCase() : 'T'}
                    </span>
                  </div>
                  <span className="text-white font-medium">Testimonial {index + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTestimonial(index)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Name</label>
                  <input
                    type="text"
                    value={testimonial.name}
                    onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Company</label>
                  <input
                    type="text"
                    value={testimonial.company}
                    onChange={(e) => updateTestimonial(index, 'company', e.target.value)}
                    placeholder="ABC Corp"
                    className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Role</label>
                  <input
                    type="text"
                    value={testimonial.role}
                    onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                    placeholder="CEO"
                    className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white mb-2">Testimonial Content</label>
                <textarea
                  value={testimonial.content}
                  onChange={(e) => updateTestimonial(index, 'content', e.target.value)}
                  placeholder="This service has been amazing for our business..."
                  rows={3}
                  className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Rating</label>
                {renderStarRating(index, testimonial.rating)}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-gray-500 text-xs">
        Add customer testimonials to build trust and credibility. Include the customer's name, company, role, testimonial content, and star rating.
      </p>
    </div>
  );
}
