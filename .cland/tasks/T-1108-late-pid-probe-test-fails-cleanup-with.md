---
id: T-1108
kind: task
title: Late-PID probe test fails cleanup with ENOTEMPTY when its fake ps rewrites a marker after teardown
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-972
branch: t/T-1108-late-pid-probe-test-fails-cleanup-with
created: 2026-10-22T13:55:59.920Z
updated: 2026-10-24T12:30:47.768Z
closed: 2026-10-24T12:30:47.768Z
---

## Summary

On the Linux droplet, the periodic integrated dev run e64431b1 at fae121ec (A-9183) failed T3 `hub/test/claude-code-accounts.test.ts` › "a late Claude PID can be stopped while its identity probe is pending" in teardown, not in its assertions: `ENOTEMPTY: directory not empty, rmdir '/tmp/cland-suite-…/cland-claude-pid-probe-…'`. The test's fake `ps` writes a `finished` marker into the temp directory on every call. A probe from the still-running fixture hub most likely recreates that marker while `tempProject` removes the directory.

## What to build

Teardown is race-free. Either stop the fixture hub before the temp directory is removed, or have the fake `ps` write its marker outside that directory (or only once). The test keeps its current assertions.

## Acceptance criteria

- [x] C1. The named test passes 20/20 in a targeted loop on macOS under CPU load, and its single file passes in a mode-free `cland verify` at the head.
  - done: impl-1108 · 2026-10-24T12:13:00.172Z
  - verified: rev-32 [reviewer] · run rev-20261024-1108-final · 2026-10-24T12:15:27.610Z · commit 36c6a78af4253360044fde511707fabb5e45310a
- [x] C2. Its cleanup never removes the probe directory while the fixture hub can still call the fake `ps` (shown by the teardown order in the diff or by a test assertion).
  - done: impl-1108 · 2026-10-24T11:53:43.311Z
  - verified: rev-32 [reviewer] · run rev-20261024-1108-source · 2026-10-24T11:58:34.263Z · commit 36c6a78af4253360044fde511707fabb5e45310a
  - verified: rev-32 [reviewer] · run rev-20261024-1108-final · 2026-10-24T12:15:27.610Z · commit 36c6a78af4253360044fde511707fabb5e45310a

## Comments

### coord · 2026-10-22T13:56:37.245Z

This is the hub's periodic dev-t3 red notice (suite e64431b1, head fae121ec; previous green 1b4291e6, 54 merges in between, droplet c-8 lon1, lifetime 1636 s, $0.1136). No commit in 1b4291e6..fae121ec touches the failing test file or any of its imports: account-fixture-env.ts, adapters/claude-code.ts, fake-clock.ts, protocol.ts, harness.ts, native-process.ts, process-cleanup.ts. The failure is ENOTEMPTY in teardown. I read it as a pre-existing teardown race, not a regression from the range.

### coord · 2026-10-22T13:58:35.315Z

The hub's failing-file rerun de13704a (A-9185) at the same head fae121ec ran on a droplet (c-8 lon1, 139 s, $0.0096). claude-code-accounts.test.ts passed 8/8, which confirms an intermittent teardown race, not a deterministic failure.

### coord · 2026-10-22T19:12:15.036Z

Recurred in a full Linux run of T-1150 at e83b5945 (verify all 58a7464d, A-9422, c-8 lon1): the same ENOTEMPTY rmdir on cland-claude-pid-probe-* during teardown. The run went red only on this; T1, T2 and every other T3 test passed. That makes two occurrences today, so it now costs full reruns.

### impl-1108 · 2026-10-24T11:52:44.153Z

Test-first proof on macOS/local at ad611df9 + worktree diff: added a durable `hub-stopped` journal assertion while the probe directory is still present. Red: AssertionError [ERR_ASSERTION]: the fixture hub stops before its probe directory can be removed (actual false, expected true), 1/1 selected test failed. Minimal fix explicitly closes UI/stops fixture hub in nested finally and makes only the held identity probe write its finished receipt. Green: named test passed 1/1 (1.259 s test; no suite gate). Whole-file check and source review next; C1 load loop awaits Coordinator's exclusive window.

### impl-1108 · 2026-10-24T11:56:15.542Z

Exact-head C1 load evidence: 36c6a78af4253360044fde511707fabb5e45310a, macOS/local, named T3 test 20/20 with two bounded CPU workers in rule-3 exclusive window granted by coordinator. 2026-10-24T11:54:20.987Z–11:55:27.111Z, measured 66.124 s loop wall. Queue pre-check local:none/no local waiter. All test children and burners observed exited; follow-up ps has no loop/burner rows. Raw log A-10876 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10876-t-1108-macos-cpu-load-20-of-20-raw-log-at-36c6a78a.log; queue/process supplements A-10878. No suite/gate pass claimed. Source review requested from responsible Reviewer; C1 remains unchecked until same-head mode-free whole-file verification arrives. No per-item QA (scope none, after-stage).

### rev-32 · 2026-10-24T11:58:34.263Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1108-source
commit: 36c6a78af4253360044fde511707fabb5e45310a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1108 full source review — clear

Head36c6a78af4253360044fde511707fabb5e45310a; treeedc6b6dd44b328cfaec724f72dc0e2bac115b080; parent/fixed basead611df95d015191b8b8af11fd7aa81bcd599b6d. Task/origin refs agree. One task commit, three files; reviewed three-dot diff and unchanged relevant native fixture/adapter/shutdown ownership. Whitespace check exit0. Scope full; findings[].

## Standards

The generated ps marks held only for the requested PID identity lookup; unrelated process-table calls can no longer create/rewrite finished. The matching probe writes entered, waits for release using watcher plus already-present check, runs the real ps, then writes its own finished receipt. No sleep or unrelated completion substitutes for that exact boundary.

The existing finally now contains a nested finally: release and bounded finished wait, then UI close and awaited fixture.stop even if behaviour assertions or completion wait fail. projectHub.stop is idempotent and daemon shutdown closes core/dispatcher/adapters, watchers/edges and journals before returning. The native adapter closes scheduling and rejects pending work. The released held identity flight is serialized by the adapter poll and its finished write precedes shutdown. Existing beforeDirectories ownership remains a second cleanup route.

Assertions read complete journal lines only after stop completed, require hub-stopped, and require the probe directory still exists. daemon.ts writes that durable event late in shutdown and drains/closes logs before stop resolves. This establishes writer shutdown before removal rather than equating a launch/status reply with process completion.

T3 remains the appropriate existing native Claude supervisor/PID contract. No new process scenario, production change, dependency, budget allowance or tier downgrade. Existing accountFixtureEnvironment seals launched native fakes and Git/account paths after overlays; inherited synthetic-auth contract remains as previously documented. The per-test note has correct repository-path heading and index row; it accurately describes the new wait/cleanup invariant. No smell finding.

## Spec

C2 verified by source: the fixture cannot schedule future fake ps probes before its executable/marker directory is removed; explicit stop and durable ordering assertions retain the exact original late-PID stopped/status behaviour. This matches the spec's stop-the-fixture option and also narrows marker writes to the held probe. No assertion removed or timeout relaxed.

C1 pending: both 20/20 macOS load proof and whole-file mode-free receipt are required. A-10876/A-10878 retain the former at exact36c6a78a under Coordinatorb86e238b's explicit one-window grant (after prior T-1092 window). Queue precheck local:none/no waiter;20 sequential selected T3 tests, two bounded CPU workers, runnerFixtureEnvironment/prepareRunnerFixture disposable cwd/HOME/XDG/Git/account paths; window11:54:20.987–11:55:27.111, measured66.124s. All20 exits0/pass1, no skips/failures; test times1.961919–3.212881s. CPU workers show74.4%/76.2% in sample; drivers/test/burner closes observed, final identity ps no rows. Other processes are disclosed without asserting an otherwise quiet machine. These are targeted local Darwin27.0.0 receipts, not a suite or budget pass.

A-10870 summarizes red shutdown-order assertion and local green at basead611df9 plus uncommitted source; A-10879 retains8/8 file output, Node17.776856s, target1.447130s. Implementer explicitly disclosed no captured tree hash for red/green and unavailable typecheck wall time; typecheck exit0 reported. These remain partial implementation evidence, not exact-head configured results. Original command receipts were requested and retained without transcription reruns.

Proceed with mode-free configured verification at unchanged36c6a78a, reporting to Reviewer and item lead. Its actual changed-T3 whole-file completion is needed before C1 verification; do not replace it with T0–T2/Web alone. No full-suite request. C1 done mark properly remains pending; C2 source verified now. QA scope none/after-stage.

Reviewer personally completed both axes with read-only source/ref/docs/artifact/topic inspection; no tests, stress, probes, edits, GUI or delegation. Standards0 findings; Spec0 findings.

Audit A-10887. Additional original receipt A-10884 independently read: labelled tool-output transcription, no rerun; red exit1/actualfalse vs expectedtrue, green exit0; typecheck exit0 with unavailable total wall. Node whole-file duration is17.776856s, not separately captured parent-command wall.

Criteria: C2 verified.

### impl-1108 · 2026-10-24T12:13:30.636Z

Same-head mode-free verify 01d5fa21 passed at 36c6a78a on Linux/droplet c-8 lon1 (A-10925): T0, all T1, all T2 fallback, Web, changed T3 file once 8/8, total 2953/2953. Budget/lint report mode; remaining T3 deferred, not claimed passing. C1 now done with exact-head macOS load 20/20 (A-10876/A-10878) plus changed-file runtime receipt; C2 already source-verified. Final evidence review requested from responsible Reviewer in topic-972. Fresh origin/dev 512c4960 conflict check via merge-tree exited 0, prospective tree a2222029, reviewed head unchanged; Coordinator owns merge enqueue after ready.

### rev-32 · 2026-10-24T12:15:27.610Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1108-final
commit: 36c6a78af4253360044fde511707fabb5e45310a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1108 final same-head evidence review — clear

Head36c6a78af4253360044fde511707fabb5e45310a; treeedc6b6dd44b328cfaec724f72dc0e2bac115b080. Task/origin refs and task.view match A-10925. Source verdict rev-20261024-1108-source/A-10887 unchanged. Scope evidence; findings[]; C1/C2 verified.

## Standards

Original configured mode-free run01d5fa21-6c56-44ae-a057-1d4eaaaf5554 finishes exit0. Parsed2953 ordinary test passes/424 passing file completions; zero failure/cancel/skip and no load-gate repetition finish records. Actual hostT0 npm check38.983s, allT1, fallback allT2 hub+Neovim, changedT3 claude-code-accounts.test.ts8/8 once, Web. T4 and remaining unchangedT3 did not run. Modefull is selection fallback, not allT3/T4 or stage coverage.

Runtime Linuxx64 6.8.0-142-generic c-8lon1 cland-v0-43d26213, Node24.21/Nvim0.12.5, workers2/Web4, lifetime767s/$0.0532. Remote typecheck marker67183ed1c63a55a3ac2ee0ffe23ca94e6787232f reuses host gate. Command envelopes T1/T2/T3/Web67/376/35/174s versus suite walls62.42/371.30/30.41/169.20s. Changed-T3 added wall30.345s excludes machine wait; native file completion30.166970s, Node duration30.251956s and test sum29.262s are distinct metrics.

Generic lint/duration/ratchet diagnostics remain report-only:133findings60files; existing Web/items/scale/render warnings and Web wall>40s retained. T3ratchet2195.304s unchanged. No clean enforcing-budget pass.

The untouched, known discovery/restart identity passes10.024485087s; its prior baseline9.736s and report-only warning are disclosed. Runner prints this recommendation, preserved completely, not committed or represented as an active allowance:
{
 "hub/test/claude-code-accounts.test.ts::discovery, watch and restart share each live directory schedule; saved directories survive registry and hub environment edits": {
  "seconds":15.037,
  "owner":"E-1196",
  "added":"2026-10-24",
  "expires":"2026-10-31",
  "reason":"T3 measured peak 10.024 s; 1.5x headroom for claude-code-accounts.test.ts: discovery, watch and restart share each live directory schedule; saved directories survive registry and hub environment edits."
 }
}
This is the printer's >=80%-tier recommendation for a passing known unchanged case, not a new-identity budget refusal. Existing baselines/allowances remain untouched; no source/head change or enforcing gate failure is hidden.

## Spec

C1 verified: Linux whole changedT3 file8/8, named late-PID stop2.308699520s, no ENOTEMPTY/teardown failure. The independent same-head macOS20/20 proof A-10876/A-10878 satisfies the other required boundary: Coordinatorb86e238b's explicit window, queue precheck local:none/no waiter, two bounded CPU workers, sealed scratch root/environment,20 sequential exits0, window66.124s, all test/burner close receipts and no remaining owned PID. macOS selected-test durations1.961919–3.212881s; not Linux or a whole-file load loop. Concurrent processes were disclosed, no quiet-machine latency claim.

C2 reverified with accepted source ordering and successful native run: held PID lookup alone writes finished, bounded release/finish wait precedes nested finally UIclose/awaitfixturestop, durable hub-stopped plus still-existing probe directory assert shutdown before removal. Original late-PID assertions retained. A-10884's transcribed red/green/typecheck and A-10879 precommit local8/8 remain supplemental at their disclosed working-tree source, not exact-commit configured results.

Both claimant done marks current. Implementer reports clean prospective conflict check against dev512c4960/treea2222029; it is only a projection, not runtime evidence or an actual merge. QA none/after-stage. No QA/full-suite/stage/publication claim; normal ready/queue policy applies. Reviewer only read source/refs/tracker/logs/artifacts, no tests/probes/edits/browser/delegation. Standards0 findings; Spec0 findings.

Durable audit A-10936.

Criteria: C1 verified, C2 verified.

### impl-1108 · 2026-10-24T12:15:49.950Z

Final conflict check at ready, 2026-10-24 12:15Z: `git fetch --no-auto-maintenance origin dev` succeeded; origin/dev 512c4960bb573e8df6e215de8bceb509af8e7d6a. `git merge-tree --write-tree HEAD origin/dev` exit 0, prospective tree a2222029ba03d3f816968c6e62561d69b1a0a8cb, no conflicts. HEAD unchanged at reviewed/tested 36c6a78af4253360044fde511707fabb5e45310a; working tree clean. Hub status ready, 2/2 criteria verified, final evidence rev-20261024-1108-final (A-10936). Claim retained for Coordinator's merge enqueue; no dev merge or task-head change performed.

### coord · 2026-10-24T12:30:47.768Z

Merged e82849ebf74227a3736c08438afd139a5f1c4f2c onto dev.
