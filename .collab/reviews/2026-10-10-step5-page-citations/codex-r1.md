VERDICT: SHIP-WITH-FIXES

1. `frontend/content/blog/ai-pdf-readers-page-number-citations-2026.md:48`  
Problem: slide/sheet naming is overstated as a user-facing citation claim.  
Evidence: backend source context uses `page` / `slide` / `sheet` via `_location_label`, but the frontend citation UI renders the shared `citation.page` string, `"Page {page}"`, through `citationPageRange`.  
Exact replacement text:  
`**What it documents:** for PDFs, citation chips show the page or page range they came from. Backend source labels use slide for PowerPoint and sheet for Excel, but the visible citation label is shared across formats. Click the citation, and the viewer opens the cited location and highlights the cited passage. [Quote Finder](/features/citations) goes one step further for quoting: it returns passages taken from the document, checked against the source text by machine before they are shown, with the page each one comes from, and copies them with an APA in-text citation.`

2. `frontend/content/blog/ai-pdf-readers-page-number-citations-2026.md:133` and `:138`  
Problem: the count of “other tools” is wrong. The post names Otio, Sharly, Anara, Humata, PDF.ai, Elicit, Smallpdf, Docalysis and UPDF: nine tools, not eight. After Otio and Sharly, seven remain, not six.  
Evidence: `vendor-evidence.md` covers those nine non-main tools.  
Exact replacement text for line 133:  
`We read the pages of nine more tools. Two document page numbers clearly enough to mention:`  
Exact replacement text for line 138:  
`The other seven do not document a page number for chat answers. **Anara** cites "the exact passage, page or figure" and jumps to it on click. **Humata** says it cites relevant sections and links into your files. **PDF.ai** says every response is "backed by sources". **Elicit** uses sentence-level citations. **Smallpdf** documents clickable page references for its PDF Summarizer, not for Chat with PDF. **Docalysis** and **UPDF AI** say nothing about how answers cite sources.`

3. `frontend/content/blog/ai-pdf-readers-page-number-citations-2026.md:142`  
Problem: APA claim is too absolute. APA 7 asks for page numbers for direct quotations from works with page numbers; for sources without page numbers it asks for another locator.  
Evidence: official APA Style says to provide author, year, and page number for direct quotations with page numbers, and another locating method when the work lacks page numbers ([APA page-number guidance](https://apastyle.apa.org/style-grammar-guidelines/citations/quotations/page-numbers), [APA no-page-number guidance](https://apastyle.apa.org/style-grammar-guidelines/citations/quotations/no-page-numbers)).  
Exact replacement text:  
`A jump to the passage tells you the answer is grounded. A page number lets you use it when the source has pages. APA 7 asks for author, year and page number when directly quoting material with page numbers; if a source has no page numbers, APA asks for another locator such as a paragraph number, heading or timestamp. If your tool only jumps to a quote, you may still have to work out the locator before the quote can go into a paper.`

4. `frontend/scripts/seo/indexnow_submit.py:51`  
Problem: validation failures from DNS, timeout or other `URLError` crashes are not converted into validation problems. I ran the script in dry-run mode and it raised `urllib.error.URLError` before printing the promised “nothing sent” stop message. No submission happened, but this is still brittle release tooling.  
Evidence: `fetch()` only catches `HTTPError`; `main()` assumes `validate()` returns problems before `submit()` can run.  
Exact replacement text for `fetch()` exception handling:  
```python
    except urllib.error.HTTPError as err:
        return err.code, ""
    except urllib.error.URLError as err:
        return 0, f"FETCH_ERROR: {err.reason}"
    except TimeoutError as err:
        return 0, f"FETCH_ERROR: {err}"
```

