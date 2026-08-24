import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const targetBackend = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ot-enterprise-edition.onrender.com';
  const healthUrl = `${targetBackend.replace(/\/$/, '')}/api/health`;

  try {
    const startTime = Date.now();
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'RepoTrace-Vercel-Cron/1.0',
        'Cache-Control': 'no-cache'
      },
      next: { revalidate: 0 }
    });

    const elapsed = Date.now() - startTime;
    const ok = response.ok;
    const status = response.status;

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    return NextResponse.json({
      success: ok,
      status,
      latency_ms: elapsed,
      target: healthUrl,
      timestamp: new Date().toISOString(),
      backend_response: data
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to ping backend',
        target: healthUrl,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
