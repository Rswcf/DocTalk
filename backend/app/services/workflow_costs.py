"""Initial reservations, shared by workflow billing and user-facing estimates."""
QUOTE_SEARCH_PREDEBIT_CREDITS = 15
QUESTION_TEMPLATE_PREDEBIT_PER_CELL = 15
DOCUMENT_DIFF_PREDEBIT_CREDITS = 60
EXTRACTION_PREDEBIT_CREDITS = 25


def job_predebit(job) -> int | None:
    metadata = getattr(job, "metadata_json", None)
    value = metadata.get("pre_debited") if isinstance(metadata, dict) else None
    return value if type(value) is int and value >= 0 else None
