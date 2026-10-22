---
id: T-1114
kind: task
title: Approvals on Neovim's inbox keys
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1110
topic: topic-872
branch: t/T-1114-approvals-on-neovim-s-inbox-keys
created: 2026-10-22T15:16:11.910Z
updated: 2026-10-22T23:25:34.036Z
---

## Summary

Neovim's inbox answers a relayed approval on its keys and folds the row to its outcome. A row answered in the TUI keeps ↵ to attach.

## Parent

E-414 (the clients; tracer step 5).

## What to build

In Neovim's inbox, in both the panel and the full-width view, a relayed approval's row shows the session, the command or the file change, and its choices. `1` approves once and `2` approves always for this command, following the option keys of asks. `d`, the decline key, denies: it opens the note field, and Enter sends the denial with the typed note. The row then folds in place to one line with its outcome (who answered, where and when), as an answered ask does, and leaves by the inbox's usual rule. A refused answer, where someone else answered first, says who answered and when, and folds the row to the winner's outcome. A row answered in the TUI (Claude Code, or a relay that fell back to none) keeps ↵ to attach. On `1`, `2` and `d` it says where to answer and sends nothing. The footer hints, the help line and the inbox's action groups list the keys.

## Acceptance criteria

- [ ] C1. In headless Neovim on recorded frames, `1` on a relayed approval row sends one `approval.answer` with `once`, and the row folds to "approved once by the human" with its time (test).
  - failed: rev-31 [reviewer] · 2026-10-22T23:25:34.036Z · note Folded outcome retirement is tied to cursor movement rather than leaving the inbox visit; hidden/reopened buffers retain stale completed rows.
- [x] C2. `d` on a relayed row opens the note field, and Enter sends `deny` with the typed note (test).
  - done: impl-1114 · 2026-10-22T23:21:16.832Z
- [ ] C3. A refused answer folds the row to the winner's outcome and says who answered and when (test).
  - failed: rev-31 [reviewer] · 2026-10-22T23:25:34.036Z · note A held losing-race archive reply can overwrite newer live approval rows/counts when state.set_inbox applies the stale full snapshot.
- [x] C4. On a row answered in the TUI, ↵ still attaches, and `1`, `2` and `d` send nothing and say where to answer (test).
  - done: impl-1114 · 2026-10-22T23:21:17.110Z
- [x] C5. `nvim/README.md` lists the approval keys, the folded outcome and the row answered in the TUI, and `GLOSSARY.md` defines Approval (docs).
  - done: impl-1114 · 2026-10-22T23:21:17.185Z

## Comments

### impl-1114 · 2026-10-22T23:09:58.294Z

Implementation started test-first at the assigned recorded-frame/headless Neovim seam (T2), both inbox views. Root node_modules linked. Tests will observe outbound approval.answer and rendered folded outcomes; TUI attachment remains stub-refused at its existing boundary. Stage QA applies after-stage, no per-item brief required.

### rev-31 · 2026-10-22T23:25:34.036Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261023-1114-source
commit: 8be4efbbd34d9a2cdf7b8562ebf6a7d7932740d1
scope: full
findings: [{"severity":"medium","text":"M1: Folded outcomes retire on movement to another row but survive leaving/reopening the inbox because completed/selected have no view-leave cleanup. Follow the inbox visit leave rule; test both panel/full lifecycle.","file":"nvim/lua/cland/inbox.lua","line":264},{"severity":"medium","text":"M2: The losing-race archive read replaces all inbox state via a plain unjournalled reply; a held old reply can overwrite newer approval/inbox deltas and needsYou. Preserve newer live facts when installing winner/archive.","file":"nvim/lua/cland/inbox.lua","line":347}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; A-9514. Standards0/Spec2medium: M1 inbox.lua:264 folded outcome lifetime disagrees with inbox leave rule; M2:347 stale archive lookup overwrites newer live inbox state. Add bounded panel/full visit and held-reply regressions, retain final/outgoing/no-send assertions. C1/C3 failed, runtime criteria pending; fixture audit independently adds21 with0 removed/changed. Shared env gap stays T-1156 under Coordinator disposition. Preserve original local receipts without reruns for transcription; corrected head needs source review before verify.

Criteria: C1 failed (Folded outcome retirement is tied to cursor movement rather than leaving the inbox visit; hidden/reopened buffers retain stale completed rows.), C3 failed (A held losing-race archive reply can overwrite newer live approval rows/counts when state.set_inbox applies the stale full snapshot.).
