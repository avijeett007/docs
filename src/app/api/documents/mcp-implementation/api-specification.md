# MCP Server API Specification

## Authentication

All MCP API endpoints require authentication using a Partner API key. The API key must be included in the `X-API-Key` header of each request.

```
X-API-Key: pkt_your_partner_api_key
```

Partner API keys can be created in the Partner Dashboard under Settings > API Keys.

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error code or type",
  "message": "Human-readable error message",
  "details": {} // Optional additional error details
}
```

Common HTTP status codes:
- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Invalid or missing API key
- `403 Forbidden` - Valid API key but insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists or conflict
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## API Endpoints

### Customer Management

#### Onboard Customer

Creates a new customer onboarding record and associates it with the partner. This is the first step in the customer creation process.

**Endpoint:** `POST /api/v1/mcp/customers/onboard`

**Request Body:**
```json
{
  "basic": {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "businessPhone": "+1234567890"
  },
  "business": {
    "companyName": "Example Corp",
    "monthlyCallVolume": "101-500 calls",
    "peakHours": "Standard business hours"
  },
  "requirements": {
    "primaryUseCase": "Sales",
    "callComplexity": "Medium",
    "scriptComplexity": "Standard"
  },
  "integration": {
    "crmSystem": "Salesforce",
    "phoneSystem": "RingCentral"
  },
  "deployment": {
    "deploymentTimeline": "1-2 weeks"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer onboarded successfully",
  "data": {
    "id": "onb_123456789",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Example Corp"
  }
}
```

#### Create Customer

Creates a new customer account from an existing onboarding record. This step is optional as the customer record can be automatically created when enabling portal access.

**Endpoint:** `POST /api/v1/mcp/customers`

**Request Body:**
```json
{
  "email": "customer@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Example Corp",
  "onboardingId": "onb_123456789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "id": "cust_123456789",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### List Customers

Retrieves a list of all customers associated with the partner.

**Endpoint:** `GET /api/v1/mcp/customers`

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of results per page (default: 20, max: 100)
- `search` (optional): Search term to filter customers by name or email

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "cust_123456789",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "companyName": "Example Corp",
        "customerPortalEnabled": true,
        "createdAt": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "pages": 3,
      "currentPage": 1,
      "limit": 20
    }
  }
}
```

#### Get Customer

Retrieves detailed information about a specific customer.

**Endpoint:** `GET /api/v1/mcp/customers/{customerId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust_123456789",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Example Corp",
    "customerPortalEnabled": true,
    "enableApiAccess": false,
    "showKnowledgeBase": true,
    "showIntegration": false,
    "showDocsAndMedia": true,
    "showScheduleMeeting": true,
    "showApiKeys": false,
    "showPricingInformation": true,
    "enableTeamMembers": true,
    "maxTeamMembers": 5,
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-15T00:00:00Z"
  }
}
```

#### Update Customer

Updates customer information and settings.

**Endpoint:** `PATCH /api/v1/mcp/customers/{customerId}`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "companyName": "New Company Name",
  "enableApiAccess": true,
  "showApiKeys": true,
  "showKnowledgeBase": true,
  "showIntegration": true,
  "showDocsAndMedia": true,
  "showScheduleMeeting": true,
  "showPricingInformation": false,
  "enableTeamMembers": true,
  "maxTeamMembers": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "id": "cust_123456789",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Smith",
    "companyName": "New Company Name",
    "updatedAt": "2023-02-01T00:00:00Z"
  }
}
```

### Portal Access Management

#### Enable/Reset Portal Access

Enables portal access for a customer or resets their access if already enabled. This endpoint creates a Customer record if one doesn't exist, and generates a temporary password that is sent to the customer via email.

**Endpoint:** `POST /api/v1/mcp/customers/{customerId}/portal-access`

**Request Body:**
```json
{
  "sendEmail": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Portal access enabled successfully",
  "data": {
    "portalUrl": "https://partner-subdomain.knotie-ai.pro",
    "emailSent": true,
    "customerId": "cust_123456789"
  }
}
```

**Note:** The `customerId` parameter in the URL refers to the UserOnboarding record ID, not the Customer record ID.

#### Block Portal Access

Blocks a customer's access to the portal.

**Endpoint:** `POST /api/v1/mcp/customers/{customerId}/portal-access/block`

**Response:**
```json
{
  "success": true,
  "message": "Customer portal access has been blocked"
}
```

#### Reset Customer Password

Resets a customer's password and optionally sends them an email with reset instructions.

**Endpoint:** `POST /api/v1/mcp/customers/{customerId}/reset-password`

**Request Body:**
```json
{
  "sendEmail": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "resetToken": "abc123xyz", // Only included if sendEmail is false
    "emailSent": true
  }
}
```

### Agent Mapping

#### Map Retell Agent to Customer

Maps a Retell agent to a customer and sets the profit multiplier.

**Endpoint:** `POST /api/v1/mcp/retell-agents/{agentId}/map-customer`

**Request Body:**
```json
{
  "customerId": "cust_123456789",
  "profitMultiplier": 1.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully mapped customer to agent",
  "agent": {
    "id": "agent_123456789",
    "name": "Sales Agent",
    "customer": {
      "id": "cust_123456789",
      "name": "John Doe"
    },
    "profitMultiplier": 1.5
  }
}
```

#### Unmap Retell Agent from Customer

Removes the mapping between a Retell agent and a customer.

**Endpoint:** `POST /api/v1/mcp/retell-agents/{agentId}/unmap-customer`

**Response:**
```json
{
  "success": true,
  "message": "Successfully unmapped customer from agent",
  "agent": {
    "id": "agent_123456789",
    "name": "Sales Agent"
  }
}
```

Similar endpoints exist for VAPI agents:
- `POST /api/v1/mcp/vapi-agents/{agentId}/map-customer`
- `POST /api/v1/mcp/vapi-agents/{agentId}/unmap-customer`

### Team Member Management

#### Invite Team Member

Invites a new team member to a customer's account.

**Endpoint:** `POST /api/v1/mcp/customers/{customerId}/team-members`

**Request Body:**
```json
{
  "email": "teammember@example.com",
  "name": "Jane Smith",
  "role": "member"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Team member invited successfully",
  "data": {
    "id": "tm_123456789",
    "email": "teammember@example.com",
    "name": "Jane Smith",
    "role": "member",
    "status": "pending",
    "inviteExpiry": "2023-02-02T00:00:00Z"
  }
}
```

#### List Team Members

Retrieves a list of all team members for a customer.

**Endpoint:** `GET /api/v1/mcp/customers/{customerId}/team-members`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tm_123456789",
      "email": "teammember@example.com",
      "name": "Jane Smith",
      "role": "member",
      "status": "active",
      "lastLogin": "2023-01-15T00:00:00Z",
      "createdAt": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### Remove Team Member

Removes a team member from a customer's account.

**Endpoint:** `DELETE /api/v1/mcp/customers/{customerId}/team-members/{teamMemberId}`

**Response:**
```json
{
  "success": true,
  "message": "Team member removed successfully"
}
```

## Rate Limits

- Standard tier: 60 requests per minute
- Premium tier: 120 requests per minute
- Enterprise tier: 300 requests per minute

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests per minute
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)
