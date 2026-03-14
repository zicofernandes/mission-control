import { NextRequest } from 'next/server';
import { handleActivitiesGet, handleActivitiesPost } from '@/lib/activities-route';

export async function GET(request: NextRequest) {
  return handleActivitiesGet(request);
}

export async function POST(request: Request) {
  return handleActivitiesPost(request);
}
