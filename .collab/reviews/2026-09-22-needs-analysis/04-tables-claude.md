# Needs analysis — §4 tables (Claude, computed from the coded records; aggregates only)

**4.1 Coverage**

| unit | expected | coded |
|---|---|---|
| registered users to code | 97 | 97 |
| their sessions | 93 | 93 |
| anonymous sessions | 182 | 182 |

**4.1 Calibration codings side by side (payer ground truth: retrieval miss asserted, jargon, over-rigid refusal, refund asked, B1)**

| uid | coder | first-turn outcome | dominant failures | leave reason | appendix B | hypotheses |
|---|---|---|---|---|---|---|
| 755788ef | W1 | satisfied | retrieval_miss_asserted | gave_up_after_failure | B1_large_doc_coverage | H1,H4,H8 |
| 755788ef | W2 | satisfied | retrieval_miss_asserted | gave_up_after_failure | B1_large_doc_coverage | H1,H4,H8 |
| 755788ef | W3 | satisfied | retrieval_miss_asserted | gave_up_after_failure | B1_large_doc_coverage | H1,H4,H8 |
| 58688124 | W1 | satisfied | refusal_overrigid_scope | job_done_partial | B4_overrigid_persona | H2,H8 |
| 58688124 | W2 | satisfied | refusal_overrigid_scope | job_done_partial | B8_done_once_no_hook | H2,H8 |
| 58688124 | W3 | satisfied | refusal_overrigid_scope | job_done_partial | B4_overrigid_persona | H1,H8 |

**4.1 Turn-level agreement of the three coders on the calibration sessions**

| field | all three agree | turns |
|---|---|---|
| outcome | 23 | 28 |
| failure | 14 | 28 |

**4.2 Hypothesis votes (users; several per user)**

| hypothesis | users |
|---|---|
| H1 | 24 |
| H2 | 24 |
| H3 | 30 |
| H4 | 9 |
| H5 | 23 |
| H6 | 14 |
| H7 | 7 |
| H8 | 14 |
| H9 | 7 |
| H10 | 11 |

**4.2 Hypothesis votes × segment**

| hypothesis \ segment | hit_wall | light_use_no_wall | paid | real_work_no_wall | uploaded_never_chatted | total |
|---|---|---|---|---|---|---|
| H1 | 7 | 8 | 1 | 8 |  | 24 |
| H10 | 6 |  |  | 5 |  | 11 |
| H2 | 9 | 5 |  | 10 |  | 24 |
| H3 | 14 |  |  |  | 16 | 30 |
| H4 | 3 | 1 | 1 | 4 |  | 9 |
| H5 | 5 | 5 |  | 6 | 7 | 23 |
| H6 | 14 |  |  |  |  | 14 |
| H7 | 3 | 1 |  | 3 |  | 7 |
| H8 | 3 |  | 1 | 10 |  | 14 |
| H9 | 2 |  |  | 5 |  | 7 |

**4.2 Hypothesis votes × era of last activity**

| hypothesis \ era | E0_pre_R2 | E1_R2_latency | E2_post_latency | no session | total |
|---|---|---|---|---|---|
| H1 | 22 |  | 2 |  | 24 |
| H10 | 5 | 1 | 4 | 1 | 11 |
| H2 | 15 | 2 | 7 |  | 24 |
| H3 | 1 |  |  | 29 | 30 |
| H4 | 6 | 1 | 2 |  | 9 |
| H5 | 13 | 1 | 1 | 8 | 23 |
| H6 | 1 | 1 | 1 | 11 | 14 |
| H7 | 6 | 1 |  |  | 7 |
| H8 | 9 | 3 | 2 |  | 14 |
| H9 | 6 |  | 1 |  | 7 |

**4.2 overall_outcome × era (sessions)**

| outcome \ era | E0_pre_R2 | E1_R2_latency | E2_post_latency | total |
|---|---|---|---|---|
| evaluation_only | 4 | 3 | 3 | 10 |
| job_done | 27 | 1 | 9 | 37 |
| job_failed | 14 |  | 1 | 15 |
| job_partly_done | 17 | 5 | 5 | 27 |
| unclear | 4 |  |  | 4 |

**4.2 leave_reason × era (sessions)**

| leave reason \ era | E0_pre_R2 | E1_R2_latency | E2_post_latency | total |
|---|---|---|---|---|
| blocked_by_missing_answer | 6 |  |  | 6 |
| blocked_by_wall |  |  | 1 | 1 |
| evaluation_only | 5 | 3 | 3 | 11 |
| gave_up_after_failure | 21 |  | 2 | 23 |
| job_done_partial | 5 | 3 | 3 | 11 |
| job_done_satisfied | 25 | 1 | 9 | 35 |
| unclear | 4 | 2 |  | 6 |

**4.2 leave_reason_final × segment (users)**

| leave reason \ segment | hit_wall | light_use_no_wall | paid | real_work_no_wall | uploaded_never_chatted | total |
|---|---|---|---|---|---|---|
| blocked_by_missing_answer |  | 4 |  | 1 |  | 5 |
| blocked_by_parse_error | 1 |  |  | 1 | 6 | 8 |
| blocked_by_wall | 10 |  |  |  |  | 10 |
| evaluation_only |  | 5 |  |  |  | 5 |
| gave_up_after_failure | 6 | 4 | 1 | 8 |  | 19 |
| job_done_partial | 5 |  |  | 3 |  | 8 |
| job_done_satisfied | 8 | 4 |  | 9 |  | 21 |
| unclear | 7 | 1 |  | 3 | 10 | 21 |

**4.2 May's churn reasons: now (coded users) vs May (47 users)**

| reason | now | May |
|---|---|---|
| B1_large_doc_coverage | 3 | ~10-12 |
| B2_page_or_citation_failure | 8 | ~6 |
| B3_export_refused | 3 | ~5 |
| B4_overrigid_persona | 8 | ~5 |
| B5_scanned_or_nonlatin_garbled | 6 | 2+ |
| B6_no_reply_reliability | 8 | 4 |
| B7_upload_or_ui_confusion | 13 | 2 |
| B8_done_once_no_hook | 26 | ~15-18 |
| none | 22 |  |

**4.3 dominant_failure × doc_size_band (sessions)**

| failure \ size | l | m | s | unknown | xl | xs | total |
|---|---|---|---|---|---|---|---|
| citation_wrong_or_missing |  |  | 1 | 1 |  |  | 2 |
| export_or_format_refused |  |  | 1 |  |  |  | 1 |
| garbled_or_ocr_text |  |  |  |  |  | 2 | 2 |
| generation_refused |  |  |  |  |  | 1 | 1 |
| incorrect_or_hallucinated |  |  | 1 |  |  | 1 | 2 |
| jargon_or_confusing_ui |  |  |  | 1 |  |  | 1 |
| missing_answer_no_reply | 4 |  | 2 | 1 |  | 1 | 8 |
| none | 8 | 10 | 10 | 10 | 2 | 9 | 49 |
| not_found_unverifiable | 2 | 2 | 2 |  |  | 1 | 7 |
| other |  |  | 1 |  |  |  | 1 |
| refusal_injection_false_positive |  | 1 |  |  |  |  | 1 |
| refusal_overrigid_scope | 1 |  | 1 | 1 |  | 4 | 7 |
| retrieval_miss_asserted |  | 1 | 1 |  | 1 |  | 3 |
| table_or_number_extraction_failed |  | 1 | 1 |  |  |  | 2 |
| truncated_or_cut_off |  |  |  |  |  | 1 | 1 |
| whole_doc_coverage_incomplete |  |  |  |  | 4 | 1 | 5 |

**4.3 failure × doc_type_coded (turns)**

| failure \ doc type | demo | docx | pdf_garbled | pdf_scanned | pdf_text | pptx | txt | unknown | xlsx | total |
|---|---|---|---|---|---|---|---|---|---|---|
| citation_wrong_or_missing |  |  |  |  | 5 |  |  | 3 |  | 8 |
| export_or_format_refused |  | 1 |  |  | 3 |  |  |  | 1 | 5 |
| garbled_or_ocr_text |  |  | 4 |  |  |  |  |  |  | 4 |
| generation_refused |  |  |  |  | 4 |  |  |  | 2 | 6 |
| incorrect_or_hallucinated |  | 1 | 1 |  | 13 |  |  |  |  | 15 |
| jargon_or_confusing_ui | 1 |  |  |  | 8 |  |  |  |  | 9 |
| missing_answer_no_reply | 2 | 1 | 2 |  | 20 |  | 2 |  |  | 27 |
| not_found_unverifiable |  |  |  | 1 | 28 |  |  | 2 |  | 31 |
| other |  |  |  |  | 11 |  |  |  |  | 11 |
| page_or_item_lookup_failed |  |  |  |  | 10 |  |  |  |  | 10 |
| refusal_injection_false_positive |  |  |  |  |  |  | 1 |  |  | 1 |
| refusal_overrigid_scope |  | 2 |  | 2 | 7 |  |  |  |  | 11 |
| retrieval_miss_asserted |  |  | 2 |  | 13 | 1 |  |  |  | 16 |
| table_or_number_extraction_failed |  |  |  | 1 | 3 |  |  |  |  | 4 |
| truncated_or_cut_off |  |  |  |  | 6 | 1 |  |  |  | 7 |
| whole_doc_coverage_incomplete |  |  | 5 |  | 13 | 1 | 2 |  |  | 21 |
| wrong_answer_language |  |  |  |  | 3 |  | 1 |  |  | 4 |

**4.3 failure × cross_lingual (turns)**

| failure \ cross-lingual | False | True | total |
|---|---|---|---|
| citation_wrong_or_missing | 7 | 1 | 8 |
| export_or_format_refused | 5 |  | 5 |
| garbled_or_ocr_text | 4 |  | 4 |
| generation_refused | 4 | 2 | 6 |
| incorrect_or_hallucinated | 13 | 2 | 15 |
| jargon_or_confusing_ui | 5 | 4 | 9 |
| missing_answer_no_reply | 18 | 9 | 27 |
| not_found_unverifiable | 26 | 5 | 31 |
| other | 10 | 1 | 11 |
| page_or_item_lookup_failed | 2 | 8 | 10 |
| refusal_injection_false_positive |  | 1 | 1 |
| refusal_overrigid_scope | 8 | 3 | 11 |
| retrieval_miss_asserted | 7 | 9 | 16 |
| table_or_number_extraction_failed | 3 | 1 | 4 |
| truncated_or_cut_off | 7 |  | 7 |
| whole_doc_coverage_incomplete | 18 | 3 | 21 |
| wrong_answer_language | 3 | 1 | 4 |

**4.3 failure × era (turns)**

| failure \ era | E0_pre_R2 | E1_R2_latency | E2_post_latency | total |
|---|---|---|---|---|
| citation_wrong_or_missing | 6 |  | 2 | 8 |
| export_or_format_refused | 4 | 1 |  | 5 |
| garbled_or_ocr_text | 4 |  |  | 4 |
| generation_refused | 6 |  |  | 6 |
| incorrect_or_hallucinated | 10 | 2 | 3 | 15 |
| jargon_or_confusing_ui | 9 |  |  | 9 |
| missing_answer_no_reply | 27 |  |  | 27 |
| not_found_unverifiable | 19 |  | 12 | 31 |
| other | 5 | 6 |  | 11 |
| page_or_item_lookup_failed | 10 |  |  | 10 |
| refusal_injection_false_positive |  | 1 |  | 1 |
| refusal_overrigid_scope | 6 | 1 | 4 | 11 |
| retrieval_miss_asserted | 15 | 1 |  | 16 |
| table_or_number_extraction_failed | 3 |  | 1 | 4 |
| truncated_or_cut_off | 1 | 5 | 1 | 7 |
| whole_doc_coverage_incomplete | 16 | 1 | 4 | 21 |
| wrong_answer_language | 1 | 3 |  | 4 |

**4.3 needs_unmet × persona (users)**

| need \ persona | academic_staff | business_professional | educator | evaluator_or_competitor | finance_professional | general_consumer | graduate_researcher | legal_professional | student | unknown | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| concept_explanation |  |  |  |  |  |  |  |  | 2 |  | 2 |
| export_or_download | 1 | 1 | 1 |  | 1 |  |  |  | 3 |  | 7 |
| fast_reliable_answer | 1 | 1 |  | 1 |  | 1 | 1 | 1 | 5 | 3 | 14 |
| large_document_coverage | 1 |  |  |  |  |  |  |  | 3 | 1 | 5 |
| multi_document |  | 1 |  |  |  | 1 |  |  |  |  | 2 |
| non_english_or_cross_lingual |  |  |  |  |  | 1 |  |  |  |  | 1 |
| other |  | 1 |  |  |  |  |  |  |  |  | 1 |
| outside_document_knowledge | 1 |  |  |  |  | 1 | 1 |  | 5 |  | 8 |
| page_cited_answers |  |  |  |  |  |  | 1 |  | 1 |  | 2 |
| page_or_item_navigation |  |  |  |  |  |  |  |  | 5 |  | 5 |
| scanned_or_garbled_text |  |  |  |  |  | 1 |  |  | 1 | 3 | 5 |
| section_summary |  |  |  |  |  |  | 1 |  |  |  | 1 |
| table_or_number_extraction |  |  | 1 |  | 1 |  |  |  | 2 | 1 | 5 |
| verbatim_quotes_with_pages |  |  |  |  |  |  | 1 |  | 3 |  | 4 |
| whole_document_summary | 1 |  |  |  |  | 1 |  |  | 1 | 1 | 4 |
| writing_or_drafting | 1 |  | 1 |  |  |  | 1 |  | 3 |  | 6 |

**4.3 needs_unmet × jtbd_primary (users)**

| need \ jtbd | data_or_table_extraction | exam_study | finance_or_business_analysis | legal_contract_review | literature_reading | product_evaluation | technical_or_manual_lookup | thesis_or_paper_writing | unclear | writing_generation | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| concept_explanation |  | 2 |  |  |  |  |  |  |  |  | 2 |
| export_or_download | 1 | 1 | 1 |  |  |  |  | 1 |  | 3 | 7 |
| fast_reliable_answer | 2 | 3 |  | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 14 |
| large_document_coverage |  | 3 |  |  |  |  | 1 |  |  | 1 | 5 |
| multi_document | 1 |  |  |  |  | 1 |  |  |  |  | 2 |
| non_english_or_cross_lingual |  |  |  |  |  |  | 1 |  |  |  | 1 |
| other |  |  |  |  |  | 1 |  |  |  |  | 1 |
| outside_document_knowledge |  | 2 |  |  | 1 |  | 1 | 1 |  | 3 | 8 |
| page_cited_answers |  |  |  |  |  |  |  | 2 |  |  | 2 |
| page_or_item_navigation |  | 4 |  |  | 1 |  |  |  |  |  | 5 |
| scanned_or_garbled_text |  | 1 |  |  |  | 1 |  |  | 3 |  | 5 |
| section_summary |  |  |  |  |  |  |  | 1 |  |  | 1 |
| table_or_number_extraction | 1 | 1 | 1 |  |  |  | 1 |  | 1 |  | 5 |
| verbatim_quotes_with_pages |  | 1 |  |  |  |  |  | 2 |  | 1 | 4 |
| whole_document_summary | 1 | 1 |  |  |  |  | 1 |  |  | 1 | 4 |
| writing_or_drafting |  | 1 |  |  |  |  |  |  |  | 5 | 6 |

**4.3 Needs met vs unmet (users)**

| need | met | unmet |
|---|---|---|
| whole_document_summary | 19 | 4 |
| concept_explanation | 17 | 2 |
| page_cited_answers | 14 | 2 |
| fast_reliable_answer | 0 | 14 |
| writing_or_drafting | 5 | 6 |
| page_or_item_navigation | 3 | 5 |
| outside_document_knowledge | 0 | 8 |
| export_or_download | 0 | 7 |
| section_summary | 6 | 1 |
| table_or_number_extraction | 2 | 5 |
| verbatim_quotes_with_pages | 2 | 4 |
| non_english_or_cross_lingual | 4 | 1 |
| scanned_or_garbled_text | 0 | 5 |
| large_document_coverage | 0 | 5 |
| other | 2 | 1 |
| multi_document | 1 | 2 |
| translation | 2 | 0 |

**4.3 Capability requests — discoverability gap vs capability gap**

| request | exists today | turns | users |
|---|---|---|---|
| larger_file | exists | 0 | 8 |
| write_or_draft | refused | 16 | 7 |
| outside_knowledge_or_web | missing | 10 | 7 |
| verbatim_quotes_with_pages | exists | 14 | 7 |
| summarize_whole_document | partly | 9 | 6 |
| ocr_scanned | exists | 0 | 4 |
| other | n/a | 5 | 3 |
| export_pdf_docx | exists | 2 | 3 |
| download_answer | exists | 2 | 2 |
| citation_formatting | partly | 3 | 2 |
| export_excel_csv | exists | 3 | 2 |
| table_extraction | exists | 2 | 2 |
| page_navigation | exists | 8 | 2 |
| multi_document_chat | exists | 5 | 2 |
| figures_or_images | missing | 2 | 1 |
| more_free_quota | n/a | 0 | 1 |
| integration_drive_zotero | missing | 1 | 1 |
| translate_answer | exists | 1 | 1 |
| longer_or_more_detailed | exists | 1 | 1 |
| mobile_or_ui | n/a | 3 | 1 |

**4.3 qtype — all turns vs turns of citation-clicking users (H10: none of them has a quote_* event)**

| qtype | all turns | citation clickers |
|---|---|---|
| summarize_whole | 47 | 10 |
| generate_or_write | 45 | 3 |
| factual_lookup | 43 | 16 |
| analyze_or_evaluate | 36 | 7 |
| verbatim_quote | 23 | 12 |
| summarize_part | 21 | 2 |
| explain_or_define | 20 | 7 |
| locate_page_or_item | 16 | 7 |
| complaint_or_correction | 14 | 4 |
| extract_table_or_numbers | 12 | 1 |
| meta_product | 11 | 0 |
| list_or_enumerate | 8 | 4 |
| followup_clarify | 6 | 0 |
| export_or_format | 6 | 2 |
| translate | 2 | 1 |
| greeting_or_test | 1 | 0 |

**4.4 satisfied_first_answer (first session) × returned_later_day (users)**

| first answer \ returned | False | True | total |
|---|---|---|---|
| missing | 5 | 1 | 6 |
| no | 9 |  | 9 |
| partial | 9 | 4 | 13 |
| unknown | 17 |  | 17 |
| yes | 17 | 5 | 22 |

**4.4 overall_outcome of the last session × returned_later_day (users)**

| outcome \ returned | False | True | total |
|---|---|---|---|
| evaluation_only | 5 | 1 | 6 |
| job_done | 19 | 3 | 22 |
| job_failed | 14 | 1 | 15 |
| job_partly_done | 16 | 4 | 20 |
| unclear | 3 | 1 | 4 |

**4.4 jtbd_recurrence × returned_later_day (users)**

| recurrence \ returned | False | True | total |
|---|---|---|---|
| one_off | 6 | 2 | 8 |
| recurring | 21 | 8 | 29 |
| unclear | 30 |  | 30 |

**4.4 jtbd_primary × returned_later_day (users)**

| jtbd \ returned | False | True | total |
|---|---|---|---|
| data_or_table_extraction | 3 | 1 | 4 |
| exam_study | 8 | 3 | 11 |
| finance_or_business_analysis | 2 |  | 2 |
| legal_contract_review | 1 | 1 | 2 |
| literature_reading | 11 | 1 | 12 |
| product_evaluation | 7 |  | 7 |
| technical_or_manual_lookup | 5 | 1 | 6 |
| thesis_or_paper_writing | 6 | 3 | 9 |
| unclear | 6 |  | 6 |
| writing_generation | 8 |  | 8 |

**4.4 first_question_specificity × user-message band (sessions)**

| first question \ messages | 1 | 2 | 3-5 | 6+ | total |
|---|---|---|---|---|---|
| generic | 16 | 10 | 13 | 7 | 46 |
| specific | 21 | 11 | 8 | 5 | 45 |
| test |  |  |  | 2 | 2 |

**4.4 Last-turn outcome of every session (how much of 'episodic' is unread)**

| last turn | sessions |
|---|---|
| unknown_terminal | 58 |
| unsatisfied | 13 |
| satisfied | 13 |
| missing_answer | 7 |
| partial | 2 |

**4.4 The owner's cell (own document · cited · < 1 day; 16 users) by coded final leave reason — decides Read A/B**

| leave_reason_final | confidence | users |
|---|---|---|
| job_done_satisfied | high | 6 |
| gave_up_after_failure | medium | 3 |
| job_done_satisfied | medium | 3 |
| blocked_by_wall | low | 1 |
| gave_up_after_failure | high | 1 |
| job_done_partial | medium | 1 |
| blocked_by_wall | medium | 1 |

**4.5 wall reason × reaction (coded user walls)**

| reason \ reaction | checkout_abandoned | continued_same_session | left_later | left_within_10min | paid | upgrade_click_no_checkout | worked_around | total |
|---|---|---|---|---|---|---|---|---|
| INSUFFICIENT_CREDITS |  |  |  |  |  | 2 |  | 2 |
| activated_free_user |  | 29 | 16 | 26 |  | 1 |  | 72 |
| file_size | 1 |  |  | 7 | 1 | 2 | 2 | 13 |
| session_limit |  |  |  |  |  | 3 | 7 | 10 |
| upload_limit |  |  | 1 | 3 |  |  | 4 | 8 |

**4.5 wall reason × demo flag**

| reason \ is_demo | None | True | total |
|---|---|---|---|
| INSUFFICIENT_CREDITS | 2 |  | 2 |
| activated_free_user | 72 |  | 72 |
| file_size | 13 |  | 13 |
| session_limit |  | 10 | 10 |
| upload_limit | 8 |  | 8 |

**4.5 wtp level × last-session outcome (users)**

| wtp \ outcome | evaluation_only | job_done | job_failed | job_partly_done | no session | unclear | total |
|---|---|---|---|---|---|---|---|
| checkout_started |  |  |  |  | 1 |  | 1 |
| none | 5 | 14 | 12 | 10 | 24 | 3 | 68 |
| nudge_only |  | 1 | 2 | 4 | 2 | 1 | 10 |
| paid_then_refunded |  |  | 1 |  |  |  | 1 |
| upgrade_click | 1 | 7 |  | 6 | 3 |  | 17 |

**4.5 Price, units and alternatives**

| measure | value |
|---|---|
| users who mentioned price | 1 |
| value units mentioned (sessions) | {'pages': 11, 'documents': 3, 'exam_items': 2, 'chapters': 2, 'file_size': 1} |
| alternatives named (registered + anonymous sessions) | {'other': 1} |

**4.5 Replay candidates (turns) × era**

| era \ replayable | False | True | total |
|---|---|---|---|
| E0_pre_R2 | 5 | 68 | 73 |
| E1_R2_latency |  | 11 | 11 |
| E2_post_latency | 1 | 19 | 20 |

**4.6 intent × demo document (anonymous sessions)**

| intent \ document | None | alphabet-earnings | attention-paper | court-filing | nda-contract | nvidia-10k | total |
|---|---|---|---|---|---|---|---|
| asks_about_own_document |  | 2 | 3 |  |  |  | 5 |
| greeting_or_empty |  | 1 |  |  |  |  | 1 |
| offtopic_general |  | 2 | 1 |  |  |  | 3 |
| prompt_injection_or_abuse |  | 1 |  |  |  |  | 1 |
| real_question_on_demo | 4 | 69 | 58 | 30 | 6 | 3 | 170 |
| testing_capability |  | 1 | 1 |  |  |  | 2 |

**4.6 Anonymous demo**

| measure | value |
|---|---|
| sessions | 182 |
| end at one message | 152 |
| first-turn outcome | {'partial': 7, 'unsatisfied': 11, 'unknown_terminal': 134, 'missing_answer': 11, 'satisfied': 19} |
| own_doc_wish | 5 |
| prompt injection | 1 |
| failures (turns) | {'not_found_unverifiable': 3, 'wrong_answer_language': 4, 'whole_doc_coverage_incomplete': 1, 'missing_answer_no_reply': 15, 'refusal_overrigid_scope': 1, 'generation_refused': 3, 'incorrect_or_hallucinated': 4, 'jargon_or_confusing_ui': 2, 'page_or_item_lookup_failed': 2} |

**4.7 Cost to serve (USD; upper bound = peak cache-miss, lower bound = off-peak cache-hit)**

| item | upper | lower |
|---|---|---|
| all registered non-owner users, lifetime LLM | 1.57 | 0.43 |
| per active user | 0.022 | 0.006 |
| per answer (all models) | 0.0032 | 0.0009 |
| anonymous demo at Flash price (unbilled) | 0.61 |  |
| embeddings for all own documents (pages × 600 tokens) | 0.154 |  |
| pages OCR'd (self-hosted, no per-page price) | 524 |  |
| pages in error documents (sunk parse cost) | 2190 |  |

**4.7 LLM cost by segment and by last-session outcome (upper bound)**

| group | users | USD |
|---|---|---|
| segment hit_wall | 26 | 0.709 |
| segment light_use_no_wall | 15 | 0.101 |
| segment never_started | 2 | 0.004 |
| segment paid | 1 | 0.045 |
| segment real_work_no_wall | 25 | 0.706 |
| segment uploaded_never_chatted | 2 | 0.006 |
| outcome evaluation_only | 6 | 0.104 |
| outcome job_done | 22 | 0.320 |
| outcome job_failed | 12 | 0.115 |
| outcome job_partly_done | 20 | 0.976 |
| outcome not coded | 7 | 0.035 |
| outcome unclear | 4 | 0.019 |

**4.7 Per model: credits and USD per answer, LLM margin at each credit price**

| model | calls | credits/answer | USD/answer (upper) | USD/credit | margin at Plus | margin at Pro | margin at Boost |
|---|---|---|---|---|---|---|---|
| deepseek/deepseek-v3.2 | 181 | 4.0 | 0.0016 | 0.00039 | 88% | 82% | 95% |
| mistralai/mistral-medium-3.1 | 24 | 20.8 | 0.0042 | 0.00020 | 94% | 91% | 97% |
| deepseek-v4-flash | 285 | 11.2 | 0.0037 | 0.00033 | 90% | 85% | 96% |
| deepseek-v4-pro | 8 | 25.4 | 0.0168 | 0.00066 | 80% | 70% | 92% |

**4.7 Capability-upgrade cost per answer (upper bound) against what a Flash answer earns on Plus (~11.2 credits)**

| scenario | USD per answer | Plus revenue per Flash answer |
|---|---|---|
| today (Flash, 8.2k in / 1.0k out) | 0.0037 | 0.037 |
| (a) 4× retrieval context on Flash | 0.0110 |  |
| (b) whole-document map-reduce over a p90 document (289 pages) | 0.0628 |  |
| (c) Pro for hard question types (observed share 32%) | 0.0078 |  |

Prices: DeepSeek https://api-docs.deepseek.com/quick_start/pricing and OpenRouter https://openrouter.ai/api/v1/models (+ /api/v1/embeddings/models), accessed 2026-09-22. Replay list written outside the repo (104 turns).
