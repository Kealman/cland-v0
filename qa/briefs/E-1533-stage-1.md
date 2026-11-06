# Stage QA brief: E-1533 stage 1 — provider interface, fake provider, hook and prelude

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24, `uuidgen`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, DigitalOcean API, key, credential or network (R-1530's QA rule).** The named files use only their own fakes: the fake SSH transport and fake hosts of `hub/test/ssh-host-fixture.ts`, the filesystem fake host provider, and the executor files' loopback fake DigitalOcean API with its fake `ssh`/`scp` and synthetic token. A loopback listener inside those files is a fake, not network. Never run `hub/bin/verify-provision.sh` or `hub/src/executor/droplet/provision.sh` on this Mac: they call `apt-get` and `curl` and belong to the droplet image builder. **No real harness:** Claude Code, Codex and OpenCode run only as the build's fakes. No browser, no GUI, no Neovim.

The stage is mostly library and test level. The run is meant to take about 60 to 90 minutes: setup, E1533S1-00 to E1533S1-03 about 15 minutes (the typecheck included); the named files E1533S1-10 to E1533S1-29 about 30 minutes, one file at a time; scratch rows E1533S1-30 to E1533S1-36 about 15 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

## Kit conventions carried from E-1532

- **The seal.** Every sealed command is built by `seal.mjs` as `scratchGitEnvironment(Q, fixtureEnvironment(Q, base, overlays), {excludesFile})` (`test-support/fixture-environment.ts`). The overlays (`PATH`, `TMPDIR`, the `QA_*` roots, `GH_PAGER: undefined` and a launch's own `CLAND_*` inputs) go **into** the builder, which applies its credential filter after them; nothing is added after it returns (rule 15). The builder drops every inherited `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `OPENCODE_*` and credential-shaped name and sets `HOME` to `$Q/home`.
- **The sealed `PATH`** drops every entry under the real HOME (read from the OS user record, not `HOME`) and every `~`-relative entry, except the running Node's own `bin`. `claude`, `codex` and `opencode` resolve to nothing on it.
- **TMPDIR** of every sealed command is `$T`, a `/private/tmp/qa-e1533-s1-<uuid>` directory of the suite root's byte length.
- **Rule 22.** Ids are read back from listings and files, never from a create result. Every selector, test name and string below is marked VERIFIED, VERIFIED-on-branch or INFERRED under "Source provenance"; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`.
- **Censuses** exclude the census process and all its ancestors and match only this run's `$Q` and `$W` paths.

## Stage

- Epic: E-1533 (Host providers, images and DigitalOcean, under R-1530).
- Exact stage name: provider interface, fake provider, hook and prelude.
- Items, in plan order: lane 1 T-1706 (hosts join and leave a running hub, prefactor); lane 2 T-1707 (the host provider interface and the fake host provider's machines), T-1711 (provider declarations and the billing minimum), T-1712 (volume operations on the interface and the fake host provider); lane 3 T-1708 (DigitalOcean API pacing and typed 429s); lane 4 T-1709 (the `[verification] provision` hook, and Neovim and Chromium leave the recipe); lane 5 T-1710 (the host prelude). The run reads membership, counts and state from `task plan show E-1533 --json` (E1533S1-00), never from this list. QA finding fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: **affected.** The combined changed behaviour of the stage, through its named test files, read-only source checks and a few scratch checks on the real CLI. No earlier-epic regression pass beyond the preservation files the items name.
  - T-1706: an owner API on the project's SSH hosts (`projectSshHosts` in `hub/src/host/registry.ts` returns `add(record)` and `remove(id)`; the daemon exposes it as `dispatcher.hostOwner`; `Sessions.addHost`/`removeHost` in `hub/src/adapters/sessions.ts`). A host added on a running hub opens its Git daemon and carrier and joins the sessions' map with the same authority fence as at start; removal settles through the existing `revokeHost` path, then quiesces and closes Host, carrier and Git daemon; a runtime-added host reopens at the next hub start. **No frame or CLI command is added** (`docs/hub/ssh-host.md`, "Runtime host ownership"). `host-ssh-registry`, `host-relaunch` and `host-survival-native` pass unedited.
  - T-1707: `HostProvider` (`hub/src/host/provider/provider.ts`) with acquire, prepare, status, release and reap and `transport: 'ssh'`; `HostProviderRegistry` (`registry.ts`); `FakeHostProvider` (`fake.ts`), a directory-only provider refused without an absolute `CLAND_FAKE_HOST_ROOT`; the reusable contract suite `hub/test/host-provider-contract.ts`.
  - T-1711: validated declarations and `earliestStop` (`hub/src/host/provider/declarations.ts`), configurable on the fake, checked by the contract suite.
  - T-1712: volume create, attach, detach, snapshot, delete and list on the interface and the fake (one attachment, region binding, snapshot window with a retry time, deletion confirmed by a read) and the volume cases of the contract suite.
  - T-1708: the shared DigitalOcean client paces within 250 requests a minute on the injected clock and turns a 429 into a typed refusal carrying the retry time (`hub/src/executor/droplet/api.ts`, `endpoint.ts`); the fake API answers 429 with rate-limit headers. The executor files `executor-droplet`, `executor-prepare` and `executor-safety` pass with no test edited **at T-1708's landing**. T-1709 later edits `hub/test/executor-prepare.test.ts` by design, so C3's "unedited" is judged at T-1708's landing commit (E1533S1-02), and the file passing at the build is judged in E1533S1-22.
  - T-1709: `[verification] provision` (config key, template comment, path refusal) names a repository script the image builder runs once as root after the recipe and before `prepare` as `runner`, its output logged as `executor-prepare-install`; the snapshot key drops its Neovim field and gains the running recipe digest and the hook's content digest and captured path; `provision.sh` loses Neovim and the Chromium runtime packages, which move to this project's hook `hub/bin/verify-provision.sh`, configured in `.cland/config.toml`. The new recipe and key take effect only at the live hub's restart, which triggers one snapshot rebuild the Coordinator watches (out of scope).
  - T-1710: `renderPrelude({ hostKey, hostPublicKey, providerSteps })` (`hub/src/host/prelude.ts`) and the `cland-auth` helper (`hub/src/host/cland-auth.sh`). No hub code calls them yet.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what.

| criterion | proven by |
| --- | --- |
| T-1706 C1 (a fake host registered on a running hub opens its tunnel and takes a `session.launch` with its `host`, no restart) | E1533S1-10 (test `C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git`); E1533S1-11 (test `runtime add opens the same owners and reopens a registered host after close`, test `duplicate runtime add retains the published owner without reacquiring or closing it`, test `failed runtime publication joins rollback before allowing another add`) |
| T-1706 C2 (removal stops carrier and Git daemon; running rows settle through the revoke path, never `running`) | E1533S1-10 (the same C1/C2 test: empty leftovers, `revoked` record, `stopped` row, Host fenced, Git socket gone); E1533S1-11 (test `runtime removal settles before carrier and Git closure and refuses later add`, test `failed runtime remove retains ownership and retries cleanup before unpublishing`, test `shutdown joins an in-flight runtime add and prevents its publication`); E1533S1-15 (the revoke path's native file, unedited) |
| T-1706 C3 (a runtime-added host reopens at the next hub start) | E1533S1-10 (test `C3 runtime registered host reopens on the next hub start`); E1533S1-11 |
| T-1706 C4 (`host-ssh-registry`, `host-relaunch`, `host-survival-native` pass with no test edited) | E1533S1-02 (no preserved file in T-1706's landing); E1533S1-12, E1533S1-13, E1533S1-14 (whole files at the build) |
| T-1706 no new frame or CLI | E1533S1-03 (the doc sentence); E1533S1-34 (`cland help` host lines unchanged) |
| T-1707 C1 (acquire, prepare, status, release, reap; transport `ssh` only) | E1533S1-16 (the `fake`, `fake arm64 only` and `fake x86_64 only` contract registrations `<name>: provider contract creates, prepares, observes and confirms release`, which assert `transport` `ssh` and every operation); E1533S1-03 (`readonly transport: 'ssh';`) |
| T-1707 C2 (contract on the fake; `released` only after a read finds the machine gone) | E1533S1-16 (the contract registrations above and `<name>: reap releases only the requested project and pool`, `<name>: ignored-delete preserves observed lifecycle outcomes`; test `ignored delete is incomplete after confirming read, including reap and restart`; test `missing provider metadata cannot turn a retained machine into released`; test `reap never calls a missing machine record a successful sweep`) |
| T-1707 C3 (boot delay, refused acquire with a retry time, never-boot each typed) | E1533S1-16 (test `configured boot delay and refusal use typed states and the fixture clock`; test `never-boot and failed creation are typed failures and remain reapable`; the contract registrations `<name>: refused acquire has a typed outcome`, `<name>: failed-acquire acquire has a typed outcome`, `<name>: delayed-boot preserves observed lifecycle outcomes`, `<name>: never-boot preserves observed lifecycle outcomes`) |
| T-1707 C4 (`provider = "fake"` refused outside the test environment with its reason; no network socket) | E1533S1-16 (test `registry refuses fake outside its test environment and caches registered providers`; test `fake opens no network socket for any lifecycle operation`); E1533S1-03 (the fence string and the provider module closure: no network module, no `fetch(`); E1533S1-33 (the registry through the seal: refused with the reason, positive control resolves). No project config or CLI selects a host provider at this build (VERIFIED: nothing under `hub/src` outside `hub/src/host/provider/` imports the registry), so there is no user surface beyond E1533S1-33 |
| T-1711 C1 (contract fails a missing field, a negative price, a minimum not a multiple of the granularity) | E1533S1-17 (test `declarations reject missing fields, negative prices and misaligned minimums`; test `reusable contract rejects providers missing each declaration and invalid billing`); E1533S1-16 (`<name>: provider declares sane prices, billing and capabilities`) |
| T-1711 C2 (extra paid address in the idle price; `stoppedBills = true` makes the stop action `destroy`) | E1533S1-16 (test `fake declarations include paid address in idle price and destroy billed stopped machines`) |
| T-1711 C3 (`earliestStop` never before created plus the billing minimum) | E1533S1-17 (test `earliestStop respects both the created billing minimum and idle duration`) |
| T-1712 C1 (one attachment; a second attach elsewhere refused) | E1533S1-18 (the `fake` contract registration `fake: volumes enforce one attachment and region binding`; test `concurrent volume attachment and snapshot calls each admit one winner`) |
| T-1712 C2 (second snapshot inside the window refused with its retry time; after the window succeeds) | E1533S1-18 (`fake: volumes rate limit snapshots until retry time`; test `fake snapshot window rejects invalid durations`; test `volume inventory, attachment and snapshot pacing survive provider recreation`) |
| T-1712 C3 (attach in another region refused) | E1533S1-18 (`fake: volumes enforce one attachment and region binding`, the `region mismatch` refusal) |
| T-1712 C4 (`deleted` only after a read finds it gone; volume contract passes on the fake) | E1533S1-18 (`fake: volumes create, list and confirm deletion`, `fake: ignored volume deletion retains inventory`; test `mandatory volume contract rejects deletion acknowledged without removal`; test `malformed retained volume ownership and snapshot facts fail closed without writes`) |
| T-1708 C1 (injected clock; queued calls never exceed 250 in any 60 s window) | E1533S1-19 (test `300 queued calls share a token budget across clients in every 60 second window`; test `pacing counts actual sends when the caller blocks before continuations drain`; test `the real DigitalOcean endpoint ignores a high-rate fragment and still paces at 250`); E1533S1-20 (test `legacy real and custom URLs retain the 250 per minute policy`, test `equivalent real endpoint declarations cannot increase the production cap`) |
| T-1708 C2 (429 is a typed refusal with the response's retry time; nothing sent for that call before then) | E1533S1-19 (the `http` and `scripted` expansions of `429 carries retry time and fences the shared token without automatic resend (<mode>)`; the `429 header retry time: <headers>` expansions; test `a missing-header 429 preserves provider text and permits the next explicit call`; test `429 headers fence a sibling client before held body diagnostics complete`; test `queued budget waits respect deadlines and cancellation without sending`) |
| T-1708 C3 (executor files pass with no test edited) | E1533S1-02 (none of the three in T-1708's landing; `executor-droplet` and `executor-safety` untouched since; `executor-prepare` touched only by T-1709's landing); E1533S1-21, E1533S1-22, E1533S1-23 (whole files at the build) |
| T-1709 C1 (hook as root before `prepare` as runner; failing hook fails prepare with its output) | E1533S1-24 (the `failure=false` and `failure=true` expansions of `project provision runs as root before runner prepare, failure=<bool>`); E1533S1-03 (the logged phase and the failure text) |
| T-1709 C2 (key carries the hook digest and no Neovim field; one byte marks it stale with `provision`) | E1533S1-22 (test `prepare keys hash committed hook bytes without Neovim fields and ignore local hook edits`); E1533S1-25 (test `provision digest changes invalidate the snapshot with provision named`; test `a hook path change with identical bytes still marks provision stale`); E1533S1-03 (the `PrepareKey` type, no `nvim` in `prepare.ts`, the stale parts list) |
| T-1709 C3 (`provision.sh` installs no `nvim` and no Chromium runtime package) | E1533S1-25 (test `project hook owns Chromium libraries and pinned Neovim while the generic recipe stays neutral`); E1533S1-03 (zero counts in `provision.sh`) |
| T-1709 C4 (the hook installs those packages and the Neovim tag and digest of `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, kept equal by a test) | E1533S1-25 (the same test); E1533S1-03 (each package once in the hook; the tag and Linux x86_64 digest derived from the pin files at the build); E1533S1-26 (test `prepare uses installed snapshot inputs and rebuilds changed or missing installs`) |
| T-1709 C5 (`cland config` documents `[verification] provision`; a project without it prepares as before apart from the key) | E1533S1-25 (test `config template documents the optional root provisioning script`; test `generic recipe digest invalidates a project snapshot without a hook`; test `four-part prepare keys retain the existing snapshot hash`); E1533S1-22 (test `a project without pins prepares a reusable snapshot for delivery`); E1533S1-29 (config files unchanged in behaviour); E1533S1-31 (the template `cland init` writes); E1533S1-32 (`cland config set` names, saves and refuses the key); E1533S1-03 (docs) |
| T-1710 C1 (host key pair; sshd drop-in values) | E1533S1-27 (test `C1: prelude installs pinned keys and hardened sshd settings`) |
| T-1710 C2 (DigitalOcean rendering removes the automount rule; `cland-auth` and its sudoers line; Codex file credential store) | E1533S1-27 (test `C2: DigitalOcean steps, helper, sudoers and file credential store are installed`); see "Probes that mislead" on the provider steps |
| T-1710 C3 (sentinel credential values and names never in the user-data) | E1533S1-27 (test `C3: sentinel scan detects planted values and assignments, and rendered data excludes environment secrets`); E1533S1-03 (`prelude.ts` reads no `process.env`) |
| T-1710 C4 (`cland-auth` exits non-zero without acting on a bad name, path or operation) | E1533S1-28 (test `C4: invalid helper arguments fail before any external command`) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1533 --json` lists in stage `provider interface, fake provider, hook and prelude`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task with a branch still needs its landing receipt even if the branch has no commits; a task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member has a branch here, so each needs a landing**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `767036e277de92b714307fe2d48ed7c76b96e518`): T-1710 landed as `03e1cdf92257a14a58af9c649522aeb10538e574` (tracker `6c0e7703c`), T-1707 as `61599ac1ffc9ca5c37e44925155b1b6831b29739`, T-1708 as `7fce3c5b10e6f6f2b7a2db0057cea8a1c581fdae` and T-1711 as `5eb4c5158033ebc230e685400206c686a600190f` (tracker `5cfb53758` for T-1708 and T-1711). T-1706 (branch head `4e8aa7793e45c15ac3cbd22252a9b7f228065ef0`), T-1712 (head `72ed1ccc5919aefbbe8d641dff63101e5939d7d9`) and T-1709 (head `6f3d831fe9fe2304af2c88ef76f469ed20a09923`) were in merge batch `b7572578`. They landed (A-17180, batch green T1+T3 on Linux) as T-1706 `d8acb0598b2526b2162a9bbd5cceb76c151c99c2`, T-1712 `c34a4acc6da43d1bde3d1381cf235c1ec9ef94ed` and T-1709 `edb3dd465feaf0d1ea63feb2049862700293dfd1` (tracker `e61998c96`), followed by the add-only duration refresh `5f8376f08` from A-17180 (`hub/test/durations.json` only). The brief and `qa lint` were checked at `5f8376f08`. After T-1709, the hub was restarted so the droplet snapshot is rebuilt with the new recipe and hook digest; the stage covers ran after that restart. Their strings, titles and test-path sets were read on those heads (VERIFIED-on-branch); each landing squashes a merge with later dev (T-1709's branch forks at T-1710's landing and lacks T-1707, T-1708 and T-1711; T-1712's forks at T-1711's), so every such line is re-read at the build and a difference is recorded before judging. The landing may add `hub/test/durations.json` changes; E1533S1-02 prints each landing's test paths. The request names the tested dev SHA and any finding fixes added to the stage after writing.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No named file needs `web/dist`; E1533S1-01 runs the typecheck only.

**Where things live.** All scratch state is outside the project root: `$Q` (`/private/tmp/q51-…`, realpath) holds the scratch project `p1`, the fake-host root `$Q/fh`, the scratch HOME and every directory `fixtureEnvironment` synthesizes, and every helper file. `$T` is `TMPDIR` of every sealed command. The only paths under the repository are the ones QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1533/<run>/`. Nothing is written to `.cland/tasks/` of the live project; E1533S1-00 and E1533S1-36 print the root's non-tracker status, which must not change.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed, through the seal. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its config, its territory, its `hub.db` or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, any `hub.json` secret, `~/.config/cland/sandbox-remote.secrets.toml` or any credential; never run a real `ssh`, `scp` or `sshd`; never run `cland executor prepare`, `cland verify` or `cland hub reload` against the live project. The live hub is read only by QA's own shell for the plan read and `quiet` (the live verify queue is read, nothing is submitted).

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree and the scratch roots, runs `quiet`, the plan read and the read-only source checks, runs the named test files through `nt` and `pl` (which seal each run with `$Q/env.sh`) and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh` (named files, typecheck) or `$Q/env-hub.sh` plus `$Q/scratch.sh` (scratch rows). Never use `env -i`.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s1-$(date +%F)-1                        # unique run id for E-1533; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1533s1-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1533/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
T=/private/tmp/qa-e1533-s1-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q51-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch hub pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
```

**The kit, by exact line range.** The shell functions `holder`, `quiet`, `ld`, `nt` and `rp` (lines 133 to 140) and `tap.mjs` (lines 228 to 279) are taken unchanged from the stage-4 brief **as committed in the build** (`$W/qa/briefs/E-1532-stage-4.md`, blob `4ed467672750bf34179ed72549df863d1541eddb`, the same blob on dev at `767036e27`). A different blob means the ranges moved, and the setup is BLOCKED (nothing else run). Nothing else is taken from that file: this brief writes its own seal, expectations, source checks and scratch functions below.

```sh
K="$W/qa/briefs/E-1532-stage-4.md"
echo "kit blob $(git -C "$W" rev-parse HEAD:qa/briefs/E-1532-stage-4.md) want 4ed467672750bf34179ed72549df863d1541eddb"
sed -n '133,140p' "$K" > "$Q/kit-shell.sh"
sed -n '228,279p' "$K" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
node --check "$Q/tap.mjs" && echo "tap checked"
```

Expected: `kit blob` equal to `want`; `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; `tap checked`. `nt <id> <files…>` runs each named file from `$W` sealed by `$Q/env.sh`, one file at a time (`node --test --test-concurrency=1 --test-reporter=tap`), after `quiet` (the live verify slot free; cover-quiet admission) and `ld` before each file (one-minute load at or below 10, free disk printed), logging `$EV/<id>.log`, then prints `tap.mjs check` lines into `$EV/<id>.check.txt`.

**The preservation lock.** The T3 files (native fake-host transports, native Git, the helper under bash) run under the stage preservation lock their test guides name (the `host-runtime-join` guide under `docs/agents/tests/`: "Run through the preservation lock in the E-1533 stage brief"). This brief defines it as the directory `/tmp/cland-preserve.lock`, taken with `mkdir`, an owner file naming this run and row, and an owner-checked removal by literal path. A held lock makes the row BLOCKED for now (retry the row later; never remove another owner's lock).

```sh
# pl <id> <files…>: nt under the preservation lock; mkdir is the lock, the owner file names this run and row
pl() {
  if ! mkdir /tmp/cland-preserve.lock 2> /dev/null; then echo "BLOCKED: /tmp/cland-preserve.lock is held: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null || echo 'no owner file')"; return 1; fi
  printf 'qa %s %s pid %s %s\n' "$RUN" "$1" "$$" "$(date -u +%FT%TZ)" > /tmp/cland-preserve.lock/owner
  nt "$@"; local x=$?
  if [ "$(cut -d' ' -f1-3 /tmp/cland-preserve.lock/owner 2> /dev/null)" = "qa $RUN $1" ]; then rm /tmp/cland-preserve.lock/owner && rmdir /tmp/cland-preserve.lock && echo "preservation lock released"; else echo "FINDING: preservation lock owner changed during $1; lock left in place"; fi
  return $x
}
```

**The seal.** `seal.mjs` prints a sealed env file and exports `seal(extra, front)` for a launch that needs inputs of its own. `env.sh` (named files and typecheck) carries no overlay; `env-hub.sh` (scratch rows) adds only `CLAND_TEST_SKIP_ORPHAN_SWEEP=1`, through the builder, so the scratch hub never sweeps other sessions' processes.

```sh
cat > "$Q/seal.mjs" <<'JS'
// node "$Q/seal.mjs" env <W> <Q> <EV> <T> <R> [overlay JSON]   QA's own shell: a sealed env file (unset and export lines)
// const { seal } = await import(`${QA_Q}/seal.mjs`)               sealed: seal(extra, front) for one launch
// Overlays go INTO fixtureEnvironment(Q, base, overlays), which filters credentials after them; scratchGitEnvironment wraps it; nothing is added after.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { userInfo } from 'node:os';
const base = process.env;
const cli = process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'env';
const [W, Q, EV, T, R] = cli ? process.argv.slice(3, 8) : [base.QA_W, base.QA_Q, base.QA_EV, base.QA_T, base.QA_R];
if (!W || !EV || !R || !/^\/private\/tmp\/q51-[A-Za-z0-9]+$/.test(Q ?? '') || !/^\/private\/tmp\/qa-e1533-s1-[0-9a-f-]{36}$/.test(T ?? '')) {
  console.error('seal: refused: not this run\'s scratch roots'); process.exit(2);
}
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
const realHome = userInfo().homedir, nodeBin = dirname(process.execPath);
const drop = p => !p || p === nodeBin || p.startsWith('~') || p === realHome || p.startsWith(`${realHome}/`)
  || p.startsWith(`${W}/hub/test/fakes`) || p === Q || p.startsWith(`${Q}/`);
const rest = String(base.PATH ?? '').split(':').filter(p => !drop(p));
export function seal(extra = {}, front = []) {
  for (const k of Object.keys(extra)) if (!/^(CLAND_|FAKE_|QA_)/.test(k)) throw new Error(`seal: overlay ${k} refused`);
  return scratchGitEnvironment(Q, fixtureEnvironment(Q, base, { PATH: [...new Set([...front, nodeBin, ...rest])].join(':'), TMPDIR: T, QA_W: W, QA_Q: Q, QA_EV: EV, QA_T: T, QA_R: R, GH_PAGER: undefined, ...extra }), { excludesFile: `${Q}/home/.gitignore-global` });
}
if (cli) {
  const env = seal(JSON.parse(process.argv[8] ?? '{}')), named = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
  for (const k of Object.keys(base).sort()) if (!(k in env) && named.test(k)) console.log(`unset ${k}`);
  for (const [k, v] of Object.entries(env)) if (named.test(k)) console.log(`export ${k}=${quote(v)}`);
}
JS
cat > "$Q/launch.mjs" <<'JS'
// node "$QA_Q/launch.mjs" hub   sealed, cwd p1: cland hub start with the build's fake harnesses authoritative and first on PATH, no orphan sweep
import { spawn } from 'node:child_process';
const { seal } = await import(`${process.env.QA_Q}/seal.mjs`);
const W = process.env.QA_W, F = `${W}/hub/test/fakes`;
if (process.argv[2] !== 'hub') { console.error('launch: unknown mode'); process.exit(2); }
const env = seal({ CLAND_CLAUDE_BIN: `${F}/claude-code/claude`, CLAND_CODEX_BIN: `${F}/codex/codex`, CLAND_OPENCODE_BIN: `${F}/opencode/opencode`, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1' }, [`${F}/claude-code`, `${F}/codex`, `${F}/opencode`]);
const child = spawn(process.execPath, [`${W}/hub/bin/cland.ts`, 'hub', 'start'], { cwd: process.cwd(), env, stdio: 'inherit' });
child.on('error', error => { console.error(`launch: ${error.message}`); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
JS
node --check "$Q/seal.mjs" && node --check "$Q/launch.mjs" && echo "launcher checked"
node "$Q/seal.mjs" env "$W" "$Q" "$EV" "$T" "$R" > "$Q/env.sh" || echo "BLOCKED: seal env failed"
node "$Q/seal.mjs" env "$W" "$Q" "$EV" "$T" "$R" '{"CLAND_TEST_SKIP_ORPHAN_SWEEP":"1"}' > "$Q/env-hub.sh" || echo "BLOCKED: seal env-hub failed"
cat >> "$Q/env-hub.sh" <<'ENV'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
hubstart() { node "$QA_Q/launch.mjs" hub && hp >> "$QA_Q/pids"; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
# run <label> <command…>: exit status, then the first lines of stdout and stderr
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; head -n 20 "$QA_Q/r.out" | sed 's/^/  out: /'; head -n 20 "$QA_Q/r.err" | sed 's/^/  err: /'; }
# has <text>: how many lines of the last run's output contain the exact text (node, no pattern syntax)
has() { node -e 'const fs=require("fs"),q=process.env.QA_Q,n=process.argv.at(-1);let t="";for(const f of ["r.out","r.err"]){try{t+=fs.readFileSync(q+"/"+f,"utf8")+"\n"}catch{}}console.log(t.split("\n").filter(l=>l.includes(n)).length)' -- "$1"; }
# cnt <file> <text>: occurrences of the exact text in the file (String.split)
cnt() { node -e 'const fs=require("fs");let t="";try{t=fs.readFileSync(process.argv[1],"utf8")}catch{console.log("MISSING");process.exit(0)}console.log(t.split(process.argv[2]).length-1)' "$1" "$2"; }
ENV
for f in env.sh env-hub.sh; do ( . "$Q/$f"; echo "$f: credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)'); CLAND_ names $(env | cut -d= -f1 | grep -E '^CLAND_' | sort | tr '\n' ' ')" ); done
( . "$Q/env.sh"; echo "sealed TMPDIR is T: $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no); sealed HOME is Q/home: $([ "$HOME" = "$QA_Q/home" ] && echo yes || echo no)"; for c in claude codex opencode; do echo "$c on the sealed PATH: $(command -v "$c" || echo none)"; done )
( . "$Q/env.sh"; node -e 'const h=require("os").userInfo().homedir,n=require("path").dirname(process.execPath);console.log("sealed PATH entries under the real HOME other than node: "+process.env.PATH.split(":").filter(p=>p.startsWith("~")||(p===h||p.startsWith(h+"/"))&&p!==n).length)' )
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')"
```

Expected (recorded as check `S0` with `qa-record.sh note`, capture `$EV/S0-env.txt`): `launcher checked`; both env files with `credential-prefix names 0`; `env.sh` `CLAND_` names exactly the builder's own (`CLAND_DISCORD_API_ROOT CLAND_ELEVENLABS_API_ROOT CLAND_EXECUTOR_STATE CLAND_TELEGRAM_API_ROOT CLAND_TEST_OWNED_ROOT`; any other `CLAND_` name is BLOCKED), `env-hub.sh` the same plus `CLAND_TEST_SKIP_ORPHAN_SWEEP`; TMPDIR and HOME `yes`; the three harnesses `none`; `0` real-HOME entries; `Q bytes 23`, `T bytes` equal to the suite root's. A non-zero credential count stops the run before any row (BLOCKED).

The TAP expectations. `expect.json` lists, per file, top-level names its source registers. `exact: true` lists every registration (static titles and their loop expansions); `exact: false` lists the names that prove a criterion (a subset; the rest of the file must still pass). Lists were read at dev `767036e27` and, for `host-runtime-join`, `host-runtime-owner`, `host-provider-volumes`, `executor-prepare`, `executor-prepare-component`, `prepare-key` and `verify-prepare`, at the branch heads above (VERIFIED-on-branch). Contract registrations (`<name>: …`) are generated by `hostProviderContract`/`hostProviderVolumeContract` through `register(name, run)` with `<name>` `fake`, `fake arm64 only` or `fake x86_64 only`. A list that differs from the tested build's source is re-derived from its loops before judging, and the difference recorded.

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/host-runtime-join.test.ts": {"exact": true, "names": [
  "C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git",
  "C3 runtime registered host reopens on the next hub start"]},
 "hub/test/host-runtime-owner.test.ts": {"exact": true, "names": [
  "runtime add opens the same owners and reopens a registered host after close",
  "runtime removal settles before carrier and Git closure and refuses later add",
  "duplicate runtime add retains the published owner without reacquiring or closing it",
  "failed runtime publication joins rollback before allowing another add",
  "failed runtime remove retains ownership and retries cleanup before unpublishing",
  "shutdown joins an in-flight runtime add and prevents its publication"]},
 "hub/test/host-ssh-registry.test.ts": {"exact": true, "names": [
  "default version layout derives code root and supervisor once",
  "registry startup uses default installed supervisor and cleanup drains all owners after carrier failure"]},
 "hub/test/host-relaunch.test.ts": {"exact": true, "names": [
  "C2/C3 admitted host relaunch running keeps durable native and checkout ownership",
  "C2/C3 admitted host relaunch refused keeps durable native and checkout ownership"]},
 "hub/test/host-survival-native.test.ts": {"exact": true, "names": [
  "three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss"]},
 "hub/test/host-revoke-native.test.ts": {"exact": true, "names": [
  "revoke settles live Claude Codex OpenCode and an already released Claude generation on the fake host"]},
 "hub/test/host-provider-fake.test.ts": {"exact": false, "names": [
  "fake: provider declares sane prices, billing and capabilities",
  "fake: provider contract creates, prepares, observes and confirms release",
  "fake: reap releases only the requested project and pool",
  "fake: refused acquire has a typed outcome",
  "fake: failed-acquire acquire has a typed outcome",
  "fake: delayed-boot preserves observed lifecycle outcomes",
  "fake: never-boot preserves observed lifecycle outcomes",
  "fake: ignored-delete preserves observed lifecycle outcomes",
  "fake arm64 only: provider contract creates, prepares, observes and confirms release",
  "fake x86_64 only: provider contract creates, prepares, observes and confirms release",
  "fake machine has independent home, run, boot identity and pinned key",
  "configured boot delay and refusal use typed states and the fixture clock",
  "never-boot and failed creation are typed failures and remain reapable",
  "ignored delete is incomplete after confirming read, including reap and restart",
  "registry refuses fake outside its test environment and caches registered providers",
  "fake opens no network socket for any lifecycle operation",
  "reap never calls a missing machine record a successful sweep",
  "missing provider metadata cannot turn a retained machine into released",
  "fake declarations include paid address in idle price and destroy billed stopped machines",
  "fake refuses acquisition outside its declared architectures"]},
 "hub/test/host-provider-declarations.test.ts": {"exact": true, "names": [
  "declarations reject missing fields, negative prices and misaligned minimums",
  "earliestStop respects both the created billing minimum and idle duration",
  "reusable contract rejects providers missing each declaration and invalid billing"]},
 "hub/test/host-provider-volumes.test.ts": {"exact": false, "names": [
  "fake: volumes create, list and confirm deletion",
  "fake: volumes enforce one attachment and region binding",
  "fake: ignored volume deletion retains inventory",
  "fake: volumes rate limit snapshots until retry time",
  "mandatory volume contract rejects deletion acknowledged without removal",
  "volume inventory, attachment and snapshot pacing survive provider recreation",
  "concurrent volume attachment and snapshot calls each admit one winner",
  "fake snapshot window rejects invalid durations",
  "malformed retained volume ownership and snapshot facts fail closed without writes"]},
 "hub/test/digitalocean-pacing.test.ts": {"exact": false, "names": [
  "300 queued calls share a token budget across clients in every 60 second window",
  "429 carries retry time and fences the shared token without automatic resend (http)",
  "429 carries retry time and fences the shared token without automatic resend (scripted)",
  "queued budget waits respect deadlines and cancellation without sending",
  "429 header retry time: {\"Retry-After\":\"2\"}",
  "429 header retry time: {\"ratelimit-reset\":\"5\"}",
  "a missing-header 429 preserves provider text and permits the next explicit call",
  "pacing counts actual sends when the caller blocks before continuations drain",
  "429 headers fence a sibling client before held body diagnostics complete",
  "independent API authorities do not inherit traffic from the same opaque token",
  "the real DigitalOcean endpoint ignores a high-rate fragment and still paces at 250"]},
 "hub/test/digitalocean-endpoint.test.ts": {"exact": false, "names": [
  "legacy real and custom URLs retain the 250 per minute policy",
  "endpoint declaration metadata is normalized and omitted from transport",
  "equivalent real endpoint declarations cannot increase the production cap"]},
 "hub/test/executor-droplet.test.ts": {"exact": false, "names": [
  "macOS inhibits idle sleep while the lease lives and drops the inhibitor after release"]},
 "hub/test/executor-prepare.test.ts": {"exact": false, "names": [
  "a project without pins prepares a reusable snapshot for delivery",
  "prepare keys hash committed hook bytes without Neovim fields and ignore local hook edits",
  "prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes"]},
 "hub/test/executor-safety.test.ts": {"exact": false, "names": []},
 "hub/test/executor-prepare-component.test.ts": {"exact": false, "names": [
  "project provision runs as root before runner prepare, failure=false",
  "project provision runs as root before runner prepare, failure=true",
  "previous persisted snapshot wire shape remains readable before recipe rebuild",
  "prepare captures applied provision input despite disk edits and refuses an unbound supplied key before reuse"]},
 "hub/test/prepare-key.test.ts": {"exact": true, "names": [
  "project hook owns Chromium libraries and pinned Neovim while the generic recipe stays neutral",
  "four-part prepare keys retain the existing snapshot hash",
  "a lock-only change invalidates the prepared browser snapshot",
  "snapshot dependency installation includes the lockfile-pinned Headless Shell",
  "absent prepare parts compare as none and become stale only when added or removed",
  "provision digest changes invalidate the snapshot with provision named",
  "config template documents the optional root provisioning script",
  "generic recipe digest invalidates a project snapshot without a hook",
  "legacy keys without recipe compare stale with recipe named",
  "a hook path change with identical bytes still marks provision stale"]},
 "hub/test/verify-prepare.test.ts": {"exact": true, "names": [
  "prepare uses installed snapshot inputs and rebuilds changed or missing installs"]},
 "hub/test/host-prelude.test.ts": {"exact": true, "names": [
  "C1: prelude installs pinned keys and hardened sshd settings",
  "C2: DigitalOcean steps, helper, sudoers and file credential store are installed",
  "C3: sentinel scan detects planted values and assignments, and rendered data excludes environment secrets"]},
 "hub/test/cland-auth.test.ts": {"exact": false, "names": [
  "C4: invalid helper arguments fail before any external command",
  "helper dispatches freeze and thaw only for the matching mounted volume",
  "unmount observes writers gone and refuses a disk with persistent writers"]}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks. `src.mjs` counts exact strings at the build with `String.split` and walks the provider module closure (relative imports from `registry.ts` and `fake.ts`, with a specifier regex; the counts inside each file are exact strings).

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   exact-string counts at the build: ok or MISMATCH, label, file, count, expectation; then the provider closure
import { readFileSync, existsSync } from 'node:fs';
const W = process.argv[2];
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const chromium = ['libasound2t64', 'libatk-bridge2.0-0t64', 'libatk1.0-0t64', 'libatspi2.0-0t64', 'libcairo2', 'libcups2t64', 'libdbus-1-3', 'libdrm2', 'libgbm1', 'libglib2.0-0t64', 'libnspr4', 'libnss3', 'libpango-1.0-0', 'libx11-6', 'libxcb1', 'libxcomposite1', 'libxdamage1', 'libxext6', 'libxfixes3', 'libxkbcommon0', 'libxrandr2'];
const tag = read('nvim/NVIM_VERSION')?.trim();
const digest = read('nvim/NVIM_SHA256SUMS')?.split('\n').find(l => l.endsWith('  nvim-linux-x86_64.tar.gz'))?.split(/\s+/)[0];
console.log(`pins at the build: tag ${tag}, linux x86_64 digest ${digest}`);
const recipe = 'hub/src/executor/droplet/provision.sh', hook = 'hub/bin/verify-provision.sh', prep = 'hub/src/executor/droplet/prepare.ts', cfg = 'hub/src/init/config.ts';
const C = [
  ['T-1709 C3 recipe names no nvim', recipe, 'nvim', '=0'],
  ['T-1709 C3 recipe carries no Neovim pin placeholder', recipe, 'NVIM', '=0'],
  ...chromium.map(p => [`T-1709 C3 recipe has no ${p}`, recipe, p, '=0']),
  ...chromium.map(p => [`T-1709 C4 hook installs ${p}`, hook, p, '=1']),
  ['T-1709 C4 hook tag equals nvim/NVIM_VERSION', hook, `NVIM_VERSION=${tag}`, '=1'],
  ['T-1709 C4 hook digest equals nvim/NVIM_SHA256SUMS', hook, `NVIM_SHA256=${digest}`, '=1'],
  ['T-1709 project config names its hook', '.cland/config.toml', 'provision = "hub/bin/verify-provision.sh"', '=1'],
  ['T-1709 C2 key type: recipe and provision, no Neovim', prep, 'export type PrepareKey = { node: string; recipe?: string; provisionPath?: string; provision?: string; lock?: string; base: string };', '=1'],
  ['T-1709 C2 prepare.ts names no nvim', prep, 'nvim', '=0'],
  ['T-1709 C2 stale parts include recipe and provision', prep, "(['base', 'lock', 'node', 'recipe', 'provision'] as const)", '=1'],
  ['T-1709 C1 hook output logged as executor-prepare-install', prep, "log({ event: 'executor-prepare-install', phase: 'provision', output: installOutput });", '=1'],
  ['T-1709 C1 failing hook fails prepare', prep, 'provision failed (exit ', '=1'],
  ['T-1709 verify-prepare reads no key Neovim field', 'hub/bin/verify-prepare.ts', 'key?.nvim', '=0'],
  ['T-1709 C5 template comment', cfg, '# provision is a repository-relative script run once as root after the image recipe, before prepare.', '=1'],
  ['T-1709 C5 template key', cfg, 'provision = ${JSON.stringify(c.verification.provision)}', '=1'],
  ['T-1709 C5 path refusal', cfg, 'verification.provision must be a repository-relative script path', '=1'],
  ['T-1709 C5 running docs', 'docs/hub/running.md', '`[verification] provision`', '>=1'],
  ['T-1709 C5 running docs stale parts', 'docs/hub/running.md', 'stale: base|lock|node|recipe|provision', '=1'],
  ['T-1709 C5 hub README', 'hub/README.md', '`[verification] provision`', '>=1'],
  ['T-1709 C5 tests guide', 'docs/agents/tests.md', '`[verification] provision`', '>=1'],
  ['T-1707 C1 transport is ssh', 'hub/src/host/provider/provider.ts', "readonly transport: 'ssh';", '=1'],
  ['T-1707 C4 fence reason', 'hub/src/host/provider/fake.ts', 'fake provider requires an absolute CLAND_FAKE_HOST_ROOT test environment', '=1'],
  ['T-1706 no frame or CLI', 'docs/hub/ssh-host.md', 'No new frame or CLI command is introduced by this owner API.', '=1'],
  ['T-1710 C3 prelude reads no environment', 'hub/src/host/prelude.ts', 'process.env', '=0'],
  ['T-1710 C1 sshd StreamLocalBindUnlink', 'hub/src/host/prelude.ts', 'StreamLocalBindUnlink yes', '=1'],
  ['T-1710 C2 sudoers line', 'hub/src/host/prelude.ts', 'runner ALL=(root) NOPASSWD: /usr/local/sbin/cland-auth', '=1'],
];
const judge = (n, e) => e === '=0' ? n === 0 : e === '=1' ? n === 1 : e === '>=1' ? n >= 1 : false;
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  console.log(`${t !== null && judge(n, e) ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
// The fake provider's closure: relative imports from registry.ts and fake.ts; builtins must stay filesystem, path and crypto only.
const allowed = new Set(['node:crypto', 'node:fs', 'node:fs/promises', 'node:path']);
const norm = p => { const out = []; for (const x of p.split('/')) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); } return out.join('/'); };
const seen = new Set(), builtins = new Set(); let bad = 0;
const walk = p => {
  if (seen.has(p)) return; seen.add(p);
  const t = read(p); if (t === null) { console.log(`MISMATCH closure file missing ${p}`); bad++; return; }
  for (const s of ['node:net', 'node:tls', 'node:http', 'node:dgram', 'fetch(']) { const n = t.split(s).length - 1; if (n) { console.log(`MISMATCH ${p} holds ${s} ${n}`); bad++; } }
  for (const m of t.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
    const s = m[1] ?? m[2];
    if (s.startsWith('.')) walk(norm(`${p.split('/').slice(0, -1).join('/')}/${s}`)); else builtins.add(s);
  }
};
walk('hub/src/host/provider/registry.ts'); walk('hub/src/host/provider/fake.ts');
const extra = [...builtins].filter(b => !allowed.has(b));
console.log(`${bad === 0 && extra.length === 0 ? 'ok' : 'MISMATCH'} T-1707 C4 provider closure | files ${[...seen].sort().join(' ')} | builtins ${[...builtins].sort().join(' ')} | outside the allowed set: [${extra.join(' ')}]`);
JS
node --check "$Q/src.mjs" && echo "src checked"
```

The check functions for QA's own shell and the scratch functions.

```sh
cat > "$Q/checks.sh" <<'SH'
# landing <id>: the single first-parent landing receipt of <id> at the build
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
s00() {   # build, plan and landing receipts (QA's own shell)
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1533 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name==="provider interface, fake provider, hook and prelude");console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}):"stage missing")' "$EV/plan.json" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do
    echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"
  done
}
s01() {   # typecheck at the integrated build (sealed)
  ( . "$Q/env.sh"; cd "$W" && node --version && npm run typecheck > "$EV/typecheck.log" 2>&1; echo "typecheck exit $?" )
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
}
s02() {   # landing diffs: preserved files unedited at their landings; test paths per landing (read-only)
  L6=$(landing T-1706 | head -n 1); L8=$(landing T-1708 | head -n 1); L9=$(landing T-1709 | head -n 1)
  echo "T-1706 landing ${L6} first parent $(git -C "$W" rev-parse "${L6}^1")"
  echo "T-1706 C4 preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L6}^1" "${L6}" -- hub/test/host-ssh-registry.test.ts hub/test/host-relaunch.test.ts hub/test/host-survival-native.test.ts hub/test/host-revoke-native.test.ts | tr '\n' ' ')]"
  echo "T-1708 landing ${L8} first parent $(git -C "$W" rev-parse "${L8}^1")"
  echo "T-1708 C3 executor files edited at its landing: [$(git -C "$W" diff --name-only "${L8}^1" "${L8}" -- hub/test/executor-droplet.test.ts hub/test/executor-prepare.test.ts hub/test/executor-safety.test.ts | tr '\n' ' ')]"
  echo "commits after T-1708's landing touching executor-droplet or executor-safety: [$(git -C "$W" log --format=%h "${L8}..${S}" -- hub/test/executor-droplet.test.ts hub/test/executor-safety.test.ts | tr '\n' ' ')]"
  echo "commits after T-1708's landing touching executor-prepare.test.ts: [$(git -C "$W" log --format=%H "${L8}..${S}" -- hub/test/executor-prepare.test.ts | tr '\n' ' ')] (T-1709 landing ${L9})"
  for id in T-1706 T-1707 T-1711 T-1712 T-1708 T-1709 T-1710; do L=$(landing "$id" | head -n 1)
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test | tr '\n' ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json web/package.json | wc -l | tr -d ' ')"
  done
}
s36() {   # end check (QA's own shell)
  echo "POST HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-after.txt"; echo "root non-tracker status unchanged: $(cmp -s "$EV/root-status-before.txt" "$EV/root-status-after.txt" && echo yes || echo no)"
  echo "preservation lock present: $([ -e /tmp/cland-preserve.lock ] && echo "yes: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null)" || echo no)"
  echo "T entries other than node-compile-cache: $(ls -A "$T" | grep -v -c -x node-compile-cache)"; ls -A "$T" | grep -v -x node-compile-cache | sed 's/^/  T: /'
}
SH
cat > "$Q/scratch.sh" <<'SH'
m30() {   # scratch project p1: a Git repo, cland init, then a sealed scratch hub with the fake harnesses and no orphan sweep
  n=$(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' '); credential-prefix names $n; HOME is Q/home $([ "$HOME" = "$QA_Q/home" ] && echo yes || echo no); TMPDIR is T $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no)"
  [ "$n" = 0 ] || { echo "BLOCKED: credential-prefix names in the seal"; return 1; }
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1533S1-30-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  hubstart; echo "hub start exit $?; hub $(up)"
}
m31() {   # T-1709 C5: the template cland init wrote documents [verification] provision, directly above its key
  cd "$QA_Q/p1" || return 1
  echo "comment then key: $(cnt .cland/config.toml '# provision is a repository-relative script run once as root after the image recipe, before prepare.
provision = ""')"
  node -e 'const t=require("fs").readFileSync(".cland/config.toml","utf8");const h=t.indexOf("[verification]\n"),p=t.indexOf("\nprovision = ");console.log("verification heading before provision key: "+(h>=0&&p>h));const ls=t.split("\n");const i=ls.findIndex(l=>l.startsWith("provision = "));console.log(ls.slice(Math.max(0,i-2),i+2).map(l=>"  | "+l).join("\n"))'
}
m32() {   # T-1709 C5 through the real CLI: cland config set names, saves and refuses the key
  cd "$QA_Q/p1" || return 1
  run "(a) unknown verification key" cland config set verification.nope x
  echo "  lines naming verification.provision: $(has 'verification.provision'); unknown-key lines: $(has 'unknown config key verification.nope')"
  run "(b) relative hook" cland config set verification.provision ci/provision.sh
  echo "  saved line: $(has 'verification.provision = "ci/provision.sh"; applies now')"
  echo "  file: key $(cnt .cland/config.toml 'provision = "ci/provision.sh"'); comment kept $(cnt .cland/config.toml '# provision is a repository-relative script run once as root after the image recipe, before prepare.')"
  run "(c) absolute hook" cland config set verification.provision /etc/provision.sh
  echo "  refusal lines: $(has 'verification.provision must be a repository-relative script path')"
  run "(d) parent hook" cland config set verification.provision ../provision.sh
  echo "  refusal lines: $(has 'verification.provision must be a repository-relative script path')"
  echo "file after refusals: relative kept $(cnt .cland/config.toml 'provision = "ci/provision.sh"'); absolute $(cnt .cland/config.toml '/etc/provision.sh'); parent $(cnt .cland/config.toml '../provision.sh')"
  run "(e) clear" cland config set verification.provision ''
  echo "  file: empty key $(cnt .cland/config.toml 'provision = ""')"
}
m33() {   # T-1707 C4 at the library edge, sealed: no config or CLI selects a host provider at this build
  node --input-type=module -e '
const { HostProviderRegistry } = await import(process.env.QA_W + "/hub/src/host/provider/registry.ts");
const out = (label, f) => { try { console.log(JSON.stringify({ label, ok: true, value: f() })); } catch (e) { console.log(JSON.stringify({ label, ok: false, error: String(e?.message ?? e) })); } };
console.log("sealed CLAND_FAKE_HOST_ROOT: " + (process.env.CLAND_FAKE_HOST_ROOT === undefined ? "unset" : "set"));
out("sealed environment", () => new HostProviderRegistry({ env: process.env }).resolve({ provider: "fake" }).transport);
out("relative root", () => new HostProviderRegistry({ env: { CLAND_FAKE_HOST_ROOT: "fh" } }).resolve({ provider: "fake" }).transport);
out("absolute scratch root (positive control)", () => new HostProviderRegistry({ env: { CLAND_FAKE_HOST_ROOT: process.env.QA_Q + "/fh" } }).resolve({ provider: "fake" }).transport);
out("unknown provider", () => new HostProviderRegistry({ env: process.env }).resolve({ provider: "digitalocean" }).transport);'
  echo "fh entries after the probe: $(ls -A "$QA_Q/fh" | wc -l | tr -d ' ')"
}
m34() {   # T-1706: no host add or remove command; the CLI's host lines at the build
  cd "$QA_Q/p1" || return 1
  cland help > "$QA_Q/help.txt" 2>&1; echo "help exit $?"
  node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8");const l=t.split("\n").filter(x=>x.startsWith("  host "));console.log("host commands: "+l.map(x=>x.slice(7).split(/\s/)[0]).join(" "));for(const s of ["host add","host remove","host join","host leave"])console.log(s+": "+(t.split("  "+s).length-1))' "$QA_Q/help.txt"
}
m35() {   # cleanup census: the scratch hub stopped; nothing names the scratch root or this build's CLI
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "recorded pid $p alive $(alive "$p")"; done
  node -e 'const {execFileSync}=require("child_process");const rows=execFileSync("ps",["-axo","pid=,ppid=,command="],{encoding:"utf8"}).split("\n").filter(Boolean).map(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l);return {pid:+m[1],ppid:+m[2],cmd:m[3]}});const by=new Map(rows.map(r=>[r.pid,r]));const anc=new Set();let p=process.pid;while(p&&by.has(p)&&!anc.has(p)){anc.add(p);p=by.get(p).ppid}const hits=rows.filter(r=>!anc.has(r.pid)&&(r.cmd.includes(process.env.QA_Q)||r.cmd.includes(process.env.QA_W+"/")));console.log("processes naming the scratch root or this build: "+hits.length);for(const h of hits)console.log("  "+h.pid+" "+h.cmd.slice(0,160))'
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `src checked`, `scratch checked`. Record all of the setup above in `S0`.

Cleanup after the evidence is recorded and E1533S1-35 passed: print `$Q` and check it begins with `/private/tmp/q51-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s1-` and holds nothing but `node-compile-cache`, and remove it by that literal path. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The secrets in `$Q/p1/.cland/hub.json` and `$Q/p1/.cland/secret` are never printed or posted.

## Cases

Every case is one named test file run once at the build, from QA's own shell through `nt` (or `pl` for T3 files, under the preservation lock), and recorded with `qa-record.sh note` (surface `hub-api`), its evidence `$EV/<id>.log` and `$EV/<id>.check.txt`. A case passes only when its check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name). A missing file at the build is a FAIL naming the file, never a silent drop. Run in table order; never two files at once.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1533S1-10 | hub-api | QA | `pl E1533S1-10 hub/test/host-runtime-join.test.ts` | `CLEAN` with the exact list (T-1706 C1, C2, C3; VERIFIED-on-branch `4e8aa7793`). Test `C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git`: an embedded hub starts with no host, the record is persisted and added through `hostOwner.add`; an authenticated directory receipt precedes a `session.launch` frame with `host: 'f1'` inside 5 s, and the durable row is `running` on `f1`; `hostOwner.remove('f1')` returns `timedOut` false and empty `leftovers`, the record is `revoked`, the row `stopped`, the captured Host refuses (`closed\|revoked\|not up`), the Git socket is gone (`ENOENT`) and `hostOwner.hosts` is empty. Test `C3 runtime registered host reopens on the next hub start`: after a stop, a second hub over the same database reopens `f1` with a fresh authenticated receipt and the record stays `registered` |
| E1533S1-11 | hub-api | QA | `nt E1533S1-11 hub/test/host-runtime-owner.test.ts` | `CLEAN` with the exact list (T-1706 owner lifecycle, T2 with typed fake carrier and Git owners, no native process; no lock needed). Tests: `runtime add opens the same owners and reopens a registered host after close`, `runtime removal settles before carrier and Git closure and refuses later add`, `duplicate runtime add retains the published owner without reacquiring or closing it`, `failed runtime publication joins rollback before allowing another add`, `failed runtime remove retains ownership and retries cleanup before unpublishing`, `shutdown joins an in-flight runtime add and prevents its publication` |
| E1533S1-12 | hub-api | QA | `nt E1533S1-12 hub/test/host-ssh-registry.test.ts` | `CLEAN` with the exact list, the file unedited by T-1706 (E1533S1-02) (T-1706 C4). Tests: `default version layout derives code root and supervisor once`, `registry startup uses default installed supervisor and cleanup drains all owners after carrier failure` |
| E1533S1-13 | hub-api | QA | `pl E1533S1-13 hub/test/host-relaunch.test.ts` | `CLEAN` with both expansions of `C2/C3 admitted host relaunch <outcome> keeps durable native and checkout ownership` (`running`, `refused`), the file unedited by T-1706 (T-1706 C4; the relaunch path now goes through `Sessions.addHost` at construction) |
| E1533S1-14 | hub-api | QA | `pl E1533S1-14 hub/test/host-survival-native.test.ts` | `CLEAN`, test `three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss`, the file unedited by T-1706 (T-1706 C4). Allow its 20 s planned downtime; a slow pass is not a finding |
| E1533S1-15 | hub-api | QA | `pl E1533S1-15 hub/test/host-revoke-native.test.ts` | `CLEAN`, test `revoke settles live Claude Codex OpenCode and an already released Claude generation on the fake host` (the revoke settlement path that `hostOwner.remove` calls first, unedited; named by T-1706's join guide as a preservation file; supports T-1706 C2) |
| E1533S1-16 | hub-api | QA | `nt E1533S1-16 hub/test/host-provider-fake.test.ts` | `CLEAN` with every listed name (T-1707 C1 to C4, T-1711 C1, C2). The contract registrations run for `fake`, `fake arm64 only` and `fake x86_64 only`; `<name>: provider contract creates, prepares, observes and confirms release` asserts `transport` `ssh`, `prepare` `prepared` then `current`, `acquire` `created` with id, address, architecture and created time, `status` `ready`, `release` `released` then `status` `gone`, and `reap` `reaped` with nothing left. Test `registry refuses fake outside its test environment and caches registered providers` asserts the refusal `absolute CLAND_FAKE_HOST_ROOT test environment` for an empty and a relative root and `unknown host provider` for an absent name. Test `fake opens no network socket for any lifecycle operation` mocks `net.createServer`, `Server.listen`, `Socket.connect`, `tls.connect` and `fetch`, proves the mocks throw, then runs prepare, acquire, status, release and reap with zero calls to any of them. Test `fake declarations include paid address in idle price and destroy billed stopped machines` (T-1711 C2) |
| E1533S1-17 | hub-api | QA | `nt E1533S1-17 hub/test/host-provider-declarations.test.ts` | `CLEAN` with the exact list (T-1711 C1, C3). Tests: `declarations reject missing fields, negative prices and misaligned minimums`, `reusable contract rejects providers missing each declaration and invalid billing` (each candidate rejected matching `invalid host provider declaration`), `earliestStop respects both the created billing minimum and idle duration` |
| E1533S1-18 | hub-api | QA | `nt E1533S1-18 hub/test/host-provider-volumes.test.ts` | `CLEAN` with every listed name (T-1712 C1 to C4; VERIFIED-on-branch `72ed1ccc5`). The `fake` volume registrations assert: attach to one machine `attached` (idempotent), attach elsewhere and detach elsewhere `refused` `attached elsewhere`, delete while attached `refused` `attached`, attach to a machine in the other region `refused` `region mismatch`; a second snapshot inside the window `refused` `rate limited` with the scripted `retryAt`, a snapshot after the window `snapshotted` with a new id; `deleteVolume` `deleted` only with the volume gone from `listVolumes`, and the ignored-delete scenario `incomplete` with the volume still listed. Test `mandatory volume contract rejects deletion acknowledged without removal` proves the contract fails a provider that reports `deleted` without removal |
| E1533S1-19 | hub-api | QA | `nt E1533S1-19 hub/test/digitalocean-pacing.test.ts` | `CLEAN` with every listed name (T-1708 C1, C2). Test `300 queued calls share a token budget across clients in every 60 second window` asserts, on the injected clock, at most 250 sends in every 60 s window; the `http` and `scripted` expansions of `429 carries retry time and fences the shared token without automatic resend (<mode>)` assert a typed `RateLimited` refusal carrying the response's retry time and no send before it; the `429 header retry time: <headers>` expansions parse `Retry-After` seconds and dates and `ratelimit-reset`, and a missing or bad header leaves `retryAt` undefined |
| E1533S1-20 | hub-api | QA | `nt E1533S1-20 hub/test/digitalocean-endpoint.test.ts` | `CLEAN` with every listed name and the invalid-declaration expansions of `reject invalid endpoint declaration <fragment>` and `reject non-base endpoint <name>` (T-1708 C1: the 250 per minute production cap cannot be raised by an endpoint declaration) |
| E1533S1-21 | hub-api | QA | `pl E1533S1-21 hub/test/executor-droplet.test.ts` | `CLEAN`, the whole file (T-1708 C3). Test `macOS inhibits idle sleep while the lease lives and drops the inhibitor after release` runs on macOS and must not be skipped; the file's provider is the loopback fake DigitalOcean API |
| E1533S1-22 | hub-api | QA | `pl E1533S1-22 hub/test/executor-prepare.test.ts` | `CLEAN`, the whole file (T-1708 C3 at the build; T-1709 C2, C5). Test `prepare keys hash committed hook bytes without Neovim fields and ignore local hook edits` (VERIFIED-on-branch `6f3d831fe`) asserts the key's `provision` digest of the committed hook, no `nvim` field, `provisionPath` `system.sh`, a local uncommitted edit leaves the key unchanged, a committed one-byte edit changes `provision` and `staleParts` gives `base` and `provision`, and a symlinked hook is refused (`provision.*regular.*file`). Test `a project without pins prepares a reusable snapshot for delivery` is the no-hook project |
| E1533S1-23 | hub-api | QA | `pl E1533S1-23 hub/test/executor-safety.test.ts` | `CLEAN`, the whole file, nested `shell` and `host` subtests included in the counters (T-1708 C3) |
| E1533S1-24 | hub-api | QA | `nt E1533S1-24 hub/test/executor-prepare-component.test.ts` | `CLEAN` with every listed name (T-1709 C1; VERIFIED-on-branch). The `failure=false` and `failure=true` expansions of `project provision runs as root before runner prepare, failure=<bool>` assert: the first scripted machine call runs as `root` naming `system.sh`; the hub log holds `executor-prepare-install` with `phase` `provision` and the hook's combined output; without failure the second call is `runner` running `npm ci`; with failure the prepare ends `failed` with `provision failed (exit 17)` followed by the hook output and no runner call |
| E1533S1-25 | hub-api | QA | `nt E1533S1-25 hub/test/prepare-key.test.ts` | `CLEAN` with the exact list (T-1709 C2 to C5). Test `project hook owns Chromium libraries and pinned Neovim while the generic recipe stays neutral` reads `provision.sh` (no `nvim`, `libasound`, `libatk`, `libnss`, `libx11`), the hook's `NVIM_VERSION=` equal to `nvim/NVIM_VERSION` and `NVIM_SHA256=` equal to the `nvim-linux-x86_64.tar.gz` line of `nvim/NVIM_SHA256SUMS`, and every Chromium package on its install line. Test `config template documents the optional root provisioning script` matches the template comment directly above `provision = ""` |
| E1533S1-26 | hub-api | QA | `pl E1533S1-26 hub/test/verify-prepare.test.ts` | `CLEAN`, test `prepare uses installed snapshot inputs and rebuilds changed or missing installs` (T-1709: `verify-prepare.ts` reads a key without a Neovim field and seeds when the installed pin's tag or digest differs) |
| E1533S1-27 | hub-api | QA | `nt E1533S1-27 hub/test/host-prelude.test.ts` | `CLEAN` with the exact list (T-1710 C1 to C3). Tests: `C1: prelude installs pinned keys and hardened sshd settings`, `C2: DigitalOcean steps, helper, sudoers and file credential store are installed`, `C3: sentinel scan detects planted values and assignments, and rendered data excludes environment secrets` |
| E1533S1-28 | hub-api | QA | `pl E1533S1-28 hub/test/cland-auth.test.ts` | `CLEAN` with every listed name, the whole file (T-1710 C4). Every external command is a stub on a scratch `PATH`; no sudo, device, mount or signal. Test `C4: invalid helper arguments fail before any external command` asserts a non-zero exit and an empty command log for each malformed operation, name or path |
| E1533S1-29 | hub-api | QA | `nt E1533S1-29 hub/test/config-set.test.ts hub/test/init-config.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Every run `CLEAN` (T-1709 C5: the template and config writer still pass with the new key; every new stage test file is in `tiers.json` with a guide under `docs/agents/tests/`) |

### Web cases (when in scope)

none. The stage changes no web surface; no browser runs.

## Manual checks

Run in table order: E1533S1-00 to E1533S1-03 before the cases, E1533S1-30 to E1533S1-36 after them. Scratch rows depend on the state the rows before them leave. Record each with `sh .agents/skills/qa/qa-record.sh note E-1533 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1533S1-00 | hub-api | QA | `s00 > "$EV/E1533S1-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA the same 40 hex; `dirty entries 0`; the root's non-tracker count recorded (E1533S1-36 compares). `plan read exit 0`; the stage line shows `name` `provider interface, fake provider, hook and prelude`, `qa` `{"scope":"affected","when":"after-stage"}`, `items` holding T-1706, T-1707, T-1711, T-1712, T-1708, T-1709 and T-1710 plus any finding fixes the request names, `merged` equal to `total`, and `state` not `closed`. Every member line reads `landings 1` with its commit; any other count is BLOCKED |
| E1533S1-01 | hub-api | QA | `s01 > "$EV/E1533S1-01.txt" 2>&1` (QA's own shell; the typecheck runs sealed) | Node 24; `typecheck exit 0` (the whole workspace at the integrated build); `dirty entries 0` |
| E1533S1-02 | hub-api | QA | `s02 > "$EV/E1533S1-02.txt" 2>&1` (QA's own shell, read-only) | `T-1706 C4 preserved files edited at its landing: []`; `T-1708 C3 executor files edited at its landing: []` (VERIFIED at `7fce3c5b1`); `commits after T-1708's landing touching executor-droplet or executor-safety: []`; the executor-prepare list holds exactly the T-1709 landing (an extra commit is read before judging). Test paths per landing, against these sets (VERIFIED at the landings for T-1707, T-1711, T-1708, T-1710; VERIFIED-on-branch for T-1706, T-1712, T-1709, where a landing may add `hub/test/durations.json`): T-1706 `hub/test/harness.ts hub/test/host-runtime-join.test.ts hub/test/host-runtime-owner.test.ts hub/test/tiers.json`; T-1707 `hub/test/fakes/fake-host-socket.ts hub/test/fakes/fake-host.ts hub/test/host-provider-contract.ts hub/test/host-provider-fake.test.ts hub/test/tiers.json`; T-1711 `hub/test/host-provider-contract.ts hub/test/host-provider-declarations.test.ts hub/test/host-provider-fake.test.ts hub/test/tiers.json`; T-1712 `hub/test/host-provider-contract.ts hub/test/host-provider-volumes.test.ts hub/test/tiers.json`; T-1708 `hub/test/digitalocean-endpoint.test.ts hub/test/digitalocean-pacing.test.ts hub/test/fakes/digitalocean/fake-api.ts hub/test/tiers.json`; T-1709 `hub/test/durations.json hub/test/executor-prepare-component.test.ts hub/test/executor-prepare.test.ts hub/test/fakes/digitalocean/scripted-machine.ts hub/test/prepare-key.test.ts hub/test/remote-fixture.ts hub/test/verify-prepare.test.ts`; T-1710 `hub/test/cland-auth.test.ts hub/test/durations.json hub/test/host-prelude.test.ts hub/test/tiers.json`. `package.json and lockfiles: 0` for every landing |
| E1533S1-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1533S1-03.txt" 2>&1` (QA's own shell, read-only) | The `pins at the build` line names the tag of `nvim/NVIM_VERSION` and the Linux x86_64 digest of `nvim/NVIM_SHA256SUMS` (at writing `v0.12.5`, `bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875`). Every line reads `ok`: `provision.sh` holds no `nvim`, no `NVIM` and none of the Chromium runtime packages (T-1709 C3); the hook holds each package once and the tag and digest equal to the pin files (C4); `.cland/config.toml` names the hook; the `PrepareKey` type has `recipe`, `provisionPath`, `provision` and no Neovim field, `prepare.ts` names no `nvim`, the stale parts add `recipe` and `provision` (C2); the provision phase log and failure text (C1); the template comment, key and path refusal and the docs (C5); `transport` `ssh` and the fake's fence reason (T-1707 C1, C4); the T-1706 doc sentence; `prelude.ts` reads no `process.env` (T-1710 C3). The closure line reads `ok` with builtins only `node:crypto node:fs node:fs/promises node:path` (at writing the files `hub/src/host/provider/declarations.ts fake-volume-record.ts fake.ts provider.ts registry.ts`, `shared/fake-host-directory.ts fake-host-machine.ts fixture-sockets.ts`). A `MISMATCH` is read at the build before judging (a renamed string is followed to its new text) and is a FAIL unless the landing changed it with a recorded decision |
| E1533S1-30 | hub-api | Human | `( . "$Q/env-hub.sh"; . "$Q/scratch.sh"; m30 ) > "$EV/E1533S1-30.txt" 2>&1` | PRE `p1 entries 0`, `credential-prefix names 0`, HOME and TMPDIR `yes`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `hub start exit 0; hub up`. A hub start failure makes E1533S1-32 BLOCKED (the only row that needs the scratch hub); E1533S1-31, E1533S1-33 and E1533S1-34 still run |
| E1533S1-31 | hub-api | Human | `( . "$Q/env-hub.sh"; . "$Q/scratch.sh"; m31 ) > "$EV/E1533S1-31.txt" 2>&1` | **T-1709 C5, the template a new project gets.** `comment then key: 1`; `verification heading before provision key: true`; the printed lines show `[verification]`'s first comment, `# provision is a repository-relative script run once as root after the image recipe, before prepare.` and `provision = ""` |
| E1533S1-32 | hub-api | Human | `( . "$Q/env-hub.sh"; . "$Q/scratch.sh"; m32 ) > "$EV/E1533S1-32.txt" 2>&1` | **T-1709 C5 through `cland config set`** (the CLI has only `config set <section.key> <value> [--json]`). (a) exit non-zero, `unknown-key lines` 1 or more and `lines naming verification.provision` 1 or more (the refusal lists the known `verification` keys). (b) exit 0, `saved line: 1` (`verification.provision = "ci/provision.sh"; applies now`), file key 1, comment kept 1. (c) and (d) exit non-zero with `refusal lines` 1 or more each. `file after refusals: relative kept 1; absolute 0; parent 0`. (e) exit 0 and `empty key 1`. The hook file need not exist: the key is a path; prepare reads it from the committed base |
| E1533S1-33 | hub-api | Human | `( . "$Q/env-hub.sh"; . "$Q/scratch.sh"; m33 ) > "$EV/E1533S1-33.txt" 2>&1` | **T-1707 C4 at the library edge.** No project config or CLI selects a host provider at this build (pools arrive in stage 2); this probe calls the build's registry through the seal. `sealed CLAND_FAKE_HOST_ROOT: unset`; `sealed environment` and `relative root` each `ok` false with `fake provider requires an absolute CLAND_FAKE_HOST_ROOT test environment`; the positive control `ok` true with `value` `ssh`; `unknown provider` `ok` false with `unknown host provider: digitalocean`. `fh entries after the probe` is recorded (construction alone writes nothing, INFERRED). No positive control result makes the row INCONCLUSIVE |
| E1533S1-34 | hub-api | Human | `( . "$Q/env-hub.sh"; . "$Q/scratch.sh"; m34 ) > "$EV/E1533S1-34.txt" 2>&1` | **T-1706 adds no CLI.** `help exit 0`; `host commands: revoke git-proxy attach serve`; `host add`, `host remove`, `host join` and `host leave` each `0`. T-1706's runtime add and remove are reached only through `dispatcher.hostOwner` in code; E1533S1-10 and E1533S1-11 carry its criteria, so this run adds no fake-host scratch rows |
| E1533S1-35 | hub-api | Human | `( . "$Q/env-hub.sh"; . "$Q/scratch.sh"; m35 ) > "$EV/E1533S1-35.txt" 2>&1` | `hub stop exit 0; hub down`; every recorded pid `alive no`; `processes naming the scratch root or this build: 0`. A hit is listed and is a FINDING unless its command is unrelated (pid reuse, recorded) |
| E1533S1-36 | hub-api | QA | `s36 > "$EV/E1533S1-36.txt" 2>&1` (QA's own shell) | HEAD, dev and the request's SHA still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `T entries other than node-compile-cache 0`. A leftover in `$T` is listed by name, checked dead (no listener, owner pids gone) and attributed to its file before any literal-path removal; a leftover from a stage file (`hp-`, `hp-vol-`, `cland-auth-script-` prefixes) is a finding. A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1533-stage-1.md --commit <dev SHA>`, with a dev SHA that includes the T-1706, T-1712 and T-1709 landings. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid census registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too.
- Edit existing keys in initialized configs: E1533S1-32 changes `verification.provision` only through `cland config set`, never by hand.
- **The contract registrations are generated names.** `hostProviderContract` and `hostProviderVolumeContract` register `<name>: …` through the caller's `register(name, run)` wrapper, so `qa lint` cannot certify them; `tap.mjs` checks them by name at the run, and the expansions listed in `expect.json` are re-derived from the contract file at the build.
- **The fake's no-network test mocks entry points.** `fake opens no network socket for any lifecycle operation` mocks `net`, `tls` and `fetch` entry points only; E1533S1-03's closure check (no network module anywhere in the provider's import closure) complements it. Neither proves anything about a real provider.
- **T-1708 C3 "unedited" is judged at its landing.** `hub/test/executor-prepare.test.ts` is edited later by T-1709 by design; at the build that file passing (E1533S1-22) and its edit being T-1709's alone (E1533S1-02) are the checks, not a zero diff since the stage began.
- **The executor files run a loopback fake DigitalOcean API.** Their `127.0.0.1` listener and synthetic token (`cland-test-prepare`) are fixtures; no request leaves the machine. A real DigitalOcean variable in the seal is a setup BLOCKED (S0).
- **T-1709 takes effect only at the live hub's restart.** `provision.sh` and the key are read from the running hub's code; nothing in this run restarts the live hub or prepares a snapshot, and no row may run `cland executor prepare`. The first rebuild is the Coordinator's.
- **The DigitalOcean automount step is a test-supplied provider step.** `renderPrelude` takes `providerSteps` from its caller; at writing no `hub/src` code supplies the DigitalOcean steps (the provider arrives in stage 2), so test `C2: DigitalOcean steps, helper, sudoers and file credential store are installed` passes the `rm -f /etc/udev/rules.d/99-digitalocean-automount.rules` step itself. QA judges T-1710 C2 on that test as written. The provider wiring is T-1719 C7 (stage 3, Coordinator decision 2026-11-06); it is out of scope here and not an observation.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding and a fast one proves no budget.
- **`cland config` has only `set`.** The documented surface is the template `cland init` writes (E1533S1-31) and `config set`'s known-key list and refusals (E1533S1-32); there is no `config get` or `config show`.
- **No runtime host CLI.** T-1706's owner API has no frame or command; a scratch hub cannot add a host at runtime, so the named files carry T-1706.
- `cland-auth.test.ts` runs the helper with `/bin/bash` and stubbed commands; it touches no device or mount.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- Speed criteria use measured wall times, never projections; this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases: `executor-droplet`'s macOS idle-sleep case runs here; no listed file skips on macOS at writing.
- Re-check helper and function names with grep at the tested build; renames happen. The kit's line ranges are pinned by the stage-4 brief's blob; a different blob is a setup BLOCKED, never a reason to guess new ranges.
- T-1706, T-1712 and T-1709 strings and titles were read on their branch heads, not on dev; re-read every such line at the build before judging.

## Out of scope

- The real DigitalOcean API, real droplets, volumes, snapshots, keys and tokens, and any network.
- The first real snapshot rebuild after the live hub restarts onto T-1709 (the Coordinator restarts the hub and watches that droplet run before any batch relies on it), and any `cland executor prepare`, `cland verify` or `cland hub reload` on the live project.
- The later stages `DigitalOcean on a fake API, the recipe and pool images` and `create to ready`, and their items; the DigitalOcean provider's own prelude steps and pools.
- Linux and container runs: the stage covers' evidence; this run is macOS only and says so in the verdict.
- Duration allowances (`hub/test/durations.json`) as pass conditions.
- Repetitions under load: each file runs once.

Missing authorization (a real-browser or GUI step, a droplet) is out of scope, not BLOCKED, because none of these cases needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fakes with a disposable HOME and no credential.

## Source provenance

VERIFIED = read in source at the named commit. VERIFIED-on-branch = read on the branch head named under "Build" before its landing; re-read at the build. INFERRED = not read at the tested build or not proven by a named test; re-read it at the build and record the difference before judging.

- T-1706 (VERIFIED-on-branch `4e8aa7793`): titles in `hub/test/host-runtime-join.test.ts` (lines 14, 43) and `hub/test/host-runtime-owner.test.ts` (lines 12, 27, 56, 63, 79, 90); `projectSshHosts` returning `{hosts,add,remove,close,quiesce}` and `remove` calling `settle` first (`hub/src/host/registry.ts`); `onAdd`/`onRemove`/`settle` wiring and `hub.dispatcher.hostOwner` (`hub/src/hub/daemon.ts`); `Sessions.addHost`/`removeHost` (`hub/src/adapters/sessions.ts`); the doc sentence in `docs/hub/ssh-host.md`; no `hub/src/cli` change; guides naming "the preservation lock in the E-1533 stage brief". Preservation titles (VERIFIED at dev `767036e27`): `hub/test/host-ssh-registry.test.ts` lines 17, 24; `hub/test/host-relaunch.test.ts` line 27 (`running`/`refused` loop); `hub/test/host-survival-native.test.ts` line 25; `hub/test/host-revoke-native.test.ts` line 33; none touched by the branch.
- T-1707 and T-1711 (VERIFIED at dev `767036e27`, unchanged in their test files by T-1712 except `host-provider-contract.ts`): `hub/test/host-provider-fake.test.ts` (contract calls at lines 41 to 44, titles at 46 to 158); `hub/test/host-provider-contract.ts` registrations (`provider declares…` line 14, `provider contract creates…` 18, `reap releases…` 37, the `refused`/`failed-acquire` loop 49 to 50, the `delayed-boot`/`never-boot`/`ignored-delete` loop 58 to 59); `hub/test/host-provider-declarations.test.ts` lines 14, 32, 42; the fence string in `hub/src/host/provider/fake.ts:28`; `readonly transport: 'ssh';` in `provider.ts`; no `hub/src` consumer of `HostProviderRegistry` outside `hub/src/host/provider/` on dev or any stage branch.
- T-1712 (VERIFIED-on-branch `72ed1ccc5`): `hostProviderVolumeContract` registrations (lines 95, 109, 132, 141) and the refusal shapes `attached elsewhere`, `attached`, `region mismatch`, `rate limited`; `hub/test/host-provider-volumes.test.ts` titles (lines 23, 35, 50, 63, 71); the provider closure files and builtins as listed in E1533S1-03.
- T-1708 (VERIFIED at its landing `7fce3c5b1` and dev): `hub/test/digitalocean-pacing.test.ts` titles (lines 10, 26 loop, 48, 68 loop, 80, 100, 114 loop, 125, 161, 173, 188, 198) and `hub/test/digitalocean-endpoint.test.ts` (lines 6, 10, 15, 20 loop, 23 loop); its landing's file list (no executor test file).
- T-1709 (VERIFIED-on-branch `6f3d831fe`): `hub/bin/verify-provision.sh` (each Chromium package once, `NVIM_VERSION=v0.12.5`, `NVIM_SHA256=bce0f56e…`), the recipe diff removing Neovim and the Chromium line from `provision.sh`, every `src.mjs` string for `prepare.ts`, `config.ts`, `.cland/config.toml`, `verify-prepare.ts`, `docs/hub/running.md`, `hub/README.md`, `docs/agents/tests.md`; titles in `hub/test/prepare-key.test.ts` (lines 9 to 87), `hub/test/executor-prepare.test.ts` (43, 123, 187, 269, 294), `hub/test/executor-prepare-component.test.ts` (the `failure` loop at 546, 577, 585) and `hub/test/verify-prepare.test.ts` (13); `verification.provision` not a startup field (`STARTUP_VERIFICATION_FIELDS`, `hub/src/hub/configuration.ts:23`), so a set `applies now` after a successful reload.
- T-1710 (VERIFIED at its landing `03e1cdf92` and dev): `hub/test/host-prelude.test.ts` titles (lines 6, 12, 22) and the test-supplied DigitalOcean `providerSteps` (line 13); `hub/test/cland-auth.test.ts` titles (30, 43, 60, …); `hub/src/host/prelude.ts` holds no `process.env`; no `hub/src` code passes DigitalOcean provider steps.
- CLI surfaces (VERIFIED at dev `767036e27`): `cland config` accepts only `set` (`hub/src/cli/config.ts:9`), prints `<key> = <JSON value>; applies now` (`:22`–`:23`); an unknown key is refused with the known keys of its section (`hub/src/init/config-set.ts`, `prepareConfigValue`); `cland init` writes `renderConfig` (`hub/src/init/config.ts:548`); `cland help` host lines `revoke`, `git-proxy`, `attach`, `serve`.
- The kit (VERIFIED at dev `767036e27`): `qa/briefs/E-1532-stage-4.md` blob `4ed467672750bf34179ed72549df863d1541eddb`, lines 133 to 140 and 228 to 279; `fixtureEnvironment` and `scratchGitEnvironment` exports of `test-support/fixture-environment.ts`; `CLAND_TEST_SKIP_ORPHAN_SWEEP` gating the hub's orphan sweep (`hub/src/hub/daemon.ts:709`); the fake harness binaries under `hub/test/fakes/`.
- INFERRED: the preservation lock's path and owner-file shape (from the stage request; the test guides name "the stage preservation lock" without a path); the CLI's exact stderr prefix for a hub-side `config set` refusal (the row's pass condition is the message text, a non-zero exit and the unchanged file); `applies now` actually printed (depends on the scratch reload succeeding); a clean sealed scratch `hub start` at this build (the stage-4 shape, not re-run at writing); the landings of T-1706, T-1712 and T-1709 (their commits, test-path sets and any merge edits); no commit after T-1708's landing touching `executor-droplet` or `executor-safety`; `fh entries after the probe` 0.
- Plan JSON (VERIFIED at dev `767036e27`): a stage carries `name`, `state`, `qa`, `items`, `merged`, `total`, `statuses`, `cover`, optional `verdict`; lanes are in `plan.stages[].lanes`.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "provider interface, fake provider, hook and prelude"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1533 stage provider interface, fake provider, hook and prelude` or `qa not clear E-1533 stage provider interface, fake provider, hook and prelude` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
