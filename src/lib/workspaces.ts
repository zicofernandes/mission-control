import fs from "fs";
import path from "path";
import os from "os";

export interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
  kind: "workspace" | "vault" | "system";
}

export function getOpenclawDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const dirsEnv = env.OPENCLAW_DIRS || env.OPENCLAW_DIR || "/root/.openclaw";
  return dirsEnv.split(",").map((dir) => dir.trim()).filter(Boolean);
}

function getWorkspaceId(openclawDir: string, workspaceDirName: string): string {
  return `${openclawDir}::${workspaceDirName}`;
}

function getAgentInfo(workspacePath: string): { name: string; emoji: string; role: string } | null {
  const identityPath = path.join(workspacePath, "IDENTITY.md");

  if (!fs.existsSync(identityPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(identityPath, "utf-8");
    const nameMatch = content.match(/- \*\*Name:\*\*\s*(.+)/);
    const emojiMatch = content.match(/- \*\*Emoji:\*\*\s*(.+)/);
    const roleMatch = content.match(/- \*\*Role:\*\*\s*(.+)/);

    let emoji = "📁";
    if (emojiMatch) {
      emoji = emojiMatch[1].trim().split(" ")[0];
    }

    return {
      name: nameMatch ? nameMatch[1].trim() : "",
      emoji,
      role: roleMatch ? roleMatch[1].trim() : "",
    };
  } catch {
    return null;
  }
}

export function listWorkspaces(env: NodeJS.ProcessEnv = process.env): Workspace[] {
  const workspaces: Workspace[] = [];

  // Iterate in OPENCLAW_DIRS order — first dir's agents rank highest
  for (const openclawDir of getOpenclawDirs(env)) {
    const mainWorkspace = path.join(openclawDir, "workspace");
    if (fs.existsSync(mainWorkspace)) {
      const mainInfo = getAgentInfo(mainWorkspace);
      const agentName = mainInfo?.name || path.basename(openclawDir).replace(/^\.openclaw-?/, "") || "Agent";
      workspaces.push({
        id: getWorkspaceId(openclawDir, "workspace"),
        name: agentName || "Main Workspace",
        emoji: mainInfo?.emoji || "🤖",
        path: mainWorkspace,
        agentName: agentName,
        kind: "workspace",
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
      const agentName = agentInfo?.name || agentId.charAt(0).toUpperCase() + agentId.slice(1);

      workspaces.push({
        id: getWorkspaceId(openclawDir, entry.name),
        name: agentName,
        emoji: agentInfo?.emoji || "🤖",
        path: workspacePath,
        agentName: agentInfo?.name || undefined,
        kind: "workspace",
      });
    }
  }

  return workspaces;
}

export function listVaults(env: NodeJS.ProcessEnv = process.env): Workspace[] {
  const vaults: Workspace[] = [];
  const vaultPath = env.VAULT_PATH || path.join(os.homedir(), "zico-vault");
  if (fs.existsSync(vaultPath)) {
    vaults.push({
      id: `vault::${vaultPath}`,
      name: "zico-vault",
      emoji: "📚",
      path: vaultPath,
      kind: "vault",
    });
  }
  return vaults;
}

export function listSystemRoots(env: NodeJS.ProcessEnv = process.env): Workspace[] {
  const roots: Workspace[] = [];
  for (const openclawDir of getOpenclawDirs(env)) {
    if (!fs.existsSync(openclawDir)) continue;
    // Get agent name from workspace/IDENTITY.md for the label
    const workspacePath = path.join(openclawDir, "workspace");
    const info = fs.existsSync(workspacePath) ? getAgentInfo(workspacePath) : null;
    const label = info?.name || path.basename(openclawDir).replace(/^\.openclaw-?/, "") || "System";
    roots.push({
      id: `system::${openclawDir}`,
      name: label,
      emoji: info?.emoji || "⚙️",
      path: openclawDir,
      agentName: info?.name,
      kind: "system",
    });
  }
  return roots;
}

export function resolveWorkspacePath(workspaceId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  // Vault roots: vault::/absolute/path
  if (workspaceId.startsWith("vault::")) {
    const p = workspaceId.slice("vault::".length);
    return fs.existsSync(p) ? p : null;
  }

  // System roots: system::/absolute/path
  if (workspaceId.startsWith("system::")) {
    const p = workspaceId.slice("system::".length);
    return fs.existsSync(p) ? p : null;
  }

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
