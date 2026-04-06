# MCP Server Implementation for Knotie AI Platform

## Overview

This repository contains documentation and implementation plans for enabling MCP (Multi-Channel Platform) Server support with Server-Sent Events (SSE) for the Knotie AI platform. The goal is to allow partners to programmatically manage customers, control portal access, map/unmap agents, and manage customer features through API endpoints.

## Architecture Decision

After analyzing the current system architecture, we've decided to implement the MCP Server APIs in the **analytics service** for the following reasons:

1. The analytics service is built with FastAPI, which can handle more API requests efficiently without impacting the main app performance
2. The analytics service already has a connection to both NeonDB and Supabase
3. The analytics service has an established API key authentication system
4. Moving these APIs to the analytics service will help distribute the load

## Documentation Structure

This repository contains the following documentation:

1. [Implementation Guide](./implementation-guide.md) - High-level overview and implementation checklist
2. [API Specification](./api-specification.md) - Detailed API endpoint specifications
3. [Technical Implementation](./technical-implementation.md) - Technical details and code examples
4. [Migration Strategy](./migration-strategy.md) - Plan for migrating from app API routes to analytics service
5. [Testing Strategy](./testing-strategy.md) - Comprehensive testing approach

## Key Features

The MCP Server implementation will provide the following key features:

### Customer Management

- Create new customers
- List all customers for a partner
- Get customer details
- Update customer details
- Delete customers (soft delete)

### Portal Access Management

- Enable/reset portal access
- Block portal access
- Reset customer passwords

### Agent Mapping

- Map Retell agents to customers
- Unmap Retell agents from customers
- Map VAPI agents to customers
- Unmap VAPI agents from customers

### Feature Management

- Control customer portal features
- Enable/disable API access
- Configure menu visibility options
- Manage pricing information visibility

### Team Member Management

- Invite team members
- List team members
- Remove team members

## Implementation Timeline

The implementation will follow this approximate timeline:

1. **Week 1-2**: Set up database connectivity, implement API key authentication, and create core API endpoints
2. **Week 3**: Create proxy routes in the Next.js app and add authentication translation
3. **Week 4-5**: Migrate endpoints one by one and conduct A/B testing
4. **Week 6**: Complete migration, clean up code, and update documentation

## Getting Started

To start working on the MCP Server implementation, follow these steps:

1. Review the [Implementation Guide](./implementation-guide.md) to understand the overall approach
2. Study the [API Specification](./api-specification.md) to understand the required endpoints
3. Follow the [Technical Implementation](./technical-implementation.md) for code examples and technical details
4. Refer to the [Migration Strategy](./migration-strategy.md) for the plan to migrate from app API routes
5. Use the [Testing Strategy](./testing-strategy.md) to ensure comprehensive testing

## Development Environment Setup

To set up the development environment:

1. Clone the repository
2. Install dependencies for both the Next.js app and analytics service
3. Set up the required environment variables
4. Start the development servers

```bash
# Clone the repository
git clone https://github.com/your-org/knotie-ai-pro.git
cd knotie-ai-pro

# Install dependencies for the Next.js app
npm install

# Install dependencies for the analytics service
cd analytics
pip install -r requirements.txt
cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development servers
docker-compose -f docker-compose.unified.yml up
```

## Testing

To run the tests:

```bash
# Run Next.js app tests
npm test

# Run analytics service tests
cd analytics
pytest
```

## Deployment

The MCP Server will be deployed using Coolify, the same as the existing Knotie AI platform. The deployment process will include:

1. Building the Docker images
2. Deploying the containers
3. Configuring the environment variables
4. Setting up the network connections

## Monitoring and Observability

The MCP Server implementation will include comprehensive monitoring and observability:

1. Logging of all API requests and responses
2. Performance metrics collection
3. Error tracking and alerting
4. Dashboard for monitoring system health

## Security Considerations

The MCP Server implementation will follow these security best practices:

1. API key authentication with proper validation
2. Rate limiting to prevent abuse
3. Input validation and sanitization
4. Proper error handling to prevent information leakage
5. Encryption of sensitive data

## Contributing

To contribute to the MCP Server implementation:

1. Create a new branch for your feature or bug fix
2. Make your changes
3. Write tests for your changes
4. Submit a pull request

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For questions or support, please contact the Knotie AI team.
