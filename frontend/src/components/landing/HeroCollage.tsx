"use client";

import { useLocale } from '../../i18n';

/**
 * HeroCollage — Art-directed editorial collage for the DocTalk landing hero.
 * Pure HTML/CSS/SVG, warm editorial palette only. No external images.
 * No glassmorphism, no gradient mesh, no UI mock. Aria-hidden decorative.
 */
export default function HeroCollage() {
  const { t } = useLocale();
  return (
    <figure aria-hidden="true" style={{ position: "relative" }}>
      {/* ─── Outer container — roughly 4:5 aspect ─── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 5",
          maxWidth: "460px",
          overflow: "visible",
        }}
      >
        {/* ── Background ochre rectangle — large vertical stripe ── */}
        <div
          style={{
            position: "absolute",
            top: "6%",
            right: "0",
            width: "58%",
            height: "82%",
            background: "var(--ed-ochre)",
            opacity: 0.18,
          }}
        />

        {/* ── Halftone dot block — bottom-left corner ── */}
        <div
          className="ed-halftone"
          style={{
            position: "absolute",
            bottom: "4%",
            left: "0",
            width: "36%",
            height: "28%",
            borderRadius: "1px",
          }}
        />

        {/* ── Thin geometric square outline — top-left ── */}
        <div
          style={{
            position: "absolute",
            top: "2%",
            left: "4%",
            width: "80px",
            height: "80px",
            border: "1px solid var(--ed-rule)",
          }}
        />

        {/* ── Signal shape — soft terracotta accent, low opacity ── */}
        <div
          style={{
            position: "absolute",
            top: "28%",
            left: "2%",
            width: "48px",
            height: "110px",
            background: "var(--ed-signal)",
            opacity: 0.12,
          }}
        />

        {/* ── Oversized italic serif glyph (graphic element, behind plate) ── */}
        <div
          style={{
            position: "absolute",
            top: "8%",
            right: "6%",
            fontFamily: "var(--dt-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(120px, 18vw, 180px)",
            lineHeight: 1,
            color: "var(--ed-ochre)",
            opacity: 0.12,
            userSelect: "none",
            pointerEvents: "none",
            letterSpacing: "-0.05em",
          }}
        >
          §
        </div>

        {/* ── Registration crosshair — top-right area ── */}
        <div
          className="ed-crosshair"
          style={{ position: "absolute", top: "10%", right: "8%" }}
        />

        {/* ── Registration crosshair — bottom-left ── */}
        <div
          className="ed-crosshair"
          style={{ position: "absolute", bottom: "10%", left: "28%" }}
        />

        {/* ── PRIMARY DOCUMENT PLATE ── */}
        {/* Rotated ~-3deg, offset slightly left-of-centre */}
        <div
          style={{
            position: "absolute",
            top: "14%",
            left: "8%",
            right: "6%",
            background: "var(--ed-paper)",
            border: "1px solid var(--ed-rule)",
            borderRadius: "2px",
            padding: "22px 20px 18px",
            transform: "rotate(-2.8deg)",
            boxShadow:
              "0 4px 18px 0 rgba(28,27,25,0.10), 0 1px 3px 0 rgba(28,27,25,0.07)",
          }}
        >
          {/* Document header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <span
              className="ed-caption"
              style={{ letterSpacing: "0.06em" }}
            >
              report.pdf &middot; p.&thinsp;4
            </span>
            {/* Small page indicator */}
            <span
              className="ed-caption"
              style={{
                background: "var(--ed-paper-2)",
                border: "1px solid var(--ed-rule)",
                padding: "1px 5px",
                borderRadius: "1px",
              }}
            >
              04
            </span>
          </div>

          {/* Text lines — thin rule bars */}
          {/* Line 1 — plain */}
          <div
            style={{
              height: "7px",
              background: "var(--ed-rule)",
              borderRadius: "1px",
              marginBottom: "8px",
              opacity: 0.7,
              width: "92%",
            }}
          />
          {/* Line 2 — plain */}
          <div
            style={{
              height: "7px",
              background: "var(--ed-rule)",
              borderRadius: "1px",
              marginBottom: "8px",
              opacity: 0.55,
              width: "78%",
            }}
          />

          {/* Line 3 — HIGHLIGHTED (citation band) */}
          <div
            style={{
              position: "relative",
              marginBottom: "8px",
            }}
          >
            {/* Amber/signal highlight band */}
            <div
              style={{
                position: "absolute",
                inset: "-2px -4px",
                background: "var(--ed-ochre)",
                opacity: 0.18,
                borderRadius: "1px",
              }}
            />
            <div
              style={{
                height: "7px",
                background: "var(--ed-ink-2)",
                borderRadius: "1px",
                opacity: 0.55,
                width: "88%",
                position: "relative",
              }}
            />
            {/* Terracotta margin citation marker */}
            <div
              style={{
                position: "absolute",
                right: "-14px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "18px",
                height: "18px",
                background: "var(--ed-signal)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--dt-mono)",
                  fontSize: "8px",
                  fontWeight: 700,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                3
              </span>
            </div>
          </div>

          {/* Line 4 — plain */}
          <div
            style={{
              height: "7px",
              background: "var(--ed-rule)",
              borderRadius: "1px",
              marginBottom: "8px",
              opacity: 0.5,
              width: "65%",
            }}
          />
          {/* Line 5 — plain */}
          <div
            style={{
              height: "7px",
              background: "var(--ed-rule)",
              borderRadius: "1px",
              marginBottom: "16px",
              opacity: 0.45,
              width: "83%",
            }}
          />

          {/* Thin internal rule */}
          <hr
            style={{
              border: 0,
              borderTop: "1px solid var(--ed-rule)",
              marginBottom: "12px",
            }}
          />

          {/* Citation annotation row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            {/* Badge */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "16px",
                height: "16px",
                background: "var(--ed-signal)",
                borderRadius: "50%",
                flexShrink: 0,
                marginTop: "1px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--dt-mono)",
                  fontSize: "7px",
                  fontWeight: 700,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                3
              </span>
            </span>
            {/* Annotation text lines */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: "6px",
                  background: "var(--ed-rule)",
                  borderRadius: "1px",
                  marginBottom: "5px",
                  opacity: 0.65,
                  width: "90%",
                }}
              />
              <div
                style={{
                  height: "6px",
                  background: "var(--ed-rule)",
                  borderRadius: "1px",
                  opacity: 0.45,
                  width: "60%",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Second document plate — stacked behind, peeking ── */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "14%",
            right: "2%",
            height: "60%",
            background: "var(--ed-paper-2)",
            border: "1px solid var(--ed-rule)",
            borderRadius: "2px",
            transform: "rotate(2.2deg)",
            zIndex: -1,
          }}
        />
      </div>

      {/* ─── Caption below the collage ─── */}
      <figcaption
        className="ed-caption"
        style={{ marginTop: "12px", display: "block" }}
      >
        Fig.&thinsp;01 — {t('landing.heroCollage.caption')}
      </figcaption>
    </figure>
  );
}
