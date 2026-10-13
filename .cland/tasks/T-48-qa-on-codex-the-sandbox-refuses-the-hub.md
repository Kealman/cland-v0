---
id: T-48
kind: task
title: "Codex sessions launched by cland: approvals auto-approved and a per-role
  sandbox, so no check or commit waits on the human"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: impl-48
parent: E-19
blocked_by: []
topic: topic-2
branch: t/T-48-codex-qa-sandbox
created: 2026-10-08T19:48:52.717Z
updated: 2026-10-10T00:58:17.540Z
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

### rev-1 · 2026-10-09T07:33:28.387Z

verdict: review
result: clear
by: rev-1 [reviewer]
run: rev-2026-10-09-T48-2

Second review: full change 439b623a1673c8334fb1b8e6b6e0919fd4ebc5b3...da6cd3dde7107a12909d435d7be90f683148fe62; fix 801fcb9 and merge da6cd3d inspected separately. Prior medium finding rev-2026-10-09-T48-1 is closed.

Standards: no documented violations or actionable baseline smells.

Spec: no remaining findings. Existing role launch tables now inherit built-in approval/sandbox/writable_roots/network values per omitted key. Written approval/sandbox empty strings opt out as requested. Incompatible inherited roots are dropped for read-only; inherited local network is preserved where valid; danger-full-access uses full network. Coordinator launch defaults remain unchanged. Parser tests exercise legacy tables, per-key overrides, opt-outs and incompatible combinations, with updated README and both roles headers.

Merge review: Codex retains SessionUsage/codexCounts and total/last usage fields together with path helpers, TOML profile overrides and launch/relaunch policy threading. contract.ts and protocol.ts retain both usage and policy types; the fake retains usage notifications and policy assertions. T-45 cwd resolution and invalid-cwd refusal remain intact. No .cland/tasks files or unrelated T-49/T-50 scope in the diff.

Evidence limits: Implementer reports clean typecheck and 253 hub + 62 Neovim passes after the merge. Earlier real-Codex evidence and its limitations remain as recorded in the item and first review. This review ran no tests and edited no files.

Totals: Standards 0 findings; Spec 0 findings. Nothing high or medium remains.

### qa-2 · 2026-10-09T07:42:02.352Z

verdict: qa
result: clear
by: qa-2 [qa]
run: qa-2026-10-09-T48-1

Checked branch t/T-48-codex-qa-sandbox at da6cd3dde7107a12909d435d7be90f683148fe62. No source changes or fixes; worktree stayed clean.

What I ran and observed:
- With /Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin first on PATH, ran `npm run typecheck && npm test` once in the assigned worktree: exit 0; hub 253 passed, 0 failed, 0 skipped; Neovim 62 passed, 0 failed, 0 skipped. The Neovim harness uses nvim_input and screenstring().
- `node --test hub/test/codex-adapter.test.ts hub/test/roles.test.ts`: exit 0; 10 passed, 0 failed, 0 skipped. Read the assertions for per-role thread/start approvalPolicy and permissions, app-server -c default_permissions/permissions.cland/features.network_proxy, launch/relaunch, writable git directories, PATH, key-by-key defaults, overrides and empty-string opt-out. Also directly parsed bare launch tables for Implementer, Reviewer and QA: each inherited the documented approval/sandbox/network defaults.
- `node hub/bin/cland.ts task list --state open --json` and `task view T-48 --json`: exit 0 and T-48 present; also read the item through task.view.
- Cloned the requested branch into $TMPDIR/qa48.c1aYpL, npm ci (exit 0), copied the pinned Neovim cache, unset CLAND_HUB_FILE for scratch commands, initialized and started its own hub, and created branch probe in .cland/worktrees/p. `role list` showed Implementer never/workspace-write/writable ./local and QA never/workspace-write/local.
- Launched real Codex p1 (Implementer, gpt-6.1-sol) and p2 (QA, gpt-6-astra) through that hub. Inspected ps argv: both had the named cland profile and proxy enabled; p1 explicitly granted the scratch root, .git and .git/worktrees/p write access; p2 had no filesystem additions. Both denied the app-server socket directories. Sent one proof message to each through authenticated UI topic.send after its clause was idle; ran their proofs sequentially and preserved each one's files.
- p1: Node v24.21.0, typecheck + npm test exit 0; hub 247 passed/0 failed/6 skipped and Neovim 62 passed/0 failed/0 skipped. `cland inbox` from the worktree with CLAND_HUB_FILE unset exited 0. `git commit --allow-empty -m "probe: a commit from the sandbox"` exited 0; independently verified commit 79e6822 in its git log.
- p2: Node v24.21.0, typecheck + npm test exit 0; hub 247 passed/0 failed/6 skipped and Neovim 62 passed/0 failed/0 skipped. The same worktree inbox command exited 0. No QA commit attempted, as requested.
- Each sandboxed suite printed all six expected skip reasons: five tests require ps for pid identity (Claude stop fallback, Codex restart/resume, two daemon stop/stale-lock checks, OpenCode launch); the sixth requires macOS sandbox-exec. These skips are reported separately from passes.
- Both sessions attempted curl https://example.com once. Codex refused each with `Network access to "example.com" was blocked: domain is not on the allowlist for the current sandbox mode.` It aborted the tool before shell echo, so neither call exposed a numeric curl exit code or literal proxy 403. External refusal is verified; the brief's exact 56/403 is not independently established, and I did not retry the command.
- 235 session-list observations plus subscribed state events showed no waiting-for-approval state. The complete scratch hub log contained zero harness-request entries and zero `"state":"waiting for approval"` entries.
- Read docs/review-and-qa.md, hub/README.md launch/adapter sections and ADR 0003: role allowances, skip reasons, app-server-only overrides, inheritance and dated amendment match the observed behavior and test assertions. The root-is-itself-a-linked-worktree limit is documented and matches the implementation; that separate configuration was not exercised live.
- Stopped p1, p2 and the scratch hub; ps confirmed all three recorded PIDs gone. The monitoring client exited on hub shutdown. Did not start/stop or reconfigure the project's own hub.

Findings ranked by severity: high none; medium none; low none. Evidence limit: curl's exact exit 56/proxy 403 was suppressed by Codex's tool-level refusal, as described above.

Evidence files: /tmp/qa-T48-full.log, /tmp/qa-T48-targeted.log, /tmp/qa-T48-task-list.json, /tmp/qa-T48-task-view.json, /tmp/qa-T48-p1-probe.txt, /tmp/qa-T48-p1-npm.log, /tmp/qa-T48-p2-probe.txt, /tmp/qa-T48-p2-npm.log, /tmp/qa-T48-p1-argv.txt, /tmp/qa-T48-p2-argv.txt, /tmp/qa-T48-state-observations.log, /tmp/qa-T48-state-events.log and /tmp/qa-T48-scratch-hub.log. Scratch root path is in /tmp/qa-T48-scratch-path.

### coord · 2026-10-09T07:44:37.215Z

Merged into main as 4490cf7 (`git merge --no-ff`, by the Coordinator) at 07:43Z; on main after the merge: typecheck clean, 253 hub + 62 Neovim tests pass. Verdicts: review not clear rev-2026-10-09-T48-1 (07:17:23Z, one medium: a legacy launch table inherited no role defaults), fix 801fcb9 (key-by-key inheritance, `""` opt-out, mode compatibility), main merged twice (86eacda, da6cd3d), review clear rev-2026-10-09-T48-2 (rev-1, 07:33:28Z); qa clear qa-2026-10-09-T48-1 (qa-2, 07:42:02Z: suite on the branch, the adapter and role tests, and the real-Codex proof on a scratch clone's hub: an Implementer session p1 and a QA session p2 launched under the new defaults ran Node 24, typecheck and the suite (247 pass, 6 documented skips, Neovim 62), `cland inbox` from inside a worktree, and for p1 a commit (79e6822 in the scratch log), with both outside requests refused by the proxy's allowlist and no approval wait or request in 235 session-list samples and the hub log; evidence limit: Codex suppressed curl's exit code, so the 56/403 figures were not observable). Timeline: launched 06:20:54Z, rescoped 06:25Z, implemented 07:03Z, review loop 07:08Z to 07:33Z (rev-1's spoke replaced mid-review, T-51, cost about 10 minutes), QA 07:31Z to 07:42Z, merged 07:43Z: about 82 minutes from launch to merge. Not pushed. Still open: the closing evidence on this project's own hub, after the hub restarts on 4490cf7 (the stand-in is asked first): a fresh Codex session launched under the defaults runs the suite and `cland inbox` with no approval.

### coord · 2026-10-09T07:57:23.486Z

Closing evidence on this project's own hub: after the restart on main 59043fa at 07:47Z (`cland role list`: Implementer approval never, sandbox workspace-write, writable `.`, network local; QA the same without writable roots; Reviewer read-only, no network), qa-3 (Codex gpt-6-astra, launched at 07:48Z in the T-49 worktree through `cland session launch --cwd` with the QA defaults; its app-server's command line carries `-c default_permissions="cland"`, `-c permissions.cland={…}` and `-c features.network_proxy=true`) ran, with no approval asked and no `waiting for approval` at any time: `node --version` v24.21.0 (the hub's Node first on PATH), `npm run typecheck && npm test` in the worktree (hub 251 passed, 7 documented skips on the `ps` refusal, the sandbox-exec one and the identity test's stop, 0 failed; Neovim 62 passed), main's `cland inbox` from inside the worktree against this hub (exit 0), and a `git commit` probe refused on `index.lock` (exit 128) as designed for QA. The Implementer side (a commit from a worktree without an approval) was shown by qa-2's probe p1 on the scratch clone (79e6822) and by impl-48's own runs. All four acceptance criteria met: the fake app-server test asserts the thread/start params and overrides per role; the real Codex shows the suite, `cland inbox` and the commit without an approval; docs/review-and-qa.md and hub/README.md document the sandbox and the keys; the suite passes. Merged as 4490cf7 at 07:43Z; closed 07:53Z. Follow-ups elsewhere: T-50 (lost steer), T-51 (replaced spoke), and the ghost-identity wording from T-49's QA (low, unfiled).
