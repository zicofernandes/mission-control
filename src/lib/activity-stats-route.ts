import { getActivityTimelineStats } from './activities-db';

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export async function handleActivityStatsGet(): Promise<Response> {
  try {
    return json(getActivityTimelineStats());
  } catch (error) {
    console.error('[activities/stats] Error:', error);
    return json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
