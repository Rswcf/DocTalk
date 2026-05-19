"use client";

import React from "react";
import { useLocale } from "../../i18n";
import EdInlineCell from "./EdInlineCell";

interface Feature {
  name: string;
  doctalk: string | boolean;
  competitor: string | boolean;
}

interface EdComparisonTableProps {
  features: Feature[];
  competitorName: string;
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
                <EdInlineCell value={feature.doctalk} />
              </td>
              <td
                style={{
                  padding: "13px 18px",
                  textAlign: "center",
                }}
              >
                <EdInlineCell value={feature.competitor} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
