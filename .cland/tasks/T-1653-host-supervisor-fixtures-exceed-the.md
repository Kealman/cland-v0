---
id: T-1653
kind: task
title: host-supervisor fixtures exceed the macOS 104-byte Unix socket path limit under the suite's temp root
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1594
topic: topic-1359
branch: t/T-1653-host-supervisor-fixtures-exceed-the
created: 2026-11-03T04:59:56.359Z
updated: 2026-11-03T05:30:46.509Z
---

## Summary

The E-1536 stage-4 macOS cover 94521ff5 (A-16171, dev bf486cb6) failed two tests in `hub/test/host-supervisor.test.ts` on every repetition (0/5): "supervisor C1-C4: singleton, detached lifetime, HUP, kill-agent restart and retained harness identity" and "kill-agent refuses another live fake host receipt and preserves both agents and harnesses". The output is `cland: connect EINVAL /private/tmp/cland-suite-80f39b05-b212-4aee-a22d-73ea7008dad2/hs-IkJDyQ/one/home/.cland-host/run/agent.sock`, a 107-byte path; macOS limits `sun_path` to 104 bytes. The Linux batch and droplet verifies passed because Linux allows 108, and local runs used a shorter TMPDIR.

## What to build

Build the fixture's fake-host HOME, and so `.cland-host/run/*.sock`, under a short root through the existing shared short-socket fixture helper (see `hub/test/fixture-socket-path.test.ts`), so every socket path stays within 104 bytes under the suite's longest temp root, `/private/tmp/cland-suite-<uuid>/`. Search the other host fixtures (fake-host, host-agent, transport tests) for the same pattern and fix each one, or record why it is unaffected.

## Acceptance criteria

- [x] C1. Both named host-supervisor tests pass five load-gate repetitions on macOS with TMPDIR set to a `/private/tmp/cland-suite-<36-char uuid>` root (test).
  - done: impl-1653 · 2026-11-03T05:05:41.910Z
  - verified: rev-35 [reviewer] · run rev-35-1653-final-1 · 2026-11-03T05:30:46.388Z · commit 9034e779f36995d9b81af7825f05628637ffb143
- [x] C2. A guard fails a fake-host fixture whose socket path would exceed 104 bytes, naming the path, before any connect (test).
  - done: impl-1653 · 2026-11-03T05:05:42.124Z
  - verified: rev-35 [reviewer] · run rev-35-1653-final-1 · 2026-11-03T05:30:46.388Z · commit 9034e779f36995d9b81af7825f05628637ffb143

## Comments

### impl-1653 · 2026-11-03T05:03:46.726Z

Fixture audit: createFakeHost consumers are host-supervisor.test.ts and fake-ssh.test.ts, plus fake-host CLI; fake-ssh-common authenticates through fakeHost and fake-scp/fake-ssh use hostPath. They share the deep HOME/run pattern and will move together to the shared socket alias. host-agent.test.ts uses runDir=root (longest agent-admission prefix: 99 bytes including NUL under UUID TMPDIR); host-agent-files uses root/run (98 bytes including NUL). Those fit 104 and remain unchanged. transport-config/transport-kind/transport-records contain no native fixture listener paths. host-contract session.sock uses direct root, below the limit. No production path change planned.

### impl-1653 · 2026-11-03T05:04:32.605Z

Audit byte-count correction: with /private/tmp/cland-suite-<36 chars>, the longest direct host-agent socket (agent-admission-XXXXXX/agent.sock) and host-agent-files socket (agent-files-XXXXXX/run/agent.sock) are each 96 bytes including NUL. The original supervisor path is 107 bytes plus NUL (108). Both named identities reproduced 0/5 under that root before the fixture fix.

### rev-35 · 2026-11-03T05:06:52.965Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1653-source-1
commit: 9034e779f36995d9b81af7825f05628637ffb143
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards/Spec no findings. Shared reciprocal short alias keeps files under disposable root; new single guard checks UTF-8 bytes including NUL before setup/lookup/connect. Canonical containment precedes returning the lexical short HOME path. Existing supervisor/SSH lifecycle and foreign-owner assertions retained; alias removal follows native/client/server drainage, including failed-setup absence receipt. Helper tests cover oversized ASCII/UTF-8, exact boundary, setup refusal, independent lookup and escape. Consumer audit records direct host-agent paths unaffected. No production/shared helper edits. C1/C2 runtime-unverified pending independently read macOS repetition/source-linkage and same-head queued evidence; A-16175 green is pre-commit final fixture diff, not exact-commit execution. Reviewer ran no tests/probes/browser/checks/edits. Detail A-16176: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16176-t-1653-source-review-short-fake-host-socket-fixtures.md.

### rev-35 · 2026-11-03T05:30:46.388Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1653-final-1
commit: 9034e779f36995d9b81af7825f05628637ffb143
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified, no findings. A-16175 launcher/raw logs independently show both required macOS identities0/5 red with actual UUID-root EINVAL, then5/5 green under same long-TMPDIR setup; ordinary supervisor3 and fakeSSH9 also pass. Local macOSarm64 Node24.21/native exits reported red1/green0; explicitly pre-commit final fixture diff, not exact-commit execution. Saved five tracked patches match committed source; tracker-only base movement; newly added guard not in saved tracked patch, but source-reviewed and exact-head queued tests pass. A-16179/26e76e95 exit0 at reviewed head,4917 pass/zero fail/cancel/skip/todo. Independently checked helper4 including guard/setup, supervisor3 and fakeSSH9 ordinary outcomes. T0/T1/allT2/Web + changedT3 twofiles12 once completed; remainingT3 batch-deferred,T4 unexecuted. Uncached Linuxx64 c-8sfo2 Node24.21/Nvim0.12.5, runner tree71afaed19c1a8c868a722485fb41d9a34db48764, isolated HeadlessShell1248/Chrome156.0.8078.4. Budgets/lint/incomplete ratchet/skip checks report-only, skips[]/missing0. QA none, stage cover separate. Reviewer read only, no tests/probes/browser/edits. Detail A-16182: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16182-t-1653-final-evidence-macos-long-root-repetition-proof.md.

Criteria: C1 verified, C2 verified.
