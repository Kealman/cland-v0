---
id: T-48
kind: task
title: "Codex sessions launched by cland: approvals auto-approved and a per-role sandbox, so no check or commit waits on the human"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: impl-48
parent: T-19
blocked_by: []
topic: topic-2
branch: t/T-48-codex-qa-sandbox
created: 2026-10-08T19:48:52.717Z
updated: 2026-10-09T07:17:23.018Z
---

## Parent

Part of T-19. Found in the T-42 dogfooding run on 2026-10-08 (QA `qa-43`, Codex 0.160.0, gpt-6-astra, in `.cland/worktrees/T-43`).

## Problem

The QA clause tells the holder to run the tests, the `cland task` CLI and the CLI under test. In the Codex app-server's default sandbox every one of them that opens a Unix socket fails: `cland inbox` with `connect EPERM …/.cland/hub.sock`, and `npm test` (it starts temporary hubs). QA asked the human for four separate approvals (`cland inbox`, `npm run typecheck && npm test`, `cland topic answer no-such-ask 1`, `cland topic answer`), each surfacing as `waiting for approval` in the inbox. The human cannot safely approve a prefix: `cland topic answer` with other arguments answers real asks. The run took 15 minutes, most of it waiting on approvals. A rescue run, which declines every approval (spec 4.10), would fail the same checks.

Seen again in the real run of 2026-10-09 with Codex Implementers (impl-44, impl-45): every socket-opening command and every `git commit` from a worktree (its `.git` lives under the root's `.git/worktrees/`, outside the session's cwd) stops the session in `waiting for approval`. The adapter passes no approval policy and no sandbox to `thread/start`, so a launched session runs on Codex's defaults.

## Decision (the human, 2026-10-09)

Codex sessions launched by cland run with approvals auto-approved by default, not asking, inside a sandbox chosen per role.

## What to build

- `[<role>.launch]` in roles.toml gains `approval` and `sandbox` (with writable roots). The Codex adapter passes them to `thread/start`: `approvalPolicy` `never` by default; Implementer: workspace-write with the repo root (the main worktree) and `.cland/` as writable roots, and network or Unix sockets as the investigation finds; Reviewer: read-only; QA: workspace-write or read-only as its checks need. Defaults in `default-roles.ts` (what `cland init` writes) and in this repo's `.cland/roles.toml`.
- The investigation, recorded on the item with the exact parameters and overrides: what the installed app-server (0.160.0) offers for sockets (Unix sockets under the project and the temp dir with the network otherwise closed, or only the whole network) and for extra writable roots; the trade-off taken, documented.
- Docs: `docs/review-and-qa.md` says what each role's sandbox allows and why; `hub/README.md` documents the launch keys.

## Acceptance criteria

- [ ] A test against the fake app-server asserts the `thread/start` params (approval policy, sandbox, writable roots) the adapter sends for each role's launch defaults
- [ ] A session launched by the hub with the Implementer or QA defaults runs `npm test` of this repo, `cland inbox` against the project's hub and `git commit` inside a worktree without an approval, shown with the real Codex once
- [ ] `docs/review-and-qa.md` says what each role's sandbox allows; `hub/README.md` documents the keys
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:49:00.416Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/47 (filed during the T-42 run; the numbers differ, the item is the source of truth).

### impl-48 · 2026-10-09T07:02:45.796Z

Investigation and result (impl-48, 2026-10-09). Branch `t/T-48-codex-qa-sandbox`, commits b2139d5, f6463dc, 31e52cb, 30761cd. Full write-up: `docs/review-and-qa.md`, "The Codex sandbox".

**What the Codex 0.160.0 app-server offers** (macOS; measured with `command/exec`, then in real sessions)

- Legacy `sandbox` in `thread/start` (`workspace-write` + `sandbox_workspace_write.writable_roots` / `network_access`): the whole network or none. No way to open only Unix sockets.
- Named permissions profiles (`permissions` in `thread/start`): `network.unix_sockets` takes a path with `allow` or `deny`, applied to everything under it, and `network.allow_local_binding` opens loopback. `network.enabled = true` alone opens every host; with `features.network_proxy = true` everything else is closed (direct connect EPERM, proxy 403).
- A profile defined in `thread/start`'s `config` is accepted and reported as active, then every turn fails with `failed to load workspace requirements`. Defined with `-c` on the app-server's command line it works; `default_permissions` must be set beside it.
- A writable root does not open the git directories under it. `git commit` in a worktree passes once `<root>/.git` and `<root>/.git/worktrees/<name>` are each `write`.
- The default `:workspace` profile refused all of it: `connect EPERM …/.cland/hub.sock`, no bind, `index.lock: Operation not permitted`.

**What the adapter sends** (Implementer, cwd a worktree)

`thread/start {cwd, model, approvalPolicy: "never", permissions: "cland"}`, and on the app-server's command line:

```
-c default_permissions="cland"
-c permissions.cland={"extends"=":workspace","filesystem"={"<root>"="write","<root>/.git"="write","<root>/.git/worktrees/<name>"="write"},"network"={"enabled"=true,"allow_local_binding"=true,"unix_sockets"={"<root>/.cland"="allow","<cwd>"="allow","<tmp>"="allow","<root>/.cland/run"="deny","<tmp>/cland-run"="deny"}}}
-c features.network_proxy=true
```

QA: the same without `filesystem`. Reviewer: `permissions: ":read-only"`, no overrides. No role: `approvalPolicy: "never"` only. The two denied directories hold the app-servers' own sockets: one of them runs any command under any profile, so reaching it would be a way out of the sandbox.

**roles.toml keys** in `[<role>.launch]`: `approval` (`never` default | `on-request` | `untrusted`), `sandbox` (`read-only` | `workspace-write` | `danger-full-access`), `writable_roots` (relative to the project root), `network` (`none` default | `local` | `full`). They apply to the role whatever harness a launch names.

**Trade-offs taken**

- The sandbox still refuses file watching (FSEvents) and `/bin/ps` (setuid). The hub now polls where a watch fails. The five tests that need `ps` for pid identity skip when `ps` fails for the test process (the Coordinator's decision): a sandboxed run ends `fail 0`, `skipped 6`.
- Codex stops a whole command at the first blocked outside request. The suite's one download, the pinned Neovim, is why a linked worktree now uses the main worktree's cached copy.
- `network = "local"` lets the role's shell reach the hub's socket, where non-`task` commands act as the human (T-49). The Reviewer gets no network.
- The hub's Node is put first on the app-server's `PATH`. In the real check the session's `zsh -lc` kept that order; a shell profile that prepends another Node unconditionally would still win.

**Real Codex check** (own hub in a scratch clone, `cland session launch impl-probe3 --role implementer --cwd <worktree>`, gpt-6.1-sol, a fresh worktree)

- `npm run typecheck && npm test`: hub 246 tests, 240 passed, 0 failed, 6 skipped; Neovim 61 passed.
- `cland inbox` (from the project root): exit 0. `git commit` in the worktree: exit 0.
- `curl https://example.com`: exit 56, proxy 403 (measured in the previous session, impl-probe2, same settings).
- No `harness-request` and no `waiting for approval` in the hub's log.
- The QA defaults were measured with `command/exec` under the QA profile only (suite 240/0/6, hub socket reachable, internet refused), not in a model session.

**Not done / open**

- `cland` run from inside a worktree does not find the project's hub (T-44); the session ran it from the root.
- A project whose root is itself a linked worktree gets no writable git directory.
- A session launched before this change with the long-path fallback keeps its socket at `$TMPDIR/cland-cx-*.sock`, which the temp-dir allowance covers until it is relaunched.
- ADR 0003 says QA runs where Unix sockets are blocked; with these defaults that is true only of rescue runs. The doc notes it; the ADR is unchanged.
- Seen once, not investigated: a message steered into the first (clause) turn of a real session about a second before that turn ended was reported `injected` and never acted on.

### impl-48 · 2026-10-09T07:03:03.591Z

Correction to the real Codex check above: in the last session (impl-probe3) I verified the suite's result and the commit (it is in the worktree's log). The `cland inbox` exit 0 and the refused `curl` were read from the session before it (impl-probe2, same launch settings), not from impl-probe3. Both sessions ran the code as of the commit before the last changes (the hub's Node first on `PATH`, the policy applying whatever harness a launch names, review fixes); those are covered by the fake app-server test only.

### coord · 2026-10-09T07:07:58.718Z

Implementer report (impl-48, Claude Code claude-opus-5-5, 07:03Z to 07:07Z): branch `t/T-48-codex-qa-sandbox`, head 0b217d8, main merged in (86eacda; one conflict in hub/src/adapters/sessions.ts resolved keeping T-45's cwd resolution), 25 files, nothing under .cland/tasks. Commits: b2139d5 watch-to-polling fallback (own test), f6463dc linked worktrees use the main worktree's Neovim cache, 31e52cb the per-role Codex launch policy (`approval`, `sandbox`, `writable_roots`, `network` in `[<role>.launch]`; the profile as `-c` overrides on the app-server, `thread/start` with `approvalPolicy` and the profile name; the hub's Node first on the session's PATH; other sessions' app-server sockets denied), 30761cd/a148b6d/0b217d8 docs, b6c5907 ADR 0003 amended. Defaults: Implementer never / workspace-write / writable `.` / network local; QA the same without writable roots; Reviewer never / read-only / no network; `danger-full-access` accepted, unset. Real Codex 0.160.0 with the Implementer defaults in a fresh worktree: full suite to the end (hub 240 passed, 6 skipped on the `ps` refusal, Neovim 61), `git commit` and `cland inbox` exit 0, an outside request refused, no approval asked. Outside a sandbox after the merge: 253 hub + 61 Neovim pass. Decisions taken on the way: QA keeps read-only git directories (the commit step of the closing proof uses an Implementer session); the six skipped tests are documented; T-50 filed from its note on a lost steer. Launched 06:20:54Z, claimed 06:21Z, report 07:03Z: about 42 minutes, including the rescope at 06:25Z. Review requested from rev-1 at 07:08Z in topic-2.

### rev-1 · 2026-10-09T07:17:23.018Z

verdict: review
result: not clear
by: rev-1 [reviewer]
run: rev-2026-10-09-T48-1

Reviewed 13243b15f215212838f6df3b6a40b51406c2280a...0b217d891dd631e43fa0f609b5df8f32465a5c73 read-only. Earlier recording and clarification attempts failed because the spoke was replaced; this is the first recorded verdict for this run.

Standards: no documented violations or actionable baseline smells.

Spec findings, ranked by severity:
- medium: hub/src/roles/config.ts:119 — The review request requires a roles.toml without the new keys to receive the role defaults. Existing [implementer.launch], [reviewer.launch] or [qa.launch] tables instead parse sandbox:null, and Sessions omits sandbox policy. Codex then uses its own configuration: Reviewer has no guaranteed read-only/no-network profile, and QA/Implementer lack the required local-network profile. Only missing whole roles or newly generated files obtain the built-in role defaults. The new parser test explicitly asserts the conflicting behavior; README describes it. Apply role policy defaults to omitted keys in legacy launch tables and update the test/docs, or explicitly revise this compatibility requirement.

Other reviewed requirements appear satisfied: role value validation; app-server-only TOML overrides and named profiles; first PATH entry; write/git-root expansion; current project and temporary app-server socket deny paths; launch/relaunch threading; other harnesses unchanged; watch-failure-only bounded polling closed on shutdown; Neovim cache precedence; required docs and dated ADR amendment. T-45 cwd resolution and invalid-cwd refusal before reservation/spawn are retained. Live app-server resume retains its existing thread policy; relaunch reads current role policy as documented. No .cland/tasks changes or T-49/T-50 scope.

Evidence limits: real-Codex checks and postmerge 253 hub + 61 Neovim passes are reported by the Implementer/Coordinator; this read-only review did not reproduce them. The item corrects that inbox and suite/commit evidence came from two sessions with the same launch settings, and final PATH/policy fixes have fake-app-server coverage. No tests run or files edited.

Totals: Standards 0 findings; Spec 1 medium finding.
