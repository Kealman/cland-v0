# Stage QA brief: E-1532 stage 4 — harnesses and git on hosts

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers; always brace a variable before `:`). The run is local, on macOS (BSD `stat -f`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`, the pinned Neovim of `node nvim/bin/nvim-path.ts`). No check here is Linux-only: every named file and scratch row runs on this macOS run, and a platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, key or network (R-1530's QA rule):** the carrier runs only through the fake `ssh` and `scp` stand-ins of `hub/test/fakes/` against fake hosts made by the build's own `createFakeHost` (`hub/test/fakes/fake-host.ts`); the scratch hub's two hosts are fake hosts on this Mac, whose agents are the build's `cland host serve` run by the shipped supervisor as local processes. **No real harness:** Codex, OpenCode and Claude Code run only as the build's fakes and scripted fakes inside the named files; no session is launched by the scratch rows. No browser, no GUI.

## Corrections folded in from earlier E-1532 runs

This brief is new. It carries the corrections QA and review found in the E-1532 stage-2 and stage-3 runs and the E-1536 and E-1538 runs:

- **The seal.** Every scratch launch is built by `seal.mjs`: first the sealed builder, `scratchGitEnvironment(Q, fixtureEnvironment(Q, base), {excludesFile})` (`test-support/fixture-environment.ts:13` and `:82`); then this run's overlays (`PATH`, `TMPDIR`, the `QA_*` roots and the launch's own `CLAND_*`/`FAKE_*` inputs) applied **after** that builder, so the builder's filters can neither drop nor rewrite them; then the credential prefixes removed. Nothing is added after `seal()` returns: no `env` prefix, no `export`, no spread of `process.env`. Overlay names outside `CLAND_`, `FAKE_` and `QA_` are refused by the seal.
- **The sealed `PATH`** drops every entry under the real HOME (read from the OS user record, not from `HOME`) and every `~`-relative entry, except the running Node's own `bin` directory: `~/.opencode/bin`, `~/.local/bin` and the like never reach a scratch process. S0 proves `claude`, `codex` and `opencode` resolve to nothing on the sealed `PATH`. Host-side CLI runs (`launch.mjs hostcli`) carry the `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN` and `CLAND_OPENCODE_BIN` fake overrides through the seal, and the scratch hub also carries `CLAND_SSH_BIN` and `CLAND_SCP_BIN`.
- **Neovim**, where any process looks for it, is the build's pinned release (`node nvim/bin/nvim-path.ts`, v0.12.5), first on the sealed `PATH`, never a Homebrew `nvim`. No row here needs Neovim.
- **The publication scanner** (`assertPublishable`, `.claude/skills/qa/qa-demo-policy.ts:25`) refuses the bare word that names the HTTP Authorization scheme when a word follows it (T-1665, open). This brief avoids that word; two named files print test titles that contain it (`hub/test/spoke-unix-edge.test.ts`, `hub/test/host-secret-admission.test.ts`), so their TAP logs are refused by design: see "Probes that mislead".
- **Process censuses** exclude the census process and all of its ancestors (the shell, the runner) and match only this run's `$Q`, alias and worktree paths; leftover-file checks ignore `node-compile-cache` (Node's own compile cache under `TMPDIR`).
- **macOS Unix socket paths** are measured with their NUL against 104 bytes. `$Q` is a `mktemp -d /tmp/q34-XXXXXX` realpath (23 bytes); named files run with `TMPDIR` at a root exactly as long as the suite's `/private/tmp/cland-suite-<36-char uuid>`.
- **Rule 22.** Ids are read back from listings and topic history, never from a `send` or create result: hosts from the hosts table, agent pids from the agent's own hello, the request and verdict ids from the epic topic's `history`. Every selector, test name and string is marked VERIFIED (read in source at a named commit) or INFERRED under "Source provenance"; an INFERRED expectation is never a pass condition on its own, and the run re-reads it at the tested build.
- **Record shapes** are cited from their producers, by file and line, under "Source provenance".
- **TAP.** Node's runner, given one file (`node --test <file>`), reports that file's registrations at the top level with a `1..N` plan and `# tests`, `# pass`, `# fail`, `# cancelled`, `# skipped`, `# todo` counters that include nested subtests; a file that registers nothing appears as a single `ok 1 - <file path>` wrapper. Names escape `#` and `\` as `\#` and `\\`; an unescaped ` # ` starts a SKIP or TODO directive. `tap.mjs` parses exactly that, and its checks replace hand-written `grep`.
- **Fake hosts on macOS** need `CLAND_FAKE_HOSTS` and `CLAND_HOST_BOOT_ID_FILE` in their agent's environment (`agentBootId`, `hub/src/host/agent/native.ts`), and the fake control `kill-agent` needs the same through the seal.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`, because many of them hold `$`, `{`, `(`, `?` or `.`.
- **No hub-side TCP for host traffic.** Unix sockets only, judged as `hub/test/transport-forwards.test.ts` does: a positive control first (a planted 127.0.0.1 listener the census must see), then the census of the host-side processes.

## Stage

- Epic: E-1532 (The SSH transport, the host agent and git through the tunnel, under R-1530).
- Exact stage name: harnesses and git on hosts.
- Items, in plan order: T-1603 (OpenCode sessions on a host, end to end), T-1606 (Codex sessions on a host), T-1607 (Claude Code sessions on a host), T-1604 (The host's clone and its worktrees from the territory), T-1605 (Host agent restart and version mismatch), T-1608 (The slim Linux spoke), T-1644 (Host atomic publish and append, and OpenCode's shared ignore through the Host). The run reads the stage's members, counts and state from `task plan show E-1532` (E1532S4-00), never from a number written here. Finding fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: affected. The stage's combined changed behaviour at the tested build:
  - T-1603: an OpenCode session launched with `host` naming a fake host starts `opencode serve` through that host's agent on a host loopback port; the hub's `OpenCodeClient` reaches it only through the session's per-session forward on a hub-side Unix socket (`machine.forward(sessionId, { port })`, refused unless the endpoint is a Unix socket); the generated MCP configuration starts the spoke from the Host layout with `CLAND_HUB_FILE` naming the host's discovery file, so the spoke reaches `spoke.sock` with the per-host secret; deliveries and `idle` after the turn work as locally; stop goes through the agent by identity before the forward is cancelled, and nothing on the hub's machine is signalled. Its decisions: the shared bounded `LaunchSettled` callback (from T-1606) for failed-launch cleanup; post-restart OpenCode forward settlement is T-1671, not this stage.
  - T-1606: a Codex session on a fake host runs its app-server through the agent with `--listen unix://` in the host's run directory; JSON-RPC connects only through the per-session forward; the thread policy's writable roots, `.git` directories and socket directories come from the Host layout and `Host.realpath` (including `/tmp`, canonicalized on the Host), never a hub path and never `danger-full-access`; configured absolute writable roots refuse remotely as hub-machine paths, a missing remote `runDirectory` refuses before any path lookup, an unresolved policy refuses naming the host; `--version` and stop go through the agent. Its decisions (coord 22:05Z, 22:19Z, 22:29Z on 2026-11-03): failed-launch recovery captures the admitted Host and cleans up only through it (a missing or revoked Host gives `cleanup-incomplete on host <name>`, never a local fallback; a planted local process with the same PID and a mirrored hub file survive); the shared `hub/src/adapters/launch-settlement.ts` (`LaunchSettled = () => void | Promise<void>`, bounded single flight, 5000 ms); the failed-launch settlement closes its native client exactly once (repair at 78d3d38b7); ADR 0008 records the host temp root.
  - T-1607 (landed on dev at `81f87619bed9824df766244d2fb2965363e2c292`; every expectation VERIFIED there): a Claude Code session on a fake host runs `claude --bg` through the agent with its `mcp.json` and `settings.json` in a private 0700 generation directory as 0600 files; the agent (capability `claude-launch-adopt-v1`) runs exactly one `agents --json`, pins the unique job, native session, PID, Linux birth and UID in a launch receipt, and adopts by generation only; hooks and the mod bridge reach the hub through the forwarded `hub.sock`; no short-lived `claude` command runs per poll; after a confirmed stop or rollback the private files and exactly the pinned job record are removed (sibling job records untouched) and a planted launch-credential scan of the host home, fake account and generation roots is clean; a stop during the turn-end hook's retirement settles without a manual re-stop; after a hub restart the role and row stay held until native settlement. Stop semantics at the landing (`docs/agents/host-agent.md`): one recapture budget belongs to each admitted stop, shared by the agent's outer capture comparison and the final pre-TERM helper, and a new admission starts a fresh one; a pinned member's positive exit or changed native birth settles that member without spending the budget or authorizing its replacement; a terminal PID observation owns one bounded native settlement (at most one stop command and one absence query) before exit is published, and a failed confirmation keeps the row, role and generation files with a cleanup-incomplete cause, retried once through re-adopt after a hub restart. Its decisions: coord 22:21Z (the job record is generation-owned; the account config root is agent-owned 0700 or the launch refuses), 4b7813f6/b00e4c85 (terminal released receipt, then forget), 3d3d176f (optional `HarnessAdapter.settleFailedLaunch`), 5d9f55ec/fbc7a350 (seven-day per-test duration allowances, owner C-216, for new Claude identities with a Linux sample of 4 s or more); revoke and remove settlement is T-1666.
  - T-1604: on a fake host the first task worktree clones the managed territory into `~/.cland-host/work/<12 hex>` through the git socket only (`origin` `git://cland/territory.git`, `core.gitProxy` set clone-locally to an atomically published 0700 `run/git-proxy` wrapper, an executable path holding no secret); a failed daemon clone falls back to a bundle over `scp` on the pinned master (`ProxyCommand=false`), with `origin` restored; an item launch creates the territory branch, grants that host its lease under the territory lock (`grantBranchLeaseLocked`) and adds the worktree at the territory's tip; a failed add leaves no lease and no launch-created branch; prune removes through the owning agent; the clone's `.cland/hub.json` copies the canonical discovery bytes at mode 0600. Its decisions (coord 22:13Z; 9dba07a1): clone work is off the carrier readiness path (the carrier is `up` while a clone is held; a project without a managed territory attempts no clone); records live in the additive `host_worktrees` table of `hub.db`.
  - T-1605 (not landed at writing: final head `27168d53a554937c6c6d117eec7624cff023815a`, in the merge queue, its branch containing dev through T-1607; every expectation VERIFIED at that head): the SSH Host reconnects after its agent restarts (`fake-host.ts kill-agent`), retrying acquisition every 500 ms, and re-reads the agent's process table and native receipts before serving; running rows keep their identity; each acquisition of an agent that advertises `claude-restart-adopt-v1` runs `restore-claude`, re-adopting live Claude generations by their receipts (never by a persisted PID) and logging `host-claude-restore` with state `complete`, `incomplete` or `unknown`; a Claude generation that closed or stayed unresolved while the agent was down stays isolated without blocking healthy recovery; a hello reporting another version gets the hub's agent package delivered over the pinned master from the committed closure manifest `hub/src/host/agent/closure.json` (paths and SHA-256; it lists the agent's Claude modules `claude.ts`, `claude-stop.ts` and `state-paths.ts`), verified and atomically installed under `~/.cland-host/code/<VERSION>`, then selected through the supervisor, which signals only its own direct child; an adopted Claude worker survives that replacement with its receipt authority and no signal (C3); the delivered agent starts standalone (no repository `node_modules`); the package carries no secret and writes nowhere outside the code directory; the registry passes the layout's Node to the transport explicitly. Fake hosts are registered without an expected version, so the scratch rows cannot show a delivery (see "Probes that mislead"). Its decisions: coord 506d8348/9cf96817 (a durations-only carry-over from the verified `bdabe9bb4`, A-16552, to the head; five per-test allowances, owner C-216, expiring 2026-11-11, A-16553), 59d5986d (layout defaults and admission unchanged).
  - T-1608: the spoke loads only connection, framing and delivery code at start; tool schemas load on the first `tools/list`, argument validation and tool frame helpers on the first `tools/call`; a T1 import-graph test fails when the startup graph reaches `node:sqlite`, the journal, the tracker or a tool implementation; a measurement test reports the spoke's RSS after the welcome and ten idle seconds and fails only when the spoke does not start, never on the number; every spoke tool still answers. Its decisions (coord 22:05Z): the C4 file mapping below; no RSS threshold; the Linux before/after figures are the item's droplet evidence (A-16395, A-16397), not this run's.
  - T-1644: the Host contract gains `publishFile(path, bytes, {mode?, replace?})` (create-only by default, `false` on an existing path; `replace: true` renames a synced staging file over the path), `appendFile` and `stat` (mode and size), on the local Host and in the agent with the same semantics, over SSH through prepared tokens with durable result receipts (a lost accepted reply settles without duplicate bytes; an interrupted commit is never replayed); an older agent without `stat` is refused before any file mutation; launch rollback restores an overwritten file's bytes and mode and truncates appended logs through the Host, and reads the hub-side mirror never; OpenCode's shared ignore is prepared through the launch Host (local bytes unchanged, T-1601's exemption and `hub/src/host/local-opencode-files.ts` removed); the remote discovery writer replaces a changed file atomically at mode 0600 and skips identical bytes (superseding stage 3's different-file refusal).
- Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

The run is meant to take about 2 to 2.5 hours: setup, E1532S4-00 to E1532S4-02 about 15 minutes (the typecheck included); the named files E1532S4-03 to E1532S4-09 about 60 minutes, one file at a time; the repetitions E1532S4-10 about 20 minutes; the scratch rows E1532S4-11 to E1532S4-16 about 30 minutes. Waits for cover-quiet admission or load come on top and are not product results.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what.

| criterion | proven by |
| --- | --- |
| T-1603 C1 (delivery through the frame protocol on a fake host, `idle` after the turn) | E1532S4-03 (`opencode-remote.test.ts`: the native completion withheld, `busy`, then `idle` after `session.execution.succeeded`); E1532S4-10 (repeated) |
| T-1603 C2 (the client only through the per-session forward's hub-side Unix socket; no hub-side TCP connection to a host port) | E1532S4-03 (the `lsof` census of the hub process with a planted 127.0.0.1 positive control first, `opencode-remote.test.ts:44`, unchanged at `:84`); E1532S4-01 (the forward and Unix-only refusal strings); E1532S4-11 (the scratch host-side processes hold no TCP, after the positive control) |
| T-1603 C3 (the spoke runs on the host and connects through `spoke.sock` with the host's secret) | E1532S4-03 (the generated MCP config names the remote discovery file and the Host layout's spoke, `:55`; the session's presence; the discovery secret differs from the project's) |
| T-1603 C4 (stop through the agent by identity, forward cancelled, nothing local signalled) | E1532S4-03 (one identity stop, one release, session socket gone, `:85`–`:90`; `opencode-remote-cleanup.test.ts`) |
| T-1603 C5 (opencode-adapter and opencode-native pass with no test edited) | E1532S4-03 (both files clean); E1532S4-01 (no `EDITED PRESERVED FILE`) |
| T-1606 C1 (delivery and state through the frame protocol on a fake host) | E1532S4-04 (`codex-remote.test.ts`: delivery receipt, withheld idle, exact `idle` row) |
| T-1606 C2 (app-server socket in the host's run directory; JSON-RPC only through the forward) | E1532S4-04 (`codex-remote.test.ts:49`, the `unix://` socket under `run`; `codex-remote-agent.test.ts`: `app-server --listen unix://<run>/…` on the fake host agent) |
| T-1606 C3 (policy roots, `.git` and socket directories from the Host layout and realpath; no hub path; no `danger-full-access`) | E1532S4-04 (`codex-remote.test.ts:66`–`:75`, the absolute-root refusal `:104`–`:109`, missing-root, overlong socket, missing layout and unresolved-policy refusals with no spawn; `codex-sandbox-host.test.ts`; `state-paths-lint.test.ts`); E1532S4-01 (refusal strings) |
| T-1606 C4 (`--version` and stop through the agent; codex-adapter, codex-native, codex-workspace-git unedited and passing) | E1532S4-04 (`codex-remote-agent.test.ts`; the three files clean); E1532S4-01 |
| T-1606 decisions (cleanup only through the admitted Host; local same-PID process and mirrored hub file untouched; client closed once; bounded settlement) | E1532S4-04 (`codex-remote-cleanup.test.ts`: `:108`–`:109` the mirrored file and colliding local process survive, no `LOCAL` call; the revoked-Host case; `:179` one close; `launch-settlement.test.ts`) |
| T-1607 C1–C5 (VERIFIED at `81f87619b`) | E1532S4-05 (`claude-code-remote.test.ts`, `claude-code-remote-files.test.ts`, `claude-agent-launch.test.ts`, `claude-stop.test.ts`; claude-code-adapter, claude-code-sessions and claude-code-schedule clean); E1532S4-10; E1532S4-11 (the agent's hello advertises `claude-launch-adopt-v1`) |
| T-1607 decisions (receipt and adopt by generation; 0600 private files and pinned job record removed after confirmed stop; planted-credential scan clean after launch, stop and rollback; stop during hook retirement; restart holds the role until settlement; one recapture budget per admitted stop; pinned positive exits settled; one terminal settlement owner) | E1532S4-05 (the named cases listed in its row); E1532S4-01 (capability, 0700 config-root refusal, 0600 writes, the two stop-semantics guide sentences) |
| T-1604 C1 (first clone through the git socket, `core.gitProxy` the proxy, no other remote or credential) | E1532S4-06 (`host-clone-integration.test.ts:45`–`:52`; `host-clone.test.ts`, the wrapper written 0700, `:13`) |
| T-1604 C2 (bundle over `scp` on the master after a failed daemon clone; origin back on the socket) | E1532S4-06 (the C2 cases; the master-loss copy refusal) |
| T-1604 C3 (item launch: territory branch, host lease, worktree at the tip) | E1532S4-06 (the C1/C3/C4/C5 case; `host-lease-lock.test.ts`) |
| T-1604 C4 (a failed add leaves no lease and no launch-created branch) | E1532S4-06 (same case; the accepted-checkout fault case) |
| T-1604 C5 (prune through the owning agent; task-worktrees and worktree-cli unedited and passing) | E1532S4-06; E1532S4-01 |
| T-1604 decisions (clone off the readiness path; no clone without a managed territory; `host_worktrees`; wrapper an executable path without secrets) | E1532S4-06 (`carrier stays ready while territory clone is held…`, `registry close quiesces…`); E1532S4-11 and E1532S4-13 (CLI-started hub with a managed territory: both hosts `up`, no `work` directory, no `git-proxy`, no `host-clone` event, `host_worktrees` present and empty); E1532S4-01 (`hasTerritory` gate, the table DDL, the wrapper mode). The no-territory case rests on the source gate alone (see Out of scope) |
| T-1605 C1 (reconnect within 5 s after `kill-agent`, table re-read, running rows unchanged) | E1532S4-07 (`host-agent-restart.test.ts`, the `kill-agent` variant; the two downtime variants); E1532S4-12 (CLI-started hub: the shipped supervisor restarts f1's agent, the hub's SSH Host reacquires it and logs a new `host-claude-restore` for f1, the discovery file is untouched, f2 untouched) |
| T-1605 C2 (another version: delivery over the master, restart, next hello the hub's version) | E1532S4-07 (the `version delivery` variant, the scratch-runtime case) |
| T-1605 C3 (old agent's processes in the new table, none signalled) | E1532S4-07 (both C1–C3 variants: the retained worker row and an empty signal receipt; test `C3 adopted Claude worker survives version replacement with receipt authority and no signal`: the replacement hello's version, the adopted worker alive with its identity, no TERM in its log, the durable row `adopted` with authority `owned`) |
| T-1605 C4 (no secret in the delivery, nothing outside the code directory) | E1532S4-07 (the planted-file positive control and manifest scan; `C4 corrupt and escaping bundles never become selectable`; test `committed agent closure matches the complete source and native asset graph`); E1532S4-01 (the closure lists `claude.ts` and `state-paths.ts`) |
| T-1608 C1 (startup import graph excludes the deny list) | E1532S4-08 (`spoke-import-graph.test.ts`) |
| T-1608 C2 (RSS measurement after welcome and ten idle seconds; fails only on start) | E1532S4-08 (`spoke-footprint.test.ts`; its measurement line recorded as evidence only) |
| T-1608 C3 (Linux droplet before/after) | not this run: the item's evidence A-16395/A-16397 (see Out of scope) |
| T-1608 C4 (every tool answers; spoke, spoke-reconnect and spoke-tools files unedited and passing) | E1532S4-08 (`spoke-lazy-tools.test.ts`; the mapped files of coord 22:05Z clean); E1532S4-01 |
| T-1644 C1 (atomic publish and append with the same semantics locally and in the agent, concurrent writers) | E1532S4-09 (`host-agent-files.test.ts` local and agent variants; the contract rows through `host-local-contract.test.ts` and `host-ssh-contract.test.ts`; the lost-reply and held-writer variants) |
| T-1644 C2 (OpenCode shared ignore through the launch Host; local bytes identical; exemption removed) | E1532S4-09 (`host-launch-layout.test.ts`, `host-boundary.test.ts`); E1532S4-01 (`local-opencode-files.ts` absent, the T-1644 refusal gone) |
| T-1644 C3 (OpenCode on a fake nonlocal host prepares the shared ignore there) | E1532S4-09 (`host-ssh-contract.test.ts`, `session-host-placement.test.ts`); E1532S4-03 (a real OpenCode launch on a fake host) |
| T-1644 C4 (stat with mode and size; rollback restores mode on a nonlocal Host; overwrite refusal removed) | E1532S4-09 (`launch-files.test.ts` with the hub mirror guarded and its positive control first, `:111`; `host-launch-layout.test.ts`; the older-agent refusal before mutation) |
| T-1644 decisions (discovery replaced atomically on change; identical bytes skip the writer) | E1532S4-09 (`remote-discovery-host.test.ts`, `remote-discovery.test.ts`); E1532S4-11 (f2's planted different file replaced: new inode, build bytes, mode 600, f2 `up`); E1532S4-12 and E1532S4-13 (same digest, mtime and inode across an agent restart and a hub restart) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1532` lists in stage `harnesses and git on hosts`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit.

At writing, dev was `6a3d5b6888c8cc44d09d99ff89c38081d1754acd`, and these members had landed: T-1608 `f2c0d9c0eb7f88751932a6e784309536beab9163`, T-1606 `a9fc026dc22c0d6e9a3356d2b790c5613501457c`, T-1604 `ce6195767243e2a45d78dddc309d12c69cb63d07`, T-1644 `32e217854056072425f5fd1cbc463765f619f46c`, T-1603 `ea2df328cd0de5bd6b5945a0a70d4cbec9be7105`, T-1607 `81f87619bed9824df766244d2fb2965363e2c292`. T-1605 then landed as `80f5f5fb85c65ba27a0131689d77ea132d971cbc` (batch 0a753077, log A-16557) from branch head `27168d53a554937c6c6d117eec7624cff023815a`, whose merge base with dev is `56ab49dcd474fe5071fc4a78f78eaedea29823dc` (dev through the T-1607 landing and its tracker commit); its executed evidence is A-16552 at `bdabe9bb4`, and the head differs from it only in `hub/test/durations.json` (A-16553, A-16555). Every T-1605 expectation in this brief was read at that head and is VERIFIED there. **The request names a dev SHA that includes every member's landing, T-1605's included; a dev SHA without one of them is BLOCKED (E1532S4-00), reported to the requester, nothing else run.** E1532S4-00 saves the T-1605 landing (`git show --stat`) and compares its file list with the head's own changes against `56ab49dcd`, which were `docs/agents/host-agent.md`, the test guides of `claude-agent-launch`, `host-agent-client`, `host-agent-closure`, `host-agent-restart`, `host-command-environment` and `host-records` in `docs/agents/tests/`, `docs/agents/tests/index.md`, `docs/hub/adapters-and-sessions.md`, `docs/hub/ssh-host.md`, `docs/hub/ssh-transport.md`, `hub/README.md`, `hub/bin/generate-host-agent-closure.ts`, `hub/src/host/agent-client.ts`, `hub/src/host/agent/claude.ts`, `hub/src/host/agent/closure.json`, `hub/src/host/agent/entry.ts`, `hub/src/host/agent/package.ts`, `hub/src/host/agent/restart.ts`, `hub/src/host/agent/server.ts`, `hub/src/host/agent/supervisor.sh`, `hub/src/host/code-delivery.ts`, `hub/src/host/registry.ts`, `hub/src/host/ssh-host.ts`, `hub/src/state-paths.ts`, `hub/src/transport/ssh.ts`, `hub/test/claude-agent-launch.test.ts`, `hub/test/durations.json`, `hub/test/host-agent-client.test.ts`, `hub/test/host-agent-closure.test.ts`, `hub/test/host-agent-restart.test.ts`, `hub/test/host-command-environment.test.ts`, `hub/test/host-records.test.ts` and `hub/test/tiers.json`. A difference is read before judging: a test file the landing adds is also run in E1532S4-07, a source change is re-checked by `src.mjs`, a `hub/test/durations.json` or `hub/test/tiers.json` change is timing or tier data, and a merge resolution in a shared file (`hub/src/host/ssh-host.ts`, `hub/src/host/agent/server.ts`, `hub/src/host/registry.ts`, `hub/src/host/agent/claude.ts`) is read against T-1605's and T-1607's decisions.

**Every expected string in this brief (refusal texts, status lines and fields, file and socket names, test titles) was copied from source at dev `6a3d5b688` (whose `hub/src/` and `hub/test/` trees equal the T-1607 landing `81f87619b` apart from `hub/test/durations.json`) or at the T-1605 head `27168d53a`, never paraphrased, and is marked under "Source provenance".** The run re-checks them at the tested build (E1532S4-01 and the `PRE:` lines) and reads a renamed string before judging. A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). No named file here needs `web/dist`; E1532S4-02 runs the typecheck only.

**Where things live.** All scratch state is outside the project root: the scratch root `$Q` is `/private/tmp/q34-…` (its realpath, 23 bytes), and it holds the scratch project p1, the fake-host root `$Q/fh`, the scratch HOME and every directory `fixtureEnvironment` synthesizes (`$Q/home`, `$Q/config`, `$Q/opencode`, `$Q/state`, `$Q/cache`, `$Q/claude`, `$Q/codex`, `$Q/fake-*`, `$Q/executor-state`) and every helper file. The fake hosts' directories are reached through the build's short alias `/private/tmp/ct-<32 hex>` (a symlink to `$Q/fh/.fixture-sockets`, made by `fixtureSocketPath` and removed by `removeFixtureSockets` in E1532S4-15). `$T` (`/private/tmp/qa-e1532-s4-<uuid>`) is the `TMPDIR` of every sealed command. The only paths under the repository are the ones the QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1532/`. Nothing is written to `.cland/tasks/`; E1532S4-00 and E1532S4-16 print the root's non-tracker status, which must not change.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed, through the seal described above. It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, `SSH_*`, provider and account variable, keeps `SHELL` and `TERM`, sets `TMPDIR` to `$T`, and synthesizes its own scratch values under `$Q`. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its territory, its `hub.db` or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, the live `hub.json` or `~/.config/cland/sandbox-remote.secrets.toml`; never run a real `ssh`, `scp` or `sshd`, never read a real `known_hosts` or key. The live hub is read only by QA's own shell for E1532S4-00's plan read and `quiet` (cover-quiet admission: the live verify queue is read, nothing is submitted). **Harnesses:** only the fakes in `$W/hub/test/fakes/` and the named files' scripted fakes. **SSH:** the scratch hub's carrier runs `$W/hub/test/fakes/fake-ssh.ts` through `CLAND_SSH_BIN` (and `fake-scp.ts` through `CLAND_SCP_BIN`), which the product honours only when `CLAND_FAKE_HOSTS` and `CLAND_FAKE_HOST_ROOT` are both set (`sshBinaries`, `hub/src/host/ssh-binaries.ts:2`–`:4`); without both it would run the real binaries, so `launch.mjs hub` checks them before launching. **Browser (rule 18):** none. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting, and every refusal or absence check follows a positive control named in its row; when a `PRE:` line or a control differs from the row's stated expectation, record the row `BLOCKED` with the line and stop the dependent rows. **Secrets (rule 15):** the scratch project secret and the two host secrets are never printed, posted or written under `$EV`; the probe prints lengths, modes, digests and booleans only, keeps the values in `$Q/secrets1532s4.json` (mode 600) and redacts every captured output through them; E1532S4-14 scans for them, and runs the publication scanner, each with a positive control.

**Unix socket paths (macOS 104 bytes, NUL included).** The scratch rows: `$Q` is `/private/tmp/q34-XXXXXX` (23 bytes) and p1 is `$Q/p1` (26 bytes), so `.cland/hub.sock`, `.cland/run/spoke.sock` and `.cland/run/hosts/<id>/` stay inside the project; `hostPaths` (`hub/src/host/records.ts:54`) falls back to `$TMPDIR/cland-h-<20 hex>` or `/tmp/cland-h-<20 hex>` only when a host socket would not fit, and that fallback is the product's own. The fake hosts' run directories are `/private/tmp/ct-<32 hex>/<id>/home/.cland-host/run` (72 bytes), so `agent.sock`, `spoke.sock` and `hub.sock` there are 82 to 84 bytes with the NUL. The probe prints each byte count; a count of 104 or more makes the row BLOCKED. The named files run with `TMPDIR=$T` (61 bytes, the suite root's length) and make their own sockets under the shared short-socket helpers, each asserted below 104 bytes inside the files. An `EINVAL` on connect is a FAIL here.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree and the scratch roots, runs `quiet` and the plan read, runs the named test files through `nt` and `rp` (which seal each run with `$Q/env.sh`), runs the read-only source checks and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. Never use `env -i`.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s4-$(date +%F)-1                        # unique run id for E-1532; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1532s4-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1532/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts); NVD=$(dirname "$NV")   # the pinned Neovim of nvim/NVIM_VERSION; never a Homebrew nvim
T=/private/tmp/qa-e1532-s4-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"   # TMPDIR of every sealed command: the suite root's length
Q=$(cd "$(mktemp -d /tmp/q34-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/q34-…, 23 bytes
chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# ld: the one-minute load must be 10 or below before each file (docs/agents/tests.md load rule); prints free disk space too
ld() { local n; for n in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l; free kB $(df -k "$T" | awk 'NR==2{print $4}')"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10 after 10 minutes: $l"; return 1; }
# nt <id> <files…>: named files from $W, sealed by $Q/env.sh (TMPDIR=$T), one file at a time, TAP, after quiet and ld; log $EV/<id>.log; then the tap.mjs check
nt() { local id=$1 f; shift; quiet || return 1; : > "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; node "$Q/tap.mjs" check "$EV/$id.log" "$Q/expect.json" | tee "$EV/$id.check.txt"; }
# rp <id> <file> <repetitions>: one named file repeated, appending to $EV/<id>.log
rp() { local rep; quiet || return 1; for rep in $(seq 1 "$3"); do ld >> "$EV/$1.log" || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$2" >> "$EV/$1.log" 2>&1; echo "exit $? $2 run $rep" >> "$EV/$1.log" ); done; }
```

The seal. `seal.mjs` prints the core of `env.sh` and exports `seal(extra, front)` for every launch that needs inputs of its own. `launch.mjs` starts the scratch hub and the host-side CLI.

```sh
cat > "$Q/seal.mjs" <<'JS'
// node "$Q/seal.mjs" env <W> <Q> <EV> <T> <nvim dir> <R>   QA's own shell: the sealed env.sh core (unset and export lines)
// const { seal } = await import(`${QA_Q}/seal.mjs`)         sealed: seal(extra, front) for one launch
// Order: the sealed builder scratchGitEnvironment(Q, fixtureEnvironment(Q, base)) first; this run's overlays after it; then the credential prefixes removed. Nothing is added after seal() returns.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { userInfo } from 'node:os';
const base = process.env;
const cli = process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'env';
const [W, Q, EV, T, NV, R] = cli ? process.argv.slice(3) : [base.QA_W, base.QA_Q, base.QA_EV, base.QA_T, base.QA_NVIM, base.QA_R];
if (!W || !EV || !NV || !R || !/^\/private\/tmp\/q34-[A-Za-z0-9]+$/.test(Q ?? '') || !/^\/private\/tmp\/qa-e1532-s4-[0-9a-f-]{36}$/.test(T ?? '')) {
  console.error('seal: refused: not this run\'s scratch roots'); process.exit(2);
}
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
const realHome = userInfo().homedir, nodeBin = dirname(process.execPath);
// Real-HOME harness folders (~/.opencode/bin, ~/.local/bin, …) never reach a scratch process; only the running Node's own bin is kept.
const drop = p => !p || p === NV || p === nodeBin || p.startsWith('~') || p === realHome || p.startsWith(`${realHome}/`)
  || p.startsWith(`${W}/hub/test/fakes`) || p === Q || p.startsWith(`${Q}/`);
const rest = String(base.PATH ?? '').split(':').filter(p => !drop(p));
export function seal(extra = {}, front = []) {
  for (const k of Object.keys(extra)) if (!/^(CLAND_|FAKE_|QA_)/.test(k)) throw new Error(`seal: overlay ${k} refused`);
  const env = scratchGitEnvironment(Q, fixtureEnvironment(Q, base), { excludesFile: `${Q}/home/.gitignore-global` });
  Object.assign(env, { PATH: [...new Set([...front, NV, nodeBin, ...rest])].join(':'), TMPDIR: T, QA_W: W, QA_Q: Q, QA_EV: EV, QA_T: T, QA_NVIM: NV, QA_R: R }, extra);
  for (const k of Object.keys(env)) if (/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)) delete env[k];
  return env;
}
if (cli) {
  const env = seal(), named = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
  for (const k of Object.keys(base).sort()) if (!(k in env) && named.test(k)) console.log(`unset ${k}`);
  for (const [k, v] of Object.entries(env)) if (named.test(k)) console.log(`export ${k}=${quote(v)}`);
}
JS
cat > "$Q/launch.mjs" <<'JS'
// node "$QA_Q/launch.mjs" hub                                    sealed, in p1: cland hub start with the fakes, the fake hosts f1 and f2, the fake ssh and scp
// node "$QA_Q/launch.mjs" hostcli <discovery file> <cwd> <args…>  sealed: the build's cland as a host-side client; CLAND_HUB_FILE and the fake harness binaries through the seal
import { spawn } from 'node:child_process';
const { seal } = await import(`${process.env.QA_Q}/seal.mjs`);
const [mode, ...args] = process.argv.slice(2), Q = process.env.QA_Q, W = process.env.QA_W, F = `${W}/hub/test/fakes`;
const bins = { CLAND_CLAUDE_BIN: `${F}/claude-code/claude`, CLAND_CODEX_BIN: `${F}/codex/codex`, CLAND_OPENCODE_BIN: `${F}/opencode/opencode` };
let argv, env, cwd = process.cwd();
if (mode === 'hub') {   // the fake harnesses authoritative and first on PATH, no machine-wide orphan sweep; both fake-host controls, so CLAND_SSH_BIN and CLAND_SCP_BIN are honoured
  env = seal({ ...bins, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_ADAPTER_POLL_MS: '200', CLAND_CLAUDE_AGENTS_MS: '500',
    CLAND_FAKE_HOSTS: 'f1,f2', CLAND_FAKE_HOST_ROOT: `${Q}/fh`, CLAND_SSH_BIN: `${F}/fake-ssh.ts`, CLAND_SCP_BIN: `${F}/fake-scp.ts` }, [`${F}/claude-code`, `${F}/codex`, `${F}/opencode`]);
  if (!(env.CLAND_FAKE_HOSTS && env.CLAND_FAKE_HOST_ROOT && env.CLAND_SSH_BIN && env.CLAND_SCP_BIN)) { console.error('launch: refused: a fake-host control is missing; the carrier would run the real ssh'); process.exit(2); }
  argv = [`${W}/hub/bin/cland.ts`, 'hub', 'start'];
} else if (mode === 'hostcli') {
  const [file, dir, ...rest] = args;
  env = seal({ ...bins, CLAND_HUB_FILE: file }); cwd = dir; argv = [`${W}/hub/bin/cland.ts`, ...rest];
} else { console.error(`launch: unknown mode ${mode}`); process.exit(2); }
const child = spawn(process.execPath, argv, { cwd, env, stdio: 'inherit' });
child.on('error', error => { console.error(`launch: ${error.message}`); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
JS
node --check "$Q/seal.mjs" && node --check "$Q/launch.mjs" && echo "launcher checked"
node "$Q/seal.mjs" env "$W" "$Q" "$EV" "$T" "$NVD" "$R" > "$Q/env.sh" || echo "BLOCKED: seal env failed"
cat >> "$Q/env.sh" <<'ENV'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: fake hosts, host records, agents, discovery and clone facts, TCP census, scans (probe.mjs)
probe() { node "$QA_Q/probe.mjs" "$@"; }
# hostcli <discovery file> <cwd> <cland args…>: the build's CLI as a host-side client
hostcli() { node "$QA_Q/launch.mjs" hostcli "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
hubstart() { node "$QA_Q/launch.mjs" hub && hp >> "$QA_Q/pids"; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
# run <label> <command…>: exit status, then the first lines of stdout and stderr, both redacted
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; probe redact < "$QA_Q/r.out" | head -n 30 | sed 's/^/  out: /'; probe redact < "$QA_Q/r.err" | head -n 30 | sed 's/^/  err: /'; }
# has <text>: how many lines of the last run's output contain the exact text (node, no pattern syntax)
has() { node -e 'const fs=require("fs"),q=process.env.QA_Q,n=process.argv.at(-1);let t="";for(const f of ["r.out","r.err"]){try{t+=fs.readFileSync(q+"/"+f,"utf8")+"\n"}catch{}}console.log(t.split("\n").filter(l=>l.includes(n)).length)' -- "$1"; }
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
( . "$Q/env.sh"; echo "sealed nvim: $(command -v nvim); $(nvim --version 2> /dev/null | head -n 1)"; echo "sealed TMPDIR is T: $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no); sealed HOME is Q/home: $([ "$HOME" = "$QA_Q/home" ] && echo yes || echo no)"; echo "setsid on the sealed PATH: $(command -v setsid || echo none)" )
( . "$Q/env.sh"; for c in claude codex opencode; do echo "$c on the sealed PATH: $(command -v "$c" || echo none)"; done )
( . "$Q/env.sh"; node -e 'const h=require("os").userInfo().homedir,n=require("path").dirname(process.execPath);console.log("sealed PATH entries under the real HOME other than node: "+process.env.PATH.split(":").filter(p=>p.startsWith("~")||(p===h||p.startsWith(h+"/"))&&p!==n).length)' )
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')"
echo "p1 hub.sock $(( $(printf '%s' "$Q/p1/.cland/hub.sock" | wc -c) + 1 )); spoke.sock $(( $(printf '%s' "$Q/p1/.cland/run/spoke.sock" | wc -c) + 1 ))"
```

The TAP check and its expectations. `tap.mjs` reads an `nt`/`rp` log and prints one `CLEAN` or `FINDING` line per file run. `expect.json` lists, per new file, every top-level name its source registers (literal titles and loop expansions, `exact`), and per changed file the new or renamed names that must pass (a subset). Every list was read at the final builds: the landed items at dev `6a3d5b688`, T-1605's new files and its additions to `claude-agent-launch.test.ts`, `host-command-environment.test.ts` and `host-records.test.ts` at `27168d53a`. A list that differs from the tested build's source is re-derived from its loops before judging, and the difference recorded.

```sh
cat > "$Q/tap.mjs" <<'JS'
// node "$QA_Q/tap.mjs" check <log> <expect.json>   per file run: CLEAN or FINDING with reasons; measurement diagnostics printed as they are
// node "$QA_Q/tap.mjs" names <log>                  every top-level name, unescaped, as <file><TAB><name>
import { readFileSync } from 'node:fs';
const [mode, log, expectFile] = process.argv.slice(2);
const expect = expectFile ? JSON.parse(readFileSync(expectFile, 'utf8')) : {};
// Node's TAP escapes '#' and '\' in names; an unescaped ' # ' starts a SKIP or TODO directive.
const parseName = raw => {
  let name = '', directive = null;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\' && i + 1 < raw.length) { name += raw[++i]; continue; }
    if (raw.startsWith(' # ', i)) { directive = raw.slice(i + 3).split(/\s/)[0].toUpperCase(); break; }
    name += raw[i];
  }
  return { name, directive };
};
const fresh = () => ({ plan: null, counters: {}, top: [], notOk: [], nestedNotOk: [], directives: [], measurements: [], einval: 0 });
const runs = []; let cur = fresh();
for (const line of readFileSync(log, 'utf8').split('\n')) {
  let m;
  if ((m = /^exit (\d+) (\S+)(?: run (\d+))?$/.exec(line))) { runs.push({ exit: Number(m[1]), file: m[2], run: Number(m[3] ?? 1), ...cur }); cur = fresh(); continue; }
  if (line.includes('EINVAL')) cur.einval++;
  if ((m = /^1\.\.(\d+)$/.exec(line))) { cur.plan = Number(m[1]); continue; }
  if ((m = /^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/.exec(line))) { cur.counters[m[1]] = Number(m[2]); continue; }
  if ((m = /^\s*# (\{"measurement".*\})\s*$/.exec(line))) { cur.measurements.push(m[1]); continue; }
  if ((m = /^(\s*)(not )?ok \d+ - (.*)$/.exec(line))) {
    const { name, directive } = parseName(m[3]);
    if (directive) cur.directives.push(`${directive} ${name}`);
    if (m[1] === '') { cur.top.push({ name, ok: !m[2] }); if (m[2]) cur.notOk.push(name); }
    else if (m[2]) cur.nestedNotOk.push(name);
  }
}
if (mode === 'names') { for (const r of runs) for (const t of r.top) console.log(`${r.file}\t${t.name}`); process.exit(0); }
for (const r of runs) {
  const reasons = [], e = expect[r.file], c = r.counters, okNames = new Set(r.top.filter(t => t.ok).map(t => t.name));
  if (r.exit !== 0) reasons.push(`exit ${r.exit}`);
  for (const k of ['fail', 'cancelled', 'skipped', 'todo']) if ((c[k] ?? 0) !== 0) reasons.push(`${k} ${c[k]}`);
  if (c.pass === undefined || c.pass !== c.tests) reasons.push(`pass ${c.pass} of ${c.tests}`);
  if (r.notOk.length) reasons.push(`not ok: ${r.notOk.join(' | ')}`);
  if (r.nestedNotOk.length) reasons.push(`nested not ok: ${r.nestedNotOk.join(' | ')}`);
  if (r.directives.length) reasons.push(`directives: ${r.directives.join(' | ')}`);
  if (r.einval) reasons.push(`EINVAL lines ${r.einval}`);
  if (r.plan === 1 && r.top.length === 1 && r.top[0].name.endsWith(r.file)) reasons.push('only a per-file wrapper: the file registered nothing');
  if (e) {
    const missing = e.names.filter(n => !okNames.has(n));
    if (missing.length) reasons.push(`missing: ${missing.join(' | ')}`);
    if (e.exact) { const extra = [...okNames].filter(n => !e.names.includes(n)); if (r.plan !== e.names.length) reasons.push(`plan ${r.plan} against a list of ${e.names.length}`); if (extra.length) reasons.push(`unlisted: ${extra.join(' | ')}`); }
  }
  console.log(`${reasons.length ? 'FINDING' : 'CLEAN'} ${r.file} run ${r.run} plan ${r.plan} pass ${c.pass}${reasons.length ? ': ' + reasons.join('; ') : ''}`);
  for (const m of r.measurements) console.log(`  measurement ${m}`);
}
JS
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/opencode-remote.test.ts": {"exact": true, "names": [
  "remote OpenCode frame delivery uses Unix forward and host-secret spoke; identity stop cancels it",
  "fake Host concurrent port allocations preserve all routes before session forwards"]},
 "hub/test/opencode-remote-cleanup.test.ts": {"exact": true, "names": [
  "OpenCode failed launch retains a single-flight unforward until its positive receipt",
  "OpenCode Unix client close aborts active HTTP and SSE and joins native close receipts",
  "OpenCode remote poll drains snapshots and subscription before cancelling its forward",
  "OpenCode remote shutdown drains snapshots and subscription before cancelling its forward",
  "OpenCode remote stop drains snapshots and subscription before cancelling its forward"]},
 "hub/test/codex-remote.test.ts": {"exact": true, "names": ["remote Codex frame launch uses a session forward and host sandbox paths"]},
 "hub/test/codex-remote-agent.test.ts": {"exact": true, "names": ["Codex version and stop cross the fake host agent with a joined native exit"]},
 "hub/test/codex-remote-cleanup.test.ts": {"exact": true, "names": [
  "durable remote handshake recovery retains Host and retries forward cancellation before settlement",
  "stop joins held remote reconnect forward", "stop joins held remote reconnect connect", "stop joins held remote reconnect subscription",
  "confirmed remote death retains failed forward cleanup until the retry receipt",
  "revoked remote recovery reports its pinned Host and preserves pending ownership",
  "async Codex settlement precedes recovery-row and role release",
  "standalone Codex deferred rollback cancels its forward after native cleanup",
  "forced failure releases held subscription before fixture storage and roots",
  "forced failure releases held settlement before fixture storage and roots"]},
 "hub/test/launch-settlement.test.ts": {"exact": true, "names": [
  "settlement preserves synchronous callbacks and retries a rejected async callback",
  "a hanging settlement is bounded while concurrent retries share the producer",
  "deferred recovery reports a hung settlement and retains one producer until the receipt",
  "deferred path retries a rejecting settlement and records successful recovery"]},
 "hub/test/codex-sandbox-host.test.ts": {"exact": false, "names": [
  "remote Codex policy refuses a missing run directory before consulting paths",
  "Codex takes roots, linked git bytes and socket paths from the selected Host"]},
 "hub/test/state-paths-lint.test.ts": {"exact": false, "names": [
  "Codex temp-root registration accepts only the local versus host expression",
  "hub source conforms to the named state path inventory"]},
 "hub/test/claude-code-remote.test.ts": {"exact": true, "names": [
  "remote Claude frame launch adopts its worker and delivers through host hooks and bridge",
  "older host agent refuses Claude launch capability before starting a command",
  "Claude TERM-resistant SessionEnd hook is captured and killed by native birth",
  "Claude hook born across root exit remains unacquired",
  "remote Claude failed adoption handshake joins rollback and removes its credential copies only",
  "agent restart does not inherit Claude dynamic child acquisition from its serialized marker",
  "hub restart after tree closure re-adopts its durable generation and releases the job",
  "lost native release reply settles without replaying native stop",
  "lost native release-restart reply settles without replaying native stop",
  "lost native forget-restart reply settles without replaying native stop",
  "late SessionEnd after the recovery snapshot never grants an adopted closed receipt",
  "terminal remote PID settlement cleans before publishing exit without recurring CLI",
  "terminal remote PID settlement holds the row on native failure without recurring CLI",
  "adopted Claude settles one descendant born between stop capture and commit before any signal",
  "an unowned reparented child stays unacquired across explicit stops",
  "pinned native hook exit between prepare and commit settles without a manual re-stop",
  "failed Claude launch restart adoption", "failed Claude launch restart result", "failed Claude launch restart missing-receipt",
  "failed Claude launch restart missing-state", "failed Claude launch restart prune-failure"]},
 "hub/test/claude-code-remote-files.test.ts": {"exact": true, "names": [
  "remote Claude private credential files are removed only after confirmed stop",
  "remote Claude shutdown during adoption joins rollback before removing private files",
  "Claude native-refused retains generation files until confirmed release",
  "Claude native-unknown retains generation files until confirmed release",
  "Claude release-reply-lost retains generation files until confirmed release",
  "missing Claude generation missing-marker grants no cleanup authority",
  "missing Claude generation other-generation grants no cleanup authority",
  "missing Claude generation old-error-shape grants no cleanup authority",
  "terminal generation restart retry settles and clears its marker",
  "terminal generation restart retry is durably bounded after failure",
  "an unconfirmed explicit stop stays held on restart without replaying native cleanup",
  "close after accepted Claude launch result re-adopts before rollback and joins settlement",
  "captured and reconstructed failed-launch callbacks share one native settlement producer",
  "Claude untyped lookalike error stays supervised",
  "Claude typed non-admission rolls back without adoption"]},
 "hub/test/claude-agent-launch.test.ts": {"exact": true, "names": [
  "Claude launch fails closed on ambiguous discovery []",
  "Claude launch fails closed on ambiguous discovery [{\"id\":\"abc\",\"pid\":42,\"sessionId\":\"native\"},{\"id\":\"abc\",\"pid\":43,\"sessionId\":\"native\"}]",
  "Claude launch fails closed on ambiguous discovery malformed",
  "Claude receipt pins generation native birth and uid and refuses PID reuse",
  "Claude refuses nonprivate account root before any command and rejects foreign-owner metadata",
  "Claude cleanup removes only the pinned job and leaves another session job intact",
  "concurrent release callers share one durable settlement producer",
  "terminal receipt forget requires confirmed private directory deletion",
  "Claude jobs symlink refuses before commands can copy the planted token outside the private root",
  "Claude launch pins jobs before execution and refuses a replacement directory",
  "an invalid native job handle never becomes a stop option",
  "restart restore consumes live generation receipts and skips pending released and confirmed closed workers",
  "restart restore reports a vanished generation without blocking a healthy receipt"]},
 "hub/test/claude-stop.test.ts": {"exact": true, "names": [
  "Claude SessionEnd natural has bounded native ownership", "Claude SessionEnd ignores TERM has bounded native ownership",
  "Claude SessionEnd after root exit has bounded native ownership", "Claude SessionEnd reparented has bounded native ownership",
  "Claude SessionEnd foreign has bounded native ownership",
  "Claude refuses a foreign UID already present in its captured set before any signal",
  "pre-signal Claude capture refuses foreign UID", "pre-signal Claude capture refuses reparented",
  "pre-signal Claude capture refuses old PID", "pre-signal Claude capture refuses root birth gone",
  "second pre-signal descendant churn is incomplete without sending any signal",
  "pinned Claude member exit is settled before comparing captures",
  "pinned Claude member birth replacement is settled before comparing captures",
  "Claude transient unknown member gets one identity re-read before signals",
  "Claude persistent unknown member gets one identity re-read before signals",
  "Claude helper admission budget unused preserves the one-recapture boundary",
  "Claude helper admission budget outer spent preserves the one-recapture boundary",
  "Claude helper admission budget second descendant preserves the one-recapture boundary",
  "a new Claude stop admission starts a fresh single-use budget"]},
 "hub/test/host-secret-admission.test.ts": {"exact": false, "names": ["host Claude native signal identity is payload bound to its authenticated durable owner"]},
 "hub/test/host-contract-coverage.test.ts": {"exact": false, "names": ["local Host retains no optional Claude launch or adoption implementation"]},
 "hub/test/state-paths.test.ts": {"exact": false, "names": ["host Claude account root preserves config override and host HOME precedence"]},
 "hub/test/host-command-environment.test.ts": {"exact": false, "names": ["Host.close joins a held observation connection independently of recovery receipts"]},
 "hub/test/host-records.test.ts": {"exact": false, "names": ["registered host transports explicitly carry each layout Node runtime without the generic fallback"]},
 "hub/test/host-clone-integration.test.ts": {"exact": true, "names": [
  "C1/C3/C4/C5 fake host clone, leased worktree tip, failure rollback, persisted record and agent removal",
  "C2 bundle fallback copies over the pinned master and retains socket origin",
  "accepted checkout keeps its durable ownership when ready checkpoint fails",
  "copy refuses master loss during native admission without an independent connection",
  "carrier stays ready while territory clone is held and task add reports clone failure",
  "registry close quiesces disconnected clone settlement and retains incomplete native ownership"]},
 "hub/test/host-clone.test.ts": {"exact": true, "names": [
  "C1 first clone uses only git socket origin and proxy; publishes clone discovery",
  "C2 daemon failure copies bundle then restores socket origin"]},
 "hub/test/host-lease-lock.test.ts": {"exact": true, "names": [
  "locked grant succeeds under its active matching root owner",
  "locked grant refuses no owner and a different-root owner"]},
 "hub/test/host-agent-restart.test.ts": {"exact": true, "names": [
  "C1-C3 kill-agent reconnect reads retained table without signalling harness",
  "C1-C3 version delivery reconnect reads retained table without signalling harness",
  "C4 corrupt and escaping bundles never become selectable",
  "Host close joins installation and fences a late restart publication",
  "held mismatched acquisition after close closes its client without delivery",
  "held mismatched acquisition after quiesce closes its client without delivery",
  "registry loads in scratch runtime with development packages unavailable",
  "C3 adopted Claude worker survives version replacement with receipt authority and no signal",
  "Claude exit during agent downtime keeps closed generation isolated from healthy recovery",
  "Claude exit during agent downtime keeps unresolved generation isolated from healthy recovery"]},
 "hub/test/host-agent-closure.test.ts": {"exact": true, "names": [
  "committed agent closure matches the complete source and native asset graph",
  "host registry startup imports no development-only package",
  "restart requires exact fresh native birth and refuses reused or inherited PID authority",
  "recovery handshake preserves previous hello shape and gates the additive restore operation"]},
 "hub/test/host-agent-client.test.ts": {"exact": true, "names": ["new client accepts original protocol-1 hello without capabilities"]},
 "hub/test/spoke-import-graph.test.ts": {"exact": true, "names": [
  "C1 spoke eager startup graph excludes SQLite, journal, tracker and tool implementations",
  "startup graph detects transitive runtime edges and excludes erased or deferred imports"]},
 "hub/test/spoke-lazy-tools.test.ts": {"exact": true, "names": ["C4 concurrent first tool listings and every documented tool answer through unchanged handlers"]},
 "hub/test/spoke-footprint.test.ts": {"exact": true, "names": ["spoke RSS after welcome and ten idle seconds (measurement only)"]},
 "hub/test/host-agent-files.test.ts": {"exact": false, "names": [
  "atomic publish, append and stat preserve concurrent writers (local)",
  "atomic publish, append and stat preserve concurrent writers (agent)"]},
 "hub/test/host-ssh-contract.test.ts": {"exact": false, "names": [
  "C2 explicit additions merge with agent base while planted hub tokens never reach spawned process",
  "OpenCode nonlocal missing executable fails after Host file preparation and leaves no process",
  "Host publishFile settles lost accepted reply without duplicate bytes",
  "Host appendFile settles lost accepted reply without duplicate bytes",
  "Host publishFile retains a held native writer across stream loss",
  "Host appendFile retains a held native writer across stream loss",
  "SSH LaunchFiles refuses an older agent without stat before any file mutation"]},
 "hub/test/launch-files.test.ts": {"exact": false, "names": [
  "test Host stat requires explicit local file delegation",
  "remote LaunchFiles reads only Host metadata and bytes while the hub mirror stays unread"]},
 "hub/test/host-prepared.test.ts": {"exact": false, "names": [
  "restart retains interrupted publishFile commit without replay",
  "restart retains interrupted appendFile commit without replay",
  "completed append retains ownership when its durable result cannot be written"]},
 "hub/test/host-launch-layout.test.ts": {"exact": false, "names": [
  "nonlocal rollback restores overwritten bytes and mode and truncates appended logs",
  "nonlocal OpenCode prepares shared ignore through supplied Host",
  "OpenCode ignore preserves concurrent editor bytes (at publish)",
  "OpenCode ignore preserves concurrent editor bytes (before read)"]},
 "hub/test/session-host-placement.test.ts": {"exact": false, "names": ["production OpenCode launch prepares nonlocal shared ignore and reaches only selected Host spawn"]},
 "hub/test/host-boundary.test.ts": {"exact": false, "names": ["Host boundary rejects former local metadata exemptions"]},
 "hub/test/remote-discovery-host.test.ts": {"exact": false, "names": ["changed host secret atomically replaces prior discovery and reaches up"]},
 "hub/test/remote-discovery.test.ts": {"exact": false, "names": ["different discovery attempts atomic replacement; identical bytes skip the writer"]}
}
JSON
node --check "$Q/tap.mjs" && node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks. `src.mjs` counts each exact string with `String.split` in the build's files; T-1605 and T-1607 lines name the commit they were read at (`27168d53a`, `81f87619b`).

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   exact-string counts at the build (no pattern syntax): ok or MISMATCH, label, file, count, expectation
import { readFileSync, existsSync } from 'node:fs';
const W = process.argv[2];
const C = [
  ['T-1603 port forward', 'hub/src/adapters/opencode.ts', 'const endpoint = await machine.forward(sessionId, { port: Number(parsed.port) });', '=1'],
  ['T-1603 Unix forward required', 'hub/src/adapters/opencode.ts', 'OpenCode requires a Unix session forward on host ${machine.name}', '=1'],
  ['T-1603 Unix client', 'hub/src/adapters/opencode/client.ts', 'constructor(url: string, password: string, socketPath?: string) {', '=1'],
  ['T-1603 restart settlement left to T-1671', 'docs/hub/adapters-and-sessions.md', 'post-restart OpenCode forward', '>=1'],
  ['T-1606 absolute root refusal', 'hub/src/adapters/sessions.ts', "'absolute writable root is a hub-machine path'", '=1'],
  ['T-1606 unresolved policy refusal', 'hub/src/adapters/sessions.ts', 'cannot resolve launch policy on host ${machine.name}: ', '=1'],
  ['T-1606 missing runDirectory refusal', 'hub/src/adapters/codex.ts', 'cannot resolve Codex policy on host ${machine.name}: missing runDirectory', '=1'],
  ['T-1606 socket bound', 'hub/src/adapters/codex.ts', 'Codex socket exceeds 104 bytes on host', '>=1'],
  ['T-1606 host-named cleanup', 'hub/src/adapters/sessions.ts', 'cleanup-incomplete on host', '>=1'],
  ['T-1606 settlement type', 'hub/src/adapters/launch-settlement.ts', 'export type LaunchSettled', '=1'],
  ['T-1606 settlement bound', 'hub/src/adapters/launch-settlement.ts', '5000', '>=1'],
  ['T-1606 ADR 0008', 'docs/adr/0008-host-paths-own-remote-codex-policy.md', '# The Host owns remote Codex policy paths', '=1'],
  ['T-1604 origin', 'hub/src/host/clone.ts', "export const HOST_ORIGIN = 'git://cland/territory.git';", '=1'],
  ['T-1604 wrapper mode', 'hub/src/host/clone.ts', '{mode:0o700}', '=1'],
  ['T-1604 wrapper command', 'hub/src/host/clone.ts', "'host git-proxy'", '=1'],
  ['T-1604 clone discovery copy', 'hub/src/host/clone.ts', "if(await o.host.fileType(file)==='missing')await o.host.writeFile(file,bytes,{mode:0o600});", '=1'],
  ['T-1604 no territory, no clone', 'hub/src/host/registry.ts', 'if(!await hasTerritory(options.root,options.env))return;', '=1'],
  ['T-1604 clone events', 'hub/src/host/registry.ts', "event:'host-clone'", '=3'],
  ['T-1604 clone off readiness', 'hub/src/host/registry.ts', '// The carrier owns connectivity; task preparation owns the clone separately.', '=1'],
  ['T-1604 host_worktrees table', 'hub/src/hub/store.ts', 'create table if not exists host_worktrees (item text primary key, value text not null);', '=1'],
  ['T-1604 locked grant', 'hub/src/host/branch-leases.ts', 'export async function grantBranchLeaseLocked', '=1'],
  ['T-1604 scp on the master only', 'hub/src/transport/ssh.ts', "'ProxyCommand=false'", '>=1'],
  ['T-1608 deferred imports', 'hub/src/spoke/spoke.ts', 'await import(', '>=3'],
  ['T-1608 measurement only', 'hub/test/spoke-footprint.test.ts', "t.diagnostic(JSON.stringify({ measurement: 'spoke-idle-rss'", '=1'],
  ['T-1644 atomic replace', 'hub/src/host/agent/files.ts', 'if (options?.replace) await rename(staging, path);', '=1'],
  ['T-1644 discovery publish', 'hub/src/host/discovery.ts', 'options:{mode:0o600,replace:true}', '=1'],
  ['T-1644 identical bytes skip', 'hub/src/host/discovery.ts', 'if (current?.equals(bytes)) return;', '=1'],
  ['T-1644 differs refusal gone (discovery)', 'hub/src/host/discovery.ts', 'host discovery differs', '=0'],
  ['T-1644 differs refusal gone (carrier)', 'hub/src/transport/ssh.ts', 'host discovery differs', '=0'],
  ['T-1644 OpenCode refusal gone', 'hub/src/adapters/opencode/server.ts', 'nonlocal OpenCode shared ignore needs Host atomic publish/append (T-1644)', '=0'],
  ['T-1644 local helper removed', 'hub/src/host/local-opencode-files.ts', null, 'absent'],
  ['T-1644 ignore through the Host', 'hub/src/adapters/opencode/ignore.ts', 'publishFile', '>=1'],
  ['T-1644 contract publish', 'hub/src/host/host.ts', 'publishFile(path: string, bytes: Uint8Array, options?: { mode?: number; replace?: boolean }): Promise<boolean>;', '=1'],
  ['T-1644 contract append', 'hub/src/host/host.ts', 'appendFile(path: string, bytes: Uint8Array): Promise<void>;', '=1'],
  ['T-1644 contract stat', 'hub/src/host/host.ts', 'stat(path: string): Promise<{ mode: number; size: number }>;', '=1'],
  ['hello capabilities', 'hub/src/host/agent/server.ts', 'capabilities: [PREPARED_HOST_CAPABILITY', '>=1'],
  ['fake kill-agent control', 'hub/test/fakes/fake-host.ts', "if (action === 'kill-agent') {", '=1'],
  ['agent boot id off Linux', 'hub/src/host/agent/native.ts', 'non-Linux agent requires fake host boot-id file', '=1'],
  ['fake ssh and scp gate', 'hub/src/host/ssh-binaries.ts', "return { ssh: fake && env.CLAND_SSH_BIN || 'ssh', scp: fake && env.CLAND_SCP_BIN || 'scp' };", '=1'],
  ['T-1605 waiting for update (27168d53a)', 'hub/src/host/ssh-host.ts', 'waiting for updated agent', '=1'],
  ['T-1605 no delivery refusal (27168d53a)', 'hub/src/host/ssh-host.ts', 'version mismatch and code delivery unavailable', '=1'],
  ['T-1605 fake hosts expect no version (27168d53a)', 'hub/src/host/registry.ts', '...(fake ? {} : {expectedVersion:VERSION})', '=1'],
  ['T-1605 restore event (27168d53a)', 'hub/src/host/registry.ts', "event:'host-claude-restore'", '=1'],
  ['T-1605 restore capability (27168d53a)', 'hub/src/host/agent/claude.ts', "export const CLAUDE_RESTORE_CAPABILITY = 'claude-restart-adopt-v1';", '=1'],
  ['T-1605 hello capabilities (27168d53a)', 'hub/src/host/agent/server.ts', 'capabilities: [PREPARED_HOST_CAPABILITY, CLAUDE_LAUNCH_CAPABILITY, CLAUDE_RESTORE_CAPABILITY]', '=1'],
  ['T-1605 committed closure (27168d53a)', 'hub/src/host/code-delivery.ts', 'hub/src/host/agent/closure.json', '=1'],
  ['T-1605 stale closure refusal (27168d53a)', 'hub/src/host/code-delivery.ts', 'agent closure stale: regenerate host-agent closure', '=1'],
  ['T-1605 atomic install (27168d53a)', 'hub/src/host/code-delivery.ts', 'await fs.rename(staging,target)', '=1'],
  ['T-1605 hash checks (27168d53a)', 'hub/src/host/code-delivery.ts', "createHash('sha256')", '>=2'],
  ['T-1605 supervisor own child only (27168d53a)', 'hub/src/host/agent/supervisor.sh', 'agent restart birth unavailable or changed; nothing signalled', '=1'],
  ['T-1605 closure entry (27168d53a)', 'hub/src/host/agent/closure.json', '"hub/src/host/agent/entry.ts"', '=1'],
  ['T-1605 closure holds the Claude agent module (27168d53a)', 'hub/src/host/agent/closure.json', '"hub/src/host/agent/claude.ts"', '=1'],
  ['T-1605 closure holds the agent state-path resolver (27168d53a)', 'hub/src/host/agent/closure.json', '"hub/src/host/agent/state-paths.ts"', '=1'],
  ['T-1607 capability (81f87619b)', 'hub/src/host/agent/claude.ts', "export const CLAUDE_LAUNCH_CAPABILITY = 'claude-launch-adopt-v1';", '=1'],
  ['T-1607 capability advertised (81f87619b)', 'hub/src/host/agent/server.ts', 'CLAUDE_LAUNCH_CAPABILITY', '>=2'],
  ['T-1607 private config root (81f87619b)', 'hub/src/host/agent/claude.ts', "'Claude account config root must be an agent-owned directory with mode 0700'", '=1'],
  ['T-1607 private settings file (81f87619b)', 'hub/src/adapters/claude-code.ts', 'await writer.write(settingsFile, Buffer.from(JSON.stringify(settings)), 0o600);', '=1'],
  ['T-1607 ADR 0003 amendment (81f87619b)', 'docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md', '## Amendment — 2026-11-04: Host Claude terminal settlement (T-1607)', '=1'],
  ['T-1607 one recapture budget per admitted stop (81f87619b)', 'docs/agents/host-agent.md', 'The one recapture budget belongs to the admitted stop', '=1'],
  ['T-1607 terminal settlement owner (81f87619b)', 'docs/agents/host-agent.md', 'A terminal PID observation owns one bounded native settlement', '=1'],
];
for (const [label, file, needle, want] of C) {
  const path = `${W}/${file}`, exists = existsSync(path);
  if (want === 'absent') { console.log(`${exists ? 'MISMATCH' : 'ok'} ${label}: ${file} ${exists ? 'exists' : 'absent'}`); continue; }
  const n = exists ? readFileSync(path, 'utf8').split(needle).length - 1 : -1;
  const ok = n >= 0 && (want.startsWith('>=') ? n >= Number(want.slice(2)) : n === Number(want.slice(1)));
  console.log(`${ok ? 'ok' : 'MISMATCH'} ${label}: ${file} count ${n} want ${want}`);
}
JS
node --check "$Q/src.mjs" && echo "src checked"
```

The probe. It refuses to run outside `$Q`, imports only from `$W`, never prints a secret and never runs a real `ssh`. Its record shapes come from their producers (see "Source provenance").

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> [args…]   (sealed) fake hosts, records, agents, discovery and clone facts, TCP census, scans
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, unlinkSync, openSync, lstatSync, realpathSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createConnection, createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
const W = process.env.QA_W, Q = process.env.QA_Q, EV = process.env.QA_EV;
if (!W || !/^\/private\/tmp\/q34-[A-Za-z0-9]+$/.test(Q ?? '')) { console.log(JSON.stringify({ refused: 'not a scratch run' })); process.exit(2); }
const FH = `${Q}/fh`, P1 = `${Q}/p1`;
const [mode, ...args] = process.argv.slice(2);
const out = (k, v) => console.log(JSON.stringify({ [k]: v }));
const SF = `${Q}/secrets1532s4.json`;
const known = () => existsSync(SF) ? JSON.parse(readFileSync(SF, 'utf8')) : [];
const remember = (kind, value) => { const k = known(); if (!k.some(x => x.kind === kind)) { k.push({ kind, value }); writeFileSync(SF, JSON.stringify(k), { mode: 0o600 }); } };
const redact = text => { let t = String(text); for (const k of known()) if (k.value.length >= 16) t = t.split(k.value).join(`<${k.kind}>`); return t.replace(/[0-9a-f]{64}/gi, '<hex64>'); };
const bytes = path => Buffer.byteLength(path, 'utf8') + 1;
const sha12 = buf => createHash('sha256').update(buf).digest('hex').slice(0, 12);
const mode8 = path => (statSync(path).mode & 0o777).toString(8);
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (mode === 'redact') { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => process.stdout.write(redact(s))); }
else {
const { hostPaths } = await import(`${W}/hub/src/host/records.ts`);
const { layout } = await import(`${W}/hub/src/project.ts`);
const { hostDirectory } = await import(`${W}/shared/fake-host-directory.ts`);
const { remoteDiscovery } = await import(`${W}/hub/src/host/discovery.ts`);
const { remoteHostLayout } = await import(`${W}/hub/src/host/remote-layout.ts`);
const { VERSION } = await import(`${W}/hub/src/version.ts`);
const fake = id => { const directory = hostDirectory(FH, id), home = join(directory, 'home'), l = remoteHostLayout(home); return { directory, home, run: l.runDirectory, file: l.discoveryFile }; };
const hostSecret = id => readFileSync(hostPaths(P1, id).secret, 'utf8');
const projectSecret = () => readFileSync(join(P1, '.cland', 'secret'), 'utf8').trim();
const buildBytes = id => JSON.stringify(remoteDiscovery(fake(id).run, hostSecret(id)), null, 2) + '\n';
const openDb = async () => { const { DatabaseSync } = await import('node:sqlite'); return new DatabaseSync(join(P1, '.cland', 'hub.db'), { readOnly: true }); };
// the process table, and this probe with every ancestor (the shell, the runner) that a census must never count
const table = () => {
  const rows = execFileSync('ps', ['-Ao', 'pid=,ppid=,command='], { encoding: 'utf8' }).split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => { const [pid, ppid, ...c] = l.split(/\s+/); return { pid: Number(pid), ppid: Number(ppid), command: c.join(' ') }; });
  const self = new Set(); let p = process.pid;
  while (p > 1 && !self.has(p)) { self.add(p); p = rows.find(r => r.pid === p)?.ppid ?? 1; }
  return { rows, self };
};
function lines(path) {   // one JSON-lines connection to a hub socket
  return new Promise((resolve, reject) => {
    const s = createConnection(path); const frames = [], waiters = []; let buf = '', closed = false;
    s.setEncoding('utf8'); s.on('error', () => {});
    s.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; const f = JSON.parse(l); const w = waiters.findIndex(x => x.p(f)); if (w >= 0) waiters.splice(w, 1)[0].r(f); else frames.push(f); } });
    s.on('close', () => { closed = true; for (const w of waiters.splice(0)) w.r(null); });
    const next = (p, ms = 5000) => new Promise(r => { const i = frames.findIndex(p); if (i >= 0) return r(frames.splice(i, 1)[0]); if (closed) return r(null); const w = { p, r }; waiters.push(w); setTimeout(() => { const j = waiters.indexOf(w); if (j >= 0) { waiters.splice(j, 1); r(null); } }, ms); });
    s.once('connect', () => resolve({ send: f => s.write(JSON.stringify(f) + '\n'), next, end: () => s.destroy() }));
    s.once('error', reject);
  });
}
async function status() {   // hub.status over p1's own socket with the project secret; frame id qa-status
  const c = await lines(layout(P1).socket);
  c.send({ type: 'hello', protocol: 2, client: 'cli', secret: projectSecret() });
  const h = await c.next(f => f.type === 'welcome' || f.type === 'error');
  if (h?.type !== 'welcome') { c.end(); return null; }
  c.send({ type: 'hub.status', id: 'qa-status' });
  const r = await c.next(f => f.type === 'result' && f.id === 'qa-status'); c.end();
  return r?.ok ? r.value : null;
}
switch (mode) {
  case 'mkhosts': {   // <id…>: the build's createFakeHost under $QA_Q/fh, before any hub start
    const { createFakeHost } = await import(`${W}/hub/test/fakes/fake-host.ts`);
    for (const id of args) {
      const h = await createFakeHost(FH, id), f = fake(id);
      writeFileSync(`${Q}/alias`, `${dirname(h.directory)}\n`);
      out(id, { aliasShort: dirname(h.directory).startsWith(`${realpathSync('/tmp')}/ct-`), aliasTarget: realpathSync(dirname(h.directory)) === realpathSync(`${FH}/.fixture-sockets`), runIsLayout: h.run === f.run, runMode: mode8(h.run),
        agentSocketBytes: bytes(join(f.run, 'agent.sock')), hubSocketBytes: bytes(join(f.run, 'hub.sock')), spokeSocketBytes: bytes(join(f.run, 'spoke.sock')), gitSocketBytes: bytes(join(f.run, 'git.sock')) });
    }
    break;
  }
  case 'plant': {   // <id>: a different remote discovery at that host's canonical path (a synthetic value, not a secret), mode 600
    const f = fake(args[0]);
    const prior = JSON.stringify(remoteDiscovery(f.run, 'qa-prior-' + 'p'.repeat(24)), null, 2) + '\n';
    writeFileSync(f.file, prior, { mode: 0o600 });
    const st = statSync(f.file);
    writeFileSync(`${Q}/planted-${args[0]}.json`, JSON.stringify({ sha12: sha12(Buffer.from(prior)), ino: st.ino }));
    out('planted', { id: args[0], mode: mode8(f.file) });
    break;
  }
  case 'replaced': {   // <id>: the planted file was atomically replaced by the build's bytes
    const id = args[0], f = fake(id), p = JSON.parse(readFileSync(`${Q}/planted-${id}.json`, 'utf8')), b = readFileSync(f.file);
    out('replaced', { id, differsFromPlanted: sha12(b) !== p.sha12, newInode: statSync(f.file).ino !== p.ino, equalsBuild: b.toString('utf8') === buildBytes(id), mode: mode8(f.file), stagingLeft: readdirSync(f.run).filter(n => n.startsWith('.stage-')).length });
    break;
  }
  case 'remember-project': { remember('project', projectSecret()); const l = layout(P1); out('sockets', { hubSocketBytes: bytes(l.socket), spokeSocketBytes: bytes(l.spokeSocket), hubInside: l.socket.startsWith(P1 + '/'), spokeInside: l.spokeSocket.startsWith(P1 + '/') }); break; }
  case 'records': {   // host rows (read only) and the files registerFakeHosts wrote
    const db = await openDb(); let rows;
    try { rows = db.prepare('select id,transport,state from hosts order by id').all().map(r => ({ ...r })); } finally { db.close(); }
    for (const r of rows) {
      const p = hostPaths(P1, r.id), f = fake(r.id), clientKey = readFileSync(p.clientKeyPath, 'utf8');
      if (r.state === 'registered') remember(`host-${r.id}`, hostSecret(r.id));
      out(r.id, { transport: r.transport, state: r.state,
        knownHostsMatch: readFileSync(p.knownHosts, 'utf8') === `${r.id} ${readFileSync(join(f.directory, 'host-key.pub'), 'utf8').trim()}\n`,
        clientKeyIsFake: clientKey === join(f.directory, 'client-key'), secretMode: mode8(p.secret), secretLength: readFileSync(p.secret, 'utf8').length,
        socketDirectoryInside: p.socketDirectory.startsWith(P1 + '/'), agentSocketBytes: bytes(p.agentSocket), gitSocketBytes: bytes(p.gitSocket), controlSocketBytes: bytes(p.controlSocket) });
    }
    break;
  }
  case 'svstart': {   // <id>: the shipped supervisor around the build's `cland host serve` on that fake host, detached (Node's detached spawn stands in for setsid on macOS)
    const id = args[0], f = fake(id);
    if (existsSync(join(f.run, 'supervisor.lock'))) { out('starter', { id, refused: 'a supervisor lock already exists' }); process.exit(1); }
    const { seal } = await import(`${Q}/seal.mjs`);
    const log = openSync(`${Q}/sv-${id}.log`, 'a');
    const env = seal({ CLAND_HOST_SECRET: hostSecret(id), CLAND_HOST_RUN_DIR: f.run, CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(f.directory, 'boot-id') });
    const child = spawn('/bin/sh', [`${W}/hub/src/host/agent/supervisor.sh`, f.run, process.execPath, `${W}/hub/bin/cland.ts`, 'host', 'serve'], { detached: true, stdio: ['ignore', log, log], env });
    child.unref(); writeFileSync(`${Q}/pids`, `${child.pid}\n`, { flag: 'a' }); writeFileSync(`${Q}/sv-${id}.pid`, `${child.pid}\n`);
    out('starter', { id, pid: child.pid });
    break;
  }
  case 'agent': {   // <id> <timeout ms> <label>: QA's own authenticated hello on that fake host's agent.sock; pid, version and capabilities from the hello
    const [id, ms, label] = args, f = fake(id);
    const { AgentClient } = await import(`${W}/hub/src/host/agent-client.ts`);
    const previous = existsSync(`${Q}/agent-${id}.pid`) ? readFileSync(`${Q}/agent-${id}.pid`, 'utf8').trim() : null;
    const t0 = Date.now(); let facts = null, last = '';
    while (Date.now() - t0 < Number(ms)) {
      try { const c = await AgentClient.connect(join(f.run, 'agent.sock'), hostSecret(id)); const h = c.hello; await c.close();
        if (label === 'second' && String(h.pid) === previous) { last = 'still the previous agent'; await sleep(200); continue; }
        facts = { id, label, pid: h.pid, versionIsBuild: h.version === VERSION, capabilities: h.capabilities ?? [], sameAsPrevious: previous === null ? null : String(h.pid) === previous, elapsedMs: Date.now() - t0 }; break; }
      catch (e) { last = redact(e.message); }
      await sleep(200);
    }
    out('agent', facts ?? { id, label, none: true, last });
    if (facts) { writeFileSync(`${Q}/agent-${id}.pid`, `${facts.pid}\n`); writeFileSync(`${Q}/agent-${id}-${label}.pid`, `${facts.pid}\n`); writeFileSync(`${Q}/pids`, `${facts.pid}\n`, { flag: 'a' }); }
    break;
  }
  case 'killagent': {   // <id>: the build's fake-host control SIGKILLs that host's agent after its owner and identity checks
    const id = args[0], f = fake(id);
    const { hostControl } = await import(`${W}/hub/test/fakes/fake-host.ts`);
    const { seal } = await import(`${Q}/seal.mjs`);
    const before = JSON.parse(readFileSync(join(f.run, 'agent.pid'), 'utf8')).pid;
    await hostControl('kill-agent', id, seal({ CLAND_FAKE_HOSTS: 'f1,f2', CLAND_FAKE_HOST_ROOT: FH, CLAND_HOST_SECRET: hostSecret(id) }));
    let gone = false; for (let i = 0; i < 50 && !gone; i++) { try { process.kill(before, 0); await sleep(100); } catch { gone = true; } }
    out('killagent', { id, receiptWasHello: String(before) === readFileSync(`${Q}/agent-${id}.pid`, 'utf8').trim(), gone });
    break;
  }
  case 'wait': {   // <id> <ms>: polls hub.status every 500 ms until that host is up; every distinct (state, reason) seen, in order
    const [id, ms] = args, t0 = Date.now(), seen = []; let row = null, reached = false;
    while (Date.now() - t0 < Number(ms)) {
      const s = await status().catch(() => null); row = s?.hosts?.find(h => h.name === id) ?? null;
      const key = row ? `${row.state}${row.reason ? ` (${redact(row.reason)})` : ''}` : 'no row';
      if (seen.at(-1) !== key) seen.push(key);
      if (row?.state === 'up') { reached = true; break; }
      await sleep(500);
    }
    out('wait', { id, reached, elapsedMs: Date.now() - t0, seen, reconnects: row?.reconnects ?? null });
    break;
  }
  case 'home': { process.stdout.write(`${fake(args[0]).home}\n`); break; }
  case 'dfacts': {   // <id> <label>: the canonical discovery file on that fake host, against the build's remoteDiscovery
    const [id, label] = args, f = fake(id), b = readFileSync(f.file), d = JSON.parse(b.toString('utf8')), st = statSync(f.file);
    const others = known().filter(k => k.kind !== `host-${id}`);
    const facts = { id, mode: mode8(f.file), keys: Object.keys(d), secretIsHost: d.secret === hostSecret(id), otherSecretsInBytes: others.filter(k => b.includes(k.value)).map(k => k.kind),
      pidPortRoot: [d.pid, d.port, d.root].filter(x => x !== undefined).length, equalsBuild: b.toString('utf8') === buildBytes(id), socketBytes: bytes(d.socket), spokeSocketBytes: bytes(d.spoke.slice(8, -2)),
      sha12: sha12(b), mtimeMs: st.mtimeMs, ino: st.ino, stagingLeft: readdirSync(f.run).filter(n => n.startsWith('.stage-')).length };
    out('discovery', facts); if (label) writeFileSync(`${Q}/dfacts-${id}-${label}.json`, JSON.stringify(facts));
    break;
  }
  case 'dsame': {   // <id> <label a> <label b>: digest, mtime and inode unchanged between two dfacts
    const [id, a, b] = args, x = JSON.parse(readFileSync(`${Q}/dfacts-${id}-${a}.json`, 'utf8')), y = JSON.parse(readFileSync(`${Q}/dfacts-${id}-${b}.json`, 'utf8'));
    out('same', { id, sha12: x.sha12 === y.sha12, mtimeMs: x.mtimeMs === y.mtimeMs, ino: x.ino === y.ino });
    break;
  }
  case 'clonefacts': {   // T-1604 off the readiness path: territory, hub-log clone events against tunnel events, host_worktrees, no clone or proxy on either host
    const { hasTerritory } = await import(`${W}/hub/src/territory.ts`);
    const events = readFileSync(layout(P1).log, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const db = await openDb(); let tableRows, rows;
    try { tableRows = db.prepare("select count(*) as n from sqlite_master where type='table' and name='host_worktrees'").get().n; rows = db.prepare('select count(*) as n from host_worktrees').get().n; } finally { db.close(); }
    out('clone', { territory: await hasTerritory(P1, process.env), restoreEvents: Object.fromEntries(['f1', 'f2'].map(id => [id, events.filter(e => e.event === 'host-claude-restore' && e.host === id).length])), tunnelEvents: events.filter(e => e.event === 'host-tunnel').length, cloneEvents: events.filter(e => e.event === 'host-clone').length,
      hostWorktreesTable: tableRows, hostWorktreesRows: rows, workDirectory: Object.fromEntries(['f1', 'f2'].map(id => [id, existsSync(join(dirname(fake(id).run), 'work'))])),
      gitProxy: Object.fromEntries(['f1', 'f2'].map(id => [id, existsSync(join(fake(id).run, 'git-proxy'))])) });
    break;
  }
  case 'events': {   // <label> [<base label> <ms>]: per host, hub.log's host-claude-restore events (one per SSH Host agent acquisition, with its latest state) and host-tunnel events; with a base, polls until f1's restore count exceeds it
    const [label, base, ms] = args;
    const read = () => { const ev = readFileSync(layout(P1).log, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const per = id => { const r = ev.filter(e => e.event === 'host-claude-restore' && e.host === id); return { restore: r.length, lastRestore: r.at(-1)?.state ?? null, tunnel: ev.filter(e => e.event === 'host-tunnel' && e.host === id).length }; };
      return { f1: per('f1'), f2: per('f2') }; };
    const b = base ? JSON.parse(readFileSync(`${Q}/events-${base}.json`, 'utf8')) : null, t0 = Date.now(); let v = read();
    while (b && v.f1.restore <= b.f1.restore && Date.now() - t0 < Number(ms)) { await sleep(500); v = read(); }
    out('events', { label, ...v, ...(b ? { f1RestoreGrew: v.f1.restore > b.f1.restore, f2RestoreDelta: v.f2.restore - b.f2.restore, elapsedMs: Date.now() - t0 } : {}) });
    writeFileSync(`${Q}/events-${label}.json`, JSON.stringify(v));
    break;
  }
  case 'sockets': {   // the hub-side host sockets of each host: file kind and byte count
    const kind = path => { try { return lstatSync(path).isSocket() ? 'socket' : 'other'; } catch { return 'missing'; } };
    for (const id of ['f1', 'f2']) { const p = hostPaths(P1, id); out(id, { agent: kind(p.agentSocket), git: kind(p.gitSocket), control: kind(p.controlSocket), agentBytes: bytes(p.agentSocket), gitBytes: bytes(p.gitSocket), controlBytes: bytes(p.controlSocket) }); }
    break;
  }
  case 'tcp': {   // positive control first: a planted 127.0.0.1 listener the census must see; then the TCP files of every host-side process (fake masters, supervisors, agents)
    const lsof = pids => { try { return execFileSync('lsof', ['-nP', '-a', '-p', pids.join(','), '-iTCP'], { encoding: 'utf8' }); } catch (e) { if (e.status === 1) return ''; throw e; } };
    const control = createServer(); await new Promise(r => control.listen(0, '127.0.0.1', r));
    const port = control.address().port, seen = lsof([process.pid]).includes(`:${port}`);
    await new Promise(r => control.close(r));
    out('control', { listenerSeen: seen });
    const { rows, self } = table();
    const masters = rows.filter(r => !self.has(r.pid) && r.command.includes(`${W}/hub/test/fakes/fake-ssh.ts`)).map(r => r.pid);
    const hub = Number(JSON.parse(readFileSync(join(P1, '.cland', 'hub.json'), 'utf8')).pid);
    const own = readFileSync(`${Q}/pids`, 'utf8').split('\n').map(Number).filter(p => p > 0 && p !== hub && rows.some(r => r.pid === p));
    const hostSide = [...new Set([...masters, ...own])];
    const text = hostSide.length ? lsof(hostSide) : '';
    out('tcp', { masters: masters.length, hostSideProcesses: hostSide.length, tcpEntries: text.split('\n').filter(l => / TCP /.test(l)).length });
    out('hubTcp', lsof([hub]).split('\n').filter(l => / TCP /.test(l)).map(l => l.trim().split(/\s+/).slice(-2).join(' ')));
    break;
  }
  case 'svpids': {   // <id>: the supervisor lock's pid and the agent.pid receipt on that fake host
    const f = fake(args[0]);
    const sv = Number(readFileSync(join(f.run, 'supervisor.lock', 'pid'), 'utf8').trim()), ag = JSON.parse(readFileSync(join(f.run, 'agent.pid'), 'utf8')).pid;
    out('svpids', { id: args[0], supervisorIsStarter: String(sv) === readFileSync(`${Q}/sv-${args[0]}.pid`, 'utf8').trim(), agentIsHello: String(ag) === readFileSync(`${Q}/agent-${args[0]}.pid`, 'utf8').trim(), supervisor: sv, agent: ag });
    break;
  }
  case 'census': {   // <needle…>: processes whose command line names any needle; never this probe or its ancestors
    const { rows, self } = table();
    const hits = rows.filter(r => !self.has(r.pid) && args.some(n => r.command.includes(n)));
    console.log(hits.length); for (const r of hits) console.error(redact(`${r.pid} ${r.command}`).slice(0, 160));
    break;
  }
  case 'unalias': {   // the build's removeFixtureSockets on $QA_Q/fh: the /private/tmp/ct-… alias goes
    const alias = readFileSync(`${Q}/alias`, 'utf8').trim();
    const { removeFixtureSockets } = await import(`${W}/shared/fixture-sockets.ts`);
    await removeFixtureSockets(FH);
    let gone = true; try { lstatSync(alias); gone = false; } catch {}
    out('alias', { gone });
    break;
  }
  case 'scan': {   // every secret kept, absent outside its holders under $QA_Q and $QA_EV; then the publication scanner over $QA_EV; each with a positive control
    const holders = new Set([SF, join(P1, '.cland', 'secret'), join(P1, '.cland', 'hub.json'), ...['f1', 'f2'].flatMap(id => [hostPaths(P1, id).secret, fake(id).file, join(fake(id).run, 'secret')].map(p => existsSync(p) ? realpathSync(p) : p))]);
    const files = []; const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && !holders.has(p)) files.push(p); } };
    const control = join(P1, '.cland', 'log', 'qa-scan-control.txt'), first = known().find(k => k.kind === 'host-f1');
    writeFileSync(control, `control ${first.value}\n`); walk(Q); if (EV && existsSync(EV)) walk(EV);
    const scan = () => { const hits = {}; for (const k of known()) hits[k.kind] = []; for (const f of files) { const t = readFileSync(f); for (const k of known()) if (t.includes(k.value)) hits[k.kind].push(relative(Q, f).startsWith('..') ? `<EV>/${relative(EV, f)}` : relative(Q, f)); } return hits; };
    out('control', scan()['host-f1']); unlinkSync(control); out('controlRemoved', !existsSync(control));
    files.splice(files.indexOf(control), 1);
    for (const [kind, hits] of Object.entries(scan())) out('scan', { kind, sentinels: (known().find(k => k.kind === kind)?.value.length ?? 0) >= 16 ? 1 : 0, hits });
    out('files', files.length);
    const { assertPublishable } = await import(`${W}/.agents/skills/qa/qa-demo-policy.ts`);
    const ev = []; const walkEv = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walkEv(p); else if (e.isFile()) ev.push(p); } };
    walkEv(EV);
    const publishControl = `${Q}/publish-control.txt`;
    writeFileSync(publishControl, ['to', 'ken', '=', 'a'.repeat(24)].join(''));   // made at run time: the brief's own text never carries the pattern
    for (const f of [...ev, publishControl]) { try { assertPublishable(readFileSync(f, 'utf8')); } catch { out('publishRefused', f === publishControl ? 'control' : relative(EV, f)); } }
    out('publishScan', { scanned: ev.length + 1 }); unlinkSync(publishControl); out('publishControlRemoved', !existsSync(publishControl));
    break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
}
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

The check functions. Define them in QA's own shell (paste the block once). Rows on the scratch project call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it.

```sh
PRESERVED="hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts hub/test/codex-adapter.test.ts hub/test/codex-native.test.ts hub/test/codex-workspace-git.test.ts hub/test/claude-code-adapter.test.ts hub/test/claude-code-sessions.test.ts hub/test/claude-code-schedule.test.ts hub/test/task-worktrees.test.ts hub/test/worktree-cli.test.ts hub/test/in-process-spoke.test.ts hub/test/spoke-stdio.test.ts hub/test/spoke-unix-edge.test.ts hub/test/spoke-identity.test.ts hub/test/spoke-readiness.test.ts hub/test/bridge-grace.test.ts hub/test/tool-arguments-spoke.test.ts hub/test/scenarios/hub-lifecycle.test.ts hub/test/host-agent.test.ts hub/test/host-supervisor.test.ts hub/test/host-agent-boundary.test.ts"
s00() {   # QA's own shell: build, the stage's plan facts, every landing; the T-1605 landing against its final branch head
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  # .claude/settings.local.json is left out: a pre-existing harness-local file, not run output
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1532 --json) > "$EV/E1532S4-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const s of p.stages)console.log(JSON.stringify({name:s.name,state:s.state,qa:s.qa,members:s.items,merged:s.merged,total:s.total,statuses:s.statuses,verdict:s.verdict?{result:s.verdict.result,run:s.verdict.run,current:s.verdict.current}:null}))' "$EV/E1532S4-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(s=>s.name==="harnesses and git on hosts").items.join(" "))' "$EV/E1532S4-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
  for spec in T-1605:27168d53a554937c6c6d117eec7624cff023815a:56ab49dcd474fe5071fc4a78f78eaedea29823dc; do
    id=${spec%%:*}; rest=${spec#*:}; head=${rest%%:*}; base=${rest#*:}
    L=$(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | head -n 1)
    if [ -z "$L" ]; then echo "$id landing: none"; continue; fi
    git -C "$R" show --stat --format='%H%n%s%n%b' "$L" > "$EV/$id-landing.txt"
    git -C "$R" diff --name-only "$L^1" "$L" | sort > "$EV/$id-landing-files.txt"
    git -C "$R" diff --name-only "$base" "$head" | sort > "$EV/$id-branch-files.txt"
    echo "$id landing $L; only in the landing: $(comm -23 "$EV/$id-landing-files.txt" "$EV/$id-branch-files.txt" | tr '\n' ' '); only at the branch head: $(comm -13 "$EV/$id-landing-files.txt" "$EV/$id-branch-files.txt" | tr '\n' ' ')"
  done
}
s01() {   # QA's own shell, read-only in $W: what every landing touched; preserved files unedited; exact source strings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  for id in T-1603 T-1606 T-1607 T-1604 T-1605 T-1608 T-1644; do
    L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD | head -n 1)
    [ -n "$L" ] || { echo "$id landing: none"; continue; }
    echo "$id ($L) existing test files modified: $(git -C "$W" diff --diff-filter=M --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    git -C "$W" diff --diff-filter=M --numstat "$L^1" "$L" -- hub/test web/test nvim/test | sed "s|^|  $id added/deleted: |"
    echo "$id test files added: $(git -C "$W" diff --diff-filter=A --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    echo "$id deleted or renamed paths: $(git -C "$W" diff --diff-filter=DR --name-only "$L^1" "$L" | tr '\n' ' ')"
    echo "$id paths outside hub/src, hub/test, hub/bin, shared, docs and the implement skill: $(git -C "$W" diff --name-only "$L^1" "$L" | grep -v -E '^(hub/src/|hub/test/|hub/bin/|shared/|docs/|\.agents/skills/implement/)' | tr '\n' ' ')"
    echo "$id package.json and lockfiles changed: $(git -C "$W" diff --name-only "$L^1" "$L" -- ':(glob)**/package.json' ':(glob)**/package-lock.json' | wc -l | tr -d ' ')"
    for f in $PRESERVED; do git -C "$W" diff --quiet "$L^1" "$L" -- "$f" || echo "  $id EDITED PRESERVED FILE $f"; done
  done
  node "$Q/src.mjs" "$W"
}
s02() {   # sealed, in $W: the typecheck at the build
  echo "PRE: $(git -C "$QA_W" rev-parse HEAD) node $(node --version)"
  ( cd "$QA_W" && npm run typecheck > "$QA_EV/E1532S4-02-typecheck.log" 2>&1; echo "typecheck exit $?" )
  echo "dirty entries $(git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
}
m11() {   # p1 and the fake hosts f1 and f2: init, a different discovery planted on f2, hub start, agents, both up; f2's file replaced; no clone; host_worktrees empty; host-side TCP census
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fh entries $(ls -A "$QA_Q/fh" | wc -l | tr -d ' '); fakes $(ls "$QA_W/hub/test/fakes/claude-code/claude" "$QA_W/hub/test/fakes/codex/codex" "$QA_W/hub/test/fakes/opencode/opencode" "$QA_W/hub/test/fakes/fake-ssh.ts" "$QA_W/hub/test/fakes/fake-scp.ts" | wc -l | tr -d ' '); node $(node --version); credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)'); CLAND_HOST_, CLAND_FAKE_, CLAND_SSH_ names $(env | cut -d= -f1 | grep -c -E '^CLAND_(HOST|FAKE|SSH|SCP)_'); setsid $(command -v setsid || echo none)"
  [ -z "$(command -v setsid)" ] || { echo "BLOCKED: a setsid binary on the sealed PATH would let the bootstrap start its own supervisor"; return 1; }
  ld || return 1
  git init -q -b dev && git config user.name 'QA One' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1532S4-11-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  probe mkhosts f1 f2
  probe plant f2
  hubstart; echo "hub start exit $?"; probe remember-project
  probe records
  probe svstart f1; probe svstart f2
  probe agent f1 15000 first; probe agent f2 15000 first
  probe wait f1 120000
  probe wait f2 120000
  probe dfacts f1 first; probe dfacts f2 first
  probe replaced f2
  probe clonefacts
  probe sockets
  probe tcp
  probe svpids f1; probe svpids f2
}
m12() {   # f1's agent SIGKILLed through the build's fake-host control; the shipped supervisor restarts it; f1 back up; its discovery untouched; f2 untouched
  F1=$(probe home f1); D1=$F1/.cland-host/run/hub.json
  echo "PRE: hub $(up); $(probe wait f1 5000)"
  probe svpids f1
  probe dfacts f1 before-kill; probe events before-kill
  probe killagent f1
  probe agent f1 30000 second
  probe events after-kill before-kill 30000
  probe wait f1 60000
  probe svpids f1
  probe dfacts f1 after-kill; probe dsame f1 before-kill after-kill
  probe agent f2 5000 check; probe wait f2 5000
  run "host CLI after the agent restart: hub status" hostcli "$D1" "$F1" hub status
  echo "  lines: running-remote $(has ' (remote)') pid $(has '(pid ')"
}
m13() {   # p1 hub restart: both discovery files unchanged (no write), both hosts up, still no clone, the agents kept
  echo "PRE: hub $(up); $(probe wait f1 5000); $(probe wait f2 5000)"
  probe dfacts f1 before-restart; probe dfacts f2 before-restart; probe events before-restart
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  hubstart; echo "hub restart exit $?"
  probe wait f1 120000; probe wait f2 120000
  probe dfacts f1 after-restart; probe dsame f1 before-restart after-restart
  probe dfacts f2 after-restart; probe dsame f2 before-restart after-restart
  probe events after-restart before-restart 60000
  probe clonefacts
  probe svpids f1; probe svpids f2
}
m14() {   # the secret scan and the publication scanner, each with its positive control
  echo "PRE: kinds $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).map(k=>k.kind).join(" "))' "$QA_Q/secrets1532s4.json")"
  probe scan
}
m15() {   # cleanup census: the scratch hub stopped, the supervisors and agents ended, nothing names $Q, the alias or this worktree's fakes, the alias removed
  A=$(cat "$QA_Q/alias")
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for id in f1 f2; do for p in $(cat "$QA_Q/sv-$id.pid") $(cat "$QA_Q/agent-$id.pid"); do kill -TERM "$p" 2> /dev/null; for n in $(seq 1 40); do kill -0 "$p" 2> /dev/null || break; sleep 0.25; done; echo "$id pid $p after TERM: $(alive "$p")"; done; done
  sleep 2; while read -r p; do [ -n "$p" ] && kill -0 "$p" 2> /dev/null && echo "alive $p $(ps -o command= -p "$p" | cut -c1-120)"; done < "$QA_Q/pids"
  echo "processes naming the scratch root, the alias or this build's fake ssh: $(probe census "$QA_Q" "$A" "$QA_W/hub/test/fakes/fake-ssh.ts")"
  echo "host socket directories outside p1: $(ls -d "$TMPDIR"/cland-h-* /tmp/cland-h-* 2> /dev/null | wc -l | tr -d ' ')"
  probe unalias
}
s16() {   # QA's own shell: the build after every row
  echo "HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
  echo "T leftovers other than node-compile-cache $(ls -A "$T" | grep -v -x 'node-compile-cache' | wc -l | tr -d ' ')"
}
```

Record the setup (worktree, `$Q` and `$T` with their byte counts, `launcher checked`, `expect checked`, `src checked`, `probe checked`, the zero credential-name count, the `CLAND_` name list, the `sealed nvim:` line, `sealed TMPDIR is T: yes; sealed HOME is Q/home: yes`, the `setsid` line, the three harness lines, the real-HOME `PATH` count, the p1 socket byte counts) as check `S0` with `qa-record.sh note`, its capture in `$EV/S0-env.txt`. `Q bytes` is 23, `T bytes` equals the suite root's 61. The name list must hold no `CLAND_SESSION_*`, `CLAND_ROLE`, launch credential name, `CLAND_HUB_FILE`, `CLAND_HOST_*`, `CLAND_FAKE_*`, `CLAND_SSH_*` or `CLAND_SCP_*` from QA's own session (the builder's own loopback sentinels `CLAND_DISCORD_API_ROOT`, `CLAND_TELEGRAM_API_ROOT`, `CLAND_ELEVENLABS_API_ROOT` and `CLAND_EXECUTOR_STATE` are expected). The `sealed nvim:` line names the binary `nvim/bin/nvim-path.ts` printed and `NVIM v0.12.5`. `setsid on the sealed PATH: none`; `claude`, `codex` and `opencode on the sealed PATH: none`; `sealed PATH entries under the real HOME other than node: 0`. A nonzero credential count, any harness resolved, a real-HOME entry, a missing `… checked` line, another `nvim`, or a `setsid` found makes S0 BLOCKED and every scratch row (E1532S4-11 to E1532S4-15) BLOCKED with it; a harness resolved or a real-HOME entry also blocks the file rows.

Cleanup after the evidence is recorded and E1532S4-15 removed the alias: print `$Q` and check it begins with `/private/tmp/q34-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1532-s4-` and holds nothing but `node-compile-cache`, and remove it by that literal path. A `cland-h-*` directory E1532S4-15 listed is removed by its literal path only when its name matches `hostPaths` for `$Q/p1`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The secrets in `$Q/secrets1532s4.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/run/hosts/*/secret` and the fake hosts' `hub.json` and `secret` are never printed or posted.

## Cases

none. No headless-grid case covers this stage: it has no Neovim or web change. Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. The stage changes no web surface; no browser runs.

## Manual checks

Run in this order. Rows E1532S4-03 to E1532S4-10 run their files serially from `$W` through `nt` or `rp`: cover-quiet admission before each row, the one-minute load at or below 10 and the free disk space printed before each file, `TMPDIR=$T`. Targeted files take no suite lease. They never run in parallel with each other or with the scratch rows. Rows E1532S4-11 to E1532S4-15 depend on the state the rows before them leave, in that order. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1532 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log and its `.check.txt`) first. For every file row "clean" means: every file run prints `CLEAN` in `$EV/<id>.check.txt` (exit 0; `# fail`, `# cancelled`, `# skipped` and `# todo` all 0; `# pass` equal to `# tests`; no `not ok` at any depth; no SKIP or TODO directive; no `EINVAL`; not a bare per-file wrapper; every name `expect.json` lists for that file passing, and for an `exact` file the plan equal to the list and no unlisted name). Nothing in these files is platform-gated on macOS, so a skip is a FAIL. A `FINDING` line whose only reason is a list difference on a T-1605 or T-1607 file is read against the landed source first (rule 22): a renamed or added registration that passes is recorded as a corrected list, a missing or failing one is a FAIL.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1532S4-00 | hub-api | QA | `s00 > "$EV/E1532S4-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the root's non-tracker count is recorded (E1532S4-16 compares). The stage line `harnesses and git on hosts` shows `qa` `{"scope":"affected","when":"after-stage"}`, `merged` equal to `total`, and `state` not `closed`; the lines `foundations`, `the tunnel` and `the ssh Host and the remote spoke` show `state` `closed`. Every member prints exactly one landing SHA. `T-1605 landing` names a commit (not `none`), and its `only in the landing` and `only at the branch head` lists are empty or differ only as Build allows (read each difference before judging); T-1607's landing is `81f87619bed9824df766244d2fb2965363e2c292`. Otherwise BLOCKED, reported to the requester, nothing else run |
| E1532S4-01 | hub-api | QA | `s01 > "$EV/E1532S4-01.txt" 2>&1` (QA's own shell, read-only) | Per landing, `existing test files modified` exactly: T-1603 `hub/test/fakes/opencode/fake-opencode.ts hub/test/ssh-host-fixture.ts hub/test/tiers.json` (`12 2`, `17 1`, `2 0`); T-1606 `hub/test/codex-host.test.ts hub/test/codex-sandbox-host.test.ts hub/test/host-launch-layout.test.ts hub/test/host-secret-admission.test.ts hub/test/session-host-placement.test.ts hub/test/state-paths-inventory.ts hub/test/state-paths-lint.test.ts hub/test/tiers.json` (`11 11`, `20 8`, `3 3`, `3 1`, `5 3`, `8 2`, `7 0`, `4 0`); T-1604 `hub/test/fixtures/cli-usage/commands.json hub/test/tiers.json` (`1 1`, `3 0`); T-1608 `hub/test/durations.json hub/test/tiers.json` (`7 0`, `3 0`); T-1644 `hub/test/adapter-native-boundary.test.ts hub/test/codex-remote-cleanup.test.ts hub/test/durations.json hub/test/host-agent-files.test.ts hub/test/host-boundary.test.ts hub/test/host-boundary.ts hub/test/host-contract.ts hub/test/host-launch-layout.test.ts hub/test/host-prepared.test.ts hub/test/host-ssh-contract.test.ts hub/test/launch-files.test.ts hub/test/remote-discovery-host.test.ts hub/test/remote-discovery.test.ts hub/test/session-host-placement.test.ts`; T-1605 (as at its head against `56ab49dcd`) `hub/test/claude-agent-launch.test.ts hub/test/durations.json hub/test/host-command-environment.test.ts hub/test/host-records.test.ts hub/test/tiers.json` (`29 0`, `35 0`, `30 4`, `25 0`, `62 18`); T-1607 `hub/test/durations.json hub/test/host-contract-coverage.test.ts hub/test/host-contract.ts hub/test/host-launch-layout.test.ts hub/test/host-secret-admission.test.ts hub/test/host-ssh-contract.test.ts hub/test/ssh-host-fixture.ts hub/test/state-paths-inventory.ts hub/test/state-paths.test.ts hub/test/tiers.json` (`127 0`, `6 0`, `6 0`, `9 3`, `25 0`, `4 3`, `3 3`, `12 0`, `10 1`, `4 0`). `test files added`: T-1603 `hub/test/opencode-remote-cleanup.test.ts hub/test/opencode-remote.test.ts`; T-1606 `hub/test/codex-remote-agent.test.ts hub/test/codex-remote-cleanup.test.ts hub/test/codex-remote.test.ts hub/test/launch-settlement.test.ts`; T-1604 `hub/test/fakes/fake-scp-master-loss.ts hub/test/host-clone-integration.test.ts hub/test/host-clone.test.ts hub/test/host-lease-lock.test.ts`; T-1608 `hub/test/spoke-footprint.test.ts hub/test/spoke-import-graph.test.ts hub/test/spoke-import-graph.ts hub/test/spoke-lazy-tools.test.ts`; T-1644 none; T-1605 `hub/test/host-agent-client.test.ts hub/test/host-agent-closure.test.ts hub/test/host-agent-restart.test.ts`; T-1607 `hub/test/claude-agent-launch.test.ts hub/test/claude-code-remote-files.test.ts hub/test/claude-code-remote.test.ts hub/test/claude-stop.test.ts`. `deleted or renamed paths`: empty except T-1644 `hub/src/host/local-opencode-files.ts`. `paths outside …`: empty except T-1604, T-1605 and T-1607 `hub/README.md`, and T-1644 `hub/README.md qa/briefs/E-1532-stage-3.md`. `package.json and lockfiles changed: 0` for every landing. A T-1605 difference from its head (a merge with later dev commits; `hub/test/durations.json` and `hub/test/tiers.json` most likely) is read against its landing diff before judging. **No `EDITED PRESERVED FILE` line** (the C4/C5 preservation files of T-1603, T-1606, T-1607, T-1604 and T-1608, and the agent, supervisor and agent-boundary owners). Every `src.mjs` line reads `ok`, the closure lines included (`closure.json` lists `hub/src/host/agent/claude.ts` and `hub/src/host/agent/state-paths.ts` once each); a `MISMATCH` is read at the build before judging (a renamed string is followed to its new text) and is a FAIL unless the T-1605 landing changed it with a recorded decision |
| E1532S4-02 | hub-api | QA | `( . "$Q/env.sh"; s02 ) > "$EV/E1532S4-02.txt" 2>&1` | PRE shows Node 24. `typecheck exit 0` (the whole workspace at the integrated build, T-1605 and T-1607 included), `dirty entries 0` |
| E1532S4-03 | hub-api | QA | `nt E1532S4-03 hub/test/opencode-remote.test.ts hub/test/opencode-remote-cleanup.test.ts hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts hub/test/opencode-host.test.ts` | Every run `CLEAN` (T-1603 C1 to C5; T-1644 C3 for a real OpenCode launch on a fake host). `opencode-remote.test.ts` plan `1..2` and `opencode-remote-cleanup.test.ts` plan `1..5`, every name of `expect.json`. The preservation files `opencode-adapter.test.ts` and `opencode-native.test.ts` pass whole. Read `opencode-remote.test.ts` at the build before judging: its census of the hub process asserts the planted 127.0.0.1 listener is seen first (`:44`), and after delivery and idle the census equals its baseline (`:84`, no added TCP socket, listeners or connections); its config assertion names the remote discovery file and the Host layout's spoke (`:55`); stop shows one identity stop with a `pidIdentity`, one release of the session's forward and the session socket gone (`:85`–`:90`). A weaker assertion at the build is a finding |
| E1532S4-04 | hub-api | QA | `nt E1532S4-04 hub/test/codex-remote.test.ts hub/test/codex-remote-agent.test.ts hub/test/codex-remote-cleanup.test.ts hub/test/launch-settlement.test.ts hub/test/codex-sandbox-host.test.ts hub/test/state-paths-lint.test.ts hub/test/codex-host.test.ts hub/test/session-host-placement.test.ts hub/test/codex-adapter.test.ts hub/test/codex-native.test.ts hub/test/codex-workspace-git.test.ts` | Every run `CLEAN` (T-1606 C1 to C4 and its decisions). Plans: `codex-remote.test.ts` `1..1`, `codex-remote-agent.test.ts` `1..1`, `codex-remote-cleanup.test.ts` `1..10` (literal titles and the `stage` loop expansions `forward`, `connect`, `subscription`, then `subscription`, `settlement`), `launch-settlement.test.ts` `1..4`. Read at the build before judging: `codex-remote.test.ts` asserts the policy holds the host checkout, its `.git`, the run directory's realpath and the Host `/tmp` alias's realpath, never the hub root, every one canonicalized through `Host.realpath`, no `danger-full-access` (`:66`–`:75`); the configured absolute root refuses with `host f1.*absolute writable root` and spawns nothing (`:104`–`:109`); then the missing root, the overlong socket (`Codex socket exceeds 104 bytes on host f1`), the missing `runDirectory` at launch and relaunch, and the realpath failure each refuse with no spawn. `codex-remote-cleanup.test.ts`: the failed remote handshake cleans up only through `f1` (`remote-stop`, `remote-remove`, no `LOCAL` call), the mirrored hub file still reads `hub file survives` and the colliding local process (the test's own PID) survives (`:108`–`:109`); the revoked case reports `cleanup-incomplete on host f1`; the client closes exactly once across concurrent deferred recovery and settlement completion (`:179`). `codex-workspace-git.test.ts` runs synthetic Seatbelt only, not real Codex enforcement. A weaker assertion at the build is a finding |
| E1532S4-05 | hub-api | QA | `nt E1532S4-05 hub/test/claude-code-remote.test.ts hub/test/claude-code-remote-files.test.ts hub/test/claude-agent-launch.test.ts hub/test/claude-stop.test.ts hub/test/host-secret-admission.test.ts hub/test/host-contract-coverage.test.ts hub/test/state-paths.test.ts hub/test/claude-code-host.test.ts hub/test/claude-code-adapter.test.ts hub/test/claude-code-sessions.test.ts hub/test/claude-code-schedule.test.ts` | VERIFIED at `81f87619b` (`claude-agent-launch.test.ts` at `27168d53a`, where T-1605 adds two restart-restore cases). Every run `CLEAN` (T-1607 C1 to C5 and its decisions). Plans: `claude-code-remote.test.ts` `1..21`, `claude-code-remote-files.test.ts` `1..15`, `claude-agent-launch.test.ts` `1..13`, `claude-stop.test.ts` `1..19`, every name of `expect.json`. The behaviours named in the stage scope map to: the launch receipt and generation adoption, test `remote Claude frame launch adopts its worker and delivers through host hooks and bridge` (private files `0o600`, the scan before stop lists only the private files and the pinned job record, after stop nothing; a sibling job record kept) and test `Claude receipt pins generation native birth and uid and refuses PID reuse`; the private files and job record after a confirmed stop only, test `remote Claude private credential files are removed only after confirmed stop` and test `Claude cleanup removes only the pinned job and leaves another session job intact`; the planted-credential scan after rollback, test `remote Claude failed adoption handshake joins rollback and removes its credential copies only`; the stop during turn-end hook retirement, the `retirement` expansion `pinned native hook exit between prepare and commit settles without a manual re-stop`; restart holding the role until native settlement, the five `failed Claude launch restart …` expansions and test `hub restart after tree closure re-adopts its durable generation and releases the job`; the older agent refused before any command, test `older host agent refuses Claude launch capability before starting a command`; the per-admission recapture budget, test `a new Claude stop admission starts a fresh single-use budget` and the three `Claude helper admission budget …` expansions; pinned positive exits settled before comparison, the two `pinned Claude member …` expansions; the terminal settlement owner, the two `terminal remote PID settlement …` expansions and the two `terminal generation restart retry …` expansions. The new Claude identities carry per-test duration allowances (owner C-216): Node's runner (`node --test <file>`) enforces none here, so a slow pass is not a finding and a fast one proves no budget. The preservation files `claude-code-adapter.test.ts`, `claude-code-sessions.test.ts` and `claude-code-schedule.test.ts` pass whole. `host-secret-admission.test.ts` prints a title the publication scanner refuses (T-1665): see "Probes that mislead" |
| E1532S4-06 | hub-api | QA | `nt E1532S4-06 hub/test/host-clone-integration.test.ts hub/test/host-clone.test.ts hub/test/host-lease-lock.test.ts hub/test/task-worktrees.test.ts hub/test/worktree-cli.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts` | Every run `CLEAN` (T-1604 C1 to C5 and its decisions). Plans: `host-clone-integration.test.ts` `1..6`, `host-clone.test.ts` `1..2`, `host-lease-lock.test.ts` `1..2`. The preservation files `task-worktrees.test.ts` and `worktree-cli.test.ts` pass whole; the help files pass whole with the frozen usage including the `git-proxy` line. Read at the build before judging: the C1/C3/C4/C5 case asserts `origin` `git://cland/territory.git`, `core.gitProxy` naming a file whose content runs `host git-proxy` (`:45`), the clone's `.cland/hub.json` mode 600 with the canonical bytes and unchanged on a second `ensureHostClone`, the planted provider and host values absent from the wrapper and the clone config (`:52`), the worktree at the territory branch tip, the lease line, the `node_modules` link, the failed add leaving no branch and no lease, the record surviving a `Store` reopen (`:70`), the host CLI in the worktree reaching the hub with no `CLAND_HUB_FILE`, prune through the agent and the revoked-host refusal after restart; `host-clone.test.ts` asserts the wrapper written at mode `0o700` and the clone discovery at `0o600` (`:13`); `carrier stays ready while territory clone is held and task add reports clone failure` asserts `up` while the clone is held and the refusal `host f1: territory clone failed`. A weaker assertion at the build is a finding |
| E1532S4-07 | hub-api | QA | `nt E1532S4-07 hub/test/host-agent-restart.test.ts hub/test/host-agent-closure.test.ts hub/test/host-agent-client.test.ts hub/test/host-command-environment.test.ts hub/test/host-records.test.ts hub/test/host-agent.test.ts hub/test/host-supervisor.test.ts hub/test/host-agent-boundary.test.ts hub/test/host-ssh-registry.test.ts hub/test/transport-ssh.test.ts` | VERIFIED at `27168d53a`. Every run `CLEAN` (T-1605 C1 to C4). Plans: `host-agent-restart.test.ts` `1..10` (literal titles; the `mismatch` loop gives the `kill-agent` and `version delivery` variants, the `action` loop `close` and `quiesce`, the `withOrphan` loop `closed` and `unresolved`), `host-agent-closure.test.ts` `1..4`, `host-agent-client.test.ts` `1..1`; the new names `expect.json` lists for `host-command-environment.test.ts` and `host-records.test.ts` pass. With the two restart-restore names of `claude-agent-launch.test.ts` (E1532S4-05) these are the item's new identities, whose Linux outcomes A-16553 lists. Read at the build before judging: the C1–C3 variants assert kill-to-reconciled-table under 5 s (`kill-agent`), a replacement hello with a new pid and the expected version, the retained worker row with the same identity, an empty signal receipt, the planted source-tree file seen first then absent from every delivered file and from the installed manifest, no `node_modules` in the delivered code, retention pruning the original version; `C4 corrupt and escaping bundles never become selectable` asserts an escaping path and a wrong hash both refuse, nothing selectable and nothing written outside the code root; test `C3 adopted Claude worker survives version replacement with receipt authority and no signal` asserts the replacement hello's version, the adopted worker still alive with its identity, no `ignored SIGTERM` in the scripted Claude log and the durable table row `adopted` with authority `owned` (T-1605 C3); the `Claude exit during agent downtime …` expansions assert a closed or unresolved generation stays isolated while a healthy one recovers; test `committed agent closure matches the complete source and native asset graph` regenerates the closure from source and requires it equal to the committed `closure.json`, so a stale manifest fails here; test `recovery handshake preserves previous hello shape and gates the additive restore operation` keeps an older hello compatible. The `kill-agent` variant's 5 s bound is the file's own assertion; the five per-test allowances (owner C-216, A-16553) are suite budgets that `node --test` does not enforce here |
| E1532S4-08 | hub-api | QA | `nt E1532S4-08 hub/test/spoke-import-graph.test.ts hub/test/spoke-lazy-tools.test.ts hub/test/spoke-footprint.test.ts hub/test/in-process-spoke.test.ts hub/test/spoke-stdio.test.ts hub/test/spoke-unix-edge.test.ts hub/test/spoke-identity.test.ts hub/test/spoke-readiness.test.ts hub/test/bridge-grace.test.ts hub/test/tool-arguments-spoke.test.ts hub/test/scenarios/hub-lifecycle.test.ts` | Every run `CLEAN` (T-1608 C1, C2, C4; the C4 mapping of coord 22:05Z: spoke = in-process-spoke, spoke-stdio, spoke-unix-edge, spoke-identity; spoke-reconnect = spoke-readiness, bridge-grace; spoke-tools = tool-arguments-spoke and the documented-tools census in `spoke-lazy-tools.test.ts`; scenario hub-lifecycle). Plans: `spoke-import-graph.test.ts` `1..2`, `spoke-lazy-tools.test.ts` `1..1`, `spoke-footprint.test.ts` `1..1`. The `measurement` line under `spoke-footprint.test.ts` is recorded as evidence only: `platform` `darwin`, `rssBytes` a positive integer or `null` with `unavailable` stated, `idleMs` 10000; no threshold is judged and the figure is not compared with the Linux droplet figures. Read `spoke-footprint.test.ts` at the build: it asserts only the welcome and an empty process census, never the number. `spoke-unix-edge.test.ts` prints titles the publication scanner refuses (T-1665): see "Probes that mislead" |
| E1532S4-09 | hub-api | QA | `nt E1532S4-09 hub/test/host-agent-files.test.ts hub/test/host-local-contract.test.ts hub/test/host-ssh-contract.test.ts hub/test/host-prepared.test.ts hub/test/launch-files.test.ts hub/test/host-launch-layout.test.ts hub/test/session-host-placement.test.ts hub/test/host-boundary.test.ts hub/test/adapter-native-boundary.test.ts hub/test/remote-discovery.test.ts hub/test/remote-discovery-host.test.ts hub/test/host-contract-coverage.test.ts` | Every run `CLEAN` (T-1644 C1 to C4 and its decisions), every new or renamed name of `expect.json` passing (subsets: these files carry earlier stages' cases too). `host-local-contract.test.ts` and `host-ssh-contract.test.ts` pass with every nested `register` row of `hub/test/host-contract.ts` at the build, the new publish/append/stat/rollback row included. Read at the build before judging: the `host-agent-files.test.ts` variants race create-only writers (one winner, complete bytes) and concurrent appends on the local Host and through the agent; the lost-reply variants of `host-ssh-contract.test.ts` assert the published or appended bytes exactly once after the accepted reply is dropped; test `SSH LaunchFiles refuses an older agent without stat before any file mutation` asserts no file changed; `remote LaunchFiles reads only Host metadata and bytes while the hub mirror stays unread` proves both mirror guards with its positive control first (`:111`) and then zero mirror reads while the remote file's bytes and mode 640 are restored; test `changed host secret atomically replaces prior discovery and reaches up` asserts the replacement and `up`. A weaker assertion at the build is a finding |
| E1532S4-10 | hub-api | QA | `: > "$EV/E1532S4-10.log"; rp E1532S4-10 hub/test/opencode-remote.test.ts 3 && rp E1532S4-10 hub/test/codex-remote-cleanup.test.ts 3 && rp E1532S4-10 hub/test/host-clone-integration.test.ts 2 && rp E1532S4-10 hub/test/claude-code-remote.test.ts 2 && rp E1532S4-10 hub/test/host-agent-restart.test.ts 3 && rp E1532S4-10 hub/test/remote-discovery-host.test.ts 2; node "$Q/tap.mjs" check "$EV/E1532S4-10.log" "$Q/expect.json" > "$EV/E1532S4-10.check.txt"` (QA's own shell) | The timing-sensitive files under this machine's load: every run line `CLEAN`, each with the full `exact` name list of E1532S4-03 to E1532S4-09 (the `host-agent-restart` runs at the T-1605 landing) |
| E1532S4-11 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m11 ) > "$EV/E1532S4-11.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: p1 and fh empty, `fakes 5`, `credential-prefix names 0`, `CLAND_HOST_, CLAND_FAKE_, CLAND_SSH_ names 0`, `setsid none`. `init exit 0`; `hub after init and stop: down`. `mkhosts`: for `f1` and `f2` `aliasShort` true, `aliasTarget` true, `runIsLayout` true, `runMode` `700`, every socket byte count under 104 (else BLOCKED). `planted` f2 mode `600`. `hub start exit 0`; `sockets` both under 104 and both `inside` true. `records`: `f1` and `f2` each `transport` `ssh`, `state` `registered`, `knownHostsMatch` true, `clientKeyIsFake` true, `secretMode` `600`, `secretLength` 64, every socket byte count under 104 (`socketDirectoryInside` false is the product's `cland-h-` fallback, accepted). `starter` for f1 and f2; `agent` f1 and f2 (label `first`) each with `versionIsBuild` true and `capabilities` exactly `["host-prepared-v1","claude-launch-adopt-v1","claude-restart-adopt-v1"]` (`hub/src/host/agent/server.ts:109` at `27168d53a`) (else BLOCKED: the agents did not start). `wait` f1 and `wait` f2: `reached` true within 120000 ms, `seen` recorded in order. `discovery` f1 (`first`): `mode` `600`, `keys` exactly `["remote","socket","spoke","secret","version"]`, `secretIsHost` true, `otherSecretsInBytes` `[]`, `pidPortRoot` 0, `equalsBuild` true, `stagingLeft` 0. `discovery` f2 (`first`) the same. `replaced` f2 (T-1644; superseding stage 3's refusal): `differsFromPlanted` true, `newInode` true, `equalsBuild` true, `mode` `600`, `stagingLeft` 0. `clone` (T-1604 off the readiness path): `territory` true (p1's managed territory from `cland init`), `restoreEvents` 1 or more for both `f1` and `f2` (the positive control: each is one SSH Host acquisition of an answering agent, logged to this `hub.log` after the hub serves; with either at 0 the clone sub-check is INCONCLUSIVE, never PASS), `tunnelEvents` recorded only (carrier failures during startup go to the daemon's start stream, see Probes that mislead), `cloneEvents` 0, `hostWorktreesTable` 1, `hostWorktreesRows` 0, `workDirectory` and `gitProxy` false for both hosts: both hosts are `up` with a managed territory and no clone, because no host task worktree was requested. `f1`/`f2` sockets: `agent`, `git` and `control` each `socket` (the fake master listens on its `-S` control path while alive, `hub/test/fakes/fake-ssh.ts:25`, `:81`), every byte count under 104. `control` `listenerSeen` true (else the TCP line is INCONCLUSIVE, never PASS); `tcp` `masters` 2 or more, `hostSideProcesses` 4 or more, `tcpEntries` 0 (no TCP file on any fake master, supervisor or agent); `hubTcp` recorded only. `svpids` f1 and f2: `supervisorIsStarter` true, `agentIsHello` true. If both agents answered but a host is not `up` within 120000 ms, the row is FAIL with the hub log's `host-tunnel` lines (`.cland/log/hub.log`), unless a line names a cause outside the build (a missing binary, a sandbox refusal): then INCONCLUSIVE with that line |
| E1532S4-12 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m12 ) > "$EV/E1532S4-12.txt" 2>&1` (command timeout of at least 300000 ms) | The kill control and the supervisor restart are VERIFIED at dev; the hub-side reconnect is T-1605's, VERIFIED in source at `27168d53a` (the SSH Host retries acquisition every 500 ms, `hub/src/host/ssh-host.ts:98`–`:105`; every acquisition of an agent advertising `claude-restart-adopt-v1` logs `host-claude-restore`, `hub/src/host/registry.ts:45`). PRE: hub `up`, `wait` f1 `reached` true. `events` `before-kill` recorded. `svpids` f1 before: `supervisorIsStarter` true. `killagent` f1: `receiptWasHello` true, `gone` true (the build's control checked the owner and identity, then signalled only that agent). `agent` f1 (label `second`): a new pid, `sameAsPrevious` false, `versionIsBuild` true, `capabilities` as in E1532S4-11 (the supervisor started a fresh agent). `events` `after-kill`: `f1RestoreGrew` true and `f1.lastRestore` `complete` within 30000 ms (the hub's SSH Host reacquired the restarted agent and re-read its table; no Claude generation exists here, so nothing is incomplete); `f2RestoreDelta` recorded. `wait` f1: `reached` true; `seen` recorded and expected to be `up` alone, because the carrier probes only every 30 s once `up` (`hub/src/transport/ssh.ts:315`–`:316` at `27168d53a`) and its agent forward reaches the restarted agent's socket; a transient `connecting` or `down` is recorded, not judged. `svpids` f1 after: `supervisorIsStarter` true (the same supervisor), `agentIsHello` true (its `agent.pid` names the new agent). `same` f1 `sha12`, `mtimeMs` and `ino` all true (identical bytes are never rewritten, `hub/src/host/discovery.ts:18`). `agent` f2 (label `check`): `sameAsPrevious` true; `wait` f2 `reached` true (f2 untouched). Host CLI `hub status exit 0` with `running-remote 1`, `pid 0` (the forwarded `hub.sock` answers from f1 after the agent restart; the `full status unavailable: …` line is the expected host-admission refusal, see "Probes that mislead") |
| E1532S4-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1532S4-13.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: hub `up`, both `wait` lines `reached` true. `hub after stop: down`; `hub restart exit 0`; `wait` f1 and f2 `reached` true. `same` f1 and `same` f2: `sha12`, `mtimeMs` and `ino` all true (T-1644: the identical file is read, not rewritten, across a hub restart; f2 keeps the bytes its replacement wrote). `events` `after-restart`: `f1RestoreGrew` true (the restarted hub's SSH Host acquired the surviving agent), `f2RestoreDelta` recorded. `clone` as in E1532S4-11 (`cloneEvents` 0, `hostWorktreesRows` 0, no `work` and no `git-proxy` on either host). `svpids` f1 and f2 as before (the agents outlived the hub) |
| E1532S4-14 | hub-api | Human | `( . "$Q/env.sh"; m14 ) > "$EV/E1532S4-14.txt" 2>&1` | PRE: kinds `project host-f1 host-f2`. The positive control first (rule 17): `control` is exactly `["p1/.cland/log/qa-scan-control.txt"]`, then `controlRemoved` true; no control hit makes the row INCONCLUSIVE, never PASS. Then each `scan` line (`project`, `host-f1`, `host-f2`) has `sentinels` 1 and `hits` `[]`: no secret in any file under `$Q` (hub log, journal, `hub.db`, territory, the fake hosts' logs and run files, the supervisor logs, captures, probe outputs) or `$EV`, apart from the files that hold them by design. Then `publishRefused` names `"control"` once and, besides it, only the TAP logs and check files of E1532S4-05 and E1532S4-08 whose refusal is T-1665's test titles (confirm by reading each without printing it: the only match is a title from `spoke-unix-edge.test.ts` or `host-secret-admission.test.ts`); `publishControlRemoved` true. Any other refusal under `<EV>` is a QA fault to fix before publication (never print the value); any secret hit is a FAIL naming the kind and file only |
| E1532S4-15 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m15 ) > "$EV/E1532S4-15.txt" 2>&1` | `hub stop exit 0; hub down`; every supervisor and agent pid `after TERM: no`; no `alive` line names a fixture process (an `alive` line whose command is unrelated is pid reuse, recorded, not a failure); `processes naming the scratch root, the alias or this build's fake ssh: 0`; `host socket directories outside p1` recorded; `alias` `gone` true |
| E1532S4-16 | hub-api | QA | `s16 > "$EV/E1532S4-16.txt" 2>&1` (QA's own shell) | HEAD, dev and the request's SHA still the same 40 hex; `dirty entries 0`; the root's non-tracker count equals E1532S4-00's; `T leftovers other than node-compile-cache 0`. A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1532-stage-4.md --commit <dev SHA>`, with a dev SHA that includes the T-1605 landing. At writing it passed with no findings at the T-1605 head `27168d53a` (dev through T-1607, plus T-1605); at dev `6a3d5b688` its only findings name T-1605's new files (`hub/test/host-agent-restart.test.ts`, `hub/test/host-agent-closure.test.ts`, `hub/test/host-agent-client.test.ts`) and titles. The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `6a3d5b6888c8cc44d09d99ff89c38081d1754acd` (T-1603, T-1604, T-1606, T-1607, T-1608 and T-1644 landed) and at the T-1605 head `27168d53a554937c6c6d117eec7624cff023815a` (dev through `56ab49dcd` plus T-1605; not landed). Line numbers are at `27168d53a`; a file T-1605 does not change has the same lines at dev. Re-check every string at the tested build.

- VERIFIED in source:
  - Record shapes: the hosts table `id, transport, address, user, state, secret_digest` (`hub/src/host/records.ts:21`–`:23`, listed at `:30`); `hostPaths` with `agent.sock`, `git.sock` and `ctl.sock` (`hub/src/host/records.ts:54`, `:63`); the `host_worktrees` table `(item text primary key, value text not null)` and its readers `hostWorktrees`, `saveHostWorktree`, `deleteHostWorktree` (`hub/src/hub/store.ts:34`, `:452`–`:454`); `HostTunnelStatus` and `tunnelStatuses` (`hub/src/transport/transport.ts:5`, `:24`), served as `hosts` of `hub.status` (`hub/src/hub/dispatch.ts:2181`); `remoteDiscovery` with key order `remote, socket, spoke, secret, version` (`hub/src/host/discovery.ts:7`–`:8`) and `publishRemoteDiscovery` (`:12`–`:30`: identical bytes return at `:18`, else `publishFile` with `{mode:0o600,replace:true}` at `:21`); the agent's `publishFile` staging `.stage-<uuid>` beside the path, `rename` on `replace` (`hub/src/host/agent/files.ts:15`–`:28`); the agent hello `{protocol, version, pid, bootId, capabilities: [PREPARED_HOST_CAPABILITY, CLAUDE_LAUNCH_CAPABILITY, CLAUDE_RESTORE_CAPABILITY]}` (`hub/src/host/agent/server.ts:109`), the capabilities `claude-launch-adopt-v1` and `claude-restart-adopt-v1` (`hub/src/host/agent/claude.ts:16`–`:17`); `agent.pid` `{pid, identity}` (`hub/src/host/agent/server.ts:202`); the supervisor lock's `pid` (`hub/src/host/agent/supervisor.sh`); the hub log: JSON lines `{ts, …entry}` (`hub/src/hub/journal.ts:276`) in `.cland/log/hub.log` (`hub/src/project.ts:97`); every registry log entry passes `log` → `tapped` → `processLog` (`hub/src/hub/daemon.ts:166`–`:183`), which writes to `hub.log` once `starting` is false and to the daemon's stderr before that (`:133`–`:139`; `starting = false` after `serving`, `:690`); the registry's `host-tunnel`, `host-claude-restore` and `host-clone` events (`hub/src/host/registry.ts:43`, `:45`, `:51`, `:57`, `:58`); the SSH Host's 500 ms acquisition driver and its `restoreAdoptedWorkers` call on each acquisition (`hub/src/host/ssh-host.ts:64`–`:68`, `:98`–`:105`; `restoreAdoptedWorkers` in `hub/src/host/agent-client.ts:53`–`:57`); the carrier's 30 s probe loop once `up` (`hub/src/transport/ssh.ts:315`–`:316`); the fake master listening on its `-S` control path (`hub/test/fakes/fake-ssh.ts:25`, `:81`); `hostCloneRoot` `<run>/../work/<12 hex of sha256(project)>` (`hub/src/host/clone.ts:6`); the host CLI's remote status line `hub running for <root> (remote)` then `full status unavailable: <error>` (`hub/src/cli/hub.ts:208`–`:209`); `VERSION` (`hub/src/version.ts:7`); `hostControl('kill-agent', …)` with its owner and identity checks (`hub/test/fakes/fake-host.ts:51`–`:66`); `createFakeHost` (`:13`–`:26`).
  - T-1603: `machine.forward(sessionId, { port: Number(parsed.port) })` and `OpenCode requires a Unix session forward on host ${machine.name}` (`hub/src/adapters/opencode.ts`); the `OpenCodeClient` `socketPath` constructor input (`hub/src/adapters/opencode/client.ts:40`–`:62`); the assertions of `opencode-remote.test.ts` at `:44`, `:55`, `:81`, `:84`, `:85`–`:90`.
  - T-1606: `absolute writable root is a hub-machine path` (`hub/src/adapters/sessions.ts:1100`), `cannot resolve launch policy on host ${machine.name}: ` (`:1113`), `cleanup-incomplete on host` (`:1055`); `cannot resolve Codex policy on host ${machine.name}: missing runDirectory` (`hub/src/adapters/codex.ts:188`), `Codex socket exceeds 104 bytes on host` (`:463`); `LaunchSettled` and the 5000 ms bound (`hub/src/adapters/launch-settlement.ts:2`–`:3`); ADR 0008's heading; the assertions of `codex-remote.test.ts` at `:49`, `:66`–`:75`, `:104`–`:109` and of `codex-remote-cleanup.test.ts` at `:95`, `:108`, `:109`, `:179`.
  - T-1607 (at `81f87619b`): the capability, the 0700 config-root refusal and the 0600 private writes of `src.mjs`; the ADR 0003 amendment; the stop semantics in `docs/agents/host-agent.md` (the one recapture budget of an admitted stop, positive pinned exits settled, the terminal settlement owner); every name and loop expansion of `claude-code-remote.test.ts`, `claude-code-remote-files.test.ts`, `claude-agent-launch.test.ts` and `claude-stop.test.ts`, and its added names in `host-secret-admission.test.ts`, `host-contract-coverage.test.ts` and `state-paths.test.ts`; its landing's test-file diff against `81f87619b^1`.
  - T-1605 (at `27168d53a`): every T-1605 string of `src.mjs`; `closure.json` listing 27 paths, `hub/src/host/agent/claude.ts`, `claude-stop.ts` and `state-paths.ts` among them; the registry passing `expectedVersion` only for a non-fake host (`hub/src/host/registry.ts:45`); every name and loop expansion of `host-agent-restart.test.ts`, `host-agent-closure.test.ts` and `host-agent-client.test.ts`, the two additions to `claude-agent-launch.test.ts` and one each to `host-command-environment.test.ts` and `host-records.test.ts`, matching the 19 new identities of A-16553; the C3 case's assertions (`hub/test/host-agent-restart.test.ts:180`–`:213`); the closure test comparing a regenerated closure with the committed one (`hub/test/host-agent-closure.test.ts:9`–`:15`); the branch's test-file diff against `56ab49dcd`.
  - T-1604: every `clone.ts` string of `src.mjs` (`hub/src/host/clone.ts:5`, `:11`, `:13`, `:36`); `hasTerritory` gate (`hub/src/host/registry.ts:49`); `grantBranchLeaseLocked` (`hub/src/host/branch-leases.ts:43`); `ProxyCommand=false` (`hub/src/transport/ssh.ts:201`, `:210`); `hasTerritory` true only for a managed territory (`hub/src/territory.ts:412`–`:417`); the assertions of `host-clone-integration.test.ts` at `:45`, `:52`, `:70`, `:136` and `host-clone.test.ts:13`; no named test of a host without a managed territory (a search of `hub/test/` at dev).
  - T-1608: the deferred imports (`hub/src/spoke/spoke.ts:142`, `:156`, `:387`); the measurement diagnostic and its assertions (`hub/test/spoke-footprint.test.ts`).
  - T-1644: every `host.ts`, `files.ts`, `discovery.ts` and `ignore.ts` string of `src.mjs`; the removed refusal strings and file; the assertions at `launch-files.test.ts:111`, `host-ssh-contract.test.ts:246`, `:296`, `host-agent-files.test.ts:145`, `remote-discovery-host.test.ts:147`.
  - Shared: `sshBinaries` honouring `CLAND_SSH_BIN` and `CLAND_SCP_BIN` only with both fake-host controls (`hub/src/host/ssh-binaries.ts:2`–`:4`); `fixtureEnvironment` and `scratchGitEnvironment` (`test-support/fixture-environment.ts:13`, `:82`); `assertPublishable` (`.agents/skills/qa/qa-demo-policy.ts:25`); `agentBootId`'s off-Linux requirement (`non-Linux agent requires fake host boot-id file`, `hub/src/host/agent/native.ts`); `cland session launch` sends no `host` field (`hub/src/cli/session.ts:45`), so no CLI path launches a host session.
  - Generated names were expanded from their loops by hand (`opencode-remote-cleanup.test.ts` `boundary`; `codex-remote-cleanup.test.ts` `stage` twice; `host-agent-files.test.ts` `remote`; `host-ssh-contract.test.ts` `operation` twice; `host-prepared.test.ts` `kind`; `host-launch-layout.test.ts` `existing`; `claude-code-remote.test.ts` `asynchronous`, `mode` three times, `failing`; `claude-code-remote-files.test.ts` `mode` twice, `failing`, `typed`; `claude-agent-launch.test.ts` `output`; `claude-stop.test.ts` five loops; `host-agent-restart.test.ts` `mismatch`, `action`, `withOrphan`), and `qa lint` checked every literal title at `27168d53a`.
  - The TAP shape (`1..N` at column 0 for top-level registrations, counters including nested subtests, `\#` escaping, no per-file wrapper for a file that registers) was read from Node v24.21.0's TAP reporter output on a scratch file outside the project.
- INFERRED, not verified by a run:
  - **T-1605's landing**: any change the squash landing makes against the head `27168d53a` (a merge with dev commits after `56ab49dcd`); its file list.
  - **The end-to-end scratch hub on fake hosts** (E1532S4-11 to E1532S4-13): that a CLI-started hub with `CLAND_FAKE_HOSTS=f1,f2` brings both fake hosts `up` once their agents answer (stage 3's E1532S3-10 pattern); that the f2 replacement happens on the carrier's first readiness; that each SSH Host acquires its agent after the hub serves, so `host-claude-restore` lands in `hub.log` (the source path is VERIFIED; the timing is not); that the fake masters, supervisors and agents hold no TCP file.
  - **The tunnel during an agent restart** (E1532S4-12): the source makes `up` throughout the expected reading (30 s probe, Unix forward to the restarted socket path), but a probe that lands inside the supervisor's 1 s restart gap could show `connecting` or `down` briefly; the row records `seen` and does not judge it.
  - **Status timing**: how many failed attempts a fake host shows before its agent answers (backoff with jitter), and therefore how many `host-tunnel` events reach `hub.log` rather than the start stream.

## Probes that mislead

- **No real SSH anywhere.** The scratch hub's `ssh` and `scp` are `hub/test/fakes/fake-ssh.ts` and `fake-scp.ts`, chosen through `CLAND_SSH_BIN` and `CLAND_SCP_BIN`, which the product honours only with both `CLAND_FAKE_HOSTS` and `CLAND_FAKE_HOST_ROOT` set; `launch.mjs hub` refuses to start without them. The "host" is a directory behind the `/private/tmp/ct-…` alias.
- **The bootstrap cannot start an agent on macOS, by design of the fakes.** The carrier's bootstrap runs `setsid nohup sh supervisor.sh …`; macOS has no `setsid`, and the fake ssh's one-shot environment carries no `CLAND_HOST_BOOT_ID_FILE`. So QA starts each fake host's supervisor itself (`probe svstart`, Node's detached spawn standing in for `setsid`) with the host secret the hub minted, and the bootstrap's `--check` gate finds it live and starts nothing. Before the agents answer, the hosts show `connecting` or `down` with a reason; a fake host's run directory may hold a `supervisor.log` line from the failed `setsid` and the bootstrap's `secret` file (mode 600, a holder by design). None of this is a product result.
- **Fake hosts never get a version delivery.** The registry passes `expectedVersion` only for a non-fake host (`...(fake ? {} : {expectedVersion:VERSION})`, `hub/src/host/registry.ts:45` at `27168d53a`), and the scratch agents run the build's own version anyway. E1532S4-12 shows only the agent-restart half of T-1605; the delivery half is proven by the named variant in E1532S4-07.
- **No clone without a host task worktree.** A clone happens on the first host task worktree, which needs an item launch with `host` through the frame protocol; `cland session launch` has no host flag. The scratch rows prove absence (a managed territory, both hosts `up`, no clone); presence, the proxy, the bundle fallback, leases and prune are proven by the named files in E1532S4-06. The `restoreEvents` counts are the positive control that `hub.log` holds this hub's host events; with either at 0, `cloneEvents 0` proves nothing and that sub-check is INCONCLUSIVE.
- **Where host events land.** Until the daemon sets `starting = false` right after `serving` (`hub/src/hub/daemon.ts:690`), every log entry, a carrier's `host-tunnel` failures included, goes to the daemon's start stream (stderr), not `hub.log` (`:133`–`:139`); after it, every entry the registry logs reaches `hub.log` through `tapped` (`:166`–`:183`). So the number of `host-tunnel` events in `hub.log` depends on how many carrier attempts fail after the hub serves; it is recorded, never judged. `host-claude-restore` follows an SSH Host acquisition, which needs an answering agent, which QA starts only after `cland hub start` returns, so it lands in `hub.log`.
- **The tunnel during an agent restart.** Once `up`, the carrier probes every 30 s (`hub/src/transport/ssh.ts:315`–`:316`), and its agent forward is a Unix forward to the host's `agent.sock` path, which the restarted agent recreates within about a second. The tunnel therefore normally reads `up` throughout a `kill-agent`, with `reconnects` unchanged. The agent restart is visible as the SSH Host's reacquisition (a new `host-claude-restore` for that host), not as a tunnel state.
- **The TCP census judges host-side processes only.** The scratch hub may hold TCP files of its own (a web or gateway listener); `hubTcp` is recorded, never judged. Host traffic (masters, supervisors, agents and the hub-side host sockets) is Unix-only. T-1670 (two unexplained 127.0.0.1 listeners once in a Linux `transport-forwards` census) is a known open follow-up, not a finding here.
- **Host states are asynchronous.** The carriers start after `cland hub start` returns, back off between attempts, and clear their reason at each new attempt. `probe wait` polls and records every distinct state; never judge a host by one immediate read.
- **The host CLI's status line.** From a fake host's home without a session credential, `hub status` prints `hub running for <home> (remote)` and then `full status unavailable: host frame requires its own role-holding session credential`: the forwarded socket answered and host admission refused the frame, as at stage 3. Judge the `(remote)` suffix and the missing `pid`, not the path or the refusal.
- **T-1665 and the publication scanner.** `assertPublishable` refuses any text where the Authorization scheme's name is followed by a word. The TAP logs of E1532S4-05 (`host-secret-admission.test.ts`) and E1532S4-08 (`spoke-unix-edge.test.ts`) print such test titles, so E1532S4-14 lists them as refused. That is T-1665, not a product finding and not a QA fault: keep the originals privately and publish a labelled presentation omission for those two logs and their check files, as the stage-3 run did.
- **Single-file TAP.** A file that fails to load appears as `ok 1 - <its path>` or `not ok 1 - <its path>` with plan `1..1`: it registered nothing, which `tap.mjs` reports as a finding. Helper modules (`hub/test/ssh-host-fixture.ts`, `hub/test/host-contract.ts`, `hub/test/spoke-import-graph.ts`) are never run alone.
- **Scripted fakes only.** The Claude, Codex and OpenCode cases use scripted or fake harnesses; `codex-workspace-git.test.ts` is synthetic Seatbelt, not real Codex enforcement; a passing local macOS run is not Linux parity.
- **The spoke's RSS** is a single local sample after ten idle seconds; its value is not a result of this run and is never compared with the item's Linux droplet figures.
- The named files with injected short schedules (`codex-remote-cleanup.test.ts`, `host-clone-integration.test.ts`, `host-agent-restart.test.ts`'s 5 s bound) are not latency results. Node's runner (`node --test <file>`) does not enforce the suite's per-test allowances (T-1607's and T-1605's, owner C-216, in `hub/test/durations.json`); a passing case's duration is not a result here.
- An `EINVAL` on `connect` with a path near or above 104 bytes is the macOS socket limit, not a network error: a FAIL anywhere in this run.
- `/private/tmp/ct-<32 hex>` aliases, `/tmp/cland-h-*` directories and `node-compile-cache` belong to whichever process made them; other sessions' runs make them too. Judge leftovers only by this run's own: `T leftovers`, the alias `probe unalias` removed, the `cland-h-` names `hostPaths` gives for `$Q/p1`. T-1669 (a fake Claude session reparented to launchd from an older fixture) is why the census matches only this run's paths.
- T-1668 (the git daemon's `termination incomplete` race on a short-lived daemon) can surface in a hub stop's log; it is a known open follow-up, not a finding, unless the stop itself fails.
- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live hub status and live hosts are not evidence for this stage; p1, the fake hosts, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`, or `launch.mjs`). A `cland` on PATH, or the root's CLI, may be older.
- **Credentials are secrets.** Never print a host secret, the project secret or a launch credential; never put one in a capture or a topic. E1532S4-14 proves they are absent from `$Q` and `$EV` outside the files that hold them by design.
- Transcript assertions identify stable frame ids (`qa-status` for `wait`). Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; A-9063 R2).
- Process cleanup probes use the fixture-owned census (`$Q/pids` plus processes whose command line names `$Q`, the alias or this worktree's fake ssh, never the census process or its ancestors), registered at launch and checked through exit.
- File-change probes use isolation; here the digest, mtime and inode of a file only this run's processes touch.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log (no droplet here).
- Speed criteria use measured wall times, never projections: no speed criterion is judged here; T-1605 C1's 5 s bound is the file's own assertion.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: none here; every named file must run on this macOS run.
- Re-check helper, function and message names at the tested build; renames happen, and T-1605 had not landed at writing.

## Out of scope

- A real `ssh`, `scp` or `sshd`, a real host, droplet, volume, key or network call (R-1530's QA rule); the human's `~/.ssh`; installing cland's code on a real host (E-1533).
- T-1608 C3: the Linux droplet RSS before and after (baseline 130699264 bytes at the dev-equivalent head, after 115593216 bytes, recorded in A-16395 and verified in A-16397); this local run measures macOS only, as evidence.
- A host session launched through the scratch hub: `cland session launch` has no host flag, so harness sessions on hosts, clone presence, leases and prune are proven by the named files only (E1532S4-03 to E1532S4-07).
- The live version-mismatch delivery on a fake host (fake hosts carry no expected version); the named variant proves it.
- A host with no managed territory: no named file at dev `6a3d5b688` asserts that such a host becomes ready and attempts no clone (a search of `hub/test/` for `hasTerritory`, `cland.managed`, `host-clone` and clone assertions finds only cases that configure a managed territory). That behaviour rests on the source gate `if(!await hasTerritory(options.root,options.env))return;` (`hub/src/host/registry.ts:49`) checked in E1532S4-01; E1532S4-11 shows only the related readiness-without-clone with a managed territory and no task worktree. It is not a finding of this run; a named test for it would be a follow-up for the Coordinator.
- Known open follow-ups, not findings of this stage: T-1666 (Host revoke and remove settle the host agent's session generations first), T-1667 (a droplet run's stored result drops its Executor footer and region), T-1668 (git daemon close `termination incomplete` race), T-1669 (an orphaned scripted fake-Claude session from an old fixture), T-1670 (unexplained loopback listeners in a Linux forward census), T-1671 (Codex and OpenCode failed-launch settlement lost across a hub restart), T-1672 (renaming a remote OpenCode session moves its files on the hub's machine). A failure that only one of these explains is recorded with the follow-up's id, not as a new finding.
- Later stages of E-1532: push on ref move, attach, survival and reconnect beyond the agent restart (`push, attach and survival`), relaunch elsewhere.
- The T4 soak and load repetitions beyond E1532S4-10; the full T3 and T4 suites and the stage cover pair (the Coordinator's occasion, Linux droplet and macOS); a live restart.
- A real browser, computer use, the web and Neovim workbenches, and any change to live sessions, holds or the tracker.

Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. This stage launches no browser, no real harness and no real SSH; the scratch hub, the fake ssh and scp, the fake hosts' supervisors and agents and the probe use only `$Q` paths, the build's `/private/tmp/ct-…` alias and loopback Unix sockets (plus the probe's own transient 127.0.0.1 control listener in E1532S4-11), under the rule 15 sealed environment with credentials filtered and only the fake harnesses. The run is local on macOS with fakes only.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "harnesses and git on hosts"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1532 stage harnesses and git on hosts` or `qa not clear E-1532 stage harnesses and git on hosts` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
