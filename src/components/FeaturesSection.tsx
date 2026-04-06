import React from 'react';
import { Network, Waves, Link2, BarChart3, Globe, Languages, Mic } from 'lucide-react';
import featuresConfig from '../config/dashboard/features.json';
import { FeatureItem } from '../config/types';

interface FeatureProps {
  feature: FeatureItem;
  icon: React.ReactNode;
}

const iconMap: { [key: string]: React.ReactNode } = {
  Waves: <Waves className="w-8 h-8" />,
  Network: <Network className="w-8 h-8" />,
  BarChart3: <BarChart3 className="w-8 h-8" />,
  Globe: <Globe className="w-8 h-8" />,
  Languages: <Languages className="w-8 h-8" />,
  Mic: <Mic className="w-8 h-8" />,
  Link2: <Link2 className="w-8 h-8" />
};

const Feature: React.FC<FeatureProps> = ({ feature, icon }) => {
  const { title, description, isUpcoming, comingSoonDate } = feature;
  
  return (
    <div className="relative p-6 rounded-xl backdrop-blur-sm bg-gradient-to-r from-blue-600/5 to-purple-600/5 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 group">
      {isUpcoming && (
        <div className="absolute -top-3 -right-3 bg-blue-500/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
          {comingSoonDate}
        </div>
      )}
      <div className="text-blue-400 mb-4 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className={`${isUpcoming ? 'text-blue-200/60' : 'text-blue-200/70'}`}>{description}</p>
    </div>
  );
};

const FeaturesSection: React.FC = () => {
  return (
    <div className="mt-4">
      {/* Section Title */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-3">
          {featuresConfig.title.main}
          <span className="text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text block mt-2">
            {featuresConfig.title.highlight}
          </span>
        </h2>
      </div>

      {/* Current Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {featuresConfig.currentFeatures.map((feature, i) => (
          <Feature 
            key={i} 
            feature={feature}
            icon={iconMap[feature.iconName]}
          />
        ))}
      </div>

      {/* Upcoming Features */}
      <div className="mt-16">
        <h3 className="text-2xl font-semibold text-white text-center mb-8">
          {featuresConfig.upcomingFeatures.sectionTitle}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {featuresConfig.upcomingFeatures.features.map((feature, i) => (
            <Feature 
              key={i} 
              feature={feature}
              icon={iconMap[feature.iconName]}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturesSection;
