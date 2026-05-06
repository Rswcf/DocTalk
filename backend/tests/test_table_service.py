from __future__ import annotations

import csv
import io

from app.services.table_service import (
    normalize_table_rows,
    parse_markdown_tables,
    render_table_csv,
)


def test_normalize_table_rows_pads_and_drops_empty_rows() -> None:
    rows = normalize_table_rows([
        ["Header", "Value", ""],
        ["Revenue", "$1,000"],
        ["", "", ""],
    ])

    assert rows == [
        ["Header", "Value", ""],
        ["Revenue", "$1,000", ""],
    ]


def test_parse_markdown_tables_extracts_multiple_rows() -> None:
    tables = parse_markdown_tables(
        """
Intro

| Metric | Value |
| --- | ---: |
| Revenue | $1,000 |
| Growth | 12% |

Outro
"""
    )

    assert tables == [[
        ["Metric", "Value"],
        ["Revenue", "$1,000"],
        ["Growth", "12%"],
    ]]


def test_render_table_csv_round_trips_commas_and_unicode() -> None:
    content = render_table_csv([
        ["指标", "Value"],
        ["Revenue", "$1,000"],
        ["Growth", "同比增长, 12%"],
    ])

    rows = list(csv.reader(io.StringIO(content)))
    assert rows == [
        ["指标", "Value"],
        ["Revenue", "$1,000"],
        ["Growth", "同比增长, 12%"],
    ]
