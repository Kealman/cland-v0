---
id: T-1742
kind: task
title: Spend-ledger categories and host reservations
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
topic: topic-1430
branch: t/T-1742-spend-ledger-categories-and-host
created: 2026-11-07T16:01:57.593Z
updated: 2026-11-07T16:17:28.316Z
---

## Summary

The entries of the shared `spend.json` gain a `category`, `verify` or `hosts`, and host entries gain their pool. An entry without a category reads as `verify`, and no entry or settled cost is ever lost or reset; the ledger's reconciliation rules hold. `[verification] daily_spend_usd` bounds both categories together, and the hosts cap bounds `hosts` within it. The ledger offers four operations for hosts: a reservation up to a lease deadline, its renewal, settlement on the real lifetime with the billing minimum, and today's and the month's totals per category and pool.

## What to build

An additive ledger API that the executor keeps calling unchanged in behaviour. Executor reservations count `hosts` entries toward the shared cap. There is no ledger version bump: older hubs keep the new fields through their reconcile and count `hosts` reservations against the combined cap, which is the intended bound.

## Acceptance criteria

- [x] C1. Entries carry `category`, and host entries their pool; an entry without a category reads as `verify`, and a ledger written by the previous code keeps every entry and settled cost after a host reservation (test).
  - done: impl-1742 · 2026-11-07T16:09:40.704Z
- [x] C2. A host reservation is refused when it would pass the hosts cap, or the verification cap with verify spend included, and an executor reservation counts `hosts` entries toward the shared cap (test).
  - done: impl-1742 · 2026-11-07T16:16:18.285Z
- [x] C3. A renewal raises a host's reservation to its new deadline, and settlement records the cost of the real lifetime with the provider's billing minimum (test).
  - done: impl-1742 · 2026-11-07T16:09:41.798Z
- [x] C4. Today's and the month's totals are readable per category and per pool, as settled costs of the period (test).
  - done: impl-1742 · 2026-11-07T16:16:22.562Z
- [x] C5. The executor's spend test files pass with no test edited.
  - done: impl-1742 · 2026-11-07T16:09:45.660Z

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/executor/droplet/spend.ts`, `hub/test/executor-spend.test.ts`.
- Tests: `executor-spend.test.ts` (T1, edit) or new `hub/test/host-spend.test.ts` (T1). Every test uses an isolated `XDG_STATE_HOME`; never the user's ledger.
- Serves epic C7 and C8.

## Comments

### impl-1742 · 2026-11-07T16:04:24.468Z

Rule 20 sweep before additive spend contract: production consumers are executor/droplet/{droplet,watchdog,spend}.ts and state-paths.ts. Direct test importers: executor-spend, executor-safety (dynamic import), executor-lock-liveness, executor-admission-lock, executor-reap-confirmation, executor-deletion-confirmation, executor-retirement-component, suite-soak-component, suite-dry-run, suite-accounting, suite-close-component, account-fixture-env, state-paths. Stored-shape readers/fixtures additionally init-machine(.test), init-roots, executor-safety-component, executor-liveness, suite-close, suite-remote-process, state-inventory, nvim/client-component, web verification fixture. Docs: per-user-state, running, v0.4, v0.1.4, launch-claims audit. No shipped skill/probe spend readers found. Existing APIs/reply shapes unchanged; new verify writes add category, absent category interprets as verify without rewriting historical entries. Host APIs additive; v1 and reconciliation/write-through retained. Tests at preassigned ledger seam, new T1 host-spend file; executor tests unchanged.

### rev-37 · 2026-11-07T16:13:36.954Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1742-source-1
commit: 2f123e77c07504a9d9f8e04f10c7b5296557dc12
scope: full
findings: [{"severity":"medium","text":"Equal host/executor lease IDs bypass reserveSpend cap admission; reserveShardSpend also permits a host lease reserved:<run> to collide with its durable project+lease key, causing reconcile to merge reservations instead of summing them. Reject conflicting owner/category identities before idempotence or append and cover both paths.","file":"hub/src/executor/droplet/spend.ts","line":148},{"severity":"medium","text":"Accepted offset settlement timestamps are persisted raw while UTC totals slice their textual date/month. An Oct31 23:30-02:00 settlement belongs to Nov1 UTC but is omitted from that day's cap and attributed to October. Canonicalize or refuse before publication and cover day/month crossing plus equivalent-instant retry.","file":"hub/src/executor/droplet/spend.ts","line":351}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1742 full source review

Head: 2f123e77c07504a9d9f8e04f10c7b5296557dc12.
Base: 79b350ec536cda3404c346fec0e9f8318e14369d (origin/dev merge-base).
Run rev-37-1742-source-1; scope full; result not clear.
Standards and Spec assessed in-session; role disallows delegation. Reviewer only read source/docs/tracker/evidence; no tests, typecheck, browser, edits or merge.

## Standards

No separate style or test-lifecycle finding. Applicable sources: AGENTS.md, code-review skill, docs/agents/tests.md, project rules 15/16/20/24/25/26/28, spend/lease/lock contracts and per-user-state documentation. New tests use scratchMachine/fixtureEnvironment and owned directories, injected process table and a single FakeClock, no child/provider/browser. New file is T1 and indexed with file-specific guidance. Existing executor-spend.test.ts is byte-unchanged. The shared pool parser is imported rather than copied; billing rate/minimum are persisted and reused from the admitted entry on renewal/settlement. No command, setting or permission change requires a role/help migration in this additive API item.

Identity finding below also conflicts with rule26's durable-admission identity principle: equal displayed/run/lease strings are not sufficient to equate different accounting owners.

## Spec

Medium — hub/src/executor/droplet/spend.ts:148 (also :254-259).
Category isolation is incomplete across both executor admission paths.
1. reserveHostSpend stores host lease X; reserveSpend sees any equal lease and returns before cap checking or writing a verify reservation. An executor is admitted without its own reservation, even when it should exceed the shared cap.
2. A host lease reserved:run followed by reserveShardSpend(project,['run']) passes the category-scoped missing check and appends another entry with the same durable project+lease key. reconcile at :36-42 coalesces these owners, keeping one entry and the maximum reservation rather than their sum. This loses reservation accounting. The existing regression uses the same run name but distinct final lease keys, so it does not exercise this collision.
Refuse conflicting durable host/executor identities before treating admission as idempotent or appending a row; keep valid same-run/different-lease behavior. Add red controls for direct native and exact reserved:<run> collisions, checking unchanged ledger bytes/accounting after refusal and reconciliation. Lead confirmed both paths (6f02e4ef and ee365b6c).
C2 fails: host reservations must count toward the shared executor cap without being mistaken for the executor's own entry.

Medium — hub/src/executor/droplet/spend.ts:351 (also :317-318 and totals :56).
settleHostSpend accepts Date.parse-valid timestamps but stores released without UTC normalization. Both totals and inspectHostSpend group using the raw text prefix. A release at 2026-10-31T23:30:00-02:00 is 2026-11-01T01:30Z; its settled cost is attributed to October and omitted from Nov1/shared-cap spend. Normalize accepted settlement instants to canonical UTC before durable publication (and compare identical-instant retries consistently), or explicitly refuse noncanonical values. Preserve byte/cost reconciliation and settled-finality behavior. Add an offset crossing both midnight and month, inspecting category, pool and shared-cap totals. Lead confirmed this gap (6f02e4ef).
C4 fails: period totals are specified in UTC.

No additional in-scope findings:
- Additive category/pool/rate/minimum fields retain ledger version1; absent categories mean verify. Reconcile spreads old entries, keeps conservative reservation/cost/release maxima and legacy write-through ordering/locks. New verify entries add explicit category; settlement and shard release are category-scoped.
- Host reserve calculates full held lifetime/minimum before locked cap admission. Renew uses persisted billing facts and subtracts its prior outstanding reservation before testing both caps; shorter renewals do not reduce it. Settled entries cannot renew, and conflicting final receipts are refused.
- Status excludes pending reservations and provides category/pool period buckets. UTC grouping defect above is the blocking issue.
- Required docs describe additive API, no enabled lifecycle integration, confirmed-absence settlement and unchanged compatibility. Pool grammar uses the shared exported parser.
- Rule20 inventory covers production droplet/watchdog/state-paths, direct static/dynamic importers, stored-shape fixtures, T3 safety/dry-run, nvim/web fixtures and docs; read search found no additional live consumer requiring a shape change. Keep executor tests unedited.

## Criteria and evidence

Failed: C2 (conflicting host/executor lease identities bypass or merge reservations); C4 (accepted offset settlements misgroup UTC costs).
C1/C3/C5 remain unverified at source-only pass. No criteria marked verified.

A-17484 reports local macOS Node24.21.0 targeted 137 passes/0fail/0skip including all20 unchanged executor-spend cases, plus typecheck/test lint/tier lint exit0; these are lead-reported summaries, not Reviewer execution or a full configured run. Missing-export/identity reds and a fixture-cap correction are documented historically, with no raw producer proof assessed in this pass. Required T3 executor-safety and suite-dry-run await the Coordinator slot. Configured verification has not run. Report-only lint122findings/59files and known T-1484 advisory are not enforced failures.

Correct both findings at a new head, retain original red/green producer outputs and current source linkage, then request fresh source review before submitting verification. No dev merge without Coordinator instruction. After-stage affected QA stays separate.

Standards: no separate finding. Spec: two medium findings.


A-17489: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17489-t-1742-source-review-reservation-identity-and-utc-settlement.md

Criteria: C2 failed (Host/native and exact shard lease collisions can bypass or merge reservations, understating shared-cap usage.), C4 failed (Date.parse-valid offset settlements are grouped by raw text rather than their UTC day and month.).

### rev-37 · 2026-11-07T16:17:28.316Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1742-source-2
commit: 4ba7d890269459f1840a99ac8bf9586b32caac15
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1742 corrected full source review

Head4ba7d890269459f1840a99ac8bf9586b32caac15.
Run rev-37-1742-source-2; scope full; clear; findings[].
Compared with2f123e77c07504a9d9f8e04f10c7b5296557dc12; one corrective commit, no dev merge. Original full source review A-17489 remains applicable with both findings resolved. Standards and Spec assessed in-session; Reviewer read only.

## Standards

No findings. Identity guards run inside the existing serialized ledger transaction before idempotent return or append. Native executor admission refuses any host-owned equal lease key; shard admission refuses a host-owned exact project+reserved:<run> key. This avoids both silent bypass and reconciliation coalescing distinct accounting owners. Existing same-run/different-final-lease behavior remains permitted. No new independent parser, lock order or billing authority is introduced.

Regression controls seed both primary/legacy state, require the exact conflict refusal, check primary bytes unchanged, then force locked reconciliation through inspectSpend and recheck four dollars outstanding plus unchanged bytes. Executor preservation file is unchanged. New tests remain T1 with scratchMachine/FakeClock and injected identity; docs explicitly list each control.

## Spec

No findings. Host settlement validates its lifetime/billing before normalizing the accepted instant with toISOString and persists canonical UTC. Equivalent-offset/UTC retries compare the same durable instant and cost. The month/midnight regression checks host category/pool today+month, shared-cap spent and refused executor admission at the cap, then same-instant retry and exact durable UTC timestamp.

A-17495 retained outputs quote the actual prior red: native and shard both 'Missing expected rejection'; offset total actual{today:0,month:0} vs expected{today:2,month:2}. Red8cases:5pass/3fail, exit1. Corrected host-spend8 + unchanged executor-spend20:28pass, zero fail/cancel/skip/todo, exit0, local macOS Node24.21.0. Artifact identifies red source2f123e77c and working correction; fresh request links corrected production/tests to4ba7d8902. These are retained targeted receipts, not configured suite evidence or Reviewer execution.

Original additive v1 reconciliation, absent-category verify behavior, pinned rate/minimum, both caps, monotonic renewal, confirmed-absence settlement contract and period buckets remain unchanged apart from the reviewed fixes. UTC and conflict behavior docs updated. No extra contract consumer change.

## Criteria and remaining evidence

C1-C5 remain runtime-unverified at source-only clear. Previous failed C2/C4 are repaired in source and done marks restored; final marks await exact-head configured evidence and required preservation.
Lead reports140direct-import T1/T2 passes and typecheck exit0 at corrected source; final test lint finishing when request sent. No configured verify or Linux/browser execution yet. Required T3 executor-safety and suite-dry-run await Coordinator's assigned slot afterT-1738; retain native commands, exits and output at this head.
Source clear permits mode-free cland verify at this exact head after required static/preservation checks and capacity grant. Any changed head needs source review first. Affected after-stage QA remains separate.

Standards0; Spec0 findings.


A-17502: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17502-t-1742-corrected-source-clear-at-4ba7d8902.md
