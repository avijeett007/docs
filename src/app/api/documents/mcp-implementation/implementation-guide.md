# MCP Server (SSE enabled) Implementation Guide for Knotie AI Platform

## Overview

This document outlines the implementation plan for enabling MCP Server (Server-Sent Events) support for the Knotie AI platform. The goal is to allow partners to programmatically manage customers, control portal access, map/unmap agents, and manage customer features through API endpoints.

## Architecture Decision

After analyzing the current system architecture, we've decided to implement the MCP Server APIs in the **analytics service** for the following reasons:

1. The analytics service is built with FastAPI, which can handle more API requests efficiently without impacting the main app performance
2. The analytics service already has a connection to both NeonDB and Supabase
3. The analytics service has an established API key authentication system
4. Moving these APIs to the analytics service will help distribute the load

## Implementation Checklist

### 1. Database Connectivity

- [x] Ensure analytics service can connect to NeonDB
- [ ] Verify all required tables are accessible from the analytics service
- [ ] Test CRUD operations on relevant tables from analytics service

### 2. API Authentication

- [ ] Extend the existing API key authentication system to support partner API keys
- [ ] Implement verification of partner API keys against the PartnerApiKey table in NeonDB
- [ ] Add rate limiting for MCP API endpoints

### 3. Core API Endpoints to Implement

#### Customer Management

- [ ] `POST /api/v1/mcp/customers/onboard` - Onboard a new customer (create UserOnboarding record)
- [ ] `POST /api/v1/mcp/customers` - Create a customer record from an onboarding record
- [ ] `GET /api/v1/mcp/customers` - List all customers for a partner
- [ ] `GET /api/v1/mcp/customers/{customerId}` - Get customer details
- [ ] `PATCH /api/v1/mcp/customers/{customerId}` - Update customer details
- [ ] `DELETE /api/v1/mcp/customers/{customerId}` - Delete a customer (soft delete)

#### Portal Access Management

- [ ] `POST /api/v1/mcp/customers/{onboardingId}/portal-access` - Enable/reset portal access
- [ ] `POST /api/v1/mcp/customers/{onboardingId}/portal-access/block` - Block portal access
- [ ] `POST /api/v1/mcp/customers/{onboardingId}/reset-password` - Reset customer password

#### Agent Mapping

- [ ] `POST /api/v1/mcp/retell-agents/{agentId}/map-customer` - Map Retell agent to customer
- [ ] `POST /api/v1/mcp/retell-agents/{agentId}/unmap-customer` - Unmap Retell agent from customer
- [ ] `POST /api/v1/mcp/vapi-agents/{agentId}/map-customer` - Map VAPI agent to customer
- [ ] `POST /api/v1/mcp/vapi-agents/{agentId}/unmap-customer` - Unmap VAPI agent from customer

#### Feature Management

- [ ] `PATCH /api/v1/mcp/customers/{customerId}/features` - Update customer features

#### Team Member Management

- [ ] `POST /api/v1/mcp/customers/{customerId}/team-members` - Invite team member
- [ ] `GET /api/v1/mcp/customers/{customerId}/team-members` - List team members
- [ ] `DELETE /api/v1/mcp/customers/{customerId}/team-members/{teamMemberId}` - Remove team member

### 4. API Documentation

- [ ] Create OpenAPI/Swagger documentation for all MCP endpoints
- [ ] Add examples and usage instructions
- [ ] Document authentication requirements
- [ ] Document rate limits and error responses

## Implementation Details

### Database Connectivity

The analytics service already has connectivity to both Supabase and NeonDB. We need to ensure that the NeonDB client in the analytics service can access all the required tables for customer management.

```python
# analytics/db/neondb.py
def get_customer_by_id(customer_id):
    """
    Retrieve a customer by ID from the NeonDB database
    """
    try:
        with get_session() as session:
            query = """
            SELECT
                c.id,
                c.email,
                c.first_name,
                c.last_name,
                uo.partner_id,
                uo.customer_portal_enabled,
                uo.enable_api_access,
                uo.show_api_keys,
                uo.show_knowledge_base,
                uo.show_integration,
                uo.show_docs_and_media,
                uo.show_schedule_meeting,
                uo.show_pricing_information,
                uo.enable_team_members,
                uo.max_team_members
            FROM customers c
            LEFT JOIN user_onboarding uo ON c.user_id = uo.user_id
            WHERE c.id = :customer_id
            """
            result = session.execute(query, {"customer_id": customer_id})
            customer = result.fetchone()
            if customer:
                return dict(customer)
            return None
    except Exception as e:
        logger.error(f"Error retrieving customer by ID: {str(e)}")
        return None
```

### API Key Authentication

We need to extend the existing API key authentication system to verify partner API keys against the PartnerApiKey table in NeonDB:

```python
# analytics/utils/partner_auth.py
from db.neondb import NeonDBClient
from utils.encryption import decrypt_text

async def verify_partner_api_key(api_key: str):
    """
    Verify a partner API key against the PartnerApiKey table in NeonDB
    Returns the partner ID if valid, None otherwise
    """
    try:
        # Extract the prefix to determine if it's a partner key
        if not api_key.startswith("pkt_"):
            return None

        neondb = NeonDBClient()

        # Get all active partner API keys
        partner_keys = neondb.get_partner_api_keys(status="active")

        # Check each key by decrypting and comparing
        for key in partner_keys:
            decrypted_key = decrypt_text(key["api_key"])
            if decrypted_key == api_key:
                # Update last used timestamp and usage count
                neondb.update_partner_api_key_usage(key["id"])

                return {
                    "type": "partner",
                    "id": key["id"],
                    "partnerId": key["partner_id"]
                }

        return None
    except Exception as e:
        logger.error(f"Error verifying partner API key: {str(e)}")
        return None
```

### Example API Endpoint Implementation

Here's an example of how to implement the customer creation endpoint:

```python
# analytics/api/v1/mcp/customers.py
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from db.neondb import NeonDBClient
from utils.partner_auth import verify_partner_api_key

router = APIRouter(prefix="/api/v1/mcp/customers", tags=["MCP - Customers"])

class CustomerCreate(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    companyName: Optional[str] = None
    password: str

@router.post("/", status_code=201)
async def create_customer(
    customer: CustomerCreate,
    x_api_key: str = Header(..., description="Partner API key")
):
    # Verify partner API key
    auth_info = await verify_partner_api_key(x_api_key)
    if not auth_info:
        raise HTTPException(status_code=401, detail="Invalid API key")

    partner_id = auth_info["partnerId"]

    # Check if partner exists and is active
    neondb = NeonDBClient()
    partner = neondb.get_partner_by_id(partner_id)

    if not partner or partner["approval_status"] != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Partner not found or not active"
        )

    # Check if customer with this email already exists
    existing_customer = neondb.get_customer_by_email(customer.email)
    if existing_customer:
        raise HTTPException(
            status_code=400,
            detail="A customer with this email already exists"
        )

    # Create the customer
    new_customer = neondb.create_customer(
        email=customer.email,
        first_name=customer.firstName,
        last_name=customer.lastName,
        company_name=customer.companyName,
        password=customer.password,
        partner_id=partner_id
    )

    return {
        "success": True,
        "message": "Customer created successfully",
        "data": {
            "id": new_customer["id"],
            "email": new_customer["email"],
            "firstName": new_customer["first_name"],
            "lastName": new_customer["last_name"]
        }
    }
```

## Next Steps

1. Set up the database connectivity and test it
2. Implement the API key authentication system
3. Create the core API endpoints one by one
4. Write comprehensive tests for each endpoint
5. Document the API with OpenAPI/Swagger
6. Deploy and monitor the new MCP Server APIs

## Considerations

- Keep API endpoints simple and focused on single operations
- Ensure proper error handling and validation
- Implement rate limiting to prevent abuse
- Add detailed logging for debugging and monitoring
- Maintain backward compatibility with existing functionality
