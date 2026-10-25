---
id: T-1258
kind: task
title: cland's OpenCode sessions don't see the user's OpenCode Console login, so paid Go and Zen models are unavailable
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: null
branch: t/T-1258-cland-s-opencode-sessions-don-t-see-the
created: 2026-10-24T19:27:25.100Z
updated: 2026-10-25T09:54:46.968Z
---

## Summary

cland starts each OpenCode server with OPENCODE_DB=~/.local/share/cland/opencode/opencode.db. OpenCode keeps the Console login (the Go subscription or a Zen account) in its default database, so a cland session lists only opencode, google-vertex and openrouter, and every turn on opencode-go/deepseek-v4.1-flash fails with "Model unavailable" (impl-619b, 2026-10-24 19:18 and 19:25Z, hub.log turn-failed). The user's own `opencode run` works because it goes through their running OpenCode service. Neither `cland doctor` nor the launch refusal names the cause.

## Acceptance criteria

- [ ] C1. A launch or turn on a provider that is connected in the user's default OpenCode store but missing from cland's database fails with a message naming the cause and the fix (the login or import command for cland's database), never a bare "Model unavailable" (test).
- [ ] C2. `cland doctor` warns when the user's OpenCode store has Console credentials that cland's OpenCode database lacks, and docs say how to connect them (test).

## Comments

### coord · 2026-10-24T19:28:40.744Z

Workaround applied 2026-10-24 19:28Z at the human's instruction (ask 129efe72): `opencode auth export | OPENCODE_DB=~/.local/share/cland/opencode/opencode.db opencode auth import --standalone` through a pipe (nothing printed or saved); import must use --standalone, otherwise it writes to the background service's default store. After a relaunch, impl-619b's server listed opencode-go and its turns ran (session-usage at 19:28:35Z). A fix should do this sync, or point at it, automatically.
