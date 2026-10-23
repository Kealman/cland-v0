---
id: T-1179
kind: task
title: Fixture worker lifecycle test fails in every local macOS integrated run since T-971
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
regression_of: T-971
topic: topic-905
branch: t/T-1179-fixture-worker-lifecycle-test-times-out
created: 2026-10-23T10:48:52.977Z
updated: 2026-10-23T11:32:10.774Z
closed: 2026-10-23T11:32:10.774Z
---

## Summary

Since T-971 (2cd84fb8) gave the worker in hub/test/fixture-worker-lifecycle.test.ts `env: fixtureEnvironment(container, process.env)`, its test "SIGTERM of a fixture worker reaps its detached hub before removing the temp project" fails in every local macOS integrated run. Both E-417 stage-4 macOS covers at dev e2721ab5 failed it: adfc08f3 (A-9978, 10:48Z) and the retry 32d70fac (A-9986, 11:11Z). Each failed at about 5.1 s with `AbortError`/`TimeoutError` from the parent's `once(worker, 'message', { signal: AbortSignal.timeout(5000) })`. The last macOS cover before T-971 (eb92db13 at f2899a3e, A-9897) passed it in 1.07 s. The droplet runs (Linux stage cover f994fd78, periodic dev T3 at 8614eb64) pass it, and alone on macOS with no integrated run active it passed 5 of 5 at about 1.0 s. That pattern suggests the sealed worker loses something the integrated local run supplies; the prime suspect is the suite lease or admission controls that `runnerFixtureEnvironment` keeps and `fixtureEnvironment` drops. While a local cover holds the slot, the worker's test or fixture hub then waits or refuses instead of starting. This is unconfirmed: find the actual cause.

## What to build

Find why the worker never reports ready during a local integrated run, and fix the test's environment so the worker stays sealed (rule 15) but keeps what a runner child needs, without weakening the T-962 sealed child-launch guard. If the ready wait also needs more headroom, give it a bound that covers the worker's own startup and discovery waits, with the reason in a comment.

## Acceptance criteria

- [x] C1. The cause is named in this item with evidence: a reproduction of the failure while a local integrated run, or an equivalent held suite slot, is active (test).
  - done: impl-1179 · 2026-10-23T11:20:02.985Z
  - verified: rev-26 [reviewer] · run rev-20261023-1179-final-1 · 2026-10-23T11:27:17.587Z · commit e38631506ddbe4f926a55857682e000947029212
- [x] C2. The test passes inside a local macOS integrated run, shown by a mode-free `cland verify --executor local` or by the documented reproduction going green, and still passes alone 5 of 5 (test).
  - done: impl-1179 · 2026-10-23T11:20:03.135Z
  - verified: rev-26 [reviewer] · run rev-20261023-1179-final-1 · 2026-10-23T11:27:17.587Z · commit e38631506ddbe4f926a55857682e000947029212
- [x] C3. The worker launch still satisfies the T-962/T-971 sealed child-launch guard, whose T0 guard tests pass (test).
  - done: impl-1179 · 2026-10-23T11:20:03.361Z
  - verified: rev-26 [reviewer] · run rev-20261023-1179-final-1 · 2026-10-23T11:27:17.587Z · commit e38631506ddbe4f926a55857682e000947029212

## Comments

### impl-1179 · 2026-10-23T11:15:30.622Z

Cause confirmed before source changes at initial task head: fixtureEnvironment(container, process.env) drops CLAND_SUITE_LEASE (and explicit hub discovery controls) from the nested test runner. That runner retains its parent's cwd, so tempProject -> ensureAccountFixture -> assertTestAdmission discovers the project hub and is refused under an integrated local cover before allocating its project or sending ready. Its stdout/stderr are ignored; the parent sees only its 5 s IPC timeout.

Evidence (local macOS, targeted scratch projectHub/fixture-local suite.lock marked integrated=T-1179-cover, no human override): node --test /tmp/t1179-repro.mjs ran the unchanged lifecycle file under the matching inherited lease. Exact output: 'SIGTERM of a fixture worker reaps its detached hub before removing the temp project (5145.276792ms)', 'Error [AbortError]: The operation was aborted', cause 'TimeoutError: The operation was aborted due to timeout'. The scratch hub accepted suite.slot/check with the exact lease and refused the no-lease control. A minimized nested tempProject worker using fixtureEnvironment failed with 'Error: cover-quiet: integrated run T-1179-cover holds the local test slot; wait for it to finish'; changing only its builder to runnerFixtureEnvironment yielded ready and exit 0. This excludes a slow hub startup as the cause. The unchanged standalone file also passed once (~0.934 s test time). The same ready-timeout signature appears in A-9986 lines 20145–20162. These are targeted probes, not suite receipts; runtime budgets remain report-only. Next: retain the regression at the existing cover-quiet T3 worker seam and change only the nested runner's sealed builder.

### impl-1179 · 2026-10-23T11:17:36.704Z

Coordinator-requested audit found one additional same-pattern launcher: hub/test/remote-fixture-lifecycle.test.ts owner launch (the timeout/SIGTERM/watchdog modes). It launches remote-fixture-parent.ts without cwd, which calls remote-fixture.fixture -> tempProject -> admission from the inherited project cwd. The new held-slot regression importing only 'remote fixture cleans up after owner SIGTERM' goes red before changing that site: exit 143 at the target helper's 15 s bound instead of exit 0. The inner owner cannot send its live-hub receipt after admission loses its lease. The file-worker branch imports the same module but only spawns a file-polling worker, never fixture admission, and should retain its fixtureEnvironment. Other scratch package-runner launches pass explicit disposable cwd/options.cwd and intentionally own independent scratch locks; those should not inherit a live suite lease.

### rev-26 · 2026-10-23T11:21:52.268Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1179-source-1
commit: e38631506ddbe4f926a55857682e000947029212
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at e3863150/tree 59cf761c. Standards and Spec: no findings. Both inherited-cwd fixture children now use documented runnerFixtureEnvironment, retaining admission controls while sealing profiles/credentials through the unchanged builder. Remote TMPDIR/NODE_TEST_CONTEXT inputs are filtered before launch; file-polling branch remains ordinary sealed environment. New held-slot regressions reuse existing T3 lifecycle seam and exact named tests, retaining actual readiness/exit/PID/directory assertions. Original timeouts and T0 guard/compiler cases unchanged; audit distinguishes explicit scratch-cwd runners and non-fixture children. A-9991 17/17, A-9992 five standalone and A-9994 six remote passes inspected as supporting local macOS final-source-tree precommit stdout, not exact committed-head configured proof. A-9988 is reproduction source; retain original red/green command/exit/head records and T0/typecheck stdout with provenance limits, without transcription reruns. C1–C3 await final evidence settlement. Proceed with proposed queued mode-free configured/local verification at unchanged head; T0–T2 receipts do not imply T3/T4 coverage. No Reviewer runtime or per-item QA. A-9995: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9995-t-1179-source-review-at-e3863150.md.

### impl-1179 · 2026-10-23T11:26:45.163Z

Final verification at reviewed/pushed head e38631506ddbe4f926a55857682e000947029212: source review clear (A-9995). Mode-free configured executor 7a2a8f39 exit 0, 773 pass/0 fail; droplet Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, lifetime 155 s/cost $0.0108, log A-10003 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10003-suite-7a2a8f39-4df8-40d2-ae08-1ab616e79cf6-auto-at-e386315.log. Mode-free explicit local 70b984b9 exit 0, 773 pass/0 fail; macOS darwin arm64, same Node/Neovim, log A-10001 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10001-suite-70b984b9-ce05-4108-9221-9233c520a9e4-auto-at-e386315.log. Each ran T0 check/all T1/hub-selected T2 set/Web smoke, with budgets and test lint report-only; neither is T3/T4 integrated coverage. Native lifecycle criterion evidence is the documented held-slot reproduction going green plus final precommit source-tree 17/17 cover-quiet, standalone 5/5 and remote lifecycle 6/6 (A-9991/92/94, original command/exit provenance A-9999). No source changed after review. Final git fetch origin dev plus git merge-tree --write-tree HEAD origin/dev exited 0 without conflicts at origin/dev 0e3d36e18ac4fcc13188f1fc1c41bbf4d3721536; head unchanged and tree clean. Coordinator-requested audit found/fixed exactly one additional affected site: remote-fixture-lifecycle.test.ts owner launch; no others (A-9993). Awaiting Reviewer consolidated final settlement. Implementer will not merge.

### rev-26 · 2026-10-23T11:27:17.587Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1179-final-1
commit: e38631506ddbe4f926a55857682e000947029212
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged e3863150/tree 59cf761c; no findings. C1: original held-slot failure and reduced lease-loss control documented before edits, preserved A-9988/A-9999. C2: accepted criterion's documented equivalent local macOS held-slot proof: A-9991 17/17 including both new regressions, A-9992 five standalone passes, A-9994 six remote lifecycle passes; A-9999 retains red/green commands/exits. These are final-source-tree precommit evidence subsequently committed unchanged, not exact-head configured T3/T4 proof; provenance limit retained. C3: exact-head npm check/T0 sealed-child guard/compiler cases pass, builder/guard unchanged, all five environment tests pass. Exact-head local A-10001/70b984b9 and configured Linux A-10003/7a2a8f39 each exit 0 with independently counted 773 ordinary passes/133 file passes and no fail/cancel/skip. Actual scope: T0/check, T1 and Web smoke; coverage-selected T2 empty, T3/T4 absent. Linux c-8 lon1 Node24.21/Neovim0.12.5 workers2, local macOS arm64 workers4; host gate 7b21198d not repeated remotely. Generic lint/budgets/ratchet report-only, zero lint refusals, two baselines missing. All C1–C3 verified from combined evidence; after-stage QA separate. A-10005: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10005-t-1179-consolidated-final-evidence-at-e3863150.md.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-23T11:32:10.774Z

Merged e87a5870dbe3a4c8518c0c36eafbc3c32eb05635 onto dev.
