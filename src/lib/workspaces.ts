import fs from "fs";
import path from "path";

export interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

export function getOpenclawDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const dirsEnv = env.OPENCLAW_DIRS || env.OPENCLAW_DIR || "/root/.openclaw";
  return dirsEnv.split(",").map((dir) => dir.trim()).filter(Boolean);
}

function getWorkspaceId(openclawDir: string, workspaceDirName: string): string {
  return `${openclawDir}::${workspaceDirName}`;
}

function getAgentInfo(workspacePath: string): { name: string; emoji: string } | null {
  const identityPath = path.join(workspacePath, "IDENTITY.md");

  if (!fs.existsSync(identityPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(identityPath, "utf-8");
    const nameMatch = content.match(/- \*\*Name:\*\* (.+)/);
    const emojiMatch = content.match(/- \*\*Emoji:\*\* (.+)/);

    let emoji = "📁";
    if (emojiMatch) {
      emoji = emojiMatch[1].trim().split(" ")[0];
    }

    return {
      name: nameMatch ? nameMatch[1].trim() : "",
      emoji,
    };
  } catch {
    return null;
  }
}

export function listWorkspaces(env: NodeJS.ProcessEnv = process.env): Workspace[] {
  const workspaces: Workspace[] = [];

  for (const openclawDir of getOpenclawDirs(env)) {
    const mainWorkspace = path.join(openclawDir, "workspace");
    if (fs.existsSync(mainWorkspace)) {
      const mainInfo = getAgentInfo(mainWorkspace);
      workspaces.push({
        id: getWorkspaceId(openclawDir, "workspace"),
        name: "Workspace Principal",
        emoji: mainInfo?.emoji || "🦞",
        path: mainWorkspace,
        agentName: mainInfo?.name || "Tenacitas",
      });
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(openclawDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("workspace-")) {
        continue;
      }

      const workspacePath = path.join(openclawDir, entry.name);
      const agentInfo = getAgentInfo(workspacePath);
      const agentId = entry.name.replace("workspace-", "");
      const workspaceLabel = agentId.charAt(0).toUpperCase() + agentId.slice(1);

      workspaces.push({
        id: getWorkspaceId(openclawDir, entry.name),
        name: workspaceLabel,
        emoji: agentInfo?.emoji || "🤖",
        path: workspacePath,
        agentName: agentInfo?.name || undefined,
      });
    }
  }

  workspaces.sort((a, b) => {
    const aIsMain = path.basename(a.path) === "workspace";
    const bIsMain = path.basename(b.path) === "workspace";

    if (aIsMain !== bIsMain) {
      return aIsMain ? -1 : 1;
    }

    return a.name.localeCompare(b.name) || a.path.localeCompare(b.path);
  });

  return workspaces;
}

export function resolveWorkspacePath(workspaceId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (workspaceId === "mission-control") {
    const [firstDir] = getOpenclawDirs(env);
    return firstDir ? path.join(firstDir, "workspace", "mission-control") : null;
  }

  for (const openclawDir of getOpenclawDirs(env)) {
    const entries = ["workspace"];

    try {
      for (const entry of fs.readdirSync(openclawDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith("workspace-")) {
          entries.push(entry.name);
        }
      }
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (workspaceId === getWorkspaceId(openclawDir, entry)) {
        return path.join(openclawDir, entry);
      }
    }
  }

  for (const openclawDir of getOpenclawDirs(env)) {
    const legacyPath = path.join(openclawDir, workspaceId);
    if (fs.existsSync(legacyPath)) {
      return legacyPath;
    }
  }

  return null;
}
