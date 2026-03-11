import { NextResponse } from "next/server";
import { getAgentStatusFromGateway } from "@/lib/office-gateway";
import { listOfficeAgents } from "@/lib/office-route";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gatewayStatus = await getAgentStatusFromGateway();
    return NextResponse.json({ agents: listOfficeAgents(process.env, gatewayStatus) });
  } catch (error) {
    console.error("Error getting office data:", error);
    return NextResponse.json(
      { error: "Failed to load office data" },
      { status: 500 }
    );
  }
}
