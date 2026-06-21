import { NextRequest, NextResponse } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const PROBE_QUERY_PARAMS = ["q", "id", "search", "query"] as const;

function buildCsp(isProd: boolean): string {
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const parts = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com https://api.paymongo.com",
    "frame-src 'self' https://pm.link https://*.paymongo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (isProd) {
    parts.push("object-src 'none'", "upgrade-insecure-requests");
  }

  return parts.join("; ");
}

function applySecurityHeaders(response: NextResponse, pathname: string) {
  const isProd = process.env.NODE_ENV === "production";

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", buildCsp(isProd));

  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  if (pathname.startsWith("/console")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  response.headers.delete("X-Powered-By");
  return response;
}

function stripProbeQueryParams(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/") return null;

  const hasProbeParam = PROBE_QUERY_PARAMS.some((key) =>
    request.nextUrl.searchParams.has(key)
  );
  if (!hasProbeParam) return null;

  const url = request.nextUrl.clone();
  for (const key of PROBE_QUERY_PARAMS) {
    url.searchParams.delete(key);
  }

  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const stripped = stripProbeQueryParams(request);
  if (stripped) {
    return applySecurityHeaders(stripped, request.nextUrl.pathname);
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response, request.nextUrl.pathname);
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
