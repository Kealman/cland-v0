---
id: T-788
kind: task
title: verify admission runs T-684's test-lint policy before replying and overruns the CLI's 15 s deadline
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-684
topic: topic-487
branch: t/T-788-verify-admission-runs-t-684-s-test-lint
created: 2026-10-18T09:09:07.078Z
updated: 2026-10-18T11:08:00.950Z
closed: 2026-10-18T11:08:00.950Z
---

## Summary

Since the 08:58Z hub restart (pid 18334) put T-684's admission lint live, both mode-free droplet submissions in a row timed out client-side at 15 s: T-709 at 08:59:32Z (run b633487b) and T-787 at about 09:04Z (run 0e2e6544). The hub accepted both. `suite.start` awaits `testLintPolicy` in `hub/src/hub/suite-candidate.ts` before it replies, and that spawns one `git show` per manifest file, about 10 s of `npm run test:lint` work on a quiet Mac. T-770's "sent, unconfirmed" exit 75 keeps this from causing duplicates, but every submission now looks failed, and `--dry-run` throws on the same timeout.

## Acceptance criteria

- [x] C1. A T2 test measures `suite.start` admission against a manifest the size of the repository's and shows the reply arriving inside the CLI deadline with margin. It fails before the fix.
  - done: impl-788 · 2026-10-18T10:45:33.938Z
  - verified: rev-30 [reviewer] · run rev-20261018-788-final · 2026-10-18T10:45:53.849Z · commit 7846a50038c57174832897b0865e37f0a19b2443
- [x] C2. The lint verdict still refuses a violating head before any queue slot or droplet is reserved, and the refusal still reaches the submitter with the same findings.
  - done: impl-788 · 2026-10-18T10:45:34.631Z
  - verified: rev-30 [reviewer] · run rev-20261018-788-final · 2026-10-18T10:45:53.849Z · commit 7846a50038c57174832897b0865e37f0a19b2443
- [x] C3. `cland verify --dry-run` on this repository answers within the deadline.
  - verified: rev-30 [reviewer] · run rev-20261018-788-source · 2026-10-18T09:36:21.456Z · commit c2a82d44a9f4ca870a1813d98eba6eaceaa38922
  - verified: rev-30 [reviewer] · run rev-20261018-788-warmer-correction · 2026-10-18T10:20:27.492Z · commit 7846a50038c57174832897b0865e37f0a19b2443
  - done: impl-788 · 2026-10-18T10:45:35.440Z

## Comments

### impl-788 · 2026-10-18T09:10:16.545Z

Initial git fetch origin, npm run test:lint and npm run typecheck passed. C1 first at specified T2 suite.start seam using projectHub, repository-sized manifest and deterministic Git call cost; retain C2 pre-reservation refusal.

### impl-788 · 2026-10-18T09:29:11.985Z

Implementation committed/pushed at c2a82d44 after merging origin/dev. Batched Git blob reads, bounded digest-keyed compact direct facts and startup/dev-move background warming; pre-reservation refusals unchanged. Default dry-run keeps admission/direct census, moves report-only graph behind --diagnostics with120s deadline (normal15s). C3 3/3 committed-head real-repo CLI/socket dry-runs:3.972s/3.662s/3.692s. Evidence A-5102(red), A-5103(profile), A-5124(receipts), A-5125(runner), source-review evidence artifact. Lint/typecheck and targeted files pass. Preparing review; no full verify submitted yet.

### rev-30 · 2026-10-18T09:36:21.456Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-788-source
commit: c2a82d44a9f4ca870a1813d98eba6eaceaa38922
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear,A-5144. Immutable Git blob batching validates byte boundaries/OIDs; bounded path/tier/digest cache returns cloned compact direct facts, not verdicts/ASTs. Disk rereads and existing baseline/refusal comparisons retained. Best-effort dev warmer yields/coalesces and shutdown awaits it; diagnostics only omits report-only graph by default with separate opt-in deadline. Repository-sized socket controls cover margin/foreground responsiveness and identical dry/real committed/disk refusals before reservation. C3 real-repo committed-head CLI/socket receipts A-5124/A-5125 verified at3.66–3.97s (warm isolated production hub). C1/C2 pending exact-head full droplet; no reviewer execution.

Criteria: C3 verified.

### impl-788 · 2026-10-18T09:38:20.024Z

Source review clear: rev-20261018-788-source / A-5144, no findings. Required mode-free droplet verify accepted as 5b4f379b-b58b-48c0-84a3-0576e278f0ce at exact reviewed head c2a82d44, mode full. CLI exited 75; waited 60 s and confirmed queue plus task receipt, without retry. First remote waiter behind 10 occupied slots. Waiting for hub result; no source changes.

### rev-30 · 2026-10-18T10:15:55.915Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-788-runtime
commit: c2a82d44a9f4ca870a1813d98eba6eaceaa38922
scope: evidence
findings: [{"severity":"medium","text":"M1: startup TestLintWarmer always calls its native treeSnapshot Git path, bypassing injected fake options.git/probes. Exact-head project-probes case and whole-file census fail with2execFile children;30 new report-only T2 trips span9files. Inject the warm/snapshot boundary for component fixtures while retaining production defaults and zero-child assertions.","file":"hub/src/hub/daemon.ts","line":159}]
finding_counts: {"high":0,"medium":1,"low":0}

A-5192: exact-head A-5189 fails project-probes per-case and whole-file zero-child assertions, each finding2execFile calls. New TestLintWarmer native treeSnapshot bypasses injected Git/probes; 30 related T2 mismatch rows across9files. Preserve production warming and component census; inject the external snapshot/warm boundary, audit fixture readers and request fresh source review. Admission-cost case itself passes2.578612141s and5/5 repetitions; lint/admission carriers pass. Final gate not accepted, C1/C2 pending.

### impl-788 · 2026-10-18T10:18:49.701Z

Addressed runtime M1 at pushed head 7846a500, no dev merge: inject warmer boundary; production defaults unchanged, projectHub fake probes no-op, admission-cost explicitly real warmer/fake Git. Existing project-probes red→green with unchanged zero-child assertions. All 9 formerly tripping files plus fake-harness and admission-cost pass T2 enforce, zero tripwire bytes; lint/typecheck pass. C3 refreshed 3/3 at 2.880/2.546/2.533 s. Fresh source review requested before replacement full droplet gate.

### rev-30 · 2026-10-18T10:20:27.492Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-788-warmer-correction
commit: 7846a50038c57174832897b0865e37f0a19b2443
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5201: M1 source correction clear. Injected request/close warmer keeps production defaults/lifecycle intact; fake projectHub probes no longer start native warming. Explicit real-warmer cost fixture retains the fake-Git-backed production proof. A-5198 records unchanged project-probes red/green and all nine former trip carriers clean under enforcement. A-5197 refreshes measured repo CLI/socket dry-runs 3/3 under3s; C3 verified. C1/C2/final readiness pending replacement exact-head full gate. No findings.

Criteria: C3 verified.

### impl-788 · 2026-10-18T10:22:42.041Z

M1 source correction clear: rev-20261018-788-warmer-correction / A-5201. Replacement required full mode-free droplet verify accepted as e415a0fe-cf64-4325-bdde-4ca72ea455a0 at exact reviewed head 7846a500. CLI exited 75; waited 60 s and confirmed launching task receipt and remote acquiring state, without retry. Awaiting hub result with unchanged branch.

### impl-788 · 2026-10-18T10:44:49.407Z

Replacement exact-head full droplet verification e415a0fe is green at 7846a500: A-5216, Linux x64/Node 24.21.0/Neovim 0.12.5, 2,540 passed, 0 failed, 8 skipped. Hub free, hub machine and Neovim all completed. Droplet lifetime 1,351 s, cost $0.0938. Awaiting Reviewer's final same-head evidence verdict; branch unchanged.

### rev-30 · 2026-10-18T10:45:53.849Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-788-final
commit: 7846a50038c57174832897b0865e37f0a19b2443
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5219: exact-head A-5216 passes full hub/Neovim, 2540 pass/0 fail/8 prerequisite skips. Owned admission carrier and nested deadline/warming/diagnostics/refusal controls pass plus5/5 repetitions. Former project-probes census failures resolved; zero warmer trip rows, no owned trips or hard budgets. C1/C2 verified; C3 exact-head dry-run proof remains current. Claimant done marks restored. No findings.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-18T11:08:00.950Z

Merged cae51b5c004898a957233c535c84401f65e3d9c7 onto dev.
