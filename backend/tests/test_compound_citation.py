from pathlib import Path
from uuid import uuid4

import pytest

from app.services.chat_service import RefParserFSM, _ChunkInfo, _parse_cited_answer
from app.services.citation_focus_service import focus_sentence
from app.services.parse_service import ParseService

READING = 'The approved acoustic reading for the cobalt sensor was 73.42 decibels.'
SEAL = 'Its verification seal was LUMEN-D1BBCD.'
ANSWER = ("- The approved acoustic reading for the cobalt sensor was **73.42 decibels** [1].\n"
          "- The verification seal identifying that accepted run was **LUMEN-D1BBCD** [1].")


def original():
    pdf = Path(__file__).parent / 'fixtures' / 'citation' / 'Cinder-Harbor-D1BBCD.pdf'
    service = ParseService()
    pages = service.extract_pages(pdf.read_bytes())
    raw, = service.chunk_document(pages)
    assert (len(pages), raw.page_start, raw.page_end) == (3, 1, 3)
    return _ChunkInfo(id=uuid4(), page_start=1, page_end=3, bboxes=raw.bboxes, text=raw.text,
                      page_texts={p.page_number: p.raw_text for p in pages},
                      page_headings={e.page_start: e.text for e in service.extract_elements(pages)
                                     if e.element_type == "heading"})


@pytest.mark.parametrize('answer', [ANSWER, ANSWER.replace('[1].\n- The', '[1], and the')])
def test_production_record_same_chunk_two_independent_click_targets(answer):
    chunk = original()
    fsm = RefParserFSM({1: chunk})
    events = [event for char in answer for event in fsm.feed(char)]
    cites = [e['data'] for e in events if e['event'] == 'citation']
    assert [(c['focus_snippet'], c['page'], c['page_end']) for c in cites] == [
        (READING, 3, 3), (SEAL, 3, 3)]
    assert cites[0]['offset'] < cites[1]['offset']
    assert all(c['text_snippet'] == c['focus_snippet'] for c in cites)
    assert _parse_cited_answer(answer, {1: chunk})[1] == cites


def test_two_pages_same_ref_and_repeated_wording():
    a, b = 'The inbound tray was marked VERA-128.', 'The outbound tray was marked VERA-129.'
    chunk = _ChunkInfo(id=uuid4(), page_start=1, page_end=2, bboxes=[],
                       text=a+' '+b, page_texts={1:a, 2:b})
    _, cites = _parse_cited_answer('Inbound tray: VERA-128 [1]; outbound tray: VERA-129 [1]', {1:chunk})
    assert [(c['page'], c['focus_snippet']) for c in cites] == [(1,a), (2,b)]
    chunk.page_texts[1] += ' '+b
    _, cites = _parse_cited_answer('Outbound tray: VERA-129 [1]', {1:chunk})
    assert (cites[0]['page'], cites[0]['page_end']) == (1,2)


@pytest.mark.parametrize('claim', ['The verification seal was LUMEN-D1BBCD-X',
                                  'The verification seal was not LUMEN-D1BBCD',
                                  'The verification seal was LUMEN-D1BBCD and the reading was 48'])
def test_partial_contradictory_or_extra_value_never_selected(claim):
    assert focus_sentence(original().text, claim) is None


def test_retired_identifier_does_not_break_tie_for_current_run():
    text = ("The retired verification seal was LUMEN-D1BBCD. "
            "The verification seal identifies the current run in the register.")
    assert focus_sentence(text, "The verification seal identifying the current run was LUMEN-D1BBCD.") is None


def test_identical_heading_word_elsewhere_does_not_strip_qualifier():
    body = 'Recommended threshold for shipment is 14 days.'
    focus = focus_sentence('Limits apply overseas. '+body+' The next shipment is ready.', body,
                           page_texts={1:'Recommended\nLimits apply overseas.\n'+body},
                           page_headings={1:'Recommended'})
    assert focus == body
