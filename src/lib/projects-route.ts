import { PROJECT_CATEGORIES, PROJECT_STATUSES, ProjectCategory, ProjectStatus, createProject, deleteProject, getProject, listProjects, updateProject } from './projects';

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function notFoundResponse() {
  return json({ error: 'Project not found' }, { status: 404 });
}

export async function handleProjectsGet(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const project = await getProject(id);
      return project ? json(project) : notFoundResponse();
    }

    const categoryParam = searchParams.get('category');
    const statusParam = searchParams.get('status');
    const category = categoryParam && PROJECT_CATEGORIES.includes(categoryParam as ProjectCategory)
      ? (categoryParam as ProjectCategory) : undefined;
    const status = statusParam && PROJECT_STATUSES.includes(statusParam as ProjectStatus)
      ? (statusParam as ProjectStatus) : undefined;

    const projects = await listProjects(category || status ? { category, status } : undefined);
    return json(projects);
  } catch (error) {
    console.error('Failed to list projects:', error);
    return json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function handleProjectsPost(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const project = await createProject(body);
    return json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project';
    const status = message.includes('required') ? 400 : 500;
    return json({ error: message }, { status });
  }
}

export async function handleProjectsPut(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';

    if (!id) {
      return json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = await updateProject(id, body);
    if (!project) {
      return notFoundResponse();
    }

    return json(project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update project';
    const status = message.includes('required') ? 400 : 500;
    return json({ error: message }, { status });
  }
}

export async function handleProjectsDelete(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return json({ error: 'Project ID is required' }, { status: 400 });
    }

    const deleted = await deleteProject(id);
    if (!deleted) {
      return notFoundResponse();
    }

    return json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
