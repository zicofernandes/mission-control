import { NextRequest } from 'next/server';
import {
  handleProjectsDelete,
  handleProjectsGet,
  handleProjectsPost,
  handleProjectsPut,
} from '@/lib/projects-route';

export async function GET(request: NextRequest) {
  return handleProjectsGet(request);
}

export async function POST(request: NextRequest) {
  return handleProjectsPost(request);
}

export async function PUT(request: NextRequest) {
  return handleProjectsPut(request);
}

export async function DELETE(request: NextRequest) {
  return handleProjectsDelete(request);
}
