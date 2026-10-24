---
id: T-1149
kind: task
title: Neovim artifact-render test misses the artifact event within 10 s under Linux load
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-985
branch: t/T-1149-neovim-artifact-render-test-misses-the
created: 2026-10-22T17:31:42.287Z
updated: 2026-10-24T14:01:29.176Z
closed: 2026-10-24T14:01:29.176Z
---

## Summary

`nvim/test/artifact-render.test.ts` › "artifact events refresh an open projection and raw saves replace its cached version" failed on a Linux c-8 lon1 droplet in T-1118's verify 4d419525 (A-9386, head 451ef78a). The error was `the screen never showed artifact event reaches the rendered grid within 10000 ms`, with the grid still showing "Original live note". The same identity failed earlier in T-1004's run 5c627151 (A-8029). On dev d3e632bc it passes 5/5 alone on local macOS, and T-1118 touches no Neovim code.

## What to build

The test waits for the hub's artifact delivery receipt and the projection's refresh receipt rather than a 10 s screen poll under load, and keeps its final grid assertion.

## Acceptance criteria

- [x] C1. The named test passes 20/20 in a local load loop and in a mode-free `cland verify` on Linux, keeping its final grid assertion (test).
  - done: impl-1149 · 2026-10-24T12:58:42.703Z
  - verified: rev-31 [reviewer] · run rev-20261024-1149-final · 2026-10-24T13:55:58.435Z · commit 21698b8a52c4fdfdbbed16e873294aadf3c74613

## Comments

### impl-1149 · 2026-10-24T12:54:45.713Z

Baseline at 699a44dd on local macOS: the named artifact-render T2 test passed 1/1 alone (535 ms runner total), without burners; no full verification receipt. Historical failure remains the ticket's quoted Linux screen timeout. Coordinator granted scheduling a bounded 20x/two-burner window at the committed review head. Implementing an armed exact-artifact event observer and a changed projection-buffer/content receipt before final grid readback.

### impl-1149 · 2026-10-24T12:59:21.764Z

Committed/pushed 21698b8a52c4fdfdbbed16e873294aadf3c74613 after merging fresh origin/dev 16a7bbe5. Exact-head local macOS arm64 targeted named T2 case passed 20/20 under two CPU burners, 2026-10-24T12:58:00.088Z–12:58:09.445Z, in the Coordinator-granted rule-3 exclusive window; queue pre-check local:none/no local waiter; burner close receipts observed. Raw log A-11062, durable /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11062-t-1149-committed-head-local-20-20-load-log.log. No full-suite or tier-gate pass claimed from this targeted loop. Source review request queued with reviewer role; Linux mode-free verification and C1 evidence review still pending.

### rev-31 · 2026-10-24T13:40:13.987Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1149-source
commit: 21698b8a52c4fdfdbbed16e873294aadf3c74613
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1149 full source review — clear

Head 21698b8a52c4fdfdbbed16e873294aadf3c74613, tree 584a31f30fe27aa0ede740920683898abe0b5bd1, fixed base 16a7bbe526dc989c701b4bf20cc1676763fdea2a. Command git diff 16a7bbe5...21698b8a; single commit 21698b8a. Only nvim/test/artifact-render.test.ts and its canonical guide changed. Task/origin refs match, task worktree clean, whitespace check clean. Live hub/named request assigned rev-31; rev-32 expressly had not started/held and declined competing review. C1 claimant done, QA none/after-stage/no separate brief or criteria. Both axes audited in-session without subagents.

## Standards

No findings. Rule 9 boundaries are explicit:
- Cached raw buffer/projection restoration is observed before capturing the projection buffer ID.
- Exact artifact id/path client callback is registered before source write/scene.emit. The scene control acknowledgement is correctly treated only as the stub write receipt.
- Client delivery is awaited separately from the target projection receipt.
- Projection receipt requires the same current buffer, cland_render_pending == false and exact full lines for the requested version.
- A forced redraw follows this receipt, then a fresh screenstring grid read supplies retained final assertions.
- Raw mode requires exact cached raw-buffer identity before source read/edit; raw save then waits for exact settled saved projection.

The existing eventually helper bounds each setup/refresh observation via testWaitMs, with no new sleep or elapsed-time success. This is a boundary correction, not merely extending the old 10 s screen poll. Inspected artifact_md.lua: pending clears after extmarks/metadata apply (and is set appropriately for short completed renders), so exact source lines alone cannot satisfy an unfinished projection. Real grid conceal remains separately asserted. c.screen reads Neovim screenstring via RPC after redraw.

Existing T2 recorded stdio/owned files and headless Neovim seam remains unchanged. No product code, new process, tier/resource policy, workload, cap, allowance, dependency or permission edit. Fixture's existing sealed environment and stop-before-directory ownership carry unchanged. One callback/global is local to the owned Neovim fixture lifetime. Canonical guide accurately documents the event versus projection versus grid distinction. No help/role/skill change is required for this test-only correction; no baseline smell finding.

## Spec

No findings. The named test still requires updated heading/body with rendered Markdown, excludes original/raw markers, opens raw content and checks exact updated source, saves a human heading, then requires saved rendered heading without markers and excludes the superseded agent heading. Positive/negative final grid and exact raw-source assertions are retained, not replaced by receipt-only checks.

Historical Linux failures in A-9386/A-8029 remain the ticket's original screen timeout (“the screen never showed artifact event reaches the rendered grid within 10000 ms”), not locally reproduced. A-11060 notes local baseline pass and a separate incorrect development expectation: raw projection lines retain Markdown source markers while grid conceal hides them; the corrected exact source expectation is appropriate, not a relaxed final display assertion.

Read Coordinator c0c73cc3 grant and4944ac9d window confirmation independently. A-11062 is original exact-head local macOS arm64 named-test log, 20 sequential repetitions with two CPU burners in the exclusive rule-3 window. Queue precheck local:none/no local waiter. Window12:58:00.088Z–12:58:09.445Z (9.357 s); every repetition exit0/no skips, named test .325145625–.380124959 s, native runner .412318042–.493407292 s. Log records burner close receipts. Targeted invocations did not enable tier/resource gates and are not Linux/configured proof. No additional load loop requested.

A-11060 is a summary of earlier uncommitted implementation over699a44dd: changed file14/14, native runner6.199s, named.309111s, Neovim TS typecheck green. Preserve available original full-file/typecheck and load orchestration call/result metadata (commands/exits/platform/source, burner stop/wait receipts and original truncations) in a durable artifact without rerunning for transcription; no invented command wall time. The current20/20 log remains distinct from precommit targeted summaries.

Disposition: full source clear, findings []. C1 runtime verification remains pending ordinary configured mode-free cland verify on Linux at this unchanged clean head; then audit named identity and completed phase/gate evidence, retaining local20/20 attribution. Submit configured run and route result here. No post-review dev merge except Coordinator-posted shared fix/conflict direction, no enqueue by Reviewer. Reviewer only read-only source/Git/tracker/log/artifact inspection; no test/build/probe/browser execution or delegation.

Standards: 0 findings. Spec: 0 findings.
Durable source audit A-11098.

### impl-1149 · 2026-10-24T13:53:14.457Z

Configured mode-free Linux droplet verification b8420dd3-78f8-46ad-834d-56a251aede9b passed at source-reviewed head 21698b8a: 2989/2989; T0–T2 and Web, fallback all T2; no T3/T4. Budget/lint gates report-only. Executor c-8 lon1 linux x64, Node 24.21.0, Neovim 0.12.5, workers 2, lifetime 671 s, $0.0466. Named case explicit receipt 662.088391 ms in A-11126 lines 13172–13174. Evidence review requested from responsible Reviewer rev-31 with A-11126/A-11062/A-11099. Fresh fetch origin/dev 847b7c28; merge-tree conflict check exit 0, result ed4233627a4b3e8f701f1d3a39d2a3037367f055; reviewed HEAD unchanged and clean. Awaiting final evidence verdict.

### rev-31 · 2026-10-24T13:55:58.435Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1149-final
commit: 21698b8a52c4fdfdbbed16e873294aadf3c74613
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1149 final same-head evidence review — clear

Head21698b8a52c4fdfdbbed16e873294aadf3c74613 / tree584a31f30fe27aa0ede740920683898abe0b5bd1, pushed task ref unchanged. Carries full Standards/Spec source review A-11098 / rev-20261024-1149-source. Inspected task.verify, original configured A-11126, local raw20/20 A-11062 and original orchestration A-11099. Reviewer performed read-only inspection only.

Configured mode-free b8420dd3-78f8-46ad-834d-56a251aede9b exited0 at this head: ordinary2989/2989, zero failures/cancellations/skips. T0/allT1/full fallback hub+NeovimT2/Web completed; mixed nvim/docs changes explain fullT2 fallback. The exact named C1 test, “artifact events refresh an open projection and raw saves replace its cached version”, has an explicit Linux ordinary pass at0.662088391s; all14 artifact-render identities passed. It is an unchanged identity and did not require a new-test allowance. The unrelated unchanged20,000-line case reports2.216535331s versus2s; no allowance/baseline change inferred from that report.

Native executor Linux x64 6.8.0-142-generic, Node24.21, Neovim0.12.5; droplet c-8 lon1 cland-v0-7ed7abdf, workers2, lifetime671s, cost$0.0466. T0 envelope25.742s uses reused host check tree bfa38bb3fe87cfb5c1e18177de5060177a4d95ff, not a remote exact-head check. T1 envelope65s, T2 357s, Web156s; actual Web shard151.87s (phase suite151.98s) is above40s report-only budget. Test lint133/60, duration notices and T3 ratchet are report-only. T3 deferred to periodic/integrated occasions; no T4 or QA cover claimed. Tier projections are not observed wall times.

Local proof independently inspected: A-11062 names the same committed head, Darwin arm64, Coordinator exclusive window and queue precheck. Twenty sequential named-test executions each pass1/1 with zero skips and exit0, while two bounded CPU burners run. Start12:58:00.088Z/end12:58:09.445Z is9.357s orchestration wall; named bodies0.325145625–0.380124959s (separate from runner time). A-11099 uses a sealed runnerFixtureEnvironment in an owned temporary root, pre-registers close promises for all children, sets a six-minute maximum and waits for remaining child/burner closes in finally before its final receipt. The raw log records all20 exits and burner close observation. Coordinator approvals c0c73cc3/4944ac9d were checked in source review. This is local macOS stress proof, not native Linux load proof.

Source/final assertions retained from A-11098: arm exact artifact id/path receipt before mutation, then wait on the current projection buffer's completed render flag and exact source lines; force redraw and obtain fresh grid. The positive updated/saved final grid checks, conceal negatives, exact raw bytes and removal of the old heading remain. No cap/timeout inflation or product implementation change. Full-file/typecheck earlier receipts are summaries in A-11060, not reconstructed raw originals; local stress and configured native receipt supply the required final evidence.

C1 verified: exact-head20/20 authorized local load plus native Linux mode-free named pass, with final grid assertion intact. Final evidence clear, zero findings. Claimant's clean merge-tree against observed dev847b7c28 is conflict evidence only; reviewed task head unchanged and no actual dev merge performed. Coordinator owns enqueue; no extra execution or source work required.
Durable review A-11135.

Criteria: C1 verified.

### coord · 2026-10-24T14:01:29.176Z

Merged 34475b5c4a9cce1c67eaadea006c9f2e40b333c0 onto dev.
