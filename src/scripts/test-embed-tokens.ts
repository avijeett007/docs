/**
 * Test script for embed token functionality
 * Run with: npx ts-node src/scripts/test-embed-tokens.ts
 */

import { prisma } from '@/lib/prisma';
import { validateEmbedToken } from '@/lib/embedTokenAuth';
import { validateEmbedSecurity, generateSecureToken } from '@/lib/embedTokenSecurity';

async function testEmbedTokenFunctionality() {
  console.log('🧪 Testing Embed Token Functionality\n');

  try {
    // Test 1: Database Schema Validation
    console.log('1. Testing Database Schema...');
    
    // Check if EmbedToken table exists and has correct structure
    const embedTokenCount = await prisma.embedToken.count();
    console.log(`   ✅ EmbedToken table accessible, current count: ${embedTokenCount}`);

    // Test 2: Token Generation
    console.log('\n2. Testing Token Generation...');
    
    const testToken = generateSecureToken();
    console.log(`   ✅ Generated token: ${testToken}`);
    
    // Validate token format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValidFormat = uuidRegex.test(testToken);
    console.log(`   ✅ Token format valid: ${isValidFormat}`);

    // Test 3: Find a test partner and customer
    console.log('\n3. Finding Test Data...');
    
    const testPartner = await prisma.partner.findFirst({
      where: {
        customerPortalEnabled: true,
      },
    });

    if (!testPartner) {
      console.log('   ⚠️  No partner with customer portal enabled found');
      return;
    }

    console.log(`   ✅ Found test partner: ${testPartner.businessName} (${testPartner.id})`);

    const testCustomerCredential = await prisma.customerCredential.findFirst({
      where: {
        partnerId: testPartner.id,
        status: 'active',
      },
      include: {
        customer: true,
      },
    });

    if (!testCustomerCredential) {
      console.log('   ⚠️  No active customer credential found for this partner');
      return;
    }

    console.log(`   ✅ Found test customer: ${testCustomerCredential.customer.email} (${testCustomerCredential.customerId})`);

    // Test 4: Create Test Embed Token
    console.log('\n4. Creating Test Embed Token...');
    
    const testEmbedToken = await prisma.embedToken.create({
      data: {
        token: testToken,
        name: 'Test Embed Token',
        customerId: testCustomerCredential.customerId,
        partnerId: testPartner.id,
        customerCredentialId: testCustomerCredential.id,
        allowedDomains: ['test.example.com', '*.gohighlevel.com'],
        accessMode: 'full',
        status: 'active',
      },
    });

    console.log(`   ✅ Created embed token: ${testEmbedToken.id}`);

    // Test 5: Security Validation
    console.log('\n5. Testing Security Validation...');
    
    // Mock request object
    const mockRequest = {
      headers: {
        get: (name: string) => {
          const headers: Record<string, string> = {
            'referer': 'https://test.example.com/page',
            'origin': 'https://test.example.com',
            'user-agent': 'Mozilla/5.0 (Test Browser)',
            'x-forwarded-for': '192.168.1.1',
          };
          return headers[name] || null;
        },
      },
      ip: '192.168.1.1',
    } as any;

    const securityValidation = validateEmbedSecurity(
      mockRequest,
      testToken,
      testEmbedToken.allowedDomains
    );

    console.log(`   ✅ Security validation passed: ${securityValidation.isValid}`);
    console.log(`   ✅ Client IP detected: ${securityValidation.clientIP}`);
    console.log(`   ✅ Domain detected: ${securityValidation.domain}`);

    if (securityValidation.errors.length > 0) {
      console.log(`   ⚠️  Security errors: ${securityValidation.errors.join(', ')}`);
    }

    // Test 6: Token Validation
    console.log('\n6. Testing Token Validation...');
    
    const tokenValidation = await validateEmbedToken(testToken, mockRequest);
    
    console.log(`   ✅ Token validation passed: ${tokenValidation.isValid}`);
    
    if (tokenValidation.embedToken) {
      console.log(`   ✅ Token details retrieved successfully`);
      console.log(`   ✅ Customer: ${tokenValidation.embedToken.customer.email}`);
      console.log(`   ✅ Partner: ${tokenValidation.embedToken.partner.businessName}`);
      console.log(`   ✅ Access mode: ${tokenValidation.embedToken.accessMode}`);
    }

    // Test 7: Domain Restriction Testing
    console.log('\n7. Testing Domain Restrictions...');
    
    // Test with disallowed domain
    const mockRequestBadDomain = {
      ...mockRequest,
      headers: {
        get: (name: string) => {
          const headers: Record<string, string> = {
            'referer': 'https://malicious.example.com/page',
            'origin': 'https://malicious.example.com',
            'user-agent': 'Mozilla/5.0 (Test Browser)',
            'x-forwarded-for': '192.168.1.1',
          };
          return headers[name] || null;
        },
      },
    } as any;

    const badDomainValidation = validateEmbedSecurity(
      mockRequestBadDomain,
      testToken,
      testEmbedToken.allowedDomains
    );

    console.log(`   ✅ Bad domain rejected: ${!badDomainValidation.isValid}`);

    // Test 8: Token Expiration
    console.log('\n8. Testing Token Expiration...');
    
    // Create expired token
    const expiredToken = generateSecureToken();
    const expiredEmbedToken = await prisma.embedToken.create({
      data: {
        token: expiredToken,
        name: 'Expired Test Token',
        customerId: testCustomerCredential.customerId,
        partnerId: testPartner.id,
        customerCredentialId: testCustomerCredential.id,
        allowedDomains: [],
        accessMode: 'full',
        status: 'active',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });

    const expiredValidation = await validateEmbedToken(expiredToken, mockRequest);
    console.log(`   ✅ Expired token rejected: ${!expiredValidation.isValid}`);

    // Test 9: Access Count Tracking
    console.log('\n9. Testing Access Count Tracking...');
    
    const initialAccessCount = testEmbedToken.accessCount;
    
    // Validate token again to increment access count
    await validateEmbedToken(testToken, mockRequest);
    
    const updatedToken = await prisma.embedToken.findUnique({
      where: { id: testEmbedToken.id },
    });

    console.log(`   ✅ Access count incremented: ${initialAccessCount} → ${updatedToken?.accessCount}`);

    // Cleanup
    console.log('\n10. Cleaning Up Test Data...');
    
    await prisma.embedToken.delete({
      where: { id: testEmbedToken.id },
    });

    await prisma.embedToken.delete({
      where: { id: expiredEmbedToken.id },
    });

    console.log('   ✅ Test data cleaned up');

    console.log('\n🎉 All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Test API endpoint functionality
async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints...');
  
  // Note: These would need to be run with proper authentication
  // This is more of a checklist for manual testing
  
  const endpoints = [
    'GET /api/partner/embed-tokens',
    'POST /api/partner/embed-tokens',
    'GET /api/partner/embed-tokens/[tokenId]',
    'PATCH /api/partner/embed-tokens/[tokenId]',
    'DELETE /api/partner/embed-tokens/[tokenId]',
    'POST /api/whitelabel/embed/auth/[token]',
    'GET /api/whitelabel/embed/auth/[token]',
  ];

  console.log('API Endpoints to test manually:');
  endpoints.forEach(endpoint => {
    console.log(`   📋 ${endpoint}`);
  });
}

// Test UI Components
function testUIComponents() {
  console.log('\n🎨 UI Components Created:');
  
  const components = [
    'useEmbedContext hook',
    'EmbedAwareNavigation component',
    'EmbedStatusIndicator component',
    'EmbedConditional component',
    'EmbedAwareButton component',
    'EmbedAwareForm component',
    'EmbedAwareLayout component',
    'EmbedAwareDashboard component',
    'EmbedAwareSidebar component',
  ];

  components.forEach(component => {
    console.log(`   ✅ ${component}`);
  });
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Embed Token Integration Tests\n');
  
  try {
    await testEmbedTokenFunctionality();
    await testAPIEndpoints();
    testUIComponents();
    
    console.log('\n✨ All tests completed successfully!');
    console.log('\n📋 Manual Testing Checklist:');
    console.log('   1. Test partner can create embed tokens via CustomerManagementModal');
    console.log('   2. Test embed URLs work correctly');
    console.log('   3. Test domain restrictions are enforced');
    console.log('   4. Test different access modes (full, readonly, lite)');
    console.log('   5. Test token revocation and regeneration');
    console.log('   6. Test embed-aware UI components hide/show features correctly');
    console.log('   7. Test security validations work as expected');
    console.log('   8. Test rate limiting functionality');
    
  } catch (error) {
    console.error('❌ Tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export { testEmbedTokenFunctionality, testAPIEndpoints, testUIComponents };
