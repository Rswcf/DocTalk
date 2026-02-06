import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const AUTH_SECRET = process.env.AUTH_SECRET;

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

/**
 * Create a backend-compatible JWT from the decoded Auth.js session token.
 * Auth.js v5 encrypts session tokens (JWE), so we need to create a plain JWT
 * that the backend can verify with the shared AUTH_SECRET.
 */
async function createBackendToken(userId: string): Promise<string> {
  if (!AUTH_SECRET) {
    throw new Error("AUTH_SECRET not configured");
  }
  const secret = new TextEncoder().encode(AUTH_SECRET);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600) // 1 hour
    .sign(secret);
}

async function handler(req: NextRequest) {
  // Get decoded token (not raw encrypted token)
  // Must pass secret explicitly for Auth.js v5
  const token = await getToken({ req, secret: AUTH_SECRET });

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

  // Add authorization if authenticated - create a backend-compatible JWT
  if (token?.sub) {
    try {
      const backendToken = await createBackendToken(token.sub);
      headers.set("Authorization", `Bearer ${backendToken}`);
    } catch (error) {
      console.error("Failed to create backend token:", error);
    }
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined,
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
