import React from 'react';
import footerConfig from '../config/dashboard/footer.json';
import { FooterSection as FooterSectionType } from '../config/types';

interface FooterSectionProps {
  section: FooterSectionType;
}

const FooterSection: React.FC<FooterSectionProps> = ({ section }) => (
  <div>
    <h3 className="text-white font-semibold mb-4">{section.title}</h3>
    <ul className="space-y-2">
      {section.links.map((link, index) => (
        <li key={index}>
          <a 
            href={link.href} 
            className="hover:text-white transition-colors"
          >
            {link.text}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { sections, copyright } = footerConfig;

  return (
    <footer className="bg-gray-900 text-gray-400 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-8">
          <FooterSection section={sections.product} />
          <FooterSection section={sections.company} />
          <FooterSection section={sections.partners} />
          <FooterSection section={sections.support} />
          <FooterSection section={sections.legal} />
          <FooterSection section={sections.social} />
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p>&copy; {currentYear} {copyright}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
