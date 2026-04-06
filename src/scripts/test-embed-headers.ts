#!/usr/bin/env tsx

/**
 * Test script to simulate the embed request and verify header handling
 */

import { validateRefererDomain } from '@/lib/embedTokenSecurity';

// Simulate the request headers from the curl command
function createMockRequest(headers: Record<string, string>) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null
    }
  } as any;
}

async function testEmbedHeaders() {
  console.log('🧪 Testing Embed Header Handling\n');

  // Test case 1: Direct browser request (working case)
  console.log('1. Testing direct browser request (should work):');
  const directRequest = createMockRequest({
    'referer': 'https://app.knolabs.biz/',
    'origin': 'https://app.knolabs.biz',
    'cf-connecting-domain': 'app.viddescriptor.com',
    'x-original-host': 'app.viddescriptor.com',
  });

  const directResult = validateRefererDomain(directRequest, ['app.knolabs.biz']);
  console.log(`   Result: ${directResult.isValid ? '✅ PASS' : '❌ FAIL'}`);
  if (!directResult.isValid) {
    console.log(`   Error: ${directResult.error}`);
  }
  console.log('');

  // Test case 2: Iframe request without worker headers (current failing case)
  console.log('2. Testing iframe request without worker headers (current issue):');
  const iframeRequestNoHeaders = createMockRequest({
    'referer': 'https://app.knolabs.biz/',
    'origin': 'https://app.knolabs.biz',
    'sec-fetch-dest': 'iframe',
    'sec-fetch-site': 'cross-site',
    // Missing cf-connecting-domain and x-original-host
  });

  const iframeNoHeadersResult = validateRefererDomain(iframeRequestNoHeaders, ['app.knolabs.biz']);
  console.log(`   Result: ${iframeNoHeadersResult.isValid ? '✅ PASS' : '❌ FAIL'}`);
  if (!iframeNoHeadersResult.isValid) {
    console.log(`   Error: ${iframeNoHeadersResult.error}`);
  }
  console.log('');

  // Test case 3: Iframe request with worker headers (should work after fix)
  console.log('3. Testing iframe request with worker headers (after fix):');
  const iframeRequestWithHeaders = createMockRequest({
    'referer': 'https://app.knolabs.biz/',
    'origin': 'https://app.knolabs.biz',
    'sec-fetch-dest': 'iframe',
    'sec-fetch-site': 'cross-site',
    'x-embed-referer': 'https://app.knolabs.biz/',
    'x-iframe-original-domain': 'app.viddescriptor.com',
    'x-cross-site-domain': 'app.viddescriptor.com',
  });

  const iframeWithHeadersResult = validateRefererDomain(iframeRequestWithHeaders, ['app.knolabs.biz']);
  console.log(`   Result: ${iframeWithHeadersResult.isValid ? '✅ PASS' : '❌ FAIL'}`);
  if (!iframeWithHeadersResult.isValid) {
    console.log(`   Error: ${iframeWithHeadersResult.error}`);
  }
  console.log('');

  // Test case 4: Wrong domain (should fail)
  console.log('4. Testing wrong domain (should fail):');
  const wrongDomainRequest = createMockRequest({
    'referer': 'https://malicious-site.com/',
    'origin': 'https://malicious-site.com',
  });

  const wrongDomainResult = validateRefererDomain(wrongDomainRequest, ['app.knolabs.biz']);
  console.log(`   Result: ${wrongDomainResult.isValid ? '❌ UNEXPECTED PASS' : '✅ CORRECTLY FAILED'}`);
  if (!wrongDomainResult.isValid) {
    console.log(`   Error: ${wrongDomainResult.error}`);
  }
  console.log('');

  console.log('📋 Summary:');
  console.log('- Direct browser requests should work (case 1)');
  console.log('- Iframe requests might fail without proper headers (case 2)');
  console.log('- Iframe requests should work with worker headers (case 3)');
  console.log('- Wrong domains should always fail (case 4)');
  console.log('');
  console.log('🔧 Next steps:');
  console.log('1. Deploy the updated Cloudflare Worker');
  console.log('2. Deploy the updated middleware and embed security');
  console.log('3. Test the iframe embedding from GHL');
}

testEmbedHeaders().catch(console.error);
