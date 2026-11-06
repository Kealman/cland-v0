---
id: T-1710
kind: task
title: The host prelude
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: null
branch: t/T-1710-the-host-prelude
created: 2026-11-06T10:48:04.642Z
updated: 2026-11-06T10:50:32.590Z
---

## Summary

The user-data that runs before anything else on a new host does six things. It installs the hub-generated host key the hub pins. It sets sshd's `StreamLocalBindUnlink yes`, `ClientAliveInterval 15`, `ClientAliveCountMax 4` and `MaxSessions 32`. It deletes the provider's volume automount rule (DigitalOcean's `99-digitalocean-automount.rules`). It installs the login-disk helper `cland-auth` with its one sudoers line for `runner`. It writes Codex's `config.toml` with `cli_auth_credentials_store = "file"`. And it sets none of the stray API keys.

Hot files: `hub/src/host/prelude.ts` (new), `hub/src/host/cland-auth.sh` (new), `hub/test/host-prelude.test.ts` (new)

## What to build

- `renderPrelude({ hostKey, hostPublicKey, providerSteps })`, where the provider contributes its own steps (DigitalOcean: the automount rule);
- the `cland-auth` helper (mount, unmount, freeze, thaw), accepting only volume names and `/cland/auth/<harness>-<login>` paths, and ending every process on a mount before unmounting it, as the prototype's helper does.

## Acceptance criteria

- [ ] C1. The rendered user-data installs the given host key pair and writes an sshd drop-in with `StreamLocalBindUnlink yes`, `ClientAliveInterval 15`, `ClientAliveCountMax 4`, `MaxSessions 32` and `PasswordAuthentication no` (test).
- [ ] C2. The DigitalOcean rendering removes `99-digitalocean-automount.rules`, installs `cland-auth` with the sudoers line `runner ALL=(root) NOPASSWD: /usr/local/sbin/cland-auth`, and writes Codex's `cli_auth_credentials_store = "file"` (test).
- [ ] C3. With sentinel values for `DIGITALOCEAN_TOKEN`, the project secret, the messenger tokens and `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY`, `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN` in the hub's environment, the user-data contains none of those values and assigns none of those names (test).
- [ ] C4. `cland-auth` exits non-zero without acting on a volume name or mount path outside its patterns or an unknown operation (test).
