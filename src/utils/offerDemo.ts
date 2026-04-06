/**
 * Demo script to show how the offer expiration logic works
 * This can be run to verify the functionality
 */

import { isOfferExpired, getTimeRemaining, getFormattedOfferEndDate, OFFER_END_DATE } from './offerUtils';

// Function to simulate different dates and test the logic
const testOfferLogic = () => {
  console.log('=== Knotie AI Pro Limited Offer Expiration Demo ===\n');
  
  console.log('📅 Offer Configuration:');
  console.log(`   End Date: ${OFFER_END_DATE}`);
  console.log(`   Formatted: ${getFormattedOfferEndDate()}\n`);
  
  console.log('⏰ Current Status:');
  console.log(`   Current Time: ${new Date().toISOString()}`);
  console.log(`   Is Expired: ${isOfferExpired()}`);
  
  const timeRemaining = getTimeRemaining();
  console.log(`   Time Remaining: ${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s\n`);
  
  // Test scenarios
  console.log('🧪 Test Scenarios:');
  
  // Scenario 1: Before expiration
  const beforeExpiration = new Date('2025-06-06T12:00:00');
  console.log(`\n1. Before Expiration (${beforeExpiration.toISOString()}):`);
  console.log(`   Would be expired: ${beforeExpiration.getTime() > new Date(OFFER_END_DATE).getTime()}`);
  
  // Scenario 2: At expiration
  const atExpiration = new Date(OFFER_END_DATE);
  console.log(`\n2. At Expiration (${atExpiration.toISOString()}):`);
  console.log(`   Would be expired: ${atExpiration.getTime() > new Date(OFFER_END_DATE).getTime()}`);
  
  // Scenario 3: After expiration
  const afterExpiration = new Date('2025-06-08T12:00:00');
  console.log(`\n3. After Expiration (${afterExpiration.toISOString()}):`);
  console.log(`   Would be expired: ${afterExpiration.getTime() > new Date(OFFER_END_DATE).getTime()}`);
  
  console.log('\n✅ Popup Behavior:');
  console.log('   - Before June 7, 2025 23:59:59: Popup will show (if not shown this session)');
  console.log('   - After June 7, 2025 23:59:59: Popup will NEVER show');
  console.log('   - Component will return null if expired');
  console.log('   - useEffect in KnotieDashboard will not trigger popup');
  
  console.log('\n🔒 Safety Features:');
  console.log('   - Double check in both KnotieDashboard and LimitedOfferPopup');
  console.log('   - Centralized date logic in offerUtils.ts');
  console.log('   - Session storage prevents multiple shows per session');
  console.log('   - Automatic expiration without manual intervention needed');
};

// Export for use in other files
export { testOfferLogic };

// Run demo if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  testOfferLogic();
}
