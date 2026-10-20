---
id: T-991
kind: task
title: The web phase of the suite
state: open
status: review
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-990
  - T-978
  - T-980
  - T-1025
topic: topic-768
branch: t/T-991-the-web-phase-of-the-suite
created: 2026-10-20T16:51:40.483Z
updated: 2026-10-20T21:01:57.666Z
---

## Summary

The suite gains a `Web` shard after the hub phase on `node:test` with `playwright-core` and Chrome Headless Shell, with the fixtures from the stack research. A `web-only` selection runs it for diffs inside `web/**` with the hub's and Neovim's smoke files. The first browser test opens the shell through the hub's web edge (T-978, T-980); there is no development bridge (Coordinator proposal, approved with the plan).

## What to build

- **The shard.** The `Web` shard has resource `machine` and runs two workers locally.
- **The fixtures.** `web/dist` is built once per run, and each test file gets a scratch hub through the hub harness and a one-time link minted with `web.link` on the hub's web edge. Each file has one browser and each test a fresh context, all closed explicitly. A `Notification` stub goes in through an init script. A failure saves a trace. Paths under `TMPDIR` are kept short.
- **The waits.** The waiting helpers poll through `page.evaluate`, so the strict CSP stays on.
- **Selection.** Diffs inside `web/**` select `web-only`, and the protocol and edge files keep forcing `full`. One web smoke file joins the other modes' smoke.
- **Budget.** The phase has a 40-second budget on a full run. Its tier placement is the tier the human set with this epic's plan approval (recorded as a comment on E-415).
- **Docs.** `web/README.md` and `docs/agents/tests.md` say how to run the phase.

## Acceptance criteria

- [x] C1. A local `npm test` run on this branch reports a `Web` shard after the hub phase, with resource `machine` and two workers, on `node:test` with `playwright-core` and Chrome Headless Shell (run log).
  - done: impl-991 · 2026-10-20T21:01:36.886Z
- [x] C2. The fixtures build `web/dist` once per run, start a scratch hub per file, mint a one-time link by a frame, use one browser per file and a fresh context per test, stub `Notification`, save a trace on a failure and use short `TMPDIR` paths (fixture tests).
  - done: impl-991 · 2026-10-20T20:39:07.096Z
- [x] C3. A browser test opens the shell through a `web.link` link on the hub's web edge, reads the rail's seven areas, and records no request that leaves the origin.
  - done: impl-991 · 2026-10-20T20:39:07.111Z
- [x] C4. The waiting helpers poll through `page.evaluate`, and a test shows the strict CSP still blocks an inline script.
  - done: impl-991 · 2026-10-20T20:39:07.127Z
- [x] C5. A diff inside `web/**` selects `web-only`, which runs the web phase with the hub and Neovim smoke files, while a protocol or edge file forces `full` (suite-selection unit tests).
  - done: impl-991 · 2026-10-20T20:46:21.214Z
- [x] C6. The web test files carry the tier the human set with this epic's plan approval (recorded as a comment on E-415) in `hub/test/tiers.json` and `hub/test/durations.json`, and the tier lint passes.
  - done: impl-991 · 2026-10-20T20:39:07.162Z
- [x] C7. No browser or scratch hub process outlives the run (the fixture-process census).
  - done: impl-991 · 2026-10-20T20:39:07.178Z
- [x] C8. `web/README.md` and `docs/agents/tests.md` describe the web phase, `web-only` and how to run the browser tests.
  - done: impl-991 · 2026-10-20T20:39:07.198Z
  - verified: rev-23 [reviewer] · run rev-20261020-991-source · 2026-10-20T20:40:49.973Z · commit ecef1178de41c736368d46902cf2131933550d9b
  - verified: rev-23 [reviewer] · run rev-20261020-991-source-2 · 2026-10-20T20:45:59.562Z · commit f91734ad6e72308910b9e4f0835c638801a1a96e
  - verified: rev-23 [reviewer] · run rev-20261020-991-source-3 · 2026-10-20T20:46:39.027Z · commit 3329bf70c59362fd6c7eab98e4a0ef257aaf87aa
  - verified: rev-23 [reviewer] · run rev-20261020-991-source-4 · 2026-10-20T21:01:57.666Z · commit 5fd7df53604a63f30074cf9b4e340365cbe2b128

## Comments

### impl-991 · 2026-10-20T19:20:47.518Z

Implemented separate Web classification, task/occasion cadence and web-only selection, isolated Headless Shell browser fixtures with real web.link auth/CSP/origin assertions, failure traces and teardown census, plus matching help/docs/skills/clauses. Targeted macOS arm64 smoke currently passes (4 assertions including nested cases; latest top-level 0.857 s, browser group 4→0). Typecheck and planner compatibility checks in progress; source review precedes hub verification.

### impl-991 · 2026-10-20T19:24:27.931Z

Coordinator split the expansion/bootstrap into T-1025. Published planner patch A-7991 (base fe05d55fbed2b9965c621ac91f9e1b1639a78599), removed its source delta from this worktree, and kept only browser dependency/fixtures/smoke/docs changes. A-7992 records pre-cover targeted/check evidence. Blocked pending T-1025 landing, Web-aware hub restart and Coordinator instruction to merge dev. Local tests held by the active stage-cover quiet rule; final fixture cleanup refinements are source-only and need revalidation afterward.

### rev-23 · 2026-10-20T20:40:49.973Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-991-source
commit: ecef1178de41c736368d46902cf2131933550d9b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-991 source review

Head ecef1178de41c736368d46902cf2131933550d9b; tree d12115efb261138c334cb62396ff43121971a79d. Fixed base 44097bad. Reviewed the 17-file browser slice against C1–C8 and the already-landed T-1025 planner.

## Standards
No findings. playwright-core is exactly pinned at 1.64.1 in package and lockfile. Installer uses a disposable cwd, short temporary directory and shared filtered environment; the checkout-local Headless Shell path is resolved from that pinned package's manifest. Fixture launches precisely the probe-returned executable, asserts the dedicated profile/process group, and has no real-browser fallback. Linux library inspection is bounded and uses a sealed scratch environment without launching a browser.
One scratch projectHub and browser are owned by the file's fixture; each sequential case creates and explicitly closes a fresh context. Browser exit observation is armed before shutdown. Cleanup retains the shared process owner, guarded graceful close, reaped-PID and empty-group assertions, then stops the hub and checks its socket edge refuses. Temporary directories are removed by the existing ownership framework after resource cleanup.
The request observer is installed before navigation. CSP-safe DOM waits retain a final assertion; the deliberate inline script has its violation observer installed first. Failure tracing closes its context even on error. Root prepare/install, build-once integration, tool typechecking, tier manifest, baseline provenance, docs/skills/clauses and upstream skill changes metadata are consistent. Diff check is clear.

## Spec
No findings. C2–C4 cover real one-time web.link trade, scoped HTTP-only cookie, rejection of a spent link, seven ordered rail areas, self-hosted font requests, no external origin requests, Notification stub, context isolation, strict inline-script CSP and planted-failure trace ZIP/cleanup. C7 includes actual browser PID/group census and hub-edge teardown assertions. The fixture relies on the existing T-1025 build-once runner seam rather than rebuilding per test.
C5 selection/smoke boundaries and C6 separate Web classification and 4-second/test, 40-second/phase budgets use the landed expansion; the new smoke entry is Web, outside T0–T3. C8 matching web/README.md and docs/agents/tests.md explicitly describe installation, targeted and queued runs, web-only cadence, isolation, waits, traces and machine-unavailable non-passing evidence.

## Authority and evidence
E-415's human-approved plan comment approves playwright-core/Headless Shell and separate Web cadence/budgets; its browser rule prohibits the human's real browser/profile. Coordinator decision c3676be5-0ce1-48bf-8ff5-b26cd14b0eef explicitly authorizes this task's mode-free --executor local verification after the expansion/restart and cover-quiet.
A-8044 retains the local macOS arm64 targeted browser output for source committed as this head: four node:test results (one parent plus three subtests) passed, parent 1.076878416 seconds, browser census four to zero and scratch hub stopped. This is targeted source evidence, not the formal C1 phase receipt or a full-suite pass. A-8008/A-8009 are earlier baseline evidence; their attribution is historical. Lead reports npm install/check/tier lint success; budget/test lint policy is report mode. Reviewer launched no browser, tests, compiler or product process.

## Verdict
Source clear; verify C8 by source only. C1–C7 formal runtime settlement awaits the normal same-head locally authorized cland verify result, including actual Web execution. Machine-unavailable evidence cannot satisfy browser criteria. After-stage affected QA remains separate.
Standards 0 findings; Spec 0 findings.

Criteria: C8 verified.

### rev-23 · 2026-10-20T20:42:29.539Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-991-final-red
commit: ecef1178de41c736368d46902cf2131933550d9b
scope: evidence
findings: [{"severity":"medium","text":"Browser instruction increases default implementer reply to 6654 bytes, above the enforced 6528-byte reserve.","file":"hub/src/roles/default-roles.ts","line":161},{"severity":"medium","text":"First Web classification activates intended smoke/command coverage, but three task selector fixtures and verification-commands.test.ts:67 still expect no Web entry; all four fail.","file":"hub/test/suite-task-selection.test.ts","line":51}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-991 failed local task gate

Head ecef1178de41c736368d46902cf2131933550d9b. A-8047 / run 6b2b7f22-6831-4c12-9440-c0320e2fd99a exited 1 on the Coordinator-authorized local Darwin arm64 executor.

## Standards
Medium M1 — hub/src/roles/default-roles.ts:161: the added browser instruction exceeds the frozen clause reply reserve. Actual failure:
```
defaults implementer: clause reply is 6654 bytes; 15% growth headroom requires at most 6528 of 7680 bytes
```
Keep the browser guidance/pointer and required permissions while shortening procedure text through the established skill/docs flow; do not weaken the reserve assertion.

## Spec
Medium M2 — hub/test/suite-task-selection.test.ts:51 (also :92/:99 and verification-commands.test.ts:67): activating the first Web manifest entry leaves whole-repository task/command fixtures expecting pre-Web results. Actual failures show:
```
+   'web/test/smoke.test.ts'
```
and:
```
T4: 'node hub/test/run-suite.ts --tier T4',
+ Web: 'node hub/test/run-suite.ts --tier Web'
```
This is the intended expansion becoming active, but four existing integration assertions were not updated to retain exact T1/T2 selection and separately assert Web inclusion/command coverage. Refresh those expected facts without dropping T3/T4 exclusion or no-Web compatibility coverage.

## Evidence
Parsed ordinary finish records: 666 tests completed, 661 pass / five fail; 113 files, 110 pass / three fail. There are no load-gate finish records. Only T1 executed and failed. T2 and Web are projected/not executed, not passing or zero-duration coverage. Node v24.21.0 and Neovim v0.12.5, local Darwin arm64; ordinary machine policy four workers, planned Web two workers. Test lint 131/59, duration diagnostics, baselines and ratchet are report-only; these assertions enforce. Earlier targeted browser evidence A-8044 remains separate and cannot satisfy C1's formal Web phase.
No Reviewer tests, browser or product process launched.

## Verdict
Not clear. C1 fails because the run never reaches its required Web phase; C5 fails its repository selector integration tests. Other runtime criteria remain unsettled. These are task-local activation/clause corrections, not a remote-library failure or shared flake. A changed head needs fresh source review before a new normal mode-free locally authorized verify.
Standards 1 medium finding; Spec 1 medium finding.

Criteria: C1 failed (Local gate fails T1 before the required Web phase executes; default implementer clause exceeds reserve and repository Web activation expectations are stale.), C5 failed (Three repository task-selector assertions reject the newly selected Web smoke file; command inventory also lacks expected Web command.).

### rev-23 · 2026-10-20T20:45:59.562Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-991-source-2
commit: f91734ad6e72308910b9e4f0835c638801a1a96e
scope: full
findings: [{"severity":"low","text":"Combined human-sign-in pointer targets #web-phase; the explicit human-only cland web instructions are under #browser-sign-in-fixtures. Keep a human-only qualifier or point to that matching section; runtime enforcement is unchanged.","file":"hub/src/roles/default-roles.ts","line":161}]
finding_counts: {"high":0,"medium":0,"low":1}

# T-991 corrected source review

Head f91734ad6e72308910b9e4f0835c638801a1a96e; tree 862741bc081fe42f2791ea1bf8ada3a3db8d66da. Four-file correction since ecef1178; no dev merge. Original browser fixture/probe/test/dependency source is unchanged.

## Standards
Low L1 — hub/src/roles/default-roles.ts:161 (also project implementer clause): the combined “Web fixtures and human sign-in” pointer targets docs/agents/tests.md#web-phase, while the explicit human-only cland web instruction is under #browser-sign-in-fixtures. Retain an explicit human-only qualifier or point that part to its matching section. Runtime human-only authorization is unchanged, so this documentation navigation issue does not block source clearance.
M1's byte-reserve source cause is resolved by shortening the clause; the reserve test itself is unchanged. Existing implementer skill and full docs still state the browser isolation/sign-in workflow. Diff check is clear.

## Spec
No remaining medium/high findings. M2 is resolved: the task-plan fixtures assert exact separate Web phases and preserve unchanged exact hub/Neovim T1/T2 expected files; they explicitly reject Web leakage into T1/T2 executable commands. The split-command fixture now includes Web feature/smoke and compares the complete split with the combined plan while excluding T3/T4. The command-capability fixture models a real Web manifest/file and runner capability and expects the pinned Web command. No browser assertions or no-Web compatibility tests are removed.
C8's requested README/test docs remain source-established and unchanged.

## Evidence and verdict
A-8049 explicitly attributes targeted checks to fix working source later committed as f91734ad: local macOS arm64 roles-clauses 27/27, suite-task-selection 8/8 and verification-commands 14/14. It reports npm run check and zero lint refusals, under existing report policies. These are targeted/static checks, not a full gate; A-8047 remains failed history. Reviewer executed no tests or browsers.
Source clear with L1 retained; verify C8 only. C1–C7 await the new same-head mode-free locally authorized gate after QA releases the Mac. C1/C5 claimant done marks were cleared by the failed verdict and still need refreshing; source clear is not runtime proof. After-stage QA remains separate.
Standards 1 low finding; Spec 0 findings.

Criteria: C8 verified.

### rev-23 · 2026-10-20T20:46:39.027Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-991-source-3
commit: 3329bf70c59362fd6c7eab98e4a0ef257aaf87aa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-991 wording source review

Head 3329bf70c59362fd6c7eab98e4a0ef257aaf87aa; tree ba9bec4a336a84569e1faaf845953d9935812332. Only the default and project implementer pointer lines changed since source-reviewed f91734ad.

## Standards
No findings. Both pointers explicitly restore “human-only sign-in”, satisfying L1's qualifier option while retaining the Web fixture documentation pointer. The precise sign-in procedure remains under #browser-sign-in-fixtures elsewhere in the same test documentation; this wording does not change runtime permissions. The reserve guard remains unchanged; lead reports 27/27 serial targeted local role-clause tests.

## Spec
No findings. Browser implementation, plan assertions, manifests, dependencies and requested README/test docs remain unchanged from A-8046/A-8050. All prior findings are source-resolved. C8 remains established by source.

## Verdict
Source clear, verify C8 only. C1–C7 await the new same-head Coordinator-authorized local mode-free gate after QA releases the Mac. Prior ecef1178 gate is failed history; no current full passing receipt exists. Claimant C1/C5 done marks have been refreshed. Reviewer ran no tests or browsers.
Standards 0 findings; Spec 0 findings.

Criteria: C8 verified.

### rev-23 · 2026-10-20T21:00:46.064Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-991-final-red-2
commit: 3329bf70c59362fd6c7eab98e4a0ef257aaf87aa
scope: evidence
findings: [{"severity":"medium","text":"Repository-sized fixture rewrites all paths to hub/test while preserving Web tier, yielding invalid hub/test/case-0522.test.ts Web classification and premature verify-tiers failures.","file":"hub/test/suite-admission-cost.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-991 second failed local gate

Head 3329bf70c59362fd6c7eab98e4a0ef257aaf87aa. A-8057 / run 3ebfee8e-9118-4cef-876c-463b76759ce8 exited 1. The previous clause and T1 planning findings are resolved: T1 now passes.

## Standards
No new standards finding. Actual failure output:
```
AssertionError [ERR_ASSERTION]: verify-tiers: Web classification requires a web/test path: hub/test/case-0522.test.ts
```
Other admission assertions receive actual 'verify-tiers' instead of expected 'verify-test-lint'; these follow from the same invalid synthetic manifest.

## Spec
Medium M3 — hub/test/suite-admission-cost.test.ts:22: repository-sized fixture rewrites every manifest path to hub/test/case-N.test.ts but preserves each source tier. The first real Web classification therefore becomes a Web test under hub/test, which the correct tier lint refuses before the behavior under test. This produces five completed failure records in the same fixture family (including its parent result); it is a task-triggered Web activation compatibility gap, not a timing flake. Preserve a valid path/class relationship and repository-scale cardinality while retaining the original lint-refusal, deadline, diagnostics and no-reservation assertions; do not weaken the production Web classifier.

## Evidence and verdict
T1 exited 0; hub T2 executed and exited 1. Ordinary totals reported are 1,845 tests, 1,840 pass / five fail; Neovim and Web did not execute, and no projected Web timing is a receipt. Actual executor local Darwin arm64, Node v24.21.0, Neovim v0.12.5, four ordinary machine workers. Lint 131/59, duration diagnostics, missing baselines and incomplete-base ratchet are report-only; the fixture assertions enforce. No T3/T4, full suite or browser pass is claimed. Reviewer ran no tests.
Not clear; C1 remains failed because formal Web phase evidence is still absent. Other run-dependent criteria remain unsettled. Fresh source review at the corrected head must precede another authorized local mode-free gate.
Standards 0 findings; Spec 1 medium.

Criteria: C1 failed (Local gate fails hub T2 on synthetic Web classification under hub/test; Neovim and required Web phase do not execute.).

### rev-23 · 2026-10-20T21:01:57.666Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-991-source-4
commit: 5fd7df53604a63f30074cf9b4e340365cbe2b128
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-991 admission-fixture source review

Head 5fd7df53604a63f30074cf9b4e340365cbe2b128; tree 6b974f812f367731207d45a43edd886355dfcca0. Single-file correction since 3329bf70; no dev merge.

## Standards
No findings. The fixture keeps one synthetic path per repository manifest entry and preserves its original tier. Web entries now use web/test paths, while remaining entries keep the original hub test representation. Both directories are created. Shared serializeTierManifest sorts both ordinary and planted manifests; no classifier or policy is relaxed. All existing FakeClock, deadline, refusal-code/detail, diagnostics and no-reservation assertions remain unchanged. Diff check is clear.

## Spec
No findings. M3's invalid synthetic path/tier pairing is resolved while preserving repository-size admission coverage. All browser/dependency/probe/selection implementation and docs remain unchanged from prior source reviews. C8 stays established by source.

## Evidence and verdict
Lead reports the targeted local Darwin arm64 file first reproduced red, then passed 6/6 with 523 modeled files; cold refusal 900 ms and ordinary admission 850 ms are FakeClock modeled costs, not native latency. npm run check is reported green under existing report-mode lint/budget policies. This is targeted/static evidence only; A-8057 remains the failed previous gate that never executed Neovim/Web. Reviewer ran no tests or browsers.
Source clear; verify C8 only. C1–C7 await the new exact-head Coordinator-authorized local mode-free gate with actual Web execution. C1 done mark has been refreshed; after-stage QA remains separate.
Standards 0 findings; Spec 0 findings.

Criteria: C8 verified.
