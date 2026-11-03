---
id: T-1600
kind: task
title: "The remote hub.json and the spoke over ws+unix:"
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1596
  - T-1599
topic: topic-1367
branch: t/T-1600-the-remote-hub-json-and-the-spoke-over
created: 2026-11-02T03:33:55.459Z
updated: 2026-11-03T15:44:01.967Z
---

## Summary

The discovery file gains a remote kind: the forwarded `hub.sock`, a `ws+unix:` spoke endpoint on `spoke.sock`, the per-host secret, the version and `remote: true`, with no pid and no port. When a host's tunnel is first up, the hub writes it at the host clone's `.cland/hub.json` through the agent. The spoke, the CLI, hooks and the mod bridge on a host read it, and the CLI and doctor never pid-check it.

Hot files: `shared/project-discovery.ts`, `hub/src/project.ts`, `hub/src/spoke/spoke.ts`, `hub/src/cli/hub.ts`, `hub/src/cli/hook.ts`, `hub/src/doctor/project.ts`, `hub/src/host/ssh-host.ts` (writing it), `hub/test/remote-discovery.test.ts` (new)

## Acceptance criteria

- [x] C1. `readDiscovery` accepts a remote-kind file without `pid` and `port`, still refuses a malformed one, and reads every existing local `hub.json` as before (test).
  - done: impl-1600 · 2026-11-03T14:45:58.477Z
  - verified: rev-36 [reviewer] · run rev-36-1600-final-1 · 2026-11-03T15:44:01.759Z · commit 765db463f2e74a42c45462bea3b0c222a89be5f0
- [x] C2. A spoke whose discovery file is remote connects through the `ws+unix:` endpoint with the per-host secret and re-reads the file before each reconnect (test).
  - done: impl-1600 · 2026-11-03T14:45:58.619Z
  - verified: rev-36 [reviewer] · run rev-36-1600-final-1 · 2026-11-03T15:44:01.759Z · commit 765db463f2e74a42c45462bea3b0c222a89be5f0
- [x] C3. `cland hub status`, `cland doctor` and the hook CLI never pid-check a remote `hub.json`, and they reach the hub through its socket path (test).
  - done: impl-1600 · 2026-11-03T15:21:04.897Z
  - verified: rev-36 [reviewer] · run rev-36-1600-final-1 · 2026-11-03T15:44:01.759Z · commit 765db463f2e74a42c45462bea3b0c222a89be5f0
- [x] C4. On a fake host the written file is 0600, holds the host's secret and never the project secret, and its content is unchanged across a hub restart (test).
  - done: impl-1600 · 2026-11-03T14:59:23.517Z
  - verified: rev-36 [reviewer] · run rev-36-1600-final-1 · 2026-11-03T15:44:01.759Z · commit 765db463f2e74a42c45462bea3b0c222a89be5f0
- [x] C5. A spoke on a fake host, launched with a session's credential, connects through `spoke.sock`, and after `cland host revoke` the spoke's next hello is refused (test).
  - done: impl-1600 · 2026-11-03T14:45:59.080Z
  - verified: rev-36 [reviewer] · run rev-36-1600-final-1 · 2026-11-03T15:44:01.759Z · commit 765db463f2e74a42c45462bea3b0c222a89be5f0

## Notes

Shared files: `shared/project-discovery.ts` (Discovery remote kind, sole owner); `hub/src/spoke/spoke.ts` (22 later)

## Comments

### impl-1600 · 2026-11-03T14:33:11.781Z

Before edits consumer inventory A-16284. Coordinator decision ecff0d3a: T-1600 writes canonical remoteHostLayout.discoveryFile (~/.cland-host/run/hub.json) only; T-1604 owns clone .cland/hub.json copy. No new clone config. C1 red on macOS Node24.21: expected remote discovery object, actual null; old local shape was accepted.

### impl-1600 · 2026-11-03T14:37:57.110Z

Approved transport seam decision4d4f7a7e: additive SshOptions.beforeReady after probe/restored forwards, before up, joined on stop, bounded deadline plus normal backoff. Canonical file publication uses existing agent writeFile0600 and preserves identical bytes on reconnect; atomic replacement belongs to T-1644. Tests so far on working tree/macOS/Node24.21: C1 parser old+remote shape pass; fake-host C2/C4/C5 combined test pass2.16s including changed-secret reread refusal, carrier restore, host revocation and hub restart. C3 stub CLI initial run reached all expected frames but hook subprocess remained on open stdin until harness timeout; correcting fixture to close stdin explicitly.

### rev-36 · 2026-11-03T14:50:43.749Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1600-source-1
commit: 15fc44fdb26c7669ab9baa12ac2d0ffa719a8516
scope: full
findings: [{"severity":"medium","text":"A differing existing discovery is truncated in place by agent writeFile, so interrupted publication can destroy the last valid file while existing spokes still re-read it. Keep changed publication overwrite-safe until T-1644 and prove old bytes survive a failed/held update.","file":"hub/src/host/discovery.ts","line":18},{"severity":"medium","text":"The readiness deadline rejects but finally then awaits the same unbounded callback; stop awaits it too. A never-settling callback prevents ordinary backoff and stop completion. Add an owned bounded cancellation/drain path and a timeout regression that recovers without manually releasing the stuck callback.","file":"hub/src/transport/ssh.ts","line":262},{"severity":"medium","text":"Frozen DOCTOR_USAGE and HUB_USAGE rows omit the new CLAND_HUB_FILE lines. The unchanged all-export deep-equal compatibility test therefore disagrees with production; migrate only these intentional expected blocks and preserve all other frozen bytes.","file":"hub/test/fixtures/cli-usage/commands.json","line":21}]
finding_counts: {"high":0,"medium":3,"low":0}

T-1600 source review
Head15fc44fdb26c7669ab9baa12ac2d0ffa719a8516; base d7beb363e. Branch tip independently read unchanged.
Run rev-36-1600-source-1; scope full; result not clear.
Reviewer performed Standards and Spec review directly under the no-delegation role clause; source/docs reads only, no tests/typecheck/probes/browser or edits.

## Standards
Medium — hub/src/host/discovery.ts:18. Existing different discovery is overwritten using the agent's truncating writeFile. An interrupted/failed write can replace a previously valid file with empty/partial JSON; existing spokes re-read it independently of new-launch admission fencing. Coordinator4d4f7a7e explicitly requires no torn file and overwrite-safe behavior until T-1644. Preserving identical bytes only covers one branch, not an existing different record. Keep the last valid record intact and refuse a differing overwrite until the approved atomic capability is available (or use an already-authorized equivalent that positively preserves the old file); add failed/held changed-publication control and retain mode/secret assertions. Do not infer remote writer completion from an RPC timeout.

Medium — hub/test/fixtures/cli-usage/commands.json:21. DOCTOR_USAGE and HUB_USAGE exports gain CLAND_HUB_FILE lines, but their independently frozen rows21/23 are unchanged. cli-usage-compatibility.test.ts deep-equals every export against frozenUsage(), so the required check is inconsistent at this head. Update only those intentional expected help blocks, retaining every unrelated byte and unchanged compatibility/help assertions. Static/lint/typecheck success does not cover this mismatch. This is a source-established mismatch; no test was run by Reviewer.

## Spec
Medium — hub/src/transport/ssh.ts:262. When beforeReady's deadline rejects, finally immediately awaits the same unbounded callback promise; stop likewise awaits it before retiring the carrier. A callback that never settles therefore never reaches ordinary backoff or completes stop. The new held-writer test observes the timeout reason but manually releases its gate, masking the missing bounded cancellation/drain path. Coordinator4d4f7a7e requires bounded readiness and normal backoff after failure/timeout, while rule12 still requires joining admitted work before teardown. Give the callback an owned cancellation/drain mechanism and prove timeout recovery/backoff without externally releasing a permanently pending gate; preserve positive writer completion before retry/teardown, or surface explicit cleanup-incomplete rather than claim completion. Current AgentClient operations have individual request timeouts, but that does not enforce the additive option's promise contract or prove an accepted remote write stopped.

Failed C4: discovery publication can damage an existing valid file on changed-write failure, and readiness timeout cannot guarantee the approved recovery boundary. C1/C2/C3/C5 remain unverified, pending corrected-source review and later same-head run evidence.

Other inspected requirements: additive LocalDiscovery/RemoteDiscovery discriminant preserves older local records; remote syntax requires absolute Unix endpoint, omits pid/port, rejects invalid remote marker/relative root. Spoke re-reads endpoint and secret per reconnect and skips remote hub.db role lookup. Remote inspect/status, task/import and doctor use socket liveness rather than remote PID; session credentials/admission remain on shared socket path. Canonical registry publication is correctly placed after probe/forward restoration and before up. No Transport interface member changes. Read actual Coordinator ecff0d3a canonical-path split and4d4f7a7e additive seam authorization: clone copy remains T-1604, atomic capability T-1644; no new clone setting requested.

Consumer inventory includes production, skills/QA/probes/persisted readers/all test tiers and old-local-shape regression. New parser/CLI/fake-host tests cover useful happy-path/reconnect/revoke observations and use sealed fixtures; the existing transport/contract controls are reported unedited. Publication failure and autonomous timeout recovery need the additional receipts above. No unrelated real SSH/browser execution is claimed.

Docs/help/permissions describe canonical path, host-only authority and deferred clone/atomic owners. Read full new docs and changed sections; adjust readiness/changed-write claims with the fix. Reported A-16286 macOSarm64 Node24.21 targeted/static observations are supplemental only. No queued verification has run and none should be submitted before a corrected-head source verdict. Local machine constraints remain single-file/typecheck only during ongoing stage QA; Reviewer ran none.

Findings: Standards2medium, Spec1medium, no lows.
A-16288: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16288-t-1600-source-review-readiness-and-publication-boundaries.md

Criteria: C4 failed (Changed-file publication can tear an existing valid discovery and the readiness deadline cannot reach bounded recovery/backoff when its callback remains pending.).

### impl-1600 · 2026-11-03T14:58:19.530Z

A-16288 fixes under Coordinator f3e4c421: differing existing discovery refuses before write, retaining private bytes and connecting/path-free condition. beforeReady(signal) aborts at deadline; separate default1s drain bound. Cooperative drain precedes autonomous retry; unresolved callback retains master/claim, reason cleanup incomplete, and stop rejects incomplete. Unknown write RPC outcome needs later same-stream positive receipt; otherwise callback remains fenced. HUB_USAGE/DOCTOR_USAGE frozen blocks migrated only. Working-tree macOS Node24.21: remote-discovery-host5/5pass (largest2.503s); parser/publication2/2; unchanged transport SSH6/6, SSH contract1/1; frozen usage1/1. All-package typecheck and tiers pass. Final lint pending. No new dev merge after first review, and no verify before fresh source verdict.

### rev-36 · 2026-11-03T15:01:53.987Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1600-source-2
commit: 476f20ab8cb382fc04038dd2b1c56893d6aff2b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1600 corrected source review
Head476f20ab8cb382fc04038dd2b1c56893d6aff2b9; parent15fc44fdb26c7669ab9baa12ac2d0ffa719a8516.
Run rev-36-1600-source-2; scope full; source clear; findings [].
All C1–C5 remain runtime-unverified pending required same-head post-source verification.

## Standards
A-16288 overwrite finding resolved: publication reads existing bytes and succeeds without mutation only when identical. A differing existing record refuses before write with a path-free condition, leaving old bytes intact. The initial absent-file write still uses0600. The Coordinator f3e4c421-6fc3-452f-9a88-c8ebf13c8927 explicitly approved this interim refusal until T-1644; no atomic capability or clone configuration is added. New pure regression proves zero writer calls on a different record and identity-preserving read-only success; fake-agent/carrier regression retains exact private bytes/mode with connecting refusal.

Unknown write outcome now remains owned. A timeout/closed-write reply requires a later successful read receipt on the same AgentClient stream before releasing the callback; missing receipt keeps it pending. Independently read agent/server.ts's per-connection serial chain: the later operation is processed after the admitted write settles, so this is an actual producer drain boundary, not merely another connection or elapsed time. Registry closes that client only after publication settles. The held synthetic timeout regression requires its positive later receipt before drained() returns true.

A-16288 frozen help finding resolved: independently compared HUB_USAGE and DOCTOR_USAGE source literals with migrated frozen rows; exact match. Every byte outside these two blocks remains identical to the previous fixture. Existing all-export compatibility assertions unchanged. Consumer/provenance notes and per-file docs describe signal/drain and interim overwrite refusal.

## Spec
A-16288 readiness finding resolved under the actual Coordinator f3e4c421 decision. beforeReady receives AbortSignal; a readiness deadline aborts it, followed by a separate default1s drain bound through the shared drained() helper. Cooperative callback settlement precedes master teardown/backoff/new writer. An unresolved callback leaves the host connecting with explicit path-free cleanup-incomplete reason, retains master/claim and starts no retry; stop aborts, checks the same drain boundary and rejects incomplete before children/metadata release. When the callback later settles, teardown can progress, with stop completing only after the loop/forward owners finish. This implements the approved explicit-incomplete exception rather than silently treating timeout as writer completion.

New cooperative regression observes autonomous second admission/up only after abort-and-drain and retains reconnect count/stop-down assertions. Noncooperating regression observes incomplete, aborted signal/no completion, one writer/no retry and rejected stop before fixture disposal releases it; disposal then joins completion. Positive same-stream timeout control and differing-file carrier control retain their final assertions. No Transport or HostTunnelStatus wire member changed; SshOptions-only callback seam and registry consumers migrated.

Original remote parser/local compatibility, reconnect/credential/revoke, canonical publication/0600/project-secret positive control and CLI status/doctor/hook coverage remain unchanged. No dev merge after first review. C4 source defects are resolved; all run-dependent criteria still need current-head named facts and fresh mode-free verify. Reported local macOS targeted host5/parser2/transport6/contract1/help1/static results are supplemental reports, not Reviewer execution or Linux evidence. Required deferred native preservation receipts must be retained if selected scope omits them. After-stage affected QA remains separate.
Reviewer read source/docs/blobs only; no tests/typecheck/probes/browser, edits or merge.
A-16292: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16292-t-1600-corrected-source-review-of-publication-ownership.md

### rev-36 · 2026-11-03T15:18:21.744Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1600-evidence-1
commit: 476f20ab8cb382fc04038dd2b1c56893d6aff2b9
scope: evidence
findings: [{"severity":"medium","text":"The explicit negative environment case points CLAND_HUB_FILE at nonexistent outer-hub.json but expects session-credential rejection. Doctor now honors the override, so missing discovery prevents that boundary. Seed a valid isolated discovery at the explicit path and retain credential/environment assertions; do not weaken admission or ignore the override.","file":"hub/test/doctor.test.ts","line":19}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1600 failed verification evidence
Commit476f20ab8cb382fc04038dd2b1c56893d6aff2b9
Run rev-36-1600-evidence-1; scope evidence; not clear.
Medium — hub/test/doctor.test.ts:19. The existing environment-isolation test explicitly overlays CLAND_HUB_FILE=<root>/outer-hub.json but never creates that file, then expects production session-credential rejection. checkProject now correctly honors hubDiscovery(root, env), whose contract says explicit absent/invalid overrides win. The explicit-case fixture therefore stops at missing discovery and never exercises invalid-credential admission. Migrate this consumer by seeding a valid fixture-only discovery at its explicit path (or an equivalent setup preserving both controls), keeping parent-env isolation, explicit invalid session credential rejection, and process.env preservation assertions. Do not revert remote override support or merely weaken the credential assertion.

Actual A-16294 failure output:
doctor uses its fixture environment rather than the parent crew session
AssertionError [ERR_ASSERTION]: The input did not match /outer-doctor-fixture.*credential is missing or invalid/.
Actual: 'pid13192 holds .cland/hub.lock, but outer-hub.json is missing: sessions and the CLI cannot find the hub'
Test definition doctor.test.ts:12; final assertion line30.
This is an explicit fixture precondition mismatch with the new override behavior, established by source and failure output. It is not classified as a parent-credential leak or machine flake. The first isolated-tools.env control passed before the explicit negative case failed.

Failed C3: required doctor preservation regression does not reach its intended explicit-credential boundary; final overall evidence is not clear. C1/C2/C4/C5 remain unverified; their required native T3 scenarios did not run. Prior source-clear remains the reviewed source record, but any correction needs fresh source review before a new verify.

Run8bd43f2b-4456-4a09-ba8f-bbdaba4b229b/A-16294 overall exit1. T0/T1 exit0, T2 exit1; changed T3 and Web unexecuted, T4 unexecuted. Completed-before-interruption aggregate4361/4360pass/1fail; tier-final summary4226/4225/1 is a separate logged aggregate, not full suite coverage.
Provenance exact commit above/tree0ae1e633733bbf1fd727d9b097f6e22075584c03, cache null; Linuxx64 6.8.0-142-generic, droplet c-8 sfo2 workers2, Nodev24.21.0/Neovimv0.12.5. Browser binary/version null; no browser phase executed. Report-only budget/lint/ratchet findings and missing-skip-reasons0 are separate from the actual assertion failure. Lifetime843s/cost$0.0585 are native resource metrics, not suite wall.
Reviewer read logs/source only; no tests/probes/browser, edits or retry run.
A-16296: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16296-t-1600-failed-evidence-doctor-explicit-discovery-fixture.md

Criteria: C3 failed (Existing doctor isolation regression fails before reaching intended explicit invalid-session admission because its override fixture file is missing; T3/Web did not run.).

### impl-1600 · 2026-11-03T15:20:09.314Z

A-16296/8bd43f2b diagnosis: exact local narrow reproduction failed same line30 regex as Linux. Case3 under Coordinator28833af7 confirmed: first report(root,tools.env) ignores synthetic parentprocess.env and passed; second report(root,{...tools.env,...parent}) explicitly selects absent outer-hub.json. Corrected setup retains all original assertions, checks explicit missing-file no fallback first, then seeds a valid scratch discovery copy0600 for original invalid-credential assertion. Full doctor.test.ts20/20 and remote-discovery-cli1/1 pass on localmacOSNode24.21; all-package typecheck passes.64 CLAND_HUB_FILE consumers re-audited/documented, no other doctor double-call pattern. No production source changes, no dev merge since review. Lint pending before corrected-head source review.

### rev-36 · 2026-11-03T15:21:42.365Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1600-source-3
commit: 765db463f2e74a42c45462bea3b0c222a89be5f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1600 corrected doctor fixture source review
Head765db463f2e74a42c45462bea3b0c222a89be5f0; parent476f20ab8cb382fc04038dd2b1c56893d6aff2b9.
Run rev-36-1600-source-3; scope full; source clear; findings [].
C1–C5 remain runtime-unverified pending fresh same-head mode-free verification.

Standards: read complete correction: six added setup/assertion lines in doctor.test.ts plus consumer audit/provenance notes. No production source changes and no dev merge after first review. The test first retains its original tools.env isolation success while outer process.env is synthetic. It now asserts that the explicitly missing CLAND_HUB_FILE fails without fallback, then copies only the fixture's own valid discovery bytes to that explicit scratch path with mode0600. The original invalid-session credential refusal, nonzero result and outer environment preservation/restoration assertions remain unchanged. No live project/home/credential is copied. The consumer note records the additional explicit-override search/dispositions.

Spec: A-16296 fixture precondition finding resolved. Both negative boundaries are tested rather than conflated: an absent explicit file remains unavailable; a valid explicit file then reaches real production credential admission. Remote override support, process.env isolation, parser/CLI/host/reconnect/revoke/readiness behavior and required transport tests stay unchanged from source-clear476f20ab8. No assertions weakened.

The prior A-16294 Linux run remains failed and incomplete: T0/T1pass, T2fail on this fixture, native changed T3 and Web unexecuted. Reported local red→green, doctor20/20/remoteCLI1/typecheck/lint observations are supplemental; no new post-source queued result yet. Required named native facts and any deferred preservation receipts belong to final evidence review after fresh verify. After-stage affected QA remains separate.
Reviewer source/docs reads only; no tests/typecheck/probes/browser, edits or retry execution.
A-16298: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16298-t-1600-source-review-of-explicit-doctor-discovery-fixture.md

### rev-36 · 2026-11-03T15:44:01.759Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1600-final-1
commit: 765db463f2e74a42c45462bea3b0c222a89be5f0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1600 final evidence review
Head765db463f2e74a42c45462bea3b0c222a89be5f0
Run rev-36-1600-final-1; scope evidence; result clear; findings []; verify C1–C5.
Standing source clear rev-36-1600-source-3/A-16298, with production review at476f20ab8/A-16292. Branch tip independently read unchanged; no dev merge/source edit after review.

A-16299 / suiteb833f122-89d7-4be7-8efd-58944b17e6ce: overall exit0,4927pass/zero fail/cancel/skip/todo. Independently streamed actual case timing outcomes, not counts alone.
Exact provenance head above/treedeb6687251043bf4c5a6bbcfec0a3ab94fb4db8e/cache null; Linuxx64 6.8.0-142-generic, droplet c-8 sfo2, workers2, Nodev24.21.0/Neovimv0.12.5.
T0/allT1/fallback allT2/changed T3 two files six cases/Web completed. Each changed T3 identity ran once, no repetitions. Remaining T3 deferred to configured merge batch; T4 unexecuted. No all-tier occasion or real SSH/remote-machine execution claimed. Native lifetime1132s/cost$0.0786 are resource metrics, not test wall.
Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4.
Duration/budget/lint/ratchet and skip-reason checks remain report-only; skip list empty/missing reasons0.

C1 actual pass:
- C1 remote discovery accepts socket credentials without a local pid or port; preserves old local shape
- different discovery refuses before a failing overwrite; identical bytes skip the writer.
Both have five additional passing load-gate test outcomes. Source retains old local parsing and refusal of malformed remote shape.

C3 actual pass:
- C3 status, doctor and hook reach remote CLAND_HUB_FILE socket without a local pid.
The corrected doctor environment-isolation case passes and full doctor20/20 passes. Its original outer process.env isolation, explicit missing-file refusal, valid scratch-copy invalid-credential refusal and environment preservation assertions remain. Frozen help compatibility1/native help7 pass.

C2/C4/C5 actual pass:
- C2/C4/C5 fake host publishes private stable discovery, reconnects from file and refuses revoked hello.
The reviewed test observes actual fake SSH forwards, canonical file0600, planted project bearer differing from per-host bearer, no project secret/pid/port, credentialed spoke welcome, changed-secret refusal at reconnect and restoration, carrier/hub restart stability, CLI revocation and refused next hello. Canonical run/hub.json is the Coordinator-approved scope; clone copy is T-1604.

Safety correction cases all actual pass:
- readiness timeout aborts and drains before autonomous retry
- undrained readiness fences ownership and stop reports cleanup incomplete
- publication RPC timeout retains writer until a positive same-stream drain receipt
- changed discovery keeps the prior private bytes and reports connecting refusal.
Thus all five host-file cases and one CLI-file case pass. Coordinatorf3e4c421's explicit cleanup-incomplete exception and interim different-file refusal are retained. Atomic replacement remains T-1644.

Preservation independently counted in A-16299: project-layout1, in-process-spoke4, spoke-unix-edge12; compatibility/help and doctor above.
Required unchanged seam controls, deferred remotely, supplied by A-16300 at this exact head: local macOSarm64 Nodev24.21.0/no browser, serial targeted fake SSH fixtures. Read raw six generated transport-ssh passes plus native exit0: four forwards/probe after SIGKILL; wrong pin refuses before bootstrap/no key logs; clock retries/wake jump;30s agent probe; old-master refusal fences cleanup/start; private pin exclusive despite global trust/spaces. Raw transport-ssh-contract one generated C1–C7 relay/recovery/no-TCP case passes with native exit0. Totals6/6+1/1, zero fail/cancel/skip/todo. These are supplemental native preservation runs, not Linux suite wall or real sshd proof. Independently diffed both preservation files against initial base d7beb363e: unchanged.

Prior A-16294 remains failed/incomplete, not relabeled by this fresh pass. Source findings A-16288/A-16296 resolved with no remaining lows. Merge-batch requirements and affected after-stage QA remain separate.
Reviewer performed source/log reads only; no tests/typecheck/probes/browser, edits or execution retries.
A-16301: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16301-t-1600-final-evidence-remote-discovery-and-publication-ownership.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
