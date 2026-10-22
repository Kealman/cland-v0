---
id: T-1114
kind: task
title: Approvals on Neovim's inbox keys
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1110
topic: null
branch: null
created: 2026-10-22T15:16:11.910Z
updated: 2026-10-22T15:16:11.910Z
---

## Summary

Neovim's inbox answers a relayed approval on its keys and folds the row to its outcome. A row answered in the TUI keeps ↵ to attach.

## Parent

E-414 (the clients; tracer step 5).

## What to build

In Neovim's inbox, in both the panel and the full-width view, a relayed approval's row shows the session, the command or the file change, and its choices. `1` approves once and `2` approves always for this command, following the option keys of asks. `d`, the decline key, denies: it opens the note field, and Enter sends the denial with the typed note. The row then folds in place to one line with its outcome (who answered, where and when), as an answered ask does, and leaves by the inbox's usual rule. A refused answer, where someone else answered first, says who answered and when, and folds the row to the winner's outcome. A row answered in the TUI (Claude Code, or a relay that fell back to none) keeps ↵ to attach. On `1`, `2` and `d` it says where to answer and sends nothing. The footer hints, the help line and the inbox's action groups list the keys.

## Acceptance criteria

- [ ] C1. In headless Neovim on recorded frames, `1` on a relayed approval row sends one `approval.answer` with `once`, and the row folds to "approved once by the human" with its time (test).
- [ ] C2. `d` on a relayed row opens the note field, and Enter sends `deny` with the typed note (test).
- [ ] C3. A refused answer folds the row to the winner's outcome and says who answered and when (test).
- [ ] C4. On a row answered in the TUI, ↵ still attaches, and `1`, `2` and `d` send nothing and say where to answer (test).
- [ ] C5. `nvim/README.md` lists the approval keys, the folded outcome and the row answered in the TUI, and `GLOSSARY.md` defines Approval (docs).
