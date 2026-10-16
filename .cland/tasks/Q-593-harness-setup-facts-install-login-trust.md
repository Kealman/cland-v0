---
id: Q-593
kind: question
title: "Harness setup facts: install, login, trust and accounts for Claude Code, Codex and OpenCode"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.240Z
updated: 2026-10-16T11:26:12.245Z
---

## Question

What does `cland setup` need to know about each harness? For Claude Code, Codex and OpenCode: the non-interactive install command and what it needs, the version check, the login flow and whether it can run inside a wizard step, the auth status command's output and which fields identify the account for `~/.config/cland/accounts.toml`; the first-run folder trust (Claude Code's dialog that turns `claude --bg` into a refusal: T-24, T-58, D36; Codex's folder trust: T-42; OpenCode's, if any) and a deterministic way to grant it from setup (config files, flags) or, failing that, the cheapest interactive step; and what an Aide in a plain terminal is: `claude --bg` plus `cland session attach` against a foreground harness started with the spoke environment (CLAND_SESSION_NAME), with the delivery and acknowledgement differences (hub/README.md 83-91, 129, 960). Try each in a scratch folder on this machine, without changing the trust of real projects and without printing secrets. Deliver `docs/research/harness-setup.md` on research/harness-setup with a per-harness table and the resolution comment here.
