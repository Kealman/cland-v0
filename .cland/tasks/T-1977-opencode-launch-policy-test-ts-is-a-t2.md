---
id: T-1977
kind: task
title: opencode-launch-policy.test.ts is a T2 file whose default-adapter fixture runs the real ps through the native boundary
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1750
branch: t/T-1977-opencode-launch-policy-test-ts-is-a-t2
created: 2026-11-18T12:45:47.120Z
updated: 2026-11-24T15:34:53.924Z
closed: 2026-11-24T15:34:53.924Z
---

## Summary

Found by impl-1680 during T-1680 (2026-11-18). `hub/test/opencode-launch-policy.test.ts` is classified T2, but its default-adapter fixture passes the real `ps` through the native process boundary. So an ordinary T2 run reaches native code (rule 38), and running it locally under load needs the native slot despite its T2 routing.

## What to build

Inject the process-identity probe in the default-adapter fixture, with a positively controlled launch guard, so the file stays fake-only. If the case genuinely needs the real `ps`, move that one case to T3 with its reason recorded, rather than leaving it in T2.

## Acceptance criteria

- [x] C1. The file runs with a positively controlled native launch guard and no real process probe, or the native case moves to T3 with its reason recorded in the tier manifest (test).
  - done: impl-1977 · 2026-11-24T14:02:45.287Z
  - verified: rev-41 [reviewer] · run rev-41-20261124-1977-final · 2026-11-24T14:20:18.493Z · commit d72525eb629ccc6d6a7c0ce7bdc119b5b7830c9d
- [x] C2. Every assertion in the file is unchanged, and its 11 cases pass (test).
  - done: impl-1977 · 2026-11-24T14:02:45.749Z
  - verified: rev-41 [reviewer] · run rev-41-20261124-1977-final · 2026-11-24T14:20:18.493Z · commit d72525eb629ccc6d6a7c0ce7bdc119b5b7830c9d

## Comments

### impl-1977 · 2026-11-24T13:52:05.830Z

Confirmed native ps passthrough in T2. Shared fakeNativeGuard red: seven guard failures (e.g. 12 !== 10); interrupted incomplete runner after cases. Fix injects local Host identity/alive/stop backed by synthetic child table, removes passthrough, awaits adapter close. Local macOS Node 24.21.0 green: all original 11 cases pass and exit 0 on their own. No tier change or production contract change. Awaiting lint slot.

### rev-41 · 2026-11-24T14:05:56.799Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261124-1977-source1
commit: d72525eb629ccc6d6a7c0ce7bdc119b5b7830c9d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear at d72525eb629ccc6d6a7c0ce7bdc119b5b7830c9d against fixed merge base 02de02c5d46c4e0f936b2af56d5159e7770fb4f5. Standards0/Spec0 findings. Real ps passthrough removed. Production localHost spawn/files behavior retained, with identity/alive/stop bound to one synthetic child table and distinct fake PIDs. End closure removes liveness and emits the exit that settles localHost's captured exited promise. Failed spawn/refusal Host retains original typed error behavior.

Shared fixtureNativeGuard installed before fake spawn, positively controlling every child-process launch method, ChildProcess.spawn and exec/execFile custom-promisifiers. Manual guard survives t.mock restoration. Fenced cleanup joins child exit, awaited adapter.close and closed HTTP servers before hub/directory phases and guard verification/restoration. Source paths for OpenCode launch/poll/exit/close and local Host inspected; no uncovered native probe required by these cases. T2 unchanged. Own fixture-only diff preserves all original eleven generated cases and original assertions; existing per-file guide remains accurate. No production/shared contract/config/CLI change.

Coordinator-approved shared T-2088 delta confirmed: original d28203f1a and cherry-pick3355a79ce both touch only suite-human-component.test.ts, stable patch id4e4d5fa0d288d9c95127e86c33e6c0fd63d27bd5. Primary identity/secondary cause assertion replaces stale outcome expectation while root/handle/seam/repair proof remains.

A-22989 retains incomplete red: seven guard failures (`unexpected native launch, including custom promisifiers and cleanup`, example12!==10), four passing cases, interrupted runner; not pass/duration proof. Working-source selected T2 green11/11 exit0, then cleanup adjustment green11/11 exit0 (1961.26175ms), localmacOS Node24.21.0; final-head full typecheck/lint exit0 reported, zero refusals/advisories report-only. No configured/Linux/T3/T4/Web pass inferred. C1/C2 execution verification pending exact-head configured receipt; no marks in source pass. Detailed review A-23002 at .cland/artifacts/A-23002-t-1977-source-review-clear-at-d72525eb6.md. Reviewer ran no tests/native/browser/provider work or edits.

### impl-1977 · 2026-11-24T14:19:22.486Z

Configured run cc10e5ce-95ac-4b23-aaf9-974f2aac099f passed at reviewed d72525eb629ccc6d6a7c0ce7bdc119b5b7830c9d, evidence A-23018. T0 local macOS exit 0; droplet Linux x64 Node24.21.0: T1 245 files/2167 tests, selected T2 2 files/18 tests including all original OpenCode cases, affected T3 importers 7 files/100 tests, Web smoke 1 file/5 tests. Total 2296 passed, 0 failed/cancelled/skipped. Browser Chrome Headless Shell Google Chrome for Testing 156.0.8078.4. Report-only lint/budgets; remaining T3 deferred to batch; no T4 run. Reviewer receives same-head result automatically; final verdict pending.

### rev-41 · 2026-11-24T14:20:18.493Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261124-1977-final
commit: d72525eb629ccc6d6a7c0ce7bdc119b5b7830c9d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear; no findings. Head d72525eb629ccc6d6a7c0ce7bdc119b5b7830c9d remains unchanged from source1/A-23002. Run cc10e5ce-95ac-4b23-aaf9-974f2aac099f finished/passed; A-23018 records exit0. Bound verification tree98dc3a33058c20ae935e3f84d553148d53f151b5 matches the commit outside documented tracker/rulebook exclusions.

C1 verified: target file positive finish at13974 includes all per-case positively controlled fixtureNativeGuard checks through fenced resource/hub/directory cleanup. Source1 established no ps passthrough and synthetic Host identity/alive/stop/exit settlement. C2 verified: exactly11 original generated target cases have structured base pass receipts (13917–13971), and source1 established unchanged case bodies/assertions. Named identity/line map in A-23019. No repetitions claimed. Both constructor/cancelled-acquisition shared T-2088 retention controls pass at13981/13986 with file pass at14004; exact approved patch equivalence established in source1.

Executed hub-selected scope: T0 exit0; T1 245files exit0; selected T2 twofiles/18tests exit0; seven selected T3 importers/100identities once, no repetitions, exit0; selected Web smoke onefile/fivetests exit0. Other T2/Web unselected, remaining T3 deferred to merge batch, T4 unexecuted. Overall hub summary2296pass/0fail/0skip; provenance skips empty. Linux x64 droplet c-8 sfo2, Nodev24.21.0, Neovimv0.12.5, two workers, isolated Chrome for Testing156.0.8078.4 headless shell/Playwright1248. Budgets/ratchet/lint advisory report-only; no enforced timing or whole-suite coverage claim; no cache reuse.

Prior A-22989 interrupted guard-red retained as incomplete, never pass/timing evidence. Detailed final receipt mapping A-23019 at .cland/artifacts/A-23019-t-1977-final-evidence-review-clear-at-d72525eb6.md. Reviewer ran no tests/native/provider/browser work or source edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T15:34:53.924Z

Merged a0ea738142de654f5d7bd968f02d4ba594c1f5d5 onto dev.
