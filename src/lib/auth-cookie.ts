import type { NextRequest } from "next/server";

function normalizeHostname(host: string | null): string {
  const firstHost = host?.split(",")[0]?.trim() ?? "";

  if (firstHost.startsWith("[")) {
    return firstHost.slice(1, firstHost.indexOf("]")).toLowerCase();
  }

  return firstHost.split(":")[0]?.toLowerCase() ?? "";
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  );
}

export function shouldUseSecureAuthCookie(request: NextRequest): boolean {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  const hostname = normalizeHostname(host);

  // Local Mission Control often runs as `next start` with NODE_ENV=production
  // on plain HTTP. Secure cookies never round-trip there, so localhost must be
  // allowed to use a non-secure auth cookie even in production-style mode.
  if (isLocalHostname(hostname)) {
    return false;
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");

  return protocol === "https" || process.env.NODE_ENV === "production";
}
