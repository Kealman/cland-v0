---
id: Q-1514
kind: question
title: Harness credentials replicated across hosts
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:37.783Z
updated: 2026-10-31T14:53:52.183Z
closed: 2026-10-31T14:53:52.183Z
---

## Question

How can one harness login be replicated to several Linux hosts without a login per host, and what breaks when copies are used concurrently (map M-1511 round-3 decisions 5–7)? Primary sources: Anthropic's Claude Code docs (authentication, `claude setup-token`, CLAUDE_CODE_OAUTH_TOKEN, `--bg`, headless/CI guidance, credential file layout on Linux, folder trust in `.claude.json`), the claude-code issue tracker (refresh-token rotation, #95822 and related), OpenAI Codex docs and repository (auth.json format, `cli_auth_credentials_store`, `codex login --device-auth`, `--with-api-key`, refresh behaviour, the "one auth.json per runner" rule and its reasons), OpenCode docs and source (`opencode auth export/import --standalone`, database layout, Go/Zen console login, provider keys via env).

Answer per harness: (a) which artefact carries a login (file, directory, token, database), (b) whether a copy on a second machine keeps working while the first is in use, and what happens at refresh (rotation, revocation, grace), (c) a long-lived or non-rotating alternative (Claude setup-token: scopes, lifetime, what it cannot do such as `/usage`; Codex API key: billing model and what the ChatGPT plan cannot cover; OpenCode API keys), (d) the headless login flow that works over SSH without a browser on the host (device code, printed URL, what the human must do), (e) how the harness signals a dead login (exit codes, JSON fields, log lines) so the hub can mark the account signed-out, (f) folder trust and other per-machine state that must be prepared on a fresh host.

Deliver docs/research/harness-credentials.md on branch research/harness-credentials with a decision table (copy / token / key / login-per-host per harness), the risks with sources, and "Rules for the spec". The two-host prototype that verifies the concurrent-copy behaviour is a separate ticket; mark what only the prototype can settle.

## Comments

### human · 2026-10-31T14:53:52.010Z

## Resolution

Research note: docs/research/harness-credentials.md on branch research/harness-credentials (final 79733ac8, pushed to origin only). Thirteen rules for the spec.

1. No harness tolerates one subscription login copied to several hosts at once: Claude Code and Codex rotate the refresh token on every refresh; the second host gets invalid_grant or refresh_token_reused, and Claude Code then blanks its stored login (claude-code issues #102265, #88583, #95822). Codex documents it: "Do not share the same file across concurrent jobs or multiple machines."
2. Round-3 decision 5 conflicts with Anthropic's terms for Claude Code: the legal page says developers may not collect, store or intermediate Claude.ai credentials or session tokens; sign-in must complete through Anthropic's own flow; the carve-out for secret managers and machine images covers API keys only. A setup-token or .credentials.json in cland's store would be stored and intermediated. setup-token works technically (one year, inference only, no rotation, no Remote Control, no /usage). Whether to use it is the human's call → grilling Q-1520.
3. Compliant Claude default: a login per host. cland opens `claude auth login` over `ssh -t`, the login stays on the host's kept disk without passing through cland. A Console API key is also allowed (per-token billing).
4. Codex on the human's Pro plan has no long-lived token (access tokens are Business and Enterprise only): either the copy pinned to one host with write-back of the refreshed auth.json, or one `codex login --device-auth` per extra host. Codex refreshes 5 minutes before access-token expiry, after 8 days, or on a 401 (rust-v0.166.0). `codex login`/`logout` revoke the tokens already in that home first, so a re-login inside an unpacked copy kills every copy.
5. OpenCode: copy the static Go API key (the choice); OAuth credentials rotate; `auth export/import` is documented for another machine but import never overwrites an existing id.
6. Decision table: Claude — copy no, setup-token works but terms question, API key allowed, login per host is the compliant default; Codex — copy one host at a time with write-back, no long-lived token on Pro, API key possible, device-auth login per host as fallback; OpenCode — static key copied.
7. The host agent must check Claude liveness by pid: polling `claude agents --json` or `claude auth status` near expiry loses rotated tokens (#95822, open). Hosts carry no stray ANTHROPIC_API_KEY or CODEX_* variables; Codex needs cli_auth_credentials_store = "file". Dead-login signals per harness are in the note.
8. Q-1518 settles: a per-host login surviving stop/start; setup-token in `--bg` via settings.json env if chosen; Codex refresh cadence, how a stale copy fails, device-auth end to end; one OpenCode key on two hosts.
