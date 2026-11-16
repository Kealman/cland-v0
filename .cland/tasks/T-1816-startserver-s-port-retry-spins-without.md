---
id: T-1816
kind: task
title: startServer's port retry spins without bound when freePort keeps returning an already-attempted port
state: closed
status: done
size: XS
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1562
branch: t/T-1816-startserver-s-port-retry-spins-without
created: 2026-11-11T18:14:27.445Z
updated: 2026-11-16T18:47:14.267Z
closed: 2026-11-16T18:47:14.267Z
---

## Summary

impl-1794 found (topic-1481, 2026-11-11 18:14Z) that `startServer` tracks attempted ports and does `if (attempted.has(port)) continue`. When `host.freePort` returns the same port again (a native test fixture pinned it to 12345), the loop spins on resolved promises without ever yielding a bound, until Node fails with `RangeError: Map maximum size exceeded` from the async-hook continuation map after about 30 s. The fixture is being fixed in T-1794; the loop itself has no attempt bound, so a freePort that repeats a port turns into a hub crash instead of a typed launch failure.

## What to build

Bound the retry: a fixed, named number of attempts (or a repeated-port refusal), after which the launch fails with a typed error naming the port; never a busy loop.

## Acceptance criteria

- [x] C1. A freePort that always returns an attempted port makes `startServer` fail within its named attempt bound with a typed error naming the port (test).
  - done: impl-1816 · 2026-11-16T17:08:09.568Z
  - verified: rev-37 [reviewer] · run rev-37-1816-final-1 · 2026-11-16T17:08:42.100Z · commit c78e87d536fcafb1e65c291cc0f566d927871993
- [x] C2. An address-in-use followed by a fresh port still succeeds on the next attempt (test).
  - done: impl-1816 · 2026-11-16T17:08:09.720Z
  - verified: rev-37 [reviewer] · run rev-37-1816-final-1 · 2026-11-16T17:08:42.101Z · commit c78e87d536fcafb1e65c291cc0f566d927871993

## Comments

### coord · 2026-11-11T18:14:46.091Z

Exact location from impl-1794: OpenCode `startServer` in `hub/src/adapters/opencode/server.ts:74` (`if (attempted.has(port)) continue`), producing more than 16M async-hook continuations and the RangeError before its 30 s deadline. Triggered by T-1794's native fixture's constant freePort after a socket collision; the fixture fix stays in T-1794.

### impl-1816 · 2026-11-16T16:18:16.235Z

Rule 20 consumer audit: searched startServer, freePort, EADDRINUSE/address-in-use, existing serve failure messages and LaunchRecoveryPending across hub/web/nvim, docs, QA briefs and shipped skills, including T3/T4. Sole production caller is OpenCodeAdapter.spawn (opencode.ts); its existing launch rollback rethrows Error or wraps it in LaunchRecoveryPending, preserving message/cause. Sessions launch/resume in adapters/sessions.ts formats Error.message/String(error), retains cleanup ownership and generic failure classification; no new wire refusal code/shape is added. CLI/web/Neovim launch rendering consumes that existing generic failure text; no migration. Existing opencode-host T2, opencode-adapter T3, opencode-remote and opencode-remote-cleanup native tests, fake-opencode collision fixture, launch recovery tests (codex-host, claude-code-remote-files, session-archive) and QA E-412/E-1533/4/5/7 briefs do not classify port errors or pin the timeout text; unaffected. New typed Error is local to startServer, preserving the prior Error contract. C1 red on baseline source: 'Error: port selection exceeded regression safety bound; port selections: 1001', expected OpenCodePortRetryError; 64.5 ms test on macOS local Node 24.21.0. The fake has both a 1000-call and 250 ms safety fence; no native/network operation.

### rev-37 · 2026-11-16T16:25:24.757Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1816-source-1
commit: c78e87d536fcafb1e65c291cc0f566d927871993
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review A-20251: Standards clear, Spec clear; no findings. Eight selections count duplicate ports before a ninth freePort call, with local typed Error naming last port/count and unchanged existing deadline/collision-success/rollback ownership. New scripted T2 controls retain exact8 selections/1spawn and fresh-port authenticated readiness/secondPID+URL/exit checks; no native or network work. Docs and consumer dispositions match. A-20247/A-20250 retain original candidate excerpts: final2 regressions green, full14 before safety-only adjustment; static checks predate or overlap guard/docs changes and are not exact-head passes, raw streams/launch hashes unknown. No Reviewer runtime or configured receipt yet; C1/C2 remain unverified for same-head configured evidence.

### rev-37 · 2026-11-16T16:32:26.130Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1816-evidence-1
commit: c78e87d536fcafb1e65c291cc0f566d927871993
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Actual failure: 'DigitalOcean 0 transport: request failed or exceeded its time bound'; hub exit1/failed. A-20264: source remains unchanged/source-clear A-20251, no new source findings. A-20262 head matches; localT0exit0/126.212s, remote platform/browsernull, no test-finish receipts, counts unavailable. T1/T2/Web and T3/T4 unexecuted, planned projections not passes; report-only notices retained. C1/C2 failed marks denote incomplete configured evidence, not failing product assertions. Lead holds retries for recovery/window guidance; no Reviewer run or resubmission.

Criteria: C1 failed (Configured run497fbadd ended on executor transport error after T0; no runtime receipt for the bounded repeated-port case.), C2 failed (Configured run497fbadd produced no runtime receipt for fresh-port success; evidence incomplete, not a failed product assertion.).

### rev-37 · 2026-11-16T17:08:42.101Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1816-final-1
commit: c78e87d536fcafb1e65c291cc0f566d927871993
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, C1/C2 verified; A-20302. Independently matched 7e37f560/A-20300 provenance/canonical tree6f907682a45c43a762a640660bc060c5994f2187 to reviewed head; each exact port-regression case has ordinary pass +five recorded load passes/5of5, full Host14/14+file. HostT0/allT1/fallbackallT2/Web exit0, hub6465pass/0fail/cancel/skip/todo. Linuxx64 droplet Node24.21/Nvim0.12.5; actual HeadlessShell1248/CfT156.0.8078.4, uncached. T3/T4 unexecuted/deferred; budgets/lint/ratchet report-only. Earlier A-20262 transport failure/incomplete marks retained as history, no new source change. Scripted Host proof not native OpenCode binary evidence. Standards/Spec clear; findings[]. No Reviewer runtime.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T18:47:14.267Z

Merged 2a5df555f66b85901a7995d78dd56a74f495a93f onto dev.
