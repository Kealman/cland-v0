---
id: T-1598
kind: task
title: Per-session forwards on the master
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1595
topic: topic-1363
branch: t/T-1598-per-session-forwards-on-the-master
created: 2026-11-02T03:33:54.978Z
updated: 2026-11-03T07:36:50.879Z
---

## Summary

The carrier adds a per-session forward on the live master with `-O forward -L`. It runs from a hub-side Unix socket to a host Unix socket (Codex) or to a host loopback port (OpenCode), is cancelled with `-O cancel`, and is re-added with a short retry after every reconnect.

Hot files: `hub/src/transport/ssh.ts`, `hub/test/transport-forwards.test.ts` (new)

## Acceptance criteria

- [x] C1. A forward to a host Unix socket and one to a host loopback port each give a hub-side Unix socket under the host's directory that reaches its target, and no hub-side TCP listener is created (test).
  - done: impl-1598 · 2026-11-03T07:26:28.856Z
- [ ] C2. Cancelling a session's forwards removes them from the master and their hub-side socket files (test).
  - failed: rev-35 [reviewer] · 2026-11-03T07:31:06.676Z · note Socket unlink failure loses cancellation cleanup ownership; later unforward reports success without retrying removal.
- [ ] C3. After a SIGKILLed master reconnects, every forward still recorded is back within the retry window, and one that keeps failing is logged once with its session and given up after the last retry (test).
  - failed: rev-35 [reviewer] · 2026-11-03T07:31:06.676Z · note Exhausted-restore unlink failure forgets the session and skips the required terminal session log.

## Notes

Shared files: `hub/src/transport/ssh.ts`

## Comments

### impl-1598 · 2026-11-03T07:21:52.203Z

Consumer inventory (field/function and importer search across hub/src, hub/test, shared, web, nvim, skills, docs and QA): SshTransport production has no constructors yet; existing transport-ssh.test.ts is its only constructor consumer. Transport status/registry/policy consumers remain unchanged. HostEndpoint forward/unforward consumers are local.ts, test-host.ts, host-contract.ts and launch-files.test.ts; no Host interface change. hostPaths.sessionSocket is consumed by host-records.test.ts; reused unchanged. fake-ssh.ts/common supports forward/cancel already; fake-ssh tests and transport-contract remain unedited. QA stage-2 constructor census and transport docs remain valid. Additive carrier methods prepare T-1599; no wire/persisted shape changes.

### impl-1598 · 2026-11-03T07:26:45.076Z

Implemented and pushed 0563dcda2ed53a4c33c0a860f690cb085ed02439; all criteria done; source review requested. A-16208 retains local named-case and static evidence, initial fixture/manifest errors and C3 red observation, with platform/coverage limits. Final long-TMPDIR forward2 and unchanged carrier6 pass; typecheck, tiers and lint exit0. Await clear source verdict before mode-free verify. QA affected/after-stage remains separate.

### rev-35 · 2026-11-03T07:31:06.676Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1598-source-1
commit: 0563dcda2ed53a4c33c0a860f690cb085ed02439
scope: full
findings: [{"severity":"medium","text":"unforward deletes its sole session entry before socket unlink. Non-ENOENT failure leaves no retry/stop cleanup owner; retry returns success without removal. Exhausted restore repeats delete-before-unlink at213–215 and skips terminal session log on error; initial failed install also lacks retained cleanup if unlink fails. Keep captured pending-cleanup/cancelled-or-retired state until positive removal, preventing reinstall/repeated cancellation, and add injected failure/retry/stop controls.","file":"hub/src/transport/ssh.ts","line":104},{"severity":"low","text":"No-TCP assertion scans only master control-socket owners. Positive TCP control remains open in the worker until teardown, which is never inspected after creation; a worker-side accidental listener would pass. Close/join the control after detection and include worker plus master in the negative census.","file":"hub/test/transport-forwards.test.ts","line":68}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source not clear:1medium/1low, source state-transition findings, no Reviewer reproduction. Cleanup ownership must survive unlink failure in cancellation/exhaustion/initial install; retain terminal phase to avoid reinstall or re-cancel on retry. Serial queue/master native joining otherwise reviewed; stable Transport unchanged. A-16208 local forwards2/carrier6/static evidence is supplemental; C3 red valid, C1 setup failure not baseline-red behavior. No queued verification yet. Fresh fixed-head source review before verify; affected after-stage QA separate. Detail A-16209: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16209-t-1598-source-review-retain-cleanup-ownership-after-forward-removal-failures.md.

Criteria: C2 failed (Socket unlink failure loses cancellation cleanup ownership; later unforward reports success without retrying removal.), C3 failed (Exhausted-restore unlink failure forgets the session and skips the required terminal session log.).

### impl-1598 · 2026-11-03T07:33:24.790Z

A-16209 correction in progress: private SessionForward cleanup phase retains removal ownership through filesystem failures. Additive SshOptions.unlinkSessionSocket fault seam is consumed only by transport-forwards.test.ts; existing transport-ssh.test.ts and production construction compatibility unchanged. No wire or persisted-shape changes. Wired red tests reproduced missing second cancellation/stop rejection and missing terminal restore log; correction tests now pass. No dev merge after first review.

### impl-1598 · 2026-11-03T07:36:45.357Z

Pushed corrected heada391280549dfcc277957fbb1896016b461aa1968 and requested fresh full source review for A-16209. A-16212 retains wired-red3 and corrected long-TMPDIR forwarding5, unchanged carrier6, final-head typecheck/lint exit0 (122 advisory findings, zero refusals). No dev merge, queued verification or QA claim; awaiting source verdict.
