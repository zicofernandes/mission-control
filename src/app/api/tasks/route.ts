import { NextRequest } from 'next/server';
import {
  handleTasksDelete,
  handleTasksGet,
  handleTasksPatch,
  handleTasksPost,
  handleTasksPut,
} from '@/lib/tasks-route';

export async function GET(request: NextRequest) {
  return handleTasksGet(request);
}

export async function POST(request: NextRequest) {
  return handleTasksPost(request);
}

export async function PUT(request: NextRequest) {
  return handleTasksPut(request);
}

export async function PATCH(request: NextRequest) {
  return handleTasksPatch(request);
}

export async function DELETE(request: NextRequest) {
  return handleTasksDelete(request);
}
