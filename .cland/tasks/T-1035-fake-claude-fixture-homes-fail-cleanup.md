---
id: T-1035
kind: task
title: Fake Claude fixture homes fail cleanup with ENOTEMPTY while a fake process still writes
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-803
branch: t/T-1035-fake-claude-fixture-homes-fail-cleanup
created: 2026-10-21T06:00:35.827Z
updated: 2026-10-21T14:28:01.899Z
closed: 2026-10-21T14:28:01.899Z
---

## Summary

Tests that use `fakeClaude` (hub/test/harness.ts) fail intermittently at cleanup with `ENOTEMPTY: directory not empty, rmdir '/tmp/cland-suite-…/fake-claude-…'`. A fake session, hook or adapter poll is still writing into the home while the ownership hook removes it. Two different tests failed this way at 8f9e38c0, and each passes 5 of 5 alone.

## What to build

The fake Claude home is removed only after every process that writes into it has exited: the fake daemons, their hooks and the hub's adapter polls. The removal is retried with a bounded wait on ENOTEMPTY or EBUSY. If the directory still cannot be removed, the cleanup names the late writer (the file it created) instead of failing the test with a bare rmdir error.

Evidence:
- `hub/test/roles.test.ts` "roles.toml is written at the first start, and an edit changes the next launch: a role launch takes its defaults". Linux stage cover b7638924 shard-2 at 8f9e38c0 (A-8134).
- `hub/test/aide.test.ts` "a fake Claude Aide keeps answering when a settings hook exits without reading stdin". Periodic dev T3 3bcf604b at 8f9e38c0 (A-8144). Its failing-file rerun b97cfd19 (A-8145) was green.
- `roles.test.ts` alone, 5 of 5 pass, macOS, scratch clone at 8f9e38c0.

## Acceptance criteria

- [x] C1. A test that leaves a late writer in a fake Claude home passes its cleanup once the writer exits, and the cleanup waits for it within a bounded time (test with a deliberate late write).
  - done: impl-1035 · 2026-10-21T13:58:04.759Z
  - verified: rev-23 [reviewer] · run rev-20261021-1035-final · 2026-10-21T14:23:32.278Z · commit 72c117c1c08fbc630fd6a5f877234e92fdc5ccf8
- [x] C2. When the home still cannot be removed after the bound, the cleanup error names the late file (test).
  - done: impl-1035 · 2026-10-21T13:50:43.442Z
  - verified: rev-23 [reviewer] · run rev-20261021-1035-final · 2026-10-21T14:23:32.278Z · commit 72c117c1c08fbc630fd6a5f877234e92fdc5ccf8
- [x] C3. roles.test.ts, aide.test.ts and claude-code-adapter.test.ts pass 20 sequential repetitions each at the task head, in a scratch clone with workers 2 under the load gate (evidence in the item topic).
  - done: impl-1035 · 2026-10-21T14:22:05.484Z
  - verified: rev-23 [reviewer] · run rev-20261021-1035-final · 2026-10-21T14:23:32.278Z · commit 72c117c1c08fbc630fd6a5f877234e92fdc5ccf8

## Comments

### coord · 2026-10-21T13:41:37.866Z

Third occurrence, and the first that stalls an epic gate. `hub/test/claude-code-adapter.test.ts` "Claude Code mod confirmation timeout leaves delivery retryable at the next turn" failed with `ENOTEMPTY: directory not empty, rmdir '/tmp/cland-suite-…/fake-claude-…'` in the E-412 epic suite c5e57fb0 at 5f120a47, shard-2, Linux droplet (A-8429 line 20191). It was the only failure out of 3,588 tests. Flaky rerun rule: one resubmit, fb839f15. Raising this ticket's priority: it is now the most frequent red cause on integrated covers.

### impl-1035 · 2026-10-21T13:48:41.821Z

TDD at fakeClaude ownership seam in a disposable scratch clone, scratch HOME/XDG/Git/config, shared credential filter, system TMPDIR, macOS/local. C1 red: 0/1, Error: directory not empty, code ENOTEMPTY at process-cleanup.ts directory removal. C1 green after writer admission/identity registry/drain: 1/1. C2 red: /jobs\/late-hook\.log/ did not match 'Error: directory busy'. C2 green with 1,000 ms bounded ENOTEMPTY/EBUSY retries: fixture lifecycle file 3/3 (includes orphan-hook exit and stale-CLI fence), existing process-cleanup file 29/29. These are targeted development checks, not suite/C3 receipts.

### rev-23 · 2026-10-21T13:54:32.674Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1035-source
commit: 2df1181aa4c2d67c73496881b2e6a0a4f575943b
scope: full
findings: [{"severity":"medium","text":"The held child starts before the try/finally at45, while fakeClaude ownership is captured only in a synthetic context with no real t.after registration. A setup receipt timeout/rejection therefore leaves the held child and fake home undisposed. Even inside finally, await poll at54 can reject before removal/ownership cleanup. Register guaranteed real-test cleanup immediately after fixture allocation, preserve errors while always settling/reaping writers and invoking ownership cleanup, and cover setup/child failure without weakening the final exit/no-live-removal assertions.","file":"hub/test/fake-claude-cleanup.test.ts","line":29}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear at corrected manifest head2df1181a; A-8434 records full seven-file Standards/Spec audit. Standards M1 medium: new held-poll regression can leak exactly the live writer/home it is meant to protect on setup or child error. Synthetic captured hooks are never registered with real t.after; setup awaits before try/finally, and await poll in finally can skip remaining disposal. This is source-derived, not an executed failure. No additional implementation findings: registry/admission, session groups, bounded poll drain, removal diagnostics and signal seam reviewed; manifest order correction confirmed. C1 failed; C2 execution-dependent/unverified. C3 deliberately pending is not a source failure; Coordinator4cdddaa3 approved sequential scratch workers2/load<15/runner-lock repetitions with no overlap. Correct source and request re-review before verification/C3. A-8433 contains development summaries only; no queued or C3 pass claimed, no Reviewer runtime.

Criteria: C1 failed (The held-poll regression has no real after hook and starts its finally after setup; setup rejection or a rejected poll bypasses owned cleanup and can leave the writer/home alive.).

### rev-23 · 2026-10-21T13:59:23.264Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1035-source-2
commit: 72c117c1c08fbc630fd6a5f877234e92fdc5ccf8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8436 extends full audit A-8434. Standards0/Spec0. M1 resolved: captured ownership registers immediately with real t.after, restores filesystem mocks before disposal, and no rejected poll can skip that hook; release armed before launch. Added actual child-test scope setup-rejection/CLI-error coverage retains final PID-gone/home-absent assertions; held-poll no-live-removal and all original lifecycle assertions retained. Implementation/docs unchanged. C1/C2 still runtime-unverified; C1 done refreshed, C3 deliberately pending. A-8435 is development red/green summary, not queued/C3 proof; retain original targeted stdout/exit and execution head/tree for final evidence. Proceed mode-free verify and authorized sequential C3 at this unchanged head, respecting Coordinator4cdddaa3 load<15/workers2/runner-lock/cover-quiet/no-overlap conditions. Final verdict waits for same-head run plus lifecycle/C3 receipts. No Reviewer execution; QA none.

### impl-1035 · 2026-10-21T14:22:05.504Z

C3 complete at head72c117c1c08fbc630fd6a5f877234e92fdc5ccf8/tree86262b7ae6a616d5308a0fe22b10badaaa385e0f. macOS arm64, Nodev24.21.0, local, scratch clone with fixtureEnvironment-sealed HOME/XDG/Git/provider/account state and original system TMPDIR. Workers2, one file at a time, 20 sequential fresh package-runner invocations each: roles20/20, aide20/20, claude-code-adapter20/20. 260 underlying tests passed; 0 failed/cancelled/skipped, all60 exits0. Start load gate enforced<15 (observed4.33496–13.90088), controller paused twice when load exceeded15. Runner shared /tmp locks serialize with local covers; no overlap with mode-free verify37c0de9b, which completed before C3 began. T3 targeted repetition evidence only; tier resource and duration budgets report-only, no Linux/integrated claim. Original60 logs, structured receipt and exact controller are published as the C3 artifact in topic-803. Queued verify37c0de9b separately passed2295 tests, T1/T2/Web, Linux x64 droplet c-8lon1, lifetime506s/cost$0.0352, workers2 (Web phase4); report-only duration/tier gates, host typecheck gate reused at8410f05 rather than repeated. A-8444 holds that receipt; A-8441 holds original C1/C2 lifecycle stdout/exits, whose execution tree matches this head. Final evidence review requested; head unchanged since clear source rev-20261021-1035-source-2.

### rev-23 · 2026-10-21T14:23:32.278Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1035-final
commit: 72c117c1c08fbc630fd6a5f877234e92fdc5ccf8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-8454 audits all receipts, origin tip unchanged from source-clearA-8436. C1/C2 original A-8441 local Darwin7/7/exit0 covers late poll, hook exit, admission fence, bounded late-file diagnostic/retry and M1 setup/child error cleanup. Executed overlay provenance names tree86262b7a identical to committed72c117c1; targeted plain Node, no tier/duration gate. C3 independently checked all60 A-8453 original logs/receipt/controller: roles20/20(80passes),aide20/20(60),adapter20/20(120),260total,zero fail/cancel/skip/todo; sequential1–20 each, workers2 runner locks and sealed scratch environment, all start loads4.335–13.901<15. First14:09:25 after task verify finished14:08:51; Coordinator4cdddaa3 authorized this targeted local Darwin T3 repetition plan. Same-head queued37c0de9b/A-8444 Linux droplet T1/allT2 both+actualWeb3files exit0:2295ordinary/351filepasses,no load-gate finishes. Hostcheck8410f05f reused not repeated remotely; testlint132/59,duration/ratchet report-only, existing overages retained without timing-pass claims. No integratedT3/T4/stage/QA pass claimed. All C1–C3 verified, no findings; no Reviewer execution, QA none.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T14:28:01.899Z

Merged a4001ec5d9573e5cc35da94120b2fb16b5653827 onto dev.
