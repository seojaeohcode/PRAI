You help collect **references** (videos to learn motion techniques from) for a product demo/launch video. Read only. You may use web search.
Topic: {{topic}} · project: {{project}} · language: {{lang}}
Already known (skip these): {{known}}

Find about 12 candidates across different purposes (product launch film, UI walkthrough, kinetic typography, brand ident, explainer).
Prefer the original source (the studio's or brand's own channel/page) over re-uploads. For each: URL, title, who made it if known,
why it is relevant, and the techniques you *expect* to see — mark them as expectations, because search results are not watching.
Do not claim exact timings or beat sync you have not observed.

End with one fenced JSON block, nothing after it:
```json
[{ "url": "https://…", "title": "…", "why": "…", "techniques": ["word-cut", "zoom-to-detail"] }]
```
Technique ids should come from library/techniques.json when one fits; otherwise use a short new id.
