---
id: T-793
kind: task
title: The MCP verify tool publishes a generic object schema and refuses a missing field with only "invalid verify request"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-612
branch: t/T-793-the-mcp-verify-tool-publishes-a-generic
created: 2026-10-18T09:29:02.859Z
updated: 2026-10-19T15:56:11.242Z
---

## Summary

On 2026-10-18 impl-634 called the cland MCP `verify` tool with `{executor, report, to}` and got `{ok:false, error:"invalid verify request"}`. dispatch.ts `startSuite` requires a full `suite.start` client request (an absolute `cwd`, among others), but the tool's published schema is a generic key/value object, so an agent cannot discover the shape. impl-642's call with `cwd` set succeeded.

## Acceptance criteria

- [x] C1. The MCP `verify` tool publishes its real input schema (cwd, mode, executor, report, to, occasion, dryRun, workers, size, fresh) with descriptions. `cwd` defaults to the caller's claimed item worktree when omitted.
  - done: impl-793 · 2026-10-19T15:55:44.862Z
  - verified: rev-30 [reviewer] · run rev-20261019-793-final · 2026-10-19T15:56:10.114Z · commit 8f2ed8d44b6d03629f2a234f296af0c3048c4644
- [x] C2. A malformed request is refused with the names of the missing or invalid fields, not a generic message. A T2 test covers both.
  - done: impl-793 · 2026-10-19T15:55:45.491Z
  - verified: rev-30 [reviewer] · run rev-20261019-793-final · 2026-10-19T15:56:10.114Z · commit 8f2ed8d44b6d03629f2a234f296af0c3048c4644

## Comments

### impl-793 · 2026-10-19T15:28:52.594Z

Implementing the public MCP verify schema, claimed-worktree cwd default and field-specific validation. T2 coverage will exercise the published MCP tool and in-process hub dispatcher before any suite is enqueued.

### impl-793 · 2026-10-19T15:32:20.678Z

Source ready at 8f2ed8d44b6d03629f2a234f296af0c3048c4644; review requested. C2 T2 names in hub/test/verify-tool.test.ts: “MCP verify publishes described inputs with an optional claimed-worktree cwd”; “MCP verify defaults cwd to the claimed item worktree before admission”; “MCP verify names missing or invalid fields before enqueue”. All pass; typecheck and adjacent targeted tests pass. Evidence A-6156 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6156-t-793-implementation-and-pre-enqueue-evidence.md.

### rev-30 · 2026-10-19T15:33:18.946Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-793-source
commit: 8f2ed8d44b6d03629f2a234f296af0c3048c4644
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6159, no findings. Described MCP schema matches admission; undefined cwd derives from caller's live open-task claim, explicit cwd retained. Shared suiteStartIssues names malformed fields and cross-field diagnostics requirement; null mode no longer silently defaults. Existing authorization/occasion/report behavior retained. T2 public-tool tests inspect schema, prove claimed-worktree/default versus override and malformed-field errors with empty queues; injected candidate Git/FakeClock, no executor/native child/wait. A-6156 reports all four touched host files and checks green. C1/C2 complete verification awaits exact-head mode-free receipt; no Reviewer execution.

### rev-30 · 2026-10-19T15:56:10.114Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-793-final
commit: 8f2ed8d44b6d03629f2a234f296af0c3048c4644
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6182 audits full A-6181 / d5581c21 at unchanged reviewed head. Ordinary 1561/1561 zero fail/cancel/skip/TODO; all 481 groups 5/5. All three owned public MCP schema/default/override/malformed-field tests pass ordinarily and each 5/5, no owned tier trip. C1/C2 verified with A-6159 source audit. Four inherited T-856 push tripwire rows retained under T-877; existing report-only debt remains. T3 remains landing evidence; no Reviewer execution.

Criteria: C1 verified, C2 verified.
