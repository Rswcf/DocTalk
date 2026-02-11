import { NextRequest } from "next/server";
import { handlers } from "../../../../lib/auth";

// TODO: remove debug wrapper after email magic link debugging
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  console.log("[AUTH ROUTE] GET", url.pathname, url.searchParams.toString());
  const response = await handlers.GET(req);
  const location = response.headers.get("Location");
  console.log("[AUTH ROUTE] GET response", response.status, location ? `→ ${location}` : "");
  return response;
}

export const { POST } = handlers;
