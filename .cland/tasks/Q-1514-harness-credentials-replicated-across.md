---
id: Q-1514
kind: question
title: Harness credentials replicated across hosts
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:37.783Z
updated: 2026-10-31T14:35:55.685Z
---

## Question

How can one harness login be replicated to several Linux hosts without a login per host, and what breaks when copies are used concurrently (map M-1511 round-3 decisions 5–7)? Primary sources: Anthropic's Claude Code docs (authentication, `claude setup-token`, CLAUDE_CODE_OAUTH_TOKEN, `--bg`, headless/CI guidance, credential file layout on Linux, folder trust in `.claude.json`), the claude-code issue tracker (refresh-token rotation, #95822 and related), OpenAI Codex docs and repository (auth.json format, `cli_auth_credentials_store`, `codex login --device-auth`, `--with-api-key`, refresh behaviour, the "one auth.json per runner" rule and its reasons), OpenCode docs and source (`opencode auth export/import --standalone`, database layout, Go/Zen console login, provider keys via env).

Answer per harness: (a) which artefact carries a login (file, directory, token, database), (b) whether a copy on a second machine keeps working while the first is in use, and what happens at refresh (rotation, revocation, grace), (c) a long-lived or non-rotating alternative (Claude setup-token: scopes, lifetime, what it cannot do such as `/usage`; Codex API key: billing model and what the ChatGPT plan cannot cover; OpenCode API keys), (d) the headless login flow that works over SSH without a browser on the host (device code, printed URL, what the human must do), (e) how the harness signals a dead login (exit codes, JSON fields, log lines) so the hub can mark the account signed-out, (f) folder trust and other per-machine state that must be prepared on a fresh host.

Deliver docs/research/harness-credentials.md on branch research/harness-credentials with a decision table (copy / token / key / login-per-host per harness), the risks with sources, and "Rules for the spec". The two-host prototype that verifies the concurrent-copy behaviour is a separate ticket; mark what only the prototype can settle.
