import { getActivities, logActivity } from './activities-db';

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export async function handleActivitiesGet(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const agent = searchParams.get('agent') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sort = (searchParams.get('sort') || 'newest') as 'newest' | 'oldest';
    const format = searchParams.get('format') || 'json';
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const parsedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const maxLimit = format === 'csv' ? 10000 : 100;
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), maxLimit);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const result = getActivities({ type, status, agent, startDate, endDate, sort, limit, offset });

    if (format === 'csv') {
      const header = 'id,timestamp,type,description,status,duration_ms,tokens_used,agent\n';
      const rows = result.activities.map((activity) => [
        activity.id,
        activity.timestamp,
        activity.type,
        `"${(activity.description || '').replace(/"/g, '""')}"`,
        activity.status,
        activity.duration_ms ?? '',
        activity.tokens_used ?? '',
        activity.agent ?? '',
      ].join(',')).join('\n');

      return new Response(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="activities-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return json({
      activities: result.activities,
      total: result.total,
      limit,
      offset,
      hasMore: offset + limit < result.total,
    });
  } catch (error) {
    console.error('Failed to get activities:', error);
    return json({ error: 'Failed to get activities' }, { status: 500 });
  }
}

export async function handleActivitiesPost(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const agent = typeof body.agent === 'string' && body.agent.trim() ? body.agent.trim() : null;

    if (!body.type || !body.description || !body.status) {
      return json(
        { error: 'Missing required fields: type, description, status' },
        { status: 400 },
      );
    }

    const validStatuses = ['success', 'error', 'pending', 'running'];
    if (!validStatuses.includes(body.status)) {
      return json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    const activity = logActivity(body.type, body.description, body.status, {
      duration_ms: body.duration_ms ?? null,
      tokens_used: body.tokens_used ?? null,
      agent,
      metadata: body.metadata ?? null,
    });

    return json(activity, { status: 201 });
  } catch (error) {
    console.error('Failed to save activity:', error);
    return json({ error: 'Failed to save activity' }, { status: 500 });
  }
}
