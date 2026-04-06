import { NextRequest, NextResponse } from 'next/server';

// Static OpenAI voices data as provided in the documentation
const OPENAI_VOICES = [
  {
    "id": "6621530a-e8dd-4dac-91d7-102084470475",
    "provider": "openai",
    "providerId": "marin",
    "slug": "marin",
    "name": "Marin",
    "language": "English",
    "languageCode": "en",
    "gender": "neutral",
    "createdAt": "2025-08-28T18:40:10.754Z",
    "updatedAt": "2025-08-28T18:40:10.754Z",
    "isPublic": true,
    "isDeleted": false,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "f4e690b9-c660-4b48-b011-5badf83955f9",
    "provider": "openai",
    "providerId": "cedar",
    "slug": "cedar",
    "name": "Cedar",
    "language": "English",
    "languageCode": "en",
    "gender": "neutral",
    "createdAt": "2025-08-28T18:40:10.754Z",
    "updatedAt": "2025-08-28T18:40:10.754Z",
    "isPublic": true,
    "isDeleted": false,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "fad33df4-53ea-4e0a-87bd-3bd7581c5138",
    "provider": "openai",
    "providerId": "fable",
    "slug": "fable",
    "name": "fable",
    "createdAt": "2024-03-23T16:49:49.276Z",
    "updatedAt": "2024-03-23T16:49:49.276Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "43a6a67d-c081-4c9c-aa18-9ced18f8850d",
    "provider": "openai",
    "providerId": "verse",
    "slug": "verse",
    "name": "verse",
    "createdAt": "2024-11-17T03:27:35.331Z",
    "updatedAt": "2024-11-17T03:27:35.331Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "bc8b7178-374a-4169-8bc8-3547cf8f0224",
    "provider": "openai",
    "providerId": "sage",
    "slug": "sage",
    "name": "sage",
    "createdAt": "2024-11-17T03:24:19.360Z",
    "updatedAt": "2024-11-17T03:24:19.360Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "567daf5a-7546-403b-bc0d-c3132df95e8a",
    "provider": "openai",
    "providerId": "onyx",
    "slug": "onyx",
    "name": "onyx",
    "createdAt": "2024-03-23T16:49:49.276Z",
    "updatedAt": "2024-03-23T16:49:49.276Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "700c4a1c-f492-48d8-bd6a-55bc74cdda72",
    "provider": "openai",
    "providerId": "ballad",
    "slug": "ballad",
    "name": "ballad",
    "createdAt": "2024-11-17T03:23:47.629Z",
    "updatedAt": "2024-11-17T03:23:47.629Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "a4576f6a-11a2-4ca9-ac16-dd9bcae1e5b0",
    "provider": "openai",
    "providerId": "shimmer",
    "slug": "shimmer",
    "name": "shimmer",
    "createdAt": "2024-03-23T16:49:49.276Z",
    "updatedAt": "2024-03-23T16:49:49.276Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "bfca36e7-bcf7-41b0-b14b-08d2d6e8a17a",
    "provider": "openai",
    "providerId": "coral",
    "slug": "coral",
    "name": "coral",
    "createdAt": "2024-11-17T03:24:59.388Z",
    "updatedAt": "2024-11-17T03:24:59.388Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "0fac652e-9128-4960-95b8-97fde8a1b9e1",
    "provider": "openai",
    "providerId": "ash",
    "slug": "ash",
    "name": "ash",
    "createdAt": "2024-11-17T03:22:19.474Z",
    "updatedAt": "2024-11-17T03:22:19.474Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "4a93e8fb-9c58-4c5a-a491-fb572376a2c3",
    "provider": "openai",
    "providerId": "nova",
    "slug": "nova",
    "name": "nova",
    "createdAt": "2024-03-23T16:49:49.276Z",
    "updatedAt": "2024-03-23T16:49:49.276Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "829512df-00fe-4756-87c2-33e942a7ab38",
    "provider": "openai",
    "providerId": "echo",
    "slug": "echo",
    "name": "echo",
    "createdAt": "2024-03-23T16:49:49.276Z",
    "updatedAt": "2024-03-23T16:49:49.276Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  },
  {
    "id": "75f484b9-9a18-432b-948b-1c128abb387b",
    "provider": "openai",
    "providerId": "alloy",
    "slug": "alloy",
    "name": "alloy",
    "createdAt": "2024-03-23T16:49:49.276Z",
    "updatedAt": "2024-03-23T16:49:49.276Z",
    "isPublic": true,
    "isDeleted": true,
    "orgId": "aa4c36ba-db21-4ce0-9c6e-bb55a8d2b188"
  }
];

export async function GET(_request: NextRequest) {
  try {
    // Show all voices regardless of isDeleted status (data might be outdated)
    const voices = OPENAI_VOICES
      .map(voice => ({
        id: voice.id,
        name: voice.name,
        provider: 'openai',
        providerId: voice.providerId,
        slug: voice.slug,
        language: voice.language || 'English',
        languageCode: voice.languageCode || 'en',
        gender: voice.gender || 'neutral',
        status: voice.isDeleted ? 'deprecated' : 'active',
      }));

    return NextResponse.json({
      success: true,
      data: voices,
    });
  } catch (error) {
    console.error('Error fetching OpenAI voices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
