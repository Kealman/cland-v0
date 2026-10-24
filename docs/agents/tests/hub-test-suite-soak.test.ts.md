# hub/test/suite-soak.test.ts

T1 scheduler policy uses `suiteUnit`, candidate facts, semantic executor receipts
and a `FakeClock`; no process, socket or real provider is needed. For periodic
infrastructure outcomes, inject a bundle failure at the executor delivery seam,
observe the durable reported receipt and assert `outcome.notRun` and the result
JSON. Pass it through `devT3Result` and `DevT3Search` to retain the no-search
assertion. Seed both an executed green and red first, then prove those cover
markers and the admitted green baseline stay unchanged. Reopen the scheduler and
observe a real retry/start/completion receipt for the same unexecuted tree after
the interval. `caseDeadlines` bounds setup and behaviour separately.

For collection/restart changes, cover both the full-outcome result before its job
checkpoint and the earlier bare terminal-transport result after the delivery
failure job checkpoint. The latter must preserve the saved infrastructure marker
and original cause, heal the durable result, and still produce no cover or search.

Provider capacity runs reuse that lifecycle: inject a typed acquisition refusal
at the semantic executor seam after seeding executed green/red receipts. Retain
the cause, no-cover/release/search checks, restart recovery and next-interval
retry. The pure `eventRow` assertions keep suite-result and timing journal rows
unavailable, without a failure glyph.
