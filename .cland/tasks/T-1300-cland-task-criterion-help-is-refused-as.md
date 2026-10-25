---
id: T-1300
kind: task
title: cland task criterion --help is refused as an unknown option instead of printing its usage
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
topic: topic-1050
branch: t/T-1300-cland-task-criterion-help-is-refused-as
created: 2026-10-25T11:31:06.724Z
updated: 2026-10-25T12:18:18.734Z
closed: 2026-10-25T12:18:18.734Z
---

## Summary

`cland task criterion --help` exits 2 with "Unknown option '--help'" and prints the whole task usage, while docs/agents/issue-tracker.md says every command and group answers an immediate `--help`. Found aside by impl-1041 during T-1041 (2026-10-25), read-only.

## Acceptance criteria

- [x] C1. `cland task criterion --help` (and every `task` subcommand) prints that subcommand's usage and exits 0, matching the documented contract; a test covers each `task` subcommand.
  - done: impl-1300 · 2026-10-25T11:58:50.381Z
  - verified: rev-26 [reviewer] · run rev-20261025-1300-evidence-1 · 2026-10-25T12:12:26.670Z · commit 316c03c8090ff528ecb26d720c4bfd61c61b6500

## Comments

### impl-1300 · 2026-10-25T11:56:34.625Z

Clean inherited tree. Proposed/brief-authorized seams: existing T1 commandHelp pure entry table covers every advertised task subcommand and both immediate flags; T2 sealed executable regression for task criterion proves exit 0/stdout/empty stderr without a hub or writes. CLI help-only repair, no shared reply/schema/admission contract changes. A-11669 predates this found-aside item; current defect is help.ts commandHelp's one-argument restriction, followed by task.ts strict parser.

### rev-26 · 2026-10-25T12:00:23.614Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1300-source-1
commit: 316c03c8090ff528ecb26d720c4bfd61c61b6500
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full in-session Standards/Spec source CLEAR, A-11870. Complete nine-file diff from b7953817 inspected, no findings. Static commandHelp intercepts exactly known task subcommand + immediate help before imports/discovery, preserves all repeated forms/common options; ordinary/unknown/non-immediate paths retain parser/authority behavior. T1 inventory and both-flag tables cover all14 commands; one additional bounded sealed T2 real CLI subject proves criterion forms/exit/empty stderr/immutability; original three/frozen bytes retained. Existing tier/guides/index and skill CHANGES consistent. A-11868 is local summary with raw/source capture limits, not configured proof; preserve original available outputs without transcription reruns. C1 final runtime marks pending one ordinary mode-free exact-head receipt and evidence review. No tests/probes/delegation/QA/landing claim by Reviewer.

### rev-26 · 2026-10-25T12:12:26.670Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1300-evidence-1
commit: 316c03c8090ff528ecb26d720c4bfd61c61b6500
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence CLEAR, A-11887; carry full source-1/A-11870. Original A-11886 independently parsed: 3180 ordinary test passes / 440 files, separately 85 load test passes across 17 identities, exactly five each. All 14 task subcommands/both flags, inventory and parser fallthrough pass; real criterion CLI passes base 0.115888308 s and five recorded repetitions, retaining all forms, zero exit, empty stderr and sealed immutability assertions. Original frozen top-level/hub/session checks pass. T0/all T1/fallback all T2/Web green on Linux x64 droplet; T3/T4 absent. Host prepared-tree attribution and report-only lint/timing warnings retained; no budget/QA/landing claim. C1 verified, zero findings on both axes. Coordinator owns affected after-stage QA and enqueue/merge.

Criteria: C1 verified.

### coord · 2026-10-25T12:18:18.734Z

Merged 3e208223a008b6009ad1cd9982ec6e8376186284 onto dev.
