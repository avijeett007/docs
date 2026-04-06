export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  // Professional Services
  { id: 'legal', name: 'Legal Services', description: 'Law firms, attorneys, legal consultants' },
  { id: 'accounting', name: 'Accounting & Finance', description: 'CPAs, bookkeepers, financial advisors' },
  { id: 'consulting', name: 'Business Consulting', description: 'Management, strategy, operations consulting' },
  { id: 'marketing', name: 'Marketing & Advertising', description: 'Digital marketing, advertising agencies' },
  { id: 'real-estate', name: 'Real Estate', description: 'Realtors, property management, real estate agencies' },
  { id: 'insurance', name: 'Insurance', description: 'Insurance agents, brokers, agencies' },
  
  // Healthcare & Wellness
  { id: 'healthcare', name: 'Healthcare', description: 'Medical practices, clinics, healthcare providers' },
  { id: 'dental', name: 'Dental', description: 'Dental offices, orthodontists, oral surgeons' },
  { id: 'veterinary', name: 'Veterinary', description: 'Veterinary clinics, animal hospitals' },
  { id: 'fitness', name: 'Fitness & Wellness', description: 'Gyms, personal trainers, wellness centers' },
  { id: 'mental-health', name: 'Mental Health', description: 'Therapists, counselors, psychologists' },
  
  // Home & Property Services
  { id: 'hvac', name: 'HVAC', description: 'Heating, ventilation, air conditioning services' },
  { id: 'plumbing', name: 'Plumbing', description: 'Plumbers, pipe repair, water systems' },
  { id: 'electrical', name: 'Electrical', description: 'Electricians, electrical contractors' },
  { id: 'roofing', name: 'Roofing', description: 'Roof repair, installation, contractors' },
  { id: 'landscaping', name: 'Landscaping', description: 'Lawn care, garden design, tree services' },
  { id: 'cleaning', name: 'Cleaning Services', description: 'House cleaning, commercial cleaning' },
  { id: 'pest-control', name: 'Pest Control', description: 'Extermination, pest management' },
  { id: 'security', name: 'Security Services', description: 'Security systems, monitoring, guards' },
  
  // Automotive & Transportation
  { id: 'automotive', name: 'Automotive', description: 'Auto repair, car dealerships, mechanics' },
  { id: 'transportation', name: 'Transportation', description: 'Taxi, rideshare, delivery services' },
  
  // Beauty & Personal Care
  { id: 'beauty', name: 'Beauty & Salon', description: 'Hair salons, spas, beauty services' },
  { id: 'massage', name: 'Massage Therapy', description: 'Massage therapists, spa services' },
  
  // Food & Hospitality
  { id: 'restaurant', name: 'Restaurant & Food', description: 'Restaurants, catering, food delivery' },
  { id: 'hospitality', name: 'Hospitality', description: 'Hotels, bed & breakfast, vacation rentals' },
  
  // Technology & IT
  { id: 'it-services', name: 'IT Services', description: 'Computer repair, IT support, tech consulting' },
  { id: 'web-design', name: 'Web Design & Development', description: 'Website design, app development' },
  
  // Education & Training
  { id: 'education', name: 'Education & Training', description: 'Schools, tutoring, training centers' },
  { id: 'childcare', name: 'Childcare', description: 'Daycare, preschools, babysitting services' },
  
  // Retail & E-commerce
  { id: 'retail', name: 'Retail', description: 'Stores, shops, retail businesses' },
  { id: 'ecommerce', name: 'E-commerce', description: 'Online stores, dropshipping, digital products' },
  
  // Construction & Contracting
  { id: 'construction', name: 'Construction', description: 'General contractors, builders, construction' },
  { id: 'home-improvement', name: 'Home Improvement', description: 'Remodeling, renovation, handyman services' },
  
  // Other Services
  { id: 'photography', name: 'Photography', description: 'Wedding, portrait, commercial photography' },
  { id: 'event-planning', name: 'Event Planning', description: 'Wedding planners, event coordinators' },
  { id: 'travel', name: 'Travel & Tourism', description: 'Travel agencies, tour operators' },
  { id: 'nonprofit', name: 'Non-Profit', description: 'Charitable organizations, foundations' },
  { id: 'government', name: 'Government', description: 'Municipal services, government agencies' },
  { id: 'other', name: 'Other', description: 'Other business types not listed above' }
];

// Most popular/common service categories to show by default
export const POPULAR_CATEGORIES: ServiceCategory[] = [
  SERVICE_CATEGORIES.find(c => c.id === 'healthcare')!,
  SERVICE_CATEGORIES.find(c => c.id === 'dental')!,
  SERVICE_CATEGORIES.find(c => c.id === 'legal')!,
  SERVICE_CATEGORIES.find(c => c.id === 'real-estate')!,
  SERVICE_CATEGORIES.find(c => c.id === 'hvac')!,
  SERVICE_CATEGORIES.find(c => c.id === 'plumbing')!,
  SERVICE_CATEGORIES.find(c => c.id === 'electrical')!,
  SERVICE_CATEGORIES.find(c => c.id === 'automotive')!,
  SERVICE_CATEGORIES.find(c => c.id === 'restaurant')!,
  SERVICE_CATEGORIES.find(c => c.id === 'beauty')!,
  SERVICE_CATEGORIES.find(c => c.id === 'accounting')!,
  SERVICE_CATEGORIES.find(c => c.id === 'insurance')!,
  SERVICE_CATEGORIES.find(c => c.id === 'consulting')!,
  SERVICE_CATEGORIES.find(c => c.id === 'marketing')!,
  SERVICE_CATEGORIES.find(c => c.id === 'fitness')!,
  SERVICE_CATEGORIES.find(c => c.id === 'other')!
];

// Function to map AI-analyzed business category to our service categories
export function mapBusinessCategoryToServices(businessCategory: string, services: string[]): string[] {
  const category = businessCategory.toLowerCase();
  const servicesList = services.map(s => s.toLowerCase());
  const matchedCategories: string[] = [];

  // Direct category mappings
  const categoryMappings: Record<string, string[]> = {
    'healthcare': ['healthcare', 'dental', 'veterinary', 'mental-health'],
    'medical': ['healthcare', 'dental'],
    'dental': ['dental'],
    'veterinary': ['veterinary'],
    'legal': ['legal'],
    'law': ['legal'],
    'attorney': ['legal'],
    'restaurant': ['restaurant'],
    'food': ['restaurant'],
    'hospitality': ['hospitality', 'restaurant'],
    'hotel': ['hospitality'],
    'real estate': ['real-estate'],
    'realty': ['real-estate'],
    'property': ['real-estate'],
    'automotive': ['automotive'],
    'car': ['automotive'],
    'auto': ['automotive'],
    'beauty': ['beauty', 'massage'],
    'salon': ['beauty'],
    'spa': ['beauty', 'massage'],
    'fitness': ['fitness'],
    'gym': ['fitness'],
    'wellness': ['fitness', 'mental-health'],
    'technology': ['it-services', 'web-design'],
    'it': ['it-services'],
    'software': ['it-services', 'web-design'],
    'consulting': ['consulting'],
    'marketing': ['marketing'],
    'advertising': ['marketing'],
    'accounting': ['accounting'],
    'finance': ['accounting'],
    'insurance': ['insurance'],
    'construction': ['construction', 'home-improvement'],
    'contractor': ['construction', 'home-improvement'],
    'plumbing': ['plumbing'],
    'electrical': ['electrical'],
    'hvac': ['hvac'],
    'roofing': ['roofing'],
    'landscaping': ['landscaping'],
    'cleaning': ['cleaning'],
    'education': ['education'],
    'school': ['education'],
    'childcare': ['childcare'],
    'photography': ['photography'],
    'event': ['event-planning'],
    'travel': ['travel'],
    'nonprofit': ['nonprofit'],
    'government': ['government']
  };

  // Check business category
  for (const [key, categories] of Object.entries(categoryMappings)) {
    if (category.includes(key)) {
      matchedCategories.push(...categories);
    }
  }

  // Check individual services
  servicesList.forEach(service => {
    for (const [key, categories] of Object.entries(categoryMappings)) {
      if (service.includes(key)) {
        matchedCategories.push(...categories);
      }
    }
  });

  // Remove duplicates and return
  return [...new Set(matchedCategories)];
}
