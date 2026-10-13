---
id: T-361
kind: task
title: "The accounts registry: ~/.config/cland/accounts.toml names each account's harness and directory, roles.toml and cland session launch --account pin one, the session records it, and Codex and OpenCode run every process in its environment"
state: open
status: planned
size: L
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-272
blocked_by: []
topic: null
branch: null
created: 2026-10-13T23:42:53.266Z
updated: 2026-10-13T23:43:18.837Z
---

## Summary

cland gets a user-level accounts registry that holds names and paths only, and a launch can name an account: `account = "<name>"` under `[<role>.launch]` in `roles.toml`, or `cland session launch --account <name>`. The account is recorded on the session and in the journal, and every process the Codex and OpenCode adapters start for that session runs with the account's variable (`CODEX_HOME`, `XDG_DATA_HOME` or `OPENCODE_DB`). Claude Code accounts follow in ticket T-362, because the Claude adapter's polling is reworked first (T-265).

## Parent

E-272: Accounts and limits, tracer bullet 2 of 6, the Codex and OpenCode half. Ticket T-362 adds Claude Code. Spec: `docs/spec/v0.1.2.md` §3.13 ("The registry"), and the epic's "Choices where the spec is silent" (one name per role, never a list; `--account` overrides; an unknown name refuses and lists the known names; the path follows `XDG_CONFIG_HOME`). Research: `docs/research/account-limits.md` on `research/account-limits`, sections 5.1 (the registry, option A) and 5.2 (the launch environment per account). Decided in T-240.

## What to build

**The registry.** A new module, `hub/src/accounts/registry.ts`, reads `$XDG_CONFIG_HOME/cland/accounts.toml` when `XDG_CONFIG_HOME` is set and absolute, else `~/.config/cland/accounts.toml`. The shape follows research section 5.1:

```toml
[accounts.codex-b]
harness = "codex"
home = "~/.codex-b"          # CODEX_HOME

[accounts.claude-b]
harness = "claude-code"
config_dir = "~/.claude-b"   # CLAUDE_CONFIG_DIR

[accounts.oc-b]
harness = "opencode"
data_home = "~/.local/share/oc-b"   # XDG_DATA_HOME; or db = "…" for OPENCODE_DB
```

- Each account has a `harness` and at most one path key, the one that belongs to its harness: `config_dir` for `claude-code`, `home` for `codex`, and `data_home` or `db` for `opencode`.
- An entry with no path key names the harness's default (the directory the hub's own environment selects). At most one such entry per harness.
- `~` expands to the home directory. After expansion every path must be absolute.
- Any other key is refused, and the refusal names the key. The registry holds names and paths only, so a `token` or `api_key` key can never be added to it.
- Names are lowercase letters, digits and hyphens, starting with a letter or digit.
- A missing file means no accounts and is not an error. A malformed file refuses every launch that names an account and names the error. Launches with no account go ahead as today.
- The registry is read again at each launch, as `roles.toml` is (`roles.fresh`), so an edit applies to the next launch without a restart.

**Naming an account.**

- `hub/src/roles/config.ts` parses `account` under `[<role>.launch]`: one string, `""` meaning none. It is checked against the registry at launch, never at parse, because the registry is per machine.
- The role's account applies only when the launch's harness is the role's harness, like the role's `model` and `effort` today (`forHarness` in `#spawnLaunch`).
- The `session.launch` frame (`hub/src/adapters/requests.ts`), the spoke's `session.launch` tool (`hub/src/spoke/spoke.ts`) and `cland session launch` (`hub/src/cli/session.ts`, `SESSION_USAGE`) take `account`.
- A hand-given account with no `--harness` sets the harness. With a `--harness` of another harness, the launch is refused and the refusal names both.
- The effective account is the request's, else the role's, else none (the harness default, with no variable set by cland).

**Refusals**, each a plain error naming what is wrong:

- An unknown name: `unknown account "codex-x" (accounts: codex-a, codex-b, oc-b)`.
- A harness mismatch.
- A directory that does not exist. Codex refuses a missing `CODEX_HOME` itself, and a missing directory means the human never signed in there. The refusal names the path and the harness's own sign-in command, for example `CODEX_HOME=<path> codex login`.
- A Claude Code account, until ticket T-362 lands: the refusal says Claude Code accounts are not supported yet. Ticket T-362 removes this.

**The session's account.**

- `HarnessProcess` (`hub/src/adapters/contract.ts`) gains two fields. `account` is the name or null. `accountEnv` is the resolved overlay, for example `{ "CODEX_HOME": "/Users/x/.codex-b" }`, or null.
- Both are columns of the process table in `hub.db` (`hub/src/adapters/processes.ts`), with a migration that leaves older rows null.
- `HarnessProcessView` and `session.list` show `account`.
- `SpawnRequest` carries `accountEnv`.
- A relaunch (`session.resume --relaunch`), a hub-restart resume and a retained pool handoff (`#reuse`, `resumeConversation`) take the row's account and overlay, never the role's current account. Work never moves to another account.
- A pool member is reused only when its account equals the request's effective account.

**The journal.** `session-launched` and `session-usage` (`hub/src/hub/core.ts` `#recordUsage`) carry `account`.

**The adapters.**

- Codex (`hub/src/adapters/codex.ts`): the overlay goes on the `codex app-server` spawn environment and on the `codex --version` probe. The attach command is prefixed with it: `CODEX_HOME=<path> codex resume --remote …`.
- OpenCode (`hub/src/adapters/opencode/server.ts`): the overlay goes on the `opencode serve` environment, beside `OPENCODE_CONFIG` and `OPENCODE_PASSWORD`. The attach command carries it too.
- No adapter reads anything in the account's directory.

**`cland account list [--json]`.** A new file, `hub/src/cli/account.ts`, wired in `hub/bin/cland.ts`, and an `account.list` frame (`hub/src/protocol.ts`, `dispatch.ts`). It returns `{registry, error?, accounts: [{name, harness, path | null, variable}]}`, and the text form prints one line per account. It reveals names and paths only, so the human and every role session's shell may read it. Ticket T-363 adds the windows.

**Fakes.**

- `hub/test/fakes/codex/fake-codex.ts` adds `CODEX_HOME` to its `servers/<pid>.json` record. It records only `CLAND_*` variables today.
- `hub/test/fakes/opencode/fake-opencode.ts` records `XDG_DATA_HOME` and `OPENCODE_DB` per server.

**Docs.** A new "Accounts" section in `hub/README.md` covers the registry, its path and shape, `account` in `roles.toml`, `--account`, the row's `account` and the refusals.

**Demo** (the epic's words, Codex half). `cland session launch rev-x --role reviewer --account codex-b` runs its `codex app-server` with codex-b's `CODEX_HOME`, and `cland session list --json` shows the account.

**Out of scope.** Claude Code accounts and the per-directory poll (ticket T-362). Limits (tickets T-363 and 04). The accounts block and the row's meta line (ticket T-365). The limited mark (ticket T-366). Signing in, which stays each harness's own flow, done once by the human.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fakes in `hub/test/fakes/` come second, launched through `session.launch`.
- Every test writes a scratch registry under an `XDG_CONFIG_HOME` of its own, passed to the daemon's environment. No test reads or writes `~/.config/cland`, and no test touches a real account's directory.
- No new seams inside the hub. New helpers go in the test file or a new helper module, never in `hub/test/harness.ts`. Classify new test files in `hub/test/shards.json`.
- Read `hub.log` and `journal.jsonl` only after the `flushLogs` barrier (T-291).
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. With a scratch registry holding codex-a and codex-b, `cland session launch rev-x --role reviewer --account codex-b` starts its `codex app-server` with codex-b's `CODEX_HOME` (the fake's `servers/<pid>.json`), and `cland session list --json` shows `account: "codex-b"` on rev-x.
- [ ] C2. `account = "codex-b"` under `[reviewer.launch]` pins a Reviewer launch with no `--account` to codex-b; `--account codex-a` overrides it; a `--harness opencode` launch of that role takes no Codex account; a role with no `account` runs with `account` null and no account variable set by cland.
- [ ] C3. An unknown name is refused, listing the known names. A harness mismatch with `--harness` is refused, naming both. A Codex home that does not exist is refused, naming the path and the sign-in command. A malformed registry refuses launches that name an account, while launches with no account go ahead.
- [ ] C4. The registry refuses an unknown key (naming it) and two path-less entries of one harness, and expands `~`. The file path follows `XDG_CONFIG_HOME` when it is set, and an edited registry applies to the next launch without a hub restart.
- [ ] C5. OpenCode launches on an account with `data_home`, and on one with `db`, start `opencode serve` with that `XDG_DATA_HOME` or `OPENCODE_DB`, as the fake records. The attach commands of Codex and OpenCode sessions on an account carry the account's variable.
- [ ] C6. A relaunch, a hub-restart resume and a retained pool handoff keep the row's account and recorded directory, even after the role's `account` in `roles.toml` changed. A pool member on another account than the request's effective one is not reused.
- [ ] C7. After the `flushLogs` barrier, the `session-launched` and `session-usage` journal records carry `account`.
- [ ] C8. `cland account list` prints each account's name, harness and path (or "harness default"), and `--json` gives the same. A launch naming a Claude Code account is refused with a message that Claude Code accounts are not supported yet.
- [ ] C9. `hub/README.md` describes the registry, its path and shape, `account` in `roles.toml`, `--account`, the row's `account` and the refusals.
