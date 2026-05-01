import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { shouldUseSecureAuthCookie } from "@/lib/auth-cookie";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  
  // Clear auth cookie
  response.cookies.set("mc_auth", "", {
    httpOnly: true,
    secure: shouldUseSecureAuthCookie(request),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  
  return response;
}
