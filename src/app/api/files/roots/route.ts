import { NextResponse } from "next/server";
import { listWorkspaces, listVaults, listSystemRoots } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      workspaces: listWorkspaces(),
      vaults: listVaults(),
      system: listSystemRoots(),
    });
  } catch (error) {
    console.error("Failed to list roots:", error);
    return NextResponse.json({ workspaces: [], vaults: [], system: [] }, { status: 500 });
  }
}
