---
id: T-1266
kind: task
title: T-1205's grouped parsed-metadata recorder case runs 2.4–2.5 s against the 2 s T2 budget
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: E-1216
blocked_by: []
topic: topic-1018
branch: t/T-1266-t-1205-s-grouped-parsed-metadata
created: 2026-10-24T23:57:53.599Z
updated: 2026-10-25T04:13:17.409Z
closed: 2026-10-25T04:13:17.409Z
---

## Summary

impl-1205 reported that T-1205's grouped parsed-metadata recorder case (skills-qa, T2) takes 2.383 s base and 2.516 s at worst repeat in run 209dbd96 (A-11544, Linux c-8), over the report-only 2 s T2 per-test budget. All assertions pass 5/5. Make it fit the budget (smaller fixture or a cheaper tier) rather than widening the budget.

## Acceptance criteria

- [x] C1. The case runs under 2 s on the Linux droplet at 2 workers with its assertions unchanged, or moves to the tier whose budget fits it, recorded in the test docs (test).
  - done: oc-1266 · 2026-10-25T03:46:52.636Z
  - verified: oc-rev-1 [reviewer] · run rev-oc-20261025-8 · 2026-10-25T04:07:06.606Z · commit c844df2e32da5ca7de5bb81dfca62facdc4dd369

## Comments

### oc-1266 · 2026-10-25T03:47:00.093Z

Head 7a43527c on t/T-1266-t-1205-s-grouped-parsed-metadata, pushed to origin; base origin/dev 7a9c7415 is an ancestor, so no dev merge was needed.

Rule 20: no shared contract changes. This is the T2 test and its per-file doc only: no production caller, reply/list shape, schema, refusal class, credential, admission policy, skill, brief, fixture or startup probe is touched, so there is no consumer list to migrate.

Change: the five recorder invocations in "demo recorder scans parsed JSON metadata and stderr before publishing safe captures" are independent sealed qa-record.sh children on their own disposable roots, so the case now starts all five together (four escaped tab/newline controls in parsed metadata and stderr, then the safe escaped-whitespace positive) instead of serially. Assertions, fixture data, run ids and roots are unchanged; only scheduling changed. T2 remains the right tier (the recorder CLI is the subject, the headless fixture is scripted), so the case fits the budget rather than moving to T3; docs/agents/tests/hub-test-skills-qa.test.ts.md records that.

Measurement, named exactly: macOS, node v24.21.0, targeted single-file `node --test --test-name-pattern="parsed JSON metadata" hub/test/skills-qa.test.ts`. Before the change: 1530.7 ms (one run). After: 358.1, 321.0, 327.7, 320.7, 313.7 ms (five runs). The touched file `node --test hub/test/skills-qa.test.ts` passed 19/19. These are local wall samples, not the Linux-droplet receipt; hub/test/durations.json budget.mode is still report, and no allowance or baseline was added, so they are not an enforced budget pass. The under-2 s claim needs the verify run at the reviewed head.

Red control (local, never committed): with assertPublishable disabled in .agents/skills/qa/qa-demo-policy.ts the case failed as expected (actual 0, expected 2 on the first negative); the file was restored and the case went green again. The full red/green pair for the duration criterion is the recorded droplet samples 2.383/2.516 s over the 2 s budget in A-11544 versus the timing this head gets.

npm run typecheck passed (hub, nvim, shared/wire, web incl. colour/token/HTML/oxlint/hooks). No suite, T3/T4, Web, browser or QA run happened. Next: source review, then one mode-free verify at the reviewed head.

### oc-rev-1 · 2026-10-25T03:49:45.462Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-5
commit: 7a43527c0791f06d839216d7252eb230940fc58a
scope: full
findings: [{"severity":"low","text":"The new doc sentence says 'the four run concurrently before the safe positive' and 'runs its four children at once', but the code starts all five together in the one Promise.all (safe positive included). The item's only change is scheduling, so the doc should say five start together, not four before the safe one.","file":"docs/agents/tests/hub-test-skills-qa.test.ts.md","line":9},{"severity":"low","text":"Promise.all rejects as soon as one child fails, while the other four execFile children keep running: record() spawns them without ownProcess/captureProcess, so ownDirectory's cleanup removes their roots (bounded retries) under live writers. Promise.allSettled plus per-result assertions would settle all five before a failure propagates; failure path only, so it cannot flake a green run.","file":"hub/test/skills-qa.test.ts","line":154}]
finding_counts: {"high":0,"medium":0,"low":2}

Source review (full) at 7a43527c (tree f0ffd6295d6800fbfaa5ebe6eb61d1769e332e4e), base origin/dev 7a9c7415 an ancestor, origin tip and worktree HEAD both 7a43527c, worktree clean, diff --check clean. Two files: the T2 test and its per-file doc.

Assertions survived: pre and post each carry the same 10 assert statements with identical text and values — six per blocked control (code 2, BLOCKED, empty evidence, no secret in stdout+stderr, empty demo-run, no .cleaned acknowledgement) over the same four controls in the same order, then the four safe-positive assertions (code 0, PASS, grid.txt 'General', .cleaned 'acknowledged'). The internal 'durable receipt matches stdout' assertion inside demoRecord still runs for all five. Only the scheduling and the loop source changed.

Independence holds: every invocation goes through demoRecord -> tempProject(t), so each has its own mkdtemp root, its own envelope.json and hub.json, TMPDIR and HOME under that root, and fixtureEnvironment is applied after the overlay. The only shared inputs are read-only: the shipped qa-record.sh and the scripted headless fixture, which writes solely to ${FAKE_DEMO_ENVELOPE}.cleaned and its per-root directory. No shared root, port, counter or ordering assumption.

Tier rationale: T2 is the right tier and not a new claim — the file header already declares it, qa-record.sh is the CLI subject and the headless output is a scripted protocol fixture, and docs/agents/tests.md allows the CLI as a subprocess when the CLI itself is the subject. Keeping T2 and making the case fit is preferable to deferring to the 10 s T3 budget, and the doc records that.

C1 stays unverified: its measurable half is 'under 2 s on the Linux droplet at 2 workers', which source review cannot establish. The local samples (1530.7 ms before; 358.1/321.0/327.7/320.7/313.7 ms after) are macOS wall samples from the implementer's own session and are labelled as such; durations.json is still report mode and no baseline or allowance was added. The A-11544 droplet samples (2.383/2.516 s) are the red side. I will verify C1 from the mode-free verify at this head.

Two lows, neither blocking. If you fix the doc sentence, push it and request source review again at the new head before running verify; otherwise both can ride a later head.

### oc-1266 · 2026-10-25T03:51:26.668Z

Head 523de586 on t/T-1266-t-1205-s-grouped-parsed-metadata (parent 7a43527c), pushed to origin; origin/dev 7a9c7415 is still an ancestor.

Both review lows fixed, no other change: (1) docs/agents/tests/hub-test-skills-qa.test.ts.md now says all five runs (the four controls and the safe positive) start together and settle before the assertions, and the code comment already said five; (2) Promise.allSettled replaces Promise.all, with one narrow map that fails on a rejected child using its reason, so all five settle before any assertion and before ownDirectory removes the roots. Assertions, fixture data and the five roots are unchanged.

Named evidence at 523de586: macOS, node v24.21.0, `node --test --test-name-pattern="parsed JSON metadata" hub/test/skills-qa.test.ts` passed at 325.3/337.2/344.4 ms; `node --test hub/test/skills-qa.test.ts` passed 19/19; `npm run typecheck` passed. Rejection-path red control (local, never committed): replacing the first control with a rejected promise fails the case after all five settle with `AssertionError [ERR_ASSERTION]: Error: red control`. Budget mode stays report, no baseline or allowance touched; the under-2 s claim still needs the verify receipt.

Fresh source review requested at 523de586; verify follows the clear.

### oc-rev-1 · 2026-10-25T03:52:24.213Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-6
commit: 523de5861ba605fb7169ea014b3c276286db559b
scope: full
findings: [{"severity":"low","text":"assert.ok(safe, 'the safe control settles') cannot fire: assert.fail is typed never, so the map already yields the values or throws, and demoRecord always resolves to an object. It is an eleventh assert after the ten unchanged ones, which makes 'assertions unchanged' in C1 off by one. Either drop it, or note in the item that the set grew by one unreachable guard.","file":"hub/test/skills-qa.test.ts","line":161}]
finding_counts: {"high":0,"medium":0,"low":1}

Fresh source review (full) at 523de586 (tree f25340dbd8fc1690c4d6d1210c6c3a76374297f9), parent 7a43527c, base origin/dev 7a9c7415 an ancestor; origin tip and worktree HEAD both 523de586, worktree clean, diff --check clean. The delta since 7a43527c is exactly the two lows I posted and nothing else; the full diff against dev still touches only the test and its per-file doc.

Low 1 fixed: the doc now says all five runs (the four escaped controls and the safe positive) start together and settle before the assertions, and that the case runs its five children at once. That matches the code and the reason for the change.

Low 2 fixed: Promise.allSettled at skills-qa.test.ts:154 lets all five children settle before anything else, and the :160 map turns a rejected child into assert.fail(String(result.reason)), so no recorder child is still writing into a root when ownDirectory removes it. The rejected-child message keeps the reason ('Error: red control' in the local red control), the original ten assertions and their text are unchanged, the four controls keep their order, and the five disposable roots are still one per call.

C1 stays unverified: its measurable half is still the Linux droplet at 2 workers under the 2 s T2 budget. The 325.3/337.2/344.4 ms samples and the 19/19 whole-file pass are macOS samples from the implementer's session; durations.json is report mode and no baseline or allowance was added. One mode-free verify at this head supplies the receipt, and I will verify C1 from it.

One low, not blocking, on the new guard.

### oc-1266 · 2026-10-25T03:53:23.969Z

Head c844df2e on t/T-1266-t-1205-s-grouped-parsed-metadata (parent 523de586), pushed to origin; origin/dev 7a9c7415 is still an ancestor.

Takes the reviewer new low only: assert.ok(safe) is removed (assert.fail is typed never and demoRecord always resolves, so it could not fire and made the set eleven asserts). The settled records are indexed — safe = records[0]!, controls = records.slice(1) — so the assertion set is the original ten, the five roots stay one per call, and every child still settles before any assertion. No other line changed.

Named evidence at c844df2e: macOS, node v24.21.0, targeted single case passed at 314.4/333.1 ms; whole touched file 19/19; npm run typecheck passed. budget.mode stays report; no baseline or allowance touched. Fresh source review requested; one mode-free verify follows the clear, then the evidence pass on C1.

### oc-rev-1 · 2026-10-25T03:53:37.963Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-7
commit: c844df2e32da5ca7de5bb81dfca62facdc4dd369
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review (full) at c844df2e (tree 645e5a76e89eeeb8ddaf17348467c831cce26ba2), parent 523de586, base origin/dev 7a9c7415 an ancestor; origin tip and worktree HEAD both c844df2e, worktree clean, diff --check clean. The delta since 523de586 is the one hunk replacing the destructuring guard: records[0]! for the safe positive, records.slice(1) for the four controls.

My last low is fixed: assert.ok(safe) is gone, the assertion set is back to the original ten with their text and order, and the non-null index assertion matches the file's existing style (safe.line.evidence[0]!, child.pid!). The five roots are still one per call, all five children still settle through Promise.allSettled before any assertion, and the rejected-child path still fails with its reason after every child has settled.

Unchanged and re-checked at this head: the doc sentence says all five start together and settle before the assertions; the four controls keep their order; the escalation of a rejected child to assert.fail happens after all settle, so no recorder child is writing when ownDirectory removes a root.

C1 stays unverified: the Linux droplet at 2 workers under the 2 s T2 budget is the half source review cannot establish. The 314.4/333.1 ms samples and the 19/19 whole-file pass are macOS samples from the implementer's session; durations.json stays report mode with no baseline or allowance. One mode-free verify at c844df2e supplies the receipt and I will verify C1 from it.

No findings: nothing high, medium or low at this head.

### oc-1266 · 2026-10-25T04:07:00.319Z

Mode-free verify c231b891-7eec-48d5-847a-dd0fe3d95df0 at c844df2e passed: auto exit 0, 3108 tests / 0 fail / 0 cancelled / 0 skipped, artifact A-11598.

Executor: droplet c-8 lon1, linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, 2 workers, lifetime 711 s, cost $0.0494. Tiers: T0 exit 0 25.5 s, T1 exit 0 69 s, T2 exit 0 377 s, Web exit 0 159 s. T3/T4 not run: T3 is absent from the configured batch tiers and the task plan is T0–T2 + Web; no native demo lease, browser or QA claim. Selection: task fallback all T2, coverage unsupported path docs/agents/tests/hub-test-skills-qa.test.ts.md; deciding files [docs/agents/tests/hub-test-skills-qa.test.ts.md, hub/test/skills-qa.test.ts].

C1 receipt, quoted from the run log (line 10808): {"file":"hub/test/skills-qa.test.ts","name":"demo recorder scans parsed JSON metadata and stderr before publishing safe captures","seconds":0.6333593120000001,"outcome":"pass"} — 0.633 s against the 2 s T2 per-test budget at 2 workers, one execution (the identity is not new, so it got no load-gate repetitions), and the T2 shard peaked at 1 m load 3.83 during it. That is down from the 2.383 s base / 2.516 s worst sample recorded in A-11544.

Context named, not hidden: budget.mode is still report and no allowance or baseline was added, so this is a measured sample under the budget, not an enforced budget pass. The file-level row shows hub/test/skills-qa.test.ts 3.841 s → 8.403 s; that is the sum of the file other cases under the same loaded droplet (other files regressed 2–5x, e.g. tracker-summary 0.044 s → 4.013 s) and stays under the 30 s file budget, while this case own row is the 0.633 s above.

Evidence review requested next.

### oc-rev-1 · 2026-10-25T04:07:06.606Z

verdict: review
result: clear
by: oc-rev-1 [reviewer]
run: rev-oc-20261025-8
commit: c844df2e32da5ca7de5bb81dfca62facdc4dd369
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review (scope evidence) at c844df2e32da5ca7de5bb81dfca62facdc4dd369 — same head and tree (645e5a76e89eeeb8ddaf17348467c831cce26ba2) as the source-clear verdict rev-oc-20261025-7; origin tip and worktree HEAD both c844df2e, worktree clean.

Run c231b891-7eec-48d5-847a-dd0fe3d95df0 (A-11598): auto, mode full, exit 0; Linux x64 6.8.0-142-generic, droplet c-8 lon1, Node v24.21.0, 2 workers (source hub config); log head c844df2e; deciding files are exactly docs/agents/tests/hub-test-skills-qa.test.ts.md and hub/test/skills-qa.test.ts. Totals 3108 tests, 3108 pass, 0 fail, 0 cancelled, 0 skipped.

C1's measurable half: 'demo recorder scans parsed JSON metadata and stderr before publishing safe captures' ran on the Linux droplet at 2 workers in 0.633359312 s (A-11598 lines 10807-10808), against the 2 s T2 per-test budget. That is roughly a 3.2x margin and a 3.8x drop from the red samples (2.383/2.516 s in A-11544). One base execution, no repetitions: the case identity is not new to the branch, so the load gate has nothing to repeat, and the criterion as written asks for the measured time, not a repetition receipt. The whole-file duration regression named for skills-qa (3.841 s -> 8.403 s) is a file-level report-only line that already appears on dev's stage cover (A-11561, 3.841 -> 8.034 s) before this item, and the case itself is now well under budget.

C1's other half: the ten assertions are the original ones with their text and order (source pass rev-oc-20261025-7), the four controls keep their order, and the per-file doc records both the five-child concurrency and why T2 is retained rather than the case moving to T3.

Budget mode is still report, so this is a measured fact, not an enforced gate pass: no baseline or allowance was added, and I do not claim the ratio as an enforced budget outcome. Report-mode would-fail lines (artifact-cleanup-unit, item-summary-scale, several Web files) name none of the changed files.

No findings: nothing high, medium or low. C1 verified across the source pass and this run.

Criteria: C1 verified.

### coord · 2026-10-25T04:13:17.409Z

Merged 44211a6d19a8f4078a005fcc1a3653bf82bdac6c onto dev.
