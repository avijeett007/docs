import { NextRequest, NextResponse } from 'next/server';

const UPTIME_BASE_URL = 'https://uptime.knotie.ai';
const STATUS_PAGE_SLUG = 'knotie-ai-pro';

interface UptimeMonitor {
  id: number;
  name: string;
  type: string;
  active: boolean;
}

interface UptimeGroup {
  id: number;
  name: string;
  weight: number;
  monitorList: UptimeMonitor[];
}

interface UptimeStatusResponse {
  config: {
    slug: string;
    title: string;
    description: string;
    published: boolean;
    theme: string;
  };
  incident: any;
  publicGroupList: UptimeGroup[];
  maintenanceList: any[];
}

interface UptimeHeartbeatResponse {
  heartbeatList: Record<string, any[]>;
  uptimeList: Record<string, number>;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch status page data
    const statusResponse = await fetch(`${UPTIME_BASE_URL}/api/status-page/${STATUS_PAGE_SLUG}`, {
      headers: {
        'User-Agent': 'Knotie-AI-Pro/1.0',
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!statusResponse.ok) {
      throw new Error(`Status API returned ${statusResponse.status}`);
    }

    const statusData: UptimeStatusResponse = await statusResponse.json();

    // Fetch heartbeat data
    const heartbeatResponse = await fetch(`${UPTIME_BASE_URL}/api/status-page/heartbeat/${STATUS_PAGE_SLUG}`, {
      headers: {
        'User-Agent': 'Knotie-AI-Pro/1.0',
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!heartbeatResponse.ok) {
      throw new Error(`Heartbeat API returned ${heartbeatResponse.status}`);
    }

    const heartbeatData: UptimeHeartbeatResponse = await heartbeatResponse.json();

    // Process and combine the data
    const processedData = {
      title: statusData.config.title,
      description: statusData.config.description,
      lastUpdated: new Date().toISOString(),
      incident: statusData.incident,
      maintenance: statusData.maintenanceList,
      groups: statusData.publicGroupList.map(group => ({
        id: group.id,
        name: group.name,
        monitors: group.monitorList.map(monitor => {
          const heartbeats = heartbeatData.heartbeatList[monitor.id.toString()] || [];
          const latestHeartbeat = heartbeats[heartbeats.length - 1];
          const uptimeKey = `${monitor.id}_24`;
          const uptime = heartbeatData.uptimeList[uptimeKey] || 0;

          return {
            id: monitor.id,
            name: monitor.name,
            type: monitor.type,
            status: latestHeartbeat?.status || 0, // 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE
            uptime: Math.round(uptime * 100 * 100) / 100, // Convert to percentage with 2 decimals
            responseTime: latestHeartbeat?.ping || null,
            lastCheck: latestHeartbeat?.time || null,
            message: latestHeartbeat?.msg || 'No data',
          };
        }),
      })),
    };

    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Error fetching uptime status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch status data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
