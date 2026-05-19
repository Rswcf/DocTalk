"use client";

import React from "react";
import { useLocale } from "../../i18n";

interface Feature {
  name: string;
  doctalk: string | boolean;
  competitor: string | boolean;
}

interface EdComparisonTableProps {
  features: Feature[];
  competitorName: string;
}

function CellValue({ value }: { value: string | boolean }) {
  const { t } = useLocale();

  if (typeof value === "boolean") {
    if (value) {
      return (
        <span
          role="img"
          aria-label={t("common.yes")}
          style={{
            fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
            fontSize: "18px",
            color: "var(--ed-signal)",
          }}
        >
          ✓
        </span>
      );
    }
    return (
      <span
        role="img"
        aria-label={t("common.no")}
        style={{
          fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
          fontSize: "18px",
          color: "var(--ed-ink-3)",
        }}
      >
        –
      </span>
    );
  }

  if (value === "Partial") {
    return (
      <span
        style={{
          fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
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

export default function EdComparisonTable({
  features,
  competitorName,
}: EdComparisonTableProps) {
  const { t } = useLocale();

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: "480px",
          border: "1px solid var(--ed-rule)",
        }}
      >
        <thead>
          <tr
            style={{ borderBottom: "1px solid var(--ed-rule)" }}
          >
            <th
              scope="col"
              className="ed-label"
              style={{
                width: "40%",
                padding: "14px 18px",
                textAlign: "left",
              }}
            >
              {t("billing.comparison.feature")}
            </th>
            <th
              scope="col"
              className="ed-label"
              style={{
                width: "30%",
                padding: "14px 18px",
                textAlign: "center",
                background: "var(--ed-paper-2)",
                color: "var(--ed-signal)",
              }}
            >
              DocTalk
            </th>
            <th
              scope="col"
              className="ed-label"
              style={{
                width: "30%",
                padding: "14px 18px",
                textAlign: "center",
              }}
            >
              {competitorName}
            </th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature, i) => (
            <tr
              key={i}
              style={{ borderTop: "1px solid var(--ed-rule)" }}
            >
              <th
                scope="row"
                className="ed-body"
                style={{
                  padding: "13px 18px",
                  fontWeight: 500,
                  color: "var(--ed-ink)",
                  textAlign: "left",
                }}
              >
                {feature.name}
              </th>
              <td
                style={{
                  padding: "13px 18px",
                  textAlign: "center",
                  background: "var(--ed-paper-2)",
                }}
              >
                <CellValue value={feature.doctalk} />
              </td>
              <td
                style={{
                  padding: "13px 18px",
                  textAlign: "center",
                }}
              >
                <CellValue value={feature.competitor} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
