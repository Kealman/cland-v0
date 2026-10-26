---
id: T-1328
kind: task
title: The git-ignored secrets file and cland secret set, list and unset
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by: []
topic: topic-1082
branch: t/T-1328-the-git-ignored-secrets-file-and-cland
created: 2026-10-26T07:54:41.571Z
updated: 2026-10-26T07:57:02.423Z
---

## Summary

A project holds its messenger tokens and speech keys in a git-ignored `.cland/secrets.toml`, managed with `cland secret set|list|unset`. Values arrive only through stdin or a hidden prompt, and nothing ever prints them.

## What to build

`.cland/secrets.toml` holds `[telegram] token`, `[discord] token`, and `[speech] elevenlabs_key` and `xai_key`. It is git-ignored through the managed `.cland/.gitignore`. It is kept at mode 600, checked and tightened at hub start, and refused as a symlink with a reason. TOML goes through the hub's existing parser, with no new dependency. `cland secret set <name>` reads the value from stdin or a hidden prompt, never argv. `list` prints names and SHA-256 fingerprint prefixes only. `unset <name>` removes one. Names are dotted keys (`telegram.token`), as `cland config set` names keys. Spec §3.3 and §3.10. Tests feed made-up values through stdin only.

## Acceptance criteria

- [ ] C1. A secrets file at mode 644 is tightened to 600 at hub start, a symlinked file is refused with a reason, and `git status` never lists the file (test).
- [ ] C2. A value piped to `cland secret set telegram.token` lands in the file, `list` shows only its name and fingerprint prefix, `unset` removes it, and the value appears in no command output, log line or process argv (test).

## Comments

### impl-1328 · 2026-10-26T07:57:02.423Z

Contract/consumer audit before changes (rule 20): introduce local-only secrets file schema and resolver; no wire/frame fields change. Production consumers: CLI routing/help (hub/bin/cland.ts, cli/help.ts, cli/usage.ts), project layout/ensureSkeleton called at serveProject startup, init/provision.ts managed GITIGNORE writer. Existing project transport secret (.cland/secret), Discovery and all Unix/Web/MCP clients remain unchanged. Audited hub/src, hub/test (all tiers via rg), shared, nvim, web, shipped .agents/skills, docs/agents, qa/briefs and startup probes: no secrets.toml reader exists. Existing doctor secret check refers to transport authentication and is unaffected. Future consumers T-1329/T-1330/T-1331 will use one resolveSecrets(root) dotted-key map, with exported SecretName/names and fingerprint helper. Tests: T1 public file resolver/mutators for safe parsing/files; T2 projectHub startup and real CLI stdin (CLI itself under test). Legacy wire compatibility unchanged because no frames carry secrets. Local red/green execution held by Coordinator cover-quiet.
