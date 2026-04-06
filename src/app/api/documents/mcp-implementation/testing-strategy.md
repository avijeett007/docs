# MCP Server Testing Strategy

## Overview

This document outlines the testing strategy for the MCP Server implementation. Comprehensive testing is essential to ensure the reliability, security, and performance of the new API endpoints.

## Testing Levels

### 1. Unit Testing

Unit tests will verify the functionality of individual components in isolation.

**Key Components to Test:**

- **API Key Authentication**:
  - Verify valid API keys are accepted
  - Verify invalid API keys are rejected
  - Verify expired API keys are rejected
  - Verify rate limiting functionality

- **Database Operations**:
  - Verify CRUD operations for customers
  - Verify CRUD operations for team members
  - Verify agent mapping/unmapping
  - Verify portal access management

- **Request Validation**:
  - Verify input validation for all endpoints
  - Test boundary conditions and edge cases
  - Test error handling for invalid inputs

**Tools:**
- pytest for Python tests
- unittest.mock for mocking dependencies
- FastAPI TestClient for API testing

**Example Unit Test:**

```python
# Test API key authentication
def test_verify_partner_api_key():
    # Test valid API key
    valid_key = "pkt_valid_test_key"
    mock_db_client = MagicMock()
    mock_db_client.get_partner_api_keys.return_value = [{
        "id": "key_123",
        "partner_id": "partner_123",
        "api_key": encrypt_text(valid_key),
        "status": "active"
    }]
    
    # Mock partner data
    mock_db_client.get_partner_by_id.return_value = {
        "id": "partner_123",
        "business_name": "Test Partner",
        "approval_status": "ACTIVE"
    }
    
    # Patch the database client
    with patch("utils.partner_auth.MCPNeonDBClient", return_value=mock_db_client):
        # Call the function
        result = verify_partner_api_key(valid_key)
        
        # Verify the result
        assert result["type"] == "partner"
        assert result["partnerId"] == "partner_123"
        assert result["partnerName"] == "Test Partner"
```

### 2. Integration Testing

Integration tests will verify the interaction between components and external systems.

**Key Integrations to Test:**

- **Database Integration**:
  - Verify connectivity to NeonDB
  - Verify transactions across multiple tables
  - Verify data consistency after operations

- **Authentication Flow**:
  - Verify end-to-end authentication process
  - Test token generation and validation
  - Test permission checks

- **Email Notifications**:
  - Verify email sending functionality
  - Test email templates and content
  - Verify email delivery

**Tools:**
- pytest for Python tests
- Docker Compose for local environment setup
- Test databases for integration testing

**Example Integration Test:**

```python
# Test customer creation with database integration
def test_create_customer_integration():
    # Set up test database
    setup_test_database()
    
    # Create a test client
    client = TestClient(app)
    
    # Test data
    data = {
        "email": "test@example.com",
        "firstName": "Test",
        "lastName": "User",
        "companyName": "Test Company",
        "password": "securePassword123"
    }
    
    # Set up test API key
    headers = {"X-API-Key": TEST_PARTNER_API_KEY}
    
    # Make the request
    response = client.post("/api/v1/mcp/customers", json=data, headers=headers)
    
    # Verify the response
    assert response.status_code == 201
    assert response.json()["success"] is True
    
    # Verify the database state
    db_client = MCPNeonDBClient()
    customer = db_client.get_customer_by_email("test@example.com")
    assert customer is not None
    assert customer["first_name"] == "Test"
    assert customer["last_name"] == "User"
    
    # Verify related records
    credentials = db_client.get_customer_credentials(customer["id"])
    assert credentials is not None
    assert credentials["status"] == "active"
    
    # Clean up test data
    teardown_test_database()
```

### 3. End-to-End Testing

End-to-end tests will verify the complete system behavior from user interaction to database changes.

**Key Scenarios to Test:**

- **Customer Lifecycle**:
  - Create a new customer
  - Enable portal access
  - Map agents to the customer
  - Invite team members
  - Block portal access
  - Delete the customer

- **Agent Management**:
  - Create a new agent
  - Map to a customer
  - Unmap from a customer
  - Delete the agent

- **Team Member Management**:
  - Invite a team member
  - Accept the invitation
  - Login as the team member
  - Remove the team member

**Tools:**
- Postman for API testing
- Cypress for UI testing (if applicable)
- Custom test scripts for complex scenarios

**Example End-to-End Test:**

```python
# Test complete customer lifecycle
def test_customer_lifecycle():
    # Set up test environment
    setup_test_environment()
    
    # Create a test client
    client = TestClient(app)
    headers = {"X-API-Key": TEST_PARTNER_API_KEY}
    
    # 1. Create a new customer
    customer_data = {
        "email": "lifecycle@example.com",
        "firstName": "Lifecycle",
        "lastName": "Test",
        "companyName": "Lifecycle Company",
        "password": "securePassword123"
    }
    
    response = client.post("/api/v1/mcp/customers", json=customer_data, headers=headers)
    assert response.status_code == 201
    customer_id = response.json()["data"]["id"]
    
    # 2. Enable portal access
    portal_data = {"sendEmail": False}
    response = client.post(f"/api/v1/mcp/customers/{customer_id}/portal-access", json=portal_data, headers=headers)
    assert response.status_code == 200
    
    # 3. Create and map an agent
    # (Assuming agent creation endpoint exists)
    agent_data = {"name": "Test Agent", "type": "retell"}
    response = client.post("/api/v1/mcp/retell-agents", json=agent_data, headers=headers)
    assert response.status_code == 201
    agent_id = response.json()["data"]["id"]
    
    # Map the agent to the customer
    map_data = {"customerId": customer_id, "profitMultiplier": 1.5}
    response = client.post(f"/api/v1/mcp/retell-agents/{agent_id}/map-customer", json=map_data, headers=headers)
    assert response.status_code == 200
    
    # 4. Invite a team member
    team_member_data = {
        "email": "team@example.com",
        "name": "Team Member",
        "role": "member"
    }
    response = client.post(f"/api/v1/mcp/customers/{customer_id}/team-members", json=team_member_data, headers=headers)
    assert response.status_code == 201
    team_member_id = response.json()["data"]["id"]
    
    # 5. Block portal access
    response = client.post(f"/api/v1/mcp/customers/{customer_id}/portal-access/block", headers=headers)
    assert response.status_code == 200
    
    # 6. Clean up
    # Remove team member
    response = client.delete(f"/api/v1/mcp/customers/{customer_id}/team-members/{team_member_id}", headers=headers)
    assert response.status_code == 200
    
    # Unmap agent
    response = client.post(f"/api/v1/mcp/retell-agents/{agent_id}/unmap-customer", headers=headers)
    assert response.status_code == 200
    
    # Delete agent
    response = client.delete(f"/api/v1/mcp/retell-agents/{agent_id}", headers=headers)
    assert response.status_code == 200
    
    # Delete customer
    response = client.delete(f"/api/v1/mcp/customers/{customer_id}", headers=headers)
    assert response.status_code == 200
    
    # Tear down test environment
    teardown_test_environment()
```

### 4. Performance Testing

Performance tests will verify the system's ability to handle expected load and stress conditions.

**Key Metrics to Test:**

- **Response Time**:
  - Measure average response time for each endpoint
  - Verify response times under different load conditions
  - Identify performance bottlenecks

- **Throughput**:
  - Measure requests per second the system can handle
  - Verify throughput under different concurrency levels
  - Test the impact of database operations on throughput

- **Resource Utilization**:
  - Monitor CPU, memory, and disk usage
  - Identify resource bottlenecks
  - Optimize resource usage

**Tools:**
- Locust for load testing
- Prometheus for metrics collection
- Grafana for visualization

**Example Performance Test:**

```python
# Locust load test for customer creation
from locust import HttpUser, task, between

class MCPUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Set up API key
        self.client.headers = {"X-API-Key": "pkt_test_key"}
    
    @task
    def create_customer(self):
        # Generate unique email
        email = f"test_{self.environment.runner.user_count}_{self.environment.runner.iter_count}@example.com"
        
        # Create customer data
        data = {
            "email": email,
            "firstName": "Performance",
            "lastName": "Test",
            "companyName": "Performance Company",
            "password": "securePassword123"
        }
        
        # Make the request
        self.client.post("/api/v1/mcp/customers", json=data)
```

### 5. Security Testing

Security tests will verify the system's resistance to various attacks and vulnerabilities.

**Key Security Aspects to Test:**

- **Authentication**:
  - Test API key validation
  - Test token expiration and revocation
  - Test rate limiting and brute force protection

- **Authorization**:
  - Test access control for different user roles
  - Verify proper permission checks
  - Test multi-tenancy isolation

- **Data Protection**:
  - Test input validation and sanitization
  - Test protection against injection attacks
  - Verify proper encryption of sensitive data

**Tools:**
- OWASP ZAP for vulnerability scanning
- Custom scripts for security testing
- Manual penetration testing

**Example Security Test:**

```python
# Test API key security
def test_api_key_security():
    # Set up test client
    client = TestClient(app)
    
    # Test missing API key
    response = client.get("/api/v1/mcp/customers")
    assert response.status_code == 401
    
    # Test invalid API key
    headers = {"X-API-Key": "invalid_key"}
    response = client.get("/api/v1/mcp/customers", headers=headers)
    assert response.status_code == 401
    
    # Test expired API key
    headers = {"X-API-Key": "pkt_expired_key"}
    response = client.get("/api/v1/mcp/customers", headers=headers)
    assert response.status_code == 401
    
    # Test rate limiting
    headers = {"X-API-Key": TEST_PARTNER_API_KEY}
    for _ in range(100):  # Exceed rate limit
        client.get("/api/v1/mcp/customers", headers=headers)
    
    response = client.get("/api/v1/mcp/customers", headers=headers)
    assert response.status_code == 429  # Too Many Requests
```

## Test Environment Setup

### Local Development Environment

For local testing, we will set up a Docker Compose environment with:

- FastAPI analytics service
- PostgreSQL database (for both NeonDB and Supabase schemas)
- Redis for caching and rate limiting
- Mock SMTP server for email testing

### CI/CD Pipeline

For automated testing in the CI/CD pipeline, we will:

- Set up GitHub Actions workflows
- Use containerized test environments
- Run unit and integration tests on every pull request
- Run performance and security tests on main branch merges

## Test Data Management

### Test Data Generation

We will create scripts to generate test data for:

- Partners
- Customers
- Agents
- Team members

### Database Seeding

For integration and end-to-end tests, we will:

- Create database migration scripts for test schemas
- Seed the database with test data
- Reset the database between test runs

## Reporting and Documentation

### Test Reports

We will generate comprehensive test reports including:

- Test coverage metrics
- Pass/fail statistics
- Performance metrics
- Security vulnerabilities

### Documentation

We will maintain up-to-date testing documentation:

- Test plans for each component
- Test case specifications
- Test environment setup instructions
- Troubleshooting guides

## Conclusion

This testing strategy provides a comprehensive approach to ensuring the quality, reliability, and security of the MCP Server implementation. By following this strategy, we can identify and address issues early in the development process and deliver a robust solution that meets the needs of the Knotie AI platform.
