---
id: T-1302
kind: task
title: roles-timing's malformed-refresh case reads its clock before T-1230's async refresh completes
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1280
blocked_by: []
regression_of: T-1230
found_by: cover
topic: topic-1053
branch: t/T-1302-roles-timing-s-malformed-refresh-case
created: 2026-10-25T12:32:13.237Z
updated: 2026-10-25T12:50:41.037Z
---

## Summary

`hub/test/roles-timing.test.ts` "150 ms of malformed parsing plus 150 ms of failure logging counts as one 300 ms roles continuation" fails deterministically on dev since T-1230 (8acdd283): `assert.equal(result.clock, 300)` gets 0, because the roles refresh no longer completes within the single `setImmediate` the test waits after `mock.timers.tick(ROLES_REFRESH_MS)` (T-1230 made role-clause assembly's skill inventory asynchronous). It passes at 82cf0f6c and fails 5/5 at 8acdd283, c966b086 and 0026fcd0 (Coordinator, local macOS). T-1230's merge batch ran T1 only; the failure surfaced in T-521's rule 6 suite 55b87b2c (A-11908).

The fix waits on the refresh's own completion receipt (the `roles-unreadable` event, or a promise RolesFile exposes for its current refresh), not on a fixed number of event-loop turns, and keeps every assertion.

## Acceptance criteria

- [x] C1. The case passes in the item's mode-free verify on the Linux droplet (changed T3 file, once) and 5/5 locally at the fix head, with its four assertions unchanged; it waits on a refresh completion receipt rather than a counted setImmediate or a timer, and a negative control that skips the wait fails.
  - done: impl-1302 · 2026-10-25T12:49:50.141Z
  - verified: rev-26 [reviewer] · run rev-20261025-1302-evidence-1 · 2026-10-25T12:50:40.941Z · commit 2a54f3df714b68369d73c15cf8d5b2fb5db34859

## Comments

### impl-1302 · 2026-10-25T12:33:36.231Z

Initial inspection: clean task branch at 422fc48f; no prior uncommitted work. Confirmed specified seam: existing T3 roles-timing subprocess test, observing RolesFile's roles-unreadable event before stop/readback, retaining all four assertions. A-11669 traces T-1230 to roles/config.ts async inventory; no shared contract or production behavior changes needed. Will record existing failure as red/skip-wait control, use a bounded event receipt, run file five times locally, and obtain five Linux executions at reviewed head.

### rev-26 · 2026-10-25T12:37:41.695Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1302-source-1
commit: 2a54f3df714b68369d73c15cf8d5b2fb5db34859
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full in-session Standards/Spec source CLEAR, A-11913. Complete diff from ea47fdd6 plus heading-only correction inspected; M1 resolved, zero remaining findings. roles-unreadable observer armed before tick, resolved after logging, awaited before stop/drain and readback; RequestGuard/RolesFile sequencing checked. All four assertions unchanged, no production/API/dependency/policy change or timer/counting wait. Existing T3 sealed child has bounded case/abort coupling. A-11910 local red/negative/five-run summary and current corrected-head claims retain original head/source/capture limits; publish available original corrected-head five-run outputs without transcription reruns. C1 remains pending one mode-free Linux changed-T3 execution and required local evidence settlement; no extra Linux repetitions. No reviewer execution/delegation or QA/landing claim.

### impl-1302 · 2026-10-25T12:50:05.280Z

C1 completed at unchanged head 2a54f3df714b68369d73c15cf8d5b2fb5db34859. Exact Linux case receipt A-11932 lines 16081–16083: `150 ms of malformed parsing plus 150 ms of failure logging counts as one 300 ms roles continuation`, outcome pass, 0.15186727 s (corrects a mistyped duration in criterion call note). ba85511c mode-free droplet run: T0/all T1/fallback all T2/changed T3 once/Web exit 0, 3203 pass. Browser prepared Chrome Headless Shell 156.0.8078.4 (Playwright v1248); Linux x64 6.8.0-142-generic, Node v24.21.0. Remaining T3/T4 unrun; duration/lint gates report-only. Droplet c-8 lon1 lifetime 634 s, $0.0440. Corrected-head local 5/5 and skip-wait control evidence A-11918. Final evidence request sent; hub assigned reviewer rev-31.

### rev-26 · 2026-10-25T12:50:40.942Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1302-evidence-1
commit: 2a54f3df714b68369d73c15cf8d5b2fb5db34859
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR, A-11933; carry source-1/A-11913. A-11932 independently parsed: 3203 ordinary test passes / 441 files, exact changed T3 case once at 0.151867270 s, no load repetitions. T0/all T1/fallback all T2/changed T3/Web green on Linux x64; docs guard 3/3. A-11918 original copied response excerpts establish corrected-head local 5/5 and restored skip-wait control exit1 at clock0!==300, with explicit source/capture/omitted-stack limits and no transcription reruns. All four assertions unchanged and receipt-before-stop/drain verified. Host prepared-tree check and report-only timing/lint diagnostics separately attributed; broader T3/T4/QA/landing not claimed. C1 done checked and verified; zero findings. Coordinator owns enqueue/merge and affected after-stage QA.

Criteria: C1 verified.
