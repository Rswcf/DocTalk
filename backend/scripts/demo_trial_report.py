"""Grouped first-party demo visits. Run: railway ssh -s backend python -m scripts.demo_trial_report
Use --qa for marked tests only. A visit lasts one page load plus client-side navigation.
"""
import argparse
import json

from sqlalchemy import text

from app.models.sync_database import sync_engine

REPORT = text("""
WITH visits AS (
    SELECT metadata_json->>'visit' AS visit, source, metadata_json->>'landing_path' AS landing
    FROM product_events
    WHERE event_name = 'demo_trial' AND reason = 'entry'
      AND created_at >= now() - make_interval(days => :days)
      AND (metadata_json->>'qa')::boolean = :qa
), attempts AS (
    SELECT v.visit, v.source, v.landing, e.metadata_json->>'attempt' AS attempt,
           bool_or(e.reason = 'question') AS q, bool_or(e.reason = 'answer') AS a,
           bool_or(e.reason = 'citation') AS c, bool_or(e.reason = 'source') AS s
    FROM visits v LEFT JOIN product_events e ON e.event_name = 'demo_trial'
      AND e.metadata_json->>'visit' = v.visit AND e.reason <> 'entry'
      AND e.created_at >= now() - make_interval(days => :days)
    GROUP BY 1, 2, 3, 4
)
SELECT source, landing, count(DISTINCT visit) AS entered,
       count(DISTINCT visit) FILTER (WHERE q) AS asked,
       count(DISTINCT visit) FILTER (WHERE q AND a) AS answered,
       count(DISTINCT visit) FILTER (WHERE q AND a AND c) AS clicked,
       count(DISTINCT visit) FILTER (WHERE q AND a AND c AND s) AS effective
FROM attempts GROUP BY source, landing ORDER BY effective DESC, entered DESC, source, landing
""")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qa", action="store_true")
    parser.add_argument("--days", type=int, default=28, choices=range(1, 91), metavar="1-90")
    args = parser.parse_args()
    with sync_engine.begin() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY"))
        rows = conn.execute(REPORT, {"qa": args.qa, "days": args.days}).mappings()
        print(json.dumps([dict(r) for r in rows], indent=2))
