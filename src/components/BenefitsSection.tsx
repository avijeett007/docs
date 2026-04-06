import React, { useState } from 'react';
import { Clock, TrendingUp, MessageSquare, BarChart } from 'lucide-react';
import benefitsConfig from '../config/dashboard/benefits.json';
import { BenefitItem } from '../config/types';

interface BenefitCardProps {
  benefit: BenefitItem;
  icon: React.ReactNode;
}

const BenefitCard: React.FC<BenefitCardProps> = ({
  benefit,
  icon,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { number, title, description, stats, isPrimary } = benefit;

  return (
    <div 
      className="group relative w-full md:w-[45%] lg:w-[23%] p-8 rounded-2xl 
                bg-gradient-to-br from-gray-900/70 via-gray-800/70 to-gray-900/70 backdrop-blur-lg
                border border-blue-400/20 hover:border-blue-400/40
                hover:scale-[1.02] transition-all duration-500 ease-out
                hover:shadow-xl hover:shadow-blue-500/5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient background effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10">
        <div className="text-6xl font-bold text-blue-400/10 mb-6 font-display tracking-tight">{number}</div>
        <div className="text-blue-400 mb-6 transform group-hover:scale-110 transition-transform duration-500 
                      group-hover:text-blue-300">
          {icon}
        </div>
        <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-100/90 bg-clip-text text-transparent mb-4">{title}</h3>
        <div className="relative h-[72px] overflow-hidden">
          <p className={`text-blue-100/70 transition-transform duration-[20s] ease-linear
                      ${isHovered ? 'animate-textScroll' : ''}`}>
            {description}
          </p>
        </div>
        <div className="mt-6 space-y-2.5 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="flex items-center space-x-2.5 text-sm font-medium bg-blue-500/10 
                       text-blue-200 rounded-full px-4 py-1.5 border border-blue-400/20"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-teal-400"></span>
              <span>{stat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const iconMap = {
  "24/7 Availability": <Clock className="w-8 h-8 stroke-[1.5]" />,
  "Cost Efficiency": <TrendingUp className="w-8 h-8 stroke-[1.5]" />,
  "Human-Like Interactions": <MessageSquare className="w-8 h-8 stroke-[1.5]" />,
  "Data-Driven Insights": <BarChart className="w-8 h-8 stroke-[1.5]" />
};

const BenefitsSection: React.FC = () => {
  return (
    <section className="pb-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white to-blue-100/90 bg-clip-text text-transparent">
              {benefitsConfig.title}
            </span>
          </h2>
          <p className="text-xl text-blue-200/70 max-w-3xl mx-auto font-light leading-relaxed">
            Say goodbye to missed opportunities. Transform your agency's potential with integrated voice AI management. 
            Scale your business by offering premium voice AI services to multiple clients from one powerful dashboard.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {benefitsConfig.benefits.map((benefit) => (
            <BenefitCard
              key={benefit.number}
              benefit={benefit}
              icon={iconMap[benefit.title as keyof typeof iconMap]}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
