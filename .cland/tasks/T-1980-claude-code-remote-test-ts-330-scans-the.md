---
id: T-1980
kind: task
title: claude-code-remote.test.ts:330 scans the fake host's run directory while processes.json is atomically replaced, and fails with ENOENT on the temporary file
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1696
branch: t/T-1980-claude-code-remote-test-ts-330-scans-the
created: 2026-11-18T15:22:04.049Z
updated: 2026-11-21T08:54:13.474Z
---

## Summary

Merge batch e69dcee6 (T-1634 and T-1973; Linux droplet c-8 sfo2, integrated head 44f9ed43e, A-21305) failed in T3 on `hub/test/claude-code-remote.test.ts:313`, "hub restart after tree closure re-adopts its durable generation and releases the job", with `Error: ENOENT: no such file or directory, open '…/home/.cland-host/run/processes.json.new-17812-…'` from the test's own recursive `scan` helper (line 330). The scan lists the fake host's run directory, then reads each entry, while the host writes `processes.json` through a temporary `processes.json.new-*` file and an atomic rename. An entry listed by `readdir` can be gone by the time it's read. That's a race in the test helper, not in either batch member: neither diff touches the file or its subject.

## What to build

Make the scan tolerate entries that disappear between listing and reading. Skip a temporary `*.new-*` writer file, or treat ENOENT on an entry the listing just returned as "gone". Or wait for the host's write receipt before scanning. Keep every assertion about the re-adopted generation and the released job unchanged.

## Acceptance criteria

- [x] C1. With a writer held mid-rename (a deterministic seam, not a timing loop), the scan completes and the test's assertions still hold (test, red before).
  - done: impl-1980 · 2026-11-21T08:11:20.422Z
  - verified: rev-35 [reviewer] · run rev-35-1980-evidence-2 · 2026-11-21T08:54:13.300Z · commit 05db4b65508323f5893b9d70dabb1c8705c65a6e
- [x] C2. The affected restart case ("hub restart after tree closure re-adopts its durable generation and releases the job") passes 20/20 serially under a load gate at 10, and the whole file passes once at the same load, with assertions unchanged (evidence, exclusive stress window).
  - done: impl-1980 · 2026-11-21T08:20:42.589Z
  - verified: rev-35 [reviewer] · run rev-35-1980-evidence-1 · 2026-11-21T08:22:36.924Z · commit 05db4b65508323f5893b9d70dabb1c8705c65a6e
  - verified: rev-35 [reviewer] · run rev-35-1980-evidence-2 · 2026-11-21T08:54:13.300Z · commit 05db4b65508323f5893b9d70dabb1c8705c65a6e

## Comments

### impl-1980 · 2026-11-21T07:42:41.774Z

Deterministic regression staged in the existing T3 restart case; writer is held before rename until scan lists its temporary entry. Existing assertions retained. Full test:lint and typecheck exit 0 on macOS arm64 Node 24.21.0 (regression-only working tree). Native red/green waits for Coordinator slot; C2 stress window follows source-clear.

### rev-35 · 2026-11-21T07:51:39.136Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1980-source-1
commit: 76b4aca473080eb511182f019f5f62394d3e24e3
scope: full
findings: [{"severity":"medium","text":"M1: Modified callback/new held writer and scan continuation lack pre-acquisition cancellation ownership and separate setup/action bounds; fixture cleanup can overtake them. Enroll and positively join/release the writer before guarded root removal, preserving a selected scan failure when drainage rejects, with interruption controls.","file":"hub/test/claude-code-remote.test.ts","line":343},{"severity":"low","text":"L1: A-22389's evidence index calls 5650.100792/4239.497583 ms wall time, but the retained logs record these as Node duration_ms. Relabel them as test-reporter durations; no timing rerun or speedup claim is warranted."}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source not clear; A-22393. Standards M1 medium: the held writer and scan continuation are outside sshHostFixture's owned work; local finally joins ordinary unwind only. Enroll complete modified callback/setup/action and writer drainage before guarded root cleanup; preserve a selected assertion failure if drainage also rejects. Implementer confirms no covering owner/control (badfd982). No additional functional Spec finding: ENOENT-only catch, deterministic listed-entry rename, generation/job assertions and credential checks are retained. Evidence L1 low: authored index wall labels are Node duration_ms reporter readings; correct labels without rerun. Retained named red/green is one targeted local macOS T3 case, not full-file 20/20 or configured proof. C1 failed; C2 remains unchecked/unverified and stress waits for corrected-head source clearance/capacity. No Reviewer tests/probes/edits. Hold releases for one consolidated correction and fresh source review.

Criteria: C1 failed (The new held writer/scan callback lacks encompassing pre-acquisition cancellation ownership and separate setup/action bounds, allowing fixture cleanup to overtake it.).

### rev-35 · 2026-11-21T08:03:19.029Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1980-source-2
commit: b78da803a17b00f6acf38744dd4f97c2643465e4
scope: full
findings: [{"severity":"medium","text":"M1 residual: new control registers its releaseScan hold only in a later t.after, after shared teardown that joins the held scan; abort/assertion failure can delay release until cleanup times out. Register unconditional release with the owner's releaseOnClose before admission and retain ordered guard/close assertions.","file":"hub/test/fixture-socket-path.test.ts","line":31}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear for one residual M1 control gap; A-22407. Main recovery callback/writer ownership, positive writer-close root guard, primary/secondary drainage handling and L1 timing labels are corrected. The first filesystem control still registers releaseScan only in a later t.after, behind caseDeadlines teardown that joins that held scan; abort/failure before manual release can wait for cleanup deadline. Implementer confirms no alternate seam (3cfac32c). Use existing owner releaseOnClose before admission and move ordered retention observations to that guard/release boundary. Retain actual guarded removal, positive close and final ENOENT assertions. No additional ENOENT/Spec finding; no production/dev merge. C1 remains failed; C2 pending unchecked/unverified. A-22401 targeted local checks are not stress/configured proof. No Reviewer execution/edit. Hold releases for narrow control correction and fresh source review.

Criteria: C1 failed (Shared writer ownership is corrected, but the new guarded-removal control must release its own held scan before cleanup joins it on abort/assertion failure.).

### rev-35 · 2026-11-21T08:11:11.554Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1980-source-3
commit: 05db4b65508323f5893b9d70dabb1c8705c65a6e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear, findings=[]; A-22414. Residual M1 resolved: releaseScan is registered pre-acquisition with owner.releaseOnClose, retained-root/no-writer-close observation occurs at that ordered boundary and finally always releases before join. Actual guard entry, release observation, positive writer closure and ENOENT assertions remain. Recovery helper/native case are exactly source2 blobs; accepted ENOENT/content/recovery checks carry unchanged. No dev merge. L1 reporter-time labels remain corrected. A-22413 reports 22/22 local T2 controls and lint/typecheck, not configured/stress proof; earlier native target remains earlier evidence. No Reviewer execution/edit. No criterion verified in this source-only pass: C1 remains unchecked from prior failure and should be re-marked done by lead for the corrected work; C2 campaign pending. Hold releases; keep head fixed for Coordinator-authorized stress/verify windows and later same-head evidence review.

### rev-35 · 2026-11-21T08:22:36.924Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1980-evidence-1
commit: 05db4b65508323f5893b9d70dabb1c8705c65a6e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C2 campaign evidence clear only; A-22426, findings=[]. Coordinator 8e65b199 explicitly edited C2 to 20 affected-identity runs plus one whole-file run, starts >=10/<20. All 21 raw logs independently match structured native receipts: target identity 20/20, full file 46 distinct passing names/46 passes, code0/signalnull, zero fail/cancel/skip. Target starts10.6416–16.3735, full15.0713; all<19. Common start receipt binds reviewed head/macOS arm64 Node24.21 and burner9860; matching SIGTERM native close retained. Driver hash/index supplies scope; absent per-round tree/argv/timestamps remain unknown. This is local native T3-file evidence, not Linux/all T3/T4/Web or configured verification. Verify C2 only; C1/final settlement awaits actual run8da41079, currently admitted. No Reviewer execution/edit. Hold releases; unchanged head and no duplicate run.

Criteria: C2 verified.

### impl-1980 · 2026-11-21T08:52:23.643Z

Configured same-head run 8da41079 completed exit 0 at 05db4b655; evidence A-22441. Linux x64 droplet c-8 ams3, Node24.21.0: T0/T1/T2, selected changed T3 file46/46 and Web completed. 7311 pass, 0 failures, 1 macOS-only selector skip; duration/budget gates report-only. Browser Chrome for Testing156.0.8078.4 Headless Shell. Remaining T3 is deferred to merge batch; T4 unexecuted. Reviewer settlement pending; no source change or rerun.

### rev-35 · 2026-11-21T08:54:13.300Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1980-evidence-2
commit: 05db4b65508323f5893b9d70dabb1c8705c65a6e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-22443, findings=[]. Run8da41079/A-22441 finished/passed at source3-reviewed05db4b655; refs unchanged. Typed starts/pass finishes confirm affected recovery identity and both ownership controls (each base+5 distinct load passes). Actual file receipts: all241T1/443T2/55Web plus selected T3 claude-code-remote46/46; T0 also exit0. Producer7311pass/1platform skip/0fail/cancel. Remaining272T3 deferred merge batch, no18T4 runtime proof; report-only budgets/lint do not enforce timing. Linux x64 droplet c-8/ams3 Node24.21 Nvim0.12.5, isolated HeadlessShell1248/Chrome for Testing156.0.8078.4. Canonical verification treedcbaea2a differs from Git83338f6f by definition. C2's separate macOS20-target+one-full-file stress evidence remains current via A-22426/Coordinator8e65b199. Verify C1/C2 at exact commit; prior failures retained. No Reviewer execution/edit. Hold releases; no duplicate run/manual Coordinator relay, integrated T3 remains merge batch.

Criteria: C1 verified, C2 verified.
