import { NextRequest } from 'next/server';
import { updateTask } from '@/lib/tasks';

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

/**
 * PATCH /api/tasks/:id
 * 
 * Update a specific task by ID. Accepts partial updates for:
 * - status: string (valid TaskColumn value)
 * - assignee: string | null
 * - name: string
 * 
 * Returns updated task record or 404 if not found.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    if (!id) {
      return json({ error: 'Task ID is required' }, { status: 400 });
    }

    const body = await request.json();
    
    // Build update payload with only provided fields
    const updatePayload: Record<string, unknown> = { id };
    if ('status' in body) {
      updatePayload.status = body.status;
    }
    if ('assignee' in body) {
      updatePayload.assignee = body.assignee;
    }
    if ('name' in body) {
      updatePayload.name = body.name;
    }

    const task = await updateTask(id, updatePayload);
    
    if (!task) {
      return json({ error: 'Task not found' }, { status: 404 });
    }

    return json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update task';
    const status = message.includes('Invalid task status') || message.includes('required') ? 400 : 500;
    return json({ error: message }, { status });
  }
}
