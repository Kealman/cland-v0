# hub/test/suite-soak.test.ts

Periodic admission reserves the configured three shards through the fake executor,
observes each worker's start and completion and the reported parent, then reopens
the scheduler to prove an unchanged tree does not repeat. Single-worker policy
fixtures explicitly set `shards=1`. Capacity deadlines retain their native exit,
report inconclusive, name missing tiers and produce neither incident cover nor
culprit/release evidence. Sharded daily coverage requires every producer receipt
and planned file; compact history uses the identity-bound periodic checkpoint.

New callbacks use `flakyReceiptCase` and `ownedSuiteUnit`: acquisition hooks
become required resource closers under fenced cleanup before roots or guard
restoration. The shared rejected-close/construction-failure controls in
`suite-stage-rules.test.ts` exercise that same owner. Code-only 124 is a negative
deadline control. Native owner metadata survives result-only checkpoint
recovery. Ordered pass/interruption controls share `incompleteTierSteps` with
the admission policy, including foreign producer rejection.
Old-shape remote completion controls run both before and after a hub reopen
while the worker is in flight: absent deadline metadata remains unknown and a
native 124 stays red. New marker authority has a separate result-only recovery
control. The changed supervisor files are uploaded per run, outside the image.

The corrected refusal and late-rejection cases use `suiteCase` to register
normal/signal ownership before setup, adopt the acquired root and fence caller
continuations. A positive launch guard covers callback/custom/sync/lower-spawn
routes through setup, body and cleanup. Held delivery releases during teardown.
Cancellation followed by delivery rejection retains code 143/cancelled in the
durable result, plus a secondary diagnostic in the full log. The scripted
undelivered worker's cancellation boundary is explicitly faked.

The soak delivery refusal retains infrastructure `notRun` in its durable result
JSON and supplies no cover. Plant failure-looking delivery diagnostics with a
last-green identity: the executed-failure control must propose an incident, while
the same diagnostics under the infrastructure outcome must produce no notice.

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
stage, epic and release covers qualify. Legacy T3 batches without structured
producer proof and T1-only batches do not. Structured batch-tree coverage and
the daily backstop are covered separately in dev-t3-coverage-component.test.ts.

The T2 ancestry control in `suite-soak-component.test.ts` uses scratchMachine
with a sealed final environment and a scripted Git custom promisifier. Positive,
reverse and missing ancestry assertions run through the production candidate.
The shared native launch guard stays installed through cleanup; caseDeadlines
owns pending ancestry reads. See the
[component guidance](hub-test-suite-soak-component.test.ts.md) for tier history.
