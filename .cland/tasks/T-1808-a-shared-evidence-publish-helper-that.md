---
id: T-1808
kind: task
title: A shared evidence-publish helper that calls artifact.create only after a clean secret scan with a positive control
state: open
status: in progress
size: M
criterion_seq: 3
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1625
branch: t/T-1808-a-shared-evidence-publish-helper-that
created: 2026-11-11T00:11:39.952Z
updated: 2026-11-18T11:27:42.659Z
---

## Summary

Three times on 2026-11-10, an implementer's ad-hoc export script published evidence after its secret scan had exited 1: A-18360 (impl-1778), A-18454 (impl-1780) and A-18526 (impl-1788). Each was archived, and each match turned out to be a false positive (a test title, a test path, a tracked filename). But a gate that depends on each session's own orchestration fails repeatedly. A shared helper should own the scan and the publication together, so a non-zero scan, a missing exit code or a missing positive control can never reach `artifact.create`.

## Context

- Rule-batch proposal P-coord-publishgate.
- Rule 15 requires that nothing is published until a secret scan finds no matches.
- False positives are redacted in the export (an id plus a hash). The scanner itself changes only through its own reviewed item.

## Acceptance criteria

- [x] C1. One shared helper (CLI or library) scans every file of an evidence folder or file with the repo's scanner and a planted positive control, and publishes only when the scan exits 0 with the positive control matched (test).
  - done: impl-1808 · 2026-11-18T11:27:37.809Z
- [x] C2. A non-zero exit, a missing exit code, a missing or unmatched positive control, or a scan of the wrong path refuses publication and prints the file and position of each match without the matched value (test).
  - done: impl-1808 · 2026-11-18T11:27:39.677Z
- [x] C3. The implement skill and the QA kit point to the helper for evidence publication (test: docs reference check).
  - done: impl-1808 · 2026-11-18T11:27:41.516Z

## Comments

### impl-1808 · 2026-11-18T11:18:48.845Z

Consumer search: assertPublishable / qa-demo-policy referenced by .agents/skills/qa/qa-demo-record.ts (pre-copy remote capture scan), hub/test/qa-demo-policy.test.ts (T1 policy), docs/agents/qa-demo-recording.md, QA skill and its per-file guide. No scanner CLI found. New shared library will reuse the scanner unchanged; raw artifact.create wire consumers remain compatible. Evidence authoring references: implement SKILL, QA SKILL/BRIEF, hub README, docs/agents. Awaiting Coordinator confirmation of scanner/location seam.

### impl-1808 · 2026-11-18T11:20:22.075Z

Scanner comparison: capture-safety additionally catches any standalone Bearer word, generic token/API-key assignments, /Users/ and /home/ paths; qa-demo-policy additionally catches provider formats, private-key headers and decoded URL/JSON spellings. Helper runs both, without changing either. Consumers also include native login-card/signin/resignin diagnostic tests and QA briefs E-1533/E-1535/E-1537/E-1538 (existing capture checks unchanged). First red on macOS Node 24.21.0: ERR_MODULE_NOT_FOUND for evidence-publish.ts; first green: nested-folder byte-copy test, fake artifact callback, no network/process. No full-suite evidence yet.

### impl-1808 · 2026-11-18T11:27:42.659Z

Implementation head f3110b5aa pushed to origin; clean worktree. Local macOS arm64 Node 24.21.0: full npm run test:lint exit 0 (130 report-only findings, 0 refusals), root npm run typecheck exit 0, final evidence-publish T2 file 11/11; earlier existing scanner policy/site consumer T1 25/25. No full-suite/browser/executor evidence. A-21186 is a durable progress artifact published by helper itself. Waiting for required T-1894 landing, then merge current origin/dev and rerun pre-review lints/typecheck before source review. Coordinator notified to deliver landing event; no polling or verify submission.
