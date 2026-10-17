---
id: T-695
kind: task
title: Hub rules proven once per harness through three binaries collapse to one in-process table and one real frame proof
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-691
  - T-692
  - T-693
  - T-686
  - T-687
topic: topic-449
branch: t/T-695-hub-rules-proven-once-per-harness
created: 2026-10-16T19:59:36.269Z
updated: 2026-10-17T17:15:41.264Z
---

## Summary

`for (const harness of ['claude-code', 'codex', 'opencode'])` wraps tests whose assertions concern a hub rule (memo §2.3 anti-pattern 8; report-slice2 anti-pattern C, top 10 #6–#7):

- `session-model.test.ts` (48.9 s): model journalling, explicit × default and live × fresh × native resume.
- `session-usage.test.ts` (41.6 s): totals and cost per harness; it also shells out to `jq`.
- `progress.test.ts` (35.0 s): progress digest, 19 spoke spawns and four `sleep(400)`.
- `crew-launch.test.ts` (39.4 s): pool handoff, 3 harnesses × 2 `keep_context`.

## What to build

Each hub rule runs as a T2 table over T-686's fake adapter flavours: model and usage journalling, digest holding and release, pool handoff and `keep_context`. What differs per harness (how usage and model are parsed, steer versus next turn, native cwd and thread) is proven once per harness: in its contract file (T-691 to T-693) or, for the per-harness launch, in the crew-launch scenario (T-708). The `jq` check reads the journal in-process. Every fixed sleep is replaced by a barrier event.

## Acceptance criteria

- [x] C1. The four files' manifest seconds fall from 164.9 s (A-3877) to 85 s or less.
  - done: impl-695 · 2026-10-17T16:17:45.515Z
- [x] C2. Their fake-binary call sites fall from 23 to 6 or less, `spawnSpoke` sites from 21 to 4 or less, and numeric sleeps from 4 to 0.
  - done: impl-695 · 2026-10-17T16:17:46.318Z
  - verified: rev-30 [reviewer] · run rev-20261017-695-source · 2026-10-17T16:23:49.658Z · commit 09f1b18ccd0db3603e18e4d7a4ee5c9a83a360d4
- [x] C3. Each hub rule has one T2 table test over the three flavours that passes the tier lint, and each per-harness difference names the contract-file or scenario test that proves it.
  - done: impl-695 · 2026-10-17T16:17:46.688Z
  - verified: rev-30 [reviewer] · run rev-20261017-695-source · 2026-10-17T16:23:49.658Z · commit 09f1b18ccd0db3603e18e4d7a4ee5c9a83a360d4
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-695 · 2026-10-17T16:17:47.301Z
  - verified: rev-30 [reviewer] · run rev-20261017-695-source · 2026-10-17T16:23:49.658Z · commit 09f1b18ccd0db3603e18e4d7a4ee5c9a83a360d4
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - failed: rev-30 [reviewer] · 2026-10-17T17:15:41.264Z · note A-4644 exits1 with five owned hard duration budgets and no Neovim smoke receipt; await the explicitly authorized unchanged-head retry before final evidence clearance.

## Blocked by

T-686, T-687 (in-process spoke).

## Comments

### impl-695 · 2026-10-17T16:12:50.450Z

Implementation moves all four requested files to T2 using FakeClock, fake adapter flavours and in-process spokes. A narrow session-native-lifecycle.test.ts retains native-only child parsing, pool cwd/thread/history/merge stops and restart persistence pending T-707/T-708, per Coordinator decision in topic-449. First final Mac serial measurement green; collecting 5/5 whole-file timings including the native split. Typecheck, tiers and per-file tier lint pass. No production changes.

### rev-30 · 2026-10-17T16:23:49.658Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-695-source
commit: 09f1b18ccd0db3603e18e4d7a4ee5c9a83a360d4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-695 full source review — clear

Reviewed head09f1b18ccd0db3603e18e4d7a4ee5c9a83a360d4 supersedes initial request4d7927b7; fixed incoming devf775da3bb0ad31eb0c16be4f54ea38e09b886e60. Seven-file test/manifest change, no production changes. Read-only review; no Reviewer tests or delegation.

## Standards
No remaining findings. All four hub-rule files use explicit FakeClock, fake adapter flavours and in-process spokes/socket frames; one actual CLI stop remains where argument/exit handling is the subject. No fake binary or spawnSpoke call remains in those T2 files. Protocol/journal/injection receipts and ordered round trips replace elapsed sleeps. Existing FakeClock TTL/prune boundaries and final assertions remain.

The narrow native file retains actual process-only behavior under Coordinator primaryd6baa2d8: child parsing/early Codex launch admission, native pool cwd/thread/history/held resume, merge stop policy and real hub-restart journal/digest recovery. It has a T3 lifecycle header; these assertions are retained now, not deferred to nonexistent future coverage. T-707/T-708 are retirement candidates only. Held native resume has a finally release; actual process/cleanup observations remain.

## Spec/assertion review
The A-4616 declaration mapping was checked against all rewritten hunks and native split. Model first/default/explicit reports, launch/resume identity, sub-agent attribution without parent mutation, usage deduplication/coalescing/limit-only changes, pending-stop final usage, exit/relaunch exactly-once finals and launch-item attribution retain explicit assertions. Progress preserves queued/no-turn behavior, ordered whole-batch history, uncertain retry membership, unacknowledged reconnect, vacant-role rebinding, TTL/prune and separately bound rename cases. Crew retains caps/admission failure recovery, verifier-held reservation, retained reuse identity, brief delivery, keep_context reset/retention and live clause reload; native worktree/process/thread proofs remain in the split.

The review identified an initially dropped exact README jq-program check. Current usage correction resolves it: the documented expression is compared with a checked canonical expression after whitespace normalization; the in-process evaluator selects latest finals, groups by role/item and propagates null if any contributor's token/cost value is unknown. Worked inputs cover superseded finals, a running session, multiple contributors and missing values before applying it to real flushed journal data. The presence-only check and unrelated row projection are gone. No jq process or production aggregation implementation is added.

Per-harness contract references in the audit name declarations that exist at this head in Claude/Codex/OpenCode adapter files; parsing, first-clause behavior, native resume/steering and process restart are not asserted solely through the generic fake.

C2 verified. Four T2 files have zero binary/spawnSpoke/numeric-sleep sites. Across all five coverage files, the retained native split has five fakeClaude/fakeCodex calls plus one OpenCode binary setup, one spawnSpoke call and zero numeric sleeps, meeting6/4/0 ceilings. Audit distinguishes historical ticket21/4 spoke/sleep counts from current-base13/3; either comparison meets the ceilings. Instrumented census reports daemon starts8→4 (usage2+progress6 before; two restart pairs after). Total descendant child counts are explicitly not compared because the native split now also contains model/crew proofs.

C3/C4 verified from the current tables, headers, exact contract references and complete assertion mapping, including restored README contract. Native split permission and its inclusion in timing were checked in primaryd6baa2d8.

## Evidence and timing limits
A-4616 supersedes A-4614. All25 accepted whole-file logs were audited: model4, usage5, progress9, crew3, native9 tests per run;5/5 each,150 passes total,zero fail/cancelled/skipped. Five fresh usage logs cover the correction; other four sources remain byte-unchanged. Static typecheck, tier lint and report lint supplied; changed files have no findings.

Reported-test-duration median sum, including native split, is35.083453878s: model0.336312709, usage2.285553793, progress1.462958624, crew3.102053043, native27.896575709. Node file-wall36.728254417s and subprocess-wall36.886s are separately labeled; the earlier37.126 label was subprocess wall. Same-Mac before106.348s is also subprocess wall, while164.9s is the historical manifest baseline. Do not mix these metrics or infer a per-file load multiplier. C1's Mac support is below85s; exact-head Linux seconds remain pending under the E-677 timing disposition.

Durations non-allowance sections independently equal incoming dev. Fourteen obsolete legacy allowances are removed; five renamed native proofs carry reasoned E-677 entries dated2026-10-17→24, based on previous Linux A-4565 values disclosed as such (not current-head measurements). Tiers change only the four requested files toT2 and add the sorted native T3 entry; no coverage is dropped.

Source clear, Standards0/Spec0 findings; verify C2/C3/C4. C1 and C5 remain unverified pending exact-head Linux evidence and final timing audit. No per-item QA. The Coordinator's verification submission hold remains in force; wait for explicit hold lift before normal mode-free exact-head droplet verification.

Durable source review A-4617.

Criteria: C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T17:15:41.264Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-695-runtime
commit: 09f1b18ccd0db3603e18e4d7a4ee5c9a83a360d4
scope: evidence
findings: [{"severity":"medium","text":"A-4644 has five task-owned hard duration-budget failures: crew handoff5.044s, two OpenCode native pool cases6.968s/5.907s, usage final totals5.114s (each >5s), and native file65.367s (>60s). Assertions and all23 owned load gates pass, but this run is exit1 and does not establish C5. Coordinator separately authorizes one unchanged-head T-742 retry; keep source unchanged for that retry.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Disposition update after A-4649 was prepared: primary Coordinator 8d2680a6-d415-4453-af33-309ae65df08f authorizes exactly one unchanged-head retry for T-742; Implementer reports submitted 01bb9319-a478-4597-ab1f-b593db1c9beb. That instruction supersedes A-4649's proposed budget-patch sequencing: keep head/allowances unchanged for the authorized retry. This verdict records the failed A-4644 evidence only; it does not revoke that explicit retry authorization. Its five duration budget lines are hard failures under the active legacy gate, distinct from report-only tier diagnostics. A-4650 discloses paired timing values and the same failures. C1 is supported on the launch brief's reported Mac-median interpretation; no C1 failure is recorded.

# T-695 runtime evidence review — not clear

Exact reviewed head 09f1b18ccd0db3603e18e4d7a4ee5c9a83a360d4 remains the branch tip; current full source verdict rev-20261017-695-source / A-4617 still covers unchanged product/test bytes. Run e9bd92a9-7eeb-42c4-87fe-0d1907c29abb / A-4644 finishes exit 1 and task view records failed. Read-only receipt review; no Reviewer execution.

## Standards / execution finding
M1 (medium), hub/test/durations.json, evidenced by A-4644 lines7094–7098: five task-owned hard duration-budget failures prevent a clear C5 result:
- crew-launch::Implementer handoff retains or resets native context across flavours —5.044s >5s;
- session-native-lifecycle::an Implementer pool moves to the next task worktree after merge (opencode, keep_context=true) —6.968s >5s;
- the same keep_context=false identity —5.907s >5s;
- session-usage::final totals and cost aggregate by launch item despite a changed verifier hold across flavours —5.114s >5s;
- session-native-lifecycle whole file —65.367s >60s.
These are hard legacy new-identity/file admission failures, distinct from the report-only tier budget/regression notices. Correct the measured allowances with valid ownership/reasons or reduce the demonstrated cost, then request fresh source review at the changed head before another verification. No failed assertion or unknown functional defect is inferred from the duration failures.

## Spec and receipts
Ordinary counts2082total/2077pass/0fail/0cancelled/5prerequisite skips. All five coverage files execute positively: session-model4 declarations, usage5, progress9, crew3 and retained native9, total30 top-level receipts. All23 owned new load identities pass5/5,115/115. This does not turn the failed ordinary budget gate green. Hub-only mode stops after its failed hub phases; Neovim smoke is not reached.

Per-file Linux top-level test-seconds independently summed:
session-model4.327945804; session-usage11.114043164; progress8.520035746; crew-launch10.409936520; retained native65.366899003; total99.738860237s. The retained native coverage is included, not omitted to compare only four fast files. Accepted Mac5/5 median sum35.083453878s remains separately disclosed against C1's85s target. The Implementer cites the launch brief's Mac-median target interpretation in b84eb514; the exact Linux sum is correctness/disclosure evidence, not a hidden replacement metric. C1 is not failed here; its final mark remains unverified pending the corrected-head evidence pass and timing disposition. No causal load inflation factor is claimed.

C2/C3/C4 source marks remain current: bounded fake-binary/spoke/sleep counts including the retained native split, flavour rule tables/native differences, and full assertion map including exact README jq program and in-process aggregation correction. A-4616/A-4617 Mac evidence and source analysis are unchanged; no additional source finding in this evidence pass.

Supplied executor: Linuxx64 6.8.0-142-generic,c-8lon1,Node24.21.0/Neovim0.12.5,2workers. Lifetime/cost unknown, not inferred. Suite2179.91s,peak1mload10.61,load-gate extra wall7.93s; free36.18s,machine2143.71s. Host typecheck gate recorded at ade0dfe09c27d82fb4b3557d8ea0784db5558a31, not repeated remotely. Unrelated duration regression/report-only notices are not classified as new blockers by this review.

Evidence not clear; fail C5 for the five hard budgets. C1 remains unverified; C2/C3/C4 retain current source verification. No unchanged retry requested. No per-item QA. Standards/execution: one medium finding; Spec: C5 lacks a passing task verify, no additional assertion-mapping defect.

Durable receipt audit: A-4649; later execution disposition and paired timing evidence: A-4650.

Criteria: C5 failed (A-4644 exits1 with five owned hard duration budgets and no Neovim smoke receipt; await the explicitly authorized unchanged-head retry before final evidence clearance.).
