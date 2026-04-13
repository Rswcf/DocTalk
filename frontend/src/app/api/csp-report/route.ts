import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/csp-report — receive CSP violation reports from the browser.
 *
 * Accepts both legacy `application/csp-report` (CSP Level 2) and newer
 * `application/reports+json` (Reporting API / CSP Level 3) payloads.
 *
 * Protections:
 * - Payload size capped at 10KB (reports are normally ~1KB; anything larger
 *   is hostile)
 * - Basic in-memory per-IP rate limit (30/min) to prevent log-amplification
 *   attacks via spoofed reports
 * - Sentry dedup via fingerprint on (violated-directive, blocked-uri) so the
 *   same violation fired thousands of times still counts as one event
 *
 * The endpoint is intentionally unauthenticated (the browser cannot attach
 * credentials to report requests).
 */

export const runtime = "nodejs";

const MAX_PAYLOAD_BYTES = 10 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

// Tiny in-memory rate limiter keyed by client IP.
//
// LIMITATIONS (intentional, documented):
// - Per-invocation state: serverless cold-starts reset the counter. A
//   determined attacker gets RATE_LIMIT_MAX * concurrency free requests.
// - Per-edge-region state: Vercel distributes traffic across regions; a
//   single IP can get RATE_LIMIT_MAX per region.
// These are acceptable for a defense-in-depth counter whose goal is to cap
// log-amplification via Sentry, not to stop authentication abuse. For that
// scenario Sentry fingerprint dedup is the real defense. Redis-backed
// limiting is the upgrade path if this ever matters.
const MAX_MAP_SIZE = 10_000;
const ipHits = new Map<string, { count: number; windowStart: number }>();

function clientIp(request: Request): string {
  // Vercel edge sets x-real-ip from its verified source (not forgeable by
  // the browser). Fall back to x-forwarded-for leftmost entry when absent
  // (e.g. local dev). Do NOT trust the raw client in either case — this IP
  // is only used as a rate-limit bucket, not for authorization.
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

function pruneExpired(now: number): void {
  // Remove entries whose window has rolled over. Called only when the Map
  // grows past MAX_MAP_SIZE so the amortized cost stays O(1) per request.
  for (const [ip, entry] of ipHits) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      ipHits.delete(ip);
    }
  }
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (ipHits.size > MAX_MAP_SIZE) {
    pruneExpired(now);
    // If still full after pruning live entries, drop the oldest windowStart
    // deterministically to prevent unbounded growth under sustained load.
    if (ipHits.size > MAX_MAP_SIZE) {
      const oldest = ipHits.keys().next().value;
      if (oldest !== undefined) ipHits.delete(oldest);
    }
  }
  const entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

interface CspReportLegacy {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    disposition?: string;
    [key: string]: unknown;
  };
}

interface ReportingApiEntry {
  type?: string;
  url?: string;
  body?: {
    documentURL?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    disposition?: string;
    [key: string]: unknown;
  };
}

function normalize(
  payload: CspReportLegacy | ReportingApiEntry[],
): {
  directive: string;
  blockedUri: string;
  sourceFile?: string;
  documentUri?: string;
  disposition?: string;
} | null {
  // Reporting API: array of entries
  if (Array.isArray(payload)) {
    const cspEntry = payload.find((p) => p.type === "csp-violation");
    if (!cspEntry?.body) return null;
    return {
      directive: cspEntry.body.effectiveDirective ?? "unknown",
      blockedUri: cspEntry.body.blockedURL ?? "",
      sourceFile: cspEntry.body.sourceFile,
      documentUri: cspEntry.body.documentURL,
      disposition: cspEntry.body.disposition,
    };
  }
  // Legacy: { "csp-report": { ... } }
  const legacy = payload["csp-report"];
  if (!legacy) return null;
  return {
    directive:
      legacy["effective-directive"] ??
      legacy["violated-directive"] ??
      "unknown",
    blockedUri: legacy["blocked-uri"] ?? "",
    sourceFile: legacy["source-file"],
    documentUri: legacy["document-uri"],
    disposition: legacy.disposition,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return new NextResponse(null, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("application/csp-report") &&
    !contentType.includes("application/reports+json") &&
    !contentType.includes("application/json")
  ) {
    return new NextResponse(null, { status: 415 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // body.length is UTF-16 char count; a payload of 5K characters holding
  // multi-byte code points can exceed 10KB on the wire. Check actual bytes.
  const bodyBytes = Buffer.byteLength(body, "utf8");
  if (bodyBytes > MAX_PAYLOAD_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let parsed: CspReportLegacy | ReportingApiEntry[];
  try {
    parsed = JSON.parse(body);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const report = normalize(parsed);
  if (!report) {
    return new NextResponse(null, { status: 204 });
  }

  // Sentry: dedup by (directive, blocked bucket). The raw blockedUri can be:
  //   - http(s)://... — strip to origin so per-page querystrings collapse
  //   - inline / eval / "self" — CSP keywords, use as-is
  //   - data: / blob: / filesystem: — collapse to scheme bucket
  //   - parse failure / empty — opaque bucket so fingerprint stays stable
  // Falling back to the raw blockedUri would reintroduce high cardinality
  // and nullify the dedup.
  let blockedBucket = "opaque";
  const raw = report.blockedUri ?? "";
  if (raw === "inline" || raw === "eval" || raw === "self" || raw === "data") {
    blockedBucket = raw;
  } else if (/^https?:/i.test(raw)) {
    try {
      blockedBucket = new URL(raw).origin;
    } catch {
      blockedBucket = "invalid-url";
    }
  } else if (/^data:/i.test(raw)) {
    blockedBucket = "data:";
  } else if (/^blob:/i.test(raw)) {
    blockedBucket = "blob:";
  } else if (/^filesystem:/i.test(raw)) {
    blockedBucket = "filesystem:";
  } else if (raw) {
    // Unknown scheme or relative path — keep first 32 chars only to prevent
    // high-cardinality explosion while still giving a hint.
    blockedBucket = `other:${raw.slice(0, 32)}`;
  }

  Sentry.captureMessage("CSP violation", {
    level: "warning",
    tags: {
      "csp-violation": "true",
      "csp-directive": report.directive,
      "csp-disposition": report.disposition ?? "enforce",
    },
    fingerprint: ["csp-violation", report.directive, blockedBucket],
    extra: {
      directive: report.directive,
      blockedUri: report.blockedUri,
      blockedBucket,
      sourceFile: report.sourceFile,
      documentUri: report.documentUri,
      disposition: report.disposition,
      ip,
    },
  });

  return new NextResponse(null, { status: 204 });
}

export async function GET(): Promise<NextResponse> {
  return new NextResponse(null, { status: 405 });
}
