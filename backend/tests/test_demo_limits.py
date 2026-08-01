import uuid

from app.api.chat import _demo_message_key, _recent_demo_session_filter
from app.core.rate_limit import InMemoryDemoMessageTracker


def test_demo_message_key_is_scoped_by_document():
    doc_a, doc_b = uuid.uuid4(), uuid.uuid4()
    assert _demo_message_key("1.2.3.4", doc_a) != _demo_message_key("1.2.3.4", doc_b)
    assert _demo_message_key("1.2.3.4", doc_a) == _demo_message_key("1.2.3.4", doc_a)
    assert _demo_message_key("1.2.3.4", doc_a) != _demo_message_key("5.6.7.8", doc_a)


def test_demo_counters_independent_per_document():
    tracker = InMemoryDemoMessageTracker()
    doc_a, doc_b = uuid.uuid4(), uuid.uuid4()
    for _ in range(5):
        tracker.increment(_demo_message_key("1.2.3.4", doc_a))
    assert tracker.get_count(_demo_message_key("1.2.3.4", doc_a)) == 5
    assert tracker.get_count(_demo_message_key("1.2.3.4", doc_b)) == 0


def test_demo_session_window_filters_by_24h():
    clauses = _recent_demo_session_filter(uuid.uuid4())
    sql = " ".join(str(c) for c in clauses)
    assert "created_at" in sql  # lifetime count regression guard


def test_demo_session_window_excludes_authenticated_sessions():
    clauses = _recent_demo_session_filter(uuid.uuid4())
    sql = " ".join(str(c) for c in clauses)
    assert "user_id" in sql  # authed sessions must not count against the anon cap
