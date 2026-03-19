// Client-safe constants only — no fs/promises imports
export const PROJECT_CATEGORIES = ['internal', 'client', 'product', 'content', 'research'] as const;
export const PROJECT_STATUSES = ['active', 'blocked', 'paused', 'completed', 'archived'] as const;
export type ProjectCategory = typeof PROJECT_CATEGORIES[number];
export type ProjectStatus = typeof PROJECT_STATUSES[number];
