export interface HeroConfig {
  statusMessages: {
    ready: string;
    listening: string;
    processing: string;
  };
  hero: {
    title: string;
    subtitle: string;
    description: string;
  };
  buttons: {
    primary: {
      text: string;
      link: string;
    };
    secondary: {
      text: string;
      link: string;
    };
  };
}

export interface BenefitItem {
  number: string;
  title: string;
  description: string;
  stats: string[];
  isPrimary: boolean;
}

export interface BenefitsConfig {
  title: string;
  benefits: BenefitItem[];
}

export interface FeatureItem {
  title: string;
  description: string;
  iconName: string;
  isUpcoming?: boolean;
  comingSoonDate?: string;
}

export interface FeaturesConfig {
  title: {
    main: string;
    highlight: string;
  };
  currentFeatures: FeatureItem[];
  upcomingFeatures: {
    sectionTitle: string;
    features: FeatureItem[];
  };
}

export interface FooterLink {
  text: string;
  href: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface FooterConfig {
  sections: {
    company: FooterSection;
    legal: FooterSection;
    support: FooterSection;
    social: FooterSection;
  };
  copyright: string;
}

export interface NavigationLink {
  text: string;
  to: string;
}

export interface SocialLink {
  platform: string;
  icon: string;
  url: string;
  hoverColor?: string;
}

export interface NavigationConfig {
  brand: {
    name: string;
    suffix: string;
  };
  navigation: NavigationLink[];
  social: SocialLink[];
  buttons: {
    pricing: {
      text: string;
    };
    dashboard: {
      text: string;
    };
  };
}

export interface PricingTier {
  name: string;
  description: string;
  price: {
    amount: number;
    currency: string;
    period: string;
  };
  features: string[];
  buttonText: string;
  isPopular?: boolean;
}

export interface PricingConfig {
  title: {
    main: string;
    highlight: string;
  };
  description: string;
  tiers: PricingTier[];
}
