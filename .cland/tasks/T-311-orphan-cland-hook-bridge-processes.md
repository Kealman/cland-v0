---
id: T-311
kind: task
title: "Orphan cland hook bridge processes outlive test runs: 64 bound to temporary projects since Oct 8"
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - needs-triage
assignee: null
parent: E-425
blocked_by: []
topic: topic-323
branch: t/T-311-orphan-cland-hook-bridge-processes
created: 2026-10-13T01:23:15.911Z
updated: 2026-10-15T21:33:24.067Z
---

## Summary

Test runs leave `cland hook bridge` processes behind. On 2026-10-13 at 01:25Z the machine held 67 of them. 64 were orphans (parent pid 1) bound to temporary test projects (`/var/folders/.../T/cland-init-cc-*`, `cland-proj-*`, `qa*`), started between Oct 8 and Oct 12. Their projects' hubs are long gone. They count against the process table that `ps`-heavy tests list, and they hold memory.

## What to find

- Which tests spawn a Claude Code fake whose bridge outlives the test's teardown. T-278's process-group teardown should cover them; check whether the bridge leaves the group, or is spawned by a hook outside it.
- Whether a bridge whose hub file names a hub that no longer answers exits on its own. It should exit after a bounded retry.
- A sweep in `cland doctor --fix` for bridges whose hub file is gone, keeping the doctor's rule of never touching an ambiguous row.

## Acceptance criteria

- [x] C1. The cause is named: the test(s) or path that leave a bridge behind after teardown.
  - done: impl-311 · 2026-10-15T21:01:20.718Z
  - verified: rev-30 [reviewer] · run rev-20261015-311-source · 2026-10-15T21:03:28.278Z · commit b7a4206441f635cf426a26ca92f906a0181df7f6
  - verified: rev-30 [reviewer] · run rev-20261015-311-final · 2026-10-15T21:33:13.433Z · commit b7a4206441f635cf426a26ca92f906a0181df7f6
- [x] C2. A bridge whose hub is gone exits within a bounded time, proved by a test on a real hub that is stopped under it.
  - done: impl-311 · 2026-10-15T21:01:21.777Z
  - verified: rev-30 [reviewer] · run rev-20261015-311-source · 2026-10-15T21:03:28.278Z · commit b7a4206441f635cf426a26ca92f906a0181df7f6
  - verified: rev-30 [reviewer] · run rev-20261015-311-final · 2026-10-15T21:33:13.434Z · commit b7a4206441f635cf426a26ca92f906a0181df7f6
- [x] C3. A full suite run leaves no new `hook bridge` process behind, checked by a before/after process count in the runner or a test.
  - done: impl-311 · 2026-10-15T21:32:53.076Z
  - verified: rev-30 [reviewer] · run rev-20261015-311-final · 2026-10-15T21:33:13.434Z · commit b7a4206441f635cf426a26ca92f906a0181df7f6
- [x] C4. Existing orphans are cleared by a documented, safe means (doctor or the runner), never by the Coordinator killing processes by hand.
  - done: impl-311 · 2026-10-15T21:01:22.976Z
  - verified: rev-30 [reviewer] · run rev-20261015-311-source · 2026-10-15T21:03:28.278Z · commit b7a4206441f635cf426a26ca92f906a0181df7f6
  - verified: rev-30 [reviewer] · run rev-20261015-311-final · 2026-10-15T21:33:13.434Z · commit b7a4206441f635cf426a26ca92f906a0181df7f6

## Comments

### coord · 2026-10-13T01:24:11.895Z

Evidence from the stand-in, 2026-10-13 ~01:35Z, from the human's shell. 65 'cland hook bridge' processes were checked. 64 pointed at hub.json files under temporary test projects (cland-proj-*, cland-init-cc-*, qa48.*) that no longer exist, dating Oct 8 to 11. They were sent SIGTERM from the human's shell, and all 64 ended. The one survivor, pid 21073, is bound to this project's live hub.json and stays. The item narrows to the cause. A test's launched Claude Code session leaves its bridge alive when the scratch project is removed before the session ends. The cause is either the teardown order or a bridge that does not exit when its hub file is removed. C4's existing orphans are cleared, so C4 now covers only a safe means for any future ones.

### impl-311 · 2026-10-15T20:53:56.392Z

C1 reproduction: node --test hub/test/hook-bridge.test.ts failed after 63.22s: a bridge attached to a real project hub remains alive >62s after hub.stop(), with its parent and stdout alive. Cause is hub/src/cli/hook.ts: missing discovery/rejected sockets retry every 500ms forever; stdout only observes errors on a write, and a child first scheduled after reparenting captures PID 1 as its baseline. The old cland-init-cc test launches two fake Claude sessions (hub/test/init.test.ts) and relied on scratch-fixture cleanup; T-278 now captures and kills registered groups. The bridge itself still lacks the daemon-lifetime bound, independently reproduced here. Implementing the epic's 60-second grace, runner proof and safe doctor sweep.

### impl-311 · 2026-10-15T20:59:10.398Z

Expanded lifecycle proof passed in 63.19s: same PID reconnects after a real hub restart, exits after the next 60-second outage with bridge-expired, and the mod has no replacement bridge after its 1-second restart delay. Doctor CLI regression passed; runner whole-file 52/52 passed with planted bridge receipt before cleanup 1 / after cleanup 0. A-3349 records the diagnosis. The legacy init test path is hub/test/init.test.ts's cland-init-cc fixture; pre-T-278 ownDirectory registered recursive root removal before fakeClaude's after hook, and T-278 replaced that scan-based teardown with captured process-group ownership. No evidence that the bridge intentionally leaves its parent's group.

### rev-30 · 2026-10-15T21:03:28.278Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-311-source
commit: b7a4206441f635cf426a26ca92f906a0181df7f6
scope: full

Source review T-311 clear at b7a4206441f635cf426a26ca92f906a0181df7f6. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

C1 verified: A-3349 and task comments name hub/test/init.test.ts's cland-init-cc fake-Claude launch/old fixture teardown path and the independent bridge defect. Discovery/refused sockets retried every 500ms indefinitely; parent comparison cannot detect a parent already gone before startup (PID1 captured), and stdout detects closure only on a write. T-278 owns current test process groups, but does not substitute for a bridge's own unavailable-hub bound. Commit records the cause and correction; pre-fix real-hub stop reproduction remained live past the 62-second observation.

C2 source/targeted evidence verified: cli/hook.ts starts one 60-second grace, covering missing discovery, refusal and silent initial handshake. Only successful session.bridge attachment clears it. A later disconnect starts another grace; retries reread discovery. Expiry emits bridge-expired and latches stop; bridgeOnce's existing bounded polling destroys the socket, and intervals/timer/listener are released. Mod consumes expiry as terminal instead of restarting forever. Existing parent/stdout stop conditions remain. New real-hub test attaches, stops/restarts hub, proves same direct bridge reconnects, stops again, observes expiry and exact child exit, then observes the still-live fake harness past the restart delay with no replacement bridge. Fake Claude imports the actual mod register, so this checks the mod integration. Whole file reported green at 63.04s (expanded run also recorded at 63.19s), not a shortened production timeout.

C4 verified under Coordinator's task comment (historical orphans already cleared; criterion now asks safe future means): doctor lists and fixes only own-user bridges with strict explicit --hub-file argv and a genuinely missing file. Existing/malformed/inaccessible files, ambiguous whitespace/quoted argv and unknown UID preserve the process. PID/start is captured and repeatedly revalidated by endProcess; bridge argv/file absence is rechecked before signals. Current project sweep lock and bounded termination machinery remain; no Coordinator manual kill is needed. New whole CLI file reported1/1 green, checking read-only listing, ending only the missing-file child, preserving malformed existing file and ambiguous path. Documentation describes constraints and fixture-scoped orphan roots.

C3 implementation checked, runtime criterion UNVERIFIED: process cleanup reuses its existing phase discovery snapshot to identify marker/root-matching hook bridges and records exact PID/start survivors via targeted probes. Existing ownership/cwd/ancestry requirements still authorize signals; a surviving ambiguous candidate fails rather than being killed. Receipt is emitted even when there are no captured targets. Targeted suite-runner52/52 includes a detached bridge with before1/after0 and exact PID gone; process-cleanup27/27 reported green. This is not the requested full-suite zero-new-leftovers result; inspect each phase's bridge receipt in the post-source full verification.

Standards: 13-file scope includes lifecycle, mod terminal protocol, narrow doctor candidate parsing, runner observability, fixtures, shard admission and docs. No broad signal authority or new discovery scan is introduced in phase cleanup. New test/file duration allowance63.2s records the intentional production-grace wait; no baseline refresh. Typecheck and shard lint reported green; whitespace check clear. Existing bridge lifecycles outside phase root/marker are excluded from runner cleanup.

Evidence A-3349 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3349-t-311-diagnosis-and-verification-plan.md and targeted whole-file results in request/task comments. Source clear permits one exact-head no-mode cland verify under current Coordinator capacity/budget rules. Final C3 and suite verdict await that run; no per-item QA criteria. No Reviewer tests, edits, merges or provider actions.

Criteria: C1 verified, C2 verified, C4 verified.

### rev-30 · 2026-10-15T21:33:13.434Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-311-final
commit: b7a4206441f635cf426a26ca92f906a0181df7f6
scope: evidence

Final evidence review T-311 clear at unchanged b7a4206441f635cf426a26ca92f906a0181df7f6. No high, medium or low findings. Source review A-3356 stands.

A-3380 /592efa0b-92d7-4107-bd11-8e7ecfc61ed1 is actual Linux c-8 lon1, full mode, exit0:2224 pass, zero failures/cancellations, six platform skips. Typecheck, hub free/machine and full Neovim complete. Duration1554.52s, peak one-minute load13.88, lifetime1654s/$0.1149. No hard duration-budget failure.

C3 verified from the full-run phase receipts: hub free before0/after0 at line165; hub machine before0/after0 at5878; Neovim before0/after0 at7107. There are no phase-owned surviving hook bridges. The planted detached-bridge test at3235 also passes, asserting a before1/after0 receipt and exact child PID gone. This is the requested runner/test evidence; no unrelated machine-wide cleanup or manual Coordinator killing is inferred or performed.

C1 reverified: recorded old cland-init-cc teardown path plus unbounded bridge retry defect and PID1-parent/stdout limits remain documented in the item/commit/A-3349. C2 reverified: real stopped-hub/short-restart/terminal-no-respawn lifecycle passes on Linux in64.510s at1381, with the production60-second grace intact. C4 reverified under the task's clarified future-orphan scope: doctor lists/ends only verified own-user bridges with missing explicit discovery files, preserving existing/malformed and ambiguous paths; Linux regression passes3.619s at1335. Source ownership/revalidation constraints and documented supported command remain unchanged.

Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3380-suite-592efa0b-92d7-4107-bd11-8e7ecfc61ed1-auto-at-b7a4206.log. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions. Changed-head integration/conflict resolution needs delta review.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
