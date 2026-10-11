# Parse v5 heading size rule — corpus before/after

Date: 2026-10-11. Branch `claude/sharp-feynman-4vqkq2`. Design: `.collab/plans/2026-10-11-parse-heading-body-size.md`.
Implementation: `backend/app/services/parse_service.py` (`_prepare_blocks`, `_annotate_runs`, `_reference_sizes`, `_is_heading_by_size`).

**Old = `main` (parse v3, d46fc222). New = this branch.** v4 (`fix/parse-heading-detection`, caps/numbered rules) was not
on origin when this was measured, so the v4 column does not exist yet; re-run with `--old-ref <v4 commit>` after v4 is merged in.

## How to reproduce (and run on the private 50-PDF corpus)

```bash
uv venv -p 3.12 /tmp/doctalk-measure && uv pip install -p /tmp/doctalk-measure/bin/python -r backend/requirements-dev.txt
PY=/tmp/doctalk-measure/bin/python
$PY .collab/scripts/parse_heading_synth.py /tmp/heading-synth            # synthetic S1–S10b
$PY .collab/scripts/parse_heading_corpus.py --old-ref <v4 commit> \
    --pdf-dir test_inputs --pdf-dir backend/seed_data --pdf-dir /tmp/heading-synth \
    --out-md /tmp/heading.md --diff-dir /tmp/heading-diffs
```

The public PDFs can be re-downloaded from the URL list at the end (Goldman Sachs' own site needs a
goldmansachs.com `Referer`; gspublishing.com does not). They are not committed (third-party copyright).

Columns: headings = `heading` elements from `extract_elements`; heading share = heading characters / (heading +
paragraph characters); paragraph chars = `paragraph` element characters (not chunk characters, which include the
50-token overlap). Public classes: 1 sell-side/bank research, 2 Chinese broker research, 3 economics working paper,
4 investor slides, 5 control.

## Result

47 PDFs with a text layer (33 public, 11 synthetic, 3 seed); 35 change; **paragraph characters fell in 0**.
`chicagofed_forecasting_economic_effects_ai` is the public copy of the owner's "Forecasting the Economic Effects
of AI (03-2026)" (225 pp, 9.18pt line median, 12pt body): 66.8% → 6.6%, +258,034 paragraph characters.

Every share drop is body text returning to paragraphs. Headings ADDED: 11, all in
`slides_digital_core_reit_jun2026` — tile titles such as `Occupancy (2)`, `Leverage (3)` whose 9.36pt footnote
marker had pulled the 14.04pt line's span mean to 11.7pt; their unmarked siblings (`Debt Headroom`,
`Debt Maturity`) were already headings. The one non-title addition found during implementation
(`www.plindia.com`, 9pt beside an 8pt whitespace span) is rejected by the bare-address guard.

### Public proxy corpus (33 PDFs)

| Document | Class | Pages | Headings v3 → v5 | Heading share v3 → v5 | Paragraph chars v3 → v5 (Δ) | +added / −removed |
|---|---|---:|---:|---:|---:|---:|
| cn_guosen_oil_gas_monthly_sep2026 | 2 | 27 | 464 → 117 | 81.2% → 10.4% | 5,214 → 24,894 (+19,680) | +0 / −347 |
| cn_galaxy_futures_macro_commodities | 2 | 17 | 327 → 94 | 75.2% → 16.1% | 3,852 → 13,015 (+9,163) | +0 / −233 |
| cn_sinolink_nonferrous_copper_weekly | 2 | 16 | 273 → 67 | 67.3% → 14.5% | 6,000 → 15,681 (+9,681) | +0 / −206 |
| chicagofed_forecasting_economic_effects_ai | 3 | 225 | 5744 → 1994 | 66.8% → 6.6% | 142,630 → 400,664 (+258,034) | +0 / −3750 |
| gs_equity_research_jd_2019_dfcfw | 1 | 16 | 548 → 131 | 63.3% → 2.1% | 22,659 → 60,388 (+37,729) | +0 / −417 |
| fed_feds_ai_coder_employment | 3 | 57 | 890 → 40 | 60.5% → 0.9% | 43,367 → 108,914 (+65,547) | +0 / −850 |
| cn_guosen_ai_industry_special22 | 2 | 38 | 512 → 363 | 48.4% → 25.3% | 15,251 → 22,065 (+6,814) | +0 / −149 |
| gs_global_strategy_not_in_bubble_yet | 1 | 29 | 451 → 45 | 47.5% → 0.8% | 35,056 → 66,196 (+31,140) | +0 / −406 |
| control_ms_10q_q2_2026 | 5 | 79 | 3587 → 458 | 46.8% → 0.9% | 167,001 → 310,921 (+143,920) | +0 / −3129 |
| gs_strategy_long_term_returns_10y | 1 | 31 | 498 → 68 | 44.6% → 1.1% | 39,410 → 70,348 (+30,938) | +0 / −430 |
| ms_research_ai_rate_of_change | 1 | 60 | 1351 → 280 | 42.6% → 2.0% | 92,785 → 158,497 (+65,712) | +0 / −1071 |
| edison_games_workshop_2026 | 1 | 7 | 191 → 50 | 36.9% → 2.2% | 16,004 → 24,796 (+8,792) | +0 / −141 |
| gs_commodities_energy_to_metals_2026 | 1 | 12 | 162 → 15 | 31.9% → 1.3% | 25,503 → 36,986 (+11,483) | +0 / −147 |
| gs_global_strategy_bear_market_anatomy | 1 | 20 | 296 → 70 | 30.5% → 1.3% | 38,794 → 55,059 (+16,265) | +0 / −226 |
| cn_swsc_dram_memory_ai | 2 | 31 | 388 → 376 | 22.7% → 22.5% | 30,329 → 30,399 (+70) | +0 / −12 |
| slides_digital_core_reit_jun2026 | 4 | 39 | 517 → 406 | 22.5% → 14.3% | 32,472 → 35,922 (+3,450) | +11 / −122 |
| cn_donghai_oil_price_cycles_review | 2 | 27 | 228 → 190 | 21.9% → 14.6% | 28,022 → 30,640 (+2,618) | +0 / −38 |
| slides_asml_q2_2026_investor | 4 | 18 | 95 → 42 | 21.4% → 4.5% | 10,539 → 12,797 (+2,258) | +0 / −53 |
| slides_ms_2q26_fixed_income_investor | 4 | 11 | 60 → 45 | 16.1% → 4.1% | 10,007 → 11,427 (+1,420) | +0 / −15 |
| slides_ms_4q25_strategic_update | 4 | 21 | 106 → 87 | 12.2% → 10.3% | 15,031 → 15,358 (+327) | +0 / −19 |
| jpm_guide_to_markets_us | 1 | 71 | 871 → 865 | 8.6% → 8.4% | 87,527 → 87,660 (+133) | +0 / −6 |
| in_plcapital_tcs_q2fy27 | 1 | 10 | 190 → 158 | 8.0% → 3.7% | 27,258 → 28,523 (+1,265) | +0 / −32 |
| ing_monthly_economic_update_may2026 | 1 | 35 | 123 → 65 | 6.6% → 1.7% | 56,944 → 59,947 (+3,003) | +0 / −58 |
| gs_us_power_surge_datacenters | 1 | 35 | 135 → 81 | 3.5% → 1.8% | 82,066 → 83,480 (+1,414) | +0 / −54 |
| gs_tom_genai_too_much_spend | 1 | 31 | 132 → 87 | 3.3% → 1.4% | 135,125 → 137,732 (+2,607) | +0 / −45 |
| ms_research_bridging_datacenter_financing_gap | 1 | 39 | 175 → 126 | 3.1% → 1.9% | 126,021 → 127,589 (+1,568) | +0 / −49 |
| fed_feds_cyclical_frictions_productivity | 3 | 117 | 537 → 491 | 2.2% → 1.6% | 179,801 → 180,972 (+1,171) | +0 / −46 |
| ubs_cio_house_view_aug2026 | 1 | 28 | 130 → 130 | 1.6% → 1.6% | 80,425 → 80,425 (+0) | +0 / −0 |
| bis_wp1325_ai_adoption_european_firms | 3 | 36 | 40 → 34 | 0.8% → 0.6% | 66,450 → 66,565 (+115) | +0 / −6 |
| control_arxiv_2508_02992_memory_specialization | 5 | 9 | 15 → 15 | 0.4% → 0.4% | 43,866 → 43,866 (+0) | +0 / −0 |
| control_arxiv_1706_03762_attention | 5 | 15 | 31 → 31 | 0.4% → 0.4% | 38,230 → 38,230 (+0) | +0 / −0 |
| bis_wp1367_ai_investment_race | 3 | 56 | 97 → 96 | 0.4% → 0.4% | 122,728 → 122,735 (+7) | +0 / −1 |
| control_equinix_10k_fy2025 | 5 | 231 | 300 → 300 | 0.3% → 0.3% | 794,748 → 794,748 (+0) | +0 / −0 |

### Synthetic cases (`parse_heading_synth.py`)

| Document | Pages | Headings v3 → v5 | Heading share v3 → v5 | Paragraph chars v3 → v5 (Δ) | +added / −removed |
|---|---:|---:|---:|---:|---:|
| S7_wrapped_and_callout | 1 | 36 → 11 | 77.1% → 7.0% | 432 → 1,757 (+1,325) | +0 / −25 |
| S3_paper_12pt | 36 | 261 → 1 | 32.3% → 0.0% | 40,462 → 59,771 (+19,309) | +0 / −260 |
| S5_cjk_broker | 7 | 205 → 43 | 30.4% → 1.7% | 11,364 → 16,044 (+4,680) | +0 / −162 |
| S1_broker_chart_heavy | 10 | 246 → 90 | 29.5% → 2.1% | 25,694 → 35,680 (+9,986) | +0 / −156 |
| S9_small_appendix | 10 | 84 → 10 | 11.6% → 0.3% | 58,031 → 65,474 (+7,443) | +0 / −74 |
| S2_two_body_sizes | 10 | 73 → 8 | 11.2% → 0.1% | 50,433 → 56,733 (+6,300) | +0 / −65 |
| S8_chart_deck | 12 | 12 → 12 | 7.4% → 7.4% | 6,004 → 6,004 (+0) | +0 / −0 |
| S6_slides | 10 | 10 → 10 | 6.4% → 6.4% | 3,699 → 3,699 (+0) | +0 / −0 |
| S10a_ocr_jitter_small | 6 | 6 → 6 | 1.4% → 1.4% | 13,512 → 13,512 (+0) | +0 / −0 |
| S10b_ocr_jitter_large | 6 | 6 → 6 | 1.4% → 1.4% | 13,512 → 13,512 (+0) | +0 / −0 |
| S4_normal_paper | 7 | 1 → 1 | 0.1% → 0.1% | 32,542 → 32,542 (+0) | +0 / −0 |

### Seed PDFs

| Document | Pages | Headings v3 → v5 | Heading share v3 → v5 | Paragraph chars v3 → v5 (Δ) | +added / −removed |
|---|---:|---:|---:|---:|---:|
| court-filing | 6 | 10 → 10 | 2.8% → 2.8% | 7,279 → 7,279 (+0) | +0 / −0 |
| alphabet-earnings | 10 | 16 → 16 | 0.9% → 0.9% | 23,478 → 23,478 (+0) | +0 / −0 |
| attention-paper | 15 | 31 → 31 | 0.4% → 0.4% | 38,230 → 38,230 (+0) | +0 / −0 |

### Sources of the public proxy corpus

| Document | URL |
|---|---|
| bis_wp1325_ai_adoption_european_firms | https://www.bis.org/publications/working-paper-1325-ai-adoption-productivity-and-employment-evidence-european-firms.pdf |
| bis_wp1367_ai_investment_race | https://www.bis.org/publications/working-paper-1367-ai-investment-race.pdf |
| chicagofed_forecasting_economic_effects_ai | https://www.chicagofed.org/-/media/publications/working-papers/2026/wp2026-07.pdf?sc_lang=en |
| cn_donghai_oil_price_cycles_review | https://pdf.dfcfw.com/pdf/H3_AP202609131829338065_1.pdf |
| cn_galaxy_futures_macro_commodities | https://pdf.dfcfw.com/pdf/H3_AP202609301830023882_1.pdf |
| cn_guosen_ai_industry_special22 | https://pdf.dfcfw.com/pdf/H3_AP202609271829935669_1.pdf |
| cn_guosen_oil_gas_monthly_sep2026 | https://pdf.dfcfw.com/pdf/H3_AP202610081830219810_1.pdf |
| cn_sinolink_nonferrous_copper_weekly | https://pdf.dfcfw.com/pdf/H3_AP202609281829951151_1.pdf |
| cn_swsc_dram_memory_ai | https://pdf.dfcfw.com/pdf/H3_AP202609301830050708_1.pdf |
| control_arxiv_1706_03762_attention | https://arxiv.org/pdf/1706.03762 |
| control_arxiv_2508_02992_memory_specialization | https://arxiv.org/pdf/2508.02992 |
| control_equinix_10k_fy2025 | https://investor.equinix.com/sec-filings/all-sec-filings/content/0001101239-26-000032/0001101239-26-000032.pdf |
| control_ms_10q_q2_2026 | https://www.morganstanley.com/content/dam/msdotcom/en/about-us-ir/shareholder/10q0626.pdf |
| edison_games_workshop_2026 | https://d3s3shtvds09gm.cloudfront.net/26c95888e9f371a18d42ff93954604fa.pdf |
| fed_feds_ai_coder_employment | https://www.federalreserve.gov/econres/feds/files/2026018pap.pdf |
| fed_feds_cyclical_frictions_productivity | https://www.federalreserve.gov/econres/feds/files/2026047pap.pdf |
| gs_commodities_energy_to_metals_2026 | https://www.gspublishing.com/content/research/en/reports/2026/06/28/9f8e4385-0c24-46d9-8610-98fca5140d0a.pdf |
| gs_equity_research_jd_2019_dfcfw | https://pdf.dfcfw.com/pdf/H3_AP201903111304632031_1.pdf |
| gs_global_strategy_bear_market_anatomy | https://www.gspublishing.com/content/research/en/reports/2025/04/08/0bf285f5-8d4a-478c-843f-4b4ea81256d5.pdf |
| gs_global_strategy_not_in_bubble_yet | https://www.gspublishing.com/content/research/en/reports/2025/10/08/3da3403c-c6ea-4a66-816f-a70e09afee7c.pdf |
| gs_strategy_long_term_returns_10y | https://www.gspublishing.com/content/research/en/reports/2025/11/12/0c292cc7-ce42-4fba-a026-744231e9f4f4.pdf |
| gs_tom_genai_too_much_spend | https://www.goldmansachs.com/images/migrated/insights/pages/gs-research/gen-ai--too-much-spend,-too-little-benefit-/TOM_AI%202.0_ForRedaction.pdf |
| gs_us_power_surge_datacenters | https://www.goldmansachs.com/pdfs/insights/pages/generational-growth-ai-data-centers-and-the-coming-us-power-surge/report.pdf |
| in_plcapital_tcs_q2fy27 | https://plindia.com/ResReport/TCS-9-10-26-PL.pdf |
| ing_monthly_economic_update_may2026 | https://think.ing.com/uploads/reports/Monthly_Economic_Update_May_2026.pdf |
| jpm_guide_to_markets_us | https://am.jpmorgan.com/content/dam/jpm-am-aem/global/en/insights/market-insights/guide-to-the-markets/mi-guide-to-the-markets-us.pdf |
| ms_research_ai_rate_of_change | https://www.morganstanley.com/content/dam/msdotcom/en/assets/pdfs/Research_AI-Rate-of-Change.pdf |
| ms_research_bridging_datacenter_financing_gap | https://www.morganstanley.com/content/dam/msdotcom/en/assets/pdfs/Research_Bridging-Data-Center-Gap.pdf |
| slides_asml_q2_2026_investor | https://ourbrand.asml.com/asset/9078cf4d-91fd-4dd9-a5d5-d1caab6dc046/2026_07_15_Presentation-Investor-Relations-Q2-2026.pdf |
| slides_digital_core_reit_jun2026 | https://links.sgx.com/1.0.0/corporate-announcements/9F6PRKETUW7XFFKD/893842_Digital%20Core%20REIT%20-%20Investor%20Presentation_June%202026.pdf |
| slides_ms_2q26_fixed_income_investor | https://www.morganstanley.com/content/dam/msdotcom/en/about-us-ir/pdf/Morgan_Stanley_2Q26_Fixed_Income_Investor_Presentation.pdf |
| slides_ms_4q25_strategic_update | https://www.morganstanley.com/content/dam/msdotcom/en/about-us-ir/shareholder/4q2025-strategic-update.pdf |
| ubs_cio_house_view_aug2026 | https://advisors.ubs.com/mediahandler/media/823469/UBS%20House%20View%20for%20August%202026.pdf |

## Where the remaining heading share comes from (public corpus, v5)

The size rule is no longer what keeps the broker reports above a few percent; the current all-caps rule
(`AI`, `GPU`, `FY26Q3`, all-caps table cells) is, and v4 tightens that rule.

| Document | v5 heading share | of which size rule | of which caps rule |
|---|---:|---:|---:|
| cn_guosen_ai_industry_special22 | 25.3% | 5.2% | 20.1% |
| cn_swsc_dram_memory_ai | 22.5% | 1.0% | 21.5% |
| cn_galaxy_futures_macro_commodities | 16.1% | 0.6% | 15.6% |
| cn_donghai_oil_price_cycles_review | 14.6% | 1.2% | 13.4% |
| cn_sinolink_nonferrous_copper_weekly | 14.5% | 0.0% | 14.5% |
| slides_digital_core_reit_jun2026 | 14.3% | 11.8% | 2.5% |
| cn_guosen_oil_gas_monthly_sep2026 | 10.4% | 0.6% | 9.8% |
| slides_ms_4q25_strategic_update | 10.3% | 10.0% | 0.3% |
| jpm_guide_to_markets_us | 8.4% | 7.0% | 1.5% |
| chicagofed_forecasting_economic_effects_ai | 6.6% | 0.5% | 6.1% |
| slides_asml_q2_2026_investor | 4.5% | 3.4% | 1.1% |
| slides_ms_2q26_fixed_income_investor | 4.1% | 3.4% | 0.7% |
| in_plcapital_tcs_q2fy27 | 3.7% | 1.5% | 2.3% |
| edison_games_workshop_2026 | 2.2% | 1.5% | 0.7% |
| gs_equity_research_jd_2019_dfcfw | 2.1% | 1.1% | 1.0% |
| ms_research_ai_rate_of_change | 2.0% | 1.2% | 0.8% |
| ms_research_bridging_datacenter_financing_gap | 1.9% | 1.6% | 0.3% |
| gs_us_power_surge_datacenters | 1.8% | 1.5% | 0.3% |
| ing_monthly_economic_update_may2026 | 1.7% | 1.3% | 0.4% |
| ubs_cio_house_view_aug2026 | 1.6% | 1.2% | 0.5% |
| fed_feds_cyclical_frictions_productivity | 1.6% | 0.5% | 1.1% |
| gs_tom_genai_too_much_spend | 1.4% | 1.2% | 0.2% |
| gs_global_strategy_bear_market_anatomy | 1.3% | 1.1% | 0.2% |
| gs_commodities_energy_to_metals_2026 | 1.3% | 1.2% | 0.1% |
| gs_strategy_long_term_returns_10y | 1.1% | 0.8% | 0.4% |
| fed_feds_ai_coder_employment | 0.9% | 0.3% | 0.5% |
| control_ms_10q_q2_2026 | 0.9% | 0.4% | 0.4% |
| gs_global_strategy_not_in_bubble_yet | 0.8% | 0.6% | 0.2% |
| bis_wp1325_ai_adoption_european_firms | 0.6% | 0.6% | 0.1% |
| control_arxiv_2508_02992_memory_specialization | 0.4% | 0.2% | 0.3% |
| control_arxiv_1706_03762_attention | 0.4% | 0.1% | 0.4% |
| bis_wp1367_ai_investment_race | 0.4% | 0.2% | 0.2% |
| control_equinix_10k_fy2025 | 0.3% | 0.0% | 0.2% |

## Hand review of the added / removed lists

Read: chicagofed, gs_equity_research_jd, control_ms_10q, cn_guosen_oil_gas, slides_digital_core_reit,
in_plcapital (both rounds), plus Fable's eight (`.collab/plans/…` §2.2).

- Removed lines are body sentences, author lists, wrapped table-of-contents rows (`图12：…………12`), disclosure
  boilerplate and exhibit labels.
- A few removed lines are real sub-headings set at (or within 1.25× of) body size: `Controls and Procedures` and
  `Equity, Fixed Income and Other Net Revenues` (MS 10-Q), `Our JD GMV/Revenue forecasts for the coming
  quarters/years` (an exhibit title), `油价观点判断：` (a lead-in). v3 only found them because its reference sat
  under the body; on correctly measured documents neither version finds them. They need a weight signal (plan §10.1).
- Kept: chicagofed `1. Introduction … 5. Discussion`, `References`, `Appendix`, `Table 21: …`;
  cn_guosen_oil_gas its 14 section titles (`核心观点`, `1、9 月回顾…`, `风险提示`, `免责声明`); slide titles.

## Cost

`chunk_document` + `extract_elements` together, same machine, v3 → v5: chicagofed (225 pp, 17,339 lines)
0.35 → 0.61 s; Equinix 10-K (231 pp) 0.39 → 0.52 s; MS 10-Q (79 pp, 17,160 lines) 0.35 → 0.75 s; JPM Guide
(71 pp) 0.22 → 0.62 s. Synthetic worst case for the run sweep: 3,000 table cells plus one 400pt-tall line on a
page, 0.44 s/page (0.08 s without the tall line; the active list is capped at 400). Real PDFs: line height /
font size p99.99 = 3.1, max 6.4 over 117,152 lines.

## Tests

`backend/tests/test_parse_service.py`: 29 → 48 (class `TestHeadingSizeUsesPageBodySize`, 19 tests). 11 of the new
tests fail on v3. Mutation check: removing the continuity guard, the floor, the digit guard, the address guard,
`dominant_size`, the line-extent filter, the largest-substantial choice, the document-reference choice, the
same-row check, or the vertical-page axis each fails at least one test. Full unit suite: 1164 passed, 138 skipped
(`SKIP_INTEGRATION` unset; the integration suite needs Docker, unavailable in this session).
