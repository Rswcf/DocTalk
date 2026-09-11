# HANDOFF — Submit doctalk.site for web-filter categorization

**For:** Codex (computer-use / browser automation), acting on behalf of the site owner.
**Prepared by:** Claude, 2026-09-11. All URLs below were reachability-checked on that date.
**Owner:** Yijie Ma · contact `support@doctalk.site` · sole proprietorship registered in Germany.

---

## 1. Why this matters (read this — it changes how you fill the forms)

`www.doctalk.site` is **uncategorized** in enterprise web-filter databases. Corporate gateways block
uncategorized domains by default. This was observed directly: a KPMG gateway returned
*"Not allowed to browse Miscellaneous or Unknown category"* for the site.

DocTalk's intended customers are **lawyers, financial analysts and consultants** — precisely the
people who browse from managed corporate laptops. So the product is currently unreachable for its own
target market from their work machines, regardless of any product or SEO work.

**Objective:** get `doctalk.site` out of *Unknown/Uncategorized* and into a benign business category
at each vendor below.

---

## 2. Hard constraints — do not violate these

1. **Do not create an account anywhere.** If a vendor requires registration to submit, STOP for that
   vendor, record it as `NEEDS_OWNER_ACCOUNT`, and move on. Do not sign up.
2. **Do not enter any password, payment detail, or government ID.** None of these forms need them.
3. **Use only `support@doctalk.site`** as the contact email. Do not use the owner's personal address.
4. **Do not invent company facts.** Everything you state must come from §5 of this document or from
   the site's own `/imprint`, `/privacy`, `/terms`, `/trust` pages.
5. **Do not solve CAPTCHAs.** If one blocks you, record `NEEDS_HUMAN_CAPTCHA` and move on.
6. **One submission per vendor.** Do not resubmit the same vendor repeatedly — it is counted as abuse
   and can harm the request.
7. If a form asks you to accept terms of service, that is acceptable for these free
   categorization-request tools **only**; nothing here creates a paid or contractual relationship.
   If a form implies otherwise, stop and report it.

---

## 3. The single most important instruction

**Do not merely report "this site is uncategorized". Always request a specific category.**

DocTalk lets signed-in users upload documents. A reviewer skimming the site may file it under
**`File Sharing` / `Personal Storage` / `Cloud Storage`** — categories that corporate gateways block
*by default*. That outcome is **worse than the current state**: the site goes from "blocked because
unknown" to "blocked because classified as file sharing", which is far harder to reverse.

**Always request, in this order of preference:**

1. **Business / Economy**
2. **Computer & Internet Info** / **Information Technology** / **Technology**
3. **Software as a Service (SaaS)** — only if the vendor has this category

**Always explicitly deny the file-sharing framing** using the wording in §5.

---

## 4. Vendors — reachability verified 2026-09-11

| # | Vendor | Entry point | Status when checked |
|---|---|---|---|
| 1 | Symantec / Broadcom (Bluecoat) | `https://sitereview.bluecoat.com/` | 200 |
| 2 | Palo Alto Networks | `https://urlfiltering.paloaltonetworks.com/` | 200 |
| 3 | Zscaler | `https://sitereview.zscaler.com/` | 200 |
| 4 | Fortinet (FortiGuard) | `https://www.fortiguard.com/webfilter` | 200 |
| 5 | Trellix / McAfee | `https://www.trustedsource.org/` (alt: `https://sitelookup.mcafee.com/`) | 200 |
| 6 | Webroot / BrightCloud | `https://www.brightcloud.com/tools/url-ip-lookup.php` | 200 |
| 7 | Cisco Talos | `https://talosintelligence.com/` → Reputation Center | root 200; lookup path returns 403 to scripted clients (bot protection). **Use a real browser.** |
| 8 | Forcepoint | `https://csi.forcepoint.com/` | **Connection failed from the prep machine** — possibly blocked by the very filter this task is about. Try from your environment; if unreachable, record `UNREACHABLE`. |

Vendors 1–7 are the core set. Forcepoint (8) is best-effort.

---

## 5. What to submit

**Domain:** `https://www.doctalk.site` (also submit `doctalk.site` without `www` if the form accepts
only one; if the vendor treats them separately, do both).

**Requested category:** Business/Economy (fallbacks per §3).

**Justification text — use this verbatim, adapting only to field length limits:**

> DocTalk is a B2B SaaS web application for document question-answering with verifiable source
> citations. Users upload a document and ask questions; answers cite the exact source passage.
> It is used by legal, finance and research professionals.
>
> It is NOT a file-sharing, file-hosting, or personal-storage service: uploaded documents are
> processed only for the signed-in user who uploaded them, are never shared publicly, and there is no
> public file distribution, link sharing to anonymous users, or storage-as-a-service offering.
>
> Please categorize as Business/Economy (or Computer & Internet Info / Information Technology).
>
> Company information: https://www.doctalk.site/imprint
> Privacy policy: https://www.doctalk.site/privacy
> Terms of service: https://www.doctalk.site/terms
> Security & trust: https://www.doctalk.site/trust
> Contact: support@doctalk.site

**Short form (for fields under ~250 characters):**

> B2B SaaS for AI document Q&A with source citations, used by legal and finance professionals. Not a
> file-sharing or personal-storage service. Please categorize as Business/Economy. Details:
> https://www.doctalk.site/trust

---

## 6. Procedure per vendor

**Phase A — look up first (read-only, do this for all 8 before submitting anything).**

1. Open the vendor's lookup tool.
2. Enter `doctalk.site`.
3. Record the **current category exactly as shown**, plus any reputation/risk score.
4. Screenshot it.

This matters: if a vendor has *already* classified the site — especially into File Sharing or
anything blocked — that is a different and more urgent problem than being uncategorized, and the
owner needs to know before any further submissions go out.

**Phase B — submit.**

5. Use the vendor's "request a category change" / "dispute" / "suggest category" control.
6. Fill in: URL, requested category (§3), justification (§5), email `support@doctalk.site`.
7. Submit, screenshot the confirmation, record any ticket/reference number.

---

## 7. Report back in this format

One row per vendor:

| Vendor | Current category (before) | Requested | Submitted? | Ticket/ref | Notes |
|---|---|---|---|---|---|

Then list explicitly:
- any vendor recorded `NEEDS_OWNER_ACCOUNT`, `NEEDS_HUMAN_CAPTCHA`, or `UNREACHABLE`;
- **any vendor that already classifies the site as File Sharing / Personal Storage / Cloud Storage or
  anything else likely to be blocked** — flag this at the top of your report, it is the highest-value
  finding available from this task;
- any vendor that states an expected turnaround time.

Save screenshots and paste the table into
`.collab/tasks/2026-09-11-web-filter-categorization-results.md`.

---

## 8. Known issues the owner must fix (NOT your job — just report if a reviewer flags them)

- **`/imprint` has an unfilled placeholder address**: it currently renders
  `[BUSINESS_ADDRESS_LINE1] [PLZ] [CITY]` instead of a real street address, and the VAT ID says
  "will be added after registration with the Finanzamt". Reviewers at these vendors check the imprint
  to judge legitimacy, so this weakens every submission. It is also a German §5 DDG compliance gap.
  **Do not invent an address.** If a form requires a physical address, record
  `NEEDS_OWNER_ADDRESS` and skip that vendor.

---

## 9. Expectations

- Turnaround is typically **2–10 business days**; Palo Alto and Fortinet are usually fastest.
- After a vendor updates its database, corporate gateways still need to pull the new definitions —
  allow a further few days before re-testing from a managed corporate machine.
- The real success test is not the vendor's own lookup page. It is: **can someone on a corporate
  network open `https://www.doctalk.site`?** Re-test that after ~2 weeks.
