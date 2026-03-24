import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { listWorkspaces } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}\.md$/;

export interface DailyMemoryEntry {
  date: string; // YYYY-MM-DD
  agent: string; // agent name e.g. "Elon", "Athena"
  agentEmoji: string;
  workspaceId: string;
  filePath: string; // relative path: memory/YYYY-MM-DD.md
  sizeBytes: number;
  preview: string; // first non-empty line after frontmatter
}

async function getPreview(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed !== "---") {
        return trimmed.slice(0, 120);
      }
    }
    // Fallback: first heading
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) return trimmed.replace(/^#+\s*/, "").slice(0, 120);
    }
    return "";
  } catch {
    return "";
  }
}

// GET /api/memory/daily?agent=all|athena|elon
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentFilter = (searchParams.get("agent") || "all").toLowerCase();

  try {
    const workspaces = listWorkspaces();
    const entries: DailyMemoryEntry[] = [];

    for (const workspace of workspaces) {
      // Filter by agent if specified
      if (agentFilter !== "all") {
        const agentName = (workspace.agentName || workspace.name || "").toLowerCase();
        if (!agentName.includes(agentFilter)) continue;
      }

      const memoryDir = path.join(workspace.path, "memory");
      try {
        const stat = await fs.stat(memoryDir);
        if (!stat.isDirectory()) continue;
      } catch {
        continue; // memory dir doesn't exist for this workspace
      }

      let files: string[];
      try {
        files = await fs.readdir(memoryDir);
      } catch {
        continue;
      }

      for (const file of files) {
        if (!DATE_PATTERN.test(file)) continue;

        const date = file.replace(".md", "");
        const fullPath = path.join(memoryDir, file);

        let sizeBytes = 0;
        try {
          const stat = await fs.stat(fullPath);
          sizeBytes = stat.size;
        } catch {
          continue;
        }

        const preview = await getPreview(fullPath);

        entries.push({
          date,
          agent: workspace.agentName || workspace.name || "Unknown",
          agentEmoji: workspace.emoji || "🤖",
          workspaceId: workspace.id,
          filePath: `memory/${file}`,
          sizeBytes,
          preview,
        });
      }
    }

    // Sort: newest date first, then by agent name for same date
    entries.sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return a.agent.localeCompare(b.agent);
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error loading daily memories:", error);
    return NextResponse.json({ error: "Failed to load memories" }, { status: 500 });
  }
}
