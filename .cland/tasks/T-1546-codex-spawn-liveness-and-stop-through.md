---
id: T-1546
kind: task
title: Codex spawn, liveness and stop through the Host
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1297
branch: t/T-1546-codex-spawn-liveness-and-stop-through
created: 2026-10-31T23:47:41.385Z
updated: 2026-11-01T23:41:53.169Z
closed: 2026-11-01T23:41:53.169Z
---

## Summary

Codex's app-server spawn, the `codex --version` check, the launch's cwd refusal, the pid checks, resume liveness and stop go through the session's Host. Sandbox roots follow in ticket 07, in the same file.

Hot files: `hub/src/adapters/codex.ts`

## Acceptance criteria

- [x] C1. The app-server is started by the Host's spawn, detached, with the same arguments, environment (executor credentials stripped), working directory and log file as today (test).
  - done: impl-1546 · 2026-11-01T22:30:23.361Z
  - verified: rev-35 [reviewer] · run rev-35-1546-final-1 · 2026-11-01T23:00:25.552Z · commit a3353cf22747048d3af6eeff6a5d04b7f230e652
- [x] C2. The `--version` check runs through the Host's run in the session's cwd, and the cwd refusal through its statDirectory (test).
  - done: impl-1546 · 2026-11-01T22:30:23.602Z
  - verified: rev-35 [reviewer] · run rev-35-1546-final-1 · 2026-11-01T23:00:25.552Z · commit a3353cf22747048d3af6eeff6a5d04b7f230e652
- [x] C3. The adapter's poll, resume and stop use the Host's alive and stop, and the adapter's own `process.kill` probe is gone.
  - done: impl-1546 · 2026-11-01T22:30:24.072Z
  - verified: rev-35 [reviewer] · run rev-35-1546-source-3 · 2026-11-01T22:40:00.651Z · commit a3353cf22747048d3af6eeff6a5d04b7f230e652
  - verified: rev-35 [reviewer] · run rev-35-1546-final-1 · 2026-11-01T23:00:25.552Z · commit a3353cf22747048d3af6eeff6a5d04b7f230e652
- [x] C4. A test with a recording Host shows one spawn and one version check per launch, with every liveness check and stop of a Codex row reaching that Host (test).
  - done: impl-1546 · 2026-11-01T22:38:34.742Z
  - verified: rev-35 [reviewer] · run rev-35-1546-final-1 · 2026-11-01T23:00:25.552Z · commit a3353cf22747048d3af6eeff6a5d04b7f230e652
- [x] C5. The codex-adapter, codex-delivery, codex-native and codex-workspace-git test files pass with no test edited.
  - done: impl-1546 · 2026-11-01T22:30:24.701Z
  - verified: rev-35 [reviewer] · run rev-35-1546-final-1 · 2026-11-01T23:00:25.552Z · commit a3353cf22747048d3af6eeff6a5d04b7f230e652

## Comments

### impl-1546 · 2026-11-01T07:11:39.772Z

Consumer inventory before additive HostCommand.logFile / LaunchFiles PID registration: production Host implementation local.ts; adapters sessions/claude-code/codex/opencode and launch-files through optional AdapterHost lookup callbacks; account poller uses Host.limitPolls only; host-contract, host-local-contract, host-contract-coverage, session-host and host-local-files tests plus existing adapter tests and scripted Codex fake. No wire/schema/persisted format changes; previous Host commands without logFile retain ignored stdio. Docs consumers: hub README Local Host section, implement skill Local Host section and per-test guides. Searches cover HostCommand, HostRunResult, host/host, hostForLaunch/Process and spawn callsites across production, all tests, skills and docs. Existing native fixtures keep optional Host callback compatibility. Pre-agreed seam: recording Host injected into the production CodexAdapter; preservation through unchanged codex-adapter/delivery/native/workspace-git.

### impl-1546 · 2026-11-01T07:16:43.045Z

Implementation checkpoint consumes Coordinator-approved pending T-1545 HostCommand.logFile, spawn.exited and LaunchFiles.spawned; no shared Host code duplicated. Source review/verification not requested pending shared capability landing. Targeted macOS arm64 local Node v24.21.0 working-tree receipts: unchanged codex-native 35/35, codex-delivery 22/22, codex-workspace-git 1/1 synthetic Seatbelt; new cwd/version refusal tests 2/2. Main lifecycle test remains incomplete until T-1545. Coordinator confirmed no per-item QA; after-stage QA covers it.

### impl-1546 · 2026-11-01T07:18:02.309Z

Checkpoint 53d09a95e pushed, tree clean. Artifact A-15211 records pending shared T-1545/T-1547 shapes and validation. Coordinator paused all local heavy runs and invalidated high-load receipts; all prior local results are provisional and will be rerun serially after resume. No source review or verification requested yet. Per Coordinator no per-item QA; stage QA on dev covers this item. Holding claim and waiting for resume/merge-dev instruction.

### impl-1546 · 2026-11-01T07:23:33.752Z

Post-resume serial reruns at acceptable pre-run load, Darwin arm64/local Node v24.21.0: codex-native 35/35 at 53d09a95e (1m 3.95); new cwd/version/stale-row cases 3/3 at working tree leading to 795df512d (1m 6.15); npm run test:lint exit 0 at 795df512d (1m 7.15, advisories report-only, 0 refusals); codex-delivery 22/22 at 795df512d plus generated-doc-index-only delta (1m 8.92); codex-workspace-git 1/1 synthetic Seatbelt at 59e2b407f (1m 7.45). No browser or full suite. Current head 59e2b407f pushed, tree clean. Main Host lifecycle/Codex adapter preservation and root typecheck wait for shared T-1545/T-1547 shapes and Coordinator merge-dev instruction. All heavy commands exited.

### impl-1546 · 2026-11-01T09:02:18.185Z

Workflow correction to A-15211: Coordinator decision 032ecef3 (2026-11-01 09:01Z) supersedes its separate-full-suite note. T1–T3 merge-queue batch is now the pre-merge suite. Implementer path stays source review, mode-free verify at reviewed head, evidence review, ready. Shared prerequisites remain unmerged as of this check; no new tests run.

### impl-1546 · 2026-11-01T21:55:31.692Z

At a566da977 after instructed dev merge: the complete adapter-native-boundary file passed 69/69 on Darwin arm64 Node24.21.0/local, pre-run load 3.17 and 124Gi free. Codex close cases now explicitly cover exact post-spawn diagnostic/live thread/live child and pre-spawn log close rejection after revocation/no app-server/rollback. Version fixture follows Host.run native process boundary. C5's four files remain byte-unedited. rg -l CodexAdapter|codex hub/test filtered through tier metadata selects 40 T3 files, including mixed-tier Codex adapter and two scenarios; running all, plus C5 T2/T4 and recording Host, at most two concurrently and pre-run load <=10. No shared adapter-helper conflicts; no opencode.ts changes.

### rev-35 · 2026-11-01T22:08:49.149Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1546-source-1
commit: b9669cc68bbe945fa98b4f71a459b3a6bfea433f
scope: full
findings: [{"severity":"medium","text":"Launch/resume Host waits are not owned or joined by synchronous close(), with no closed admission/continuation/spawn fence. Held work can spawn/commit a running child after close and recovery shutdown; accepted work needs joined rollback.","file":"hub/src/adapters/codex.ts","line":832},{"severity":"medium","text":"Async liveness checks overlap on every poll and are fire-and-forget; close does not join them, and a late rejection still logs after close. Coalesce/drain by captured row and fence success/error continuations.","file":"hub/src/adapters/codex.ts","line":1197},{"severity":"medium","text":"Launch drops the selected Host from returned/internal process ownership; row-sensitive hostForProcess defaults missing host to local, misrouting subsequent poll/resume/stop. Capture/reuse one launch Host and retain its name; current recording test hardwires the resolver and misses this.","file":"hub/src/adapters/codex.ts","line":841}]
finding_counts: {"high":0,"medium":3,"low":0}

Medium — codex.ts:832/1267/1329: close does not join or fence asynchronous Host launch/resume/accepted-child work.
Medium — codex.ts:1197–1212: overlapping unowned Host.alive calls survive close; error continuation still logs.
Medium — codex.ts:841: launch base omits selected Host ownership, so row-sensitive process lookup defaults later operations to local.
A-15427 gives control flows and held-boundary regression requirements: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15427-t-1546-full-source-review-at-b9669cc6.md. C1/C3/C4 failed; C2/C5 runtime unverified. C5 four files unchanged; Coordinator-authorized native close consumer migration inspected. No Reviewer test/harness/browser execution. Preliminary source-equivalent A-15426 is not exact-head queued evidence. Fix and request fresh source review before verification.

Criteria: C1 failed (Pending Host launch work can outlive close and publish or commit an accepted child without joined shutdown cleanup.), C3 failed (Async Host liveness outlives close and can log afterward; process ownership also loses selected Host metadata.), C4 failed (Recording lifecycle proof hardwires hostForProcess and misses wrong-host routing from the launched internal row.).

### impl-1546 · 2026-11-01T22:15:31.866Z

Source review A-15427 fixes in progress, no verification submitted/dev merge taken. Concrete Codex close now returns Promise<void> (HarnessAdapter already permits it). Consumer audit across new CodexAdapter/adapter.close/codex.close: Sessions.close and adapters/index.ts already join promises; codex-host/lead-permissions cleanup returns them; native-boundary, session-cwd, scripted-codex and remote-approval-harness dropped them and are migrated to await/return drainage. Other concrete adapter consumers are unchanged. Ownership test now uses a distinct named Host and row-sensitive resolver. Red controls: row.host undefined; 11 held probes instead of1; held-version launch fulfilled after close. All17 recording cases now green, including launch/relaunch held version/preparation/accepted/identity, live resume held alive/connect, and durable incomplete cleanup.

### rev-35 · 2026-11-01T22:33:08.070Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1546-source-2
commit: a79b309e6d8a253392a21e6d80a8cb8913f757b9
scope: full
findings: [{"severity":"medium","text":"Held launch/relaunch and live-resume tests inspect cleanup only after both work and close settle, so early close can pass; assert producer/cleanup/connection completion at close's own settlement receipt (rules9/12).","file":"hub/test/codex-host.test.ts","line":206},{"severity":"medium","text":"New held-probe setup and several close/Promise.all completion waits have no local bound; missing producer/drainage receipts hang instead of yielding bounded incomplete diagnostics (rule9).","file":"hub/test/codex-host.test.ts","line":158}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime A-15427 fixes inspected and appear addressed: captured Host ownership, coalesced fenced probes and joined/fenced operations with retained late-child cleanup receipts. Remaining medium test findings: codex-host.test.ts:206/284–288 waits for eventual joint settlement instead of asserting cleanup at close receipt; :158/163/255/286 unbounded setup/completion waits. C4 failed; other runtime criteria not verified yet. Four C5 files unchanged; close consumers and original Lead authority assertions migrated correctly. A-15441 details exact receipt requirements: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15441-t-1546-refreshed-source-review-at-a79b309e.md. A-15434 is reported source-equivalent local targeted evidence, not reviewed-head queued verification. Reviewer ran no test/browser. Fix tests and request fresh source review before verify.

Criteria: C4 failed (Held lifecycle regressions do not prove completion-before-close ordering and retain unbounded setup/completion waits.).

### rev-35 · 2026-11-01T22:40:00.652Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1546-source-3
commit: a3353cf22747048d3af6eeff6a5d04b7f230e652
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear, Standards/Spec no findings. A-15441 fixed: producer/accepted-child cleanup/late connection and durable failure ownership are asserted at close's own settlement; retained early-close receipt control must fail the same driver; post-join assertions retained. Shared until/testWaitMs exact promise receipts separately bound setup/completion/teardown. Only recording test/guide changed since a79b309e. A-15427 runtime fixes remain sound: captured Host metadata, coalesced owned probes, independently tracked reconnect, fenced/joined launch/resume/stop and durable incomplete cleanup; concrete close consumers migrated. C3 source verified (Host alive/stop; no direct probe/spawn). C1/C2/C4/C5 await exact-head queued mode-free evidence with recording19/native69/C5 plus Lead and close consumers. Four C5 files unchanged. A-15449: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15449-t-1546-source-clear-after-bounded-receipt-fixes-at-a3353cf2.md. Reviewer ran no tests/browser; local19/static reports and historical source-equivalent targeted receipts are not a fresh suite pass.

Criteria: C3 verified.

### impl-1546 · 2026-11-01T22:41:22.893Z

Source clear at a3353cf22747048d3af6eeff6a5d04b7f230e652 (rev-35-1546-source-3/A-15449). Mode-free verify invoked at that exact clean/pushed head; hub positive admission receipt72e910c3 confirms run6e93d0d3-3735-4d42-b29f-8eec22221b30. CLI exited75 with 'submission sent; no reply within15s' before the hub admission event; no duplicate submission made. Waiting for hub terminal result before evidence review. No further edits/tests.

### rev-35 · 2026-11-01T23:00:25.552Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1546-final-1
commit: a3353cf22747048d3af6eeff6a5d04b7f230e652
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C5 verified. A-15473 exact-head uncached queued6e93d0d3 exit0,4718 pass, zero fail/cancel/skip/todo. Actual named timing outcomes recordingHost19 (incl exact-close receipt and early-close control), native-boundary69, Codex native35/delivery22, session-cwd2 and migrated Lead authority4 pass. C5 adapter13/workspaceGit1 deferred remotely; A-15434 named local Darwin arm64/Node24.21 native exit0 receipts carry by inspected runtime/helper/test source equivalence from8ce7048cc (only README/recording-test/guide changed). Synthetic Seatbelt scope retained; not an exact-head native rerun/cache claim. All four C5 files remain unedited. Linux x64 droplet Node24.21/Neovim0.12.5/isolated HeadlessShell1248 Chrome156.0.8078.4; T0/T1/allT2/selectedT3/Web complete, remainingT3 deferred/T4 unexecuted. Report-only advisories and historical failures remain explicit. No Reviewer execution/edits. QA after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1546 · 2026-11-01T23:01:28.826Z

Ready at unchanged reviewed/pushed a3353cf22747048d3af6eeff6a5d04b7f230e652, final evidence clear rev-35-1546-final-1/A-15474, C1–C5 verified. Exact-head uncached queued run6e93d0d3/A-15473 exit0,4718 pass, T0/T1/fallback T2/selected merged-landing T3/Web; remaining T3 deferred/T4 unexecuted. Named recording19/native69/native35/delivery22/cwd2/Lead4 timing facts confirmed; C5 deferred local receipts retain source-equivalence/historical/synthetic labels. Fresh fetch origin/dev9de0552f8e6b886bc6dedb2e55b02d33808fce0e, merge-tree clean treeec1d3d2b8cd5742250451469987570fde56138e6. Reported ready/merge facts to responsible Lead; claim retained.

### coord · 2026-11-01T23:41:53.169Z

Merged ae87ed2d67490213f9957ddab4b1a7ace70f3e20 onto dev.
