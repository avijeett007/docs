'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiHelpCircle } from 'react-icons/fi';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQsBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FAQsBuilder({ value, onChange }: FAQsBuilderProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  // Parse initial value
  useEffect(() => {
    try {
      if (value && value.trim()) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setFaqs(parsed);
        }
      }
    } catch (error) {
      console.error('Error parsing FAQs JSON:', error);
    }
  }, [value]);

  // Update parent when FAQs change
  useEffect(() => {
    if (faqs.length > 0) {
      onChange(JSON.stringify(faqs, null, 2));
    } else {
      onChange('');
    }
  }, [faqs, onChange]);

  const addFAQ = () => {
    const newFAQ: FAQ = {
      question: '',
      answer: ''
    };
    setFaqs([...faqs, newFAQ]);
  };

  const removeFAQ = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const updateFAQ = (index: number, field: keyof FAQ, value: string) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    setFaqs(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium">FAQs Section</h4>
        <button
          type="button"
          onClick={addFAQ}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add FAQ
        </button>
      </div>

      {faqs.length === 0 ? (
        <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400">No FAQs added yet. Click "Add FAQ" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <FiHelpCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-white font-medium">FAQ {index + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFAQ(index)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Question */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white mb-2">Question</label>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                  placeholder="How does it work?"
                  className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                />
              </div>

              {/* Answer */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Answer</label>
                <textarea
                  value={faq.answer}
                  onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                  placeholder="Provide a detailed answer to help your customers understand..."
                  rows={3}
                  className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 p-2.5"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-gray-500 text-xs">
        Create frequently asked questions to help customers understand your service better. Provide clear and helpful answers.
      </p>
    </div>
  );
}
