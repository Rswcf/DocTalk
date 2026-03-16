import { NextResponse } from "next/server";
import sitemap from "@/app/sitemap";

const INDEXNOW_KEY = "38e9d0db4a654c64b237039b2ac0af5d";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const HOST = "www.doctalk.site";

/**
 * POST /api/indexnow — submit all public URLs to IndexNow (Bing, Yandex, etc.)
 *
 * Protected by AUTH_SECRET (same secret used by Auth.js) via Authorization header.
 * The IndexNow key itself is public (served at /38e9d0db4a654c64b237039b2ac0af5d.txt),
 * so it MUST NOT be used for endpoint authentication.
 *
 * Usage:
 *   curl -X POST https://www.doctalk.site/api/indexnow \
 *     -H "Authorization: Bearer $AUTH_SECRET"
 */
function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

async function submitUrls() {
  const entries = sitemap();
  const urlList = entries.map((entry) =>
    typeof entry.url === "string" ? entry.url : String(entry.url)
  );

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList,
  };

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  return {
    status: res.status,
    statusText: res.statusText,
    submitted: urlList.length,
    urls: urlList,
  };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await submitUrls();
  return NextResponse.json(result);
}
