# MCP Server Technical Implementation Plan

## Overview

This document outlines the technical implementation details for adding MCP Server support to the Knotie AI platform's analytics service. The implementation will leverage the existing FastAPI framework and extend it with new endpoints for customer management.

## Directory Structure

We will add the following files and directories to the analytics service:

```
analytics/
├── api/
│   ├── v1/
│   │   ├── mcp/
│   │   │   ├── __init__.py
│   │   │   ├── customers.py
│   │   │   ├── portal_access.py
│   │   │   ├── agents.py
│   │   │   └── team_members.py
├── db/
│   ├── neondb_extensions.py  # Extended NeonDB client functions
├── models/
│   ├── mcp/
│   │   ├── __init__.py
│   │   ├── customers.py
│   │   ├── agents.py
│   │   └── team_members.py
├── utils/
│   ├── partner_auth.py  # Partner API key verification
```

## Database Extensions

We need to extend the NeonDB client to support the new MCP operations:

```python
# analytics/db/neondb_extensions.py

from db.neondb import get_session, NeonDBClient
import logging
import bcrypt
from datetime import datetime, timedelta
import uuid
import secrets
import string

logger = logging.getLogger(__name__)

class MCPNeonDBClient(NeonDBClient):
    """Extended NeonDB client with MCP-specific operations"""

    def get_partner_api_keys(self, status="active"):
        """Get all partner API keys with the specified status"""
        try:
            with get_session() as session:
                query = """
                SELECT id, partner_id, name, api_key, prefix, status, expires_at,
                       last_used_at, rate_limit, daily_limit, monthly_limit
                FROM partner_api_keys
                WHERE status = :status
                """
                result = session.execute(query, {"status": status})
                return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error retrieving partner API keys: {str(e)}")
            return []

    def update_partner_api_key_usage(self, key_id):
        """Update the usage statistics for a partner API key"""
        try:
            with get_session() as session:
                query = """
                UPDATE partner_api_keys
                SET last_used_at = NOW(),
                    usage_count = usage_count + 1,
                    daily_usage = daily_usage + 1,
                    monthly_usage = monthly_usage + 1
                WHERE id = :key_id
                """
                session.execute(query, {"key_id": key_id})
                session.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating partner API key usage: {str(e)}")
            return False

    def get_user_onboarding_by_email(self, email, partner_id):
        """Get a user onboarding record by email and partner ID"""
        try:
            with get_session() as session:
                query = """
                SELECT id, user_id, email, first_name, last_name, company_name,
                       partner_id, customer_id, customer_portal_enabled
                FROM user_onboarding
                WHERE email = :email AND partner_id = :partner_id
                """
                result = session.execute(query, {"email": email, "partner_id": partner_id})
                onboarding = result.fetchone()
                if onboarding:
                    return dict(onboarding)
                return None
        except Exception as e:
            logger.error(f"Error getting user onboarding by email: {str(e)}")
            return None

    def get_user_onboarding_by_id(self, onboarding_id, partner_id):
        """Get a user onboarding record by ID and partner ID"""
        try:
            with get_session() as session:
                query = """
                SELECT id, user_id, email, first_name, last_name, company_name,
                       partner_id, customer_id, customer_portal_enabled
                FROM user_onboarding
                WHERE id = :id AND partner_id = :partner_id
                """
                result = session.execute(query, {"id": onboarding_id, "partner_id": partner_id})
                onboarding = result.fetchone()
                if onboarding:
                    return dict(onboarding)
                return None
        except Exception as e:
            logger.error(f"Error getting user onboarding by ID: {str(e)}")
            return None

    def create_user_onboarding(self, partner_id, email, first_name, last_name,
                              business_phone=None, company_name=None, monthly_call_volume=None,
                              peak_hours=None, primary_use_case=None, call_complexity=None,
                              script_complexity=None, crm_system=None, phone_system=None,
                              deployment_timeline=None):
        """Create a new user onboarding record"""
        try:
            with get_session() as session:
                # Generate a unique user ID (temporary until customer is created)
                user_id = f"temp_{uuid.uuid4()}"

                # Create user onboarding record
                onboarding_id = str(uuid.uuid4())
                query = """
                INSERT INTO user_onboarding (
                    id, user_id, email, first_name, last_name, company_name,
                    business_phone, monthly_call_volume, peak_hours, primary_use_case,
                    call_complexity, script_complexity, crm_system, phone_system,
                    deployment_timeline, partner_id, is_onboarding_completed,
                    estimated_price, price_breakdown, order_status, languages
                )
                VALUES (
                    :id, :user_id, :email, :first_name, :last_name, :company_name,
                    :business_phone, :monthly_call_volume, :peak_hours, :primary_use_case,
                    :call_complexity, :script_complexity, :crm_system, :phone_system,
                    :deployment_timeline, :partner_id, false,
                    0, '{}', 'PENDING', '[]'
                )
                RETURNING id, email, first_name, last_name, company_name
                """
                params = {
                    "id": onboarding_id,
                    "user_id": user_id,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "company_name": company_name,
                    "business_phone": business_phone,
                    "monthly_call_volume": monthly_call_volume,
                    "peak_hours": peak_hours,
                    "primary_use_case": primary_use_case,
                    "call_complexity": call_complexity,
                    "script_complexity": script_complexity,
                    "crm_system": crm_system,
                    "phone_system": phone_system,
                    "deployment_timeline": deployment_timeline,
                    "partner_id": partner_id
                }
                result = session.execute(query, params)
                session.commit()

                return dict(result.fetchone())
        except Exception as e:
            logger.error(f"Error creating user onboarding: {str(e)}")
            return None

    def create_customer_from_onboarding(self, onboarding_id, email, first_name, last_name, company_name=None):
        """Create a customer record from an existing onboarding record"""
        try:
            with get_session() as session:
                # Start a transaction
                transaction = session.begin()

                try:
                    # Get the onboarding record
                    onboarding_query = """
                    SELECT id, partner_id, user_id FROM user_onboarding
                    WHERE id = :id
                    """
                    onboarding_result = session.execute(onboarding_query, {"id": onboarding_id})
                    onboarding = onboarding_result.fetchone()

                    if not onboarding:
                        logger.error(f"Onboarding record not found: {onboarding_id}")
                        return None

                    onboarding = dict(onboarding)

                    # Generate a unique user ID if the onboarding one is temporary
                    user_id = onboarding["user_id"]
                    if user_id.startswith("temp_"):
                        user_id = str(uuid.uuid4())

                        # Update the onboarding record with the new user ID
                        update_onboarding_query = """
                        UPDATE user_onboarding
                        SET user_id = :user_id
                        WHERE id = :id
                        """
                        session.execute(update_onboarding_query, {"user_id": user_id, "id": onboarding_id})

                    # Create customer record
                    customer_id = str(uuid.uuid4())
                    customer_query = """
                    INSERT INTO customers (id, user_id, email, first_name, last_name, status)
                    VALUES (:id, :user_id, :email, :first_name, :last_name, 'active')
                    RETURNING id, email, first_name, last_name, created_at
                    """
                    customer_params = {
                        "id": customer_id,
                        "user_id": user_id,
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name
                    }
                    customer_result = session.execute(customer_query, customer_params)
                    customer = dict(customer_result.fetchone())

                    # Update the onboarding record with the customer ID
                    update_query = """
                    UPDATE user_onboarding
                    SET customer_id = :customer_id
                    WHERE id = :id
                    """
                    session.execute(update_query, {"customer_id": customer_id, "id": onboarding_id})

                    # Commit the transaction
                    transaction.commit()

                    return customer

                except Exception as e:
                    # Rollback the transaction on error
                    transaction.rollback()
                    logger.error(f"Error in create_customer_from_onboarding transaction: {str(e)}")
                    raise

        except Exception as e:
            logger.error(f"Error creating customer from onboarding: {str(e)}")
            return None

    def enable_portal_access(self, onboarding_id, partner_id, send_email=True):
        """Enable portal access for a customer"""
        try:
            with get_session() as session:
                # Start a transaction
                transaction = session.begin()

                try:
                    # Get the onboarding record
                    onboarding_query = """
                    SELECT id, user_id, email, first_name, last_name, company_name, customer_id, partner_id
                    FROM user_onboarding
                    WHERE id = :id AND partner_id = :partner_id
                    """
                    onboarding_result = session.execute(onboarding_query, {
                        "id": onboarding_id,
                        "partner_id": partner_id
                    })
                    onboarding = onboarding_result.fetchone()

                    if not onboarding:
                        logger.error(f"Onboarding record not found: {onboarding_id}")
                        return None

                    onboarding = dict(onboarding)

                    # Check if customer record exists
                    customer_id = onboarding["customer_id"]
                    if not customer_id:
                        # Create a new customer record
                        customer_id = str(uuid.uuid4())
                        customer_query = """
                        INSERT INTO customers (id, user_id, email, first_name, last_name, status, customer_portal_enabled)
                        VALUES (:id, :user_id, :email, :first_name, :last_name, 'active', true)
                        RETURNING id
                        """
                        customer_params = {
                            "id": customer_id,
                            "user_id": onboarding["user_id"],
                            "email": onboarding["email"],
                            "first_name": onboarding["first_name"],
                            "last_name": onboarding["last_name"]
                        }
                        session.execute(customer_query, customer_params)

                        # Update the onboarding record with the customer ID
                        update_query = """
                        UPDATE user_onboarding
                        SET customer_id = :customer_id, customer_portal_enabled = true
                        WHERE id = :id
                        """
                        session.execute(update_query, {"customer_id": customer_id, "id": onboarding_id})
                    else:
                        # Update the existing customer record
                        update_customer_query = """
                        UPDATE customers
                        SET customer_portal_enabled = true
                        WHERE id = :id
                        """
                        session.execute(update_customer_query, {"id": customer_id})

                        # Update the onboarding record
                        update_query = """
                        UPDATE user_onboarding
                        SET customer_portal_enabled = true
                        WHERE id = :id
                        """
                        session.execute(update_query, {"id": onboarding_id})

                    # Generate a temporary password
                    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
                    password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

                    # Check if credentials already exist
                    credential_query = """
                    SELECT id FROM customer_credentials
                    WHERE customer_id = :customer_id AND partner_id = :partner_id
                    """
                    credential_result = session.execute(credential_query, {
                        "customer_id": customer_id,
                        "partner_id": partner_id
                    })
                    credential = credential_result.fetchone()

                    if credential:
                        # Update existing credentials
                        update_credential_query = """
                        UPDATE customer_credentials
                        SET password_hash = :password_hash, status = 'active', last_reset = NOW()
                        WHERE id = :id
                        """
                        session.execute(update_credential_query, {
                            "password_hash": password_hash,
                            "id": credential["id"]
                        })
                    else:
                        # Create new credentials
                        credential_query = """
                        INSERT INTO customer_credentials (
                            id, customer_id, partner_id, email, password_hash, status, last_reset
                        )
                        VALUES (
                            :id, :customer_id, :partner_id, :email, :password_hash, 'active', NOW()
                        )
                        """
                        credential_params = {
                            "id": str(uuid.uuid4()),
                            "customer_id": customer_id,
                            "partner_id": partner_id,
                            "email": onboarding["email"],
                            "password_hash": password_hash
                        }
                        session.execute(credential_query, credential_params)

                    # Get partner details for portal URL
                    partner_query = """
                    SELECT business_name, subdomain, custom_domain, custom_domain_verified
                    FROM partners
                    WHERE id = :id
                    """
                    partner_result = session.execute(partner_query, {"id": partner_id})
                    partner = dict(partner_result.fetchone())

                    # Determine portal URL
                    portal_url = None
                    if partner["custom_domain_verified"] and partner["custom_domain"]:
                        portal_url = f"https://{partner['custom_domain']}"
                    elif partner["subdomain"]:
                        portal_url = f"https://{partner['subdomain']}.knotie-ai.pro"
                    else:
                        portal_url = f"https://knotie-ai.pro?partner={partner_id}"

                    # Commit the transaction
                    transaction.commit()

                    result = {
                        "customerId": customer_id,
                        "portalUrl": portal_url,
                        "emailSent": False
                    }

                    # Send email if requested
                    if send_email:
                        # Email sending would be implemented here
                        # For now, just return the temporary password
                        result["tempPassword"] = temp_password
                        result["emailSent"] = True

                    return result

                except Exception as e:
                    # Rollback the transaction on error
                    transaction.rollback()
                    logger.error(f"Error in enable_portal_access transaction: {str(e)}")
                    raise

        except Exception as e:
            logger.error(f"Error enabling portal access: {str(e)}")
            return None
```

## Authentication Utilities

We need to implement partner API key verification:

```python
# analytics/utils/partner_auth.py

from fastapi import Depends, HTTPException, Header
from db.neondb_extensions import MCPNeonDBClient
from utils.encryption import decrypt_text
import logging

logger = logging.getLogger(__name__)

async def verify_partner_api_key(x_api_key: str = Header(..., description="Partner API key")):
    """
    Verify a partner API key and return partner information if valid
    """
    try:
        # Extract the prefix to determine if it's a partner key
        if not x_api_key.startswith("pkt_"):
            raise HTTPException(status_code=401, detail="Invalid API key format")

        neondb = MCPNeonDBClient()

        # Get all active partner API keys
        partner_keys = neondb.get_partner_api_keys(status="active")

        # Check each key by decrypting and comparing
        for key in partner_keys:
            decrypted_key = decrypt_text(key["api_key"])
            if decrypted_key == x_api_key:
                # Update last used timestamp and usage count
                neondb.update_partner_api_key_usage(key["id"])

                # Get partner details
                partner = neondb.get_partner_by_id(key["partner_id"])
                if not partner:
                    raise HTTPException(status_code=404, detail="Partner not found")

                if partner["approval_status"] != "ACTIVE":
                    raise HTTPException(status_code=403, detail="Partner account is not active")

                return {
                    "type": "partner",
                    "keyId": key["id"],
                    "partnerId": key["partner_id"],
                    "partnerName": partner["business_name"]
                }

        raise HTTPException(status_code=401, detail="Invalid API key")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying partner API key: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

## API Models

Define Pydantic models for request/response validation:

```python
# analytics/models/mcp/customers.py

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class BasicInfo(BaseModel):
    email: EmailStr
    firstName: str = Field(..., min_length=1)
    lastName: str = Field(..., min_length=1)
    businessPhone: Optional[str] = None

class BusinessInfo(BaseModel):
    companyName: str = Field(..., min_length=1)
    monthlyCallVolume: Optional[str] = None
    peakHours: Optional[str] = None

class RequirementsInfo(BaseModel):
    primaryUseCase: Optional[str] = None
    callComplexity: Optional[str] = None
    scriptComplexity: Optional[str] = None

class IntegrationInfo(BaseModel):
    crmSystem: Optional[str] = None
    phoneSystem: Optional[str] = None

class DeploymentInfo(BaseModel):
    deploymentTimeline: Optional[str] = None

class CustomerOnboardRequest(BaseModel):
    basic: BasicInfo
    business: BusinessInfo
    requirements: Optional[RequirementsInfo] = None
    integration: Optional[IntegrationInfo] = None
    deployment: Optional[DeploymentInfo] = None

class CustomerCreate(BaseModel):
    email: EmailStr
    firstName: str = Field(..., min_length=1)
    lastName: str = Field(..., min_length=1)
    companyName: Optional[str] = None
    onboardingId: str

class CustomerResponse(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    companyName: Optional[str] = None
    customerPortalEnabled: bool
    createdAt: datetime

class CustomerUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    companyName: Optional[str] = None
    enableApiAccess: Optional[bool] = None
    showApiKeys: Optional[bool] = None
    showKnowledgeBase: Optional[bool] = None
    showIntegration: Optional[bool] = None
    showDocsAndMedia: Optional[bool] = None
    showScheduleMeeting: Optional[bool] = None
    showPricingInformation: Optional[bool] = None
    enableTeamMembers: Optional[bool] = None
    maxTeamMembers: Optional[int] = None
```

## API Endpoints

Implement the customer management endpoints:

```python
# analytics/api/v1/mcp/customers.py

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List

from models.mcp.customers import CustomerOnboardRequest, CustomerCreate, CustomerResponse, CustomerUpdate
from db.neondb_extensions import MCPNeonDBClient
from utils.partner_auth import verify_partner_api_key

router = APIRouter(prefix="/customers", tags=["MCP - Customers"])

@router.post("/onboard", response_model=dict, status_code=201)
async def onboard_customer(
    onboard_request: CustomerOnboardRequest,
    partner_auth: dict = Depends(verify_partner_api_key)
):
    """Onboard a new customer by creating a UserOnboarding record"""
    try:
        neondb = MCPNeonDBClient()

        # Check if customer with this email already exists
        existing_onboarding = neondb.get_user_onboarding_by_email(onboard_request.basic.email, partner_auth["partnerId"])
        if existing_onboarding:
            raise HTTPException(
                status_code=400,
                detail="A customer with this email already exists"
            )

        # Create the user onboarding record
        new_onboarding = neondb.create_user_onboarding(
            partner_id=partner_auth["partnerId"],
            email=onboard_request.basic.email,
            first_name=onboard_request.basic.firstName,
            last_name=onboard_request.basic.lastName,
            business_phone=onboard_request.basic.businessPhone,
            company_name=onboard_request.business.companyName,
            monthly_call_volume=onboard_request.business.monthlyCallVolume,
            peak_hours=onboard_request.business.peakHours,
            primary_use_case=onboard_request.requirements.primaryUseCase if onboard_request.requirements else None,
            call_complexity=onboard_request.requirements.callComplexity if onboard_request.requirements else None,
            script_complexity=onboard_request.requirements.scriptComplexity if onboard_request.requirements else None,
            crm_system=onboard_request.integration.crmSystem if onboard_request.integration else None,
            phone_system=onboard_request.integration.phoneSystem if onboard_request.integration else None,
            deployment_timeline=onboard_request.deployment.deploymentTimeline if onboard_request.deployment else None
        )

        if not new_onboarding:
            raise HTTPException(
                status_code=500,
                detail="Failed to onboard customer"
            )

        return {
            "success": True,
            "message": "Customer onboarded successfully",
            "data": {
                "id": new_onboarding["id"],
                "email": new_onboarding["email"],
                "firstName": new_onboarding["first_name"],
                "lastName": new_onboarding["last_name"],
                "companyName": new_onboarding["company_name"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=dict, status_code=201)
async def create_customer(
    customer: CustomerCreate,
    partner_auth: dict = Depends(verify_partner_api_key)
):
    """Create a customer record from an existing onboarding record"""
    try:
        neondb = MCPNeonDBClient()

        # Check if the onboarding record exists and belongs to this partner
        onboarding = neondb.get_user_onboarding_by_id(customer.onboardingId, partner_auth["partnerId"])
        if not onboarding:
            raise HTTPException(
                status_code=404,
                detail="Onboarding record not found or does not belong to this partner"
            )

        # Check if a customer with this email already exists
        existing_customer = neondb.get_customer_by_email(customer.email)
        if existing_customer:
            raise HTTPException(
                status_code=400,
                detail="A customer with this email already exists"
            )

        # Create the customer record
        new_customer = neondb.create_customer_from_onboarding(
            onboarding_id=customer.onboardingId,
            email=customer.email,
            first_name=customer.firstName,
            last_name=customer.lastName,
            company_name=customer.companyName
        )

        if not new_customer:
            raise HTTPException(
                status_code=500,
                detail="Failed to create customer"
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Main API Router Configuration

Register the MCP routers in the main FastAPI application:

```python
# analytics/api/v1/__init__.py

from fastapi import APIRouter
from .mcp import customers, portal_access, agents, team_members

router = APIRouter(prefix="/v1/mcp")

# Register MCP routers
router.include_router(customers.router)
router.include_router(portal_access.router)
router.include_router(agents.router)
router.include_router(team_members.router)
```

```python
# analytics/api/main.py

# Add this to the existing imports
from .v1 import router as v1_router

# Add this to the router registration section
app.include_router(v1_router)
```

## Testing

Create comprehensive tests for each endpoint:

```python
# analytics/tests/test_mcp_customers.py

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_create_customer_success():
    # Mock valid API key
    headers = {"X-API-Key": "pkt_test_valid_key"}

    # Test data
    data = {
        "email": "test@example.com",
        "firstName": "Test",
        "lastName": "User",
        "companyName": "Test Company",
        "password": "securePassword123"
    }

    # Mock the partner_auth dependency
    app.dependency_overrides[verify_partner_api_key] = lambda: {
        "type": "partner",
        "keyId": "key_123",
        "partnerId": "partner_123",
        "partnerName": "Test Partner"
    }

    response = client.post("/api/v1/mcp/customers", json=data, headers=headers)

    assert response.status_code == 201
    assert response.json()["success"] is True
    assert "data" in response.json()
    assert response.json()["data"]["email"] == "test@example.com"
```

## Deployment

Update the Docker Compose configuration to include the new dependencies:

```yaml
# docker-compose.unified.yml (excerpt)
analytics:
  build:
    context: ./analytics
    dockerfile: Dockerfile
  environment:
    - NEONDB_URL=${NEONDB_URL}
    - SUPABASE_URL=${SUPABASE_URL}
    - SUPABASE_KEY=${SUPABASE_KEY}
    - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    - API_KEY=${ANALYTICS_API_KEY}
    - ADMIN_API_KEY=${ANALYTICS_ADMIN_API_KEY}
    - ENCRYPTION_KEY=${ENCRYPTION_KEY}
  ports:
    - "8001:8000"
  volumes:
    - ./analytics:/app
  depends_on:
    - redis
```

## Next Steps

1. Implement all the API endpoints according to the specification
2. Write comprehensive tests for each endpoint
3. Update the OpenAPI documentation
4. Deploy and monitor the new MCP Server APIs
