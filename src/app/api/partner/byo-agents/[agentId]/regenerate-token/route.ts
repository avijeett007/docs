import { NextRequest, NextResponse } from 'next/server';
import { verifyPartnerAuth } from '@/lib/auth/partnerAuth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// POST - Regenerate API token for a BYO agent
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const partner = await verifyPartnerAuth(request);
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the existing agent
    const existingAgent = await prisma.byoAgent.findFirst({
      where: {
        id: params.agentId,
        partnerId: partner.id
      }
    });

    if (!existingAgent) {
      return NextResponse.json(
        { error: 'BYO agent not found' },
        { status: 404 }
      );
    }

    if (existingAgent.status === 'revoked') {
      return NextResponse.json(
        { error: 'Cannot regenerate token for a revoked agent' },
        { status: 400 }
      );
    }

    // Store old token hash for revocation
    const oldTokenSha256 = existingAgent.tokenSha256;

    // Generate new API token: byo_ prefix + 48-char random hex
    const rawToken = `byo_${crypto.randomBytes(24).toString('hex')}`;
    const apiTokenHash = await bcrypt.hash(rawToken, 10);
    // SHA-256 hash for fast ConnectHub lookups (bcrypt is too slow for per-request validation)
    const tokenSha256 = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Update the agent with new token hash
    const updatedAgent = await prisma.byoAgent.update({
      where: { id: params.agentId },
      data: {
        apiTokenHash,
        tokenSha256,
        lastTokenRotation: new Date(),
        tokenJti: null, // Clear any existing JWT ID
        tokenExpiresAt: null, // Clear expiration
      }
    });

    // Revoke old token in ConnectHub Redis (non-blocking, best-effort)
    if (oldTokenSha256) {
      const connectHubUrl = process.env.CONNECT_HUB_URL;
      const connectHubApiKey = process.env.CONNECT_HUB_API_KEY;
      if (connectHubUrl && connectHubApiKey) {
        fetch(`${connectHubUrl}/byo-admin/revoke-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${connectHubApiKey}`,
          },
          body: JSON.stringify({
            tokenSha256: oldTokenSha256,
            agentId: params.agentId,
            reason: 'token_rotation',
          }),
        }).catch((err) => {
          console.warn(`[BYO-AGENTS] Failed to revoke old token in ConnectHub: ${err.message}`);
        });
      }
    }

    console.log(`[BYO-AGENTS] Token regenerated for agent ${params.agentId}`);

    // Build framework-specific quick start code with new token
    const quickStartCode = existingAgent.framework === 'livekit'
      ? `from knotie_connect import KnotieConnect
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli

knotie = KnotieConnect(token="${rawToken}")

class MyAgent(Agent):
    def __init__(self):
        tools = knotie.get_livekit_tools()
        super().__init__(
            instructions="Your agent instructions here",
            tools=tools,
        )

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    session = AgentSession()
    await session.start(agent=MyAgent(), room=ctx.room)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))`
      : `from knotie_connect import KnotieConnect
from pipecat.pipeline.pipeline import Pipeline

knotie = KnotieConnect(token="${rawToken}")
tools = knotie.get_pipecat_tools()

# Register tools with your Pipecat LLM service
for tool in tools:
    llm.register_function(tool["name"], tool["handler"])`;

    return NextResponse.json({
      success: true,
      message: 'API token regenerated successfully. The old token is now invalid.',
      api_token: rawToken, // Shown ONLY on regeneration
      last_token_rotation: updatedAgent.lastTokenRotation,
      integration: {
        pip_install: 'pip install knotie-connect',
        quick_start_code: quickStartCode,
        docs_url: 'https://docs.knotie-ai.pro/byo-agent',
      }
    });

  } catch (error) {
    console.error('Error regenerating BYO agent token:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate token' },
      { status: 500 }
    );
  }
}

