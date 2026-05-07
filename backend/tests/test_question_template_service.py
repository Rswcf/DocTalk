from __future__ import annotations

from app.services.question_template_service import (
    MAX_TEMPLATE_QUESTIONS,
    estimated_template_cost,
    normalize_questions,
    render_question_template_csv,
    render_question_template_markdown,
)


def test_normalize_questions_deduplicates_and_caps() -> None:
    raw = ["  What is the term?  ", "What   is   the term?", "", *[f"Q{i}?" for i in range(40)]]

    questions = normalize_questions(raw)

    assert questions[0] == "What is the term?"
    assert len(questions) == MAX_TEMPLATE_QUESTIONS
    assert "" not in questions


def test_estimated_template_cost_scales_by_cells() -> None:
    assert estimated_template_cost(1, 1) == 15
    assert estimated_template_cost(3, 4) == 180


def test_render_question_template_csv_escapes_values() -> None:
    content = render_question_template_csv({
        "answers": [
            {
                "document_filename": "report.pdf",
                "question": "Revenue?",
                "answer": "增长, 12%",
                "source_refs": [1, 2],
            }
        ]
    })

    assert content.startswith("document,question,answer,sources")
    assert '"增长, 12%"' in content
    assert "1 2" in content


def test_render_question_template_markdown_groups_by_document() -> None:
    content = render_question_template_markdown({
        "template": {"name": "Checklist"},
        "answers": [
            {
                "document_filename": "a.pdf",
                "question_index": 0,
                "question": "Q?",
                "answer": "A",
                "source_refs": [1],
            }
        ],
    })

    assert content.startswith("# Checklist")
    assert "## a.pdf" in content
    assert "Sources: [1]" in content
