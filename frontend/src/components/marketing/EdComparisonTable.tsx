"use client";

import React from "react";
import { useLocale } from "../../i18n";
import EdInlineCell from "./EdInlineCell";

type CellValue = string | boolean;

interface SingleCompetitorFeature {
  name: string;
  doctalk: CellValue;
  competitor: CellValue;
}

interface MultiCompetitorFeature {
  name: string;
  doctalk: CellValue;
  competitors: CellValue[];
}

/**
 * Single-competitor shape (legacy, used by `compare/*` and `alternatives/*` pages).
 * Pass `features: { name, doctalk, competitor }[]` + `competitorName: string`.
 */
interface SingleCompetitorProps {
  features: SingleCompetitorFeature[];
  competitorName: string;
  competitors?: never;
  featureLabel?: string;
}

/**
 * Multi-competitor shape (used when comparing DocTalk against ≥2 tools).
 * Pass `competitors: string[]` (column headers in display order)
 * + `features: { name, doctalk, competitors: CellValue[] }[]` where each
 * row's `competitors` array is aligned to the same order as the top-level
 * `competitors` prop.
 */
interface MultiCompetitorProps {
  features: MultiCompetitorFeature[];
  competitors: string[];
  competitorName?: never;
  featureLabel?: string;
}

/**
 * Comparison table for editorial marketing surface.
 *
 * Accepts EITHER:
 * - single-competitor shape: `{ features: [{ name, doctalk, competitor }], competitorName }`
 *   (legacy — kept for backwards compatibility with all `compare/*` and `alternatives/*` callers).
 * - multi-competitor shape: `{ features: [{ name, doctalk, competitors: [...] }], competitors: [...] }`
 *   (use when you need N competitor columns; replaces bespoke inline tables).
 *
 * `featureLabel` optionally overrides the leftmost column header
 * (defaults to `t('billing.comparison.feature')`).
 *
 * Styling (hairline border, DocTalk-column emphasis, scope attributes) is
 * identical across both shapes — extending to N cols preserves the editorial
 * look of the 3-col version.
 */
export type EdComparisonTableProps = SingleCompetitorProps | MultiCompetitorProps;

function isMulti(
  props: EdComparisonTableProps
): props is MultiCompetitorProps {
  return Array.isArray((props as MultiCompetitorProps).competitors);
}

export default function EdComparisonTable(props: EdComparisonTableProps) {
  const { t } = useLocale();
  const featureHeader = props.featureLabel ?? t("billing.comparison.feature");

  // Normalize to multi-competitor shape internally.
  const competitorHeaders: string[] = isMulti(props)
    ? props.competitors
    : [props.competitorName];

  const rows: MultiCompetitorFeature[] = isMulti(props)
    ? props.features
    : props.features.map((feature) => ({
        name: feature.name,
        doctalk: feature.doctalk,
        competitors: [feature.competitor],
      }));

  const competitorCount = competitorHeaders.length;
  // Match legacy single-competitor layout exactly: 40 / 30 / 30.
  // For N>1 competitors, give 40% to feature column and split the rest evenly
  // between DocTalk + each competitor (so a 3-competitor table is 40 / 15 / 15 / 15 / 15).
  const featureColWidth = "40%";
  const dataColWidth = competitorCount === 1
    ? "30%"
    : `${60 / (competitorCount + 1)}%`;

  const headStyle: React.CSSProperties = {
    padding: "14px 18px",
    textAlign: "center",
    width: dataColWidth,
  };
  const cellStyle: React.CSSProperties = {
    padding: "13px 18px",
    textAlign: "center",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: competitorCount > 1 ? "600px" : "480px",
          border: "1px solid var(--ed-rule)",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--ed-rule)" }}>
            <th
              scope="col"
              className="ed-label"
              style={{
                width: featureColWidth,
                padding: "14px 18px",
                textAlign: "left",
              }}
            >
              {featureHeader}
            </th>
            <th
              scope="col"
              className="ed-label"
              style={{
                ...headStyle,
                background: "var(--ed-paper-2)",
                color: "var(--ed-signal)",
              }}
            >
              DocTalk
            </th>
            {competitorHeaders.map((name, i) => (
              <th key={`${name}-${i}`} scope="col" className="ed-label" style={headStyle}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((feature, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--ed-rule)" }}>
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
                  ...cellStyle,
                  background: "var(--ed-paper-2)",
                }}
              >
                <EdInlineCell value={feature.doctalk} />
              </td>
              {feature.competitors.map((value, j) => (
                <td key={j} style={cellStyle}>
                  <EdInlineCell value={value} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
