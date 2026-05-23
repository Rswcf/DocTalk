"use client";

import React from "react";
import { useLocale } from "../../i18n";

interface EdInlineCellProps {
  value: string | boolean;
}

const MONO_FONT = "var(--dt-mono)";

export default function EdInlineCell({ value }: EdInlineCellProps) {
  const { t } = useLocale();

  if (value === true) {
    return (
      <span
        role="img"
        aria-label={t("common.yes")}
        style={{
          fontFamily: MONO_FONT,
          fontSize: "18px",
          color: "var(--ed-signal)",
        }}
      >
        ✓
      </span>
    );
  }

  if (value === false) {
    return (
      <span
        role="img"
        aria-label={t("common.no")}
        style={{
          fontFamily: MONO_FONT,
          fontSize: "18px",
          color: "var(--ed-ink-3)",
        }}
      >
        –
      </span>
    );
  }

  if (value === "partial" || value === "Partial") {
    return (
      <span
        role="img"
        aria-label={t("comparison.partial")}
        style={{
          fontFamily: MONO_FONT,
          fontSize: "15.5px",
          color: "var(--ed-ochre)",
        }}
      >
        ~ {t("comparison.partial")}
      </span>
    );
  }

  return (
    <span className="ed-body" style={{ color: "var(--ed-ink-2)" }}>
      {value}
    </span>
  );
}
