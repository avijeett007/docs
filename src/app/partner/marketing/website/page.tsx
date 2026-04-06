'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FiChevronLeft,
  FiExternalLink,
  FiCode,
  FiCopy,
  FiDownload,
  FiPlay,
  FiPause,
  FiMic,
  FiPhone,
  FiX
} from 'react-icons/fi';
import PartnerSidebar from '@/components/partner/PartnerSidebar';
import NeonContainer from '@/components/NeonContainer';

export default function VoiceEnabledWebsitePage() {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [demoActive, setDemoActive] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');

  useEffect(() => {
    // Get partner name from localStorage
    const storedName = localStorage.getItem('partner_name');
    if (storedName) {
      setPartnerName(storedName);
    }

    // Check if token exists
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleLogout = () => {
    // Clear partner data from localStorage
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_name');
    // Redirect to login page
    router.push('/partner/login');
  };

  const handleCopySnippet = () => {
    const codeSnippet = `<!-- Voice AI Widget -->
<script src="https://cdn.knotie.ai/voice-widget.js" defer></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    KnotieVoice.init({
      apiKey: 'YOUR_API_KEY',
      agentId: 'YOUR_AGENT_ID',
      position: 'bottom-right',
      welcomeMessage: 'Hi there! How can I assist you today?',
      theme: {
        primaryColor: '#6366f1',
        textColor: '#ffffff',
        backgroundColor: '#1f2937'
      }
    });
  });
</script>`;
    
    navigator.clipboard.writeText(codeSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <PartnerSidebar partnerName={partnerName} onLogout={handleLogout} />
      
      <main className="flex-1 pl-64 transition-all duration-300">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <button 
                onClick={() => router.push('/partner/marketing')}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
              >
                <FiChevronLeft className="w-4 h-4" />
                <span>Back to Marketing</span>
              </button>
              <h1 className="text-3xl font-bold">Voice-Enabled Website</h1>
              <p className="text-gray-400 mt-2">Showcase voice AI capabilities with a demo website for your customers</p>
            </div>
          </div>

          {/* Coming Soon Banner */}
          <div className="mb-8 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-full">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Coming Soon</h3>
              <p className="text-gray-300">This feature is currently in development. The content below is a preview of what will be available soon.</p>
            </div>
          </div>

          {/* Demo Website Preview */}
          <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <NeonContainer className="h-full">
                <div className="flex border-b border-gray-700">
                  <button 
                    className={`px-4 py-3 ${activeTab === 'preview' ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('preview')}
                  >
                    Website Preview
                  </button>
                  <button 
                    className={`px-4 py-3 ${activeTab === 'code' ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('code')}
                  >
                    Integration Code
                  </button>
                </div>
                {activeTab === 'preview' ? (
                  <div className="p-0 h-[600px] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gray-800 flex flex-col">
                      {/* Mock Browser Header */}
                      <div className="bg-gray-900 p-2 flex items-center border-b border-gray-700">
                        <div className="flex space-x-2 mr-4">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <div className="flex-1 bg-gray-800 rounded px-3 py-1 text-sm text-gray-400 text-center">
                          https://demo.youragency.com
                        </div>
                      </div>
                      
                      {/* Mock Website Content */}
                      <div className="flex-1 overflow-auto">
                        <div className="h-64 bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center p-8">
                          <div className="text-center">
                            <h2 className="text-3xl font-bold mb-4">Welcome to Your Business</h2>
                            <p className="text-xl mb-6">We provide innovative solutions for modern challenges</p>
                            <button className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                              Learn More
                            </button>
                          </div>
                        </div>
                        
                        <div className="p-8 bg-white text-gray-800">
                          <h3 className="text-2xl font-bold mb-6 text-center">Our Services</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 border border-gray-200 rounded-lg text-center">
                              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiCode className="w-8 h-8 text-purple-600" />
                              </div>
                              <h4 className="text-xl font-semibold mb-2">Web Development</h4>
                              <p className="text-gray-600">Custom websites built to meet your specific needs</p>
                            </div>
                            <div className="p-4 border border-gray-200 rounded-lg text-center">
                              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiPhone className="w-8 h-8 text-blue-600" />
                              </div>
                              <h4 className="text-xl font-semibold mb-2">24/7 Support</h4>
                              <p className="text-gray-600">Always available to answer your questions</p>
                            </div>
                            <div className="p-4 border border-gray-200 rounded-lg text-center">
                              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiMic className="w-8 h-8 text-indigo-600" />
                              </div>
                              <h4 className="text-xl font-semibold mb-2">Voice AI</h4>
                              <p className="text-gray-600">Intelligent voice assistants for your business</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-8 bg-gray-100 text-gray-800">
                          <h3 className="text-2xl font-bold mb-6 text-center">Contact Us</h3>
                          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-sm">
                            <div className="mb-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2">Name</label>
                              <input className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" type="text" placeholder="Your name" />
                            </div>
                            <div className="mb-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
                              <input className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" type="email" placeholder="Your email" />
                            </div>
                            <div className="mb-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2">Message</label>
                              <textarea className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" rows={4} placeholder="Your message"></textarea>
                            </div>
                            <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full transition-colors">
                              Send Message
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Voice AI Widget */}
                      <div className={`absolute bottom-6 right-6 transition-all duration-300 ${demoActive ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        {demoActive && (
                          <div className="bg-gray-900 rounded-lg shadow-lg w-80 overflow-hidden border border-purple-500/30">
                            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                  <FiMic className="w-4 h-4" />
                                </div>
                                <span className="font-medium">Voice Assistant</span>
                              </div>
                              <button 
                                onClick={() => setDemoActive(false)}
                                className="p-1 hover:bg-white/10 rounded-full"
                              >
                                <FiX className="w-5 h-5" />
                              </button>
                            </div>
                            <div className="p-4 bg-gray-800 h-64 flex flex-col">
                              <div className="flex-1 overflow-y-auto">
                                <div className="mb-4">
                                  <div className="bg-gray-700 rounded-lg p-3 inline-block max-w-[80%]">
                                    <p className="text-sm">Hi there! How can I assist you today?</p>
                                  </div>
                                </div>
                                <div className="mb-4 flex justify-end">
                                  <div className="bg-purple-600 rounded-lg p-3 inline-block max-w-[80%]">
                                    <p className="text-sm">What services do you offer?</p>
                                  </div>
                                </div>
                                <div className="mb-4">
                                  <div className="bg-gray-700 rounded-lg p-3 inline-block max-w-[80%]">
                                    <p className="text-sm">We offer web development, 24/7 customer support, and voice AI integration services. Would you like to learn more about any specific service?</p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 flex items-center gap-2">
                                <input 
                                  type="text" 
                                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  placeholder="Type your message..."
                                  disabled
                                />
                                <button className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors">
                                  <FiMic className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Voice AI Button */}
                      <div className="absolute bottom-6 right-6">
                        <button 
                          onClick={() => setDemoActive(!demoActive)}
                          className={`p-4 rounded-full shadow-lg ${demoActive ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'} transition-all duration-300`}
                        >
                          {demoActive ? (
                            <FiPause className="w-6 h-6" />
                          ) : (
                            <FiMic className="w-6 h-6" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-semibold mb-4">Integration Instructions</h3>
                      <p className="text-gray-300 mb-4">
                        Add the following code snippet to your website to enable the voice AI widget. You'll need to replace 
                        <code className="bg-gray-800 px-2 py-1 rounded text-purple-400">YOUR_API_KEY</code> and 
                        <code className="bg-gray-800 px-2 py-1 rounded text-purple-400">YOUR_AGENT_ID</code> with your actual credentials.
                      </p>
                    </div>
                    
                    <div className="relative">
                      <pre className="bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm text-gray-300">
                        <code>
{`<!-- Voice AI Widget -->
<script src="https://cdn.knotie.ai/voice-widget.js" defer></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    KnotieVoice.init({
      apiKey: 'YOUR_API_KEY',
      agentId: 'YOUR_AGENT_ID',
      position: 'bottom-right',
      welcomeMessage: 'Hi there! How can I assist you today?',
      theme: {
        primaryColor: '#6366f1',
        textColor: '#ffffff',
        backgroundColor: '#1f2937'
      }
    });
  });
</script>`}
                        </code>
                      </pre>
                      <button 
                        onClick={handleCopySnippet}
                        className="absolute top-2 right-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                        title="Copy code"
                      >
                        {copiedSnippet ? (
                          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">Copied!</span>
                        ) : (
                          <FiCopy className="w-4 h-4 text-gray-300" />
                        )}
                      </button>
                    </div>
                    
                    <div className="mt-6">
                      <h3 className="text-xl font-semibold mb-4">Customization Options</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <h4 className="font-medium text-white mb-2">Appearance</h4>
                          <ul className="space-y-2 text-sm text-gray-300">
                            <li><code>position</code>: Widget position (bottom-right, bottom-left, etc.)</li>
                            <li><code>theme.primaryColor</code>: Main accent color</li>
                            <li><code>theme.backgroundColor</code>: Widget background color</li>
                            <li><code>theme.textColor</code>: Text color</li>
                          </ul>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg">
                          <h4 className="font-medium text-white mb-2">Behavior</h4>
                          <ul className="space-y-2 text-sm text-gray-300">
                            <li><code>welcomeMessage</code>: Initial message from the assistant</li>
                            <li><code>autoOpen</code>: Whether to open automatically on page load</li>
                            <li><code>triggerPhrases</code>: Words that trigger specific responses</li>
                            <li><code>fallbackContact</code>: Email/phone for escalation</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </NeonContainer>
            </div>
            
            <div>
              <NeonContainer className="h-full">
                <div className="px-6 py-4 border-b border-gray-700">
                  <h2 className="text-xl font-semibold text-white">Demo Features</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-white mb-3">Voice-Enabled Website</h3>
                      <p className="text-gray-300 mb-4">
                        This demo showcases how a voice AI assistant can be integrated into any website to provide 
                        instant support and engagement for visitors.
                      </p>
                      <button 
                        onClick={() => {
                          setActiveTab('preview');
                          setDemoActive(!demoActive);
                        }}
                        className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2"
                      >
                        {demoActive ? <FiPause className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                        <span>{demoActive ? 'Stop Demo' : 'Start Demo'}</span>
                      </button>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-6">
                      <h3 className="text-lg font-medium text-white mb-3">Key Benefits</h3>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-2">
                          <div className="p-1 bg-green-500/20 rounded-full mt-1">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-gray-300">24/7 customer support without staffing costs</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="p-1 bg-green-500/20 rounded-full mt-1">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-gray-300">Instant responses to common questions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="p-1 bg-green-500/20 rounded-full mt-1">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-gray-300">Lead qualification and data collection</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="p-1 bg-green-500/20 rounded-full mt-1">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-gray-300">Seamless scheduling and booking</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="p-1 bg-green-500/20 rounded-full mt-1">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-gray-300">Modern, engaging user experience</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-6">
                      <h3 className="text-lg font-medium text-white mb-3">Get Your Demo Site</h3>
                      <p className="text-gray-300 mb-4">
                        We can create a customized demo website for your agency that showcases voice AI capabilities 
                        to your potential clients.
                      </p>
                      <a 
                        href="#"
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors inline-flex items-center gap-2"
                      >
                        <FiExternalLink className="w-4 h-4" />
                        <span>Request Custom Demo Site</span>
                      </a>
                    </div>
                  </div>
                </div>
              </NeonContainer>
            </div>
          </div>

          {/* Integration Guide */}
          <NeonContainer className="mb-8">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Integration Guide</h2>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-lg p-6 border border-purple-500/20">
                <h3 className="text-xl font-bold text-white mb-4">Implementing Voice AI on Client Websites</h3>
                <p className="text-gray-300 mb-6">
                  Adding voice AI capabilities to your clients' websites is a straightforward process that can be completed in just a few steps.
                  Here's how to get started:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-2">Implementation Steps</h4>
                    <ol className="space-y-2 text-gray-300 list-decimal pl-5">
                      <li>Create a voice AI agent in your partner dashboard</li>
                      <li>Configure the agent's knowledge base and responses</li>
                      <li>Generate your unique API key and Agent ID</li>
                      <li>Copy the integration code to the client's website</li>
                      <li>Test the integration in various scenarios</li>
                      <li>Monitor performance and refine as needed</li>
                    </ol>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-white mb-2">Best Practices</h4>
                    <ul className="space-y-2 text-gray-300">
                      <li>u2022 Match the widget theme to the client's brand colors</li>
                      <li>u2022 Start with common FAQs for the knowledge base</li>
                      <li>u2022 Set up appropriate fallback responses</li>
                      <li>u2022 Configure business hours if applicable</li>
                      <li>u2022 Set up proper escalation paths to human support</li>
                      <li>u2022 Regularly update the AI with new information</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-full">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="font-medium text-white mb-1">Need assistance with implementation?</h5>
                      <p className="text-gray-300 text-sm">
                        Our team can help you integrate voice AI into your clients' websites. 
                        <a href="#" className="text-blue-400 hover:text-blue-300 ml-1">Contact support</a> for personalized assistance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </NeonContainer>
        </div>
      </main>
    </div>
  );
}
