import {
  TASK_COLUMNS,
  archiveTask,
  assignTask,
  createTask,
  deleteTask,
  listTasks,
  moveTask,
  updateTask,
} from './tasks';

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function notFoundResponse() {
  return json({ error: 'Task not found' }, { status: 404 });
}

export async function handleTasksGet(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const tasks = await listTasks({ includeArchived });
    return json(tasks);
  } catch (error) {
    console.error('Failed to list tasks:', error);
    return json({ error: 'Failed to list tasks' }, { status: 500 });
  }
}

export async function handleTasksPost(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const task = await createTask(body);
    return json(task, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create task';
    const status = message.includes('required') ? 400 : 500;
    return json({ error: message }, { status });
  }
}

export async function handleTasksPut(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';

    if (!id) {
      return json({ error: 'Task ID is required' }, { status: 400 });
    }

    const task = await updateTask(id, body);
    if (!task) {
      return notFoundResponse();
    }

    return json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update task';
    const status = message.includes('Invalid task status') || message.includes('required') ? 400 : 500;
    return json({ error: message }, { status });
  }
}

export async function handleTasksPatch(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : '';

    if (!id) {
      return json({ error: 'Task ID is required' }, { status: 400 });
    }

    if (action === 'move') {
      const task = await moveTask(id, {
        status: body.status,
        position: body.position,
      });
      if (!task) {
        return notFoundResponse();
      }
      return json(task);
    }

    if (action === 'assign') {
      const task = await assignTask(id, body.assignee ?? null);
      if (!task) {
        return notFoundResponse();
      }
      return json(task);
    }

    if (action === 'archive') {
      const task = await archiveTask(id, body.archived !== false);
      if (!task) {
        return notFoundResponse();
      }
      return json(task);
    }

    return json(
      {
        error: `Unknown action. Valid actions: move, assign, archive. Valid statuses: ${TASK_COLUMNS.join(', ')}`,
      },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update task';
    const status = message.includes('Invalid task status') ? 400 : 500;
    return json({ error: message }, { status });
  }
}

export async function handleTasksDelete(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return json({ error: 'Task ID is required' }, { status: 400 });
    }

    const deleted = await deleteTask(id);
    if (!deleted) {
      return notFoundResponse();
    }

    return json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
