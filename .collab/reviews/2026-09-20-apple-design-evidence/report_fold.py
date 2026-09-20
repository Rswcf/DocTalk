"""Turn Jev's per-route judgements into a ranked remediation table. Policy lives here, not in Jev."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
rows = json.loads((HERE / "jev-fold-answers.json").read_text())

def s(r, k):   return r["raw"][k]["score"]
def n(r, k):   return r["raw"][k]["noul"]

out = []
for r in rows:
    grammar = s(r, "headline_apple_grammar")        # 0..4, higher = closer to Apple
    weight  = s(r, "acquisition_weight")            # 0..4, higher = matters more commercially
    compete = n(r, "competing_actions")             # 0..1, higher = worse
    prose   = n(r, "prose_before_product")          # 0..1, higher = worse
    # Defect load on a 0..1 scale, then weighted by how much the page matters.
    defect = (1 - grammar / 4) * 0.45 + compete * 0.25 + prose * 0.30
    out.append({
        "url": r["url"], "headline": r["headline"],
        "grammar": round(grammar, 2), "weight": round(weight, 2),
        "compete": round(compete, 2), "prose": round(prose, 2),
        "defect": round(defect, 3),
        "priority": round(defect * (weight / 4), 3),
    })

out.sort(key=lambda x: -x["priority"])
w = max(len(o["url"]) for o in out)
print(f"{'route':<{w}}  prio  defect  hdln/4  acq/4  compete  prose   headline")
print("-" * (w + 74))
for o in out:
    h = (o["headline"] or "")[:44]
    print(f"{o['url']:<{w}}  {o['priority']:.2f}  {o['defect']:.2f}    "
          f"{o['grammar']:.1f}     {o['weight']:.1f}    {o['compete']:.2f}     {o['prose']:.2f}   {h}")

print()
n_all = len(out)
print(f"routes judged: {n_all}")
print(f"headline grammar mean: {sum(o['grammar'] for o in out)/n_all:.2f} / 4")
print(f"routes with competing actions >0.5 : {sum(1 for o in out if o['compete']>0.5)}")
print(f"routes with prose-before-product >0.5 : {sum(1 for o in out if o['prose']>0.5)}")
print(f"routes scoring <2 on headline grammar : {sum(1 for o in out if o['grammar']<2)}")
(HERE / "fold-ranked.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
