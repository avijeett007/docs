# Migration Strategy: App API Routes to Analytics Service

## Overview

This document outlines the strategy for migrating the existing API routes from the Next.js app to the FastAPI-based analytics service. The migration will be done in phases to ensure minimal disruption to existing functionality.

## Current Architecture

Currently, the Knotie AI platform has the following architecture for API routes:

1. **Next.js App API Routes**:
   - Located in `src/app/api/`
   - Handle customer management, agent mapping, and portal access
   - Use NeonDB for data storage
   - Authenticate using JWT tokens and cookies

2. **Analytics Service API**:
   - Located in `analytics/api/`
   - Handle analytics data collection and processing
   - Use Supabase for data storage
   - Authenticate using API keys

## Target Architecture

The target architecture will move customer management, agent mapping, and portal access functionality to the analytics service:

1. **Next.js App API Routes**:
   - Will continue to handle UI-specific functionality
   - Will proxy certain requests to the analytics service
   - Will maintain backward compatibility for existing clients

2. **Analytics Service API**:
   - Will handle all MCP functionality
   - Will provide a unified API for both analytics and customer management
   - Will authenticate using partner API keys
   - Will have direct access to both NeonDB and Supabase

## Migration Phases

### Phase 1: Implement Core MCP Functionality in Analytics Service

1. **Set up database connectivity**:
   - Ensure the analytics service can connect to NeonDB
   - Implement necessary database operations in the analytics service

2. **Implement API key authentication**:
   - Extend the existing API key authentication system to support partner API keys
   - Implement verification against the PartnerApiKey table in NeonDB

3. **Implement core API endpoints**:
   - Customer management
   - Portal access management
   - Agent mapping
   - Team member management

4. **Write comprehensive tests**:
   - Unit tests for each endpoint
   - Integration tests for end-to-end functionality

### Phase 2: Create Proxy Routes in Next.js App

1. **Implement proxy routes**:
   - Create proxy routes in the Next.js app that forward requests to the analytics service
   - Maintain the same URL structure for backward compatibility

2. **Add authentication translation**:
   - Translate JWT authentication to API key authentication for proxied requests
   - Ensure proper error handling and status code propagation

Example proxy implementation:

```typescript
// src/app/api/partner/customers/[customerId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { getPartnerApiKey } from '@/lib/apiKeys';

// Analytics API URL from environment variables
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8001';

export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    // Verify partner authentication
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get partner's API key
    const apiKey = await getPartnerApiKey(partner.id);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 500 }
      );
    }

    // Forward the request to the analytics service
    const response = await fetch(
      `${ANALYTICS_API_URL}/api/v1/mcp/customers/${params.customerId}`,
      {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    // Get the response data
    const data = await response.json();

    // Return the response with the same status code
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Phase 3: Gradual Migration and Testing

1. **Migrate one endpoint at a time**:
   - Start with low-risk endpoints (e.g., GET requests)
   - Test thoroughly before moving to more critical endpoints

2. **A/B testing**:
   - Implement feature flags to route a percentage of traffic to the new endpoints
   - Monitor performance and error rates

3. **Rollback plan**:
   - Maintain the ability to quickly revert to the original implementation
   - Document the rollback procedure for each endpoint

### Phase 4: Complete Migration and Cleanup

1. **Migrate all endpoints**:
   - Once all endpoints are stable, complete the migration
   - Remove feature flags and A/B testing code

2. **Documentation update**:
   - Update API documentation to reflect the new architecture
   - Provide migration guides for any clients using the API directly

3. **Code cleanup**:
   - Remove deprecated code from the Next.js app
   - Refactor any remaining proxy routes for maintainability

## Handling Existing Clients

For existing clients using the API directly, we will:

1. **Maintain backward compatibility**:
   - Keep the same URL structure
   - Ensure response formats remain consistent

2. **Provide migration guides**:
   - Document the new API endpoints
   - Provide examples of how to migrate to the new API

3. **Deprecation notices**:
   - Add deprecation headers to the old endpoints
   - Communicate timeline for eventual removal of old endpoints

## Database Considerations

Since both the Next.js app and the analytics service will need to access NeonDB, we need to ensure:

1. **Connection pooling**:
   - Configure proper connection pooling to avoid exhausting database connections
   - Monitor database performance during the migration

2. **Transaction safety**:
   - Ensure that transactions are properly handled in both systems
   - Avoid race conditions when both systems are updating the same data

3. **Schema changes**:
   - Any schema changes must be backward compatible
   - Use database migrations to manage schema changes

## Monitoring and Observability

During and after the migration, we will:

1. **Implement comprehensive logging**:
   - Log all API requests and responses
   - Track performance metrics for both old and new endpoints

2. **Set up alerts**:
   - Create alerts for increased error rates
   - Monitor response times and database performance

3. **Create dashboards**:
   - Build dashboards to visualize the migration progress
   - Track usage of old vs. new endpoints

## Rollback Strategy

If issues are encountered during the migration, we will:

1. **Immediate rollback**:
   - Revert the proxy routes to use the original implementation
   - Disable the new endpoints in the analytics service

2. **Partial rollback**:
   - If only specific endpoints are problematic, roll back only those endpoints
   - Continue with the migration for stable endpoints

3. **Communication plan**:
   - Notify stakeholders of any rollbacks
   - Provide estimated timeline for resolving issues

## Timeline

The migration will follow this approximate timeline:

1. **Phase 1**: 2 weeks
   - Set up database connectivity
   - Implement API key authentication
   - Implement core API endpoints

2. **Phase 2**: 1 week
   - Create proxy routes in Next.js app
   - Add authentication translation

3. **Phase 3**: 2 weeks
   - Migrate endpoints one by one
   - Conduct A/B testing

4. **Phase 4**: 1 week
   - Complete migration
   - Clean up code
   - Update documentation

Total estimated time: 6 weeks

## Conclusion

This migration strategy provides a structured approach to moving API functionality from the Next.js app to the analytics service. By following this plan, we can ensure a smooth transition with minimal disruption to existing clients while improving the overall architecture of the Knotie AI platform.
