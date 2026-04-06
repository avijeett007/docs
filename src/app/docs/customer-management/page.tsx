'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Copy,
  CheckCircle,
  Users,
  UserPlus,
  Key,
  Mail,
  Shield
} from 'lucide-react';
import Link from 'next/link';

const CustomerManagementPage = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const endpoints = [
    {
      title: "Create Customer",
      method: "POST",
      path: "/mcp/customers",
      description: "Create a new customer account with automatic ID generation",
      example: {
        request: {
          "email": "customer@example.com",
          "first_name": "John",
          "last_name": "Doe", 
          "company_name": "Acme Corp"
        },
        response: {
          "success": true,
          "customer_id": "uuid-generated-id",
          "email": "customer@example.com",
          "message": "Customer created successfully"
        }
      }
    },
    {
      title: "Enable Portal Access",
      method: "POST", 
      path: "/mcp/customers/portal-access",
      description: "Enable customer portal access with auto-generated secure credentials",
      example: {
        request: {
          "customer_id": "uuid-from-create-customer",
          "send_email": false
        },
        response: {
          "success": true,
          "email": "customer@example.com",
          "portal_url": "https://subdomain.knotie-ai.pro",
          "password": "auto-generated-secure-password",
          "message": "Portal access enabled successfully"
        }
      }
    },
    {
      title: "Reset Password",
      method: "POST",
      path: "/mcp/customers/reset-password", 
      description: "Reset customer portal password with new auto-generated credentials",
      example: {
        request: {
          "customer_id": "uuid-from-create-customer",
          "send_email": false
        },
        response: {
          "success": true,
          "new_password": "new-auto-generated-password",
          "message": "Password reset successfully"
        }
      }
    }
  ];

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'POST': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Link 
              href="/docs"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
              <p className="mt-2 text-lg text-gray-600">
                Programmatically create and manage customers with the MCP API
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Users className="w-6 h-6 text-blue-600 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Customer Management Overview
                </h3>
                <p className="text-blue-800 mb-4">
                  The Customer Management API allows you to programmatically create customers, 
                  enable portal access, and manage their credentials. This is perfect for 
                  automated onboarding workflows triggered by ad campaigns, lead forms, or AI agents.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-800">Automated customer creation</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-800">Auto-generated credentials</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-800">Secure portal access</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Workflow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Typical Workflow</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Create Customer</h3>
                  <p className="text-gray-600 text-sm">
                    Use the create customer endpoint to add a new customer to your partner account. 
                    The system automatically generates a unique customer ID.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Enable Portal Access</h3>
                  <p className="text-gray-600 text-sm">
                    Enable portal access for the customer using their customer ID. This generates 
                    secure login credentials and provides the portal URL.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Share Credentials</h3>
                  <p className="text-gray-600 text-sm">
                    Share the portal URL and credentials with your customer. You can optionally 
                    have the system send an email automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Endpoints */}
        <div className="space-y-8">
          {endpoints.map((endpoint, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
              className="bg-white rounded-lg border border-gray-200 p-8"
            >
              {/* Endpoint Header */}
              <div className="mb-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className={`px-3 py-1 rounded font-medium ${getMethodColor(endpoint.method)}`}>
                    {endpoint.method}
                  </div>
                  <code className="bg-gray-100 px-3 py-1 rounded font-mono text-sm">
                    https://analytics.knotie-ai.pro{endpoint.path}
                  </code>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {endpoint.title}
                </h3>
                <p className="text-gray-600">
                  {endpoint.description}
                </p>
              </div>

              {/* Request Example */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
                <div className="bg-gray-900 rounded-lg p-4 relative">
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(endpoint.example.request, null, 2), `request-${index}`)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  >
                    {copiedCode === `request-${index}` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <pre className="text-green-400 text-sm overflow-x-auto">
                    {JSON.stringify(endpoint.example.request, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Response Example */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
                <div className="bg-gray-900 rounded-lg p-4 relative">
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(endpoint.example.response, null, 2), `response-${index}`)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  >
                    {copiedCode === `response-${index}` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <pre className="text-green-400 text-sm overflow-x-auto">
                    {JSON.stringify(endpoint.example.response, null, 2)}
                  </pre>
                </div>
              </div>

              {/* cURL Example */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">cURL Example</h4>
                <div className="bg-gray-900 rounded-lg p-4 relative">
                  <button
                    onClick={() => {
                      const curlCommand = `curl -X ${endpoint.method} \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-Partner-Email: your@email.com" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(endpoint.example.request)}' \\
  https://analytics.knotie-ai.pro${endpoint.path}`;
                      copyToClipboard(curlCommand, `curl-${index}`);
                    }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  >
                    {copiedCode === `curl-${index}` ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X ${endpoint.method} \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-Partner-Email: your@email.com" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(endpoint.example.request)}' \\
  https://analytics.knotie-ai.pro${endpoint.path}`}
                  </pre>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Best Practices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 bg-gray-50 rounded-2xl p-8"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Best Practices
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Shield className="w-5 h-5 text-green-600 mr-2" />
                Security
              </h4>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• Always validate email addresses before creating customers</li>
                <li>• Store customer IDs securely for future API calls</li>
                <li>• Use HTTPS for all API communications</li>
                <li>• Never expose API keys in client-side code</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Mail className="w-5 h-5 text-blue-600 mr-2" />
                Email Handling
              </h4>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• Set send_email: false to handle credentials manually</li>
                <li>• Use your own email templates for better branding</li>
                <li>• Include portal URL and credentials in welcome emails</li>
                <li>• Consider password reset workflows for customers</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomerManagementPage;
