import { handleActivityStatsGet } from '@/lib/activity-stats-route';

export async function GET() {
  return handleActivityStatsGet();
}
