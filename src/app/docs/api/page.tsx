import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation | Knotie AI Pro',
  description: 'API documentation for Knotie AI Pro',
};

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-4xl font-bold mb-6">Knotie AI Pro API Documentation</h1>
      
      <div className="prose prose-lg max-w-none">
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Introduction</h2>
          <p>
            The Knotie AI Pro API allows you to programmatically access your voice AI agents, analytics, and other features.
            This documentation provides information on how to authenticate and use the API.
          </p>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Authentication</h2>
          <p>
            All API requests require authentication using an API key. You can generate API keys in your account settings.
          </p>
          
          <h3 className="text-xl font-bold mt-6 mb-2">API Key Types</h3>
          <p>
            There are two types of API keys:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li><strong>Partner API Keys</strong> (prefix: <code>pkt_</code>): For partners to access their account and manage customers.</li>
            <li><strong>Customer API Keys</strong> (prefix: <code>ckt_</code>): For customers to access their own data and agents.</li>
          </ul>
          
          <h3 className="text-xl font-bold mt-6 mb-2">Using API Keys</h3>
          <p>
            Include your API key in the <code>x-api-key</code> header with all API requests:
          </p>
          
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">
            <code>
              curl -X GET https://knotie-ai.pro/api/v1/me \<br />
              -H "x-api-key: pkt_your_api_key_here"
            </code>
          </pre>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">API Endpoints</h2>
          
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Authentication</h3>
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 p-4 border-b">
                <code className="font-bold">GET /api/v1/me</code>
                <p className="mt-2">Get information about the authenticated entity (partner or customer).</p>
              </div>
              <div className="p-4">
                <h4 className="font-bold mb-2">Response</h4>
                <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">
                  <code>
                    {`{
  "type": "partner",
  "data": {
    "id": "partner_id",
    "businessName": "Partner Business Name",
    "contactName": "Contact Name",
    "emailAddress": "partner@example.com",
    "phoneNumber": "+1234567890",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Analytics</h3>
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 p-4 border-b">
                <code className="font-bold">GET /api/v1/analytics/calls</code>
                <p className="mt-2">Get call analytics for a specific time period.</p>
              </div>
              <div className="p-4">
                <h4 className="font-bold mb-2">Parameters</h4>
                <ul className="list-disc list-inside mb-4">
                  <li><code>start_date</code> (optional): Start date in ISO format (default: 30 days ago)</li>
                  <li><code>end_date</code> (optional): End date in ISO format (default: today)</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Agents</h3>
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-100 p-4 border-b">
                <code className="font-bold">GET /api/v1/agents</code>
                <p className="mt-2">Get a list of all agents.</p>
              </div>
            </div>
          </div>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Rate Limits</h2>
          <p>
            API requests are subject to rate limits based on your subscription plan and API key settings.
            Rate limits are applied per API key and can be configured when creating or updating an API key.
          </p>
          
          <p className="mt-4">
            If you exceed the rate limit, the API will return a <code>429 Too Many Requests</code> response.
          </p>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Error Handling</h2>
          <p>
            The API uses standard HTTP status codes to indicate the success or failure of a request.
            In case of an error, the response body will contain an error message.
          </p>
          
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto mt-4">
            <code>
              {`{
  "error": "Invalid API key"
}`}
            </code>
          </pre>
          
          <h3 className="text-xl font-bold mt-6 mb-2">Common Error Codes</h3>
          <ul className="list-disc list-inside">
            <li><code>400 Bad Request</code>: The request was invalid or malformed.</li>
            <li><code>401 Unauthorized</code>: Authentication failed or API key is missing.</li>
            <li><code>403 Forbidden</code>: The API key does not have permission to access the requested resource.</li>
            <li><code>404 Not Found</code>: The requested resource was not found.</li>
            <li><code>429 Too Many Requests</code>: Rate limit exceeded.</li>
            <li><code>500 Internal Server Error</code>: An error occurred on the server.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
