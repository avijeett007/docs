import { NextRequest, NextResponse } from 'next/server';
import { migrationMonitor } from '@/lib/migration-monitoring';

export const dynamic = 'force-dynamic';

// Get migration monitoring data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        return await getHealthStatus();
      
      case 'metrics':
        return await getMetrics(request);
      
      case 'alerts':
        return await getAlerts(request);
      
      case 'report':
        return await getReport();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in migration monitoring API:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Resolve alerts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId } = body;

    if (action === 'resolve_alert' && alertId) {
      const resolved = migrationMonitor.resolveAlert(alertId);
      
      if (resolved) {
        return NextResponse.json({ success: true, message: 'Alert resolved' });
      } else {
        return NextResponse.json(
          { error: 'Alert not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action or missing parameters' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in migration monitoring POST:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

async function getHealthStatus() {
  const healthStatus = await migrationMonitor.getHealthStatus();
  
  return NextResponse.json({
    success: true,
    data: healthStatus,
    timestamp: new Date().toISOString()
  });
}

async function getMetrics(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const count = parseInt(searchParams.get('count') || '10');
  
  const metrics = migrationMonitor.getMetrics(count);
  
  return NextResponse.json({
    success: true,
    data: {
      metrics,
      count: metrics.length
    },
    timestamp: new Date().toISOString()
  });
}

async function getAlerts(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeResolved = searchParams.get('include_resolved') === 'true';
  
  const alerts = migrationMonitor.getAlerts(includeResolved);
  
  return NextResponse.json({
    success: true,
    data: {
      alerts,
      activeCount: alerts.filter(a => !a.resolved).length,
      totalCount: alerts.length
    },
    timestamp: new Date().toISOString()
  });
}

async function getReport() {
  const report = migrationMonitor.generateReport();
  
  return NextResponse.json({
    success: true,
    data: report,
    timestamp: new Date().toISOString()
  });
}
