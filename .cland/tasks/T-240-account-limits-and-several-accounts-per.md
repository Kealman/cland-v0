---
id: T-240
kind: task
title: Account limits and several accounts per harness
state: open
status: backlog
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:01.590Z
updated: 2026-10-12T09:35:30.557Z
---

## Open question

The human wants to see each account's current subscription limits (weekly limits, how much is used, when they reset) and to configure several accounts per harness, for example several CLAUDE_CONFIG_DIRs, used per role, per session or round-robin (observation 5). Needs research into which harnesses expose limits and how each selects an account. Relates to spec §3.8 and roles.toml launch defaults.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T09:35:30.557Z

Research done: `docs/research/account-limits.md` on branch `research/account-limits` (commit f8b549e, pushed to the territory). Facts only; the decisions stay with the human. Probe scripts are in `docs/research/account-limits/`.

| | Claude Code 2.1.296 | Codex CLI 0.162.1 | OpenCode 2.0.24 |
|---|---|---|---|
| Account switch | `CLAUDE_CONFIG_DIR` (documented for "multiple accounts side by side"; one keychain item per dir) | `CODEX_HOME` (own `auth.json` or keyring key) | `XDG_DATA_HOME` or `OPENCODE_DB` per server; `opencode auth switch` is global to the database |
| Launch on an account | `CLAUDE_CONFIG_DIR=~/.claude-b claude --bg …` (and the same variable for `agents --json`, `attach`, `stop`) | `CODEX_HOME=~/.codex-b codex app-server …` | `XDG_DATA_HOME=… opencode serve …` or a provider key per server |
| Limits pushed per session | status line `rate_limits`, mods `session.measure`, `rate_limit_event` | `account/rateLimits/updated`; `token_count.rate_limits` in rollouts | none |
| Limits on demand | `/usage`, `claude -p "/usage"` (no model call) → undocumented `GET api.anthropic.com/api/oauth/usage` (rate-limited) | `account/rateLimits/read` → undocumented `GET chatgpt.com/backend-api/wham/usage` | none; OpenCode Go only in the web console |
| Windows here | 5-hour session, weekly, weekly per model ("Fable") | ChatGPT Pro: weekly only (no five-hour window) | Go: 5-hour / weekly / monthly dollar windows |
| Limit hit | `StopFailure.error = "rate_limit"`; `rate_limit_event.status = "rejected"`; `-p` result `is_error` + `api_error_status: 429` | `codexErrorInfo = "usageLimitExceeded"` in `error`, then `turn/completed` failed; `exec`: text only, exit 1 | `error.type = "provider.quota"` in `session.execution.failed`; `opencode run` exit 1 |
| Terms | several accounts documented; limits "assume ordinary, individual usage"; policy from 2026-11-12 reaches "create multiple accounts, to … circumvent product guardrails"; no third party may hold Claude.ai tokens | no one-account rule; Terms of Use forbid circumventing "rate limits or restrictions"; partner-app terms forbid "rotating accounts" | OpenCode terms forbid "multiple accounts to circumvent usage limits" |

Recommendation (section 5): a user-level accounts registry (`~/.config/cland/accounts.toml`, paths only, no secrets) named from `roles.toml` and launches; the account as an environment overlay on every process the adapter starts or queries, recorded per session; limits pushed from running sessions (Codex as today; Claude by forwarding `session.measure` from the cland mod) and pulled rarely, through the harness itself, for idle accounts; an accounts block at the top of the sessions panel that renders the windows the source sends; pinned accounts per role or launch and a "limited" mark set from the hit signals. Automatic failover or round-robin on a near limit is exposed under all three providers' terms, so build it only if the human accepts that, as an opt-in.

Found on the way: Claude Code issue anthropics/claude-code#95822 (open): short-lived `claude` commands near token expiry (`auth status`, `--bg`, `agents --json`) can spend the refresh token and log a config dir out. cland's adapter polls `claude agents --json` every 5 s; polling idle accounts would be the worst case.
