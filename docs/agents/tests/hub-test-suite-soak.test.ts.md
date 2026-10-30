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

Attribution uses the existing SuiteJob shape: occupy the single remote slot and
hold local admission, submit a null-actor periodic run and an ordinary human
run, then assert queued authors. Release both slots, observe each executor start,
and assert running queue rows, heartbeat text and completed timing records.
No origin field is required to read the retained records.

Fresh-cover policy uses a completed semantic executor receipt before the periodic
tick. Reopen to assert durable history and the attempt cursor, then assert both
no periodic admission and the skip event/notice naming the cover. Eligibility
cases retain the final positive admission assertion for red, partial, stale,
cached, subset, diagnostic, cancelled, missing-time, older and unrelated covers.
Candidate ancestry facts distinguish descendants from ancestors. Full integrated,
stage, epic, release and T3 batch covers qualify; T1-only batches do not.

The native ancestry control in `suite-soak-component.test.ts` uses scratchMachine
and commandIn for setup Git, with sealed final environment and explicit exit
assertions. Every production ancestry read is registered through caseDeadlines;
its pending-work drain precedes scratch directory cleanup even if an observer
aborts. The shared command owner's adverse cancellation/native-close control
remains in `hub/test/init-machine-lifecycle.test.ts`.
