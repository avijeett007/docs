import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { verifyPartnerJWT } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';
import axios from 'axios';



// Helper function to extract all possible assistant names from text
const extractAssistantNames = (text: string): string[] => {
  const names: string[] = [];

  // Look for common patterns that might indicate an assistant name
  const patterns = [
    /My name is ([A-Z][a-z]+)/g,
    /I am ([A-Z][a-z]+)/g,
    /I'm ([A-Z][a-z]+)/g,
    /This is ([A-Z][a-z]+)/g,
    /call me ([A-Z][a-z]+)/g,
    /name's ([A-Z][a-z]+)/g,
    /name is ([A-Z][a-z]+)/g,
    /introduce yourself as ([A-Z][a-z]+)/gi,
    /introduce yourself as an? [a-z]+ from [A-Z][a-zA-Z\s&]+ named ([A-Z][a-z]+)/gi,
    /([A-Z][a-z]+) from [A-Z][a-zA-Z\s&]+/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].length > 2) {
        // Only add names that are not common words
        const name = match[1];
        if (!['The', 'And', 'For', 'With', 'From', 'Your', 'Our', 'Their'].includes(name)) {
          names.push(name);
        }
      }
    }
  }

  return [...new Set(names)]; // Remove duplicates
};

// Helper function to check if a column exists in a table
async function hasColumn(table: string, column: string): Promise<boolean> {
  try {
    // Query the information_schema to check if the column exists
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = ${table}
        AND column_name = ${column}
      ) as exists
    `;

    // @ts-ignore - result is an array with one object that has an 'exists' property
    return result[0].exists;
  } catch (error) {
    console.error(`Error checking if column ${column} exists in table ${table}:`, error);
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify the partner JWT
    const decoded = await verifyPartnerJWT(req);
    if (!decoded || !decoded.payload || !decoded.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = decoded.payload.partnerId;

    // Get the partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Check if partner has Retell API key
    if (!partner.retellApiKey) {
      return NextResponse.json({ error: 'Retell API key is required' }, { status: 400 });
    }

    const demoId = params.id;

    // Get the demo system
    const demoSystem = await prisma.demoSystem.findUnique({
      where: {
        id: demoId,
        isActive: true,
      },
    });

    if (!demoSystem) {
      return NextResponse.json({ error: 'Demo not found' }, { status: 404 });
    }

    // We'll use type assertions to handle the new fields until Prisma client is regenerated

    // Get partner demo customization with all fields
    // Using type assertion to handle new fields until Prisma client is regenerated
    let partnerDemo = await prisma.partnerDemo.findUnique({
      where: {
        partnerId_demoSystemId: {
          partnerId: partnerId,
          demoSystemId: demoId,
        },
      },
      select: {
        id: true,
        partnerId: true,
        demoSystemId: true,
        deployedAgentId: true,
        status: true,
        customBusinessName: true,
        customBusinessAddress: true,
        customCharacterName: true,
        customAgentName: true,
        customVoiceId: true,
        customPrompt: true,
        lastDeployedAt: true,
        lastTestedAt: true,
        deployCount: true,
        testCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // If no customization exists, create with default values
    if (!partnerDemo) {
      const newPartnerDemo = await prisma.partnerDemo.create({
        data: {
          partnerId: partnerId,
          demoSystemId: demoId,
          customBusinessName: demoSystem.businessNamePlaceholder,
          // Use any for now until Prisma client is regenerated
          // @ts-ignore
          customBusinessAddress: "123 Main St, New York, NY 10001",
          customCharacterName: demoSystem.isOutbound ? demoSystem.characterNamePlaceholder : null,
          // @ts-ignore
          customAgentName: `${demoSystem.name} for ${demoSystem.businessNamePlaceholder}`,
          // @ts-ignore
          customVoiceId: "11labs-Dorothy",
          status: 'PENDING',
        },
      });

      // Create a new object with the extended fields
      partnerDemo = {
        ...newPartnerDemo,
        // Add the new fields manually
        customBusinessAddress: "123 Main St, New York, NY 10001",
        customAgentName: `${demoSystem.name} for ${demoSystem.businessNamePlaceholder}`,
        customVoiceId: "11labs-Dorothy",
      } as any; // Type assertion to handle new fields
    }

    // Apply customizations to the prompt
    let customPrompt = demoSystem.generalPrompt;

    console.log('[deploy/route] Original prompt:', customPrompt.substring(0, 100) + '...');
    console.log('[deploy/route] Business name placeholder:', demoSystem.businessNamePlaceholder);
    console.log('[deploy/route] Custom business name:', partnerDemo?.customBusinessName);
    console.log('[deploy/route] Is outbound:', demoSystem.isOutbound);
    console.log('[deploy/route] Character name placeholder:', demoSystem.characterNamePlaceholder);
    console.log('[deploy/route] Custom character name:', partnerDemo?.customCharacterName);

    // Check if the new columns exist - we'll reuse these variables later
    const hasCustomAgentName = await hasColumn('partner_demos', 'custom_agent_name');
    const hasCustomVoiceId = await hasColumn('partner_demos', 'custom_voice_id');

    // Ensure partnerDemo is not null before using it
    if (partnerDemo) {
      // Replace business name placeholder - use string replacement instead of RegExp for exact matches
      if (demoSystem.businessNamePlaceholder && partnerDemo.customBusinessName) {
        console.log('[deploy/route] Replacing business name placeholder:', demoSystem.businessNamePlaceholder);
        console.log('[deploy/route] With custom business name:', partnerDemo.customBusinessName);

        // Use a global string replacement approach with proper escaping
        const escapedPlaceholder = demoSystem.businessNamePlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const businessNameRegex = new RegExp(escapedPlaceholder, 'g');
        customPrompt = customPrompt.replace(businessNameRegex, partnerDemo.customBusinessName);

        // Also try to replace any variations of the business name that might be in the prompt
        // This handles cases where the business name is mentioned without the full placeholder
        const simplifiedBusinessName = demoSystem.businessNamePlaceholder.split(' ')[0]; // Get first word
        if (simplifiedBusinessName && simplifiedBusinessName.length > 2) {
          const escapedSimpleName = simplifiedBusinessName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const simpleNameRegex = new RegExp(`\\b${escapedSimpleName}\\b`, 'g');
          customPrompt = customPrompt.replace(simpleNameRegex, partnerDemo.customBusinessName.split(' ')[0]);
        }

        // Handle common phrases that might include the business name
        const businessPhrases = [
          /at [A-Z][a-zA-Z\s&]+ who/g,
          /from [A-Z][a-zA-Z\s&]+ who/g,
          /for [A-Z][a-zA-Z\s&]+ who/g,
          /at [A-Z][a-zA-Z\s&]+\./g,
          /from [A-Z][a-zA-Z\s&]+\./g,
          /for [A-Z][a-zA-Z\s&]+\./g,
          /at [A-Z][a-zA-Z\s&]+ located/g,
          /from [A-Z][a-zA-Z\s&]+ located/g,
          /for [A-Z][a-zA-Z\s&]+ located/g,
          /assistant (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /agent (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /coordinator (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /representative (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /specialist (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /concierge (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /receptionist (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /support (at|from|for) [A-Z][a-zA-Z\s&]+/g,
          /service (at|from|for) [A-Z][a-zA-Z\s&]+/g,
        ];

        for (const pattern of businessPhrases) {
          customPrompt = customPrompt.replace(pattern, (match) => {
            // Replace the business name part while preserving the prefix and suffix
            const parts = match.split(' ');
            if (parts.length >= 3) {
              // Find where the business name starts (after at/from/for)
              const prefixEndIndex = match.indexOf(' ') + 1;
              // Find where the business name ends (before who/located/etc or at the end)
              let suffixStartIndex = match.length;
              const suffixWords = [' who', ' located', '.'];
              for (const suffix of suffixWords) {
                const index = match.indexOf(suffix);
                if (index !== -1 && index < suffixStartIndex) {
                  suffixStartIndex = index;
                }
              }

              // Reconstruct the string with the custom business name
              return match.substring(0, prefixEndIndex) +
                     partnerDemo.customBusinessName +
                     match.substring(suffixStartIndex);
            }
            return match;
          });
        }

        // Also look for specific intro phrases in state prompts
        const introPatterns = [
          /introduce yourself as (an assistant|a concierge|a receptionist|a coordinator|an agent|a representative|a specialist|a support agent) from [A-Z][a-zA-Z\s&]+/g,
          /introduce yourself as (an assistant|a concierge|a receptionist|a coordinator|an agent|a representative|a specialist|a support agent) at [A-Z][a-zA-Z\s&]+/g,
        ];

        for (const pattern of introPatterns) {
          customPrompt = customPrompt.replace(pattern, (match) => {
            // Find where the business name starts
            const lastFromIndex = match.lastIndexOf('from ');
            const lastAtIndex = match.lastIndexOf('at ');
            const prefixEndIndex = Math.max(lastFromIndex, lastAtIndex);

            if (prefixEndIndex !== -1) {
              // Reconstruct with the custom business name
              return match.substring(0, prefixEndIndex + 5) + partnerDemo.customBusinessName;
            }
            return match;
          });
        }
      }

      // Check if the custom_business_address column exists
      const hasCustomBusinessAddress = await hasColumn('partner_demos', 'custom_business_address');

      // Replace business address if present in the prompt and the column exists
      if (hasCustomBusinessAddress && 'customBusinessAddress' in partnerDemo && partnerDemo.customBusinessAddress) {
        console.log('[deploy/route] Replacing business address with:', partnerDemo.customBusinessAddress);

        // Look for common address patterns in the prompt
        const addressPatterns = [
          /located in Abu Dhabi, UAE \(Khalidiya district, Al Nahyan street, Building 12\)/g,
          /located at [^\)\n\.,;]+/g,
          /located in [^\)\n\.,;]+/g,
          /address: [^\)\n\.,;]+/gi,
          /address is [^\)\n\.,;]+/gi,
          /location: [^\)\n\.,;]+/gi,
          /location at [^\)\n\.,;]+/gi,
          /based in [^\)\n\.,;]+/gi,
          /office at [^\)\n\.,;]+/gi,
          /office in [^\)\n\.,;]+/gi
        ];

        for (const pattern of addressPatterns) {
          customPrompt = customPrompt.replace(pattern, `located at ${partnerDemo.customBusinessAddress}`);
        }
      }

      // Replace assistant name patterns in the prompt
      console.log('[deploy/route] Replacing assistant name patterns');

      // Use the extractAssistantNames function defined at the top of the file

      // Extract potential assistant names from the prompt
      const potentialNames = extractAssistantNames(customPrompt);
      console.log('[deploy/route] Potential assistant names found in prompt:', potentialNames);

      // Common patterns for assistant name references
      const assistantNamePatterns = [
        /My name is ([A-Z][a-z]+)/g,
        /I am ([A-Z][a-z]+)/g,
        /I'm ([A-Z][a-z]+)/g,
        /This is ([A-Z][a-z]+)/g,
        /call me ([A-Z][a-z]+)/g,
        /name's ([A-Z][a-z]+)/g,
        /name is ([A-Z][a-z]+)/g,
      ];

      // Generate an assistant name based on the demo type and voice
      const voiceId = hasCustomVoiceId && partnerDemo?.customVoiceId
        ? partnerDemo.customVoiceId
        : "11labs-Dorothy";

      // Extract a name from the voice ID or use a default
      let assistantName = "Dorothy";
      if (voiceId.includes("-")) {
        const namePart = voiceId.split("-")[1];
        if (namePart && namePart.length > 0) {
          // Capitalize first letter
          assistantName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        }
      }

      console.log(`[deploy/route] Using assistant name "${assistantName}" based on voice ID "${voiceId}"`);

      // Replace all assistant name patterns
      if (potentialNames.length > 0) {
        console.log('[deploy/route] Found assistant names to replace:', potentialNames);

        // Replace each potential name with the assistant name
        for (const name of potentialNames) {
          // Create a regex that matches the name with word boundaries
          const nameRegex = new RegExp(`\\b${name}\\b`, 'g');
          customPrompt = customPrompt.replace(nameRegex, assistantName);
          console.log(`[deploy/route] Replaced "${name}" with "${assistantName}"`);
        }
      }

      // Also use the pattern-based approach as a fallback
      for (const pattern of assistantNamePatterns) {
        customPrompt = customPrompt.replace(pattern, (match: string, name: string) => {
          // Skip if we've already handled this name
          if (potentialNames.includes(name)) {
            return match;
          }
          // Keep the prefix (like "My name is" or "I am") and replace the name
          const prefix = match.substring(0, match.lastIndexOf(name));
          return prefix + assistantName;
        });
      }

      // Add an explicit statement about the assistant's name to the general prompt
      // First check if the prompt already contains a name statement
      if (!customPrompt.includes(`My name is ${assistantName}`) &&
          !customPrompt.includes(`I am ${assistantName}`) &&
          !customPrompt.includes(`I'm ${assistantName}`)) {

        console.log('[deploy/route] Adding explicit name statement to general prompt');

        // Find a good place to insert the name statement
        if (customPrompt.includes('You are a')) {
          // Insert after the first sentence that describes the role
          const roleEndIndex = customPrompt.indexOf('. ', customPrompt.indexOf('You are a')) + 2;
          if (roleEndIndex > 2) {
            customPrompt =
              customPrompt.substring(0, roleEndIndex) +
              `Your name is ${assistantName}. ` +
              customPrompt.substring(roleEndIndex);
          } else {
            // If we can't find a good insertion point, append to the beginning
            customPrompt = `Your name is ${assistantName}. ` + customPrompt;
          }
        } else {
          // If we can't find "You are a", just append to the beginning
          customPrompt = `Your name is ${assistantName}. ` + customPrompt;
        }
      }

      // Replace character name placeholder if outbound
      if (demoSystem.isOutbound && partnerDemo.customCharacterName) {
        console.log('[deploy/route] Replacing character name in outbound demo');

        // First try with the specific placeholder if available
        if (demoSystem.characterNamePlaceholder) {
          console.log('[deploy/route] Using character name placeholder:', demoSystem.characterNamePlaceholder);
          const escapedCharPlaceholder = demoSystem.characterNamePlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const charNameRegex = new RegExp(escapedCharPlaceholder, 'g');
          customPrompt = customPrompt.replace(charNameRegex, partnerDemo.customCharacterName);
        }

        // Also try with default placeholder 'Michael' which is common in many demos
        if (customPrompt.includes('Michael')) {
          console.log('[deploy/route] Also replacing default name "Michael"');
          customPrompt = customPrompt.replace(/\bMichael\b/g, partnerDemo.customCharacterName);
        }

        // Look for other common name patterns in outbound demos
        const namePatterns = [
          /calling (to speak with|to talk to|for) ([A-Z][a-z]+)/g,
          /calling ([A-Z][a-z]+) (about|for|to)/g,
          /speaking with ([A-Z][a-z]+)/g,
          /call to ([A-Z][a-z]+)/g
        ];

        for (const pattern of namePatterns) {
          customPrompt = customPrompt.replace(pattern, (match: string, p1: string, p2: string) => {
            // If the pattern has two capture groups (like "calling to speak with John")
            if (p2) {
              return `${p1} ${partnerDemo.customCharacterName}`;
            }
            // If the pattern has one capture group (like "calling John about")
            return match.replace(p1, partnerDemo.customCharacterName || '');
          });
        }
      }
    }

    // Update states with customized values
    const customStates = JSON.parse(JSON.stringify(demoSystem.statesConfig));

    // Only customize states if partnerDemo exists
    if (partnerDemo) {
      // Check if the custom_business_address column exists (reuse the result from above)
      const hasCustomBusinessAddress = await hasColumn('partner_demos', 'custom_business_address');

      // Generate an assistant name based on the voice ID (same as for general prompt)
      const voiceId = hasCustomVoiceId && partnerDemo?.customVoiceId
        ? partnerDemo.customVoiceId
        : "11labs-Dorothy";

      // Extract a name from the voice ID or use a default
      let assistantName = "Dorothy";
      if (voiceId.includes("-")) {
        const namePart = voiceId.split("-")[1];
        if (namePart && namePart.length > 0) {
          // Capitalize first letter
          assistantName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        }
      }

      for (const state of customStates) {
        if (state.state_prompt) {
          // Replace business name placeholder with the same approach as for the general prompt
          if (demoSystem.businessNamePlaceholder && partnerDemo.customBusinessName) {
            // Use a global string replacement approach with proper escaping
            const escapedPlaceholder = demoSystem.businessNamePlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const businessNameRegex = new RegExp(escapedPlaceholder, 'g');
            state.state_prompt = state.state_prompt.replace(businessNameRegex, partnerDemo.customBusinessName);

            // Also try to replace any variations of the business name that might be in the prompt
            const simplifiedBusinessName = demoSystem.businessNamePlaceholder.split(' ')[0]; // Get first word
            if (simplifiedBusinessName && simplifiedBusinessName.length > 2) {
              const escapedSimpleName = simplifiedBusinessName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const simpleNameRegex = new RegExp(`\\b${escapedSimpleName}\\b`, 'g');
              state.state_prompt = state.state_prompt.replace(simpleNameRegex, partnerDemo.customBusinessName.split(' ')[0]);
            }

            // Handle common phrases that might include the business name
            const businessPhrases = [
              /at [A-Z][a-zA-Z\s&]+ who/g,
              /from [A-Z][a-zA-Z\s&]+ who/g,
              /for [A-Z][a-zA-Z\s&]+ who/g,
              /at [A-Z][a-zA-Z\s&]+\./g,
              /from [A-Z][a-zA-Z\s&]+\./g,
              /for [A-Z][a-zA-Z\s&]+\./g,
              /at [A-Z][a-zA-Z\s&]+ located/g,
              /from [A-Z][a-zA-Z\s&]+ located/g,
              /for [A-Z][a-zA-Z\s&]+ located/g,
              /assistant (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /agent (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /coordinator (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /representative (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /specialist (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /concierge (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /receptionist (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /support (at|from|for) [A-Z][a-zA-Z\s&]+/g,
              /service (at|from|for) [A-Z][a-zA-Z\s&]+/g,
            ];

            for (const pattern of businessPhrases) {
              state.state_prompt = state.state_prompt.replace(pattern, (match: string) => {
                // Replace the business name part while preserving the prefix and suffix
                const parts = match.split(' ');
                if (parts.length >= 3) {
                  // Find where the business name starts (after at/from/for)
                  const prefixEndIndex = match.indexOf(' ') + 1;
                  // Find where the business name ends (before who/located/etc or at the end)
                  let suffixStartIndex = match.length;
                  const suffixWords = [' who', ' located', '.'];
                  for (const suffix of suffixWords) {
                    const index = match.indexOf(suffix);
                    if (index !== -1 && index < suffixStartIndex) {
                      suffixStartIndex = index;
                    }
                  }

                  // Reconstruct the string with the custom business name
                  return match.substring(0, prefixEndIndex) +
                         partnerDemo.customBusinessName +
                         match.substring(suffixStartIndex);
                }
                return match;
              });
            }

            // Also look for specific intro phrases in state prompts
            const introPatterns = [
              /introduce yourself as (an assistant|a concierge|a receptionist|a coordinator|an agent|a representative|a specialist|a support agent) from [A-Z][a-zA-Z\s&]+/g,
              /introduce yourself as (an assistant|a concierge|a receptionist|a coordinator|an agent|a representative|a specialist|a support agent) at [A-Z][a-zA-Z\s&]+/g,
              /Greet the caller .* (from|at) [A-Z][a-zA-Z\s&]+/g,
            ];

            for (const pattern of introPatterns) {
              state.state_prompt = state.state_prompt.replace(pattern, (match: string) => {
                // Find where the business name starts
                const lastFromIndex = match.lastIndexOf('from ');
                const lastAtIndex = match.lastIndexOf('at ');
                const prefixEndIndex = Math.max(lastFromIndex, lastAtIndex);

                if (prefixEndIndex !== -1) {
                  // Reconstruct with the custom business name
                  return match.substring(0, prefixEndIndex + 5) + partnerDemo.customBusinessName;
                }
                return match;
              });
            }

            // Special handling for "Thank them for [action] with [Business]" patterns
            const thankPatterns = [
              /Thank them for (shopping|staying|choosing|considering|contacting|calling|visiting) with [A-Z][a-zA-Z\s&]+/g,
              /Thank them for (shopping|staying|choosing|considering|contacting|calling|visiting) at [A-Z][a-zA-Z\s&]+/g,
            ];

            for (const pattern of thankPatterns) {
              state.state_prompt = state.state_prompt.replace(pattern, (match: string) => {
                // Find where the business name starts
                const withIndex = match.lastIndexOf('with ');
                const atIndex = match.lastIndexOf('at ');
                const prefixEndIndex = Math.max(withIndex, atIndex);

                if (prefixEndIndex !== -1) {
                  // Reconstruct with the custom business name
                  return match.substring(0, prefixEndIndex + 5) + partnerDemo.customBusinessName;
                }
                return match;
              });
            }
          }

          // Replace business address if present in the prompt and the column exists
          if (hasCustomBusinessAddress && 'customBusinessAddress' in partnerDemo && partnerDemo.customBusinessAddress) {
            // Look for common address patterns in the prompt
            const addressPatterns = [
              /located in Abu Dhabi, UAE \(Khalidiya district, Al Nahyan street, Building 12\)/g,
              /located at [^\)\n\.,;]+/g,
              /located in [^\)\n\.,;]+/g,
              /address: [^\)\n\.,;]+/gi,
              /address is [^\)\n\.,;]+/gi,
              /location: [^\)\n\.,;]+/gi,
              /location at [^\)\n\.,;]+/gi,
              /based in [^\)\n\.,;]+/gi,
              /office at [^\)\n\.,;]+/gi,
              /office in [^\)\n\.,;]+/gi
            ];

            for (const pattern of addressPatterns) {
              state.state_prompt = state.state_prompt.replace(pattern, `located at ${partnerDemo.customBusinessAddress}`);
            }
          }

          // Replace assistant name patterns in the state prompt
          // Extract potential assistant names from the state prompt
          const statePromptNames = extractAssistantNames(state.state_prompt);

          // Generate an assistant name based on the demo type and voice (reuse from earlier)
          const voiceId = hasCustomVoiceId && partnerDemo?.customVoiceId
            ? partnerDemo.customVoiceId
            : "11labs-Dorothy";

          // Extract a name from the voice ID or use a default
          let assistantName = "Dorothy";
          if (voiceId.includes("-")) {
            const namePart = voiceId.split("-")[1];
            if (namePart && namePart.length > 0) {
              // Capitalize first letter
              assistantName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
            }
          }

          // Replace all extracted names in the state prompt
          if (statePromptNames.length > 0) {
            // Replace each potential name with the assistant name
            for (const name of statePromptNames) {
              // Create a regex that matches the name with word boundaries
              const nameRegex = new RegExp(`\\b${name}\\b`, 'g');
              state.state_prompt = state.state_prompt.replace(nameRegex, assistantName);
            }
          }

          // Also use the pattern-based approach as a fallback
          const assistantNamePatterns = [
            /My name is ([A-Z][a-z]+)/g,
            /I am ([A-Z][a-z]+)/g,
            /I'm ([A-Z][a-z]+)/g,
            /This is ([A-Z][a-z]+)/g,
            /call me ([A-Z][a-z]+)/g,
            /name's ([A-Z][a-z]+)/g,
            /name is ([A-Z][a-z]+)/g,
          ];

          for (const pattern of assistantNamePatterns) {
            state.state_prompt = state.state_prompt.replace(pattern, (match: string, name: string) => {
              // Skip if we've already handled this name
              if (statePromptNames.includes(name)) {
                return match;
              }
              // Keep the prefix (like "My name is" or "I am") and replace the name
              const prefix = match.substring(0, match.lastIndexOf(name));
              return prefix + assistantName;
            });
          }

          // Also look for "introduce yourself as [Name]" patterns
          const introducePatterns = [
            /introduce yourself as ([A-Z][a-z]+)/gi,
            /Greet the caller and introduce yourself as ([A-Z][a-z]+)/gi,
            /Greet the caller .* introduce yourself as ([A-Z][a-z]+)/gi,
          ];

          for (const pattern of introducePatterns) {
            state.state_prompt = state.state_prompt.replace(pattern, (match: string, name: string) => {
              // Skip if we've already handled this name
              if (statePromptNames.includes(name)) {
                return match;
              }
              // Keep the prefix and replace the name
              const prefix = match.substring(0, match.lastIndexOf(name));
              return prefix + assistantName;
            });
          }

          // For the greeting state, explicitly add the assistant's name if not already present
          if (state.name === 'greeting') {
            console.log('[deploy/route] Checking greeting state for explicit name mention');

            // Check if the greeting state already mentions the assistant's name
            if (!state.state_prompt.includes(`My name is ${assistantName}`) &&
                !state.state_prompt.includes(`I am ${assistantName}`) &&
                !state.state_prompt.includes(`I'm ${assistantName}`)) {

              console.log('[deploy/route] Adding explicit name to greeting state');

              // Look for common greeting patterns to modify
              if (state.state_prompt.includes('introduce yourself as')) {
                // Replace "introduce yourself as a [role]" with "introduce yourself as [Name], a [role]"
                state.state_prompt = state.state_prompt.replace(
                  /(introduce yourself as) (an?|the) ([a-z\s]+)/gi,
                  `$1 ${assistantName}, $2 $3`
                );
              } else if (state.state_prompt.includes('Greet the caller')) {
                // Add name to the greeting instruction
                state.state_prompt = state.state_prompt.replace(
                  /(Greet the caller.*?and )(?:introduce yourself|say your name is|tell them your name is|identify yourself)/gi,
                  `$1introduce yourself as ${assistantName}`
                );

                // If no match was found, append to the end of the first sentence
                if (!state.state_prompt.includes(`as ${assistantName}`)) {
                  const firstSentenceEnd = state.state_prompt.indexOf('. ') + 2;
                  if (firstSentenceEnd > 2) {
                    state.state_prompt =
                      state.state_prompt.substring(0, firstSentenceEnd) +
                      `Tell them your name is ${assistantName}. ` +
                      state.state_prompt.substring(firstSentenceEnd);
                  }
                }
              } else {
                // If no specific pattern is found, add to the beginning
                state.state_prompt = `Introduce yourself as ${assistantName}. ` + state.state_prompt;
              }
            }
          }

          // Replace character name placeholder if outbound
          if (demoSystem.isOutbound && partnerDemo.customCharacterName) {
            // First try with the specific placeholder if available
            if (demoSystem.characterNamePlaceholder) {
              const escapedCharPlaceholder = demoSystem.characterNamePlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const charNameRegex = new RegExp(escapedCharPlaceholder, 'g');
              state.state_prompt = state.state_prompt.replace(charNameRegex, partnerDemo.customCharacterName);
            }

            // Also try with default placeholder 'Michael' which is common in many demos
            if (state.state_prompt.includes('Michael')) {
              state.state_prompt = state.state_prompt.replace(/\bMichael\b/g, partnerDemo.customCharacterName);
            }

            // Look for other common name patterns in outbound demos
            const namePatterns = [
              /calling (to speak with|to talk to|for) ([A-Z][a-z]+)/g,
              /calling ([A-Z][a-z]+) (about|for|to)/g,
              /speaking with ([A-Z][a-z]+)/g,
              /call to ([A-Z][a-z]+)/g
            ];

            for (const pattern of namePatterns) {
              state.state_prompt = state.state_prompt.replace(pattern, (match: string, p1: string, p2: string) => {
                // If the pattern has two capture groups (like "calling to speak with John")
                if (p2) {
                  return `${p1} ${partnerDemo.customCharacterName}`;
                }
                // If the pattern has one capture group (like "calling John about")
                return match.replace(p1, partnerDemo.customCharacterName || '');
              });
            }
          }
        }
      }

      // Save the customized prompt
      await prisma.partnerDemo.update({
        where: { id: partnerDemo.id },
        data: { customPrompt },
      });
    }

    // Decrypt the Retell API key
    const decryptedApiKey = await decrypt(partner.retellApiKey);
    console.log('[deploy/route] Successfully decrypted Retell API key - length:', decryptedApiKey.length);

    // Create Retell LLM Response Engine
    console.log('[deploy/route] Creating Retell LLM Response Engine...');

    // Check if states array is empty
    const hasStates = Array.isArray(customStates) && customStates.length > 0;

    console.log('[deploy/route] Request payload:', {
      model: demoSystem.llmModel,
      model_temperature: demoSystem.llmTemperature,
      states: hasStates
        ? `Array with ${customStates.length} states`
        : 'Empty states array or not an array',
      starting_state: demoSystem.startingState,
      will_include_starting_state: hasStates,
    });

    let llmResponse;
    try {
      // hasStates is already defined above

      // Only include starting_state if states array is not empty
      const requestPayload = {
        model: demoSystem.llmModel,
        model_temperature: demoSystem.llmTemperature,
        general_prompt: customPrompt,
        states: customStates,
        general_tools: demoSystem.generalTools,
      };

      // Only add starting_state if states array is not empty
      if (hasStates) {
        console.log('[deploy/route] States array has content, including starting_state');
        // @ts-ignore - Add starting_state to the payload
        requestPayload.starting_state = demoSystem.startingState;
      } else {
        console.log('[deploy/route] States array is empty, omitting starting_state to avoid Retell API error');
      }

      console.log('[deploy/route] Final request payload:', {
        ...requestPayload,
        states: hasStates ? 'States array present' : 'Empty states array',
      });

      llmResponse = await axios.post(
        'https://api.retellai.com/create-retell-llm',
        requestPayload,
        {
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('[deploy/route] LLM Response:', llmResponse.data);
    } catch (error: any) {
      console.error('[deploy/route] Error creating LLM:', error.response?.data || error.message);
      throw new Error(`Failed to create Retell LLM: ${error.response?.data?.message || error.message}`);
    }

    const llmId = llmResponse.data.llm_id;
    if (!llmId) {
      console.error('[deploy/route] No LLM ID returned:', llmResponse.data);
      throw new Error('No LLM ID returned from Retell API');
    }

    // Create Retell Agent
    console.log('[deploy/route] Creating Retell Agent with LLM ID:', llmId);

    // We already checked for these columns earlier, but let's log them again
    console.log('[deploy/route] Has custom agent name column:', hasCustomAgentName);
    console.log('[deploy/route] Has custom voice ID column:', hasCustomVoiceId);

    // Always use 'multi' for language code since all agents are multilingual
    console.log(`[deploy/route] Original language code "${demoSystem.language}" - using "multi" for all agents`);

    // Format the agent name based on demo type (inbound vs outbound)
    let agentName = '';
    if (hasCustomAgentName && partnerDemo?.customAgentName) {
      // Use custom agent name if provided
      agentName = `${partnerDemo.customAgentName} - DO NOT DELETE`;
    } else {
      // For outbound demos, format as "[Demo Name] calling [Character Name]"
      if (demoSystem.isOutbound && partnerDemo?.customCharacterName) {
        agentName = `${demoSystem.name} calling ${partnerDemo.customCharacterName} - DO NOT DELETE`;
      } else {
        // For inbound demos, format as "[Demo Name] for [Business Name]"
        agentName = `${demoSystem.name} for ${partnerDemo?.customBusinessName || demoSystem.businessNamePlaceholder} - DO NOT DELETE`;
      }
    }

    console.log(`[deploy/route] Using agent name: "${agentName}"`);

    // Format the agent payload exactly as shown in the documentation
    const agentPayload = {
      response_engine: {
        type: "retell-llm",
        llm_id: llmId,
      },
      agent_name: agentName,
      voice_id: hasCustomVoiceId && partnerDemo?.customVoiceId
        ? partnerDemo.customVoiceId
        : "11labs-Dorothy", // Use the selected voice ID or default
      voice_speed: demoSystem.voiceSpeed,
      language: 'multi', // Always use 'multi' for all agents
      interruption_sensitivity: demoSystem.interruptionSensitivity,
      enable_backchannel: demoSystem.enableBackchannel,
      normalize_for_speech: demoSystem.normalizeForSpeech,
      boosted_keywords: demoSystem.boostedKeywords,
    };

    // Log the full API key length to check if it's being truncated
    console.log('[deploy/route] API key length:', decryptedApiKey.length);

    console.log('[deploy/route] Agent payload:', agentPayload);

    let agentResponse;
    try {
      // Use the original endpoint format
      agentResponse = await axios.post(
        'https://api.retellai.com/create-agent',
        agentPayload,
        {
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('[deploy/route] Agent Response:', agentResponse.data);
    } catch (error: any) {
      console.error('[deploy/route] Error creating Agent:', error.response?.data || error.message);
      console.error('[deploy/route] Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        config: error.config,
        url: error.config?.url,
        method: error.config?.method,
      });
      throw new Error(`Failed to create Retell Agent: ${error.response?.data?.message || error.message}`);
    }

    const agentId = agentResponse.data.agent_id;
    if (!agentId) {
      console.error('[deploy/route] No Agent ID returned:', agentResponse.data);
      throw new Error('No Agent ID returned from Retell API');
    }

    // Update partner demo with deployed agent ID
    // Make sure partnerDemo exists
    if (!partnerDemo) {
      throw new Error('Partner demo not found');
    }

    const updatedPartnerDemo = await prisma.partnerDemo.update({
      where: { id: partnerDemo.id },
      data: {
        deployedAgentId: agentId,
        status: 'DEPLOYED',
        lastDeployedAt: new Date(),
        deployCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      deployment: {
        id: updatedPartnerDemo.id,
        status: updatedPartnerDemo.status,
        deployedAgentId: updatedPartnerDemo.deployedAgentId,
        lastDeployedAt: updatedPartnerDemo.lastDeployedAt,
      }
    });
  } catch (error: any) {
    console.error('Error deploying demo:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      } : 'No response',
      request: error.request ? 'Request present' : 'No request',
      config: error.config ? {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        data: error.config.data,
      } : 'No config',
    });

    // Handle Retell API errors
    if (error.response && error.response.data) {
      return NextResponse.json({
        error: 'Failed to deploy demo',
        details: error.response.data
      }, { status: error.response.status || 500 });
    }

    return NextResponse.json({ error: 'Failed to deploy demo' }, { status: 500 });
  }
}
