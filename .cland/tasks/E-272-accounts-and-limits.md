---
id: E-272
kind: epic
title: Accounts and limits
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by:
  - E-271
topic: null
branch: null
created: 2026-10-12T11:35:14.048Z
updated: 2026-10-12T11:35:19.640Z
---

## Goal

The human sees each account's limits in the sessions panel and pins sessions to accounts by name, and cland never moves work between accounts on its own. Several accounts per harness work today through one environment variable each (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_DATA_HOME` or `OPENCODE_DB`), but cland launches every session on the harness's default and shows no limits. A limited account refuses new launches and the human picks another, because the providers' terms forbid rotating accounts to get past a limit.

## Contents

- **§3.13 Accounts and limits**, whole:
  - The registry at user level in `~/.config/cland/accounts.toml`: names and paths only, never a secret. `roles.toml` and launches refer to an account by name; the account is recorded on the session; every process the adapter starts or queries for a session, `agents --json` included, runs in the account's environment (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_DATA_HOME` or `OPENCODE_DB`).
  - Limits from running sessions first: Codex's `account/rateLimits/updated`, Claude Code's status-line `rate_limits` forwarded by the cland mod. Idle accounts polled at most every 15 minutes and only through the harness itself (`claude -p "/usage"`, a short-lived `codex app-server`); cland never calls a provider's endpoint with a token it reads; OpenCode exposes nothing and shows nothing.
  - The accounts block at the top of the sessions panel: per account, the windows the source sent (5-hour, weekly, per-model weekly) with the used share and the reset time; a limited account highlighted.
  - Routing without rotation: an account pinned to a role or to a launch by hand; on a limit-hit signal (Claude `rate_limit` and 429, Codex `usageLimitExceeded`, OpenCode `provider.quota`) the hub marks the account limited, refuses new launches on it, and the human is asked to pick another; no automatic failover or round-robin.
- **T-265**, the Claude adapter's polling near token expiry (claude-code#95822), which precedes multi-account use: at most one `claude agents --json` per 30 seconds per config directory, or a push source instead; a logged-out directory gives one event and one message to the human, with no retry storm.

Not in this epic: failover, round-robin or a fill-first list of accounts, which §3.13 rules out; a second paid account for overflow, which is the human's own call; signing in, which stays each harness's own flow, done once by the human.

Choices where the spec is silent:

- `roles.toml` takes `account = "<name>"` under `[<role>.launch]`, one name and never a list; `cland session launch --account <name>` overrides it; with no account the harness's default applies, as today.
- The registry's shape follows the research (section 5.1): per account its `harness` and its directory or database (`config_dir`, `home`, `data_home` or `db`). A name the registry does not know refuses the launch and lists the known names. The registry's path follows `XDG_CONFIG_HOME` when it is set, so tests and QA use a scratch registry and never touch the human's.
- The account name is on the launch record and the session, in `session.list` and in the expanded row's meta line ("Codex · gpt-6.1-sol · codex-b"), and on the usage records of "Status, fields and instrumentation" from then on.
- The Claude adapter polls `claude agents --json` once per config directory that has live cland sessions, never in an idle one; `claude auth status` and `claude doctor` never run on a timer.
- `cland account list` prints each account with its windows, their age and its limited mark (`--json` the same); `cland account clear <name>` lifts a limited mark by hand, which an OpenCode account needs, since its signal names no reset.
- A limited mark lasts until the reset the signal names (Claude's `resetsAt`, Codex's window reset). A refused launch names the account and its reset; the Coordinator's clause turns it into an ask listing the other accounts of that harness, and the human's answer pins the account for the launch or the role. The hub asks nothing itself: only the Coordinator asks the human.
- An idle account is polled at hub start, when the human opens the accounts block, after a limit-hit signal, and otherwise at most every 15 minutes, backing off on a 429 as the harness itself does.

## Tracer-bullet order

1. **Safer polling first (T-265).** The Claude adapter polls `claude agents --json` at most once per 30 seconds per config directory and reports a logged-out directory once. Demo: a fake-harness test shows the interval under two directories, and one event and one message for a logged-out one.
2. **The registry and the launch environment.** `accounts.toml`, `account` in `roles.toml` and on launch, the account on the session, and every adapter process run in its environment. Demo: `cland session launch rev-x --role reviewer --account codex-b` runs its `codex app-server` with codex-b's `CODEX_HOME`, and `cland session list --json` shows the account.
3. **Limits from running sessions.** Codex's rate-limit events and Claude's status-line `rate_limits`, forwarded by the cland mod, are kept per account with their age. Demo: a fake Codex session's `account/rateLimits/updated` shows in `cland account list --json` with its windows and resets.
4. **Idle accounts through the harness.** Idle accounts are polled through `claude -p "/usage"` and a short-lived `codex app-server` at most every 15 minutes, and OpenCode accounts show no data. Demo: an idle fake account is polled once through its fake harness, and the test proves no HTTP request left cland for a provider's endpoint.
5. **The accounts block.** The block at the top of the sessions panel shows per account the windows sent, with the used share and the reset, and highlights a limited account. Demo: the headless workbench shows a Codex account's weekly window with its share and reset, and a limited account highlighted.
6. **Limited accounts refuse launches.** A limit-hit signal from any of the three harnesses marks the account limited until its reset, a launch on it is refused naming the reset, and the Coordinator's clause asks the human for another. Demo: a fake Codex `usageLimitExceeded` marks codex-a limited, the next launch on it is refused, and `cland account clear codex-a` lifts the mark.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with the fake harnesses and a scratch registry (two Claude Code accounts, two Codex accounts, one OpenCode account, under an `XDG_CONFIG_HOME` of QA's own), QA pins the Reviewer role to codex-b, launches a Reviewer and a Claude session on claude-b, and reads in the fakes' recorded environments that every adapter process for each session ran in its account's directory. The fakes push limits; `cland account list` and the headless workbench's accounts block show the windows each source sent, and the OpenCode account shows no limit data. An idle account is polled once through its harness within 15 minutes. A fake `usageLimitExceeded` marks codex-a limited and highlighted; the next launch on it is refused naming its reset; `cland account clear` lifts the mark. No launch moves to another account by itself.

- [ ] `~/.config/cland/accounts.toml` holds names and paths only; `roles.toml` and launches name accounts; the account is recorded on the session and shown on its row.
- [ ] Every process the adapter starts or queries for a session, `agents --json` included, runs in the account's environment.
- [ ] Limits come from running sessions first, and idle accounts are polled at most every 15 minutes through the harness only; no code path calls a provider's endpoint with a token cland reads.
- [ ] The sessions panel opens with the accounts block: per account, the windows the source sent with the used share and the reset time; a limited account is highlighted; OpenCode shows no limit data.
- [ ] A limit-hit signal from any of the three harnesses marks the account limited and refuses new launches on it; nothing fails over, rotates or picks another account by itself.
- [ ] The Claude adapter polls `claude agents --json` at most once per 30 seconds per config directory, and a logged-out directory gives one event and one message to the human with no retry storm (T-265).
- [ ] `hub/README.md`, `nvim/README.md`, the Coordinator's clause and `cland init`'s defaults describe accounts, limits and the limited mark.

## Dogfooding

The crew's own launches name their accounts from this epic on: the human writes the registry once with the accounts they use, the Coordinator pins the roles to them in `roles.toml` with the human, and the accounts block shows the build's own spend against the weekly windows.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **Terms.** The providers' terms forbid rotating accounts and using several accounts to get past a limit, and Anthropic's forbid a third party holding Claude.ai tokens (research section 5.6). cland reads no token, calls no usage endpoint itself, and never moves work to another account.
- **Risks.** claude-code#95822: short-lived `claude` commands near a token's expiry can log a config directory out, which is why T-265 lands first and idle directories are never polled with `agents --json`. Each account's directory keeps its own trust and MCP state, so a project's first launch under a new directory may meet the trust dialog.
- **Order.** Fifth in the hub lane, after "Remote executors"; "Release v0.1.2 from the item" waits for it.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.13 Accounts and limits.
- Tickets: T-240 (decided, closed into this epic); T-265, a child of this epic.
- Branch: `research/account-limits` (`docs/research/account-limits.md`, section 5; the probes in `docs/research/account-limits/`).
- GLOSSARY: Harness, Adapter, Session, Role.
- Upstream: anthropics/claude-code#95822.
