---
id: Q-1527
kind: question
title: "Web sign-in modes and users: single-user as today or multi-user with admin accounts"
state: open
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T17:17:21.936Z
updated: 2026-10-31T17:17:22.066Z
---

## Question

Which sign-in system does the web workbench get in 0.4 (the human, 2026-10-31): at setup the project chooses between the single-user mode of today (one human identity, one-time web links, pairing of remotes to that one human) and a multi-user mode with user accounts, all with the same admin rights for now, built so that role-based access can be added later? What a user is in the hub (identity on messages, asks, approvals, remote pairings, artifacts), how users are created and signed in (invite links, passwords, passkeys, OIDC), where they are stored, what single-user mode keeps unchanged, what the Neovim workbench and the CLI do with users, and what is deferred (RBAC itself, per-user notifications, audit). Grilling with the human.
