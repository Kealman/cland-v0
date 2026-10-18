---
id: T-788
kind: task
title: verify admission runs T-684's test-lint policy before replying and overruns the CLI's 15 s deadline
state: open
status: review
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
updated: 2026-10-18T09:36:21.456Z
---

## Summary

Since the 08:58Z hub restart (pid 18334) put T-684's admission lint live, both mode-free droplet submissions in a row timed out client-side at 15 s: T-709 at 08:59:32Z (run b633487b) and T-787 at about 09:04Z (run 0e2e6544). The hub accepted both. `suite.start` awaits `testLintPolicy` in `hub/src/hub/suite-candidate.ts` before it replies, and that spawns one `git show` per manifest file, about 10 s of `npm run test:lint` work on a quiet Mac. T-770's "sent, unconfirmed" exit 75 keeps this from causing duplicates, but every submission now looks failed, and `--dry-run` throws on the same timeout.

## Acceptance criteria

- [ ] C1. A T2 test measures `suite.start` admission against a manifest the size of the repository's and shows the reply arriving inside the CLI deadline with margin. It fails before the fix.
- [ ] C2. The lint verdict still refuses a violating head before any queue slot or droplet is reserved, and the refusal still reaches the submitter with the same findings.
- [ ] C3. `cland verify --dry-run` on this repository answers within the deadline.
  - verified: rev-30 [reviewer] · run rev-20261018-788-source · 2026-10-18T09:36:21.456Z · commit c2a82d44a9f4ca870a1813d98eba6eaceaa38922

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
