import { NextRequest, NextResponse } from 'next/server';

// This route uses dynamic features, so it must be server-rendered
export const dynamic = 'force-dynamic';

import { getAuth } from '@clerk/nextjs/server';
import { AgentData } from '@/types/agent';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentData: AgentData = await req.json();

    // Ensure metadata exists with required fields
    const metadata = {
      ...(agentData.metadata || {}),
      clerkUserId: userId,
      livekitRoomPrefix: `agent_${agentData.id}`,
      vectorDbCollection: `${userId}_${agentData.knowledgeBaseId || 'default'}`,
    };

    // Create or update agent in database
    const agent = await prisma.agent.upsert({
      where: {
        id: agentData.id
      },
      create: {
        id: agentData.id,
        userId,
        name: agentData.name,
        type: agentData.type,
        voice: agentData.voice,
        warmupMessage: agentData.warmupMessage,
        status: agentData.status,
        businessName: agentData.businessName,
        purpose: agentData.purpose,
        knowledgeBase: agentData.knowledgeBase,
        knowledgeBaseId: agentData.knowledgeBaseId,
        systemPrompt: agentData.systemPrompt,
        aiToSpeakFirst: agentData.aiToSpeakFirst,
        enableBackchanneling: agentData.enableBackchanneling,
        speechNormalization: agentData.speechNormalization,
        sendEmailsToUsers: agentData.sendEmailsToUsers,
        channels: agentData.channels as Record<string, any>,
        webhookUrl: agentData.webhookUrl || '',
        settings: agentData.settings as Record<string, any>,
        metadata,
        lastModified: new Date(agentData.lastModified)
      },
      update: {
        name: agentData.name,
        type: agentData.type,
        voice: agentData.voice,
        warmupMessage: agentData.warmupMessage,
        status: agentData.status,
        businessName: agentData.businessName,
        purpose: agentData.purpose,
        knowledgeBase: agentData.knowledgeBase,
        knowledgeBaseId: agentData.knowledgeBaseId,
        systemPrompt: agentData.systemPrompt,
        aiToSpeakFirst: agentData.aiToSpeakFirst,
        enableBackchanneling: agentData.enableBackchanneling,
        speechNormalization: agentData.speechNormalization,
        sendEmailsToUsers: agentData.sendEmailsToUsers,
        channels: agentData.channels as Record<string, any>,
        webhookUrl: agentData.webhookUrl || '',
        settings: agentData.settings as Record<string, any>,
        metadata,
        lastModified: new Date(agentData.lastModified)
      }
    });

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error creating/updating agent:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agents = await prisma.agent.findMany({
      where: {
        userId
      }
    });

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('id');

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Verify agent belongs to user
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId,
        userId
      }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    await prisma.agent.delete({
      where: {
        id: agentId
      }
    });

    return NextResponse.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
