"use client";

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from "remotion";
import {
  FPS,
  TOTAL_FRAMES,
  FRAMES,
  USER_QUESTION,
  AI_RESPONSE,
  CITATIONS,
  PDF_TITLE,
  PDF_SUBTITLE,
  PDF_HEADING,
  PDF_LINES,
  COLORS,
} from "./showcaseData";

// ────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────

function UserBubble({ isDark }: { isDark: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = isDark ? COLORS.dark : COLORS.light;

  const progress = spring({ frame, fps, config: { damping: 20, stiffness: 200 } });
  const translateY = interpolate(progress, [0, 1], [30, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          background: c.userBubble,
          color: c.userBubbleText,
          padding: "10px 14px",
          borderRadius: 16,
          borderBottomRightRadius: 4,
          maxWidth: "85%",
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {USER_QUESTION}
      </div>
    </div>
  );
}

function TypingDots({ isDark }: { isDark: boolean }) {
  const frame = useCurrentFrame();
  const c = isDark ? COLORS.dark : COLORS.light;

  return (
    <div style={{ display: "flex", gap: 4, padding: "10px 14px" }}>
      {[0, 1, 2].map((i) => {
        const bounce = interpolate(
          (frame + i * 3) % 12,
          [0, 6, 12],
          [0, -4, 0],
          { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: c.textMuted,
              transform: `translateY(${bounce}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

function AssistantBubble({ isDark }: { isDark: boolean }) {
  const frame = useCurrentFrame();
  const c = isDark ? COLORS.dark : COLORS.light;

  const charsVisible = Math.floor(frame * 2);
  const visibleText = AI_RESPONSE.slice(0, charsVisible);

  // Blinking cursor
  const cursorOpacity = interpolate(
    frame % 16,
    [0, 8, 16],
    [1, 0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const showCursor = charsVisible < AI_RESPONSE.length;

  // Parse citation markers in visible text
  const renderText = () => {
    const parts: React.ReactNode[] = [];
    const regex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(visibleText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(visibleText.slice(lastIndex, match.index));
      }
      parts.push(
        <span
          key={`cite-${match.index}`}
          style={{
            color: isDark ? "#a1a1aa" : "#71717a",
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          [{match[1]}]
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < visibleText.length) {
      parts.push(visibleText.slice(lastIndex));
    }
    return parts;
  };

  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
      <div
        style={{
          background: c.assistantBubble,
          color: c.assistantBubbleText,
          padding: "10px 14px",
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          maxWidth: "90%",
          fontSize: 12,
          lineHeight: 1.6,
          fontFamily: "Inter, system-ui, sans-serif",
          border: `1px solid ${c.borderLight}`,
        }}
      >
        {renderText()}
        {showCursor && (
          <span
            style={{
              opacity: cursorOpacity,
              color: c.textSecondary,
              marginLeft: 1,
            }}
          >
            |
          </span>
        )}
      </div>
    </div>
  );
}

function CitationCards({ isDark }: { isDark: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = isDark ? COLORS.dark : COLORS.light;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {CITATIONS.map((cite, i) => {
        const delay = i * FRAMES.citationStagger;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 20, stiffness: 200 },
        });
        const translateY = interpolate(progress, [0, 1], [20, 0], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });
        const opacity = interpolate(progress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });

        return (
          <div
            key={cite.refIndex}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              border: `1px solid ${c.borderLight}`,
              background: c.cardBg,
              fontSize: 11,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <span style={{ color: c.textSecondary, fontWeight: 600, flexShrink: 0 }}>
              [{cite.refIndex}]
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: c.assistantBubbleText,
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {cite.snippet}
              </div>
              <div style={{ color: c.textMuted, fontSize: 10, marginTop: 2 }}>
                Page {cite.page}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MockChatPanel({ isDark }: { isDark: boolean }) {
  const c = isDark ? COLORS.dark : COLORS.light;

  return (
    <div
      style={{
        width: "50%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Chat header */}
      <div
        style={{
          padding: "8px 14px",
          borderBottom: `1px solid ${c.border}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: "#22c55e",
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: c.textSecondary,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Claude Sonnet 4.5
        </span>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          overflow: "hidden",
        }}
      >
        <Sequence from={FRAMES.userMsg} layout="none">
          <UserBubble isDark={isDark} />
        </Sequence>

        <Sequence
          from={FRAMES.dotsStart}
          durationInFrames={FRAMES.dotsEnd - FRAMES.dotsStart}
          layout="none"
        >
          <TypingDots isDark={isDark} />
        </Sequence>

        <Sequence from={FRAMES.streamStart} layout="none">
          <AssistantBubble isDark={isDark} />
        </Sequence>

        <Sequence from={FRAMES.citationCards} layout="none">
          <CitationCards isDark={isDark} />
        </Sequence>
      </div>

      {/* Input bar mock */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: `1px solid ${c.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: c.inputBg,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 11,
            color: c.textMuted,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Ask a question about this document...
        </div>
      </div>
    </div>
  );
}

function HighlightOverlay({
  isDark,
  bbox,
  delayFrame,
}: {
  isDark: boolean;
  bbox: { x: number; y: number; w: number; h: number };
  delayFrame: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = isDark ? COLORS.dark : COLORS.light;

  const progress = spring({
    frame: frame - delayFrame,
    fps,
    config: { damping: 200 },
  });

  const scaleX = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: `${bbox.x * 100}%`,
        top: `${bbox.y * 100}%`,
        width: `${bbox.w * 100}%`,
        height: `${bbox.h * 100}%`,
        background: c.highlightBg,
        borderRadius: 3,
        transformOrigin: "left center",
        transform: `scaleX(${scaleX})`,
        opacity,
      }}
    />
  );
}

function MockPdfPanel({ isDark }: { isDark: boolean }) {
  const c = isDark ? COLORS.dark : COLORS.light;

  return (
    <div
      style={{
        width: "50%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* PDF toolbar */}
      <div
        style={{
          padding: "8px 14px",
          borderBottom: `1px solid ${c.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: c.toolbarBg,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: c.textSecondary,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Page 42 / 96
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontSize: 10,
              color: c.textMuted,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            100%
          </span>
        </div>
      </div>

      {/* PDF content area */}
      <div
        style={{
          flex: 1,
          padding: "20px 24px",
          position: "relative",
          background: c.panelBg,
          overflow: "hidden",
        }}
      >
        {/* PDF page frame */}
        <div
          style={{
            background: isDark ? "#1c1c1e" : "#ffffff",
            borderRadius: 4,
            padding: "20px 20px",
            height: "100%",
            position: "relative",
            boxShadow: isDark
              ? "0 1px 3px rgba(0,0,0,0.4)"
              : "0 1px 3px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: c.textPrimary,
              textAlign: "center",
              marginBottom: 4,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {PDF_TITLE}
          </div>
          <div
            style={{
              fontSize: 9,
              color: c.textSecondary,
              textAlign: "center",
              marginBottom: 16,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {PDF_SUBTITLE}
          </div>

          {/* Heading */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: c.textPrimary,
              marginBottom: 10,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {PDF_HEADING}
          </div>

          {/* Text lines */}
          {PDF_LINES.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                lineHeight: 1.7,
                color: c.textPrimary,
                fontFamily: "Inter, system-ui, sans-serif",
                minHeight: line === "" ? 8 : undefined,
              }}
            >
              {line}
            </div>
          ))}

          {/* Highlight overlays */}
          <Sequence from={FRAMES.highlight1} layout="none">
            <HighlightOverlay
              isDark={isDark}
              bbox={CITATIONS[0].bbox}
              delayFrame={0}
            />
          </Sequence>
          <Sequence from={FRAMES.highlight2} layout="none">
            <HighlightOverlay
              isDark={isDark}
              bbox={CITATIONS[1].bbox}
              delayFrame={0}
            />
          </Sequence>
          <Sequence from={FRAMES.highlight3} layout="none">
            <HighlightOverlay
              isDark={isDark}
              bbox={CITATIONS[2].bbox}
              delayFrame={0}
            />
          </Sequence>
        </div>
      </div>
    </div>
  );
}

function FadeOverlay({ isDark }: { isDark: boolean }) {
  const frame = useCurrentFrame();
  const c = isDark ? COLORS.dark : COLORS.light;

  const opacity = interpolate(frame, [0, 29], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: c.bg,
        opacity,
        zIndex: 10,
      }}
    />
  );
}

// ────────────────────────────────────────
// Main Composition
// ────────────────────────────────────────

export interface ProductShowcaseProps {
  isDark: boolean;
}

const ProductShowcase: React.FC<ProductShowcaseProps> = ({ isDark }) => {
  const c = isDark ? COLORS.dark : COLORS.light;

  return (
    <AbsoluteFill
      style={{
        background: c.bg,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Base layout — always visible */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
        }}
      >
        <MockChatPanel isDark={isDark} />

        {/* Divider */}
        <div
          style={{
            width: 1.5,
            background: c.border,
            flexShrink: 0,
          }}
        />

        <MockPdfPanel isDark={isDark} />
      </div>

      {/* Crossfade overlay */}
      <Sequence from={FRAMES.fadeStart} layout="none">
        <FadeOverlay isDark={isDark} />
      </Sequence>
    </AbsoluteFill>
  );
};

export { FPS, TOTAL_FRAMES };
export default ProductShowcase;
