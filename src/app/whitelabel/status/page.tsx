'use client';

import React from 'react';
import { usePartnerBranding } from '@/lib/partnerBranding';
import { getThemeConfig, PortalTheme } from '@/lib/portalThemes';
import { FiArrowLeft, FiActivity, FiCheckCircle, FiAlertCircle, FiClock } from 'react-icons/fi';
import Link from 'next/link';

export default function WhitelabelStatusPage() {
  const { branding } = usePartnerBranding();
  const themeConfig = getThemeConfig((branding?.themePreference as PortalTheme) || PortalTheme.MODERN);

  // Mock status data - in a real implementation, this would come from your monitoring system
  const systemStatus = {
    overall: 'operational', // operational, degraded, outage
    lastUpdated: new Date(),
    services: [
      { name: 'Voice AI Services', status: 'operational', uptime: '99.9%' },
      { name: 'API Gateway', status: 'operational', uptime: '99.8%' },
      { name: 'Analytics Dashboard', status: 'operational', uptime: '99.7%' },
      { name: 'Knowledge Base', status: 'operational', uptime: '99.9%' },
      { name: 'Webhook Processing', status: 'operational', uptime: '99.6%' }
    ],
    incidents: [
      {
        id: 1,
        title: 'Scheduled Maintenance - Database Optimization',
        status: 'resolved',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        description: 'Routine database maintenance completed successfully with no service interruption.'
      },
      {
        id: 2,
        title: 'Minor API Latency Issues',
        status: 'resolved',
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        description: 'Brief increase in API response times resolved by scaling infrastructure.'
      }
    ]
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <FiCheckCircle className={`w-5 h-5 text-green-400`} />;
      case 'degraded':
        return <FiAlertCircle className={`w-5 h-5 text-yellow-400`} />;
      case 'outage':
        return <FiAlertCircle className={`w-5 h-5 text-red-400`} />;
      default:
        return <FiClock className={`w-5 h-5 ${themeConfig.styleClasses.text.secondary}`} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-400';
      case 'degraded':
        return 'text-yellow-400';
      case 'outage':
        return 'text-red-400';
      default:
        return themeConfig.styleClasses.text.secondary;
    }
  };

  return (
    <div className={`min-h-screen ${themeConfig.styleClasses.container}`}>
      {/* Header */}
      <header className={`${themeConfig.styleClasses.header} border-b sticky top-0 z-10`}>
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className={`flex items-center ${themeConfig.styleClasses.text.secondary} hover:${themeConfig.styleClasses.text.primary} transition-colors`}>
                <FiArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              {branding?.logo && (
                <img src={branding.logo} alt={branding.businessName} className="h-8 w-auto" />
              )}
              <span className={`text-xl font-bold ${themeConfig.styleClasses.text.primary}`}>
                {branding?.businessName || 'Voice AI'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <div className={`w-16 h-16 ${themeConfig.styleClasses.featureIcon} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <FiActivity className={`${themeConfig.styleClasses.text.primary} w-8 h-8`} />
          </div>
          <h1 className={`text-4xl md:text-5xl font-bold mb-6 ${themeConfig.styleClasses.text.primary}`}>
            System Status
          </h1>
          <p className={`text-xl ${themeConfig.styleClasses.text.secondary} max-w-3xl mx-auto`}>
            Real-time status and performance monitoring for all our services.
          </p>
          <p className={`text-sm ${themeConfig.styleClasses.text.muted} mt-4`}>
            Last updated: {systemStatus.lastUpdated.toLocaleString()}
          </p>
        </div>
      </section>

      {/* Overall Status */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border mb-8`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getStatusIcon(systemStatus.overall)}
                <div>
                  <h2 className={`text-2xl font-bold ${themeConfig.styleClasses.text.primary}`}>
                    All Systems Operational
                  </h2>
                  <p className={`${themeConfig.styleClasses.text.secondary}`}>
                    All services are running normally
                  </p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30`}>
                <span className="text-green-400 font-medium text-sm">
                  {systemStatus.overall.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Status */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className={`text-2xl font-bold mb-6 ${themeConfig.styleClasses.text.primary}`}>
            Service Status
          </h2>
          <div className="space-y-4">
            {systemStatus.services.map((service, index) => (
              <div key={index} className={`${themeConfig.styleClasses.card} rounded-lg p-6 border`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(service.status)}
                    <div>
                      <h3 className={`font-semibold ${themeConfig.styleClasses.text.primary}`}>
                        {service.name}
                      </h3>
                      <p className={`text-sm ${getStatusColor(service.status)}`}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${themeConfig.styleClasses.text.secondary}`}>
                      Uptime
                    </p>
                    <p className={`font-semibold ${themeConfig.styleClasses.text.primary}`}>
                      {service.uptime}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Incidents */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className={`text-2xl font-bold mb-6 ${themeConfig.styleClasses.text.primary}`}>
            Recent Incidents
          </h2>
          <div className="space-y-4">
            {systemStatus.incidents.map((incident) => (
              <div key={incident.id} className={`${themeConfig.styleClasses.card} rounded-lg p-6 border`}>
                <div className="flex items-start space-x-4">
                  <FiCheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${themeConfig.styleClasses.text.primary}`}>
                        {incident.title}
                      </h3>
                      <span className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium">
                        RESOLVED
                      </span>
                    </div>
                    <p className={`${themeConfig.styleClasses.text.secondary} mb-2`}>
                      {incident.description}
                    </p>
                    <p className={`text-sm ${themeConfig.styleClasses.text.muted}`}>
                      {incident.date.toLocaleDateString()} at {incident.date.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className={`${themeConfig.styleClasses.card} rounded-lg p-8 border text-center`}>
            <h2 className={`text-2xl font-bold mb-4 ${themeConfig.styleClasses.text.primary}`}>
              Need Help?
            </h2>
            <p className={`${themeConfig.styleClasses.text.secondary} mb-6`}>
              If you're experiencing issues not listed here, please contact our support team.
            </p>
            {branding?.supportEmail && (
              <a
                href={`mailto:${branding.supportEmail}`}
                className={`inline-flex items-center px-6 py-3 ${themeConfig.styleClasses.button.primary} rounded-lg font-medium transition-colors`}
              >
                Contact Support
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
