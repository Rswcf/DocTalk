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

// Tiny in-memory rate limiter keyed by client IP. Acceptable for per-edge
// deployment; for multi-region hardening, swap for Redis.
const ipHits = new Map<string, { count: number; windowStart: number }>();

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
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

  if (body.length > MAX_PAYLOAD_BYTES) {
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

  // Sentry: dedup by (directive, blocked origin). Browsers report the exact
  // blocked URI including query strings, which would explode event counts;
  // we strip to origin.
  let blockedOrigin = report.blockedUri;
  try {
    if (report.blockedUri && /^https?:/.test(report.blockedUri)) {
      blockedOrigin = new URL(report.blockedUri).origin;
    }
  } catch {
    // keep raw blockedUri
  }

  Sentry.captureMessage("CSP violation", {
    level: "warning",
    tags: {
      "csp-violation": "true",
      "csp-directive": report.directive,
      "csp-disposition": report.disposition ?? "enforce",
    },
    fingerprint: ["csp-violation", report.directive, blockedOrigin],
    extra: {
      directive: report.directive,
      blockedUri: report.blockedUri,
      blockedOrigin,
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
