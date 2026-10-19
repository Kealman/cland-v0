---
id: T-869
kind: task
title: suite-command diagnostics still say 'npm' for any stack's commands
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-608
branch: t/T-869-suite-command-diagnostics-still-say-npm
created: 2026-10-19T11:52:12.288Z
updated: 2026-10-19T19:19:29.299Z
closed: 2026-10-19T19:19:29.299Z
---

## Summary

hub/src/suite-command.ts still labels generic shell-command failures as "npm terminated by …" and inherited-pipe cleanup as "npm pid …". Since T-666, any stack's commands run through it, so these diagnostics can misname a Python or other command.

Found aside by impl-666 on 2026-10-19.

## Acceptance criteria

- [x] C1. Both diagnostics name the command actually run (or a stack-neutral word), and a test with a non-npm command asserts the wording.
  - done: impl-869 · 2026-10-19T15:54:31.607Z
  - verified: rev-30 [reviewer] · run rev-20261019-869-final · 2026-10-19T15:55:22.821Z · commit 13f762a600cf8bd7f69621d43f904b8e40913a17

## Comments

### impl-869 · 2026-10-19T15:28:43.972Z

Implementation plan: replace the two npm-specific diagnostics with 'command'; assert signal and inherited-pipe cleanup wording using a non-npm command, without changing execution or cleanup behavior. C1 is checkable before enqueue. QA policy scope is none.

### rev-30 · 2026-10-19T15:31:48.341Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-869-source
commit: 13f762a600cf8bd7f69621d43f904b8e40913a17
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6155. Both npm-specific literals replaced with stack-neutral command wording, with no lifecycle/control-flow change. Fake-child test drives actual suiteCommand('python -m pytest'), asserts exact shell argv and returned SIGTERM cause; no real process or elapsed-time wait, mocked timers/exports restored. T2 conservative child_process classification documented. Reported focused test .157 s/1 pass and host checks green. C1's source/test design established; final verification awaits same-head mode-free receipt. T-881 unrelated and unchanged. No Reviewer execution.

### impl-869 · 2026-10-19T15:54:32.130Z

C1 implemented and marked done. Same-head mode-free verification fc62cec4-0e68-4af3-bad8-e1182ee4dbda passed at 13f762a600cf8bd7f69621d43f904b8e40913a17: 1559/1559 tests on Linux droplet; T3 deferred to merge batch per queue protocol. Log A-6178 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6178-suite-fc62cec4-0e68-4af3-bad8-e1182ee4dbda-auto-at-13f762a.log. Source review rev-20261019-869-source clear; awaiting Reviewer final evidence verdict. Branch unchanged and working tree clean.

### rev-30 · 2026-10-19T15:55:22.821Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-869-final
commit: 13f762a600cf8bd7f69621d43f904b8e40913a17
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6180 audits full A-6178 / fc62cec4 at unchanged reviewed head. Ordinary 1559/1559 zero fail/cancel/skip/TODO, all 479 groups 5/5. New non-npm signal test passes ordinarily .007037273 s and all five repetitions, exact argv/cause retained. C1 verified with A-6155's two stack-neutral string audit. Four inherited T-856 push tripwire rows retained under T-877; none from suite-command. Existing report-only debt/T-881 unchanged. T3 remains landing evidence; no Reviewer execution.

Criteria: C1 verified.

### coord · 2026-10-19T19:19:29.299Z

Merged ebc5f829b5910c4ac125459d58fe8931ae3a98d4 onto dev.
