import { NextResponse } from "next/server";

import { listWorkspaces } from "@/lib/workspaces";

export async function GET() {
  try {
    const workspaces = listWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("Failed to list workspaces:", error);
    return NextResponse.json({ workspaces: [] }, { status: 500 });
  }
}
