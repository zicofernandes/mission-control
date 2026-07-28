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

function isPrivateHttpHostname(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));

  if (
    parts.length === 4 &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    const [a, b] = parts;

    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }

  return hostname.endsWith(".ts.net");
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

  if (protocol === "http" && isPrivateHttpHostname(hostname)) {
    return false;
  }

  return protocol === "https" || process.env.NODE_ENV === "production";
}
