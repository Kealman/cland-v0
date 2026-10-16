---
id: Q-593
kind: question
title: "Harness setup facts: install, login, trust and accounts for Claude Code, Codex and OpenCode"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.240Z
updated: 2026-10-16T12:09:27.220Z
closed: 2026-10-16T12:09:27.220Z
---

## Question

What does `cland setup` need to know about each harness? For Claude Code, Codex and OpenCode: the non-interactive install command and what it needs, the version check, the login flow and whether it can run inside a wizard step, the auth status command's output and which fields identify the account for `~/.config/cland/accounts.toml`; the first-run folder trust (Claude Code's dialog that turns `claude --bg` into a refusal: T-24, T-58, D36; Codex's folder trust: T-42; OpenCode's, if any) and a deterministic way to grant it from setup (config files, flags) or, failing that, the cheapest interactive step; and what an Aide in a plain terminal is: `claude --bg` plus `cland session attach` against a foreground harness started with the spoke environment (CLAND_SESSION_NAME), with the delivery and acknowledgement differences (hub/README.md 83-91, 129, 960). Try each in a scratch folder on this machine, without changing the trust of real projects and without printing secrets. Deliver `docs/research/harness-setup.md` on research/harness-setup with a per-harness table and the resolution comment here.

## Comments

### human · 2026-10-16T12:09:27.117Z

## Resolution

Document: `docs/research/harness-setup.md` on research/harness-setup (eb985104). All probes ran in scratch homes; no real trust, login or config changed.

Per harness:
- Claude Code 2.1.301, in range (>=2.1.294 <2.2.0). Install `curl -fsSL https://claude.ai/install.sh | bash [-s <version>]` (auto-updates). Login `claude auth login`, a blocking command a setup step can run and re-check. Status `claude auth status --json`: loggedIn, authMethod, apiProvider, configDirectory, projectsDirectory, and when signed in email, orgId, orgName, subscriptionType; exit 0 or 1.
- Codex 0.163.0, outside the tested range (>=0.160.0 <0.161.0; its updater left the range on 2026-10-09). Install `curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh -s -- --release <version>` (a pinned release stops its scheduled updates). Login `codex login`, `--device-auth` or `--with-api-key`. `codex login status` prints one line with no identity; the app-server's `account/read` gives type, email, planType.
- OpenCode 2.0.24, in range. Install `curl -fsSL https://opencode.ai/v2/install | bash -s -- --version <version>`. Login optional for the free model: `OPENCODE_DB=<cland db> opencode auth login --standalone`. `auth list` JSON connections are `{type:"credential", id, label, method}` or `{type:"env", name}`; doctor counts environment keys as credentials, which is wrong.
- `accounts.toml` keeps names, harnesses and paths only; the identity fields serve display and duplicate warnings.

Trust:
- Claude Code: a documented, deterministic grant, `projects["<realpath of the repo root>"].hasTrustDialogAccepted = true` in `~/.claude.json` (or `$CLAUDE_CONFIG_DIR/.claude.json` when the launch sets the variable), written under Claude's `<file>.lock` with a temp-file rename. The root entry covers subfolders and linked worktrees; a nested repository needs its own entry.
- Codex never blocks the app-server launch; only the first `codex resume --remote` attach in a folder asks, for the exact `--cd` folder unless the project has `.codex/`. Grant: `projects."<folder>".trust_level = "trusted"` through a short-lived app-server's `config/batchWrite`.
- OpenCode has no trust gate.
- T-603 stands: unpinned Claude launches run a separate profile, untrusted and signed out, which explains D36; a path-less claude-code registry entry has the same problem.

The Aide in a plain terminal: a normal hub launch (role aide, harness, brief), then setup runs the harness's own attach command with the terminal (`cland session attach` only prints it). Detaching leaves the session running. A harness started by hand with CLAND_SESSION_NAME is not a session: messages arrive only as channel notifications behind `--dangerously-load-development-channels server:cland`, never reach `injected`, its state stays unknown, nothing resumes it.

Follow-ups for the cut: doctor's Codex range (0.163.0 today), doctor's environment keys counted as credentials.
