---
id: T-1968
kind: task
title: Lease compaction rewrites lease-index.json on every pass even when unchanged, so gateway-state's file snapshot catches its .tmp file and macOS covers go red
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1950
topic: topic-1626
branch: t/T-1968-lease-compaction-rewrites-lease-index
created: 2026-11-18T12:02:12.750Z
updated: 2026-11-18T14:16:51.027Z
closed: 2026-11-18T14:16:51.027Z
---

## Summary

The E-1883 stage-1 macOS cover 399057cc (local darwin arm64, 2 workers, dev 93026cbe9, A-21206, T2 peak load 10.72) failed one case: `hub/test/gateway-state.test.ts:85`, "the daemon keeps remote state only in hub.db across a hub restart, including TEXT ids above 2^53", with `AssertionError: remote writes create no separate state file`. The before and after listings of `.cland` differed only in `run/executor/lease-index.json` versus `run/executor/lease-index.json.<uuid>.tmp`. T-1950's compaction (hub/src/executor/droplet/lease.ts, around line 173) calls `durableJson(indexPath(root), { version: 1, leases: keep })` on every pass, even when `keep` equals the stored index. Each pass therefore writes a temporary file and renames it, so any file-tree snapshot can catch the temporary file. The constant rewrites also add file-system events on macOS, the load class behind the 2026-11-18 fseventsd incident (T-1957).

## What to build

Compaction writes the index only when its contents change. The test's file snapshot then sees a stable tree, without loosening its assertion.

## Acceptance criteria

- [x] C1. A compaction pass whose kept set equals the stored index performs no write and creates no temporary file, and a changed set still writes durably (test that counts writes through a fake filesystem boundary).
  - done: impl-1968 · 2026-11-18T12:16:07.387Z
  - verified: rev-39 [reviewer] · run rev-39-1968-final-20261118 · 2026-11-18T12:56:21.959Z · commit 11940e5643a68aeb6cc32617756af629e4c0ee9d
- [x] C2. `gateway-state.test.ts` passes unchanged 20/20 on macOS (evidence), and every other writer of lease-index.json is listed with its disposition (rule 41).
  - done: impl-1968 · 2026-11-18T12:16:08.587Z
  - verified: rev-39 [reviewer] · run rev-39-1968-final-20261118 · 2026-11-18T12:56:21.959Z · commit 11940e5643a68aeb6cc32617756af629e4c0ee9d

## Comments

### impl-1968 · 2026-11-18T12:04:18.356Z

Writer inventory (rule 41): searched lease-index.json, indexPath, compactLeaseIndex and compactLeaseHistory across hub/src, hub/test, nvim/test, web/test, docs and shipped skills. Production writers are compactLeaseIndex publication (changed here: unchanged ordered membership skips durableJson), writeLease per-lease append (unchanged: already writes only for an absent id, admits membership before record), and missing-index/startup migration through compactLeaseHistory(rebuild=true) -> compactLeaseIndex (same guarded writer; absent index still publishes, recovered new ids still publish). No other production writer found. Test raw readers/fault boundaries: executor-lease-index, executor-prepare-component, executor-droplet-component, merge-queue; interrupted repair test now supplies a real membership change before its publication fault. Format and all readers unchanged. C1 red then green: new test first recorded two unwanted durable writes on unchanged passes; full executor-lease-index now 8/8 on local darwin arm64 Node 24.21.0. Native slot pending for C2.

### impl-1968 · 2026-11-18T12:12:16.241Z

Coordinator decision extends fix: absent index plus empty directory scan stays absent, preserving legacy migration fallback. Reader inventory: readIndex returns null on ENOENT; readLeases scans directoryIds; readDemoLeases scans readLeaseHistory; compactLeaseIndex scans directoryIds for absent index and unions on rebuild; writeLease now seeds a complete first index with legacy directory ids and its new admitted id. Raw tests: merge-queue already handles absent index; executor-prepare-component now holds demo-directory mkdir instead of a nonexistent empty publication and asserts absent index; executor-droplet-component retains its mkdir hold and asserts absent empty index. First C2 attempt preserved as A-21210 (2 green, 1 red), not superseded yet. Fresh-empty test red: AssertionError an absent empty index needs no durable publication, 1 !== 0. Legacy-first-append red: index ENOENT. New candidate lease-index 10/10; both changed T2 files 51/51 local macOS. Full final lint/typecheck and C2 rerun pending.

### rev-39 · 2026-11-18T12:21:55.522Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1968-source-20261118
commit: 11940e5643a68aeb6cc32617756af629e4c0ee9d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at replacement target11940e564; no findings. Ordered membership guard skips identical writes; absent empty directory set stays absent, while all-settled legacy dirs now publish durable empty index to end fallback. First append preserves discovered legacy ids; existing serialization/run-root boundary retained. New regression forbids history enumeration after empty migration; original durable/no-write controls and lifecycle ordering assertions remain. Prior262bb3f8e missing-index edge was confirmed/fixed before verdict under replacement request, not recorded as stale failure. Writer/reader inventory and docs inspected. Earlier targeted macOS receipts A-21220/A-21217 remain earlier-head evidence; correction index11/11 reported, final checks/C2 retake pending at request. C1/C2 run-dependent marks deferred to corrected-head/configured receipts; no reviewer tests or configured/Linux/browser/T3/T4/Web pass claimed.

### impl-1968 · 2026-11-18T12:29:59.114Z

Corrected head 11940e5643a68aeb6cc32617756af629e4c0ee9d: full lint/typecheck green; 95 reachable T1 files 994/994. Review clear rev-39-1968-source-20261118. C2 retake incomplete after 6 green files: attempt 7 CLAND_ADMISSION_TIMEOUT (project hub busy, not a test result), first two cases timed out after 5000ms; summary 0 pass, 7 fail, 2 cancelled. A-21230 retains every attempt and recovery notes. Earlier 262bb3f8e C2 20/20 remains historical A-21217. Awaiting native-slot grant to retake C2 after tracker-storage-fatal/reconnect; no configured verify submitted. Worktree clean.

### impl-1968 · 2026-11-18T12:31:40.378Z

C2 completed at reviewed head 11940e564 after hub recovery: unchanged gateway-state.test.ts 20/20 whole files, 180 passed, no failures/skips/cancels, local darwin arm64 Node 24.21.0, unloaded serial each start under load 20. Queue precheck exit 0 within 0.2 s. Same-head partial six-green/admission-timeout round retained as non-result A-21230; previous-head 20/20 historical A-21217. Corrected-head lint/typecheck and 95 reachable T1 files 994/994 pass. Native slot released; verify window requested, no configured run submitted yet.

### impl-1968 · 2026-11-18T12:55:56.463Z

Configured verify ac6120c2-a747-4eab-911d-c8df7b444bde passed at reviewed 11940e564 (A-21249): T0/T1/T2/Web exit 0; 6787/6787 tests, no skips/cancels. Linux x64 droplet c-8 ams3 Node24.21.0, Chrome Headless Shell156.0.8078.4; lifetime1225s cost$0.0850. New four index regressions each have recorded load-gate5/5 pass. Budget and test-lint advisories report-only. T3 deferred to batch, T4 unexecuted. Corrected-head C2 macOS20/20 A-21234; incomplete prior round A-21230 retained. Final Reviewer settlement pending; no source changes, no new run.

### rev-39 · 2026-11-18T12:56:21.959Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1968-final-20261118
commit: 11940e5643a68aeb6cc32617756af629e4c0ee9d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at11940e564; no findings. Durableac6120c2-a747-4eab-911d-c8df7b444bde finished/passed; A-21249 pins reviewed head/runtime treea5ef156d801aebae2aba2f93301765369f58f84c,no cache. Independently checked lease-index11, droplet-component27, prepare-component24 and gateway-state9 base passes+four file completions; four new regression identities each5/5. C1 filesystem durability/no-write controls pass, including empty legacy checkpoint. C2 independently read A-21234 corrected-head macOS20 whole-file exits0, each9passes/0fail/cancel/skip; source inventory lists both index writers and migration reader dispositions. Earlier partial/admission-timeout/old-head rounds retained, excluded. Host T0 and Linux x64 droplet Node24.21.0 T1/allT2/Web passed; HeadlessShell1248 Chrome156.0.8078.4; T3/T4 unexecuted, budget/lint reports report-only. Source A-21221 stands; reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T14:16:51.027Z

Merged 4bd320895f3d143fc83295728666be8290cdc4c8 onto dev.
