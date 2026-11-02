---
id: T-1617
kind: task
title: Hub start, stop, status, doctor and the orphan sweep read a foreign holder
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1615
topic: topic-1344
branch: t/T-1617-hub-start-stop-status-doctor-and-the
created: 2026-11-02T03:34:16.800Z
updated: 2026-11-02T19:35:58.390Z
closed: 2026-11-02T19:35:58.390Z
---

## Summary

Every reader of `.cland/hub.lock` outside the daemon understands a foreign holder. It names the holder's hostname and heartbeat age, treats a lapsed holder as startable, and never signals or matches a foreign pid on this machine.

Hot files: `hub/src/cli/hub.ts`, `hub/src/doctor/project.ts`, `hub/src/orphans.ts`, `hub/src/hub/lock.ts` (reader helpers only)

## Acceptance criteria

- [x] C1. `cland hub start` against a fresh foreign lock exits with a message naming the holder's hostname, pid and heartbeat age, and leaves no second hub running (test).
  - done: impl-1617 · 2026-11-02T16:44:47.347Z
  - verified: rev-35 [reviewer] · run rev-35-1617-final-1 · 2026-11-02T17:39:15.422Z · commit 691042d964ca5487ae261a8429071c2b3118bbfa
  - verified: rev-36 [reviewer] · run rev-36-1617-final-1 · 2026-11-02T18:52:44.012Z · commit 8d611f77ff0a622540a5940451864500fc78655c
- [x] C2. `cland hub stop` against a foreign holder signals no local process, says the hub runs on another host, and leaves `hub.json` and the lock in place (test).
  - done: impl-1617 · 2026-11-02T16:44:47.558Z
  - verified: rev-35 [reviewer] · run rev-35-1617-final-1 · 2026-11-02T17:39:15.422Z · commit 691042d964ca5487ae261a8429071c2b3118bbfa
  - verified: rev-36 [reviewer] · run rev-36-1617-final-1 · 2026-11-02T18:52:44.012Z · commit 8d611f77ff0a622540a5940451864500fc78655c
- [x] C3. `cland hub status` and `cland doctor` report a fresh foreign holder with its hostname and heartbeat age, and a lapsed one as startable (test).
  - done: impl-1617 · 2026-11-02T16:44:47.875Z
  - verified: rev-35 [reviewer] · run rev-35-1617-final-1 · 2026-11-02T17:39:15.422Z · commit 691042d964ca5487ae261a8429071c2b3118bbfa
  - verified: rev-36 [reviewer] · run rev-36-1617-final-1 · 2026-11-02T18:52:44.012Z · commit 8d611f77ff0a622540a5940451864500fc78655c
- [x] C4. The orphan sweep never matches a foreign holder's pid against local process rows (test).
  - done: impl-1617 · 2026-11-02T16:44:48.075Z
  - verified: rev-35 [reviewer] · run rev-35-1617-final-1 · 2026-11-02T17:39:15.422Z · commit 691042d964ca5487ae261a8429071c2b3118bbfa
  - verified: rev-36 [reviewer] · run rev-36-1617-final-1 · 2026-11-02T18:52:44.012Z · commit 8d611f77ff0a622540a5940451864500fc78655c
- [x] C5. The existing `cland hub` CLI, doctor and orphan tests (`edges.test.ts`, `orphan-servers.test.ts`, `doctor.test.ts` and `doctor-cli.test.ts`) pass with no test edited.
  - done: impl-1617 · 2026-11-02T17:16:10.959Z
  - verified: rev-35 [reviewer] · run rev-35-1617-final-1 · 2026-11-02T17:39:15.422Z · commit 691042d964ca5487ae261a8429071c2b3118bbfa
  - verified: rev-36 [reviewer] · run rev-36-1617-final-1 · 2026-11-02T18:52:44.012Z · commit 8d611f77ff0a622540a5940451864500fc78655c

- [x] C6. `tracker/offline-migrate.ts`, which takes the hub lock, refuses while a foreign holder's heartbeat is fresh, naming the holder's host, and never signals its pid (test).
  - done: impl-1617 · 2026-11-02T16:44:48.621Z
  - verified: rev-35 [reviewer] · run rev-35-1617-final-1 · 2026-11-02T17:39:15.422Z · commit 691042d964ca5487ae261a8429071c2b3118bbfa
  - verified: rev-36 [reviewer] · run rev-36-1617-final-1 · 2026-11-02T18:52:44.013Z · commit 8d611f77ff0a622540a5940451864500fc78655c
## Notes

Shared files: see Hot files

## Comments

### impl-1617 · 2026-11-02T16:25:29.280Z

Rule 20 inventory: lock persisted fields/readLock/liveHolder/foreignLockHolder and PID matching searched across hub/src and all test tiers, web/nvim, docs and skills. Lifecycle consumers: cli/hub.inspect/start/status/stop (startup.ts, cli-client, launcher-component and edges callers); doctor/project.checkHub; orphans.canSignal; tracker/offline-migrate. Generic territory/executor/suite/termination locks retain legacy omitted-options semantics. Existing lock identity and heartbeat tests, daemon/startup-cleanup, Telegram restart fixtures, doctor/doctor-cli, orphan-servers/orphan-sweep-lock, edges and tracker-migrate are preservation consumers. New reader helpers will add explicit foreign states; local inspect variants remain compatible. No discovery or socket frame shape change.

### impl-1617 · 2026-11-02T16:26:53.416Z

Interface note approved by Coordinator (5dfc2e51): only tracker/offline-migrate moves to existing synchronous acquireLock with HubLockOptions; the generic async acquisition remains host-unaware and all its callers remain unchanged (E-1534 note). Offline CLI acquisition is outside hub event loop. Foreign freshness is shared with hub acquisition through foreignHolderInfo; migration and hub start treat lapse identically.

### rev-35 · 2026-11-02T16:34:41.749Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1617-source-1
commit: 1e6514abbe39694fbeb94e2342f2bbeeb474a682
scope: full
findings: [{"severity":"medium","text":"The new host-aware migration lock gets only an initial heartbeat and is never renewed during migration. After 60 seconds a foreign hub can reclaim it while migration continues writing the shared tracker/store.","file":"hub/src/tracker/offline-migrate.ts","line":39},{"severity":"medium","text":"After an awaited stop request fails, ownsProject can reject a newly foreign successor but this early branch still removes hub.json by PID. A cross-host successor with the same numeric PID loses its discovery file; the foreign guard at line 283 is bypassed.","file":"hub/src/cli/hub.ts","line":265},{"severity":"medium","text":"HUB_USAGE and TASK_USAGE changed without migrating their independent commands.json expected blocks, so frozen export deep-equality and full-help assertions reject this head.","file":"hub/src/cli/usage/hub.ts","line":2}]
finding_counts: {"high":0,"medium":3,"low":0}

T-1617 full source review at 1e6514abbe39694fbeb94e2342f2bbeeb474a682: not clear.
Request dd49e543-a68b-4d74-b9c4-d0737685e281 from live claimant impl-1617.

Spec findings:
1. Medium — hub/src/tracker/offline-migrate.ts:39. Opting into HubLockOptions publishes a lapse-governed heartbeat, but migration never calls lock.heartbeat or fences writes on ownership loss. Its asynchronous file/Git/Tracker work can exceed 60 seconds, at which point a foreign hub start reclaims the apparently lapsed lock while migration keeps mutating the same tracker/store. Keep ownership fresh and fence the operation if lost; prove a held long migration excludes foreign takeover across multiple lapse periods and drains renewal before release. Coordinator 5dfc2e51 authorizes synchronous acquisition, but does not remove this exclusion requirement.
2. Medium — hub/src/cli/hub.ts:265. The early stale-discovery cleanup remains reachable after askHub yields and fails. If a foreign successor replaces the holder/discovery during that wait and its PID collides numerically, ownsProject now returns false, but removeDiscovery still deletes that successor's hub.json before the later readForeignHolder guard. Revalidate foreign ownership before every cleanup path; add a held stop-request failure/takeover regression retaining exact successor lock and discovery bytes and proving no signal.

Standards finding:
3. Medium — hub/src/cli/usage/hub.ts:2 (also usage/task.ts:3). Both help exports add foreign-lock wording while hub/test/fixtures/cli-usage/commands.json retains the old HUB_USAGE/TASK_USAGE blocks. frozenUsage independently composes those blocks and cli-usage-compatibility deep-equals every export; native aggregate help uses the same expectations. Migrate the independent expected blocks, retaining full assertions. This is a source-established mismatch, not an executed test failure.

Other source checks: shared foreignHolderInfo centralizes the exact acquisition lapse rule; initial start/status/stop/doctor classification avoids foreign PID probes and socket work; orphan helper short-circuits local row matching; generic async acquisition stays unchanged under the explicit Coordinator decision. Consumer inventory, docs, guide/index/tier and kept skill change record reviewed. Existing named preservation test files remain unedited; doctor fixture supplies matching synthetic identity.

Marks: C2 failed for successor discovery deletion; C6 failed for the migration ownership lifetime gap. C1/C3/C4/C5 remain unverified pending corrected source and runtime evidence. No tests/typecheck/lint/browser were run; source review was explicitly requested during active cover-quiet per Coordinator 28f735c9. Preserve that hold and load gate. Fresh corrected-head source review is required before queued verification. QA affected/after-stage.

Criteria: C2 failed (Stop's early cleanup after an awaited request can delete a foreign successor's discovery when numeric PIDs collide.), C6 failed (The host-aware migration lock is never renewed, permitting foreign takeover after 60 seconds while migration still writes.).

### impl-1617 · 2026-11-02T16:35:32.444Z

Source review 1e6514abb not clear: correcting migration lock lifetime with periodic existing heartbeat and publication authorization in Tracker.migrate; optional callback preserves existing callers. Expanded consumer inventory: offline-migrate sole production Tracker.migrate caller, migration fixtures and #create internal write/index boundaries; CLI frozen help blocks hub/test/fixtures/cli-usage/commands.json feed frozenUsage, compatibility deep-equal and aggregate native help. These fixtures will migrate while full assertions remain. Stop revalidates foreign ownership after awaited request before stale cleanup.

### rev-35 · 2026-11-02T16:46:01.898Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1617-source-2
commit: 6cc961106a595f49955a7c21149831c8cf0ea9a0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1617 source re-review at 6cc961106a595f49955a7c21149831c8cf0ea9a0. Scope full: revised migration ownership design and complete delta from 1e6514abb, with unchanged earlier reader code carried forward.

Standards: no findings. Independent frozen HUB_USAGE/TASK_USAGE blocks now include the new wording; compatibility and native full-help assertions remain intact. Expanded Tracker.migrate callback consumer inventory names its sole production caller and tests; optional callback preserves old call compatibility. Kept skill change record and lifecycle/migration/test guides updated. Named C5 preservation tests remain unedited. task-migrate fixture changes only capture native lock identity on its two embedded restart calls, retaining assertions.

Spec: no findings. All A-15904 findings resolved:
- Migration renews through existing guarded heartbeat every 10 seconds using the same clock as acquisition. Renewal stays active through Tracker/journal cleanup, is cleared before release, and positive loss remains fenced. Publication authorizer confirms current ownership at offline completion and Tracker rename/temp-write/publication/index/category/log boundaries; #create receives the same callback.
- Stop checks foreign ownership immediately after awaited socket work and again before the stale/signal fallback, preserving a same-number foreign successor.
- Both help expectations migrated independently.

New regression source reviewed: held stop socket receives request before foreign successor installation and refusal, then asserts exact successor bytes and no subsequent PID probes; held admitted migration advances the shared clock through three 70-second periods with foreign refusal, then proves release or lost-lock refusal, cleared renewal and no lock recreation; held Tracker temp write proves late ownership loss prevents item publication and leaves original bytes with drained temporary file. Existing start/status/doctor/orphan/legacy/boundary cases remain. Shared fixtures now seal the process environment for direct CLI paths.

Coordinator 5dfc2e51 authorizes only the synchronous hub-aware offline acquisition; generic async locking remains unchanged. Coordinator 3d65b98f reserves local checks before the next cover. Reported local typecheck/lint/reader14/task-migrate8/identity27/heartbeat4/frozen1 and preservation successes are targeted precommit observations; they are not queued evidence. Initial absent web build-stamp setup failure remains historical and was followed by build/retry per report.

C1–C6 remain unverified pending exact-head post-source-clear mode-free verification plus required native preservation receipts. C2/C6 source defects are resolved; runtime marks await evidence. No dev merge after first review. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T17:06:12.090Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1617-evidence-1
commit: 6cc961106a595f49955a7c21149831c8cf0ea9a0
scope: evidence
findings: [{"severity":"medium","text":"Embedded projectHub defaults to synthetic identity but native CLI readers now classify it as foreign; un-migrated status/start consumers fail their existing full-behavior assertions. Migrate matching fixture identities without weakening foreign refusal or assertions.","file":"hub/test/roles-component.test.ts","line":175}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1617 evidence review at 6cc961106a595f49955a7c21149831c8cf0ea9a0: not clear. Scope: evidence. Run 8e341e64-a211-4c50-8606-9678297f284f / A-15913.

Actual failures before classification:
- roles-component.test.ts:225 expected /\nno coordinator\n/ but received "hub on another host fixture (pid 19225, heartbeat age 1s)\n" (A-15913 lines 23900–23914).
- startup-ready-component.test.ts:121 fails "a serving startup must not be killed", reached from startProjectHub's timeout fallback (lines 23918–23923).
- config-reload/config-set failures report "TypeError: Cannot read properties of undefined (reading 'remoteBudget')" (lines 23815–23843).
Eleven completed failures across nine files remain failed; not all are independently reduced to one root cause yet.

Medium — hub/test/roles-component.test.ts:175 (and other embedded-hub/native-CLI consumers): projectHub's default synthetic host identity is now foreign to native hub status/start readers, but callers that launch a native CLI were not migrated. This concrete consumer gets foreign-lock JSON/text instead of its prior full hub status; startup-ready's mocked native launch similarly uses a synthetic embedded identity and cannot report serving. Supply matching captured native identity on the relevant fixtures, preserving production foreign classification and every behavioral assertion. Expand the rule-20 inventory across direct and wrapper CLI/start/status consumers and validate each failed identity.

Standards: one medium missed shared-contract consumer finding. Spec: existing CLI preservation is not clear; C5 failed for this compatibility regression. C1/C2/C3/C4/C6 remain without final verification marks. This does not reopen the three resolved source findings in A-15904.

Independently checked positive queued facts: reader14, identity27, heartbeat4, frozen usage compatibility1 pass. They do not turn the failed run into a pass. T0/T1 exit0; T2 exit1 (tier output 4124 pass/11 fail, zero skip/cancel); T3 and Web unexecuted, T4 unexecuted. Local native A-15907 is supplementary and cannot settle this red queued integration run.

Provenance: head above, recorded tree 022f74cabfd095edd5321896717e698cccc82d69, uncached droplet c-8 sfo2, Linux x64 6.8.0-142-generic, Node v24.21.0/Neovim v0.12.5. Browser binary/version null; no browser execution. Host typecheck at recorded tree not repeated remotely. Budget/lint/ratchet/skip-reason checks report-only; skips [] / missing0. Executor lifetime 983 s / $0.0683 are billing facts, not suite wall time. Fresh corrected-head source review required before another queued run. Reviewer ran no tests/browser and made no edits.

Criteria: C5 failed (Existing CLI integration consumers receive foreign synthetic-holder output instead of full local status; queued T2 has eleven completed failures.).

### impl-1617 · 2026-11-02T17:08:16.251Z

A-15913 identity-consumer inventory: all projectHub callers in hub/test are default consumers (shared native fixture identity now fixes local CLI readers without test-file edits); explicit lockIdentity overrides remain authoritative. Doctor fixture reader shares fixtureLockIdentity(env). Identity-only foreign control explicitly opts into synthetic tuple; default handoff now proves native dead-holder reclaim. Named failures: config-reload-component, config-set, hub-priority, hub-status-component, merge-queue, roles-component, startup-ready-component, suite-protocol and suite-wait-metrics retain their full assertions. lockHostIdentity gains an optional environment passed only to Darwin sysctl, so new fixture capture uses its sealed environment, with production default unchanged. No wire/schema changes, no new freshness policy.

### rev-35 · 2026-11-02T17:13:49.070Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1617-source-3
commit: 691042d964ca5487ae261a8429071c2b3118bbfa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1617 corrected source review at 691042d964ca5487ae261a8429071c2b3118bbfa (tree df5727d41947f9e05b0bda2cd7cb28b526e8e2d6). Scope full: shared fixture identity correction after A-15914, with unchanged reader/migration source carried from rev-35-1617-source-2.

Standards: no findings. Read actual Coordinator decision 6e635f0d: shared native projectHub default, explicit synthetic negative control, retain all existing assertions. Complete 6cc961106→691042d96 delta follows it. fixtureLockIdentity captures once per worker and doctor imports that same exported fact; no duplicated native/synthetic default policy. Existing fixture environment builder precedes capture. Optional environment argument reaches only bounded absolute Darwin sysctl; production default and native identity parsing remain unchanged. Docs, identity/reader guide, shared fixture guidance, daemon comment and kept skill change record updated.

Spec: no findings. The concrete A-15913 identity-consumer gap is resolved at the shared fixture seam. Explicit lockIdentity remains authoritative through projectHub options. Identity27's handoff control now uses captured native identity, explicitly supplies a genuinely foreign tuple for no-PID-probe/preserve-record refusal, then observes default matching-identity dead-holder reclamation and durable new token. Production foreign admission/freshness/reader/signal policy is unchanged.

Independently checked all nine original failed test files remain byte-identical to 6cc961106, as do named C5 preservation files; no assertions weakened. Expanded inventory A-15919 covers shared consumers and field/function names across tiers, docs and QA. Reported corrected local nine-file passes plus reader14/identity27/heartbeat4/doctor20/typecheck/lint are targeted supplementary observations; native committed-head receipts are being collected. Prior A-15913 stays failed partial history, not a pass.

C1–C6 remain unverified pending a fresh same-head post-source-clear queued result, including every prior failing named identity, shared fixture regression controls, and exact-head native preservation. C5's source gap is resolved; its done/verification state must be restored from actual runtime evidence. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T17:39:15.422Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1617-final-1
commit: 691042d964ca5487ae261a8429071c2b3118bbfa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1617 final evidence at 691042d964ca5487ae261a8429071c2b3118bbfa. Scope evidence. Source remains clear under rev-35-1617-source-3 / A-15920; branch tip unchanged. Standards: no findings. Spec: no findings. C1–C6 verified.

Independently streamed A-15929 timing facts:
- hub-lock-readers14 pass: fresh start refusal before spawn, no-signal/file-preserving foreign stop, fresh/lapsed status and doctor, exact/unknown/future freshness, no foreign orphan row matching with legacy control, migration fresh refusal/lapsed admission, held foreign successor stop, migration renewal across three 70-second windows, loss fence and late temp-write publication fence. These establish C1–C4/C6 together with reviewed source.
- identity27 and heartbeat4 pass, including explicit foreign negative control/no probes and default dead same-host reclamation.
- changed T3 task-migrate8 pass; doctor20, native CLI-help7 and frozen help compatibility1 pass.
- Matched every failed (file, generated name) from A-15913 against this new run: all eleven identities have actual pass rows, none missing. They cover config-reload2/config-set2/hub-priority1/hub-status1/merge-queue1/roles1/startup-ready1/suite-protocol1/wait-metrics1. Earlier failed run stays failed history.

A-15923's committed-head isolated native preservation logs were read with positive named outcomes: edges4, orphan-servers18, doctor20, doctor-cli9, daemon18, Telegram restart9 and task-migrate8, all recorded command exit0 with zero fail/cancel/skip/todo. Local macOS Darwin27 arm64 Node24.21.0, no browser. Reviewed launcher uses fixtureEnvironment scratch HOME/XDG/Git and awaits child close before cleanup. Source tree df5727d41947f9e05b0bda2cd7cb28b526e8e2d6; C5 files remain unedited. This replaces A-15907's local preservation evidence and fulfills required native C5 plus daemon/restart controls. It is not Linux full T3 evidence.

Queued run29ad011a-63e4-4cbb-91bc-4155d9fe65d7/A-15929: exit0,4838 pass,zero fail/cancel/skip/todo. T0/T1/fallback allT2/Web and changed T3 task-migrate8 complete, remaining T3 merge-batch deferred,T4 unexecuted. Task verification, not full merge-batch coverage.

Provenance: runner tree5e064a8aada785a289246b80b175ffe35313e894, uncached c-8 sfo2 droplet, Linux x64 6.8.0-142-generic Node v24.21.0/Neovim v0.12.5. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Host typecheck at runner tree not repeated remotely. Budget/lint/ratchet/skip-reason checks report-only; skips[]/missing0/occasion null. Executor1243s/$0.0863 are billing, not suite wall time. Projections not execution evidence. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-36 · 2026-11-02T18:27:32.383Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1617-delta-source-1
commit: 8d611f77ff0a622540a5940451864500fc78655c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings on Standards or Spec axes. A-15945 records the lazy CLI correction and Coordinator-authorized ef7b2506 merge against prior clear 691042d9. localLiveHolder preserves synchronous single-record local identity authorization before signals; foreign successor checks remain. Empty status/stop avoid lock imports; existing import budgets/assertions and C5 preservation tests are unchanged. Incoming T-1620 snapshot confirmation and T-1636 inventory changes introduce no reader conflict. C1-C6 remain unverified at this head pending same-head post-source verify and named native preservation evidence; prepared A-15936 is not merged-head final evidence. No tests run by Reviewer.

### rev-36 · 2026-11-02T18:52:44.013Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1617-final-1
commit: 8d611f77ff0a622540a5940451864500fc78655c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1617 final evidence review

Head: 8d611f77ff0a622540a5940451864500fc78655c (branch tip independently confirmed unchanged).
Source: rev-36-1617-delta-source-1 / A-15945. Run: rev-36-1617-final-1; scope evidence; result clear; findings none. C1–C6 verified.

## Standards

No findings. Lazy imports retain the unchanged command-closure budget and database-free assertions. The independent local cli-imports log in A-15946 has all three named passes: database-free CLI commands never resolve node:sqlite; CLI commands load only their own source closure within import budgets; subcommand import failures retain dispatch stderr/exit. Hub status loads 53 modules less 37 help modules = 16 non-help, under the unchanged 21 budget. This is local targeted evidence, not an executed Linux CLI-imports T3 claim. The incomplete CLI-install-import advisory (typescript absent) supplies no coverage.

## Spec and criterion evidence

Independently streamed A-15950 actual timing outcomes, apart from exit status:
- Reader14 pass. C1: fresh foreign start refuses before spawn and lapsed start reaches launch. C2: foreign fresh/lapsed/unknown stop preserves lock/discovery and signals nothing; held stop preserves a same-PID foreign successor. C3: status and doctor report fresh/lapsed host and age without local probes. C4: foreign orphan PID matching never reads local rows, with legacy positive control. C6: fresh foreign migration refuses without signals; lapsed admission, renewal across three lapse windows, lost-lock fencing and late temporary-write publication fencing pass.
- Identity27, heartbeat4, doctor20, frozen usage compatibility1 and native CLI-help7 pass. All eleven (file, generated name) failures from A-15913 have exact matching pass outcomes in this run; none missing.
- Changed T3 task-migrate8 pass, including real hub restart and old-branch migration controls. Merged snapshot-confirmation3 and inventory2 pass.
- C5: read all named outcomes in exact committed-head A-15946 native logs: unedited edges4, orphan-servers18, doctor20 and doctor-cli9; additionally daemon18, Telegram restart9, CLI identity6, status8/startup5 all pass with zero fail/cancel/skip/todo. Artifact records each command native exit0. Platform is local macOS Darwin27 arm64 Node24.21.0, no browser. Launcher uses shared fixtureEnvironment scratch HOME/XDG/Git, observes child close before successful cleanup and retains failed roots. These test files were independently confirmed unchanged during source review. This is mixed-platform task coverage, not Linux full-T3 coverage.

## Queued run and limits

Run355335a2-9b92-4e19-921b-a919ef63540c / A-15950: exit0, 4842 pass, zero fail/cancel/skip/todo. T0/T1/fallback allT2/selected task-migrate T3/Web completed. Remaining T3 is merge-batch work; T4 and T3 repetitions unexecuted. Earlier A-15913 and merge/import failures remain failed history.

Provenance: exact reviewed head; recorded verification tree94a6272eb7f3842b1ef96780be73f332c0eb5276; uncached droplet Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, workers2. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; Google Chrome for Testing156.0.8078.4. Host typecheck at the verification tree was not repeated remotely. Budget/lint/ratchet/skip checks remain report-only, skips[]/missing0/occasion null. Projection and billing metrics are not test wall evidence. QA remains affected/after-stage. Reviewer ran no tests/browser and made no source edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-02T19:35:58.390Z

Merged 260a8f2c7751e5423b6804478013cd0eedef0ea8 onto dev.
