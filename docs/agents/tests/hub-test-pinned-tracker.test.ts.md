# hub/test/pinned-tracker.test.ts

The T1 inventory checks the immutable 24-item corpus in
`hub/test/fixtures/tracker-snapshot/items.json`. It pins 21 original files from
96238cb9a, selected by kind, status and state, marked criteria, plans, ordinary
comments, verdicts, tables, fenced Markdown, summary fallbacks and the three
largest bodies. Parent chains are included. The JSON records selection reasons.
Three explicit supplemental rows add absent qa/ready statuses, spec kind,
malformed criterion marks, Unicode and tilde fences. No live malformed mark was
present at capture. The fixed count, identity uniqueness, ancestry and each
shape are asserted independently of the copier.

`copyPinnedTracker` reads only this committed corpus and writes only into the
caller's disposable project. Default Lua, closed-pages, Web Items and copied
startup-reply checks share it. Web excludes the historical public release before
seeding its existing deterministic replacement. No test consults a growing
tracker for this corpus. The separate 1,000-row scale guards remain unchanged;
the full live Lua comparison runs at T4. The manual startup-budget probe keeps
its explicit live source.
