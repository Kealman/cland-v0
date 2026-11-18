> Historical stage-3 brief: T-1644 supersedes the different-discovery refusal and OpenCode shared-ignore refusal below. Changed discovery now atomically replaces the file and reaches up. Later stage QA must use the new behavior.

> T-1662 updates remote doctor wording: the refusal expectation and source pins
> below describe the historical build. Current doctor says the remote hub answered
> but refused admission, names the refusal class and gives credential/host repair.

# Stage QA brief: E-1532 stage 3 — the ssh Host and the remote spoke

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `stat -f`, Node 24 with `node:sqlite`, `uuidgen`, the pinned Neovim of `node nvim/bin/nvim-path.ts`). No check here is Linux-only: every named file and scratch row runs on this macOS run, and a platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, key or network (R-1530's QA rule):** the carrier runs only through the fake `ssh` stand-in of `hub/test/fakes/fake-ssh.ts` against fake hosts made by the build's own `createFakeHost` (`hub/test/fakes/fake-host.ts`); the scratch hub's two hosts are fake hosts on this Mac, whose agents are the build's `cland host serve` run by the shipped supervisor as local processes. No real harness, no launched session, no browser, no GUI.

## Corrections folded in from today's runs

This brief is new. It carries the corrections QA found today in the E-1532 stage-2, E-1536 and E-1538 runs:

- every launch is sealed through `seal.mjs` (the full `fixtureEnvironment` result with this run's inputs as overlays, then `scratchGitEnvironment`); no variable is added after the seal by an `env` prefix, an `export` or a spread of `process.env`, and the host-side CLI gets `CLAND_HUB_FILE` only through `launch.mjs hostcli`;
- Neovim comes from the build's pinned release (`node nvim/bin/nvim-path.ts`, v0.12.5), first on the sealed `PATH`, never a Homebrew `nvim`;
- the whole brief passes the publication scanner (`assertPublishable`), and the captures are scanned with a positive control before recording;
- the process census excludes its own pid, and the root's non-tracker status leaves out `.claude/settings.local.json`;
- every Unix socket path is measured with its NUL against 104 bytes, every named file runs with `TMPDIR` at a root exactly as long as the suite's `/private/tmp/cland-suite-<36-char uuid>`, and the shared helpers' short aliases (`/tmp/cland-h-*` from `hostPaths`, `/private/tmp/ct-*` from `fixtureSocketPath`) are accepted as the product's own fallbacks, not as leaks;
- ids come from listings (the hosts table, the agent's own hello), never from a send or create result (rule 22); frame ids are the probe's own `qa-<n>`;
- every record shape is read from its producer, cited by path under "Source provenance";
- helper modules are never run alone under the Node test runner and judged by a "registered 0" count: `hub/test/ssh-host-fixture.ts` and `hub/test/host-contract.ts` run only through their entry files;
- a fake host on macOS needs `CLAND_FAKE_HOSTS` and `CLAND_HOST_BOOT_ID_FILE` in its agent's environment (`agentBootId`, `hub/src/host/agent/native.ts`);
- asynchronous start work is read as a sequence, never as one immediate read: the hub's carriers start after `cland hub start` returns, so host states are polled (`probe wait`) and every state seen is recorded in order.

## Stage

- Epic: E-1532 (The SSH transport, the host agent and git through the tunnel, under R-1530).
- Exact stage name: the ssh Host and the remote spoke.
- Items, in plan order by lane: lane 1 T-1598 (Per-session forwards on the master), then T-1599 (The ssh Host over the host agent), then T-1600 (The remote hub.json and the spoke over ws+unix:); lane 2 T-1602 (The ADR 0003 and ADR 0004 amendments); lane 3 T-1657 (registerFakeHosts reads host keys at the fake-host root, but createFakeHost now writes them behind the short-socket alias). The run reads the stage's members, counts and state from `task plan show E-1532` (E1532S3-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: affected. The stage's combined changed behaviour at the tested build:
  - T-1598: per-session forwards on the live master (`-O forward -L` from a hub-side Unix socket under the host's socket directory to a host Unix socket or a host loopback port; `-O cancel` and socket removal; re-added after every reconnect with a short retry, `[100, 200]` ms by default, then logged once per session as `forward abandoned after 3 attempts`); retained cleanup ownership through unlink failures; no hub-side TCP listener. Its decision (Coordinator a1375ab0): the tests inject short schedules (`reconnectDelayMs`, `forwardRetryDelaysMs`) instead of a duration allowance; production defaults unchanged.
  - T-1599: the `ssh` Host (`hub/src/host/ssh-host.ts`): every Host operation through the agent client over the tunnel; `limitPolls` false; its layout names the host's paths; operations refuse while the tunnel is not `up`, naming the host and the tunnel; the hub registers one `ssh` Host per registered host record and starts its tunnel (`hub/src/host/registry.ts`, `hub/src/hub/daemon.ts`). Its decisions: additive two-phase agent operations (prepare, capture, install, commit, abort, settle) behind the advertised capability `host-prepared-v1`, the monolithic frames unchanged, an agent without the capability refused by name (04ee649d, seam note on T-1593); the remote layout constants in one module (`hub/src/host/remote-layout.ts`: `~/.cland-host`, `code/<VERSION>`, `run`, `log`; E-1533 fills the code directory, correction on T-1595 09:58Z); `hostCommandEnvironment` (`hub/src/host/command-environment.ts`): `local` keeps its effective environment, a nonlocal Host gets only the explicit additions minus the executor credentials, `CLAND_HUB_SECRET`, `CLAND_PROJECT_SECRET` and every `CLAND_HOST_*` (12a3c390); the per-Host contract row (87a51dc5: only the local-specific expected-value row of `hub/test/host-contract.ts` is parameterized; every behavioural row runs unchanged); the agent boundary allowlist of exactly `shared/executor-credentials.ts`, importable only by the agent's environment owner (a5d3ae17); the stop-race fix (baaf0066: `isCapturedOrExited` accepts a positive end before comparing a captured birth); OpenCode's remote spawn refused until T-1644 (11a86342), with T-1599's C2 proven end to end for Claude and Codex.
  - T-1600: the remote discovery kind (`shared/project-discovery.ts`: `remote: true`, `socket`, `spoke` as `ws+unix:<path>:/`, `secret`, `version`, no `pid`, no `port`); the hub writes it through the agent at the canonical `~/.cland-host/run/hub.json` only (ecff0d3a; the clone copy is T-1604's job) with mode 0600, from the carrier's `beforeReady(signal)` after the probe and forward restoration and before `up` (4d4f7a7e, f3e4c421): a deadline (30 s by default) aborts the signal, a separate drain bound (1 s by default) waits for the callback, and an undrained callback leaves the host `connecting` with the reason `host readiness cleanup incomplete`, keeps the master and claim, starts no retry, and makes `stop` reject; an identical existing file is success without a write; an existing different file is refused (`host discovery differs; atomic replacement required`, host `connecting`) until T-1644; the spoke takes its endpoint and secret from the file and re-reads it before each reconnect; `cland hub status`, `cland doctor` and the hook CLI never pid-check a remote file and reach the hub through its socket; doctor honours an explicit `CLAND_HUB_FILE` (correction 28833af7: the existing doctor test seeds its explicit file); `cland hub stop` and `cland hub start` refuse to manage a remote hub; the help text gains the `CLAND_HUB_FILE` lines.
  - T-1602: dated amendments of ADR 0003 (Host sockets and per-host authority) and ADR 0004 (territory access through the Tunnel), linking spec v0.4 §3.2, §3.3 and §3.12 and the glossary's Hosts entries.
  - T-1657: one shared fake-host directory resolver (`shared/fake-host-directory.ts`) used by `createFakeHost` and the hub's `registerFakeHosts`, so a hub started on a fresh `createFakeHost` root registers each fake host with the key it wrote and an existing client-key path, also under a suite-length `TMPDIR` on macOS.
- Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

The run is meant to take about 1.5 to 2 hours: setup, E1532S3-00 to E1532S3-02 about 15 minutes (the typecheck included); the named files E1532S3-03 to E1532S3-09 about 45 minutes, one file at a time; the scratch rows E1532S3-10 to E1532S3-17 about 30 minutes. Waits for cover-quiet admission or load come on top and are not product results.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what.

| criterion | proven by |
| --- | --- |
| T-1598 C1 (a forward to a host Unix socket and to a host loopback port each give a hub-side Unix socket under the host's directory; no hub-side TCP listener) | E1532S3-03 (`transport-forwards.test.ts`, its `lsof` census with a planted TCP positive control); E1532S3-09 (repeated); E1532S3-01 (`'-O', operation, '-L', spec`, the session socket from `hostPaths`) |
| T-1598 C2 (cancelling removes the forwards from the master and their socket files) | E1532S3-03 (the C1/C2 case and the retained-unlink cancellation case); E1532S3-09 |
| T-1598 C3 (after a SIGKILLed master every recorded forward is back within the retry window; one that keeps failing is logged once with its session and given up) | E1532S3-03 (the SIGKILL, exhaustion, restore-exhaustion and failed-install cases); E1532S3-09; E1532S3-01 (`forward abandoned after 3 attempts`, the default `[100, 200]`, the injected test schedule of decision a1375ab0) |
| T-1599 C1 (the Host contract suite passes on a fake host through the fake `ssh`) | E1532S3-04 (the contract wrapper in `host-ssh-contract.test.ts` and every nested `register` subtest of `hub/test/host-contract.ts`, the prepared-operation repairs); E1532S3-05 (`host-local-contract.test.ts` and `host-contract-coverage.test.ts`: the local side of the same contract unchanged); E1532S3-01 (the per-Host row: three hunks in `host-contract.ts`, no `register` name changed) |
| T-1599 C2 (a fake-host spawn carries none of the hub's environment; the DigitalOcean and remote tokens and the project secret never reach it, even when passed) | E1532S3-04 (the C2 case with its monolithic positive control; the generated Claude and Codex adapter cases; `host-command-environment.test.ts`; the OpenCode refusal case); E1532S3-01 (the deny-list and the boundary leaf) |
| T-1599 C3 (registry holds `local` and one `ssh` Host per record; a launch with `host: "f1"` reaches f1's agent; `CLAND_TEST_HOSTS` still works) | E1532S3-04 (the C3 case; `host-ssh-registry.test.ts`); E1532S3-05 (`transport-status.test.ts` migrated to an injected Host); E1532S3-10 (a CLI-started hub builds an `ssh` Host per fake record and brings f1's tunnel `up` through the shipped registry) |
| T-1599 C4 (while a tunnel is down, operations fail naming the host and the tunnel and never touch the hub's machine) | E1532S3-04 (the C4 case with its process census and absent file; the down-tunnel unit case); E1532S3-01 (`tunnel is not up`, `tunnel admission revoked`) |
| T-1599 C5 (a fake-host row is alive only while its agent reports the recorded identity; stop signals only on that host) | E1532S3-04 (`stop closes retained descendants after its recorded root has exited`, the contract's stop and spawn rows, `host-stop-observation.test.ts`, the stop-race case of `host-prepared.test.ts`); E1532S3-01 (`isCapturedOrExited`) |
| T-1600 C1 (`readDiscovery` accepts a remote file without pid and port, refuses malformed ones, reads every local file as before) | E1532S3-06 (`remote-discovery.test.ts`; `project-layout.test.ts`, `spoke-unix-edge.test.ts`, `in-process-spoke.test.ts` unedited); E1532S3-10 (the written file is the remote kind, no `pid`, `port` or `root`); E1532S3-01 |
| T-1600 C2 (a spoke with a remote file connects through `ws+unix:` with the per-host secret and re-reads the file before each reconnect) | E1532S3-06 (the split C2, C4 and C5 cases: welcome, changed-secret refusal at reconnect, restoration); E1532S3-11 (the forwarded `spoke.sock` on f1 upgrades with the file's secret); E1532S3-01 (`url: d.remote ? d.spoke`) |
| T-1600 C3 (status, doctor and the hook CLI never pid-check a remote file and reach the hub through its socket) | E1532S3-06 (`remote-discovery-cli.test.ts`, `doctor.test.ts`, `cli-usage-compatibility.test.ts`, `cli-help.test.ts`); E1532S3-11 (on f1, with `CLAND_HUB_FILE` through the seal: `hub status` and `--json` with no pid, `doctor --json` rows, `hub stop` refused, an unanswered remote socket reported without a pid); E1532S3-01 |
| T-1600 C4 (on a fake host the file is 0600, holds the host's secret, never the project secret, unchanged across a hub restart) | E1532S3-06 (the split C4 case and the publication cases); E1532S3-10 (mode 600, the f1 secret only, byte-equal to the build's `remoteDiscovery`); E1532S3-13 (same digest and mtime after a hub restart: the writer skipped); E1532S3-15 (no secret outside its holders) |
| T-1600 C5 (a credentialed spoke connects through `spoke.sock`; after `cland host revoke` its next hello is refused) | E1532S3-06 (the split C5 case); E1532S3-14 (after the CLI revoke, over f1's forwards: `host secret revoked` on `hub.sock`, 401 `Host revoked` on `spoke.sock`, the host CLI reports the remote hub unanswered; f2 unaffected) |
| T-1600 decisions (beforeReady with abort and drain, cleanup-incomplete, different-file refusal, explicit `CLAND_HUB_FILE` in doctor) | E1532S3-06 (`readiness timeout aborts and drains before autonomous retry`, `undrained readiness fences ownership and stop reports cleanup incomplete`, the publication RPC case, the changed-discovery case, the different-discovery unit case, `doctor.test.ts`); E1532S3-10 and E1532S3-13 (f2 `connecting` with `host discovery differs; atomic replacement required`, planted bytes and mode kept); E1532S3-12 (the `cland hub status` print of `host readiness cleanup incomplete`); E1532S3-01 |
| T-1602 C1 (ADR 0003 dated amendment: `.cland/run/spoke.sock`, per-host git socket, per-host secret without human authority, no new network bind) | E1532S3-08 |
| T-1602 C2 (ADR 0004 dated amendment: `git daemon --inetd` per connection on per-host sockets, allow list and revocation before merges, deletions and `dev`/`main` refused, item branches created in the territory) | E1532S3-08 |
| T-1602 C3 (both link spec §3.2, §3.3, §3.12 and the glossary's Host, Host agent and Tunnel) | E1532S3-08 (the links, their targets, and `test-docs.test.ts`) |
| T-1657 C1 (a hub started on a fresh `createFakeHost` root registers each fake host with the key it wrote and an existing client-key path) | E1532S3-07 (`host-records.test.ts`, the generated `true` and `suite-tmpdir` variants); E1532S3-10 (a CLI-started hub on a fresh root: `knownHostsMatch` and `clientKeyIsFake`, `clientKeyExists` for f1 and f2) |
| T-1657 C2 (the same under a `/private/tmp/cland-suite-<uuid>` `TMPDIR` on macOS) | E1532S3-07 (the generated `suite-tmpdir` variant, and the whole file under `$T`, a root as long as the suite's) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1532` lists in stage `the ssh Host and the remote spoke`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit.

At writing, dev was `d7beb363e3977e168a4db394dde53e9dec965833`, and these members had landed: T-1657 `da225fb50a4e3e4aa9203a0f636a663a81cf2449`, T-1602 `81d84169c8f246714f25a51462c2a421f6dd649e`, T-1598 `54e32c63df7d7aa40e7cd88fc87f7045bffc64b8`, T-1599 `aa42c6efdd56a5e2def4b88fea2804e02e726d62`. **T-1600 had not landed:** it was queued, final evidence clear (rev-36-1600-final-1, A-16301) at its branch `t/T-1600-the-remote-hub-json-and-the-spoke-over` head `765db463f2e74a42c45462bea3b0c222a89be5f0`, whose parent chain starts at dev `d7beb363e`. Every T-1600 expectation in this brief was read from that head. **The run re-reads the landing: the request must name a dev SHA that includes the T-1600 landing as well as every other member's; a dev SHA without it is BLOCKED (E1532S3-00), reported to the requester, nothing else run.** E1532S3-00 saves the T-1600 landing (`git show --stat`) as `$EV/T-1600-landing.txt` and compares its file list with the branch head's own changes against `d7beb363e`, which were `.agents/skills/implement/CHANGES/T-1600-consumers.md`, `.agents/skills/implement/CHANGES/T-1600-remote-discovery.md`, `docs/agents/session-permissions.md`, the test-guide note for `hub/test/remote-discovery-host.test.ts` in `docs/agents/tests/`, `docs/agents/tests/index.md`, `docs/hub/remote-discovery.md`, `hub/README.md`, `hub/src/cli/hub.ts`, `hub/src/cli/task-import.ts`, `hub/src/cli/task.ts`, `hub/src/cli/usage/doctor.ts`, `hub/src/cli/usage/hub.ts`, `hub/src/doctor/project.ts`, `hub/src/doctor/remotes.ts`, `hub/src/host/discovery.ts`, `hub/src/host/registry.ts`, `hub/src/hub/daemon.ts`, `hub/src/project.ts`, `hub/src/spoke/spoke.ts`, `hub/src/transport/readiness.ts`, `hub/src/transport/ssh.ts`, `hub/test/doctor.test.ts`, `hub/test/fixtures/cli-usage/commands.json`, `hub/test/remote-discovery-cli.test.ts`, `hub/test/remote-discovery-host.test.ts`, `hub/test/remote-discovery.test.ts`, `hub/test/tiers.json` and `shared/project-discovery.ts`. A landing whose list differs is read before judging: a test file it adds is also run in E1532S3-06, a source change is re-grepped, a `hub/test/durations.json` or `hub/test/tiers.json` merge change is timing or tier data, not a test.

**Every expected string in this brief (refusal texts, status lines and fields, CLI usage and output, doctor rows, socket and file names, test titles) was copied with grep from source at dev `d7beb363e` (T-1598, T-1599, T-1602 and T-1657 landed) or at the T-1600 head `765db463f` (which contains dev `d7beb363e`), never paraphrased. Each is marked verified or inferred under "Source provenance" below. The run re-greps them at the tested build (E1532S3-01 and the `PRE:` lines) and reads a renamed string before judging.** A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). No named file here needs `web/dist`; E1532S3-02 runs the typecheck only.

**Where things live.** All scratch state is outside the project root: the scratch root `$Q` is `/private/tmp/q33-…` (its realpath, 23 bytes; see "Unix socket paths"), and it holds the scratch project p1, the fake-host root `$Q/fh`, the scratch HOME and XDG directories and every helper file. The fake hosts' directories are reached through the build's short alias `/private/tmp/ct-<32 hex>` (a symlink to `$Q/fh/.fixture-sockets`, made by `fixtureSocketPath` and removed by `removeFixtureSockets` in E1532S3-16). `$T` (`/private/tmp/qa-e1532-s3-<uuid>`) is the `TMPDIR` of every sealed command. The only paths under the repository are the ones the QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1532/`. Nothing is written to `.cland/tasks/`; E1532S3-00 and E1532S3-17 print the root's non-tracker status, which must not change.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays, then `scratchGitEnvironment` with a scratch `core.excludesFile`, then the broader credential prefixes removed (the builder sequence of the E-1532 stage-2 and E-1538 stage-2 briefs). It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, `SSH_*`, provider and account variable, keeps `PATH` (with the pinned Neovim first), `SHELL` and `TERM`, sets `TMPDIR` to `$T`, and synthesizes its own scratch values under `$Q`. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its territory, its `hub.db` or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, the live `hub.json` or `~/.config/cland/sandbox-remote.secrets.toml`; never run a real `ssh`, `scp` or `sshd`, never read a real `known_hosts` or key. The live hub is read only by QA's own shell for E1532S3-00's plan read and `quiet` (cover-quiet admission: the live verify queue is read, nothing is submitted). **Harnesses:** only the fakes in `$W/hub/test/fakes/` (`CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, first on the scratch hub's `PATH`); no session is launched. **SSH:** the scratch hub's carrier runs `$W/hub/test/fakes/fake-ssh.ts` through `CLAND_SSH_BIN`, which the product honours only when `CLAND_FAKE_HOSTS` and `CLAND_FAKE_HOST_ROOT` are both set (`sshBinaries`, `hub/src/host/ssh-binaries.ts`); without both it would run the real `ssh`, so `hubstart` checks them before launching. **Browser (rule 18):** none. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting, and every refusal check follows a positive control named in its row; when a `PRE:` line or a control differs from the row's stated expectation, record the row `BLOCKED` with the line and stop the dependent rows. An inferred string is never a pass condition on its own. **Secrets (rule 15):** the scratch project secret and the two host secrets are never printed, posted or written under `$EV`; the probe prints lengths, modes, digests and booleans only, keeps the values in `$Q/secrets1532s3.json` (mode 600) and redacts every captured output through them; E1532S3-15 scans for them, and runs the publication scanner, each with a positive control.

**Unix socket paths (macOS 104 bytes, NUL included).** Every socket this run makes or connects to stays under 104 bytes:
- The scratch rows: `$Q` is `/private/tmp/q33-XXXXXX` (23 bytes) and p1 is `$Q/p1` (26 bytes), so the hub socket `.cland/hub.sock`, the spoke socket `.cland/run/spoke.sock` and the host socket directory `.cland/run/hosts/<id>/` stay inside the project. `hostPaths` (`hub/src/host/records.ts`) keeps the host socket directory inside the project only when its longest socket name fits 80 bytes (`SOCKET_PATH_MAX` 100 minus 20); otherwise it falls back to `$TMPDIR/cland-h-<20 hex>`, then `/tmp/cland-h-<20 hex>`, both accepted as the product's own fallback (the probe prints `socketDirectoryInside`, and a fallback outside `$Q` is recorded, then removed in E1532S3-16 only if it is this run's). The fake hosts' run directories are `/private/tmp/ct-<32 hex>/<id>/home/.cland-host/run` (72 bytes), so their `agent.sock`, `spoke.sock` and `hub.sock` are 82 to 84 bytes with the NUL. The probe prints each byte count; a count of 104 or more makes the row BLOCKED.
- The named files: every one runs with `TMPDIR=$T`, `/private/tmp/qa-e1532-s3-<uuid>` (61 bytes), the same length as the suite's `/private/tmp/cland-suite-<uuid>`. The files make their own sockets, under the shared short-socket helper (`fixtureSocketPath`, `/private/tmp/ct-<32 hex>` aliases), under `hostPaths`' short fallback, or, for `sshHostFixture` (`hub/test/ssh-host-fixture.ts`), under its own `/private/tmp/cland-suite-<uuid>` root regardless of `TMPDIR`, each asserted below 104 bytes inside the files. An `EINVAL` on connect is a FAIL here.

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree and the scratch roots, runs `quiet` and the plan read, runs the named test files through `nt` and `rp` (which seal each run with `$Q/env.sh`), runs the read-only source checks and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. Never use `env -i`.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-1532; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1532s3-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1532/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts); NVD=$(dirname "$NV")   # the pinned Neovim of nvim/NVIM_VERSION; never a Homebrew nvim
T=/private/tmp/qa-e1532-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"   # TMPDIR of every sealed command: the suite root's length
Q=$(cd "$(mktemp -d /tmp/q33-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/q33-…, 23 bytes
chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/p1" "$Q/fh" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/claude" "$Q/codex"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# ld: the one-minute load must be 10 or below before each test file (docs/agents/tests.md load rule); prints free disk space too
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l; free kB $(df -k "$T" | awk 'NR==2{print $4}')"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10 after 10 minutes: $l"; return 1; }
# nt <id> <files…>: named files from $W, sealed by $Q/env.sh (TMPDIR=$T), one file at a time, TAP output, after quiet and ld; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; : > "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; grep -E '^exit ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP|EINVAL' "$EV/$id.log" | head -20; }
# rp <id> <file> <repetitions>: one named file repeated, as nt otherwise, appending to $EV/<id>.log; its own local loop variable (ld's global `for i` would reset a shared `i`)
rp() { local rep; quiet || return 1; for rep in $(seq 1 "$3"); do ld >> "$EV/$1.log" || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$2" >> "$EV/$1.log" 2>&1; echo "exit $? $2 run $rep" >> "$EV/$1.log" ); done; grep -E '^exit ' "$EV/$1.log"; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
```

The seal. `seal.mjs` is the E-1532 stage-2 seal with the E-1538 stage-2 `env` mode and roots: it prints the core of `env.sh`, and exports `seal(extra, front)` for every launch that needs inputs of its own. `launch.mjs` is the stage-2 launcher with the modes this stage needs.

```sh
cat > "$Q/seal.mjs" <<'JS'
// node "$Q/seal.mjs" env <W> <Q> <EV> <T> <nvim dir> <R>   QA's own shell: the sealed env.sh core (unset and export lines)
// const { seal } = await import(`${QA_Q}/seal.mjs`)         sealed: seal(extra, front) for one launch
// Every environment is fixtureEnvironment(Q, base, overlays), then scratchGitEnvironment, then the credential prefixes removed: nothing is added after.
import { fileURLToPath } from 'node:url';
const base = process.env;
const cli = process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'env';
const [W, Q, EV, T, NV, R] = cli ? process.argv.slice(3) : [base.QA_W, base.QA_Q, base.QA_EV, base.QA_T, base.QA_NVIM, base.QA_R];
if (!W || !EV || !NV || !R || !/^\/private\/tmp\/q33-[A-Za-z0-9]+$/.test(Q ?? '') || !/^\/private\/tmp\/qa-e1532-s3-[0-9a-f-]{36}$/.test(T ?? '')) {
  console.error('seal: refused: not this run\'s scratch roots'); process.exit(2);
}
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
const rest = String(base.PATH ?? '').split(':').filter(p => p && p !== NV && !p.startsWith(`${W}/hub/test/fakes`) && !p.startsWith(`${Q}/`));
export function seal(extra = {}, front = []) {
  const env = scratchGitEnvironment(Q, fixtureEnvironment(Q, base, {
    PATH: [...front, NV, ...rest].join(':'), TMPDIR: T,
    XDG_CONFIG_HOME: `${Q}/xdg/config`, XDG_STATE_HOME: `${Q}/xdg/state`, XDG_DATA_HOME: `${Q}/xdg/data`, XDG_CACHE_HOME: `${Q}/xdg/cache`,
    GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid', GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
    QA_W: W, QA_Q: Q, QA_EV: EV, QA_T: T, QA_NVIM: NV, QA_R: R,
    ...extra,
  }), { excludesFile: `${Q}/home/.gitignore-global` });
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
// node "$QA_Q/launch.mjs" hub                                   sealed, in p1: cland hub start with the fakes, the fake hosts f1 and f2 and the fake ssh
// node "$QA_Q/launch.mjs" hostcli <discovery file> <cwd> <args…> sealed: the build's cland as a host-side client, CLAND_HUB_FILE given to the seal
import { spawn } from 'node:child_process';
const { seal } = await import(`${process.env.QA_Q}/seal.mjs`);
const [mode, ...args] = process.argv.slice(2), Q = process.env.QA_Q, W = process.env.QA_W;
const F = `${W}/hub/test/fakes`;
let argv, env, cwd = process.cwd();
if (mode === 'hub') {   // the fake harnesses authoritative and first on PATH, no machine-wide orphan sweep; both fake-host controls, so CLAND_SSH_BIN is honoured
  env = seal({ CLAND_CLAUDE_BIN: `${F}/claude-code/claude`, CLAND_CODEX_BIN: `${F}/codex/codex`, CLAND_OPENCODE_BIN: `${F}/opencode/opencode`,
    CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_ADAPTER_POLL_MS: '200', CLAND_CLAUDE_AGENTS_MS: '500',
    CLAND_FAKE_HOSTS: 'f1,f2', CLAND_FAKE_HOST_ROOT: `${Q}/fh`, CLAND_SSH_BIN: `${F}/fake-ssh.ts` }, [`${F}/claude-code`, `${F}/codex`, `${F}/opencode`]);
  if (!(env.CLAND_FAKE_HOSTS && env.CLAND_FAKE_HOST_ROOT && env.CLAND_SSH_BIN)) { console.error('launch: refused: a fake-host control is missing; the carrier would run the real ssh'); process.exit(2); }
  argv = [`${W}/hub/bin/cland.ts`, 'hub', 'start'];
} else if (mode === 'hostcli') {
  const [file, dir, ...rest] = args;
  env = seal({ CLAND_HUB_FILE: file }); cwd = dir; argv = [`${W}/hub/bin/cland.ts`, ...rest];
} else { console.error(`launch: unknown mode ${mode}`); process.exit(2); }
const child = spawn(process.execPath, argv, { cwd, env, stdio: 'inherit' });
child.on('error', error => { console.error(`launch: ${error.message}`); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
JS
node --check "$Q/seal.mjs" && node --check "$Q/launch.mjs" && echo "launcher checked"
node "$Q/seal.mjs" env "$W" "$Q" "$EV" "$T" "$NVD" "$R" > "$Q/env.sh" || echo "BLOCKED: seal env failed"
cat >> "$Q/env.sh" <<'ENV'
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: fake hosts, host records, tunnel clients, discovery facts, census and scans (probe.mjs)
probe() { node "$QA_Q/probe.mjs" "$@"; }
# hostcli <discovery file> <cwd> <cland args…>: the build's CLI as a host-side client, CLAND_HUB_FILE through the seal
hostcli() { node "$QA_Q/launch.mjs" hostcli "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart: start this project's hub through the seal (fakes, fake hosts f1 and f2, fake ssh); census its pid
hubstart() { node "$QA_Q/launch.mjs" hub && hp >> "$QA_Q/pids"; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
# run <label> <command…>: exit status, then the first lines of stdout and stderr, both redacted
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; probe redact < "$QA_Q/r.out" | head -n 30 | sed 's/^/  out: /'; probe redact < "$QA_Q/r.err" | head -n 30 | sed 's/^/  err: /'; }
# has <text>: how many lines of the last run's output contain the text
has() { cat "$QA_Q/r.out" "$QA_Q/r.err" 2> /dev/null | grep -c -F -- "$1"; }
ENV
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
( . "$Q/env.sh"; echo "sealed nvim: $(command -v nvim); $(nvim --version 2> /dev/null | head -n 1)"; echo "sealed TMPDIR is T: $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no)"; echo "setsid on the sealed PATH: $(command -v setsid || echo none)" )
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')"
echo "p1 hub.sock $(( $(printf '%s' "$Q/p1/.cland/hub.sock" | wc -c) + 1 )); spoke.sock $(( $(printf '%s' "$Q/p1/.cland/run/spoke.sock" | wc -c) + 1 ))"
```

The probe. It refuses to run outside `$Q`, imports only from `$W`, never prints a secret and never runs a real `ssh`. Its record shapes come from their producers: the hosts table (`hub/src/hub/store.ts`, read as stage 2 read it), `HostTunnelStatus` and `tunnelStatuses` (`hub/src/transport/transport.ts:5–8` and `:24–27`, served as `hosts` of `hub.status` by `hub/src/hub/dispatch.ts:2181`), the remote discovery (`remoteDiscovery`, `hub/src/host/discovery.ts:7–8`), the host files (`hostPaths` and `HostSecretStore.register`, `hub/src/host/records.ts:54–64` and `:79–98`), the agent's hello (`hub/src/host/agent/server.ts:90`).

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> [args…]   (sealed) fake hosts, records, tunnel clients, discovery facts, census, scans
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, unlinkSync, openSync, lstatSync, realpathSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
const W = process.env.QA_W, Q = process.env.QA_Q, EV = process.env.QA_EV;
if (!W || !/^\/private\/tmp\/q33-[A-Za-z0-9]+$/.test(Q ?? '')) { console.log(JSON.stringify({ refused: 'not a scratch run' })); process.exit(2); }
const FH = `${Q}/fh`, P1 = `${Q}/p1`;
const [mode, ...args] = process.argv.slice(2);
const out = (k, v) => console.log(JSON.stringify({ [k]: v }));
const SF = `${Q}/secrets1532s3.json`;
const known = () => existsSync(SF) ? JSON.parse(readFileSync(SF, 'utf8')) : [];
const remember = (kind, value) => { const k = known(); if (!k.some(x => x.kind === kind)) { k.push({ kind, value }); writeFileSync(SF, JSON.stringify(k), { mode: 0o600 }); } };
const redact = text => { let t = String(text); for (const k of known()) if (k.value.length >= 16) t = t.split(k.value).join(`<${k.kind}>`); return t.replace(/Bearer\s+\S+/g, 'Bearer <redacted>').replace(/[0-9a-f]{64}/gi, '<hex64>'); };
const bytes = path => Buffer.byteLength(path, 'utf8') + 1;
const sha12 = buf => createHash('sha256').update(buf).digest('hex').slice(0, 12);
const mode8 = path => (statSync(path).mode & 0o777).toString(8);
const DIFFERS = 'host discovery differs; atomic replacement required';
if (mode === 'redact') { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => process.stdout.write(redact(s))); }
else {
const { hostPaths } = await import(`${W}/hub/src/host/records.ts`);
const { layout } = await import(`${W}/hub/src/project.ts`);
const { hostDirectory } = await import(`${W}/shared/fake-host-directory.ts`);
const { remoteDiscovery } = await import(`${W}/hub/src/host/discovery.ts`);
const { remoteHostLayout } = await import(`${W}/hub/src/host/remote-layout.ts`);
const fake = id => { const directory = hostDirectory(FH, id), home = join(directory, 'home'), l = remoteHostLayout(home); return { directory, home, run: l.runDirectory, file: l.discoveryFile }; };
const hostSecret = id => readFileSync(hostPaths(P1, id).secret, 'utf8');
const projectSecret = () => readFileSync(join(P1, '.cland', 'secret'), 'utf8').trim();
const discovery = id => JSON.parse(readFileSync(fake(id).file, 'utf8'));
// one JSON-lines connection to a hub socket (the stage-2 client)
function lines(path) {
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
const helloFacts = f => f ? { type: f.type, ...(f.type === 'error' ? { code: f.code, message: redact(f.message) } : {}) } : null;
async function session(path, secret, types) {   // hello, then each frame with its own id; results by that id
  const c = await lines(path);
  c.send({ type: 'hello', protocol: 2, client: 'cli', secret });
  out('hello', helloFacts(await c.next(f => f.type === 'welcome' || f.type === 'error')));
  for (const [i, type] of types.entries()) {
    c.send({ type, id: `qa-${i}` });
    const r = await c.next(f => f.type === 'result' && f.id === `qa-${i}`);
    out(type, r ? { ok: r.ok, ...(r.ok ? { hosts: r.value?.hosts ?? 'absent', secretHits: known().filter(k => JSON.stringify(r.value).includes(k.value)).map(k => k.kind) } : { code: r.code ?? null, error: redact(r.error ?? '') }) } : null);
  }
  c.end();
}
async function status() {   // hub.status over p1's own socket with the project secret
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
        agentSocketBytes: bytes(join(f.run, 'agent.sock')), hubSocketBytes: bytes(join(f.run, 'hub.sock')), spokeSocketBytes: bytes(join(f.run, 'spoke.sock')), gitSocketBytes: bytes(join(f.run, 'git.sock')), keySha12: sha12(readFileSync(join(h.directory, 'host-key.pub'))) });
    }
    break;
  }
  case 'plant': {   // <id>: a different remote discovery at that host's canonical path (a synthetic value, not a secret), mode 600
    const f = fake(args[0]);
    const prior = JSON.stringify(remoteDiscovery(f.run, 'qa-prior-' + 'p'.repeat(24)), null, 2) + '\n';
    writeFileSync(f.file, prior, { mode: 0o600 });
    out('planted', { id: args[0], sha12: sha12(Buffer.from(prior)), mode: mode8(f.file) }); writeFileSync(`${Q}/planted-${args[0]}.sha`, sha12(Buffer.from(prior)) + '\n');
    break;
  }
  case 'planted': {   // <id>: the planted file unchanged
    const f = fake(args[0]), b = readFileSync(f.file);
    out('planted', { id: args[0], unchanged: sha12(b) === readFileSync(`${Q}/planted-${args[0]}.sha`, 'utf8').trim(), mode: mode8(f.file) });
    break;
  }
  case 'remember-project': { remember('project', projectSecret()); const l = layout(P1); out('sockets', { hubSocketBytes: bytes(l.socket), spokeSocketBytes: bytes(l.spokeSocket), hubInside: l.socket.startsWith(P1 + '/'), spokeInside: l.spokeSocket.startsWith(P1 + '/') }); break; }
  case 'records': {   // host rows (read only) and the files registerFakeHosts wrote, against what createFakeHost wrote
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(join(P1, '.cland', 'hub.db'), { readOnly: true });
    let rows; try { rows = db.prepare('select id,transport,state from hosts order by id').all().map(r => ({ ...r })); } finally { db.close(); }
    for (const r of rows) {
      const p = hostPaths(P1, r.id), f = fake(r.id), clientKey = readFileSync(p.clientKeyPath, 'utf8');
      if (r.state === 'registered') remember(`host-${r.id}`, hostSecret(r.id));
      out(r.id, { transport: r.transport, state: r.state,
        knownHostsMatch: readFileSync(p.knownHosts, 'utf8') === `${r.id} ${readFileSync(join(f.directory, 'host-key.pub'), 'utf8').trim()}\n`,
        clientKeyIsFake: clientKey === join(f.directory, 'client-key'), clientKeyExists: existsSync(clientKey),
        secretMode: mode8(p.secret), secretLength: readFileSync(p.secret, 'utf8').length, socketDirectoryInside: p.socketDirectory.startsWith(P1 + '/'),
        agentSocketBytes: bytes(p.agentSocket), gitSocketBytes: bytes(p.gitSocket), controlSocketBytes: bytes(p.controlSocket) });
    }
    break;
  }
  case 'states': {   // host rows, read only
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(join(P1, '.cland', 'hub.db'), { readOnly: true });
    try { out('hosts', db.prepare('select id,transport,state from hosts order by id').all().map(r => ({ ...r }))); } finally { db.close(); }
    break;
  }
  case 'svstart': {   // <id>: the shipped supervisor around the build's `cland host serve` on that fake host, detached (Node's detached spawn stands in for setsid on macOS)
    const id = args[0], f = fake(id), lockBefore = existsSync(join(f.run, 'supervisor.lock'));
    if (lockBefore) { out('starter', { id, refused: 'a supervisor lock already exists' }); process.exit(1); }
    const { seal } = await import(`${Q}/seal.mjs`);
    const log = openSync(`${Q}/sv-${id}.log`, 'a');
    const env = seal({ CLAND_HOST_SECRET: hostSecret(id), CLAND_HOST_RUN_DIR: f.run, CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: join(f.directory, 'boot-id') });
    const child = spawn('/bin/sh', [`${W}/hub/src/host/agent/supervisor.sh`, f.run, process.execPath, `${W}/hub/bin/cland.ts`, 'host', 'serve'], { detached: true, stdio: ['ignore', log, log], env });
    child.unref(); writeFileSync(`${Q}/pids`, `${child.pid}\n`, { flag: 'a' }); writeFileSync(`${Q}/sv-${id}.pid`, `${child.pid}\n`);
    out('starter', { id, pid: child.pid, lockBefore });
    break;
  }
  case 'agent': {   // <id> <timeout ms>: QA's own authenticated hello on that fake host's agent.sock
    const [id, ms] = args, f = fake(id);
    const { AgentClient } = await import(`${W}/hub/src/host/agent-client.ts`);
    const t0 = Date.now(); let facts = null, last = '';
    while (Date.now() - t0 < Number(ms)) {
      try { const c = await AgentClient.connect(join(f.run, 'agent.sock'), hostSecret(id)); const h = c.hello; await c.close();
        facts = { id, pid: h.pid, prepared: (h.capabilities ?? []).includes('host-prepared-v1'), elapsedMs: Date.now() - t0 }; break; }
      catch (e) { last = redact(e.message); }
      await new Promise(r => setTimeout(r, 200));
    }
    out('agent', facts ?? { id, none: true, last });
    if (facts) { writeFileSync(`${Q}/agent-${id}.pid`, `${facts.pid}\n`); writeFileSync(`${Q}/pids`, `${facts.pid}\n`, { flag: 'a' }); }
    break;
  }
  case 'wait': {   // <id> <up|differs> <ms>: polls hub.status every 500 ms; every distinct (state, reason) seen, in order
    const [id, want, ms] = args, t0 = Date.now(), seen = []; let row = null, reached = false;
    while (Date.now() - t0 < Number(ms)) {
      const s = await status().catch(() => null); row = s?.hosts?.find(h => h.name === id) ?? null;
      const key = row ? `${row.state}${row.reason ? ` (${row.reason})` : ''}` : 'no row';
      if (seen.at(-1) !== key) seen.push(key);
      if (row && (want === 'up' ? row.state === 'up' : row.state === 'connecting' && row.reason === DIFFERS)) { reached = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    out('wait', { id, want, reached, elapsedMs: Date.now() - t0, seen, row });
    break;
  }
  case 'hosts': {   // <status json file>: the hosts field and whether any secret appears
    const text = readFileSync(args[0], 'utf8'), v = JSON.parse(text);
    out('hosts', v.hosts ?? 'absent'); out('secretHits', known().filter(k => text.includes(k.value)).map(k => k.kind));
    break;
  }
  case 'home': { process.stdout.write(`${fake(args[0]).home}\n`); break; }
  case 'dfacts': {   // <id> <label>: the canonical discovery file on that fake host, against the build's remoteDiscovery
    const [id, label] = args, f = fake(id), b = readFileSync(f.file), d = JSON.parse(b.toString('utf8')), st = statSync(f.file);
    const others = known().filter(k => k.kind !== `host-${id}`);
    const facts = { id, mode: mode8(f.file), keys: Object.keys(d), remote: d.remote, socketIsRun: d.socket === join(f.run, 'hub.sock'), spokeIsRun: d.spoke === `ws+unix:${join(f.run, 'spoke.sock')}:/`,
      secretIsHost: d.secret === hostSecret(id), otherSecretsInBytes: others.filter(k => b.includes(k.value)).map(k => k.kind), pidPortRoot: [d.pid, d.port, d.root].filter(x => x !== undefined).length,
      equalsBuild: b.toString('utf8') === JSON.stringify(remoteDiscovery(f.run, hostSecret(id)), null, 2) + '\n', socketBytes: bytes(d.socket), spokeSocketBytes: bytes(d.spoke.slice(8, -2)), sha12: sha12(b), mtimeMs: st.mtimeMs, ino: st.ino };
    out('discovery', facts); if (label) writeFileSync(`${Q}/dfacts-${id}-${label}.json`, JSON.stringify(facts));
    break;
  }
  case 'dsame': {   // <id> <label a> <label b>: digest, mtime and inode unchanged between two dfacts
    const [id, a, b] = args, x = JSON.parse(readFileSync(`${Q}/dfacts-${id}-${a}.json`, 'utf8')), y = JSON.parse(readFileSync(`${Q}/dfacts-${id}-${b}.json`, 'utf8'));
    out('same', { id, sha12: x.sha12 === y.sha12, mtimeMs: x.mtimeMs === y.mtimeMs, ino: x.ino === y.ino });
    break;
  }
  case 'client': { const [who, ...types] = args; await session(layout(P1).socket, who === 'project' ? projectSecret() : hostSecret(who), types); break; }   // p1's own hub socket
  case 'rclient': { const [id, ...types] = args, d = discovery(id); out('endpoint', { socketBytes: bytes(d.socket) }); await session(d.socket, d.secret, types); break; }   // the forwarded hub.sock on the fake host
  case 'rspoke': {   // <id>: a WebSocket spoke hello through the fake host's forwarded spoke.sock, with the file's secret and no launch credential
    const d = discovery(args[0]), WebSocket = createRequire(`${W}/hub/package.json`)('ws');
    const result = await new Promise(resolve => {
      const ws = new WebSocket(d.spoke, { headers: { Authorization: 'Bearer ' + d.secret }, handshakeTimeout: 3000 });
      const done = v => { try { ws.terminate(); } catch {} resolve(v); };
      ws.on('unexpected-response', (_req, res) => done({ upgrade: 'refused', status: res.statusCode, statusMessage: res.statusMessage }));
      ws.on('error', e => done({ upgrade: 'error', error: redact(e.message) }));
      ws.on('open', () => { ws.once('message', m => { const f = JSON.parse(String(m)); done({ upgrade: 'open', frame: helloFacts(f) }); }); ws.send(JSON.stringify({ type: 'hello', protocol: 2, cwd: fake(args[0]).home, sessionId: 'qa-absent', name: 'qa-absent' })); });
      setTimeout(() => done({ upgrade: 'timeout' }), 6000);
    });
    out('spoke', result); break;
  }
  case 'statusjson': {   // <file>: the host-side `hub status --json` line: its keys and fields
    const v = JSON.parse(readFileSync(args[0], 'utf8').trim().split('\n').at(-1));
    out('statusjson', { keys: Object.keys(v).sort(), running: v.running, statusError: redact(v.statusError ?? '') });
    break;
  }
  case 'doctorrows': {   // <file>: the `hub` and `hub.json` rows of `cland doctor --json` (hub/src/cli/doctor.ts:65; rows from hub/src/doctor/report.ts:19–21)
    const v = JSON.parse(readFileSync(args[0], 'utf8').trim().split('\n').at(-1));
    for (const name of ['hub', 'hub.json']) { const c = v.checks.find(x => x.name === name); out(name, c ? { verdict: c.verdict, detail: redact(c.detail), fix: c.fix ?? null } : 'absent'); }
    break;
  }
  case 'mute': {   // a remote discovery whose socket does not exist (a synthetic value, not a secret)
    const f = fake('f1');
    writeFileSync(`${Q}/mute.json`, JSON.stringify({ ...remoteDiscovery(f.run, 'qa-mute-' + 'm'.repeat(24)), socket: join(f.run, 'qa-absent.sock') }, null, 2) + '\n', { mode: 0o600 });
    out('mute', { socket: join(f.run, 'qa-absent.sock'), exists: existsSync(join(f.run, 'qa-absent.sock')) });
    break;
  }
  case 'printreason': {   // p1's live hub.status, with f2's row given the cleanup-incomplete reason, through the build's own describe
    const { describe } = await import(`${W}/hub/src/cli/hub.ts`);
    const s = await status();
    if (!s?.hosts) { out('print', { blocked: 'no hub.status' }); break; }
    const v = { ...s, hosts: s.hosts.map(h => h.name === 'f2' ? { ...h, state: 'connecting', reason: 'host readiness cleanup incomplete' } : h) };
    const text = await describe(v);
    out('print', { hostLines: text.split('\n').filter(l => /^hosts: |^  f[12]  /.test(l)).map(redact) });
    break;
  }
  case 'svpids': {   // <id>: the supervisor lock's pid and the agent.pid receipt on that fake host
    const f = fake(args[0]);
    const sv = Number(readFileSync(join(f.run, 'supervisor.lock', 'pid'), 'utf8').trim()), ag = JSON.parse(readFileSync(join(f.run, 'agent.pid'), 'utf8')).pid;
    out('svpids', { id: args[0], supervisorIsStarter: String(sv) === readFileSync(`${Q}/sv-${args[0]}.pid`, 'utf8').trim(), agentIsHello: String(ag) === readFileSync(`${Q}/agent-${args[0]}.pid`, 'utf8').trim(), supervisor: sv, agent: ag });
    break;
  }
  case 'census': {   // <needle…>: processes whose command line names any needle; never this probe itself
    const all = execFileSync('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' });
    const rows = all.split('\n').map(l => l.trim()).filter(Boolean).filter(l => Number(l.split(/\s+/)[0]) !== process.pid && args.some(n => l.includes(n)));
    console.log(rows.length); for (const row of rows) console.error(redact(row).slice(0, 160));
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
s00() {   # QA's own shell: build, the stage's plan facts, every landing; the T-1600 landing against its branch head
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  # .claude/settings.local.json is left out: a pre-existing harness-local file, not run output
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1532 --json) > "$EV/E1532S3-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const s of p.stages)console.log(JSON.stringify({name:s.name,state:s.state,qa:s.qa,members:s.items,merged:s.merged,total:s.total,statuses:s.statuses,verdict:s.verdict?{result:s.verdict.result,run:s.verdict.run,current:s.verdict.current}:null}))' "$EV/E1532S3-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(s=>s.name==="the ssh Host and the remote spoke").items.join(" "))' "$EV/E1532S3-00-plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
  L=$(git -C "$R" log --first-parent --format=%H --grep '^Item: T-1600$' "$S" | head -n 1)
  if [ -n "$L" ]; then git -C "$R" show --stat --format='%H%n%s%n%b' "$L" > "$EV/T-1600-landing.txt"; echo "T-1600 landing files: $(git -C "$R" diff --name-only "$L^1" "$L" | tr '\n' ' ')"; else echo "T-1600 landing: none"; fi
  echo "T-1600 branch head files: $(git -C "$R" diff --name-only d7beb363e3977e168a4db394dde53e9dec965833 765db463f2e74a42c45462bea3b0c222a89be5f0 | tr '\n' ' ')"
}
s01() {   # QA's own shell, read-only in $W: what every landing touched; preserved files unedited; source strings at the build
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  for id in T-1598 T-1599 T-1600 T-1602 T-1657; do
    L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD | head -n 1)
    echo "$id ($L) existing test files modified: $(git -C "$W" diff --diff-filter=M --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    git -C "$W" diff --diff-filter=M --numstat "$L^1" "$L" -- hub/test web/test nvim/test | sed "s|^|  $id added/deleted: |"
    echo "$id test files added: $(git -C "$W" diff --diff-filter=A --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    echo "$id deleted or renamed paths: $(git -C "$W" diff --diff-filter=DR --name-only "$L^1" "$L" | wc -l | tr -d ' ')"
    echo "$id paths outside hub/src, hub/test, shared, docs and the implement skill: $(git -C "$W" diff --name-only "$L^1" "$L" | grep -v -E '^(hub/src/|hub/test/|shared/|docs/|\.agents/skills/implement/)' | tr '\n' ' ')"
    echo "$id package.json and lockfiles changed: $(git -C "$W" diff --name-only "$L^1" "$L" -- ':(glob)**/package.json' ':(glob)**/package-lock.json' | wc -l | tr -d ' ')"
    for f in hub/test/transport-ssh.test.ts hub/test/transport-ssh-contract.test.ts hub/test/transport-fake-contract.test.ts hub/test/transport-contract.ts hub/test/transport-contract-fixture.ts hub/test/transport-policy.test.ts hub/test/fake-ssh.test.ts hub/test/host-agent.test.ts hub/test/host-agent-files.test.ts hub/test/host-local-contract.test.ts hub/test/host-contract-coverage.test.ts hub/test/spoke-unix-edge.test.ts hub/test/in-process-spoke.test.ts hub/test/project-layout.test.ts hub/test/host-secret-admission.test.ts hub/test/daemon.test.ts hub/test/cli-help.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/fixture-socket-path.test.ts hub/test/host-supervisor.test.ts hub/test/launch-files.test.ts hub/test/claude-code-adapter.test.ts hub/test/codex-adapter.test.ts hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts hub/test/test-docs.test.ts; do
      git -C "$W" diff --quiet "$L^1" "$L" -- "$f" || echo "  $id EDITED PRESERVED FILE $f"; done
  done
  L=$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1599$' HEAD | head -n 1)
  echo "T-1599 host-contract.ts hunks: $(git -C "$W" diff -U0 "$L^1" "$L" -- hub/test/host-contract.ts | grep -c '^@@'); register names changed: $(git -C "$W" diff -U0 "$L^1" "$L" -- hub/test/host-contract.ts | grep -E '^[-+]' | grep -c "register('")"
  ( cd "$W"
    echo "T-1598 forward argv: $(grep -c -F "'-O', operation, '-L', spec" hub/src/transport/ssh.ts); schedule seams: $(grep -c -F 'reconnectDelayMs?: (backoffMs: number) => number;' hub/src/transport/ssh.ts) $(grep -c -F 'forwardRetryDelaysMs?: readonly [number, number];' hub/src/transport/ssh.ts); default retry: $(grep -c -F '(o.forwardRetryDelaysMs ?? [100, 200])' hub/src/transport/ssh.ts); abandon log: $(grep -c -F 'forward abandoned after 3 attempts' hub/src/transport/ssh.ts)"
    echo "T-1598 injected test schedule: $(grep -c -F 'reconnectDelayMs: () => 10, forwardRetryDelaysMs: [10, 10]' hub/test/transport-forwards.test.ts)"
    echo "T-1599 remote layout: $(grep -c -F "export const REMOTE_HOST_DIRECTORY = '.cland-host';" hub/src/host/remote-layout.ts) $(grep -c -F "code = join(directory,'code',VERSION), run = join(directory,'run')" hub/src/host/remote-layout.ts) $(grep -c -F "discoveryFile:join(run,'hub.json')" hub/src/host/remote-layout.ts)"
    echo "T-1599 command environment: $(grep -c -F "host.name === 'local' ? withoutExecutorCredentials({ ...base, ...additions }) : remoteCommandEnvironment(additions)" hub/src/host/command-environment.ts) $(grep -c -F "key === 'CLAND_HUB_SECRET' || key === 'CLAND_PROJECT_SECRET' || key.startsWith('CLAND_HOST_')" hub/src/host/agent/command-environment.ts)"
    echo "T-1599 boundary leaf: $(grep -c -F "new URL('../../shared/executor-credentials.ts', import.meta.url)" hub/test/host-agent-boundary.test.ts) $(grep -c -F 'credentialLeaf=allowCredentials&&path===environmentOwner&&target===credentials' hub/test/host-agent-boundary.test.ts); agent sources importing shared/: $(grep -r -l -E "from '(\.\./)+shared/" hub/src/host/agent | tr '\n' ' ')"
    echo "T-1599 capability: $(grep -c -F "export const PREPARED_HOST_CAPABILITY = 'host-prepared-v1';" hub/src/host/agent/protocol.ts) $(grep -c -F 'capabilities: [PREPARED_HOST_CAPABILITY]' hub/src/host/agent/server.ts) $(grep -c -F 'tunnel agent missing capability' hub/src/host/ssh-host.ts)"
    echo "T-1599 tunnel refusals: $(grep -c -F 'tunnel is not up' hub/src/host/ssh-host.ts) $(grep -c -F 'tunnel admission revoked' hub/src/host/ssh-host.ts)"
    echo "T-1599 stop race: $(grep -c -F "return proof?.ended === true || typeof identity === 'string' && proof?.identity === identity;" hub/src/host/agent/native.ts)"
    echo "T-1599 OpenCode refusal (T-1644): $(grep -c -F 'nonlocal OpenCode shared ignore needs Host atomic publish/append (T-1644)' hub/src/adapters/opencode/server.ts)"
    echo "T-1599 registry: $(grep -c -F "if (record.state !== 'registered' || options.provided?.some(host=>host.name === record.id)) continue;" hub/src/host/registry.ts) $(grep -c -F 'await carrier.start(); hosts.push(host);' hub/src/host/registry.ts) $(grep -c -F 'sshHosts = await projectSshHosts(' hub/src/hub/daemon.ts)"
    echo "T-1599 fake ssh binary gate: $(grep -c -F 'return { ssh: fake && env.CLAND_SSH_BIN || ' hub/src/host/ssh-binaries.ts)"
    echo "T-1600 discovery kind: $(grep -c -F 'export type RemoteDiscovery' shared/project-discovery.ts) $(grep -c -F 'if (d.remote === true) {' shared/project-discovery.ts) $(grep -c -F 'function validUnixSpoke' shared/project-discovery.ts)"
    echo "T-1600 writer: $(grep -c -F "if (current) throw new Error('host discovery differs; atomic replacement required');" hub/src/host/discovery.ts) $(grep -c -F 'if (current?.equals(bytes)) return;' hub/src/host/discovery.ts) $(grep -c -F 'options:{mode:0o600}' hub/src/host/discovery.ts); callers: $(grep -r -l -F 'publishRemoteDiscovery(' hub/src | tr '\n' ' ')"
    echo "T-1600 canonical path only: $(grep -c -F 'publishRemoteDiscovery(client,layout.discoveryFile,remoteDiscovery(layout.runDirectory,secrets.readSecret(record.id)),signal)' hub/src/host/registry.ts)"
    echo "T-1600 readiness: $(grep -c -F 'beforeReady?: (signal: AbortSignal) => Promise<void>;' hub/src/transport/ssh.ts) $(grep -c -F 'o.beforeReadyTimeoutMs ?? 30000' hub/src/transport/ssh.ts) $(grep -c -F 'beforeReadyDrainMs ?? 1000' hub/src/transport/ssh.ts) $(grep -c -F "'host readiness cleanup incomplete'" hub/src/transport/ssh.ts) $(grep -c -F "super('host readiness cleanup incomplete')" hub/src/transport/readiness.ts) $(grep -c -F "=== 'host discovery differs; atomic replacement required' ? 'connecting' : 'down'" hub/src/transport/ssh.ts)"
    echo "T-1600 CLI: $(grep -c -F "if (d?.remote) return await probe(d) ? {kind:'live', d} : {kind:'mute', d};" hub/src/cli/hub.ts) $(grep -c -F "found.d.remote ? ' (remote)'" hub/src/cli/hub.ts) $(grep -c -F 'remote hub does not answer on ${found.d.socket} — restore the host tunnel' hub/src/cli/hub.ts) $(grep -c -F 'manage the hub on its owning machine; remote discovery is retained' hub/src/cli/hub.ts) $(grep -c -F 'manage the remote hub on its owning machine' hub/src/cli/hub.ts)"
    echo "T-1600 doctor: $(grep -c -F 'const l = { ...layout(root), discovery: hubDiscovery(root, env) };' hub/src/doctor/project.ts) $(grep -c -F 'remote hub answers on ${d.socket}' hub/src/doctor/project.ts) $(grep -c -F 'remote hub does not answer on ${d.socket} (${errorText(error)})' hub/src/doctor/project.ts) $(grep -c -F "ok('hub.json','valid remote discovery')" hub/src/doctor/project.ts)"
    echo "T-1600 spoke: $(grep -c -F 'url: d.remote ? d.spoke : ' hub/src/spoke/spoke.ts); help: $(grep -c -F 'CLAND_HUB_FILE: remote discovery uses forwarded sockets without local PID checks; host admission still applies' hub/src/cli/usage/hub.ts) $(grep -c -F 'CLAND_HUB_FILE: remote discovery uses forwarded sockets without local PID checks; host admission still applies' hub/src/cli/usage/doctor.ts)"
    echo "T-1600 status print: $(grep -c -F "reconnects \${host.reconnects}\${host.reason ? \` · \${host.reason}\` : ''}" hub/src/cli/hub.ts)"
    for s in 'host spoke requires a session launch credential' 'host secret revoked' 'host frame requires its own role-holding session credential'; do echo "dispatch '$s': $(grep -c -F "$s" hub/src/hub/dispatch.ts)"; done
    echo "spoke 401 Host revoked: $(grep -c -F "'Host revoked'" hub/src/hub/server.ts); cland host revoke: $(grep -c -F 'revoked host ${args[1]}' hub/src/cli/host.ts)"
    echo "T-1657 resolver: $(grep -c -F "return join(dirname(fixtureSocketPath(root, 'fake-hosts')), name);" shared/fake-host-directory.ts) $(grep -c -F 'const fake = hostDirectory(env.CLAND_FAKE_HOST_ROOT, id);' hub/src/host/records.ts) $(grep -c -F "export { hostDirectory } from '../../../shared/fake-host-directory.ts';" hub/test/fakes/fake-host.ts)"
    echo "agent boot id off Linux: $(grep -c -F 'non-Linux agent requires fake host boot-id file' hub/src/host/agent/native.ts)" )
}
s02() {   # sealed, in $W: the typecheck at the build
  echo "PRE: $(git -C "$QA_W" rev-parse HEAD) node $(node --version)"
  ( cd "$QA_W" && npm run typecheck > "$QA_EV/E1532S3-02-typecheck.log" 2>&1; echo "typecheck exit $?" )
  echo "dirty entries $(git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
}
s08() {   # QA's own shell, read-only in $W: the ADR amendments of T-1602
  ( cd "$W"; A=docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md; B=docs/adr/0004-agents-work-on-a-local-git-territory.md
    echo "PRE: $(ls "$A" "$B" | wc -l | tr -d ' ') ADR files"
    echo "0003 heading: $(grep -c -F '## Amendment — 2026-11-03: Host sockets and per-host authority (T-1591, T-1596)' "$A"); spoke.sock: $(grep -c -F '.cland/run/spoke.sock' "$A"); per-host git socket: $(grep -c -F 'per-host git' "$A"); per-host secret: $(grep -c -F 'per-host secret' "$A"); never the human: $(grep -c -F 'That secret authenticates the Host, never the human.' "$A"); no network bind: $(grep -c -F 'These edges bind no new network' "$A")"
    echo "0004 heading: $(grep -c -F '## Amendment — 2026-11-03: Territory access through the Tunnel (T-1591, T-1597)' "$B"); inetd: $(grep -c -F 'git daemon --inetd' "$B"); allow list: $(grep -c -F 'allow list' "$B"); revocation before merges: $(grep -c -F "it revokes every Host's lease" "$B"); deletions and protected: $(grep -c -F 'It refuses ref deletion, tags,' "$B") $(grep -c -F 'any move of `dev` or `main`' "$B"); item branches: $(grep -c -F 'Item branches are created in the territory' "$B")"
    for f in "$A" "$B"; do echo "$(basename "$f") links: §3.2 $(grep -o -F '../spec/v0.4.md#32-the-ssh-transport-the-tunnel-layout-and-the-host-agent' "$f" | wc -l | tr -d ' ') §3.3 $(grep -o -F '../spec/v0.4.md#33-git-through-the-tunnel' "$f" | wc -l | tr -d ' ') §3.12 $(grep -o -F '../spec/v0.4.md#312-security-and-secrets' "$f" | wc -l | tr -d ' ') glossary $(grep -o -F '../../GLOSSARY.md#hosts' "$f" | wc -l | tr -d ' ')"; done
    echo "targets: $(grep -c -E '^### 3\.(2|3|12) ' docs/spec/v0.4.md) headings; glossary: $(grep -c -x '## Hosts' GLOSSARY.md) $(grep -c -F '**Host agent**' GLOSSARY.md) $(grep -c -F '**Tunnel**' GLOSSARY.md)" )
}
m10() {   # p1 and the fake hosts f1 and f2: init, hub start registers both, their agents, f1 up, f2 refused on a planted different file; status and the canonical file
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fh entries $(ls -A "$QA_Q/fh" | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' '); node $(node --version); credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)'); CLAND_HOST_, CLAND_FAKE_, CLAND_SSH_ names $(env | cut -d= -f1 | grep -c -E '^CLAND_(HOST|FAKE|SSH)_'); setsid $(command -v setsid || echo none)"
  [ -z "$(command -v setsid)" ] || { echo "BLOCKED: a setsid binary on the sealed PATH would let the bootstrap start its own supervisor"; return 1; }
  ld || return 1
  git init -q -b dev && git config user.name 'QA One' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1532S3-10-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  probe mkhosts f1 f2
  probe plant f2
  hubstart; echo "hub start exit $?"; probe remember-project
  probe records
  probe svstart f1; probe svstart f2
  probe agent f1 15000; probe agent f2 15000
  probe wait f1 up 120000
  probe wait f2 differs 120000
  cland hub status > "$QA_Q/st1.txt" 2>&1; echo "status exit $?"; grep -E '^hosts: |^  f[12]  ' "$QA_Q/st1.txt"
  cland hub status --json > "$QA_Q/st1.json" 2>&1; echo "status --json exit $?"; probe hosts "$QA_Q/st1.json"
  probe dfacts f1 first
  probe planted f2
  probe svpids f1; probe svpids f2
  echo "supervisor processes on f1: $(probe census "$(probe home f1)/.cland-host/run" 2> /dev/null)"
}
m11() {   # from f1 over the tunnel: the forwarded hub.sock and spoke.sock with the file's secret; the host-side CLI with CLAND_HUB_FILE through the seal
  F1=$(probe home f1); D1=$F1/.cland-host/run/hub.json
  echo "PRE: hub $(up); $(probe wait f1 up 5000)"
  echo "-- forwarded hub.sock, the f1 file's secret"; probe rclient f1 hub.status
  echo "-- forwarded spoke.sock, the f1 file's secret, no launch credential"; probe rspoke f1
  run "host CLI: hub status" hostcli "$D1" "$F1" hub status
  echo "  lines: running-remote $(has ' (remote)') unavailable $(has 'full status unavailable: ') admission $(has 'host frame requires its own role-holding session credential') pid $(has '(pid ') stale $(has 'stale')"
  run "host CLI: hub status --json" hostcli "$D1" "$F1" hub status --json; probe statusjson "$QA_Q/r.out"
  run "host CLI: doctor --json" hostcli "$D1" "$F1" doctor --json; probe doctorrows "$QA_Q/r.out"
  run "host CLI: hub stop" hostcli "$D1" "$F1" hub stop
  echo "  lines: $(has 'cland: manage the hub on its owning machine; remote discovery is retained'); p1 hub after: $(up)"; probe dfacts f1 after-stop; probe dsame f1 first after-stop
  probe mute
  run "host CLI: hub status, an unanswered remote socket" hostcli "$QA_Q/mute.json" "$F1" hub status
  echo "  lines: $(has 'does not answer on') $(has 'restore the host tunnel') pid $(has 'pid ')"
}
m12() {   # the cleanup-incomplete reason as cland hub status prints it (the build's describe on p1's live hub.status)
  echo "PRE: hub $(up)"; probe printreason
}
m13() {   # p1 hub restart: f1's file unchanged (no write), f2 still refused, the agents kept
  echo "PRE: hub $(up); $(probe wait f1 up 5000)"
  probe dfacts f1 before-restart
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  hubstart; echo "hub restart exit $?"
  probe wait f1 up 120000
  probe wait f2 differs 120000
  probe dfacts f1 after-restart; probe dsame f1 before-restart after-restart
  probe planted f2
  probe svpids f1; probe svpids f2
}
m14() {   # the human CLI revokes f1; then over f1's forwards: hello refused, spoke refused, the host CLI finds no answering hub; f2 unaffected
  F1=$(probe home f1); D1=$F1/.cland-host/run/hub.json
  echo "PRE: hub $(up); $(probe states)"
  echo "-- positive control before the revoke"; probe rclient f1
  run "revoke f1" cland host revoke f1
  probe states
  echo "-- forwarded hub.sock after the revoke"; probe rclient f1
  echo "-- forwarded spoke.sock after the revoke"; probe rspoke f1
  run "host CLI: hub status after the revoke" hostcli "$D1" "$F1" hub status
  echo "  lines: $(has 'cland: remote hub does not answer on') $(has 'restore the host tunnel')"
  echo "-- f2's own secret on p1's hub socket"; probe client f2
  probe dfacts f1 after-revoke; probe dsame f1 first after-revoke
}
m15() {   # the secret scan and the publication scanner, each with its positive control
  echo "PRE: kinds $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).map(k=>k.kind).join(" "))' "$QA_Q/secrets1532s3.json")"
  probe scan
}
m16() {   # cleanup census: the scratch hub stopped, the supervisors and agents ended, nothing names $Q or the alias, the alias removed
  A=$(cat "$QA_Q/alias")
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for id in f1 f2; do for p in $(cat "$QA_Q/sv-$id.pid") $(cat "$QA_Q/agent-$id.pid"); do kill -TERM "$p" 2> /dev/null; for i in $(seq 1 40); do kill -0 "$p" 2> /dev/null || break; sleep 0.25; done; echo "$id pid $p after TERM: $(alive "$p")"; done; done
  sleep 2; while read -r p; do [ -n "$p" ] && kill -0 "$p" 2> /dev/null && echo "alive $p $(ps -o command= -p "$p" | cut -c1-120)"; done < "$QA_Q/pids"
  echo "processes naming the scratch root or the alias: $(probe census "$QA_Q" "$A")"
  echo "host socket directories outside p1: $(ls -d "$TMPDIR"/cland-h-* /tmp/cland-h-* 2> /dev/null | wc -l | tr -d ' ')"
  probe unalias
}
s17() {   # QA's own shell: the build after every row
  echo "HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
  echo "T leftovers $(ls -A "$T" | wc -l | tr -d ' ')"
}
```

Record the setup (worktree, `$Q` and `$T` with their byte counts, `launcher checked`, `probe checked`, the zero credential-name count, the `CLAND_` name list, the `sealed nvim:` line, `sealed TMPDIR is T: yes`, the `setsid` line, the p1 socket byte counts) as check `S0` with `qa-record.sh note`, its capture in `$EV/S0-env.txt`. `Q bytes` is 23, `T bytes` equals the suite root's 61. The name list must hold no `CLAND_SESSION_*`, `CLAND_ROLE`, launch credential name, `CLAND_HUB_FILE`, `CLAND_HOST_*`, `CLAND_FAKE_*` or `CLAND_SSH_*` from QA's own session. The `sealed nvim:` line names the binary `nvim/bin/nvim-path.ts` printed and `NVIM v0.12.5`. `setsid on the sealed PATH: none` (macOS ships none; see "Probes that mislead"). A nonzero credential count, a missing `launcher checked` or `probe checked`, another `nvim`, or a `setsid` found makes S0 BLOCKED and every scratch row (E1532S3-10 to E1532S3-16) BLOCKED with it; the file rows need only `$Q/env.sh`.

Cleanup after the evidence is recorded and E1532S3-16 removed the alias: print `$Q` and check it begins with `/private/tmp/q33-`, then remove it by that literal path with a non-force `rm -r`; print `$T`, check it begins with `/private/tmp/qa-e1532-s3-` and is empty, and remove it by that literal path with `rmdir`. A `cland-h-*` directory E1532S3-16 listed is removed by its literal path only when its name matches `hostPaths` for `$Q/p1` (it holds only this run's sockets). Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The secrets in `$Q/secrets1532s3.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/run/hosts/*/secret`, the fake hosts' `hub.json` and `secret` are never printed or posted.

## Cases

none. No headless-grid case covers this stage: it has no Neovim or web change. Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. The stage changes no web surface; no browser runs.

## Manual checks

Run in this order. Rows E1532S3-03 to E1532S3-09 run their files serially from `$W` through `nt` or `rp`: cover-quiet admission before each row, the one-minute load at or below 10 and the free disk space printed before each file, `TMPDIR=$T`. Targeted files take no suite lease. They never run in parallel with each other or with the scratch rows. Rows E1532S3-10 to E1532S3-16 depend on the state the rows before them leave, in that order. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1532 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log) first. For every file row "clean" means: every `exit` line reads `exit 0 …`, no `not ok` line, no `# SKIP` line (nothing in these files is platform-gated on macOS, so a skip is FAIL) and no `EINVAL` line. Generated names (template-literal titles, and the `register` names of `hub/test/host-contract.ts` run as nested subtests) are read from the log and compared with their source loops at the build; every generated name a loop yields must print `ok`.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1532S3-00 | hub-api | QA | `s00 > "$EV/E1532S3-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the root's non-tracker count is recorded (E1532S3-17 compares). The stage line `the ssh Host and the remote spoke` shows `qa` `{"scope":"affected","when":"after-stage"}`, `merged` equal to `total`, and `state` not `closed`; the lines `foundations` and `the tunnel` show `state` `closed`. Every member prints exactly one landing SHA. `T-1600 landing files` names a landing (not `none`) whose list equals `T-1600 branch head files` or differs only as Build allows. Otherwise BLOCKED, reported to the requester, nothing else run |
| E1532S3-01 | hub-api | QA | `s01 > "$EV/E1532S3-01.txt" 2>&1` (QA's own shell, read-only) | Per landing, `existing test files modified` exactly: T-1598 `hub/test/tiers.json` (`1 0`); T-1599 `hub/test/durations.json hub/test/host-agent-boundary.test.ts hub/test/host-contract.ts hub/test/host-launch-layout.test.ts hub/test/host-records.test.ts hub/test/tiers.json hub/test/transport-status.test.ts` (`8 1`, `14 3`, `6 4`, `8 1`, `2 1`, `5 0`, `2 1`); T-1600 (as at its head) `hub/test/doctor.test.ts hub/test/fixtures/cli-usage/commands.json hub/test/tiers.json` (`6 0`, `2 2`, `3 0`); T-1602 none; T-1657 `hub/test/fakes/fake-host.ts hub/test/host-records.test.ts` (`3 6`, `35 7`). `test files added`: T-1598 `hub/test/transport-forwards.test.ts`; T-1599 `hub/test/host-command-environment.test.ts hub/test/host-prepared.test.ts hub/test/host-ssh-contract.test.ts hub/test/host-ssh-registry.test.ts hub/test/host-stop-observation.test.ts hub/test/ssh-host-fixture.ts`; T-1600 `hub/test/remote-discovery-cli.test.ts hub/test/remote-discovery-host.test.ts hub/test/remote-discovery.test.ts`; T-1602 and T-1657 none. A T-1600 difference from its head is read against its landing diff before judging. Every landing: `deleted or renamed paths: 0`; `package.json and lockfiles changed: 0`; `paths outside …` empty except T-1599 and T-1600 `hub/README.md`. **No `EDITED PRESERVED FILE` line** (the carrier, transport-contract, agent, local-contract, spoke-edge, admission, help and adapter owners stay unedited across the stage). `T-1599 host-contract.ts hunks: 3; register names changed: 0` (decision 87a51dc5: only the expected-value row). Strings: `T-1598 forward argv: 1; schedule seams: 1 1; default retry: 1; abandon log: 1`; `T-1598 injected test schedule: 1`; `T-1599 remote layout: 1 1 1`; `T-1599 command environment: 1 1`; `T-1599 boundary leaf: 1 1` and `agent sources importing shared/:` exactly `hub/src/host/agent/command-environment.ts`; `T-1599 capability: 1 1 1`; `T-1599 tunnel refusals: 1 1`; `T-1599 stop race: 1`; `T-1599 OpenCode refusal (T-1644): 1`; `T-1599 registry: 1 1 1`; `T-1599 fake ssh binary gate: 1`; `T-1600 discovery kind: 1 1 1`; `T-1600 writer: 1 1 1` and `callers:` exactly `hub/src/host/discovery.ts hub/src/host/registry.ts` in either order; `T-1600 canonical path only: 1`; `T-1600 readiness:` `1 1` then 1 or more, then 1 or more, then `1 1`; `T-1600 CLI: 1 1 1 1 1`; `T-1600 doctor: 1 1 1 1`; `T-1600 spoke: 1; help: 1 1`; `T-1600 status print: 1`; every `dispatch '…'` count 1 or more; `spoke 401 Host revoked: 1; cland host revoke: 1`; `T-1657 resolver: 1 1 1`; `agent boot id off Linux: 1` |
| E1532S3-02 | hub-api | QA | `( . "$Q/env.sh"; s02 ) > "$EV/E1532S3-02.txt" 2>&1` | PRE shows Node 24. `typecheck exit 0` (the whole workspace at the integrated build, T-1600's landing included), `dirty entries 0` |
| E1532S3-03 | hub-api | QA | `nt E1532S3-03 hub/test/transport-forwards.test.ts hub/test/transport-ssh.test.ts hub/test/transport-ssh-contract.test.ts hub/test/transport-fake-contract.test.ts hub/test/transport-policy.test.ts` | clean (T-1598 C1 to C3; the unedited carrier and contract files with T-1598's additive carrier methods). `oks` lists Tests: `C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both`, `C3 SIGKILL restores every retained forward and excludes cancelled sessions`, `C3 exhausted forward logs once and is forgotten on later replacement`, `C2 acknowledged cancellation retains failed unlink for retry and stop without another cancel`, `C3 exhausted restore logs once and retains failed cleanup without reinstalling`, `failed initial installation retains socket cleanup until stop retry`, `C1/C2/C4/C5/C6 fake master restores four forwards and probe after SIGKILL`, `C7 wrong pin refuses before bootstrap and logs no key material`. The two contract entry files pass whole (their generated case names are read from the log). Read `transport-forwards.test.ts` at the build before judging: the C1 case holds an `lsof` positive control on a planted 127.0.0.1 listener before asserting no TCP listener on the carrier's processes; a weaker assertion at the build is a finding |
| E1532S3-04 | hub-api | QA | `nt E1532S3-04 hub/test/host-ssh-contract.test.ts hub/test/host-prepared.test.ts hub/test/host-command-environment.test.ts hub/test/host-ssh-registry.test.ts hub/test/host-stop-observation.test.ts hub/test/host-agent-boundary.test.ts` | clean (T-1599 C1 to C5 and its decisions). `oks` lists Tests: `ssh Host refuses a down tunnel without native side effects`, `ssh Host runs every shared Host behavioral contract through fake ssh`, `C2 explicit additions merge with agent base while planted hub tokens never reach spawned process`, `C4 down tunnel refuses every operation with host/tunnel reason and starts no process or file writer`, `OpenCode nonlocal launch preserves its atomic preparation refusal and starts no process`, `C3 registered SSH Hosts coexist with local and CLAND_TEST_HOSTS; host f1 launch reaches its agent`, `ssh Host command cancellation waits for native completion and cleanup`, `missing installed version refuses spawn naming its directory and starts no process`, `accepted spawn reconciles its durable token after the commit reply is dropped`, `spawn completion reconnects after carrier loss without another Host call`, `stop closes retained descendants after its recorded root has exited`, `unknown accepted spawn fences rollback mutations until its exact outcome reconciles`, `Host.run stream loss remains fenced until native cancellation has a durable completion`, `Host.run shutdown reports incomplete while its disconnected native writer is still held`, `invalid command admission leaves no native work or permanent Host fence`, `prepared spawn expires and cleans only its newly created empty log; existing log survives abort`, `restart consumes durable prepared log and Git cleanup plans before admission`, `native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness`, `prepared Git work expires without installing or leaving a checkout`, `prepared tokens belong to their admitting connection and abort leaves no log`, `prepared Git cleanup handles failed add and pre-create restart, and preserves a replacement checkout`, `disconnect cleanup failure stays owned, agent stays observable, and close retries before success`, `stop treats a captured process reaped between ps and birth observation as closed`, `failed prepare retains its held native writer obligation and close cannot report success`, `Host command env keeps local effective bytes and sends explicit remote additions only`, `Host command env positive control detects every planted credential before filtering`, `OpenCode shared environment builder keeps local base and excludes planted hub-only input remotely`, `ssh Host refuses an older hello without prepared capability and never calls a monolithic fallback`, `default version layout derives code root and supervisor once`, `registry startup uses default installed supervisor and cleanup drains all owners after carrier failure`, `stop observation accepts positive end before comparing a captured birth`, `missing birth without positive end remains a mismatch`, `live stop observation requires the exact captured birth`, `agent imports only Node built-ins, agent modules and its single credential leaf`. Generated, from the adapter loop of `host-ssh-contract.test.ts`: `C2 claude adapter sends no planted hub-only key through the SSH agent` and `C2 codex adapter …`; from the `mode` loop of `host-prepared.test.ts`: `prepared commit inspection fences an unjoined Git writer across retries and restart`, `prepared abort removal …`, `prepared restart removal …`. Nested under the contract wrapper, every `register` name of `hub/test/host-contract.ts` at the build prints `ok`, the descriptor-close fault row (`Host spawn retains accepted PID and completion when log descriptor close fails`) included, since the fixture supplies its faults |
| E1532S3-05 | hub-api | QA | `nt E1532S3-05 hub/test/host-agent.test.ts hub/test/host-agent-files.test.ts hub/test/host-local-contract.test.ts hub/test/host-contract-coverage.test.ts hub/test/transport-status.test.ts hub/test/host-launch-layout.test.ts hub/test/claude-code-host.test.ts hub/test/codex-host.test.ts hub/test/opencode-host.test.ts hub/test/session-host-routing.test.ts hub/test/session-host-placement.test.ts hub/test/launch-files.test.ts hub/test/host-boundary.test.ts` | clean (the consumers of T-1599's shared seams: the agent, the local Host contract with its local defaults exact, the status consumer moved to an injected Host, the adapters' launch layouts with the mapped remote environment migrated to explicit additions). `oks` lists Tests: `C6 hub status exposes tunnel facts and CLI tolerates the previous reply shape`, `OpenCode password reads use the supplied Host`, `nonlocal file replacement refuses missing rollback metadata and new files undo through their Host`, `nonlocal OpenCode shared-ignore preparation refuses the unsupported atomic boundary`, `Claude nonlocal layout without a mod directory refuses before native launch`. Generated, from the loops `mask`, `mapped` and the adapter map of `host-launch-layout.test.ts`: `local claude launch preserves baseline argv, environment and file bytes/modes (umask 22)` through `mapped Host opencode launch preserves baseline argv, environment and file bytes/modes (umask 2)`, every local and mapped name for claude, codex and opencode under umask 22 and 2, each `ok` |
| E1532S3-06 | hub-api | QA | `nt E1532S3-06 hub/test/remote-discovery.test.ts hub/test/remote-discovery-host.test.ts hub/test/remote-discovery-cli.test.ts hub/test/doctor.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/project-layout.test.ts hub/test/in-process-spoke.test.ts hub/test/spoke-unix-edge.test.ts hub/test/host-secret-admission.test.ts` | clean (T-1600 C1 to C5 and its decisions; the local discovery, spoke-edge and admission owners unedited per E1532S3-01). `oks` lists Tests: `C1 remote discovery accepts socket credentials without a local pid or port; preserves old local shape`, `different discovery refuses before a failing overwrite; identical bytes skip the writer`, `C2 remote spoke rereads discovery before reconnect`, `C4 remote discovery stays private and byte-stable across hub restart`, `C5 credentialed remote spoke next hello is refused after host revoke`, `readiness timeout aborts and drains before autonomous retry`, `undrained readiness fences ownership and stop reports cleanup incomplete`, `publication RPC timeout retains writer until a positive same-stream drain receipt`, `changed discovery keeps the prior private bytes and reports connecting refusal`, `C3 status, doctor and hook reach remote CLAND_HUB_FILE socket without a local pid`, `doctor uses its fixture environment rather than the parent crew session`. The help files pass whole with the frozen usage including both `CLAND_HUB_FILE` lines. Read `remote-discovery-host.test.ts` at the build before judging: the C2/C4/C5 case asserts mode `0o600`, the per-host secret, a planted project secret that differs and is absent from the bytes, no `pid` or `port`, both endpoint byte counts under 104, a credentialed welcome, a refused changed secret at reconnect, restoration, identical bytes after the carrier restart and after the hub restart, and a refused hello after `host revoke`; the undrained case asserts the reason `host readiness cleanup incomplete`, state `connecting`, `reconnects` 0, one call and a rejected `stop`. A weaker assertion at the build is a finding |
| E1532S3-07 | hub-api | QA | `nt E1532S3-07 hub/test/host-records.test.ts hub/test/fake-ssh.test.ts hub/test/fixture-socket-path.test.ts hub/test/host-supervisor.test.ts` | clean (T-1657 C1 and C2; the other `createFakeHost` consumers unchanged). `oks` lists Tests: `C1 hosts table is additive and survives reopen with existing data`, `C2 private files contain plaintext; database and public records contain only digest`, `C5 secrets are host-bound and revocation persists without automatic remint`, `C4 deep project roots use deterministic short private socket paths`. Generated, from the `both` loop: `C3 fake registration requires both variables: true`, `… false`, `… root-only`, `… suite-tmpdir`; from the `existingHost` loop: `Store upgrades existing remote tables alongside host records (existing host: false)` and `(existing host: true)`; each `ok`. Read the `suite-tmpdir` variant at the build: it starts a hub on a fresh `createFakeHost` root under a `/private/tmp/cland-suite-<uuid>` root and asserts each host's key, the client-key path's existence and contents, and every socket below 104 bytes |
| E1532S3-08 | hub-api | QA | `nt E1532S3-08 hub/test/test-docs.test.ts; s08 > "$EV/E1532S3-08.txt" 2>&1` (QA's own shell) | `test-docs.test.ts` clean (links resolve, anchors retained). `PRE: 2 ADR files`. `0003 heading: 1`; `spoke.sock`, `per-host git socket`, `per-host secret` each 1 or more; `never the human: 1`; `no network bind: 1` (T-1602 C1). `0004 heading: 1`; `inetd`, `allow list` each 1 or more; `revocation before merges: 1`; `deletions and protected: 1 1`; `item branches: 1` (T-1602 C2). Each ADR's links line: `§3.2`, `§3.3`, `§3.12` each 1 or more and `glossary` 3 or more; `targets: 3 headings`; `glossary: 1 1 1` (T-1602 C3) |
| E1532S3-09 | hub-api | QA | `: > "$EV/E1532S3-09.log"; rp E1532S3-09 hub/test/transport-forwards.test.ts 3 && rp E1532S3-09 hub/test/remote-discovery-host.test.ts 3 && rp E1532S3-09 hub/test/host-ssh-contract.test.ts 2` (QA's own shell) | The timing-sensitive files with injected short schedules under this machine's load: every `exit 0`, no `not ok`, no `# SKIP`, no `EINVAL`; per repetition every literal name of that file listed in E1532S3-03, E1532S3-04 and E1532S3-06 prints `ok` once (count them with `oks`) |
| E1532S3-10 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m10 ) > "$EV/E1532S3-10.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: p1 and fh empty, `fakes 3`, `credential-prefix names 0`, `CLAND_HOST_, CLAND_FAKE_, CLAND_SSH_ names 0`, `setsid none`. `init exit 0`; `hub after init and stop: down`. `mkhosts`: for `f1` and `f2` `aliasShort` true, `aliasTarget` true, `runIsLayout` true, `runMode` `700`, every socket byte count under 104 (else BLOCKED). `planted` f2 mode `600`. `hub start exit 0`; `sockets` both under 104 and both `inside` true. `records` (T-1657 C1, T-1599 C3 at the CLI level): `f1` and `f2` each `transport` `ssh`, `state` `registered`, `knownHostsMatch` true, `clientKeyIsFake` true, `clientKeyExists` true, `secretMode` `600`, `secretLength` 64, every socket byte count under 104 (`socketDirectoryInside` recorded; false is the `cland-h-` fallback, accepted). `starter` for f1 and f2 with `lockBefore` false; `agent` f1 and f2 each answer with `prepared` true (else BLOCKED: the agents did not start, nothing below proves anything). `wait` f1 `up`: `reached` true within 120000 ms; `seen` is recorded in order (states before the agents answered are `connecting` or `down` with a reason, see Probes that mislead). `wait` f2 `differs`: `reached` true, `row.state` `connecting`, `row.reason` `host discovery differs; atomic replacement required`. `status exit 0` and the lines `hosts: 2`, `  f1  up since <ISO> · probe <ISO> ok · reconnects <n>` with no reason suffix, and an `  f2  ` line in state `connecting` or with that reason suffix (the printed line is one instant; the reason was proven by `wait`). `status --json exit 0`; `hosts` has `f1` with `state` `up`, `lastProbe.ok` true and no `reason`; `secretHits` `[]`. `discovery` (T-1600 C4, C1): `mode` `600`, `keys` exactly `["remote","socket","spoke","secret","version"]`, `remote` true, `socketIsRun` true, `spokeIsRun` true, `secretIsHost` true, `otherSecretsInBytes` `[]` (neither the project secret nor f2's), `pidPortRoot` 0, `equalsBuild` true, both byte counts under 104. `planted` f2 `unchanged` true, mode `600` (the different file was not overwritten). `svpids` f1 and f2: `supervisorIsStarter` true, `agentIsHello` true (the bootstrap's `--check` gate started nothing, T-1595 C2 kept). `supervisor processes on f1: 1`. If both agents answered but f1 is not `up` within 120000 ms, the row is FAIL with the hub log's `host-tunnel` lines (`.cland/log/hub.log`), unless a line names a cause outside the build (a missing binary, a sandbox refusal): then INCONCLUSIVE with that line |
| E1532S3-11 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m11 ) > "$EV/E1532S3-11.txt" 2>&1` | PRE: hub `up`, `wait` f1 `reached` true. Forwarded `hub.sock` with the f1 file's secret: `endpoint` byte count under 104; `hello` `{"type":"welcome"}`; `hub.status` `ok` false, `code` `forbidden`, `error` naming `host frame requires its own role-holding session credential` (a host client is never the human: positive proof the frame crossed the tunnel and met host admission). Forwarded `spoke.sock`: `upgrade` `open` (the per-host secret is accepted at the upgrade, T-1600 C2's transport) and `frame` `{"type":"error","code":"unauthorized","message":"host spoke requires a session launch credential"}`. Host CLI `hub status exit 0` with `running-remote 1`, `unavailable 1`, `pid 0`, `stale 0` (T-1600 C3: no pid check; `admission` 1 is expected, see Source provenance). `hub status --json exit 0` and `statusjson` `keys` exactly `["root","running","statusError"]`, `running` true (no `pid` key). `doctor --json`: its exit code recorded; the `hub` row `verdict` `fail`, `detail` starting `remote hub does not answer on <the f1 file's socket> (`, `fix` `restore the host tunnel`; the `hub.json` row `verdict` `ok`, `detail` `valid remote discovery` (doctor reached the hub through the file's socket and met host admission; it never read a pid). `hub stop exit 1` with `lines: 1`, `p1 hub after: up`; `same` `sha12`, `mtimeMs` and `ino` all true (the remote file is retained). `mute` `exists` false; `hub status, an unanswered remote socket exit 1` with `lines: 1 1 pid 0` |
| E1532S3-12 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m12 ) > "$EV/E1532S3-12.txt" 2>&1` | PRE: hub `up`. `print` `hostLines` holds `hosts: 2`, an `  f1  up since …` line, and `  f2  connecting since <ISO or unknown> · probe <…> · reconnects <n> · host readiness cleanup incomplete` (the reason as `cland hub status` prints it; the state itself is proven by the named case in E1532S3-06, see Probes that mislead) |
| E1532S3-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1532S3-13.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: hub `up`, `wait` f1 `reached` true. `hub after stop: down`; `hub restart exit 0`; `wait` f1 `up` `reached` true; `wait` f2 `differs` `reached` true. `same` for f1 `sha12` true, `mtimeMs` true, `ino` true (T-1600 C4: content unchanged across a hub restart; the identical file was read, not rewritten). `planted` f2 `unchanged` true, mode `600`. `svpids` f1 and f2 as in E1532S3-10 (the agents outlived the hub; recorded, not judged beyond this stage's scope) |
| E1532S3-14 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m14 ) > "$EV/E1532S3-14.txt" 2>&1` | PRE: hub `up`, `states` f1 and f2 `registered`. Positive control: the forwarded `hub.sock` hello with the f1 file's secret is `welcome` (else BLOCKED). `revoke f1 exit 0` with `out: revoked host f1`. `states`: f1 `revoked`, f2 `registered`. After the revoke, over f1's forwards: `hello` `{"type":"error","code":"unauthorized","message":"host secret revoked"}`; `spoke` `upgrade` `refused`, `status` 401, `statusMessage` `Host revoked` (T-1600 C5). Host CLI `hub status after the revoke exit 1` with `lines: 1 1`. f2's own secret on p1's socket: `hello` `{"type":"welcome"}` (revocation is per host). `same` f1 `sha12` true (the file stays; only admission changed) |
| E1532S3-15 | hub-api | Human | `( . "$Q/env.sh"; m15 ) > "$EV/E1532S3-15.txt" 2>&1` | PRE: kinds `project host-f1 host-f2`. The positive control first (rule 17): `control` is exactly `["p1/.cland/log/qa-scan-control.txt"]`, then `controlRemoved` true; no control hit makes the row INCONCLUSIVE, never PASS. Then each `scan` line (`project`, `host-f1`, `host-f2`) has `sentinels` 1 and `hits` `[]`: no secret in any file under `$Q` (hub log, journal, `hub.db`, territory, the fake hosts' logs and run files, status captures, probe outputs) or `$EV`, apart from the files that hold them by design. Then `publishRefused` is exactly `"control"` once, `publishControlRemoved` true. A hit or refusal under `<EV>` is a QA fault to fix before publication (never print the value); any other hit is a FAIL naming the kind and file only |
| E1532S3-16 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m16 ) > "$EV/E1532S3-16.txt" 2>&1` | `hub stop exit 0; hub down`; every supervisor and agent pid `after TERM: no`; no `alive` line names a fixture process (an `alive` line whose command is unrelated is pid reuse, recorded, not a failure); `processes naming the scratch root or the alias: 0`; `host socket directories outside p1` recorded; `alias` `gone` true |
| E1532S3-17 | hub-api | QA | `s17 > "$EV/E1532S3-17.txt" 2>&1` (QA's own shell) | HEAD, dev and the request's SHA still the same 40 hex; `dirty entries 0`; the root's non-tracker count equals E1532S3-00's; `T leftovers 0` (every fixture and the scratch hub removed their temporary files). A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1532-stage-3.md --commit <dev SHA>`, with a dev SHA that includes the T-1600 landing. At writing it passed at the T-1600 head `765db463f2e74a42c45462bea3b0c222a89be5f0` (which contains dev `d7beb363e`); at dev `d7beb363e` and at the later dev `9bd3b0ebf238d560d0323a692ba14870d922e24d` (T-1650, outside this epic) its only findings named the T-1600 files that exist only on that branch (`hub/test/remote-discovery.test.ts`, `hub/test/remote-discovery-host.test.ts`, `hub/test/remote-discovery-cli.test.ts`) and their titles. The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `d7beb363e3977e168a4db394dde53e9dec965833` (T-1598, T-1599, T-1602, T-1657 landed) and at the T-1600 head `765db463f2e74a42c45462bea3b0c222a89be5f0` (not landed). Re-check every string at the tested build.

- Verified in source:
  - T-1598 (`hub/src/transport/ssh.ts`, landing `54e32c63d`): `#forwardCommand` building `[...sshArguments, '-S', <control>, '-O', operation, '-L', spec, <user@address>]`; the session socket from `hostPaths(...).sessionSocket`; the seams `reconnectDelayMs`, `forwardRetryDelaysMs`, `unlinkSessionSocket`; the default `[100, 200]`; the log `host <h>: session <s> forward abandoned after 3 attempts`; the test schedule `reconnectDelayMs: () => 10, forwardRetryDelaysMs: [10, 10]`.
  - T-1599 (landing `aa42c6efd`): `sshHost` and its refusals `host <name>: tunnel is not up`, `tunnel admission revoked`, `tunnel agent missing capability host-prepared-v1`, `tunnel agent missing version directory <dir>`; `PREPARED_HOST_CAPABILITY = 'host-prepared-v1'` advertised in the agent's hello (`hub/src/host/agent/server.ts:90`); `remoteHostLayout` (`~/.cland-host`, `code/<VERSION>`, `run/hub.json`, `log`); `hostCommandEnvironment` and `remoteCommandEnvironment`'s deny-list; `EXECUTOR_CREDENTIALS` in `shared/executor-credentials.ts`; the boundary test's single leaf; `isCapturedOrExited`; `projectSshHosts` (fake branch: home `hostDirectory(CLAND_FAKE_HOST_ROOT, id)/home`, node `process.execPath`, CLI and spoke from the installed tree, supervisor `remoteSupervisor(layout)`, agent command `[node, cli, 'host', 'serve']`, carrier started per registered record); `sshBinaries` honouring `CLAND_SSH_BIN` only with both fake-host controls; the OpenCode refusal `nonlocal OpenCode shared ignore needs Host atomic publish/append (T-1644)`.
  - T-1600 (head `765db463f`): `LocalDiscovery`, `RemoteDiscovery`, `readDiscovery`, `validUnixSpoke`, `hubDiscovery` (`shared/project-discovery.ts`); `remoteDiscovery` (key order `remote, socket, spoke, secret, version`) and `publishRemoteDiscovery` (JSON with two-space indent and a newline; identical bytes return; a different file throws `host discovery differs; atomic replacement required`; absent file written with mode `0o600`) in `hub/src/host/discovery.ts`; `ReadinessCleanupIncomplete` and `drained` (`hub/src/transport/readiness.ts`); the carrier's `beforeReady(signal)`, its 30000 ms deadline, its 1000 ms drain bound, the reasons `host readiness timed out`, `host readiness cleanup incomplete`, the `connecting` state on the differs reason, and the reason cleared at each new attempt (`delete this.#state.reason` after `#stateTo('connecting')`); the CLI's `inspect` remote branch, `status` output `hub running for <root> (remote)` and `full status unavailable: <error>`, its `--json` object `{ running, root, pid, statusError }` with `pid` undefined for a remote file (so `JSON.stringify` leaves it out), the mute line `cland: remote hub does not answer on <socket> — restore the host tunnel`, the stop refusal `cland: manage the hub on its owning machine; remote discovery is retained`, the start refusal `cland: manage the remote hub on its owning machine`; doctor's remote rows `remote hub answers on <socket>` / `remote hub does not answer on <socket> (<error>)` with fix `restore the host tunnel`, and `valid remote discovery` (`hub/src/doctor/project.ts`), its JSON `{ root, version, checks, summary }` (`hub/src/cli/doctor.ts:65`) with rows `{ name, verdict, detail, fix }` (`hub/src/doctor/report.ts:19–21`); the spoke's `url: d.remote ? d.spoke : …`; both usage lines.
  - Status shapes: `HostTunnelStatus` `{ name, state: 'up' | 'connecting' | 'down', since, reason?, lastProbe: { at, ok } | null, reconnects }` and `tunnelStatuses` (`hub/src/transport/transport.ts`); the print `  <name>  <state> since <since or unknown> · probe <at ok|failed or not run> · reconnects <n>[ · <reason>]` in `describe` (`hub/src/cli/hub.ts:41–45`).
  - Current shape after T-1656 (additive to the historical provenance above): `HostTunnelStatus.state` also includes `revoked`; revoked rows add `revokedAt` and set `since` to that persisted first revocation time. Legacy revocations keep both timestamps null (CLI: `revoked since unknown`); registered rows retain their previous shape.
  - Admission (unchanged since stage 2): `host spoke requires a session launch credential`, `host secret revoked`, `host frame requires its own role-holding session credential` (`hub/src/hub/dispatch.ts`), the spoke's `HTTP/1.1 401 Host revoked` (`hub/src/hub/server.ts:201`), `revoked host <id>` (`hub/src/cli/host.ts:12`).
  - T-1657 (landing `da225fb50`): `hostDirectory` (`shared/fake-host-directory.ts`), `registerFakeHosts` (`hub/src/host/records.ts:112–124`: keys from `<hostDirectory>/host-key.pub`, client key `<hostDirectory>/client-key`, existing records skipped), `createFakeHost` (key, client key, boot id, `home/.cland-host/run` at 0700), `fixtureSocketPath` and `removeFixtureSockets` (`shared/fixture-sockets.ts`).
  - T-1602 (landing `81d84169c`): every ADR string of `s08`; spec headings `### 3.2`, `### 3.3`, `### 3.12` in `docs/spec/v0.4.md`; `## Hosts`, `**Host agent**`, `**Tunnel**` in `GLOSSARY.md`.
  - `agentBootId`'s off-Linux requirement of `CLAND_FAKE_HOSTS` and `CLAND_HOST_BOOT_ID_FILE` (`non-Linux agent requires fake host boot-id file`, `hub/src/host/agent/native.ts:13`); `fake-ssh.ts` passing only `CLAND_FAKE_HOSTS`, `CLAND_FAKE_HOST_ROOT` and its own boot-id path to a one-shot command's environment.
  - Every literal title named above is a literal title in its file at `765db463f` (qa lint passed there); every generated name was expanded from its source loop by hand (`host-ssh-contract.test.ts` adapter map `claude`, `codex`; `host-prepared.test.ts` `mode`; `host-launch-layout.test.ts` `mask.toString(8)` gives `22` and `2`; `host-records.test.ts` `both` and `existingHost`).
- Inferred, not verified by a run:
  - **T-1600's landing**: any change the landing makes against its head (a merge with later dev commits); the landing file list.
  - **The end-to-end scratch hub on fake hosts** (E1532S3-10 to E1532S3-14): that a CLI-started hub with `CLAND_FAKE_HOSTS=f1,f2`, `CLAND_FAKE_HOST_ROOT` and `CLAND_SSH_BIN` brings a fake host `up` once its agent answers, exactly as `remote-discovery-host.test.ts` does through `projectSshHosts` with explicit configurations. No named file starts a CLI hub this way.
  - **The host-side error texts**: that `hub.status` from a host client without a session credential is refused with `host frame requires its own role-holding session credential` when sent by the CLI's socket client (verified for a raw frame at stage 2 and in `dispatch.ts:2295`; the CLI's wrapping, `String(frame.error)` in `shared/socket-client.ts`, is read but not run); hence `admission 1` in E1532S3-11 is recorded and compared, not a pass condition on its own.
  - **Status timing**: how many failed attempts a fake host shows before its agent answers (backoff 1 s doubling to 30 s with ±20 % jitter); a reason is present only between a failed attempt and the next one.

## Probes that mislead

- **No real SSH anywhere.** The scratch hub's `ssh` is `hub/test/fakes/fake-ssh.ts`, chosen through `CLAND_SSH_BIN`, which this brief enables with both `CLAND_FAKE_HOSTS` and `CLAND_FAKE_HOST_ROOT` set; `launch.mjs hub` refuses to start without them. The fake's master forwards real Unix sockets on this Mac; the "host" is a directory behind the `/private/tmp/ct-…` alias.
- **The bootstrap cannot start an agent on macOS, by design of the fakes.** The carrier's bootstrap runs `setsid nohup sh supervisor.sh …`; macOS has no `setsid`, and the fake ssh's one-shot environment carries no `CLAND_HOST_BOOT_ID_FILE`, which an off-Linux agent requires. So QA starts each fake host's supervisor itself (`probe svstart`, Node's detached spawn standing in for `setsid`, as `transport-ssh.test.ts` does) with the host secret the hub minted, and the bootstrap's `--check` gate finds it live and starts nothing. Before the agents answer, the hosts show `connecting` or `down` with `SSH connection or pinned-key admission failed`, and a fake host's run directory may hold a `supervisor.log` line from the failed `setsid` and the bootstrap's `secret` file (mode 600, a holder by design). None of this is a product result; a `setsid` found on the sealed `PATH` blocks the scratch rows (it would let the bootstrap start a supervisor whose agent cannot start).
- **Host states are asynchronous.** The carriers start after `cland hub start` returns, back off between attempts, and clear their reason at each new attempt. `probe wait` polls and records every distinct state; never judge a host by one immediate read. f2's `connecting` row carries `host discovery differs; atomic replacement required` only between attempts, so a single `cland hub status` may print f2 without it.
- **Revocation is not a tunnel state.** `cland host revoke` stops admission, not the carrier: after it, f1's tunnel may still read `up` in `hub status`. Revocation is read from the host row (`probe states`) and from the refusals over the forwards.
- **The cleanup-incomplete state cannot be produced on demand in a live hub** (it needs a readiness callback that never settles). E1532S3-06's named case proves the state, the reason, the unchanged `reconnects`, the single call and the refused `stop`; E1532S3-12 proves only how `cland hub status` prints that reason, by giving the build's `describe` a live `hub.status` reply with f2's row set to it. The substitution is labelled in the row; it is not evidence of the state.
- **Doctor on a host without a session credential** reports the hub row as `remote hub does not answer on <socket> (<refusal>)`: the hub did answer, with a host-admission refusal. That is the product's wording at this build (a host session carries its credential); E1532S3-11 judges that doctor reached the socket and read no pid, not that the row is `ok`.
- The host-side CLI runs from the fake host's home, which has no `.cland/`: `hub status` prints that directory as the root. Judge the `(remote)` suffix and the missing `pid`, not the path.
- The bootstrap's `--check` gate is judged by `svpids` (the supervisor lock still names QA's starter, `agent.pid` still names the agent that answered QA's hello) and by one supervisor process naming f1's run directory, never by a machine-wide `pgrep`.
- `remote-discovery-host.test.ts` and `transport-forwards.test.ts` use injected 10 ms schedules (T-1598's decision a1375ab0); their wall times are not latency results. `node --test` does not enforce per-case budgets; a passing case's duration is not a result of this run.
- An `EINVAL` on `connect` with a path near or above 104 bytes is the macOS socket limit, not a network error: a FAIL anywhere in this run.
- `/private/tmp/ct-<32 hex>` aliases and `/tmp/cland-h-*` directories belong to whichever fixture made them; other sessions' runs make them too. Judge leftovers only by this run's own: `T leftovers`, the alias `probe unalias` removed, the `cland-h-` names `hostPaths` gives for `$Q/p1`.
- Helper modules (`hub/test/ssh-host-fixture.ts`, `hub/test/host-contract.ts`, `hub/test/transport-contract.ts`) are never run alone: under `node --test` each would be reported as one wrapper named by its file, not as an empty file. They run through their entry files.
- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live hub status and live hosts are not evidence for this stage; p1, the fake hosts, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`, or `launch.mjs`). A `cland` on PATH, or the root's CLI, may be older.
- **Credentials are secrets.** Never print a host secret or the project secret; never put one in a capture or a topic. The scan of E1532S3-15 proves they are absent from `$Q` and `$EV` outside the files that hold them by design.
- Apply the full `fixtureEnvironment` result after overlays and add `scratchGitEnvironment` for Git; a hand-written shell `unset` filter keeps inherited `GIT_*` variables (E-1212 stage 1). Under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only.
- Transcript assertions identify stable frame ids (`qa-<n>` per request, `qa-status` for `wait`). Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; A-9063 R2).
- Process cleanup probes use the fixture-owned census (`$Q/pids` plus processes whose command line names `$Q` or the alias, never the census's own pid), registered at launch and checked through exit.
- File-change probes use isolation; here the digest, mtime and inode of a file only this run's processes touch.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log (no droplet here).
- Speed criteria use measured wall times, never projections: no speed criterion is judged here; the forward retry window is the file's own bound.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: none here; every named file must run on this macOS run.
- Re-check helper, function and message names with grep at the tested build; renames happen, and T-1600 had not landed at writing.

## Out of scope

- A real `ssh`, `scp` or `sshd`, a real host, droplet, volume, key or network call (R-1530's QA rule); the human's `~/.ssh`; installing cland's code on a host (E-1533).
- The clone's `.cland/hub.json` copy and the host clone's worktrees (T-1604); atomic publish and append, OpenCode on a nonlocal Host, the overwrite of a changed discovery (T-1644); harness sessions on hosts (T-1603, T-1606, T-1607), git through the tunnel from a host clone, push on ref move, attach, survival and reconnect after a hub restart beyond the discovery file (later stages of E-1532).
- A host session admitted for real through a launched harness: no session is launched here; a credentialed remote spoke welcome, the changed-secret reconnect refusal and the hook CLI over a remote file are proven by `remote-discovery-host.test.ts` and `remote-discovery-cli.test.ts` (E1532S3-06), and a launch reaching f1's agent by `host-ssh-contract.test.ts` (E1532S3-04).
- The live readiness timeout and the live cleanup-incomplete state (named files only, see Probes that mislead).
- The T4 soak and load repetitions beyond E1532S3-09; the full T3 and T4 suites and the stage cover pair (the Coordinator's occasion, Linux droplet and macOS); a live restart.
- A real browser, computer use, the web and Neovim workbenches, and any change to live sessions, holds or the tracker.

Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. This stage launches no browser, no harness and no real SSH; the scratch hub, the fake ssh, the fake hosts' supervisors and agents and the probe use only `$Q` paths, the build's `/private/tmp/ct-…` alias and loopback Unix sockets, under the rule 15 sealed environment with credentials filtered and only the fake harnesses. The run is local on macOS with fakes only.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "the ssh Host and the remote spoke"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1532 stage the ssh Host and the remote spoke` or `qa not clear E-1532 stage the ssh Host and the remote spoke` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
