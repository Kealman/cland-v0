---
id: T-830
kind: task
title: The workbench's Neovim writes nvim.log into the hub's state directory ~/.local/state/cland
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-609
topic: topic-697
branch: t/T-830-the-workbench-s-neovim-writes-nvim-log
created: 2026-10-19T06:11:28.700Z
updated: 2026-10-20T06:28:10.937Z
closed: 2026-10-20T06:28:10.937Z
---

## Summary

Found while dry-running the E-612 QA brief: the Neovim workbench runs as app `cland`, so Neovim's own `nvim.log` lands in `~/.local/state/cland`. That folder has been the hub's per-user state directory since T-609, beside `spend.json`. Neovim's logs and other state should stay out of it.

## Acceptance criteria

- [x] C1. The workbench's Neovim writes its log and state under its own app directory (for example `NVIM_APPNAME`-derived `~/.local/state/cland-nvim`, or Neovim's default), never into the hub's state directory; a T2 test with a scratch XDG_STATE_HOME shows `~/.local/state/cland` holds only the hub's files after the workbench opens.
  - done: impl-830 · 2026-10-20T06:11:55.729Z
  - verified: rev-31 [reviewer] · run rev-20261020-830-final · 2026-10-20T06:22:17.031Z · commit ccfb53eb079db213d68da8159ed259de63d59670

## Comments

### impl-830 · 2026-10-20T06:09:44.356Z

Implemented NVIM_APPNAME=cland-nvim and one-time allowlisted legacy-state migration. Client regression reproduced the old shared-directory behavior before the fix and now passes through the real launcher with scratch XDG directories, inherited log-path isolation, destination preservation, untouched hub files and no migration replay. Current UI preferences remain project-local.

### rev-31 · 2026-10-20T06:14:38.143Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-830-source
commit: ccfb53eb079db213d68da8159ed259de63d59670
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-7136 reviews launcher app/log isolation, once-only regular-file allowlisted migration with destination preservation, Coordinator brief and docs. Real-launcher T2 assertions cover separate stdpaths/log, untouched hub files and no migration replay; exact headless guard remains bounded. C1 implementation established; final mark awaits configured mode-free same-head gate, new identity 5/5 and owned resource/duration audit. No user-state edits, Reviewer tests or merge actions.

### rev-31 · 2026-10-20T06:22:17.031Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-830-final
commit: ccfb53eb079db213d68da8159ed259de63d59670
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7148: exact-head A-7145/88903f2f independently audited: 1927 ordinary passes, all four client-component cases pass and new real-launcher migration identity 5/5 distinct passing repetitions (max 0.489243794 s). Host/T1/fallback T2 green; no resource/duration failures. C1 verified with source A-7136; claimant done present.

Criteria: C1 verified.

### coord · 2026-10-20T06:28:10.937Z

Merged 4c391d2adda4291647f666080f459c3eca3685d2 onto dev.
