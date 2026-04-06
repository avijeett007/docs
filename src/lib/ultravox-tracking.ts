/**
 * Ultravox Agent Tracking Utilities
 * 
 * Since Ultravox webhook events don't include agent IDs, we embed a tracking
 * identifier in the system prompt to identify which agent the webhook belongs to.
 */

/**
 * Generate a tracking identifier for an Ultravox agent
 * This creates a non-intrusive identifier that won't affect the agent's behavior
 */
export function generateTrackingIdentifier(agentId: string): string {
  // Use a format that looks like a technical comment/instruction
  // This should be invisible to users and not affect the AI's responses
  return `\n\n[SYSTEM_TRACKING_ID:${agentId}:END_TRACKING]`;
}

/**
 * Add tracking identifier to a system prompt
 */
export function addTrackingToSystemPrompt(systemPrompt: string, agentId: string): string {
  // Remove any existing tracking identifier first
  const cleanPrompt = removeTrackingFromSystemPrompt(systemPrompt);
  
  // Add the new tracking identifier at the end
  const trackingId = generateTrackingIdentifier(agentId);
  return cleanPrompt + trackingId;
}

/**
 * Extract agent ID from a system prompt with tracking identifier
 */
export function extractAgentIdFromSystemPrompt(systemPrompt: string): string | null {
  if (!systemPrompt) return null;
  
  // Look for the tracking pattern
  const trackingPattern = /\[SYSTEM_TRACKING_ID:([a-f0-9-]+):END_TRACKING\]/;
  const match = systemPrompt.match(trackingPattern);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

/**
 * Remove tracking identifier from a system prompt
 * Useful for displaying clean prompts to users
 */
export function removeTrackingFromSystemPrompt(systemPrompt: string): string {
  if (!systemPrompt) return systemPrompt;
  
  // Remove the tracking identifier and any extra newlines
  const trackingPattern = /\n*\[SYSTEM_TRACKING_ID:[a-f0-9-]+:END_TRACKING\]\n*/g;
  return systemPrompt.replace(trackingPattern, '').trim();
}

/**
 * Check if a system prompt has a tracking identifier
 */
export function hasTrackingIdentifier(systemPrompt: string): boolean {
  return extractAgentIdFromSystemPrompt(systemPrompt) !== null;
}

/**
 * Validate that a tracking identifier matches the expected agent ID
 */
export function validateTrackingIdentifier(systemPrompt: string, expectedAgentId: string): boolean {
  const extractedId = extractAgentIdFromSystemPrompt(systemPrompt);
  return extractedId === expectedAgentId;
}
