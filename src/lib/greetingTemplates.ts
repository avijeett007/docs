export interface GreetingTemplate {
  id: string;
  template: string;
  serviceCategories: string[];
}

export const GREETING_TEMPLATES: GreetingTemplate[] = [
  // Legal Services
  {
    id: 'legal-1',
    template: "Hi, you've reached {businessName}. How can I help you today?",
    serviceCategories: ['legal']
  },
  {
    id: 'legal-2',
    template: "Thank you for calling {businessName}. What can I help you with?",
    serviceCategories: ['legal']
  },

  // Healthcare & Medical
  {
    id: 'healthcare-1',
    template: "Hello, this is {businessName}. How may I assist you?",
    serviceCategories: ['healthcare', 'dental', 'mental-health']
  },
  {
    id: 'healthcare-2',
    template: "Hi, you've reached {businessName}. What can I help you with today?",
    serviceCategories: ['healthcare', 'dental', 'mental-health']
  },

  // Home Services (HVAC, Plumbing, Electrical, etc.)
  {
    id: 'home-services-1',
    template: "Thank you for calling {businessName}. How can I help you?",
    serviceCategories: ['hvac', 'plumbing', 'electrical', 'roofing', 'landscaping', 'pest-control']
  },
  {
    id: 'home-services-2',
    template: "Hi, this is {businessName}. What can I do for you today?",
    serviceCategories: ['hvac', 'plumbing', 'electrical', 'roofing', 'landscaping', 'pest-control']
  },

  // Real Estate
  {
    id: 'real-estate-1',
    template: "Hello, you've reached {businessName}. How can I help you today?",
    serviceCategories: ['real-estate']
  },
  {
    id: 'real-estate-2',
    template: "Hi, this is {businessName}. What can I help you with?",
    serviceCategories: ['real-estate']
  },

  // Restaurant & Food
  {
    id: 'restaurant-1',
    template: "Thank you for calling {businessName}. How can I help you?",
    serviceCategories: ['restaurant']
  },
  {
    id: 'restaurant-2',
    template: "Hi, you've reached {businessName}. What can I do for you?",
    serviceCategories: ['restaurant']
  },

  // Beauty & Salon
  {
    id: 'beauty-1',
    template: "Hello, this is {businessName}. How may I help you today?",
    serviceCategories: ['beauty', 'massage']
  },
  {
    id: 'beauty-2',
    template: "Hi, you've reached {businessName}. What can I help you with?",
    serviceCategories: ['beauty', 'massage']
  },

  // Automotive
  {
    id: 'automotive-1',
    template: "Thank you for calling {businessName}. How can I assist you?",
    serviceCategories: ['automotive']
  },
  {
    id: 'automotive-2',
    template: "Hello, this is {businessName}. What can I help you with today?",
    serviceCategories: ['automotive']
  },

  // Professional Services (Accounting, Consulting, etc.)
  {
    id: 'professional-1',
    template: "Hi, you've reached {businessName}. How may I assist you today?",
    serviceCategories: ['accounting', 'consulting', 'marketing', 'insurance']
  },
  {
    id: 'professional-2',
    template: "Thank you for calling {businessName}. What can I help you with?",
    serviceCategories: ['accounting', 'consulting', 'marketing', 'insurance']
  },

  // Fitness & Wellness
  {
    id: 'fitness-1',
    template: "Hi, you've reached {businessName}. How can I help you today?",
    serviceCategories: ['fitness']
  },
  {
    id: 'fitness-2',
    template: "Thank you for calling {businessName}. What can I assist you with?",
    serviceCategories: ['fitness']
  },

  // Veterinary
  {
    id: 'veterinary-1',
    template: "Hello, this is {businessName}. How can I help you and your pet?",
    serviceCategories: ['veterinary']
  },
  {
    id: 'veterinary-2',
    template: "Hi, you've reached {businessName}. What can I do for you today?",
    serviceCategories: ['veterinary']
  },

  // IT Services & Technology
  {
    id: 'it-services-1',
    template: "Thank you for calling {businessName}. How may I assist you?",
    serviceCategories: ['it-services', 'web-design']
  },
  {
    id: 'it-services-2',
    template: "Hello, this is {businessName}. What can I help you with?",
    serviceCategories: ['it-services', 'web-design']
  },

  // Cleaning Services
  {
    id: 'cleaning-1',
    template: "Hi, you've reached {businessName}. How can I help you today?",
    serviceCategories: ['cleaning']
  },
  {
    id: 'cleaning-2',
    template: "Thank you for calling {businessName}. What can I do for you?",
    serviceCategories: ['cleaning']
  },

  // Education & Training
  {
    id: 'education-1',
    template: "Hello, this is {businessName}. How can I assist you today?",
    serviceCategories: ['education']
  },
  {
    id: 'education-2',
    template: "Hi, you've reached {businessName}. What can I help you with?",
    serviceCategories: ['education']
  },

  // Generic/Fallback Templates
  {
    id: 'generic-1',
    template: "Thank you for calling {businessName}. How can I help you today?",
    serviceCategories: []
  },
  {
    id: 'generic-2',
    template: "Hi, you've reached {businessName}. What can I do for you?",
    serviceCategories: []
  }
];

export function getGreetingForServices(serviceCategories: string[], businessName: string): string {
  // Find templates that match any of the selected service categories
  const matchingTemplates = GREETING_TEMPLATES.filter(template => 
    template.serviceCategories.length === 0 || // Generic templates
    template.serviceCategories.some(category => serviceCategories.includes(category))
  );

  // Prefer specific templates over generic ones
  const specificTemplates = matchingTemplates.filter(t => t.serviceCategories.length > 0);
  const templatesToUse = specificTemplates.length > 0 ? specificTemplates : matchingTemplates;

  // Select a random template from the matching ones
  const selectedTemplate = templatesToUse[Math.floor(Math.random() * templatesToUse.length)];
  
  // Replace {businessName} placeholder with actual business name
  return selectedTemplate.template.replace('{businessName}', businessName);
}
