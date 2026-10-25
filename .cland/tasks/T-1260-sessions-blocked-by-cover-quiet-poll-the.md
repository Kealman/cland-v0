---
id: T-1260
kind: task
title: Sessions blocked by cover-quiet poll the verify queue with sleep loops, because nothing wakes them when the local slot frees
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1283
blocked_by: []
topic: topic-1042
branch: t/T-1260-sessions-blocked-by-cover-quiet-poll-the
created: 2026-10-24T19:41:53.006Z
updated: 2026-10-25T13:26:57.488Z
closed: 2026-10-25T13:26:57.488Z
---

## Summary

While an integrated run holds the local slot, local test commands refuse with `cover-quiet: … wait for it to finish`, and the Implementer clause says "On cover-quiet, wait". Nothing notifies a waiting session when the slot frees, so agents poll. On 2026-10-24 at 19:37–19:42Z, impl-619b (OpenCode) ran `sleep 120`/`sleep 150; cland verify queue` loops during the macOS stage cover 0ab35c7d. That spends turns and money, and the human noticed. The coordinator had to tell the session to stop and wait for a message.

## Acceptance criteria

- [x] C1. A session refused by cover-quiet gets a one-shot event when the local slot frees (a subscription or a queued targeted-run admission), and the refusal text names it instead of "wait" (test).
  - done: impl-1260 · 2026-10-25T11:10:26.454Z
  - verified: rev-26 [reviewer] · run rev-20261025-1260-evidence-1 · 2026-10-25T11:29:05.995Z · commit a6ab11b27ce0bd4a9ba16a588ea32070b4f20218
  - verified: rev-34 [reviewer] · run rev-34-20261025-1260-final · 2026-10-25T11:45:25.691Z · commit a9ed1bfca73ba0c2dae386d84f0e1ccb257aeda2
  - verified: rev-34 [reviewer] · run rev-34-20261025-1260-final2 · 2026-10-25T13:20:56.887Z · commit 3fd60e915b35c015e7c15cbfa49cf355a2584537
- [x] C2. The Implementer clause and docs/agents/tests.md#cover-quiet say to do other work or end the turn until that event arrives, with no polling, and the clause stays within its byte reserve (test).
  - done: impl-1260 · 2026-10-25T11:15:23.203Z
  - verified: rev-26 [reviewer] · run rev-20261025-1260-evidence-1 · 2026-10-25T11:29:05.995Z · commit a6ab11b27ce0bd4a9ba16a588ea32070b4f20218
  - verified: rev-34 [reviewer] · run rev-34-20261025-1260-final · 2026-10-25T11:45:25.691Z · commit a9ed1bfca73ba0c2dae386d84f0e1ccb257aeda2
  - verified: rev-34 [reviewer] · run rev-34-20261025-1260-final2 · 2026-10-25T13:20:56.887Z · commit 3fd60e915b35c015e7c15cbfa49cf355a2584537

## Comments

### impl-1260 · 2026-10-25T11:04:27.842Z

Initial inspection: inherited worktree is clean. C1 seam: authenticated public suite.slot/check requests and the resulting durable hub notice, tested with projectHub + FakeClock (T2); C2 seam: shipped/default and project role clauses plus tests.md wording/byte reserve (existing T1 roles-clauses test). No new process or browser test is needed. Consumer inventory in progress before changing admission behavior.

### impl-1260 · 2026-10-25T11:05:10.145Z

Rule 20 consumer inventory (rg across production, shared wire, all tier manifests/tests, nvim/web, skills, QA and docs): suite.slot/check is dispatched in hub/src/hub/dispatch.ts to Suites.checkSlot; hub/src/protocol.ts and shared/wire/index.ts define the unchanged request. test-support/admission.ts (hub compatibility export) sends the previous wire shape through shared/socket-client.ts; hub/test/cover-quiet.ts, account-fixture-env.ts, run-suite.ts and nvim/test/fixture.ts consume it. suite.slot reservations in run-suite.ts, suite-human-component, suite-remote-budget and web area-slots/phone-sessions/verification are unchanged (no check field). web-authority and its test keep denying the frame on web sockets. T2 test-admission and T3 cover-quiet assert refusal/error prefixes; keep them compatible and add a previous-hub refusal regression. Test discovery/tiers/durations/lint metadata and startup reply probes carry no new fields. No new wire field or refusal class: only an authenticated check refusal additionally persists a one-shot session-id subscription and names its existing hub-report event. Existing callers without session identity remain read-only and get actionable coordinator guidance. Persisted readers: new internal metadata key only, old suite job and queue schemas untouched. Shipped role/default/project clauses, implement skill, tests.md, hub README/help will describe the new flow. Historical QA briefs (E-387 through E-1212 plus T-275) use unchanged check shape/cover-quiet prefix or human quiet helpers; no frame migration needed. E-1283 after-stage QA can exercise new targeted session notice; no per-item QA brief required.

### rev-26 · 2026-10-25T11:14:49.974Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1260-source-1
commit: b8da3092392e057d6eaf3c126ca4f1e588d8fdd6
scope: full
findings: [{"severity":"medium","text":"M1: replace '# Test admission' with '# hub/test/test-admission.test.ts'; unchanged test-docs guard requires the exact test file heading and rejects this commit.","file":"docs/agents/tests/hub-test-test-admission.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full in-session Standards/Spec source audit is complete. A-11786 contains the consolidated review and evidence limits. M1 only: new per-test guide heading violates the unchanged docs guard. No additional Spec source finding. Pending worktree correction and reported guard red/green are not part of this commit. Request fresh committed source review before configured verification; preserve original local receipts with capture/source limits.

Criteria: C2 failed (New per-test documentation fails the existing exact-path heading guard; corrected committed source and configured evidence are pending.).

### rev-26 · 2026-10-25T11:15:41.292Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1260-source-2
commit: a6ab11b27ce0bd4a9ba16a588ea32070b4f20218
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source audit A-11786 carried forward; sole-parent correction changes only the exact-path guide heading and resolves M1. A-11788 original red/green excerpts and capture limits inspected. Both axes clear; A-11789 records correction review. C1/C2 final runtime marks remain pending ordinary mode-free configured verification at this exact head; no configured or QA pass claimed.

### rev-26 · 2026-10-25T11:29:05.995Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1260-evidence-1
commit: a6ab11b27ce0bd4a9ba16a588ea32070b4f20218
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR, C1/C2 verified. A-11803 carries source-2/A-11789 and independent A-11801 native finish audit: 3155 ordinary passes/439 file records plus ten actual load tests, both new admission identities 5/5. Exact durable one-shot addressed-spoke/restart/dedup assertions pass base 0.379066082 s, worst load 0.424728144 s; old-hub refusal compatibility also passes. Clauses 39/39 establish default/project no-polling wording, byte and growth reserve; docs guard 3/3, help 3/3, frozen usage 1/1 pass. Linux droplet T0/all T1/fallback all hub+Neovim T2/Web, no T3/T4/occasion/stage QA claim. Prepared host tree c4ec8fdd not repeated remotely. Existing budgets/lint report-only, not timing compliance. Coordinator owns landing and affected after-stage QA.

Criteria: C1 verified, C2 verified.

### rev-34 · 2026-10-25T11:32:32.906Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1260-source3
commit: a9ed1bfca73ba0c2dae386d84f0e1ccb257aeda2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear at a9ed1bfc after authorized dev 8fa66512 merge (Coordinator 6f72bb55 confirmed). Carry full A-11786/source2 A-11789. Both-parent conflict resolution preserves verify --help|-h and cover-quiet/no-polling guidance; immutable parsing confirms production/frozen SUITE_USAGE byte equality and only that frozen block differs from incoming dev. Guards/template/composition intact. Task registration/report/admission semantics unchanged; inspected inherited verification authorization refactor against suite.slot/check. Standards: no findings. Spec: no findings. C1/C2 require new same-head configured runtime evidence; prior A-11801 remains old-head only. A-11810 local outputs are supplementary, not a configured pass. No Reviewer execution. Coordinator owns extra pre-merge all verification and stage QA.

### rev-34 · 2026-10-25T11:45:25.691Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1260-final
commit: a9ed1bfca73ba0c2dae386d84f0e1ccb257aeda2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear. Run a114cce7 / A-11836 passed 3157 ordinary tests, no failures/cancellations/skips/todos. T0 host-worktree check passed; prepared host tree 83a3c233 is not a source commit and remote typecheck was not repeated. Linux x64 droplet T1/fallback all hub+Neovim T2/Web completed, Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell 156.0.8078.4 (v1248). No T3/T4/occasion/stage QA. Checked exact durable wake-up/restart identity and previous-wire refusal identity, ordinary passes plus each 5/5 load receipt; all four admission cases pass. Clauses 39/39 include default/project no-polling wording, reserve and growth-headroom assertions; help 3/3, frozen usage 1/1, docs 3/3 pass. Source3 plus full prior source audit and these records establish C1/C2. Budget/lint warnings remain report-only. No findings or Reviewer rerun. Coordinator retains extra pre-merge all verification and stage QA.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T13:03:17.858Z

Rule 6 pre-merge verify all 271ff6ea at a9ed1bfc (A-11951): 4049 passed, 3 failed, 5 skipped across T0–T3 (Web not reached; covered by mode-free a114cce7). All three failures are known dev defects with matching messages, none from T-1260: suite-selection 'task admission selects unchanged T4 guards…' (invalid loadGuards, T-1299, landed after this head's dev merge); roles-timing '150 ms of malformed parsing…' (0 !== 300, T-1302, landed after); qa-lint-build 'qa lint validates named titles from a production install…' (ERR_MODULE_NOT_FOUND shared/protocol-frame.ts, T-1303 open, culprit T-1225). Coordinator accepts this run as T-1260's rule 6 evidence with those attributed identities.

### rev-34 · 2026-10-25T13:08:49.140Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1260-source4
commit: 3fd60e915b35c015e7c15cbfa49cf355a2584537
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear after second authorized merge; A-11957 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11957-t-1260-second-merge-source-review-at-3fd60e91.md). Coordinatorca9ecd64 authorizes merge and specifically waives repeat rule6all in favor of matching local files/new mode-free verify. SUITE_USAGE retains both task wake-up and incoming watchdog sentences; frozen owning row equals resolved literal, all other incoming help/frozen blocks retained. Task behavior core unchanged from source3. A-11954 records11serial full local files/132passes and typecheck; not configured/Linux/QA proof. Prior all-run remains failed with attributed defects, not reclassified green. C1/C2 remain pending same-head configured evidence; after-stage affected QA separate.

### rev-34 · 2026-10-25T13:20:56.887Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1260-final2
commit: 3fd60e915b35c015e7c15cbfa49cf355a2584537
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final second-merge evidence clear:df54906c/A-11969; audit A-11970 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11970-t-1260-second-merge-final-evidence-at-3fd60e91.md), carrying source4/A-11957. Parsed3209ordinary+10load passes. Exact durable wake-up/restart and previous-hub refusal each ordinary+5/5load;4admission/39clause checks pass, preserving wording/reserves. Merged help/compatibility/docs guards green. HostT0/LinuxT1/allT2/Web complete; T3/T4/stageQA absent, prepared host check not repeated remotely. Report-only warnings preserved. Historical all-run remains failed/attributed; Coordinatorca9ecd64 explicit repeat-all waiver distinct from this passing configured receipt. C1/C2 verified, no findings; after-stage affected QA separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T13:26:57.488Z

Merged d1f480070c1ee1656dc98358ca2612a3bfe6978a onto dev.
