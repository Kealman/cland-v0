---
id: T-1677
kind: task
title: hub-lifecycle test expects a literal hub.sock path and fails when TMPDIR is longer
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - qa-found
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1570
branch: t/T-1677-hub-lifecycle-test-expects-a-literal-hub
created: 2026-11-04T14:47:20.577Z
updated: 2026-11-16T22:26:45.252Z
---

## Summary

During E-1532 stage-4 QA (qa-678, A-16582), running `hub/test/hub-lifecycle.test.ts` with a TMPDIR 9 bytes longer than the original 61-byte one failed an assertion that expects a literal `hub.sock`. The hub legitimately used its fallback socket path because the full path exceeded the Unix socket limit. It reproduces on the stage-3 and stage-4 heads alike, and passes at the original length.

## What to build

The test reads the actual socket path the hub publishes (discovery file or status) instead of assuming `hub.sock`, and covers the fallback-path case explicitly.

## Acceptance criteria

- [x] C1. hub-lifecycle passes with a TMPDIR long enough to force the fallback socket path (test).
  - done: impl-1677 · 2026-11-16T22:17:16.539Z
- [x] C2. A case asserts the hub publishes and uses the fallback path when the primary would exceed the limit (test).
  - verified: rev-38 [reviewer] · run rev-38-1677-source-2 · 2026-11-16T22:26:37.228Z · commit 06a3569e8240e0e00d32af3008dafd5fcdea3336
  - done: impl-1677 · 2026-11-16T22:26:45.252Z

## Comments

### impl-1677 · 2026-11-16T22:16:27.585Z

Reproduced on current dev using isolated long TMPDIR: skeleton test expected /private/tmp/.../.cland/hub.sock but actual discovery.socket was /tmp/cland-6f4c19d736653787.sock (ERR_ASSERTION at scenarios/hub-lifecycle.test.ts:21). Fix reads discovery.socket and adds an authenticated fallback-socket regression with over-limit project and child TMPDIR paths. No production contract changes.

### impl-1677 · 2026-11-16T22:18:06.709Z

Pushed source head 671544c2cc1364e1fea03f50bb66b39fae4e3f81; review requested from reviewer role. Local Darwin Node 24.21.0: full changed T3 file under >100-byte TMPDIR passed 7/7, hub typecheck passed, npm run test:lint exit 0 (test lint/advisories report-only; closed-item wording 0 findings). Evidence A-20404. Full task verify and Linux evidence not yet run; waiting for source verdict, then Coordinator verify window.

### rev-35 · 2026-11-16T22:21:05.128Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1677-source-1
commit: 671544c2cc1364e1fea03f50bb66b39fae4e3f81
scope: full
findings: [{"severity":"medium","text":"New fallback callback lacks whole-work ownership before tempProject acquisition. Existing root/daemon registrations and the post-connect finally do not fence/join pending launch/FS/client continuations or adopt late resources before disposal; claimant confirmed no earlier owner. Compose shared admitted-work ownership before acquisition and retain an owned held-work cancellation control (rule12).","file":"hub/test/scenarios/hub-lifecycle.test.ts","line":41},{"severity":"medium","text":"connectSocket setup has no named deadline; the frame next() bound starts only after connection returns. Bound setup separately and close/join pending or late socket work when the bound loses, rather than abandoning a raced promise (rule9).","file":"hub/test/scenarios/hub-lifecycle.test.ts","line":53}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear A-20411. Functional target otherwise matches spec: skeleton keeps actual discovery socket/isSocket oracle, explicit long root/TMPDIR forces production /tmp fallback, and authenticated welcome is asserted through a pre-installed frame buffer. Both findings concern only the new test's failure paths; unchanged older scenarios are not reopened. A-20404 nominal Darwin7/7 and latest positive typecheck/lint summaries retained, not cancellation/Linux/configured proof. Preserve available original producer excerpts/source linkage and unknown raw/signal limits without provenance-only rerun. C2failed; C1unverified. Hold released for one consolidated correction using existing shared ownership, exact fallback/welcome assertions preserved, then fresh committed-head source review before any configured verify/window. No Reviewer runtime.

Criteria: C2 failed (The new fallback regression lacks pre-acquisition whole-work ownership and a bounded owned connection setup.).

### impl-1677 · 2026-11-16T22:24:36.931Z

Correction head 06a3569e8240e0e00d32af3008dafd5fcdea3336 addresses A-20411 with shared whole-work owner, pre-connect native socket ownership, separate bounded setup/welcome, deterministic late-client cancellation control. A-20413. Local Darwin Node 24.21: changed file 8/8; long-TMPDIR selection 3/3; hub typecheck and whole-source test:lint exit 0 (report-only findings unchanged, closed-item wording 0). Fresh review queued automatically; verification not submitted.

### rev-38 · 2026-11-16T22:26:37.229Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1677-source-2
commit: 06a3569e8240e0e00d32af3008dafd5fcdea3336
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review of T-1677 at 06a3569e8240e0e00d32af3008dafd5fcdea3336 (origin task tip confirmed); full diff e824406ae...06a3569e, two task commits, one changed file.

Standards: no findings. Reviewed source against role rules 9/12/15/17/20 and docs/agents/tests.md. Whole-work ownership precedes acquisition; shared fixtureWork captures late resources and joins before removal. Socket close receipt is installed before connect, setup and welcome have separate bounded observers armed before their actions. Cancellation control retains root while acquisition drains, joins socket closure and disposal, asserts fenced continuation and final ENOENT. New daemon has a T3 process-lifecycle purpose and process-count header is updated. Environment flows through startDaemon -> runCland -> accountFixtureEnvironment -> fixtureEnvironment after overlays, with scratch HOME/XDG/Git config and credential/GIT filtering. No new launcher, production contract, config, command or policy change; rule20 migration inventory is not applicable.

Spec: no findings. Skeleton now stats the published discovery.socket. Explicit long root and child TMPDIR exceed SOCKET_PATH_MAX; case asserts primary ENOENT, /tmp fallback within limit, socket inode and authenticated welcome through published path.

C2 established by source. C1 is runtime-dependent and remains unverified pending same-head configured evidence. Previous A-20411 findings resolved. Source clear is not final suite clearance.

No Reviewer tests executed; read-only source review only, no browser. A-20413 reports claimant direct Darwin Node24.21 full-file8/8 and long-TMPDIR selection3/3, no configured verify/Linux proof; raw producer captures unavailable in artifact. Later claimant comment reports typecheck/lint exit0; those claims were not rerun here. No timings or coverage inferred from them.
Artifact A-20418: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20418-t-1677-source-review-clear-at-06a3569e8.md

Criteria: C2 verified.
