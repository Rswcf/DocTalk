from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import credits, document_diffs, extractions, question_templates, quotes
from app.core.deps import require_auth
from app.services.question_template_service import estimated_template_cost
from app.services.workflow_costs import job_predebit


@pytest.mark.asyncio
async def test_workflow_estimates_require_auth_and_match_actual_predebit_policies():
    app = FastAPI()
    app.include_router(credits.router)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/credits/workflow-estimates")).status_code == 401
        app.dependency_overrides[require_auth] = lambda: SimpleNamespace(credits_balance=4321)
        response = await client.get("/api/credits/workflow-estimates")
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "private, no-store"
        cost = response.json()
        assert cost["balance"] == 4321
        assert cost["quote_search"] == quotes.QUOTE_SEARCH_PREDEBIT_CREDITS
        assert cost["document_diff"] == document_diffs.DOCUMENT_DIFF_PREDEBIT_CREDITS
        assert cost["extraction"] == extractions.EXTRACTION_PREDEBIT_CREDITS
        assert cost["template_per_cell"] * 6 == estimated_template_cost(2, 3)


@pytest.mark.parametrize("raw,expected", [(None, None), ({}, None), ({"pre_debited": 30}, 30),
    ({"pre_debited": -1}, None), ({"pre_debited": True}, None), ({"pre_debited": "30"}, None)])
def test_legacy_jobs_do_not_get_an_invented_reservation(raw, expected):
    assert job_predebit(SimpleNamespace(metadata_json=raw)) == expected


def test_existing_run_responses_keep_the_recorded_reservation():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    job = SimpleNamespace(id="fixture", document_id=None, collection_id=None, job_type="batch_template",
        status="succeeded", input_scope={}, cost_credits=2, metadata_json={"pre_debited": 30},
        error_code=None, error_message=None, created_at=now, updated_at=now, completed_at=now)
    for response in (question_templates._run_response(job), document_diffs._run_response(job)):
        assert response.pre_debited == 30
        assert response.cost_credits == 2
