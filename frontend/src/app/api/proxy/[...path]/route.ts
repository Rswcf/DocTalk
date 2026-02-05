import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// Whitelist of safe headers to forward to backend
const ALLOWED_REQUEST_HEADERS = new Set([
  "content-type",
  "accept",
  "accept-language",
  "accept-encoding",
  "user-agent",
  "cache-control",
  "if-none-match",
  "if-modified-since",
]);

// Headers to exclude from response (security-sensitive)
const EXCLUDED_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "transfer-encoding",
  "connection",
]);

async function handler(req: NextRequest) {
  const token = await getToken({ req, raw: true });

  const path = req.nextUrl.pathname.replace("/api/proxy", "");
  const url = `${BACKEND_URL}${path}${req.nextUrl.search}`;

  // Build headers with whitelist filtering
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (ALLOWED_REQUEST_HEADERS.has(lowerKey)) {
      headers.set(key, value);
    }
  });

  // Add authorization if authenticated
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    // Build response headers with exclusion filtering
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!EXCLUDED_RESPONSE_HEADERS.has(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy request failed:", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return new NextResponse("Gateway Timeout", { status: 504 });
    }
    return new NextResponse("Bad Gateway", { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };

