import { createHmac } from "node:crypto";
import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

// C2: prefer BACKEND_INTERNAL_URL (Railway private network) over the public
// NEXT_PUBLIC_API_BASE so server-side proxy hops stay on the internal mesh.
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";
const AUTH_SECRET = process.env.AUTH_SECRET;
// C1: ADAPTER_SECRET is the per-deployment shared secret used to HMAC-sign
// the X-Proxy-IP claim sent to the backend. Distinct from AUTH_SECRET (which
// Auth.js v5 uses to encrypt session JWEs) — separation of concerns.
const ADAPTER_SECRET = process.env.ADAPTER_SECRET;

// Whitelist of safe headers to forward to backend
const ALLOWED_REQUEST_HEADERS = new Set([
  "content-type",
  "accept",
  "accept-language",
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
  // Node fetch may transparently decode upstream responses. Forwarding stale
  // encoding/length metadata can make browsers reject an otherwise 200 body.
  "content-encoding",
  "content-length",
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
  // secureCookie must be true on HTTPS (Vercel) — otherwise getToken looks for
  // "authjs.session-token" instead of "__Secure-authjs.session-token"
  const secureCookie = req.nextUrl.protocol === "https:";
  const token = await getToken({ req, secret: AUTH_SECRET, secureCookie });

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

  // Forward the real client IP so backend rate limiting and demo message
  // tracking work correctly (Railway sees Vercel's IP otherwise).
  // On Vercel, both req.ip (Edge) and x-real-ip / x-forwarded-for (Node Serverless)
  // are injected by Vercel itself and strip client-supplied values — they are
  // trustworthy. req.ip is commonly undefined on Node runtime; x-forwarded-for
  // is the authoritative source there.
  const xff = req.headers.get("x-forwarded-for");
  const clientIp =
    req.ip ||
    (xff ? xff.split(",")[0]?.trim() : undefined) ||
    req.headers.get("x-real-ip") ||
    undefined;
  if (clientIp && ADAPTER_SECRET) {
    // C1: triple-header HMAC contract. The signature binds the IP to a
    // per-request unix timestamp so an attacker who scrapes one header set
    // from a log cannot replay it indefinitely. Backend accepts ±60s skew.
    // Signing key is ADAPTER_SECRET (NOT AUTH_SECRET — the latter encrypts
    // session JWEs and must never traverse the wire as a plaintext header).
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac("sha256", ADAPTER_SECRET)
      .update(`${clientIp}:${ts}`)
      .digest("hex");
    headers.set("X-Proxy-IP", clientIp);
    headers.set("X-Proxy-IP-Ts", ts);
    headers.set("X-Proxy-IP-Sig", sig);
  }

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
    // SSE chat endpoints need a longer timeout for streaming responses
    const isChat = /\/sessions\/[^/]+\/chat(\/continue)?$/.test(path);
    const timeout = isChat ? 60000 : 30000;

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(timeout),
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

// Vercel Hobby max is 60s; needed for SSE chat streaming
export const maxDuration = 60;

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
