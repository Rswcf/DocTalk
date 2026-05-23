#!/usr/bin/env python3
"""Fill untranslated locale strings via DeepSeek V4 Pro.

For each non-English locale, finds keys whose value is still identical to the
English value (i.e. untranslated), batch-translates them via the DeepSeek
official API (model `deepseek-v4-pro`, OpenAI-compatible at api.deepseek.com),
validates that curly-brace placeholders are preserved (keeps the English value
on mismatch), and writes the result back into the flat-dotted-key JSON.

Requires env DEEPSEEK_API_KEY. Idempotent: re-running only re-touches keys that
are still identical to English.

Usage: DEEPSEEK_API_KEY=... python3 fill_locale_translations.py [locale ...]
"""
import json, os, re, sys, time, urllib.request, urllib.error
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "i18n", "locales")
API_URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-v4-pro"
BATCH = 20
WORKERS = 6
MAX_TOKENS = 8000
RETRIES = 4

LANG = {
    "es": "Spanish (es-ES)", "it": "Italian", "ja": "Japanese", "ko": "Korean",
    "ar": "Arabic", "hi": "Hindi", "pt": "Portuguese (pt-BR)", "de": "German",
    "fr": "French", "zh": "Chinese (Simplified)",
}
PLACEHOLDER = re.compile(r"\{[^}]+\}")
HAS_LETTER = re.compile(r"[A-Za-z]")


def sys_prompt(lang: str) -> str:
    return (
        f"You are a professional UI localizer for DocTalk, a document Q&A SaaS. "
        f"Translate each English UI string to natural, concise {lang}. Rules: "
        "(1) Preserve every curly-brace placeholder EXACTLY (e.g. {count}, {percent}, "
        "{page}, {plan}, {name}) — never translate, rename, or reorder them. "
        "(2) Keep brand/product/format names unchanged: DocTalk, PDF, DOCX, PPTX, "
        "XLSX, TXT, MD, URL, API, Stripe, Google, Microsoft, Flash, Pro, Plus, OCR. "
        "(3) Keep proper titles of cited works untranslated. (4) Translate values "
        "only, never keys. (5) Use product-UI tone, no trailing spaces. "
        "Return ONLY a valid JSON object mapping each input key to its translation."
    )


def call_api(api_key: str, lang: str, batch: dict) -> dict:
    body = json.dumps({
        "model": MODEL, "temperature": 0.1, "max_tokens": MAX_TOKENS,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": sys_prompt(lang)},
            {"role": "user", "content": json.dumps(batch, ensure_ascii=False)},
        ],
    }).encode()
    last = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(API_URL, data=body, headers={
                "Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=180) as r:
                resp = json.load(r)
            return json.loads(resp["choices"][0]["message"]["content"])
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"API failed after {RETRIES} tries: {last}")


def translate_locale(loc: str, en: dict, api_key: str) -> dict:
    path = os.path.join(LOCALES_DIR, f"{loc}.json")
    data = json.load(open(path), object_pairs_hook=OrderedDict)
    # untranslated = value identical to EN, non-empty, contains a letter
    todo = [k for k, v in data.items()
            if isinstance(v, str) and en.get(k) == v and v.strip() and HAS_LETTER.search(v)]
    if not todo:
        return {"locale": loc, "todo": 0, "translated": 0, "ph_fail": 0}
    batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    results, ph_fail = {}, 0
    lang = LANG[loc]

    def work(keys):
        payload = {k: en[k] for k in keys}
        out = call_api(api_key, lang, payload)
        local = {}
        for k in keys:
            tr = out.get(k)
            if not isinstance(tr, str) or not tr.strip():
                continue  # missing/empty -> leave EN
            if set(PLACEHOLDER.findall(en[k])) != set(PLACEHOLDER.findall(tr)):
                local[k] = ("__PHFAIL__", tr)  # placeholder mismatch -> skip
            else:
                local[k] = ("ok", tr)
        return local

    done = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(work, b): b for b in batches}
        for fut in as_completed(futs):
            try:
                local = fut.result()
            except Exception as e:  # noqa: BLE001
                print(f"  [{loc}] batch error: {e}", flush=True)
                continue
            for k, (status, tr) in local.items():
                if status == "ok":
                    results[k] = tr
                else:
                    nonlocal_ph[0] += 1
            done += 1
            print(f"  [{loc}] batch {done}/{len(batches)} | translated so far {len(results)}", flush=True)

    nonlocal_ph_total = nonlocal_ph[0]
    for k, tr in results.items():
        data[k] = tr
    json.dump(data, open(path, "w"), ensure_ascii=False, indent=2)
    open(path, "a").write("\n")
    return {"locale": loc, "todo": len(todo), "translated": len(results), "ph_fail": nonlocal_ph_total}


# placeholder-fail counter shared via list (closure-mutable)
nonlocal_ph = [0]

if __name__ == "__main__":
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        sys.exit("DEEPSEEK_API_KEY not set")
    en = json.load(open(os.path.join(LOCALES_DIR, "en.json")))
    targets = sys.argv[1:] or list(LANG.keys())
    print(f"=== Filling locales: {targets} ===", flush=True)
    summary = []
    for loc in targets:
        nonlocal_ph[0] = 0
        print(f"--- {loc} ({LANG[loc]}) ---", flush=True)
        summary.append(translate_locale(loc, en, api_key))
    print("\n=== SUMMARY ===", flush=True)
    for s in summary:
        print(f"  {s['locale']}: translated {s['translated']}/{s['todo']} (placeholder-skips {s['ph_fail']})", flush=True)
