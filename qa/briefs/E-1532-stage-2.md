# Stage QA brief: E-1532 stage 2 — the tunnel

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier). The run is local, on macOS (BSD `stat -f` and `sed -i ''`, Node 24 with `node:sqlite`, `uuidgen`). No check here is Linux-only: every named file and scratch row runs on this macOS run, and a platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, key or network (R-1530's QA rule):** the carrier runs only against the fake `ssh` stand-in and fake hosts of `hub/test/fakes/` (`fake-ssh.ts`, `fake-host.ts`, `fake-ssh-common.ts`) inside the named test files; the scratch project registers synthetic host records whose transports never start; the supervisor row runs the real `cland host serve` of the build as a local process in a scratch run directory. No real harness, no launched session, no browser, no GUI.

## Stage

- Epic: E-1532 (The SSH transport, the host agent and git through the tunnel, under R-1530).
- Exact stage name: the tunnel.
- Items, in plan order by lane: lane 1 T-1593 (The host agent's file, command and worktree operations), then T-1594 (The supervisor), then T-1595 (The transport layer and the ssh carrier's master); lane 2 T-1596 (Per-host secret admission and revocation); lane 3 T-1597 (The per-host allow list of leased task branches); lane 4 T-1601 (The adapters take their launch layout and files from the session's Host). The run reads the stage's members, counts and state from `task plan show E-1532` (E1532S2-00), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Not members, but expected on dev before this run: T-1653 (host-supervisor fixtures build the fake host HOME under a short socket root) and T-1654 (grant and revoke give one refusal for a held territory lock). Both fix macOS stage-cover regressions of members (T-1594, T-1597; cover 94521ff5, A-16171). E1532S2-00 reads their landings, and every check that depends on them says so.
- Policy: affected/after-stage.
- Scope: affected. The stage's combined changed behaviour at the tested build:
  - T-1593: the host agent's operations on `agent.sock` (run with output and timeout, statDirectory, realpath, fileType, bounded readFile, listFolder, writeFile with a mode, makeDirectory, removePath, freePort, occupants, worktreeAdd and worktreeRemove), the same answers as the `local` Host, and the shared helpers moved under `hub/src/host/agent/` with compatibility exports (`local.ts`, `artifact-folder.ts`, `session-cwd.ts`, `doctor/report.ts`, `occupants.ts`, `worktree-install.ts`).
  - T-1594: `hub/src/host/agent/supervisor.sh` (a `setsid nohup` loop: singleton by an atomic lock directory with pid and native birth, ignores SIGHUP, restarts the agent about 1 s after any exit, never signals a recorded pid), the agent's `agent.pid` receipt and SIGHUP immunity in `cland host serve`, the `kill-agent` control of `hub/test/fakes/fake-host.ts` (test support only, owner-checked through the authenticated agent hello: Coordinator decision cd9925f7 declined a production kill RPC), and the help text.
  - T-1595: the `Transport` interface and per-project registry (`hub/src/transport/transport.ts`), the `ssh` carrier (`hub/src/transport/ssh.ts`: bootstrap over a one-shot connection with the script and the per-host secret on stdin only; one `ControlMaster` per host with the spec's options and four Unix-socket forwards; the reconnect loop 1 s to 30 s with jitter, reset after 30 s up, retry on a wall-clock jump or wake; `-O exit` and a positively proven absent control endpoint before each start; an authenticated probe through `agent.sock` every 30 s), `supervisor.sh --check`, the optional `hosts` field of `hub.status` and its `cland hub status` print. Its four approved decisions (5d260d01): (1) `protocol.ts` adds only the optional `HubStatus.hosts` (with its shared wire type), apart from T-1596's admission edits; (2) a stable `Transport {kind, host, start, stop, wake, status}` and a per-project registry feed `hub.status`, T-1625 adds validation and contract tests without changing members; (3) bootstrap runs the configured installed supervisor and agent command, code delivery stays with T-1606; (4) the additive `supervisor.sh --check` reuses the original pid and birth liveness check, and the unchanged supervisor files of T-1594 must pass. The A-16146 fixes (decision 5ba557cb): after `-O exit` the carrier unlinks the control socket only when a native connect to it fails with ENOENT or ECONNREFUSED; any other outcome is fenced with the normal backoff and the path-free status reason `control endpoint has not closed`; one carrier per project and host (`host transport already owned`); and the private pin is exclusive (`GlobalKnownHostsFile=/dev/null`, `KnownHostsCommand=none`, `VerifyHostKeyDNS=no`, `UpdateHostKeys=no`, the `UserKnownHostsFile` value config-quoted for paths with spaces). No production code constructs a carrier at this stage (the `ssh` Host is stage 3), so a live hub shows registered hosts as `down` with no probe.
  - T-1596: per-host secret admission on the Unix spoke edge (a host spoke needs the launch credential of a role-holding session whose row or captured launch admission is on that host; the proved identity is the one admitted, Coordinator-approved correction A-16013) and on the hub socket (a host client never acts as the human: every frame needs its own role-holding session credential on that host, and only `HOST_SESSION_FRAMES` pass); `cland host revoke <id>` (human-only, local CLI or Neovim) revokes the secret, closes that host's live connections and makes later hellos fail naming revocation; the project secret's admission is unchanged.
  - T-1597: the territory `update` hook with `CLAND_PUSH_HOST` (only `refs/heads/t/*` leased to that host; tags, other refs and deletions refused, each reason naming the host), the lease API (`grantBranchLease`, `revokeBranchLease`, under the territory lock), the hook upgrade at hub start, revocation of every host's lease before a merge or merge batch reads a task branch, and the seam recorded on T-1591 (decision topic-1351, 2026-11-02 23:43Z): a `git-receive-pack` connection holds the territory lock from admission through native daemon close, capped at 30 s, while `git-upload-pack` takes no lock; the receive cap is injectable (`receiveTimeoutMs`, decision e6fdcd00, no duration allowance). The second seam note on T-1591 (decision 7e3a3955, 2026-11-03 01:55Z): the public revoke waits for a held lock, up to the push cap plus a margin (`BRANCH_REVOKE_WAIT_MS`) with the lock module's bounded backoff; receive waits up to 30 seconds (T-1702); merge keeps immediate refusal; a caller already holding the lock takes the re-entrant path. With T-1654, a held lock gives one refusal, `another territory operation holds the lock`, with ` (pid <n>)` when the holder is known.
  - T-1601: each adapter takes its run directory, log directory, discovery file, node, CLI and spoke entries from the launch Host's layout, writes its session-side files through `LaunchFiles` on that Host, and OpenCode's port and password come through that Host. Its decisions: the local shared-ignore algorithm moves unchanged to `hub/src/host/local-opencode-files.ts`, and nonlocal paths that need Host metadata or atomic publish refuse naming T-1644 (96379b59, 7b27eb1c); the optional `HostLaunchLayout.modDir` (b4c39b35): the `local` Host returns the historical mod directory (`LOCAL_MOD_DIR`), a nonlocal Claude layout without one refuses before native launch; the Codex app-server socket and the network-local sandbox deny use the same Host `runDirectory`, canonicalized through that Host (A-16005 correction). On the `local` Host every argv, environment, path, mode and file byte is as before.
- Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

The run is meant to take about 1.5 to 2 hours: setup and E1532S2-00 to E1532S2-02 about 15 minutes (the typecheck included); the named files E1532S2-03 to E1532S2-10 about 50 minutes, one at a time; the scratch rows E1532S2-11 to E1532S2-17 about 20 minutes. Waits for cover-quiet admission or load come on top and are not product results.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what.

| criterion | proven by |
| --- | --- |
| T-1593 C1 (run: exit, stdout, stderr, timeout kill; stat, realpath, fileType, readFile, listFolder answer as the `local` Host) | E1532S2-03 (`host-agent-files.test.ts`; `host-local-contract.test.ts` for the local side after the helper move); E1532S2-05 (the same file under the long temp root) |
| T-1593 C2 (readFile refuses a directory, a missing path, an oversize file; exact bytes) | E1532S2-03; E1532S2-05 |
| T-1593 C3 (writeFile, makeDirectory, removePath act on the given path and mode; removePath never follows a symlink out) | E1532S2-03 |
| T-1593 C4 (worktreeAdd with the root `node_modules` link and the stale-install warning; worktreeRemove refuses changes) | E1532S2-03; E1532S2-08 (`task-worktrees.test.ts`, the moved helper's consumer) |
| T-1593 C5 (occupants by real paths, through a symlinked alias) | E1532S2-03 |
| T-1594 C1 (supervisor runs the agent; a second start exits without starting another) | E1532S2-04; E1532S2-05 (repeated under the long temp root, with T-1653); E1532S2-15 (real `cland host serve` under the shipped script: `supervisor already running`, `--check`) |
| T-1594 C2 (after SIGKILL a new agent answers hello within 3 s; a harness keeps its identity in the new table) | E1532S2-04; E1532S2-05; E1532S2-15 (new agent hello timed from the kill; harness identity only in the files) |
| T-1594 C3 (survive the end of the starting session and SIGHUP; no `systemctl` or `systemd-run`) | E1532S2-04; E1532S2-05; E1532S2-15 (starter exits, HUP to both); E1532S2-01 (no `systemctl` or `systemd-run` in the script, `cland host` or the agent sources) |
| T-1594 C4 (`fake-host.ts kill-agent <host>` kills that host's agent only) | E1532S2-04; E1532S2-05 |
| T-1595 C1 (master argv options and four Unix-socket forwards, no port) | E1532S2-06 (`transport-ssh.test.ts`); E1532S2-01 (the options and forwards in `ssh.ts`) |
| T-1595 C2 (secret only on stdin; a second bootstrap on a live supervisor starts nothing) | E1532S2-06; E1532S2-01 (the bootstrap script's `--check` gate and stdin `printf`); E1532S2-15 (`--check` exits 0 on a live supervisor, 1 otherwise) |
| T-1595 C3 (backoff 1, 2, 4 … 30 s with jitter; reset after 30 s up; retry at once on a clock jump) | E1532S2-06 (`transport-policy.test.ts` and the injected-clock carrier case); E1532S2-01 |
| T-1595 C4 (`-O exit` and stale control socket removal before each start; a new master multiplexes after SIGKILL) | E1532S2-06 (the refused-exit fence, concurrent carriers, the master restart) |
| T-1595 C5 (a SIGKILLed master is back with four forwards and a probe within 10 s) | E1532S2-06; E1532S2-05 (the same file with the long temp root) |
| T-1595 C6 (probe every 30 s through `agent.sock`; `hub.status` and `cland hub status` show state, since, last probe, reconnects) | E1532S2-06 (`transport-status.test.ts`, `hub-status-component.test.ts`, the 30 s probe case); E1532S2-11 (`cland hub status` and `--json` on a real scratch hub with two host records); E1532S2-13 (the `hub.status` frame over the project secret) |
| T-1595 C7 (a different pinned key is never connected; refusal logged without key material) | E1532S2-06 (wrong pin; exclusive pin despite matching global trust; spaces) |
| T-1596 C1 (host secret plus own-host role-holding launch credential welcomed with the role) | E1532S2-07 (`host-secret-admission.test.ts`, held-spawn variants included) |
| T-1596 C2 (another host's session, a local session, no credential, no role: refused) | E1532S2-07; E1532S2-13 (scratch: a host spoke hello with no launch credential refused) |
| T-1596 C3 (a host client never acts as the human; identity-free and human-only frames forbidden) | E1532S2-07; E1532S2-13 (`hub.status`, `role.set`, `session.launch`, `host.revoke` from a host client, each forbidden) |
| T-1596 C4 (hook, mod-bridge and CLI frames with an own-host session credential dispatched as that session) | E1532S2-07 |
| T-1596 C5 (`cland host revoke <id>` closes live connections; later hellos refused naming revocation; refused from a session or host client) | E1532S2-07; E1532S2-13 (host client refused); E1532S2-14 (the CLI revoke closes a held host connection; `host secret revoked`; spoke 401 `Host revoked`; the other host unaffected; persists across a hub restart) |
| T-1596 C6 (project secret admission unchanged; hub-socket, spoke-auth, web-authority files pass unedited) | E1532S2-07 (`daemon.test.ts`, `resilience-component.test.ts`, `web-authority.test.ts`); E1532S2-01 (unedited); E1532S2-13 (project-secret client welcomed; wrong secret refused with the unchanged text) |
| T-1597 C1 (leased push accepted; another host's, unleased, tag and `dev` refused naming the host) | E1532S2-08 (`host-allow-list.test.ts` through the real git daemon); E1532S2-12 (scratch territory, the shipped hook with `CLAND_PUSH_HOST`) |
| T-1597 C2 (grant and revoke only under the territory lock; a racing push accepted before or refused after) | E1532S2-08; E1532S2-09 (the contention identity repeated, with T-1654) |
| T-1597 C3 (merge and merge batch revoke every host's lease first; later push refused) | E1532S2-08 (`host-allow-list.test.ts`, `merge-batches.test.ts`) |
| T-1597 C4 (existing territory gets the new hook at hub start; unhosted guarded pushes as today) | E1532S2-08; E1532S2-11 (the planted pre-change hook replaced at a real hub start, with a control push before); E1532S2-12 (unhosted pushes) |
| T-1597 C5 (territory-cli, territory-lock, merge, task-worktrees pass unedited) | E1532S2-08; E1532S2-01 |
| T-1601 C1 (a mapped Host layout supplies every session file, argv path and environment path) | E1532S2-10 (`host-launch-layout.test.ts` mapped cases; `codex-sandbox-host.test.ts` mapped network-local deny) |
| T-1601 C2 (local launches byte-identical) | E1532S2-10 (local cases under both umasks; the C5 files) |
| T-1601 C3 (OpenCode port from the Host's freePort; password read through the Host) | E1532S2-10 |
| T-1601 C4 (boundary lint fails on `writeFile`, `mkdir`, `rm`, `chmod` imports in the adapters) | E1532S2-10 (`host-boundary.test.ts`) |
| T-1601 C5 (claude-code-adapter, codex-adapter, opencode-adapter, opencode-native, launch-files pass unedited) | E1532S2-10; E1532S2-01 |
| T-1653 C1 and C2 (outside the stage: the macOS 104-byte socket budget) | E1532S2-05 (both supervisor identities and the fake-SSH file under a temp root as long as the suite's); E1532S2-04 (the guard cases in `fixture-socket-path.test.ts`); E1532S2-01 (the guard string) |
| T-1654 C1 and C2 (outside the stage: a single contention refusal) | E1532S2-08; E1532S2-09; E1532S2-01 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1532` lists in stage `the tunnel`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit, and so do T-1653 and T-1654.

At writing, dev was `e21b64bffa6ccec52b4457285cca27d9052fadf3`, and every member had landed: T-1593 `53ecaf87343b3719a51f09f818871bcfb70272cf`, T-1594 `1650fd40ef0591f9ec1cce3aaaa633035af7af12`, T-1597 `1fcc37db5702bacc22d63be1bcbc26362a48099d`, T-1601 `ff7e6ec8fbca6c0b84535a3653f947480b869a36`, T-1596 `f7b7a8367f3c7d1a917ca512fcba3e824debeff7`, T-1595 `e21b64bffa6ccec52b4457285cca27d9052fadf3` (reviewed clear rev-35-1595-final-2, the last member to land; its branch `t/T-1595-the-transport-layer-and-the-ssh-carrier` head `ee744a6167e49b4ff213ea56896878161001ddc3` was merged with dev at `f7b7a8367`, and the landing's file list equals that head's, and so do its contents under hub/src, hub/test, shared and docs, checked at writing). T-1653 (branch head `9034e779f36995d9b81af7825f05628637ffb143`) and T-1654 (branch head `a05c1902332999bb848df237c73b586bbf0e398a`) had not landed: they were queued, both final evidence clear, and every expectation that depends on them was read from those heads. **The request must name a dev SHA that includes the T-1653 and T-1654 landings as well as every member's; a dev SHA without any of them is BLOCKED (E1532S2-00), reported to the requester, nothing else run.** E1532S2-00 saves the T-1595 landing (`git show --stat`) as `$EV/T-1595-landing.txt` and compares its file list with the branch head's own changes against `f7b7a8367`, which were `.agents/skills/implement/CHANGES/T-1595-ssh-transport.md`, `docs/agents/host-agent.md`, the file notes under `docs/agents/tests/` for the fake-SSH, transport-policy, transport-ssh and transport-status files, `docs/agents/tests/index.md`, `docs/hub/ssh-transport.md`, `hub/README.md`, `hub/src/cli/hub.ts`, `hub/src/host/agent/supervisor.sh`, `hub/src/hub/dispatch.ts`, `hub/src/protocol.ts`, `hub/src/transport/ssh.ts`, `hub/src/transport/transport.ts`, `hub/test/fakes/fake-ssh-common.ts`, `hub/test/tiers.json`, `hub/test/transport-policy.test.ts`, `hub/test/transport-ssh.test.ts`, `hub/test/transport-status.test.ts` and `shared/wire/index.ts`. They were equal at writing; a later difference cannot occur for a landed commit, so any difference means E1532S2-00 found a different landing and is read before judging. Read the T-1653 and T-1654 landings against their branch heads (E1532S2-00 prints both lists; a landing that differs from its head is read before judging: a test file it adds is also run in its row, a source change is re-grepped, a `hub/test/durations.json` change is timing data, not a test): E1532S2-04, E1532S2-05 and the fake-host strings of E1532S2-01 depend on T-1653; E1532S2-08, E1532S2-09 and the contention strings of E1532S2-01 depend on T-1654.

**Every expected string in this brief (refusal texts, status lines and fields, hook lines, CLI usage and output, script messages, socket and file names, test titles) was copied with grep from source at dev `e21b64bff` (every member landed), or from the T-1653 and T-1654 heads where named, never paraphrased. Each is marked verified or inferred under "Source provenance" below. The run re-greps them at the tested build (E1532S2-01 and the PRE lines) and reads a renamed string before judging.** A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no run id on purpose.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). No named file here needs `web/dist`; E1532S2-02 runs the typecheck only.

**Where things live.** All scratch state is outside the project root: the scratch root `$Q` is `/private/tmp/q32-…` (its realpath, 23 bytes; see "Unix socket paths"), and it holds the scratch project p1, the territory clone, the supervisor's run directory, the scratch HOME and XDG directories and every helper file. The only paths under the repository are the ones the QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1532/`. Nothing is written to `.cland/tasks/`; E1532S2-00 and E1532S2-18 print the root's non-tracker status, which must not change.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays, then `scratchGitEnvironment` with a scratch `core.excludesFile` (the same builder sequence as the E-1536 stage-3 and E-1538 stage-1 briefs). It drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*`, `FAKE_*`, `SSH_*`, provider and account variable, keeps `PATH`, `SHELL`, `TERM` and `TMPDIR`, and synthesizes its own scratch values under `$Q`. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its territory, its `hub.db` or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, any `hub.json` secret or `~/.config/cland/sandbox-remote.secrets.toml`; never run a real `ssh`, `scp` or `sshd`, never read a real `known_hosts` or key. The live hub is read only by QA's own shell for E1532S2-00's plan read and `quiet` (cover-quiet admission: the live verify queue is read, nothing is submitted). **Harnesses:** only the fakes in `$W/hub/test/fakes/` (`CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, first on the scratch hub's `PATH`); no session is launched. **Browser (rule 18):** none. **Preconditions (rule 22):** every check function prints a `PRE:` line before acting; when that line differs from the row's stated precondition, record the row `BLOCKED` with the line and stop the dependent rows. **Secrets (rule 15):** the scratch project secret, the two host secrets and the supervisor's synthetic agent secret are never printed, posted or written under `$EV`; the probe prints lengths, modes and counts only, keeps the values in `$Q/secrets1532.json` (mode 600) and redacts every error text through them; E1532S2-16 scans for them with a positive control.

**Unix socket paths (macOS 104 bytes, NUL included).** Every socket this run creates stays under 104 bytes:
- The scratch rows: `$Q` is `/private/tmp/q32-XXXXXX` (23 bytes) and p1 is `$Q/p1` (26 bytes), so the hub socket `.cland/hub.sock`, the spoke socket `.cland/run/spoke.sock` and the host socket directory `.cland/run/hosts/<id>/` stay inside the project. `hostPaths` (`hub/src/host/records.ts`) keeps the host socket directory inside the project only when its longest socket name fits 80 bytes (`SOCKET_PATH_MAX` 100 minus 20), which needs a project root of at most 27 bytes; a longer root would place it under the system TMPDIR, outside `$Q`. The probe prints each socket path's byte count with its NUL and `socketDirectoryInside`; a count of 104 or more, or `socketDirectoryInside` false, makes the row BLOCKED. The supervisor's run directory `$Q/sv/run` puts `agent.sock` at 41 bytes.
- The named files: they make their own sockets. Since T-1653 the fake hosts live behind the shared short-socket helper (`fixtureSocketPath` of `test-support/socket-path.ts`, an alias `/private/tmp/ct-<32 hex>` to the fixture root) and `fake-host-socket.ts` refuses a fake-host socket path of 104 bytes or more before any connect; the carrier test uses its own `/tmp/ts-` roots and `hostPaths`' short fallback. E1532S2-05 runs the socket-heavy files with `TMPDIR` at `/private/tmp/qa-e1532-lr-<36-char uuid>`, the same length as the suite's `/private/tmp/cland-suite-<36-char uuid>` root, which is where the stage cover failed with `connect EINVAL` on a 107-byte path before T-1653. Every other `nt` row keeps the system `TMPDIR` (on macOS `/var/folders/...`; never `/tmp` itself, T-1030).

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet` and the plan read, runs the named test files through `nt`, `ntl` and `ntc` (which seal each run), runs the read-only source checks and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. Never use `env -i`.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-1532; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1532s2-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1532/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/q32-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/q32-…, 23 bytes
chmod 700 "$Q"; echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' ')"
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache" "$Q/p1" "$Q/sv" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/claude" "$Q/codex"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log((v.holder?.session??v.holder?.kind??"none")+" waiters "+(v.waiters??[]).length)})'; }
quiet() { for i in $(seq 1 10); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; sleep 60; done; echo "BLOCKED: the verify slot is not free after 10 minutes: ${h:-queue read failed}"; return 1; }
# ld: the one-minute load must be 10 or below before each test file (docs/agents/tests.md load rule); prints free disk space too
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l; free kB $(df -k "${TMPDIR:-/var/tmp}" | awk 'NR==2{print $4}')"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10 after 10 minutes: $l"; return 1; }
# nt <id> <files…>: named files from $W, sealed, one file at a time, TAP output, after quiet and ld; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; : > "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; grep -E '^exit ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# ntl <id> <files…>: as nt, with TMPDIR at a fresh temp root exactly as long as the suite's /private/tmp/cland-suite-<uuid> (set by $Q/launch.mjs through the shared builder, never exported after sealing); prints the root's leftovers after the row
ntl() { id=$1; shift; quiet || return 1; LR=/private/tmp/qa-e1532-lr-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$LR" && echo "$LR" > "$EV/$id.root"; : > "$EV/$id.log"; echo "long root $LR bytes $(printf '%s' "$LR" | wc -c | tr -d ' ')" >> "$EV/$id.log"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node "$Q/launch.mjs" long "$LR" "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log" ); done; echo "long root leftovers $(ls -A "$LR" | wc -l | tr -d ' ')" >> "$EV/$id.log"; grep -E '^(long root|exit )' "$EV/$id.log"; grep -E '^ *not ok|# SKIP|EINVAL' "$EV/$id.log" | head -20; }
# ntc <id> <runs>: the allow-list contention identity alone, <runs> times in a row, as nt otherwise; its own local loop variable (ld's global `for i` would reset a shared `i`, labelling every repetition `run 1`)
ntc() { local rep; id=$1; quiet || return 1; : > "$EV/$id.log"; for rep in $(seq 1 "$2"); do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern='grant and revoke cannot rewrite the allow list' hub/test/host-allow-list.test.ts >> "$EV/$id.log" 2>&1; echo "exit $? run $rep" >> "$EV/$id.log" ); done; grep -E '^exit ' "$EV/$id.log"; grep -E '^ *not ok' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays, including its synthesized HOME, Git, account and fake-harness paths; do not merely unset keys absent from it. Then apply `scratchGitEnvironment`, and remove the broader credential prefixes last. The generated file first unsets dropped inherited names and then exports every retained value; never print or post those exports. Under rule 15, the last lines print a count and variable names only, never values.

A launch that needs variables of its own (the scratch hub's fake-harness `PATH` and `CLAND_*` inputs, `CLAND_PUSH_HOST` for a push, the long `TMPDIR` of `ntl`, the supervisor's `CLAND_HOST_*` and fake-host inputs) never adds them with an `env …` prefix, an `export` after sourcing `env.sh` or a spread of `process.env`: `$Q/seal.mjs` passes them as overlays to `fixtureEnvironment(Q, base, overlays)` and then `scratchGitEnvironment(Q, …)`, the same builder sequence, with nothing added afterwards. `$Q/launch.mjs` starts the hub, the pushes and the long-root test files with that environment; the probe's `svstart` uses `seal.mjs` directly.

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" "$EV" "$R" > "$Q/env.sh" <<'JS'
const [m,root,worktree,ev,live]=process.argv.slice(2);
const {fixtureEnvironment,scratchGitEnvironment}=await import(m);
let env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root, QA_EV: ev, QA_R: live,
});
env=scratchGitEnvironment(root,env,{excludesFile:`${root}/home/.gitignore-global`});
for(const k of Object.keys(env))if(/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
FCC=$QA_W/hub/test/fakes/claude-code; FCX=$QA_W/hub/test/fakes/codex; FOC=$QA_W/hub/test/fakes/opencode
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# probe <mode> [args…]: host records, admission frames, territory hook and leases, host agent, secret scan (see probe.mjs)
probe() { node "$QA_Q/probe.mjs" "$@"; }
rd() { node "$QA_Q/probe.mjs" redact; }
ld() { for i in $(seq 1 10); do l=$(sysctl -n vm.loadavg | awk '{print $2}'); if awk -v l="$l" 'BEGIN{exit !(l<=10)}'; then echo "load $l"; return 0; fi; sleep 60; done; echo "BLOCKED: one-minute load not at or below 10: $l"; return 1; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
# hubstart: start this project's hub with the fakes authoritative and first on its PATH, no machine-wide orphan sweep; census its pid
hubstart() { node "$QA_Q/launch.mjs" hub && hp >> "$QA_Q/pids"; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
# run <label> <command…>: exit status, then the first lines of stdout and stderr, both redacted
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; rd < "$QA_Q/r.out" | head -n 30 | sed 's/^/  out: /'; rd < "$QA_Q/r.err" | head -n 30 | sed 's/^/  err: /'; }
# has <text>: how many lines of the last run's output contain the text
has() { cat "$QA_Q/r.out" "$QA_Q/r.err" 2> /dev/null | grep -c -F -- "$1"; }
# hpush <label> <host or ""> <git push args…>: a push from the territory clone, with CLAND_PUSH_HOST as git daemon sets it for that host (none for "")
hpush() { l=$1; h=$2; shift 2; node "$QA_Q/launch.mjs" push "$h" "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; rd < "$QA_Q/r.err" | grep -E 'cland:|rejected|->' | sed 's/^/  err: /'; }
# census <dir>: processes whose command line names that scratch directory (the fixture-owned census, never a machine-wide pgrep)
census() { ps -Ao pid=,command= > "$QA_Q/ps.txt"; grep -F "$1" "$QA_Q/ps.txt" | grep -v -E 'probe\.mjs|ps -Ao|grep ' | wc -l | tr -d ' '; }
ENV
cat > "$Q/seal.mjs" <<'JS'
// seal(overlays): the sealed environment for one launch: fixtureEnvironment(Q, base, scratch overlays + the launch's own), then scratchGitEnvironment; nothing is added afterwards
const W = process.env.QA_W, Q = process.env.QA_Q;
if (!W || !Q?.startsWith('/private/tmp/q32-')) throw new Error('not a scratch run');
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
export const seal = extra => scratchGitEnvironment(Q, fixtureEnvironment(Q, process.env, {
  XDG_CONFIG_HOME: `${Q}/xdg/config`, XDG_STATE_HOME: `${Q}/xdg/state`, XDG_DATA_HOME: `${Q}/xdg/data`, XDG_CACHE_HOME: `${Q}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid', GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  ...extra,
}), { excludesFile: `${Q}/home/.gitignore-global` });
JS
cat > "$Q/launch.mjs" <<'JS'
// node "$QA_Q/launch.mjs" hub | push <host or ""> <git push args…> | long <long root> <test file>   (sealed; the overlays go through seal.mjs)
import { spawn } from 'node:child_process';
const { seal } = await import(`${process.env.QA_Q}/seal.mjs`);
const [mode, ...args] = process.argv.slice(2), Q = process.env.QA_Q, W = process.env.QA_W;
let bin = process.execPath, argv, extra, cwd = process.cwd();
if (mode === 'hub') {   // the fakes authoritative and first on PATH, no machine-wide orphan sweep
  const f = `${W}/hub/test/fakes`;
  extra = { PATH: `${f}/claude-code:${f}/codex:${f}/opencode:${process.env.PATH}`, CLAND_CLAUDE_BIN: `${f}/claude-code/claude`, CLAND_CODEX_BIN: `${f}/codex/codex`, CLAND_OPENCODE_BIN: `${f}/opencode/opencode`, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_ADAPTER_POLL_MS: '200', CLAND_CLAUDE_AGENTS_MS: '500' };
  argv = [`${W}/hub/bin/cland.ts`, 'hub', 'start'];
} else if (mode === 'push') {   // CLAND_PUSH_HOST as git daemon sets it; an empty host sets none
  const [host, ...rest] = args;
  bin = 'git'; argv = ['-C', `${Q}/c1`, 'push', 'origin', ...rest]; extra = { CLAND_PUSH_HOST: host || undefined };
} else if (mode === 'long') {   // one named test file with TMPDIR at the long root
  const [root, file] = args;
  if (!root?.startsWith('/private/tmp/qa-e1532-lr-')) throw new Error('not a long root');
  cwd = W; argv = ['--test', '--test-concurrency=1', '--test-reporter=tap', file]; extra = { TMPDIR: root };
} else throw new Error(`unknown launch mode ${mode}`);
const child = spawn(bin, argv, { cwd, env: seal(extra), stdio: 'inherit' });
child.on('error', () => { process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
JS
node --check "$Q/seal.mjs" && node --check "$Q/launch.mjs" && echo "launcher checked"
( . "$Q/env.sh"; env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)' )
( . "$Q/env.sh"; env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' '; echo )
```

The pre-T-1597 territory hook, taken from source at T-1597's parent (never retyped), for the upgrade check of E1532S2-11:

```sh
git -C "$R" show 1fcc37db5702bacc22d63be1bcbc26362a48099d^:hub/src/territory.ts | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=s.indexOf("export const TERRITORY_HOOK = `")+31,b=s.indexOf("`;",a);const h=s.slice(a,b).replaceAll("\\${","${");require("fs").writeFileSync(process.argv[1],h,{mode:0o755});console.log("old hook: bytes "+h.length+", CLAND_PUSH_HOST "+h.includes("CLAND_PUSH_HOST")+", protected line "+h.includes("and dev are protected; use cland push for Coordinator dev commits"))})' "$Q/old-update-hook"
```

It prints `CLAND_PUSH_HOST false` and `protected line true`; otherwise the extraction failed and E1532S2-11 is BLOCKED.

The probe. It refuses to run outside `$Q`, imports only from `$W`, never prints a secret and never runs a real `ssh`.

```sh
cat > "$Q/probe.mjs" <<'JS'
// node "$QA_Q/probe.mjs" <mode> [args…]   (sealed) host records, admission frames, hook and leases, host agent, scans
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
const W = process.env.QA_W, Q = process.env.QA_Q, EV = process.env.QA_EV;
if (!W || !Q?.startsWith('/private/tmp/q32-')) { console.log(JSON.stringify({ refused: 'not a scratch run' })); process.exit(2); }
const [mode, ...args] = process.argv.slice(2);
const out = (k, v) => console.log(JSON.stringify({ [k]: v }));
const SF = `${Q}/secrets1532.json`;
const known = () => existsSync(SF) ? JSON.parse(readFileSync(SF, 'utf8')) : [];
const remember = (kind, value) => { const k = known(); if (!k.some(x => x.kind === kind)) { k.push({ kind, value }); writeFileSync(SF, JSON.stringify(k), { mode: 0o600 }); } };
const redact = text => { let t = String(text); for (const k of known()) if (k.value.length >= 16) t = t.split(k.value).join(`<${k.kind}>`); return t.replace(/Bearer\s+\S+/g, 'Bearer <redacted>').replace(/[0-9a-f]{64}/gi, '<hex64>'); };
const bytes = path => Buffer.byteLength(path, 'utf8') + 1;
if (mode === 'redact') { let s = ''; process.stdin.on('data', d => { s += d; }).on('end', () => process.stdout.write(redact(s))); }
else {
const { hostPaths } = await import(`${W}/hub/src/host/records.ts`);
const { layout } = await import(`${W}/hub/src/project.ts`);
const hostSecret = (project, id) => readFileSync(hostPaths(project, id).secret, 'utf8');
const sock = project => layout(project).socket;
// one JSON-lines connection to the hub socket
function lines(path) {
  return new Promise((resolve, reject) => {
    const s = createConnection(path); const frames = [], waiters = []; let buf = '', closed = false;
    s.setEncoding('utf8'); s.on('error', () => {});
    s.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; const f = JSON.parse(l); const w = waiters.findIndex(x => x.p(f)); if (w >= 0) waiters.splice(w, 1)[0].r(f); else frames.push(f); } });
    s.on('close', () => { closed = true; for (const w of waiters.splice(0)) w.r(null); });
    const next = (p, ms = 5000) => new Promise(r => { const i = frames.findIndex(p); if (i >= 0) return r(frames.splice(i, 1)[0]); if (closed) return r(null); const w = { p, r }; waiters.push(w); setTimeout(() => { const j = waiters.indexOf(w); if (j >= 0) { waiters.splice(j, 1); r(null); } }, ms); });
    s.once('connect', () => resolve({ send: f => s.write(JSON.stringify(f) + '\n'), next, closed: () => closed, end: () => s.destroy() }));
    s.once('error', reject);
  });
}
const helloFacts = f => f ? { type: f.type, ...(f.type === 'error' ? { code: f.code, message: redact(f.message) } : {}) } : null;
switch (mode) {
  case 'register': { // <project> <id…>: host records through the hub's own store while the hub is stopped
    const [project, ...ids] = args;
    const { Store } = await import(`${W}/hub/src/hub/store.ts`);
    const { HostSecretStore } = await import(`${W}/hub/src/host/records.ts`);
    const store = new Store(join(project, '.cland', 'hub.db'));
    try {
      const secrets = new HostSecretStore(project, store.hosts);
      for (const id of ids) {
        const r = secrets.register({ id, address: id, user: 'agent', clientKeyPath: `${Q}/no-client-key`, knownHosts: `${id} ssh-ed25519 ${Buffer.from(`qa-${id}`).toString('base64')}\n` });
        const p = hostPaths(project, id), secret = readFileSync(p.secret, 'utf8');
        remember(`host-${id}`, secret);
        out(id, { state: r.state, transport: r.transport, secretMode: (statSync(p.secret).mode & 0o777).toString(8), secretLength: secret.length, directoryMode: (statSync(p.directory).mode & 0o777).toString(8), socketDirectoryInside: p.socketDirectory.startsWith(project + '/'), agentSocketBytes: bytes(p.agentSocket), gitSocketBytes: bytes(p.gitSocket), controlSocketBytes: bytes(p.controlSocket) });
      }
    } finally { store.close(); }
    break;
  }
  case 'remember-project': { const [project] = args; remember('project', readFileSync(join(project, '.cland', 'secret'), 'utf8').trim()); const l = layout(project); out('sockets', { hubSocketBytes: bytes(l.socket), spokeSocketBytes: bytes(l.spokeSocket), hubInside: l.socket.startsWith(project + '/'), spokeInside: l.spokeSocket.startsWith(project + '/') }); break; }
  case 'states': { // <project>: host rows, read only
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(join(args[0], '.cland', 'hub.db'), { readOnly: true });
    try { out('hosts', db.prepare('select id,transport,state from hosts order by id').all().map(r => ({ ...r }))); } finally { db.close(); }
    break;
  }
  case 'hosts': { // <status json file>: the hosts field and whether any secret appears
    const text = readFileSync(args[0], 'utf8'), v = JSON.parse(text);
    out('hosts', v.hosts ?? 'absent'); out('secretHits', known().filter(k => text.includes(k.value)).map(k => k.kind));
    break;
  }
  case 'client': { // <project> <id|project|wrong> [frame types…]: a client hello on the hub socket, then each frame
    const [project, who, ...types] = args;
    const secret = who === 'project' ? readFileSync(join(project, '.cland', 'secret'), 'utf8').trim() : who === 'wrong' ? randomBytes(32).toString('hex') : hostSecret(project, who);
    const c = await lines(sock(project));
    c.send({ type: 'hello', protocol: 2, client: 'cli', secret });
    out('hello', helloFacts(await c.next(f => f.type === 'welcome' || f.type === 'error')));
    // the frame shapes of host-secret-admission.test.ts; `as` names a session that has no row on any host
    const as = { name: 'qa-none', sessionId: 'qa-none', shell: true, credential: 'qa-not-a-credential' };
    for (const [i, type] of types.entries()) {
      const frame = type === 'role.set' ? { type, session: 'qa-none', role: 'coordinator', as } : type === 'session.launch' ? { type, name: 'qa-evil', as } : type === 'host.revoke' ? { type, host: who, as } : { type };
      c.send({ ...frame, id: `qa-${i}` });
      const r = await c.next(f => f.type === 'result' && f.id === `qa-${i}`);
      out(type, r ? { ok: r.ok, ...(r.ok ? { hosts: r.value?.hosts ?? 'absent', secretHits: known().filter(k => JSON.stringify(r.value).includes(k.value)).map(k => k.kind) } : { code: r.code ?? null, error: redact(r.error ?? '') }) } : null);
    }
    c.end(); break;
  }
  case 'hold': { // <project> <id>: a host client that stays connected; reports when the hub closes it
    const [project, id] = args;
    const c = await lines(sock(project));
    c.send({ type: 'hello', protocol: 2, client: 'cli', secret: hostSecret(project, id) });
    out('hello', helloFacts(await c.next(f => f.type === 'welcome' || f.type === 'error')));
    const t0 = Date.now(); writeFileSync(`${Q}/held`, String(t0));
    while (!c.closed() && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 50));
    out('held', { closedByHub: c.closed(), heldMs: Date.now() - t0 }); c.end(); break;
  }
  case 'spoke': { // <project> <id>: a WebSocket spoke hello authorised by the host secret alone, without a launch credential
    const [project, id] = args;
    const WebSocket = createRequire(`${W}/hub/package.json`)('ws');
    const result = await new Promise(resolve => {
      const ws = new WebSocket(`ws+unix:${layout(project).spokeSocket}:/`, { headers: { Authorization: `Bearer ${hostSecret(project, id)}` }, handshakeTimeout: 3000 });
      const done = v => { try { ws.terminate(); } catch {} resolve(v); };
      ws.on('unexpected-response', (_req, res) => done({ upgrade: 'refused', status: res.statusCode, statusMessage: res.statusMessage }));
      ws.on('error', e => done({ upgrade: 'error', error: redact(e.message) }));
      ws.on('open', () => { ws.once('message', m => { const f = JSON.parse(String(m)); done({ upgrade: 'open', frame: helloFacts(f) }); }); ws.send(JSON.stringify({ type: 'hello', protocol: 2, cwd: project, sessionId: 'qa-absent', name: 'qa-absent' })); });
      setTimeout(() => done({ upgrade: 'timeout' }), 6000);
    });
    out('spoke', result); break;
  }
  case 'hook': { // <project>: the territory update hook against the build's TERRITORY_HOOK
    const { TERRITORY_HOOK } = await import(`${W}/hub/src/territory.ts`);
    const path = join(args[0], '.cland', 'territory.git', 'hooks', 'update'), text = readFileSync(path, 'utf8');
    out('hook', { equalsBuild: text === TERRITORY_HOOK, mode: (statSync(path).mode & 0o777).toString(8), pushHostBlock: text.includes('CLAND_PUSH_HOST'), sha12: createHash('sha256').update(text).digest('hex').slice(0, 12) });
    break;
  }
  case 'lease': { // <project> grant|revoke <host> <branch>
    const [project, op, host, branch] = args;
    const { grantBranchLease, revokeBranchLease, branchLeasePath } = await import(`${W}/hub/src/host/branch-leases.ts`);
    try { await (op === 'grant' ? grantBranchLease : revokeBranchLease)(project, host, branch); out(op, { ok: true }); } catch (e) { out(op, { ok: false, error: redact(e.message) }); }
    out('leases', existsSync(branchLeasePath(project)) ? readFileSync(branchLeasePath(project), 'utf8').split('\n').filter(Boolean) : []);
    break;
  }
  case 'svsecret': { writeFileSync(`${Q}/sv.secret`, randomBytes(32).toString('hex'), { mode: 0o600 }); remember('agent', readFileSync(`${Q}/sv.secret`, 'utf8')); out('agentSecret', { written: true }); break; }
  case 'svstart': { // <run dir>: the shipped supervisor around the build's `cland host serve`, in its own session (setsid nohup equivalent)
    // sealed through seal.mjs; off Linux the agent takes its boot id from a fake-host boot-id file (hub/src/host/agent/native.ts), here a fixed synthetic one
    const run = args[0];
    const log = (await import('node:fs')).openSync(`${Q}/sv/supervisor.log`, 'a');
    writeFileSync(`${Q}/sv/boot`, '00000000-0000-4000-8000-000000001532\n');
    const env = (await import(`${Q}/seal.mjs`)).seal({ CLAND_HOST_SECRET: readFileSync(`${Q}/sv.secret`, 'utf8'), CLAND_HOST_RUN_DIR: run, CLAND_FAKE_HOSTS: '1', CLAND_HOST_BOOT_ID_FILE: `${Q}/sv/boot` });
    const child = spawn('/bin/sh', [`${W}/hub/src/host/agent/supervisor.sh`, run, process.execPath, `${W}/hub/bin/cland.ts`, 'host', 'serve'], { detached: true, stdio: ['ignore', log, log], env });
    child.unref(); writeFileSync(`${Q}/pids`, `${child.pid}\n`, { flag: 'a' });
    out('starter', { pid: child.pid, agentSocketBytes: bytes(join(run, 'agent.sock')) }); break;
  }
  case 'agent': { // <run dir> <old pid or -> <timeout ms> [kill]: an authenticated agent hello; waits for a pid other than the old one; with kill, SIGKILLs the old pid first and times from the kill
    const [run, old, ms, kill] = args;
    const { AgentClient } = await import(`${W}/hub/src/host/agent-client.ts`);
    const t0 = Date.now(); let facts = null, last = '';
    if (kill === 'kill') process.kill(Number(old), 'SIGKILL');
    while (Date.now() - t0 < Number(ms)) {
      try { const c = await AgentClient.connect(join(run, 'agent.sock'), readFileSync(`${Q}/sv.secret`, 'utf8')); const h = c.hello; await c.close();
        if (old === '-' || String(h.pid) !== old) { facts = { pid: h.pid, version: typeof h.version === 'string', elapsedMs: Date.now() - t0 }; break; } }
      catch (e) { last = redact(e.message); }
      await new Promise(r => setTimeout(r, 50));
    }
    out('agent', facts ?? { none: true, last }); if (facts) writeFileSync(`${Q}/agent.pid.now`, `${facts.pid}\n`); break;
  }
  case 'scan': { // <project>: every secret absent from $Q, the project's .cland and $EV, with a planted positive control
    const [project] = args;
    // holders by design: the probe's own store, the agent secret, the project secret and discovery files, the host secret files
    const holders = new Set([SF, `${Q}/sv.secret`, join(project, '.cland', 'secret'), ...known().filter(k => k.kind.startsWith('host-')).map(k => hostPaths(project, k.kind.slice(5)).secret)]);
    const holder = p => holders.has(p) || (p.startsWith(join(project, '.cland') + '/') && p.endsWith('/hub.json'));
    const files = []; const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && !holder(p)) files.push(p); } };
    const control = join(project, '.cland', 'log', 'qa-scan-control.txt'), first = known().find(k => k.kind === 'host-qa1');
    const scan = () => { const hits = {}; for (const k of known()) hits[k.kind] = []; for (const f of files) { const t = readFileSync(f); for (const k of known()) if (t.includes(k.value)) hits[k.kind].push(relative(Q, f).startsWith('..') ? `<EV>/${relative(EV, f)}` : relative(Q, f)); } return hits; };
    writeFileSync(control, `control ${first.value}\n`); walk(Q); if (EV && existsSync(EV)) walk(EV);
    out('control', scan()['host-qa1']); unlinkSync(control); out('controlRemoved', !existsSync(control));
    if (files.includes(control)) files.splice(files.indexOf(control), 1);
    for (const [kind, hits] of Object.entries(scan())) out('scan', { kind, sentinels: (known().find(k => k.kind === kind)?.value.length ?? 0) >= 16 ? 1 : 0, hits });
    out('files', files.length); break;
  }
  default: out('refused', `unknown mode ${mode}`); process.exit(2);
}
}
JS
node --check "$Q/probe.mjs" && echo "probe checked"
```

The check functions. Define them in QA's own shell (paste the block once). Rows on the scratch project call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it.

```sh
s00() {   # QA's own shell: build, the stage's plan facts, every landing; T-1595's landing file list; the two regression fixes
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  # .claude/settings.local.json is left out: a pre-existing harness-local file, not run output (a sealed Git does not read the human's global ignore)
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1532 --json) > "$EV/E1532S2-00-plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const s of p.stages)console.log(JSON.stringify({name:s.name,state:s.state,qa:s.qa,members:s.items,merged:s.merged,total:s.total,statuses:s.statuses,verdict:s.verdict?{result:s.verdict.result,run:s.verdict.run,current:s.verdict.current}:null}))' "$EV/E1532S2-00-plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(s=>s.name==="the tunnel").items.join(" "))' "$EV/E1532S2-00-plan.json") T-1653 T-1654; do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
  for p in "T-1595 f7b7a8367f3c7d1a917ca512fcba3e824debeff7 ee744a6167e49b4ff213ea56896878161001ddc3" "T-1653 37a93e7af76c069f142853cbab7e5a4b6c5324d9 9034e779f36995d9b81af7825f05628637ffb143" "T-1654 37a93e7af76c069f142853cbab7e5a4b6c5324d9 a05c1902332999bb848df237c73b586bbf0e398a"; do
    set -- $p; L=$(git -C "$R" log --first-parent --format=%H --grep "^Item: $1\$" "$S" | head -n 1)
    if [ -n "$L" ]; then git -C "$R" show --stat --format='%H%n%s%n%b' "$L" > "$EV/$1-landing.txt"; echo "$1 landing files: $(git -C "$R" diff --name-only "$L^1" "$L" | tr '\n' ' ')"; else echo "$1 landing: none"; fi
    echo "$1 branch head files: $(git -C "$R" diff --name-only "$(git -C "$R" merge-base "$2" "$3")" "$3" | tr '\n' ' ')"
  done
}
s01() {   # QA's own shell, read-only in $W: what every landing touched; preserved files unedited; source strings at the build
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  for id in T-1593 T-1594 T-1595 T-1596 T-1597 T-1601 T-1653 T-1654; do
    L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD | head -n 1)
    echo "$id ($L) existing test files modified: $(git -C "$W" diff --diff-filter=M --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    git -C "$W" diff --diff-filter=M --numstat "$L^1" "$L" -- hub/test web/test nvim/test | sed "s|^|  $id added/deleted: |"
    echo "$id test files added: $(git -C "$W" diff --diff-filter=A --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    echo "$id deleted or renamed paths: $(git -C "$W" diff --diff-filter=DR --name-only "$L^1" "$L" | wc -l | tr -d ' ')"
    echo "$id paths outside hub/src, hub/test, shared, docs and the implement skill: $(git -C "$W" diff --name-only "$L^1" "$L" | grep -v -E '^(hub/src/|hub/test/|shared/|docs/|\.agents/skills/implement/)' | tr '\n' ' ')"
    echo "$id package.json and lockfiles changed: $(git -C "$W" diff --name-only "$L^1" "$L" -- ':(glob)**/package.json' ':(glob)**/package-lock.json' | wc -l | tr -d ' ')"
    for f in hub/test/daemon.test.ts hub/test/resilience-component.test.ts hub/test/web-authority.test.ts hub/test/territory-cli.test.ts hub/test/territory-lock.test.ts hub/test/merge.test.ts hub/test/task-worktrees.test.ts hub/test/claude-code-adapter.test.ts hub/test/codex-adapter.test.ts hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts hub/test/launch-files.test.ts; do
      git -C "$W" diff --quiet "$L^1" "$L" -- "$f" || echo "  $id EDITED PRESERVED FILE $f"; done
  done
  ( cd "$W"
    echo "ssh options: $(grep -c -F "'BatchMode=yes','IdentitiesOnly=yes','ExitOnForwardFailure=yes','ServerAliveInterval=15','ServerAliveCountMax=4','StrictHostKeyChecking=yes','GlobalKnownHostsFile=/dev/null'" hub/src/transport/ssh.ts)"
    echo "-a -x -F /dev/null: $(grep -c -F "['-a', '-x', '-F', '/dev/null', '-i'," hub/src/transport/ssh.ts)"
    echo "master -N -M: $(grep -c -F "'-N','-M','-S',paths.controlSocket,'-o','ControlMaster=yes'" hub/src/transport/ssh.ts)"
    echo "forwards hub spoke git agent: $(grep -c -F '/hub.sock:${o.hubSocket}' hub/src/transport/ssh.ts) $(grep -c -F '/spoke.sock:${o.spokeSocket}' hub/src/transport/ssh.ts) $(grep -c -F '/git.sock:${paths.gitSocket}' hub/src/transport/ssh.ts) $(grep -c -F '${paths.agentSocket}:${o.remoteRun}/agent.sock' hub/src/transport/ssh.ts)"
    echo "-O exit, -O check: $(grep -c -F "'-O','exit'" hub/src/transport/ssh.ts) $(grep -c -F "'-O','check'" hub/src/transport/ssh.ts)"
    echo "status reasons: $(grep -c -F 'control endpoint has not closed' hub/src/transport/ssh.ts) $(grep -c -F 'SSH connection or pinned-key admission failed' hub/src/transport/ssh.ts) $(grep -c -F 'transport configuration unavailable' hub/src/transport/ssh.ts)"
    echo "probe every 30 s: $(grep -c -F 'await this.#pause(30000);' hub/src/transport/ssh.ts)"
    echo "secret on stdin, --check gate: $(grep -c -F "printf '%s' \${quote(secret)} > \"\$run/secret\"" hub/src/transport/ssh.ts) $(grep -c -F 'if sh ${quote(o.supervisor)} --check "$run"; then exit 0; fi' hub/src/transport/ssh.ts)"
    echo "one carrier per host: $(grep -c -F 'host transport already owned' hub/src/transport/transport.ts)"
    echo "backoff cap and jitter: $(grep -c -F 'Math.min(30000, Math.min(30000, 1000 * 2 ** Math.min(this.#attempt++, 5)) * (0.8 + 0.4 * this.#random()))' hub/src/transport/transport.ts); reset after 30 s up: $(grep -c -F 'now - this.#up >= 30000' hub/src/transport/transport.ts)"
    echo "hub.status hosts: $(grep -c -F 'hosts: tunnelStatuses(full.root, core.store.hosts.list())' hub/src/hub/dispatch.ts); print: $(grep -c -F 'lines.push(`hosts: ${s.hosts.length}`);' hub/src/cli/hub.ts) $(grep -c -F '· reconnects ${host.reconnects}' hub/src/cli/hub.ts)"
    echo "production carrier constructors: $(grep -r -l -F 'new SshTransport' hub/src | wc -l | tr -d ' ')"
    echo "supervisor: $(grep -c -F 'if [ "${1:-}" = --check ]; then mode=check; shift; fi' hub/src/host/agent/supervisor.sh) $(grep -c -F 'supervisor already running' hub/src/host/agent/supervisor.sh) $(grep -c -F 'supervisor lock stale or incomplete; verify owner absence before removing lock' hub/src/host/agent/supervisor.sh) $(grep -c -F "trap '' HUP" hub/src/host/agent/supervisor.sh)"
    echo "systemctl or systemd-run in supervisor, cland host, agent: $(grep -c -E 'systemctl|systemd-run' hub/src/host/agent/supervisor.sh) $(grep -c -E 'systemctl|systemd-run' hub/src/cli/host.ts) $(grep -r -l -E 'systemctl|systemd-run' hub/src/host/agent | wc -l | tr -d ' ')"
    echo "agent.pid receipt: $(grep -c -F "join(options.runDir, 'agent.pid')" hub/src/host/agent/server.ts)"
    echo "cland host: $(grep -c -F 'revoked host ${args[1]}' hub/src/cli/host.ts) $(grep -c -F 'usage: cland host <serve | revoke id>' hub/src/cli/host.ts) $(grep -c -F 'CLAND_HOST_SECRET required' hub/src/cli/host.ts)"
    echo "help: $(grep -c -F 'host revoke <id> human-only local CLI: revoke its secret and close its connections' hub/src/cli/usage.ts) $(grep -c -F 'host serve      run the host agent on agent.sock (no systemd required)' hub/src/cli/usage.ts)"
    for s in 'host spoke requires a session launch credential' 'host secret revoked' 'host launch credential does not prove the requested session' 'host spoke requires its own role-holding session launch credential' 'host frame requires its own role-holding session credential' 'host revocation requires the human CLI or Neovim on a local connection' "the secret does not match this project's hub" "throw new Error('unknown host')"; do echo "dispatch '$s': $(grep -c -F "$s" hub/src/hub/dispatch.ts)"; done
    echo "spoke 401 Host revoked: $(grep -c -F "'Host revoked'" hub/src/hub/server.ts); host authority: $(grep -c -F 'host clients cannot request this operation' hub/src/host/host-authority.ts)"
    for s in 'refuse() { echo "cland: host $CLAND_PUSH_HOST: $1" >&2; exit 1; }' 'refuse "only leased task branches may be pushed"' 'refuse "ref deletion is forbidden"' 'refuse "task branch $branch is not leased to this host"' 'and dev are protected; use cland push for Coordinator dev commits'; do echo "hook '$s': $(grep -c -F "$s" hub/src/territory.ts)"; done
    echo "push cap, revoke wait: $(grep -c -F 'export const HOST_PUSH_TIMEOUT_MS = 30_000;' hub/src/host/git-daemon.ts) $(grep -c -F 'export const BRANCH_REVOKE_WAIT_MS = HOST_PUSH_TIMEOUT_MS + 2_000;' hub/src/host/branch-leases.ts)"
    echo "contention refusal (T-1654): $(grep -c -F 'another territory operation holds the lock' hub/src/territory.ts) $(grep -c -F 'export class LockRetryExhausted' hub/src/hub/lock.ts)"
    echo "fake host socket guard (T-1653): $(grep -c -F 'fake host socket exceeds macOS 104-byte budget including NUL' hub/test/fakes/fake-host-socket.ts) $(grep -c -F "return join(dirname(fixtureSocketPath(root, 'fake-hosts')), name);" hub/test/fakes/fake-host.ts)"
    echo "layout: $(grep -c -F 'export const LOCAL_MOD_DIR' hub/src/host/launch-layout.ts) $(grep -c -F "if (!modDir) throw new Error('remote layout has no mod directory yet');" hub/src/adapters/claude-code.ts) $(grep -c -F 'nonlocal OpenCode shared ignore needs Host atomic publish/append (T-1644)' hub/src/adapters/opencode/server.ts)"
    echo "docs: $(grep -c -F 'SSH transport' hub/README.md) $(ls docs/hub/ssh-transport.md 2>/dev/null | wc -l | tr -d ' ')" )
}
s02() {   # sealed, in $W: the typecheck at the build
  echo "PRE: $(git -C "$QA_W" rev-parse HEAD) node $(node --version)"
  ( cd "$QA_W" && npm run typecheck > "$QA_EV/E1532S2-02-typecheck.log" 2>&1; echo "typecheck exit $?" )
  echo "dirty entries $(git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
}
m11() {   # p1: init, two host records, the pre-T-1597 hook planted with a control push, hub start upgrades it; hub status shows the hosts
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fakes $(ls "$FCC/claude" "$FCX/codex" "$FOC/opencode" | wc -l | tr -d ' '); node $(node --version); credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)'); CLAND_HOST_, CLAND_PUSH_, CLAND_FAKE_ names $(env | cut -d= -f1 | grep -c -E '^CLAND_(HOST|PUSH|FAKE)_'); old hook $(wc -c < "$QA_Q/old-update-hook" | tr -d ' ') bytes"
  ld || return 1
  git init -q -b dev && git config user.name 'QA One' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1532S2-11-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  echo "territory $( [ -d .cland/territory.git ] && echo present || echo absent)"
  probe register "$PWD" qa1 qa2
  probe states "$PWD"
  cp "$QA_Q/old-update-hook" .cland/territory.git/hooks/update && chmod 755 .cland/territory.git/hooks/update
  echo "-- planted"; probe hook "$PWD"
  git clone -q .cland/territory.git "$QA_Q/c1" && git -C "$QA_Q/c1" switch -q -c t/qa-pre && git -C "$QA_Q/c1" commit -q --allow-empty -m qa-pre; echo "clone exit $?"
  hpush "control: unleased t/qa-pre by qa1 under the old hook" qa1 HEAD:refs/heads/t/qa-pre
  hubstart; echo "hub start exit $?"; probe remember-project "$PWD"
  echo "-- after hub start"; probe hook "$PWD"
  hpush "unleased t/qa-post by qa1 under the upgraded hook" qa1 HEAD:refs/heads/t/qa-post
  echo "hook refusal lines: $(has 'cland: host qa1: task branch t/qa-post is not leased to this host')"
  cland hub status > "$QA_Q/st1.txt" 2>&1; echo "status exit $?"; grep -E '^hosts: |^  qa[12]  ' "$QA_Q/st1.txt"
  cland hub status --json > "$QA_Q/st1.json" 2>&1; echo "status --json exit $?"; probe hosts "$QA_Q/st1.json"
}
m12() {   # p1 territory: the host push policy of the upgraded update hook; leases granted and revoked through the lease API
  echo "PRE: hub $(up); clone $(git -C "$QA_Q/c1" rev-parse --abbrev-ref HEAD); $(probe hook "$PWD")"
  probe lease "$PWD" grant qa1 t/qa-a
  git -C "$QA_Q/c1" switch -q -c t/qa-a && git -C "$QA_Q/c1" commit -q --allow-empty -m qa-a
  hpush "leased t/qa-a by qa1" qa1 HEAD:refs/heads/t/qa-a
  # the second commit right after the accepted push: every refusal below offers a real ref move, never an up-to-date no-op the hook never sees
  git -C "$QA_Q/c1" commit -q --allow-empty -m qa-a2
  moves() { local H T; H=$(git -C "$QA_Q/c1" rev-parse HEAD); T=$(git --git-dir=.cland/territory.git rev-parse refs/heads/t/qa-a); echo "PRE refusal push: local HEAD differs from territory t/qa-a: $([ "$H" != "$T" ] && echo yes || echo no)"; [ "$H" != "$T" ]; }
  moves || return 1
  hpush "t/qa-a by qa2" qa2 HEAD:refs/heads/t/qa-a; echo "  lines: $(has 'cland: host qa2: task branch t/qa-a is not leased to this host')"
  moves || return 1
  hpush "unleased t/qa-b by qa1" qa1 HEAD:refs/heads/t/qa-b; echo "  lines: $(has 'cland: host qa1: task branch t/qa-b is not leased to this host')"
  moves || return 1
  hpush "dev by qa1" qa1 HEAD:refs/heads/dev; echo "  lines: $(has 'cland: host qa1: only leased task branches may be pushed')"
  moves || return 1
  hpush "tag by qa1" qa1 HEAD:refs/tags/qa-tag; echo "  lines: $(has 'cland: host qa1: only leased task branches may be pushed')"
  moves || return 1
  hpush "other ref by qa1" qa1 HEAD:refs/qa/other; echo "  lines: $(has 'cland: host qa1: only leased task branches may be pushed')"
  moves || return 1
  hpush "delete t/qa-a by qa1" qa1 :refs/heads/t/qa-a; echo "  lines: $(has 'cland: host qa1: ref deletion is forbidden')"
  probe lease "$PWD" revoke qa1 t/qa-a
  moves || return 1
  hpush "t/qa-a by qa1 after revoke" qa1 HEAD:refs/heads/t/qa-a; echo "  lines: $(has 'cland: host qa1: task branch t/qa-a is not leased to this host')"
  moves || return 1
  hpush "unhosted dev" "" HEAD:refs/heads/dev; echo "  lines: $(has 'and dev are protected; use cland push for Coordinator dev commits')"
  hpush "unhosted t/qa-c" "" HEAD:refs/heads/t/qa-c
  echo "territory refs: $(git --git-dir=.cland/territory.git for-each-ref --format='%(refname)' refs/heads/t refs/tags refs/qa | tr '\n' ' ')"
  echo "t/qa-a is the first qa-a commit: $( [ "$(git --git-dir=.cland/territory.git rev-parse refs/heads/t/qa-a)" = "$(git -C "$QA_Q/c1" rev-parse HEAD~1)" ] && echo yes || echo no)"
}
m13() {   # p1 hub: admission with host secrets before any revocation
  echo "PRE: hub $(up); $(probe states "$PWD")"
  echo "-- spoke edge, host qa1 bearer, no launch credential"; probe spoke "$PWD" qa1
  echo "-- hub socket, host client qa1"; probe client "$PWD" qa1 hub.status role.set session.launch host.revoke
  echo "-- hub socket, host client qa2"; probe client "$PWD" qa2
  echo "-- hub socket, wrong secret"; probe client "$PWD" wrong
  echo "-- hub socket, project secret"; probe client "$PWD" project hub.status
}
m14() {   # p1 hub: the human CLI revokes qa1 while a qa1 host client is connected; later hellos; restart
  echo "PRE: hub $(up); $(probe states "$PWD")"
  : > "$QA_Q/held.out"; [ -f "$QA_Q/held" ] && mv "$QA_Q/held" "$QA_Q/held.old"
  probe hold "$PWD" qa1 > "$QA_Q/held.out" 2>&1 & HOLD=$!; echo "$HOLD" >> "$QA_Q/pids"
  for i in $(seq 1 40); do [ -f "$QA_Q/held" ] && break; sleep 0.25; done; echo "held before revoke: $( [ -f "$QA_Q/held" ] && echo yes || echo no)"
  run "revoke qa1" cland host revoke qa1
  for i in $(seq 1 140); do kill -0 "$HOLD" 2> /dev/null || break; sleep 0.25; done; echo "hold probe alive: $(alive "$HOLD")"; cat "$QA_Q/held.out"
  probe states "$PWD"
  echo "-- later qa1 client"; probe client "$PWD" qa1
  echo "-- later qa1 spoke"; probe spoke "$PWD" qa1
  echo "-- qa2 client"; probe client "$PWD" qa2
  run "revoke an unknown host" cland host revoke qa-absent
  cland hub status --json > "$QA_Q/st2.json" 2>&1; echo "status --json exit $?"; probe hosts "$QA_Q/st2.json"
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"; hubstart; echo "hub restart exit $?"
  probe states "$PWD"
  echo "-- qa1 client after restart"; probe client "$PWD" qa1
  echo "-- qa2 client after restart"; probe client "$PWD" qa2
}
m15() {   # $Q/sv: the cland host CLI, then the shipped supervisor around the build's `cland host serve` (no ssh; on macOS the agent's boot id comes from the probe's synthetic fake-host boot-id file)
  SV=$QA_Q/sv/run; SH=$QA_W/hub/src/host/agent/supervisor.sh
  echo "PRE: sv entries $(ls -A "$QA_Q/sv" | wc -l | tr -d ' '); CLAND_HOST_ names $(env | cut -d= -f1 | grep -c '^CLAND_HOST_')"
  [ "$(env | cut -d= -f1 | grep -c '^CLAND_HOST_')" = 0 ] || { echo "BLOCKED: an inherited CLAND_HOST_ variable would make host serve run"; return 1; }
  ld || return 1
  run "host, no subcommand" cland host
  run "host serve, no secret" cland host serve
  run "host revoke --help" cland host revoke --help
  cland help > "$QA_Q/help.txt" 2>&1; echo "help exit $?; revoke line $(grep -c -F 'host revoke <id> human-only local CLI: revoke its secret and close its connections' "$QA_Q/help.txt"); serve line $(grep -c -F 'host serve      run the host agent on agent.sock (no systemd required)' "$QA_Q/help.txt")"
  probe svsecret
  sh "$SH" --check "$SV"; echo "check before start exit $?"
  probe svstart "$SV"; ST=$(tail -n 1 "$QA_Q/pids")
  probe agent "$SV" - 15000; A1=$(cat "$QA_Q/agent.pid.now" 2> /dev/null)
  [ -n "$A1" ] || { echo "BLOCKED: no agent answered; stopping the starter $ST"; kill -TERM "$ST" 2> /dev/null; return 1; }
  SP=$(cat "$SV/supervisor.lock/pid" 2> /dev/null); echo "agent pid $A1; supervisor pid is the starter's: $( [ "$SP" = "$ST" ] && echo yes || echo no); run dir mode $(stat -f %Lp "$SV"); agent.pid names the agent: $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).pid===Number(process.argv[2]))' "$SV/agent.pid" "$A1")"
  # the second start runs in the background with a 10 s guard: a supervisor that failed to refuse would otherwise never return
  sh "$SH" "$SV" "$(command -v node)" "$QA_W/hub/bin/cland.ts" host serve > "$QA_Q/r.out" 2> "$QA_Q/r.err" & P2=$!; echo "$P2" >> "$QA_Q/pids"
  for i in $(seq 1 40); do kill -0 "$P2" 2> /dev/null || break; sleep 0.25; done
  if kill -0 "$P2" 2> /dev/null; then echo "second start still running after 10 s"; kill -TERM "$P2"; fi
  wait "$P2"; echo "second start exit $?; lines $(has 'supervisor already running')"
  sh "$SH" --check "$SV"; echo "check while live exit $?"
  kill -HUP "$SP"; kill -HUP "$A1"; sleep 2; echo "after HUP: supervisor $(alive "$SP"), agent $(alive "$A1")"; probe agent "$SV" - 3000
  probe agent "$SV" "$A1" 10000 kill; A2=$(cat "$QA_Q/agent.pid.now")
  echo "after SIGKILL: old agent $(alive "$A1"), new agent $(alive "$A2"), supervisor $(alive "$SP") unchanged $( [ "$(cat "$SV/supervisor.lock/pid")" = "$SP" ] && echo yes || echo no); agent.pid names the new agent: $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).pid===Number(process.argv[2]))' "$SV/agent.pid" "$A2")"
  kill -TERM "$SP"; for i in $(seq 1 40); do kill -0 "$SP" 2> /dev/null || break; sleep 0.25; done; echo "supervisor after TERM: $(alive "$SP")"
  kill -TERM "$A2"; for i in $(seq 1 40); do kill -0 "$A2" 2> /dev/null || break; sleep 0.25; done; echo "agent after TERM: $(alive "$A2")"
  sleep 2; sh "$SH" --check "$SV"; echo "check after stop exit $?"; echo "processes naming $QA_Q/sv: $(census "$QA_Q/sv")"
}
m16() {   # the secret scan with its positive control
  echo "PRE: kinds $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).map(k=>k.kind).join(" "))' "$QA_Q/secrets1532.json")"
  probe scan "$QA_Q/p1"
}
m17() {   # cleanup census: the scratch hub stopped, every recorded pid gone, nothing names $Q
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  sleep 2; while read -r p; do [ -n "$p" ] && kill -0 "$p" 2> /dev/null && echo "alive $p $(ps -o command= -p "$p" | cut -c1-120)"; done < "$QA_Q/pids"
  echo "processes naming the scratch root: $(census "$QA_Q")"
}
s18() {   # QA's own shell: the build after every row
  echo "HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  # .claude/settings.local.json is left out: a pre-existing harness-local file, not run output (a sealed Git does not read the human's global ignore)
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
}
```

Record the setup (worktree, `$Q` and its byte count 23, `launcher checked`, the zero credential-name count, the `CLAND_` name list, the old hook line, `probe checked`) as check `S0` with `qa-record.sh note`. The name list must hold no `CLAND_SESSION_*`, `CLAND_LAUNCH_TOKEN`, `CLAND_ROLE`, `CLAND_HOST_*`, `CLAND_PUSH_HOST` or `CLAND_FAKE_*` from QA's own session. A nonzero credential count, a missing `launcher checked` or `probe checked`, or an old hook line other than `CLAND_PUSH_HOST false` and `protected line true` makes S0 BLOCKED and every scratch row (E1532S2-11 to E1532S2-17) BLOCKED with it; the file rows need only `$Q/env.sh`.

Cleanup after the evidence is recorded: print `$Q` and check it begins with `/private/tmp/q32-`, then remove it by that literal path with a non-force `rm -r`; print each `$EV/E1532S2-05.root` path, check it begins with `/private/tmp/qa-e1532-lr-` and is empty, and remove it by that literal path with `rmdir`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The secrets in `$Q/secrets1532.json`, `$Q/sv.secret`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/hub.json` and `$Q/p1/.cland/run/hosts/*/secret` are never printed or posted.

## Cases

none. No headless-grid case covers this stage: it has no Neovim or web change. Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. The stage changes no web surface; no browser runs.

## Manual checks

Run in this order. Rows E1532S2-03 to E1532S2-10 run their files serially from `$W` through `nt`, `ntl` or `ntc`: cover-quiet admission before each row, the one-minute load at or below 10 and the free disk space printed before each file. Targeted files take no suite lease. They never run in parallel with each other or with the scratch rows. Rows E1532S2-11 to E1532S2-17 depend on the state the rows before them leave, in that order. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1532 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log) first. For every file row "clean" means: every `exit` line reads `exit 0 <file>`, no `not ok` line and no `# SKIP` line (nothing in these files is platform-gated on macOS, so a skip is FAIL). Generated names (template-literal titles) are read from the log and compared with their source loops at the build; every generated name a loop yields must print `ok`.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1532S2-00 | hub-api | QA | `s00 > "$EV/E1532S2-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the root's non-tracker count is recorded (E1532S2-18 compares). The stage line `the tunnel` shows `qa` `{"scope":"affected","when":"after-stage"}`, `merged` equal to `total`, and `state` not `closed`; the line `foundations` shows `state` `closed`. Every member of `the tunnel`, and T-1653 and T-1654, prints exactly one landing SHA. `T-1595 landing files` equals `T-1595 branch head files`; `T-1653 landing files` and `T-1654 landing files` name landings (not `none`) whose lists equal their `branch head files` or differ only as Build allows. Otherwise BLOCKED, reported to the requester, nothing else run |
| E1532S2-01 | hub-api | QA | `s01 > "$EV/E1532S2-01.txt" 2>&1` (QA's own shell, read-only) | Per landing, `existing test files modified` exactly (T-1653 and T-1654 as at their branch heads): T-1593 `hub/test/tiers.json` (`1 0`); T-1594 `hub/test/fakes/fake-host.ts hub/test/fixtures/cli-usage/commands.json hub/test/tiers.json` (`19 2`, `1 1`, `1 0`); T-1595 `hub/test/fakes/fake-ssh-common.ts hub/test/tiers.json` (`14 2`, `3 0`: the fake gains opt-in scratch global trust and quoted file lists); T-1596 `hub/test/fixtures/cli-usage/commands.json hub/test/tiers.json` (`1 1`, `1 0`); T-1597 `hub/test/host-git-daemon.test.ts hub/test/merge-batches.test.ts hub/test/tiers.json` (`20 5`, `23 0`, `1 0`: the git-daemon file's branch grant migrated to the lease API, a contention case added to the batch file); T-1601 `hub/test/claude-code-host.test.ts hub/test/codex-sandbox-host.test.ts hub/test/durations.json hub/test/host-boundary.test.ts hub/test/host-boundary.ts hub/test/host-contract.ts hub/test/session-host-placement.test.ts hub/test/session-host-routing.test.ts hub/test/tiers.json`; T-1653 `hub/test/fake-ssh.test.ts hub/test/fakes/fake-host.ts hub/test/fixture-socket-path.test.ts hub/test/host-supervisor.test.ts`; T-1654 `hub/test/host-allow-list.test.ts`. `test files added`: T-1593 `hub/test/host-agent-files.test.ts`; T-1594 `hub/test/host-supervisor.test.ts`; T-1595 `hub/test/transport-policy.test.ts hub/test/transport-ssh.test.ts hub/test/transport-status.test.ts`; T-1596 `hub/test/host-secret-admission.test.ts`; T-1597 `hub/test/host-allow-list.test.ts`; T-1601 the three `hub/test/fixtures/host-launch-*.json` and `hub/test/host-launch-layout.test.ts`; T-1653 `hub/test/fakes/fake-host-socket.ts`; T-1654 none. A difference at a landing that review changed after writing is read against that landing's diff before judging. Every landing: `deleted or renamed paths: 0`; `package.json and lockfiles changed: 0`; `paths outside …` empty except T-1595 `hub/README.md`. **No `EDITED PRESERVED FILE` line** (T-1596 C6, T-1597 C5, T-1601 C5: the twelve preserved files are untouched by every landing of this stage and both fixes). Strings: `ssh options: 1`, `-a -x -F /dev/null: 1`, `master -N -M: 1`, `forwards hub spoke git agent: 1 1 1 1`, `-O exit, -O check: 1 1`, `status reasons: 1 1 1`, `probe every 30 s: 1`, `secret on stdin, --check gate: 1 1`, `one carrier per host: 1`, `backoff cap and jitter: 1`, `reset after 30 s up: 1`, `hub.status hosts: 1`, `print: 1 1`, `production carrier constructors: 0`, `supervisor: 1 1 1 1`, `systemctl or systemd-run in supervisor, cland host, agent: 0 0 0` (T-1594 C3), `agent.pid receipt: 1`, `cland host: 1 1 1`, `help: 1 1`, every `dispatch '…'` count 1 or more, `spoke 401 Host revoked: 1`, `host authority: 1`, every `hook '…'` count 1, `push cap, revoke wait: 1 1`, `contention refusal (T-1654):` 1 or more then `1`, `fake host socket guard (T-1653): 1 1`, `layout: 1 1 1`, `docs: 1 1` |
| E1532S2-02 | hub-api | QA | `( . "$Q/env.sh"; s02 ) > "$EV/E1532S2-02.txt" 2>&1` | PRE shows Node 24. `typecheck exit 0` (the whole workspace at the integrated build, the two fixes included), `dirty entries 0` |
| E1532S2-03 | hub-api | QA | `nt E1532S2-03 hub/test/host-agent-files.test.ts hub/test/host-agent.test.ts hub/test/host-agent-boundary.test.ts hub/test/host-local-contract.test.ts hub/test/host-contract-coverage.test.ts hub/test/artifact-folders.test.ts hub/test/doctor-run.test.ts hub/test/session-cwd.test.ts` | clean (T-1593: the agent's operations and the consumers of the helpers it moved under `hub/src/host/agent/`). `oks` lists Tests: `agent C1/C2 file reads match local and transfer exact bounded bytes`, `agent C3 mutations preserve modes, single-path and symlink boundaries; freePort releases loopback`, `agent C5 occupants matches local real paths through aliases and excludes siblings`, `agent C1 short command output and timeout match local`, `agent C4 worktrees share root install, preserve stale warning and refuse dirty removal`, `agent fixture drains server and removes root after failed connection setup` |
| E1532S2-04 | hub-api | QA | `nt E1532S2-04 hub/test/host-supervisor.test.ts hub/test/fake-ssh.test.ts hub/test/fixture-socket-path.test.ts hub/test/cli-help.test.ts hub/test/cli-usage-compatibility.test.ts` | clean, system `TMPDIR` (T-1594; with T-1653's fixture move). `oks` lists Tests: `supervisor C1-C4: singleton, detached lifetime, HUP, kill-agent restart and retained harness identity`, `supervisor setup failure before its expected receipt drains the detached writer before root removal`, `kill-agent refuses another live fake host receipt and preserves both agents and harnesses`. `fixture-socket-path.test.ts` passes whole, including the two cases T-1653 adds for the fake-host guard (read their names from the log and from the file at the build: an oversized path refused naming the path before any connect, and a short path shared by independent readers; T-1653 C2). The help files pass whole with the frozen usage including both `host revoke <id>` and `host serve` (T-1594, T-1596) |
| E1532S2-05 | hub-api | QA | `ntl E1532S2-05 hub/test/host-supervisor.test.ts hub/test/host-supervisor.test.ts hub/test/host-supervisor.test.ts hub/test/host-supervisor.test.ts hub/test/host-supervisor.test.ts hub/test/fake-ssh.test.ts hub/test/fixture-socket-path.test.ts hub/test/host-agent.test.ts hub/test/host-agent-files.test.ts hub/test/transport-ssh.test.ts` | The macOS socket budget under a temp root as long as the suite's (T-1653 C1; the 0/5 cover failure of A-16171). The `long root` line names `/private/tmp/qa-e1532-lr-<uuid>` with `bytes 61`. clean: every `exit` line `exit 0`, no `not ok`, no `# SKIP`, and **no `EINVAL` line**; across the repeated supervisor file the three supervisor names of E1532S2-04 each print `ok` on every repetition (count them with `oks`). The host-agent, host-agent-files and carrier files pass whole too (their sockets fit, per T-1653's audit; T-1595 C5 under this root). `long root leftovers 0` (every fixture removed its storage and its short alias) |
| E1532S2-06 | hub-api | QA | `nt E1532S2-06 hub/test/transport-ssh.test.ts hub/test/transport-policy.test.ts hub/test/transport-status.test.ts hub/test/hub-status-component.test.ts hub/test/transport-kind.test.ts hub/test/transport-config.test.ts hub/test/transport-records.test.ts hub/test/host-records.test.ts`  | clean (T-1595 C1 to C7, and the preserved status, transport-kind and host-record consumers). `oks` lists Tests: `C1/C2/C4/C5/C6 fake master restores four forwards and probe after SIGKILL`, `C7 wrong pin refuses before bootstrap and logs no key material`, `C3 injected clock drives consecutive retries and immediately retries on wake jump`, `C6 injected clock probes agent.sock every 30 seconds`, `C4 refused old-master exit fences unlink/start with backoff and concurrent carriers`, `C7 private pin is exclusive despite matching global trust and supports spaces`, `C3 exponential jitter, cap, stable uptime reset and wake clock jump`, `C6 hub status exposes tunnel facts and CLI tolerates the previous reply shape`, `C4 deep project roots use deterministic short private socket paths`. Read `transport-ssh.test.ts` at the build before judging: the master case asserts every option of T-1595 C1 on the master's argv, four forwards each `/path:/path`, the secret absent from every argv and present only in the 0600 `secret` file, an `exit` before every `-N` start, a `check`, the same supervisor pid after the master's SIGKILL, and recovery within 10000 ms; a weaker assertion at the build is a finding |
| E1532S2-07 | hub-api | QA | `nt E1532S2-07 hub/test/host-secret-admission.test.ts hub/test/daemon.test.ts hub/test/resilience-component.test.ts hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts hub/test/cli-session-credential.test.ts hub/test/name-reservation.test.ts` | clean (T-1596 C1 to C6; the hub-socket, spoke-auth and web-authority owners unedited per E1532S2-01). `oks` lists Tests: `C3/C4 host CLI requires session credential and denies human frames`, `C5 human revoke closes host peers and refuses subsequent hellos`, `C3 host clients cannot request human snapshots or borrow another host session`, `C4 CLI producer carries the host session credential`; it also lists the file's literal C1 case, whose name starts `C1 host` and ends `only its role-holding launch session` (read the whole name from the file at the build; quoted whole here it would trip the publication secret scanner). Generated names, from the loops `bad`, `name` and `variant`: `C2 host hello refuses other-host`, `… local`, `… no-role`, `… no-credential`; `C2 settled first-hello token cannot join live foreign session (foreign)` and `(nameless)`; `C1/C2 held-spawn host admission own`, `… anonymous`, `… foreign-host`, `… local`, `… roleless`; every one prints `ok` |
| E1532S2-08 | hub-api | QA | `nt E1532S2-08 hub/test/host-allow-list.test.ts hub/test/host-git-daemon.test.ts hub/test/merge-batches.test.ts hub/test/territory-cli.test.ts hub/test/territory-lock.test.ts hub/test/merge.test.ts hub/test/task-worktrees.test.ts hub/test/territory-task-branch.test.ts` | clean (T-1597 C1 to C5 with T-1654; the T-1591 seam). `oks` lists Tests: `host socket accepts only its leased task refs; upgrade preserves hub push policy`, `grant and revoke cannot rewrite the allow list while another territory operation holds its lock`, `admitted push fences revoke until native exit; held revoke refuses push while fetch completes`, `batch revokes every host and builds the pinned member head; later pushes are refused`, `immediate merge revokes every host lease before landing the task`, `hub startup upgrades an existing territory update hook`, `a stalled receive releases its write fence after the injected cap and native close`, `failed write-lock release fences admission and makes listener close report incomplete cleanup`, `revoke joins a receive whose Git client exited before asynchronous lock release`, `public revoke reuses its active territory lock without waiting on itself`, `daemon environment removes inherited write authority and pins receive policy`, `proxy clones, pushes and fetches a large pack; protected refs and deletes stay guarded`, `eight admitted daemons per host; excess is refused, logged and close joins native exits`, `failed socket permissions drain admitted native children before reporting the original startup error`. Generated, from the loop `phase` of `merge-batches.test.ts`: `territory contention during build retries automatically using the same green receipt` and `… during land …` print `ok`. Read the contention case at the build: with T-1654 it requires `TerritoryBusy` and the message `another territory operation holds the lock` (with ` (pid <n>)` for a known holder) for the immediate refusal, the bounded wait and a deadline reached before any probe |
| E1532S2-09 | hub-api | QA | `ntc E1532S2-09 5` | T-1654 C2 and T-1597 C2 under this machine's load: every `exit 0`, no `not ok`, and on each repetition exactly one `ok` line naming `grant and revoke cannot rewrite the allow list while another territory operation holds its lock` (count with `oks`). Cases the pattern filters out are not results. A refusal reading `acquisition deadline reached` (the pre-T-1654 second message) is a FAIL |
| E1532S2-10 | hub-api | QA | `nt E1532S2-10 hub/test/host-launch-layout.test.ts hub/test/codex-sandbox-host.test.ts hub/test/host-boundary.test.ts hub/test/session-host-routing.test.ts hub/test/session-host-placement.test.ts hub/test/claude-code-host.test.ts hub/test/codex-host.test.ts hub/test/opencode-host.test.ts hub/test/launch-files.test.ts hub/test/opencode-native.test.ts hub/test/claude-code-adapter.test.ts hub/test/codex-adapter.test.ts hub/test/opencode-adapter.test.ts` | clean (T-1601 C1 to C5; the three adapter contract files run the fake binaries of `hub/test/fakes/`). `oks` lists Tests: `OpenCode password reads use the supplied Host`, `nonlocal file replacement refuses missing rollback metadata and new files undo through their Host`, `nonlocal OpenCode shared-ignore preparation refuses the unsupported atomic boundary`, `Claude nonlocal layout without a mod directory refuses before native launch`, `local Codex policies retain the captured byte-identical overrides`, `Codex takes roots, linked git bytes and socket paths from the selected Host`, `spawn and relaunch serialize the captured session Host policy`, `mapped network-local launch denies the canonical directory containing its app-server socket`, `Host boundary rejects session file mutation imports and namespaces`, `Host boundary scans the current adapters recursively`. Generated, from the loops `mask`, `mapped` and the adapter map of `host-launch-layout.test.ts`: `local claude launch preserves baseline argv, environment and file bytes/modes (umask 22)` through `mapped Host opencode launch preserves baseline argv, environment and file bytes/modes (umask 2)`, every local and mapped name for claude, codex and opencode under umask 22 and 2, each `ok` (the mapped OpenCode capture holds the Host's freePort value, T-1601 C3) |
| E1532S2-11 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m11 ) > "$EV/E1532S2-11.txt" 2>&1` | PRE: p1 empty, `fakes 3`, `credential-prefix names 0`, `CLAND_HOST_, CLAND_PUSH_, CLAND_FAKE_ names 0`. `init exit 0`; `hub after init and stop: down`; `territory present`. `register` prints for `qa1` and `qa2` each `state` `registered`, `transport` `ssh`, `secretMode` `600`, `secretLength` 64, `directoryMode` `700`, `socketDirectoryInside` true and every socket byte count under 104 (else BLOCKED: the host socket directory would leave `$Q`). Planted: `hook` `equalsBuild` false, `pushHostBlock` false. The control push `control: unleased t/qa-pre by qa1 under the old hook exit 0` (the planted hook ignores `CLAND_PUSH_HOST`; without this the row is INCONCLUSIVE). `hub start exit 0`; the `sockets` line has both byte counts under 104 and both `inside` true. After hub start: `hook` `equalsBuild` true, `mode` `755`, `pushHostBlock` true (T-1597 C4: an existing territory gets the new hook at hub start); `unleased t/qa-post by qa1 under the upgraded hook exit 1` with `hook refusal lines: 1` or more. `status exit 0` and the printed lines `hosts: 2`, `  qa1  down since unknown · probe not run · reconnects 0` and `  qa2  down since unknown · probe not run · reconnects 0` (T-1595 C6 print; no carrier runs at this stage, so `down` with no probe is the expected state). `status --json exit 0`; `hosts` is exactly `[{"name":"qa1","state":"down","since":null,"lastProbe":null,"reconnects":0},{"name":"qa2","state":"down","since":null,"lastProbe":null,"reconnects":0}]`; `secretHits` `[]` |
| E1532S2-12 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m12 ) > "$EV/E1532S2-12.txt" 2>&1` | PRE: hub `up`, `equalsBuild` true. `grant` ok, `leases` `["qa1\tt/qa-a"]` (tab-separated). `leased t/qa-a by qa1 exit 0`. Before each refused push a `PRE refusal push: local HEAD differs from territory t/qa-a: yes` line (eight in all; a `no` stops the row BLOCKED: that push would be an up-to-date no-op the hook never sees). Exit 1 with `lines: 1` or more for: `t/qa-a by qa2` (`cland: host qa2: task branch t/qa-a is not leased to this host`), `unleased t/qa-b by qa1`, `dev by qa1`, `tag by qa1` and `other ref by qa1` (`cland: host qa1: only leased task branches may be pushed`), `delete t/qa-a by qa1` (`cland: host qa1: ref deletion is forbidden`): every refusal names the host (T-1597 C1). `revoke` ok, `leases` `[]`; `t/qa-a by qa1 after revoke exit 1` naming `t/qa-a is not leased to this host`. Unhosted (the hub's own guarded path, as before T-1597, C4): `unhosted dev exit 1` with the protected line; `unhosted t/qa-c exit 0`. `territory refs` lists exactly `refs/heads/t/qa-a`, `refs/heads/t/qa-c` and `refs/heads/t/qa-pre`, no `t/qa-b`, `t/qa-post`, tag or `refs/qa/other`; `t/qa-a is the first qa-a commit: yes` (the refused delete and the post-revoke push changed nothing). A `dev by qa1` refusal that names a non-fast-forward instead of the hook line is a probe fault (INCONCLUSIVE), not a product result |
| E1532S2-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1532S2-13.txt" 2>&1` | PRE: hub `up`, both hosts `registered`. Spoke edge, qa1 bearer, no launch credential: `upgrade` `open`, `frame` `{"type":"error","code":"unauthorized","message":"host spoke requires a session launch credential"}` (T-1596 C2). Host client qa1: `hello` `{"type":"welcome"}`; then `hub.status`, `role.set`, `session.launch` and `host.revoke` each `ok` false, `code` `forbidden`, `error` `forbidden: <frame type> (host frame requires its own role-holding session credential)` with that frame's type (T-1596 C3, and C5's refusal from a host client). Host client qa2: `welcome`. Wrong secret: `{"type":"error","code":"unauthorized","message":"the secret does not match this project's hub"}`. Project secret: `welcome`, then `hub.status` `ok` true with `hosts` naming `qa1` and `qa2`, both `down`, and `secretHits` `[]` (T-1596 C6: the project secret's admission unchanged; T-1595 C6 over the frame). No line prints a secret |
| E1532S2-14 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m14 ) > "$EV/E1532S2-14.txt" 2>&1` | PRE: hub `up`, both `registered`. `held before revoke: yes`. `revoke qa1 exit 0` with `out: revoked host qa1`. `hold probe alive: no`; `held.out` has `hello` `welcome` and `held` `closedByHub` true with `heldMs` under 30000 (the live host connection was closed by the revocation, T-1596 C5). `states`: qa1 `revoked`, qa2 `registered`. Later qa1 client: `{"type":"error","code":"unauthorized","message":"host secret revoked"}`. Later qa1 spoke: `upgrade` `refused`, `status` 401, `statusMessage` `Host revoked`. qa2 client: `welcome` (revocation is per host). `revoke an unknown host exit 1` with `unknown host` on stderr. `status --json exit 0`, `hosts` lists `qa1` as `revoked` with matching ISO `since` and `revokedAt`, `qa2` remains `down`, and `secretHits` is `[]`. After `hub restart exit 0`: `states` unchanged (qa1 `revoked`); qa1 client again `host secret revoked`; qa2 client `welcome` |
| E1532S2-15 | hub-api | Human | `( . "$Q/env.sh"; m15 ) > "$EV/E1532S2-15.txt" 2>&1` (command timeout of at least 600000 ms) | PRE: `sv entries 0`, `CLAND_HOST_ names 0`. CLI: `host, no subcommand exit 1` with `usage: cland host <serve \| revoke id>` on stderr; `host serve, no secret exit 1` with `CLAND_HOST_SECRET required`; `host revoke --help exit 0` printing the `host revoke <id>` and `host serve` lines; `help exit 0; revoke line 1; serve line 1`. Supervisor: `check before start exit 1`; the `starter` line has `agentSocketBytes` under 104; `agent` answers (`version` true) within 15000 ms; `supervisor pid is the starter's: yes`; `run dir mode 700`; `agent.pid names the agent: true`. No `second start still running` line, and `second start exit 1; lines 1` (`supervisor already running`, T-1594 C1). `check while live exit 0` (the bootstrap's gate, T-1595 C2). `after HUP: supervisor yes, agent yes` and the next `agent` line names the same pid as `agent pid` (T-1594 C3; the starter process has already exited, so the supervisor outlived the session that started it). After the SIGKILL the probe sends itself: `agent` answers with a new pid and `elapsedMs` (from the kill to the first answering hello) at most 3000 (T-1594 C2), `old agent no`, `new agent yes`, `supervisor yes`, `unchanged yes`, `agent.pid names the new agent: true`. `supervisor after TERM: no`, `agent after TERM: no`, `check after stop exit 1`, `processes naming <Q>/sv: 0`. An `elapsedMs` over 3000 is rerun once with the one-minute load at or below 4 and both are recorded; over 3000 again is a FAIL for T-1594 C2 at this level |
| E1532S2-16 | hub-api | Human | `( . "$Q/env.sh"; m16 ) > "$EV/E1532S2-16.txt" 2>&1` | PRE: kinds `host-qa1 host-qa2 project agent`. The positive control first (rule 17): `control` is exactly `["p1/.cland/log/qa-scan-control.txt"]`, then `controlRemoved` true; no control hit makes the row INCONCLUSIVE, never PASS. Then each `scan` line (`host-qa1`, `host-qa2`, `project`, `agent`) has `sentinels` 1 and `hits` `[]`: no secret in any file under `$Q` (hub log, journal, `hub.db`, territory, clone, supervisor log, status captures, probe outputs) or under `$EV`, apart from the files that hold them by design. A hit under `<EV>` is a QA fault to fix before publication (never print the value); any other hit is a FAIL naming the kind and file only |
| E1532S2-17 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m17 ) > "$EV/E1532S2-17.txt" 2>&1` | `hub stop exit 0; hub down`; no `alive` line names a fixture process (an `alive` line whose command is unrelated is pid reuse, recorded, not a failure); `processes naming the scratch root: 0` |
| E1532S2-18 | hub-api | QA | `s18 > "$EV/E1532S2-18.txt" 2>&1` (QA's own shell) | HEAD, dev and the request's SHA still the same 40 hex; `dirty entries 0`; the root's non-tracker count equals E1532S2-00's. A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1532-stage-2.md --commit <dev SHA>`, with a dev SHA that includes the T-1653 and T-1654 landings. At writing it passed at `e21b64bffa6ccec52b4457285cca27d9052fadf3`: the brief names no test title that exists only on the T-1653 or T-1654 branch (their new cases are read from the log). The brief is complete only when qa lint passes at the build.

**Source provenance (rule 22).** Read at dev `e21b64bffa6ccec52b4457285cca27d9052fadf3` (every member landed; T-1595's strings were first read at its branch head `ee744a6167e49b4ff213ea56896878161001ddc3` and re-checked at its landing), and for T-1653 and T-1654 at their branch heads `9034e779f36995d9b81af7825f05628637ffb143` and `a05c1902332999bb848df237c73b586bbf0e398a` (not landed). Re-check every string at the tested build.

- Verified in source:
  - T-1595 (landing `e21b64bff`): the carrier's argv (`['-a', '-x', '-F', '/dev/null', '-i', …]`, the eleven `-o` values including `GlobalKnownHostsFile=/dev/null`, `KnownHostsCommand=none`, `VerifyHostKeyDNS=no`, `UpdateHostKeys=no` and the quoted `UserKnownHostsFile`), the master's `-N -M -S <control> -o ControlMaster=yes -o StreamLocalBindUnlink=yes` and four forwards, `-O exit`, `-O check`, the native ENOENT/ECONNREFUSED proof before unlink, the reasons `control endpoint has not closed`, `SSH connection or pinned-key admission failed` and `transport configuration unavailable`, the 30 s probe pause, the bootstrap script (secret by `printf` into `$run/secret` at 0600 on stdin, `--check` gate, `setsid nohup sh <supervisor>`), `ReconnectPolicy` (1000 × 2^n capped 30000, ±20 % jitter, reset after 30000 ms up, a jump over 5000 ms observed as wake), `host transport already owned`, `HostTunnelStatus` (`name`, `state`, `since`, `reason`, `lastProbe`, `reconnects`), `tunnelStatuses` defaulting an unregistered carrier to `down` with `since` null, the CLI print `hosts: <n>` and `  <name>  <state> since <since or unknown> · probe <at ok|failed or not run> · reconnects <n>[ · <reason>]`, the optional `HubStatus.hosts` in `hub/src/protocol.ts` and `shared/wire/index.ts`, `supervisor.sh --check`, and no production `new SshTransport` (`hub/src/transport/`, `hub/src/cli/hub.ts`, `hub/src/hub/dispatch.ts`).
  - Dev: `supervisor.sh` (`supervisor already running`, `supervisor lock stale or incomplete; verify owner absence before removing lock`, `trap '' HUP`, `sleep 1` restart), `agent.pid` in `hub/src/host/agent/server.ts`, `cland host` (`revoked host <id>`, `usage: cland host <serve | revoke id>`, `CLAND_HOST_SECRET required`, SIGHUP ignored), `HOST_USAGE`, `cland host revoke --help` answering `HOST_USAGE` (`hub/src/cli/help.ts`); admission (`hub/src/hub/dispatch.ts`: `host spoke requires a session launch credential`, `host secret revoked`, `host frame requires its own role-holding session credential`, `host revocation requires the human CLI or Neovim on a local connection`, `the secret does not match this project's hub`, `unknown host`; `ToolForbidden`'s message `forbidden: <permission> (<reason>)` in `hub/src/roles/permissions.ts`; `HTTP/1.1 401 Host revoked` in `hub/src/hub/server.ts`; `HOST_SESSION_FRAMES` in `hub/src/host/host-authority.ts`); host records (`hostPaths`, 0600 secret, 0700 directories, `SOCKET_PATH_MAX` 100, `HostRecords.list` including revoked rows, revoked hosts never re-minted at start); `TERRITORY_HOOK` and the pre-change hook at `1fcc37db^`; `grantBranchLease`, `revokeBranchLease`, `branchLeasePath` (`cland-branch-leases`, tab-separated); `refreshTerritoryHook` at hub start; `HOST_PUSH_TIMEOUT_MS` 30000 and `BRANCH_REVOKE_WAIT_MS`; T-1601's `LOCAL_MOD_DIR`, the Claude `remote layout has no mod directory yet` refusal and the T-1644 refusals.
  - T-1653 head: `fakeHostSocketPath` and its message, `hostDirectory` behind `fixtureSocketPath(root, 'fake-hosts')`; T-1654 head: `LockRetryExhausted` and the single `TerritoryBusy` text.
  - Every literal title named above is a literal title in its file at dev `e21b64bff` (qa lint passed there); every generated name above was expanded from its source loop by hand (`host-secret-admission.test.ts` loops `bad`, `name`, `variant`; `host-launch-layout.test.ts` `mask.toString(8)` gives `22` and `2`; `merge-batches.test.ts` loop `phase`).
- Inferred, not verified by a run:
  - **T-1653, T-1654**: any change review or the landing makes after the branch heads above; the exact landing file lists; T-1653's integration with the landed T-1595 (the carrier test calls `createFakeHost`, whose directory T-1653 moves behind the alias; T-1653's branch predates the T-1595 landing).
  - **The scratch probes**: that the hub accepts the client hello shape `{type:'hello',protocol:2,client:'cli',secret}` with a host secret and the spoke hello `{type:'hello',protocol:2,cwd,sessionId,name}` exactly as `host-secret-admission.test.ts` sends them; that `role.set`, `session.launch` and `host.revoke` with an `as` naming a session without a row reach the host-frame check before any argument validation (the test asserts only `/forbidden/` for them, and its `as` names a real session; the exact reason in E1532S2-13 is read from `handle` in `dispatch.ts`); that the CLI prints `unknown host` on stderr with exit 1 (the exact `cland: ` prefix is not asserted); that `cland init` provisions `.cland/territory.git` on a fresh `git init -b dev` project.
  - **The local push emulation** (E1532S2-12): the hook is the shipped one and `CLAND_PUSH_HOST` is set as `git-daemon.ts` sets it, but a local `git push` skips the daemon's `receive.*` settings and its receive lock; those are proven by the named files of E1532S2-08.
  - **The supervisor row**: the restart time of the real `cland host serve` on this machine (the script sleeps 1 s; Node start and the CLI import come on top).

## Probes that mislead

- **No real SSH anywhere.** The carrier is judged only through the fake `ssh` stand-in inside `transport-ssh.test.ts` (with a `setsid` shim, since macOS has no `setsid` binary; the production script still calls it). The scratch project's host records are rows only: no carrier is constructed in production at this stage, so `down since unknown · probe not run · reconnects 0` is the expected status and proves the print and the field, not a tunnel.
- `cland hub status` shows `revoked since <time>` after a new revocation. `hub.status.hosts` retains its existing fields and adds `revokedAt` on revoked rows; both `since` and `revokedAt` are null for legacy revocations without a recorded time. The host row (`probe states`) and admission refusals also confirm the authority cut.
- The scratch push checks (E1532S2-12) run the shipped hook through a local `git push` with `CLAND_PUSH_HOST`; they do not exercise the per-host socket, the receive lock, the 30 s cap or the `receive.*` settings. Those are the named files' (E1532S2-08).
- The first scratch push under the planted old hook is a control (rule 17): it must succeed, or the upgrade check proves nothing.
- `host-allow-list.test.ts` "immediate merge revokes every host lease before landing the task" runs 5 to 7 s on macOS against its 5 s per-test budget (T-1655, open). Budgets are not enforced by `node --test`; a passing case's duration is not a result of this run.
- Under `--test-name-pattern` (E1532S2-09) the filtered-out cases may be reported as skipped; only the named identity's `ok` lines count there.
- The repeated supervisor file of E1532S2-05 prints its three names once per repetition; count the `ok` lines per name, not the file's exit alone. Exit 0 from the Node runner with a name that matches nothing is not a pass.
- An `EINVAL` on `connect` with a path near or above 104 bytes is the macOS socket limit (T-1653's failure), not a network error. Under the long root it is a FAIL; under the system TMPDIR it would point to a fixture that skipped the short-socket helper.
- `/private/tmp/ct-<32 hex>` aliases belong to whichever fixture made them; other sessions' runs make them too. Judge leftovers only under this run's long root (`long root leftovers`), never by a machine-wide listing of `/private/tmp`.
- The agent's boot id: on Linux it reads the machine's; off Linux `agentBootId` (`hub/src/host/agent/native.ts`) refuses to start without `CLAND_FAKE_HOSTS` and a `CLAND_HOST_BOOT_ID_FILE` holding a 36-character id (`non-Linux agent requires fake host boot-id file`), so native macOS birth identity alone is not enough. The fake hosts of the named files set both (`hub/test/host-agent.test.ts`), and E1532S2-15's `svstart` sets them through `seal.mjs` with a fixed synthetic id. That row proves the supervisor and restart behaviour on this Mac with a fake-host boot id, not support for a real macOS host. `kill-agent` refusing a copied receipt is proven by the file, not by any probe here.
- The supervisor row's agents are real local processes of this run: judge their lifetimes by the recorded pids and by processes naming `$Q/sv`, never by a machine-wide `pgrep` (A-9063 R2; E-413 stage 1/T-1093).
- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live hub status, the live territory and live hosts are not evidence for this stage; p1, the build's files and its tests are.
- Every `cland` here is `$W/hub/bin/cland.ts` (the `cland` function of `env.sh`). A `cland` on PATH, or the root's CLI, may be older.
- **Credentials are secrets.** Never print a host secret, the project secret or the agent secret; never put one in a capture or a topic. The scan of E1532S2-16 proves they are absent from `$Q` and `$EV` outside the files that hold them by design.
- Edit existing keys in initialized configs; never add a second table (A-8634 R12). This brief edits no config; the host rows go in through the hub's own `HostSecretStore` while the hub is stopped.
- Apply the full `fixtureEnvironment` result after overlays and add `scratchGitEnvironment` for Git; a hand-written shell `unset` filter keeps inherited `GIT_*` variables (E-1212 stage 1). Under rule 15, check zero credential-prefix names before launching scratch processes and report names/counts only.
- Transcript assertions identify stable frame ids (`qa-<n>` per request). Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; A-9063 R2).
- Process cleanup probes use the fixture-owned census (`$Q/pids` plus processes whose command line names `$Q`), registered at launch and checked through exit.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log (no droplet here).
- Speed criteria use measured wall times, never projections: the 3 s agent restart (E1532S2-15) is measured from the kill to the first answering hello; the 10 s master recovery is the file's own measured bound.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: none here; every named file must run on this macOS run.
- Re-check helper, function and message names with grep at the tested build; renames happen, and T-1653 and T-1654 had not landed at writing.

## Out of scope

- A real `ssh`, `scp` or `sshd`, a real host, droplet, volume, key or network call (R-1530's QA rule); the human's `~/.ssh`.
- The `ssh` Host, the remote spoke, remote spawns, per-session forwards, git through the tunnel from a host clone, push on ref move and the flush, attach, survival and reconnect after a hub restart: later stages of E-1532 (T-1598 onward). No production code wires the carrier at this stage.
- A host session admitted for real through a launched harness: no session is launched here; spoke welcome with a launch credential, held-spawn admission, credential-carrying CLI, hook and mod-bridge frames, and revocation from a session shell are proven by `host-secret-admission.test.ts` (E1532S2-07).
- The git daemon's receive lock and cap, the merge and merge-batch revocations and the push race (the named files of E1532S2-08 and E1532S2-09), and the T-1655 per-test budget on macOS.
- Remote launches of the adapters (T-1644 owns the nonlocal metadata and atomic paths); the real Claude Code, Codex and OpenCode binaries.
- The T4 soak and load repetitions beyond E1532S2-05 and E1532S2-09; the full T3 and T4 suites and the stage cover pair (the Coordinator's occasion, Linux droplet and macOS); a live restart.
- A real browser, computer use, the web and Neovim workbenches, and any change to live sessions, holds or the tracker.

Missing authorization does not apply: nothing here needs a grant, so no check is BLOCKED for lack of one.

## Grants

none. This stage launches no browser, no harness and no real SSH; the scratch hub, the supervisor and the probe use only `$Q` paths and loopback Unix sockets, under the rule 15 sealed environment with credentials filtered and only the fake harnesses. None of the model briefs reused here needed a grant.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "the tunnel"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report `qa clear E-1532 stage the tunnel` or `qa not clear E-1532 stage the tunnel` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
