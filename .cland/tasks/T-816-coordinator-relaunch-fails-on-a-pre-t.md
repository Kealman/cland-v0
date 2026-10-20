---
id: T-816
kind: task
title: Coordinator relaunch fails on a pre-T-603 default-directory account_env, and its harness exit goes unnoticed
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-699
branch: t/T-816-coordinator-relaunch-fails-on-a-pre-t
created: 2026-10-18T18:34:34.099Z
updated: 2026-10-20T06:12:42.595Z
---

## Summary

The Coordinator's harness (pid 99977) exited at 17:48Z on 2026-10-18 without anyone noticing, and the hub released the role. This is the fourth T-372-class exit. The plain `cland session resume coord --relaunch` then failed with "Workspace not trusted". The exited harness_processes row still carried the pre-T-603 explicit account_env {CLAUDE_CONFIG_DIR: ~/.claude}, which T-603 deliberately did not migrate. cland-impl nulled that column by hand, and the relaunch then worked (logged on T-204).

## Acceptance criteria

- [x] C1. Relaunching a row whose account_env names only the default Claude Code config directory drops or ignores that entry and starts the harness as a default-account launch; a regression test with a pre-T-603 row shows the relaunch succeeding without hand edits.
  - done: impl-816 · 2026-10-20T06:10:44.866Z
- [x] C2. When the Coordinator's harness exits, the hub posts a notice to General within one heartbeat, naming the session, its exit time and the released role, so a vacant Coordinator is visible before work stalls.
  - done: impl-816 · 2026-10-20T06:10:45.591Z

## Comments

### impl-816 · 2026-10-20T06:10:04.328Z

Implemented C1 normalization for legacy unpinned default-directory-only overlays, preserving named accounts, richer overlays, and hub-inherited selections. C2 emits one immediate General notice on actual Coordinator harness exit (including after a prior spoke disconnect), with timestamp, released role, resume and attach commands. Regression tests reproduced both failures before the fixes; targeted adapter environment and core/store files now pass. Checking complete wiring and T0 before first source review.

### rev-31 · 2026-10-20T06:12:42.595Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-816-source
commit: ee6b24da8c1a02c6a54fe09c96bbfb0b09cc17ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-7134 records narrow legacy default-profile normalization, preserved explicit selections and immediate single Coordinator-exit General notice through the actual role-release path. Regression coverage checks resumed conversation/environment and connected/disconnected/repeated-exit cases plus UI integration. C1/C2 implementation established; final marks await configured mode-free same-head gate, new identities 5/5 and modified component-case pass. No real profile edits, Reviewer tests or merge action.
