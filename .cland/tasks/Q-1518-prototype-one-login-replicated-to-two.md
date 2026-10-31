---
id: Q-1518
kind: question
title: "Prototype: one login replicated to two hosts"
state: open
labels:
  - wayfinder:prototype
assignee: null
parent: M-1511
blocked_by:
  - Q-1514
  - Q-1517
topic: null
branch: null
created: 2026-10-31T14:35:39.154Z
updated: 2026-10-31T14:35:54.522Z
---

## Question

Do replicated harness logins work on two hosts at once (map M-1511 round-3 decisions 5–7), given the facts of the credential research? A throwaway prototype on two small droplets: log in once per harness on host 1 (device-auth over SSH), pack the harness home into an encrypted archive on the hub side, unpack it into a tmpfs on host 2, run sessions on both hosts for several hours across a token refresh, and record what happens: do both keep working, does a refresh on one break the other, how does each harness report a dead login, does Claude's setup-token work for a `--bg` session and what it cannot do, does a Codex API key change the behaviour, does OpenCode `auth export/import` carry the Go/Zen login. Try the re-login flow: expire or revoke, mark, device-auth again, refresh the archive, update host 2 in place without restarting its sessions.

Deliver the facts and the decision the prototype settles per harness (copy / token / key / login per host), the archive format and its size, and the frictions for the spec.
