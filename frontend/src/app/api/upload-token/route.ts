import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const AUTH_SECRET = process.env.AUTH_SECRET;

/**
 * Returns a short-lived backend-compatible JWT for direct uploads.
 *
 * Uploads bypass the /api/proxy route to avoid Vercel's 4.5MB serverless
 * function body size limit.  The frontend calls this endpoint first to
 * obtain a lightweight JWT, then POSTs the file directly to the Railway
 * backend with that token in the Authorization header.
 */
export async function GET(req: NextRequest) {
  if (!AUTH_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const secureCookie = req.nextUrl.protocol === "https:";
  const session = await getToken({ req, secret: AUTH_SECRET, secureCookie });

  if (!session?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const secret = new TextEncoder().encode(AUTH_SECRET);
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ sub: session.sub })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 300) // 5 minutes — just enough for one upload
    .sign(secret);

  return NextResponse.json({ token });
}
