---
id: T-1159
kind: task
title: hub/README.md approval section still says reconnects may re-key and relays are pending
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-414
blocked_by: []
topic: topic-886
branch: t/T-1159-hub-readme-md-approval-section-still
created: 2026-10-23T01:26:18.126Z
updated: 2026-10-23T02:24:02.824Z
closed: 2026-10-23T02:24:02.824Z
---

## Summary

E-414 stage-2 QA (qa-676, E414S2-19 at d32c6a8f) found two stale statements in hub/README.md's approval section: line ~847 says "reconnects may re-key a pending request", while the Codex and OpenCode native reconnect tests keep stable ids; line ~857 says the state-only fallback stays TUI-only "until those implementations land", though both relays have landed and the capability rows read reliable.

## What to build

The approval section describes what is now true: native record ids survive reconnects for Codex and OpenCode, the TUI-only fallback applies to Claude Code and to requests that fail the adapter's checks or the payload cap, and no sentence describes the relays as future work.

## Acceptance criteria

- [x] C1. hub/README.md's approval section states that Codex and OpenCode records keep their id across a reconnect and no longer says a reconnect may re-key a pending request (docs).
  - done: impl-1159 · 2026-10-23T02:22:24.454Z
  - verified: rev-23 [reviewer] · run rev-20261023-1159-source · 2026-10-23T02:23:53.307Z · commit 51a143be7986686642ef8ff23d0416b4ff684cab
- [x] C2. hub/README.md's approval section names when a record is TUI-only (Claude Code, a request failing the adapter's checks, a subject over the payload cap) and has no "until those implementations land" wording (docs).
  - done: impl-1159 · 2026-10-23T02:22:24.538Z
  - verified: rev-23 [reviewer] · run rev-20261023-1159-source · 2026-10-23T02:23:53.307Z · commit 51a143be7986686642ef8ff23d0416b4ff684cab

## Comments

### impl-1159 · 2026-10-23T02:22:09.061Z

Read the approval section, all approvalRelay capability rows and E-414 decision comments (including 2026-10-22 23:30Z complete-authorization-subject cap). Updated only the two stale approval paragraphs: Codex/OpenCode native IDs survive reconnect; Claude Code, failed adapter checks and subjects over serialized 64 KiB remain TUI-only with no choices; clipped text is informational. Searched the section for remaining until-landed wording. Root node_modules linked; origin/dev fetched and merged (already up to date); npm run check is running before source review. Per-item QA is after-stage and no qaCriteria are outstanding.

### rev-23 · 2026-10-23T02:23:53.307Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1159-source
commit: 51a143be7986686642ef8ff23d0416b4ff684cab
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, C1/C2 documentation criteria verified, no findings. A-9771: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9771-t-1159-approval-documentation-source-clear-at-51a143be.md. Both paragraphs match native stable record IDs/reconnect tests, capability rows, adapter validation and full serialized UTF-8 64 KiB cap/TUI-only fallback. Future-relay wording removed, existing gate/non-consent behavior retained. No runtime or skill/role change. Reported local check is not a configured suite receipt. Proceed with mode-free exact-head verification; final evidence settlement and after-stage QA remain separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-23T02:24:02.824Z

Merged fe3937b0c8ef8c55cd909ff58208d95c5ae06280 onto dev.
