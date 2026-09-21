"""Phase 2a: give localized marketing pages dedicated SEO keys, so a headline rewrite
cannot silently change a page's <title>/<meta description>.

Every new key is SEEDED from the value the page renders today, per locale, so the
rendered metadata must come out byte-identical (proved separately by diffing builds).
Copy rule mirrors server t(): locale value -> English value -> key string. A locale
that lacks the hero key also gets no meta key, so both fall back to English alike.
"""
import io, json, re, collections
from pathlib import Path
FE = Path(".")
LOCALES = ["en","zh","ja","ko","es","de","fr","pt","it","ar","hi"]
pages = sorted(FE.glob("src/app/[[]locale]/**/page.tsx"))
mapping = {}                       # heroKey -> metaKey
callsites = []
for p in pages:
    s = p.read_text(encoding="utf-8")
    if "createMarketingLocalePage" not in s: continue
    tk = re.search(r"titleKey: '([^']+)'", s).group(1)
    dk = re.search(r"descKey: '([^']+)'", s).group(1)
    ns = tk.split(".")[0]
    assert dk.split(".")[0] == ns, f"{p}: title/desc namespaces differ ({tk}, {dk})"
    mapping[tk] = f"{ns}.metaTitle"; mapping[dk] = f"{ns}.metaDescription"
    callsites.append((p, tk, dk, ns))
# The landing's generateMetadata reads these two directly.
mapping["landing.headline"] = "landing.metaTitle"
mapping["landing.description"] = "landing.metaDescription"
assert len(callsites) == 32, f"expected 32 helper call sites, got {len(callsites)}"
assert len(set(mapping.values())) == len(mapping), "two hero keys map to one meta key"

data = {L: json.load(io.open(f"src/i18n/locales/{L}.json", encoding="utf-8"),
                     object_pairs_hook=collections.OrderedDict) for L in LOCALES}
missing_en = [k for k in mapping if k not in data["en"]]
assert not missing_en, f"English lacks hero keys (t() would render the key name): {missing_en}"
clash = [(L, m) for L in LOCALES for m in mapping.values() if m in data[L]]
assert not clash, f"meta keys already exist: {clash[:5]}"

added = collections.Counter()
for L in LOCALES:
    items = list(data[L].items())
    out = []
    for k, v in items:
        out.append((k, v))
        if k in mapping:                      # seed only where the hero key exists
            out.append((mapping[k], v)); added[L] += 1
    d = collections.OrderedDict(out)
    assert not any(isinstance(v, dict) for v in d.values()), f"{L}: nested key"
    io.open(f"src/i18n/locales/{L}.json", "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")

for p, tk, dk, ns in callsites:
    s = p.read_text(encoding="utf-8")
    s = s.replace(f"titleKey: '{tk}'", f"metaTitleKey: '{ns}.metaTitle'", 1)
    s = s.replace(f"descKey: '{dk}'", f"metaDescKey: '{ns}.metaDescription'", 1)
    p.write_text(s, encoding="utf-8")

lp = FE / "src/app/[locale]/page.tsx"; s = lp.read_text(encoding="utf-8")
o1 = "const title = t('landing.headline').replace(/\\s*\\n\\s*/g, ' ').trim();"
o2 = "const description = t('landing.description');"
assert s.count(o1) == 1 and s.count(o2) == 1, "landing generateMetadata anchors not found"
s = s.replace(o1, "const title = t('landing.metaTitle').replace(/\\s*\\n\\s*/g, ' ').trim();", 1)
s = s.replace(o2, "const description = t('landing.metaDescription');", 1)
lp.write_text(s, encoding="utf-8")

print(f"call sites repointed: {len(callsites)} + landing")
print(f"hero->meta pairs: {len(mapping)}  keys added per locale: {dict(added)}")
