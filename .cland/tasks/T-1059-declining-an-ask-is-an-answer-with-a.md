---
id: T-1059
kind: task
title: Declining an ask is an answer with a reason
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by:
  - T-1057
topic: null
branch: null
created: 2026-10-21T14:04:19.059Z
updated: 2026-10-22T06:33:33.261Z
---

## Summary

Make declining an ask an answer with the value `declined` and a reason that the asker receives, with the topic left open.

## Parent

E-413 (§3.4 "Declining"; tracer step 5).

## What to build

`topic.answer` takes `declined: true` with a non-empty reason. The asker's delivery reads `declined: <reason>`. The topic stays open and may ask again; there is no separate "ask me later". The outcome travels through the thread and the inbox's departure as `declined`, with who and when. Neovim shows a declined ask folded with its reason; declining from Neovim is not part of 0.2.0. The role clauses say a declined ask is a decision, never consent (ADR 0007: it reaches the asker as a delivery).

## Acceptance criteria

- [ ] C1. A fake Implementer's ask declined with a reason delivers `declined: <reason>` to the asker, and its topic stays open for its next ask (test).
- [ ] C2. Declining without a reason is refused (test).
- [ ] C3. The thread and the inbox's departure carry `declined` with the reason, who and when (test).
- [ ] C4. Neovim's thread shows the declined ask folded with its reason (headless test).
- [ ] C5. The role clauses state that a declined ask is a decision and never consent, within the clause byte reserve; `hub/README.md` and `nvim/README.md` describe declining.
