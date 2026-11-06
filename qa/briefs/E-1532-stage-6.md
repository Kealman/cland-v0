# Stage QA brief: E-1532 stage 6 — relaunch elsewhere

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers; always brace a variable before `:`). The run is local, on macOS (BSD `stat -f`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`, the pinned Neovim of `node nvim/bin/nvim-path.ts`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, key or network (R-1530's QA rule):** the carrier runs only through the fake `ssh` and `scp` stand-ins of `hub/test/fakes/` against fake hosts made by the build's own `createFakeHost` (`hub/test/fakes/fake-host.ts`); the scratch hub's hosts are fake hosts on this Mac, whose agents are the build's `cland host serve` run by the shipped supervisor as local processes. **No real harness:** Claude Code, Codex and OpenCode run only as the build's fakes and the scripted fakes inside the named files; the scratch rows launch one Codex item session with the build's fake `codex` (`hub/test/fakes/codex/codex`). No browser, no GUI.

## Corrections folded in from earlier E-1532 runs

These come from the stage-2, stage-3 and stage-4 runs (stage 4: qa-678, A-16583) and are carried unchanged:

- **The seal.** Every scratch launch is built by `seal.mjs` as `scratchGitEnvironment(Q, fixtureEnvironment(Q, base, overlays), {excludesFile})` (`test-support/fixture-environment.ts`). This run's overlays (`PATH`, `TMPDIR`, the `QA_*` roots, `GH_PAGER: undefined` and the launch's own `CLAND_*`/`FAKE_*` inputs) go **into** the builder, which applies its credential filter after them; no `Object.assign` or copied prefix filter follows it (rule 15). `GH_PAGER: undefined` keeps the credential-prefix count at 0.
- **The sealed `PATH`** drops every entry under the real HOME (read from the OS user record, not `HOME`) and every `~`-relative entry, except the running Node's own `bin`. The pinned Neovim directory that `node nvim/bin/nvim-path.ts` resolves (compared as a realpath) is the only other exemption in the real-HOME `PATH` assertion of S0. `claude`, `codex` and `opencode` must resolve to nothing on the sealed `PATH`.
- **TMPDIR.** `TMPDIR` of every sealed command is `$T`, a `/private/tmp/qa-e1532-s6-<uuid>` directory of the same byte length as the suite root (`hub-lifecycle` expects a literal `hub.sock`; a longer TMPDIR forces the fallback socket, T-1677). Known pre-existing TMPDIR residue from unchanged test files (hub/spoke fallback endpoints, `cland-run` Codex sockets, `cland-fixture-owners-<uid>` receipts, `adapter-native-boundary`'s four `cx-*.sock` placeholders; T-1676) is inventoried, checked dead (no listener, owner PIDs gone), attributed per file, and only then removed by literal path before the final census. Live or stage-attributed residue stays a finding. The final census ignores `node-compile-cache`.
- **Neovim**, where any process looks for it, is the build's pinned release, first on the sealed `PATH`, never a Homebrew `nvim`. No row here needs Neovim.
- **Publication scanner** (`assertPublishable`, `.agents/skills/qa/qa-demo-policy.ts`) refuses the bare word that names the HTTP Authorization scheme when a word follows it (T-1665). This brief avoids that word; `hub/test/spoke-unix-edge.test.ts` and `hub/test/host-secret-admission.test.ts` print titles that contain it, so their TAP logs are refused by design (see "Probes that mislead"). Neither runs here.
- **Censuses** exclude the census process and all its ancestors and match only this run's `$Q`, alias and worktree paths.
- **macOS Unix socket paths** are measured with their NUL against 104 bytes. `$Q` is a `mktemp -d /tmp/q36-XXXXXX` realpath (23 bytes). A count of 104 or more makes the row BLOCKED; an `EINVAL` on connect is a FAIL.
- **Rule 22.** Ids are read back from listings and topic history, never from a `send` or create result. Every selector, test name and string is marked VERIFIED or INFERRED under "Source provenance"; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports registrations at the top level with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that.
- **Fake hosts on macOS** need `CLAND_FAKE_HOSTS` and `CLAND_HOST_BOOT_ID_FILE` in their agent's environment; the fake controls (`kill-agent`, `kill-master`, `gone`) need `CLAND_FAKE_HOSTS` and `CLAND_FAKE_HOST_ROOT` through the seal.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`.
- **No hub-side TCP for host traffic.** Unix sockets only, judged with a positive control first (a planted 127.0.0.1 listener the census must see).
- **Refusal pushes are real ref moves** (stage 2, E1532S2-12): before every push that must be refused, the pushed commit differs from the territory branch, so the hook sees it.

## Stage

- Epic: E-1532 (The SSH transport, the host agent and git through the tunnel, under R-1530).
- Exact stage name: relaunch elsewhere.
- Items, in plan order: lane 1 T-1696 (adapters key transport and watch state by generation, with a no-signal handoff; prefactor for T-1614), T-1614 (a task stays on its host; relaunch elsewhere from the pushed branch), T-1698 (relaunch retry after a failed native admission); lane 2 T-1692 (sweep the earlier stage's tests' fixed wall-clock bounds); lane 3 T-1693 (push recovery after agent SIGKILL can find the producer ended with no completed receipt under load; regression of T-1609). The run reads membership, counts and state from `task plan show E-1532 --json` (E1532S6-00), never from a list written here. QA finding fixes added to this stage after writing are listed in the request; none at writing.
- Policy: full/after-stage.
- Scope: **full.** The stage's own behaviour end to end, and the epic's prior-stage user-visible surfaces as a regression pass (one representative per earlier stage; stages 1 and 5 had scope `none` and no brief, so their surfaces are represented by named test files).
  - T-1696 (landed on dev at `04a72e231`): adapter transport, forward, watch and in-flight state are keyed by launch generation, not by the stable sessionId; a new generation with the same sessionId and the same host-local URL never reuses an old generation's connection, forward or watch (OpenCode, Codex, Claude Code); `Sessions.releaseUnreachableGeneration` (optional adapter hook) drops an unreachable generation's transport, forward, watch and in-flight state with no native signal and no Host call to the lost host, and cannot affect a running new generation; SSH transport forward inventory is released locally and a reconnect restores only the replacement; legacy forward ids stay removable beside a generation-scoped forward; same-host resume and existing stop/settle/revoke behaviour are unchanged.
  - T-1614 (landed on dev at `36492afe7`): a relaunch of an item session whose host is up goes to that host and reuses its worktree; a `session.resume` frame naming another host is refused with a reason saying the task stays on its host. After the original host is down, gone or authentically rebooted, a `session.resume` frame with `relaunch: true` and `host: "f2"` (frame only, **no CLI host flag**) relaunches elsewhere: a short durable admission persists the exact source generation, destination and cause; the old generation is released through T-1696's hook outside the locks; the destination fetches the territory's pushed task tip and adds its worktree; the branch lease moves from f1 to f2 under the territory lock (f1's pushes refused, f2's accepted); the session starts a **fresh native conversation** whose first input carries the recorded brief and a relaunch note (both hosts, cause, territory SHA, "native conversation history and uncommitted edits were lost", directing it to item-topic `history`); the cland name, sessionId, role, claim, item, topic and subscriptions stay; the old native generation stays a retained named settlement obligation (tunnel loss does not prove exit); native publication commits the new process row, ready checkout owner, restart warning and intent completion in one transaction; a refused or failed destination admission leaves the destination `adding`, fenced, with the reason persisted and reported ("destination remains fenced"). `host: "local"` from a remote host is refused explicitly. A resume frame without `host` behaves as before.
  - T-1698 (landed as `e6a2a9f9166d90e868dbdde73248ac015d84f4dc` from branch head `6896f1410ffb6c2c103cf45eea69198572781b97`; strings read at `0245e5c46`, whose T-1698 code and tests are unchanged in the landing, **VERIFIED-on-branch**, re-checked by QA at the build): a known, settled native-admission failure with a captured checkout receipt marks the relaunch intent `retryable` and permits an explicit retry with `relaunch: true` and `host`, even after the original host has returned. The same destination validates the captured directory, Git file and Git-admin directory identities and the previous tip, fetches the current territory tip and resets the same checkout before reinstalling (C1). An onward destination takes the branch lease under the territory lock; the previous destination's full checkout record and ref-watch stay a named retained settlement obligation in the current owner (flat, never nested, across repeated onward moves); the reply notes and the durable session warning name that host, path and ref-watch; prune refuses while such obligations remain (C2). A no-host retry, a retry onto the source host, an unknown native outcome (`CLAND_HOST_OUTCOME_UNKNOWN`) and older records without a checkout receipt stay fenced. **Coordinator decision (8a85dc4d):** in `hub/test/host-relaunch.test.ts`'s `refused` case only the f2/f3 retry assertions were migrated (f2 now expects the repeated named native refusal `injected native admission refusal`, f3 the named unregistered-destination refusal `unknown host|not registered|unavailable`, and the counted native spawns rise by one); the no-host retry there stays `fenced`, the source-f1 retry stays `fenced` in `hub/test/host-relaunch-retry.test.ts`, and unknown outcomes stay fenced (source gate). No other test file from T-1614 is edited. No CLI flag or UI surface is added.
  - T-1692 (landed on dev at `18640b7b4`): test-only sweep of fixed wall-clock bounds in the earlier-stage test files; setup bounds derive from the shared budget (`testWaitMs`), behaviour bounds are named and kept; no assertion changes. Proven by E1532S6-01 (no changed assertion line), E1532S6-10 and the loaded repetitions in E1532S6-12.
  - T-1693 (landed on dev at `df397e2e7`): the push owner's recovery (`refPushOwner` in `hub/src/host/agent/ref-push.ts`) reads the producer's receipt after the native census, so a completed admission whose producer checkpointed and then exited (or whose birth changed) during the census settles instead of being fenced as `producer result missing; native cleanup retained`; missing, mismatched, incomplete and unreadable receipt cases keep their fences.
- Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here.

The run is meant to take about 3 to 3.5 hours: setup and E1532S6-00 to E1532S6-02 about 15 minutes (the typecheck included); the named files E1532S6-03 to E1532S6-11 about 70 minutes, one file at a time; repetitions E1532S6-12 about 30 minutes; the T-1698 and T-1693 file rows (E1532S6-20, E1532S6-24 to E1532S6-28) about 35 minutes; scratch rows E1532S6-13 to E1532S6-19, E1532S6-21 and E1532S6-22 about 40 minutes. Waits for cover-quiet admission or load are not product results.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what.

| criterion | proven by |
| --- | --- |
| T-1696 C1 (new generation, same sessionId and URL, never reuses connection/forward/watch, all three harnesses) | E1532S6-03 (`adapter-generation.test.ts`, the `opencode`, `codex` and `claude-code` expansions of `<harness> isolates the same id and endpoint while unreachable old cleanup drains`); E1532S6-08 (a different destination forward id after a real relaunch); E1532S6-19 (scratch forward sockets, informational) |
| T-1696 C2 (release sends no signal, no Host call, drops state, cannot affect the new generation, held old cleanup racing the new launch) | E1532S6-03 (`hub/test/adapter-generation.test.ts`, the same expansions; test `generation release joins admitted stop and permanently fences metadata and Host callbacks`; test `missing stopped-owner proof refuses release without touching a replacement carrier`); E1532S6-04 (`hub/test/adapter-generation-forward.test.ts`) |
| T-1696 C3 (same-host resume and stop/settle/revoke unchanged, no test edited) | E1532S6-01 (no edited preserved test file); E1532S6-05 (unedited `hub/test/session-resume.test.ts` and adapter files); regression rows E1532S6-14 to E1532S6-16 |
| T-1614 C1 (live host: same-host relaunch reuses worktree; other host refused with the stays-on-its-host reason) | E1532S6-06 (`host-relaunch-component.test.ts`); E1532S6-17 (scratch frame calls; BLOCKED, not FAIL, if the scratch hub cannot launch on a fake host) |
| T-1614 C2 (after `gone f1`, `host: "f2"` adds the worktree at the pushed tip; session runs there) | E1532S6-07 (`host-relaunch.test.ts`, outcome `running`); E1532S6-08 (`host-relaunch-native.test.ts`); E1532S6-18 (scratch, same fallback) |
| T-1614 C3 (lease moves: f1 pushes refused, f2 succeed) | E1532S6-07 and E1532S6-08 (the `not leased to this host` refusal and the f2 push); E1532S6-18 (the lease file and the hook through E1532S2-12's push shape) |
| T-1614 C4 (no `host` behaves as today; `hub/test/session-resume.test.ts` passes unedited) | E1532S6-05, E1532S6-06 (`resumed` on `f1`, cwd unchanged); E1532S6-17 (CLI `cland session resume worker --relaunch`) |
| T-1614 decisions (fresh conversation, brief plus relaunch note; same name, claim, topic, subscriptions; old generation retained; native publication atomic; failed admission left `adding`, fenced, reported; local target refused) | E1532S6-07 (`running`), E1532S6-08, E1532S6-09 (`host-relaunch-publication.test.ts`), E1532S6-06 (local refusal and receipt refusals), E1532S6-20 (the `refused` outcome). The retained old generation is not shown by `session list`, `hub status` or any JSON view: its pass condition is the test assertions on `retainedHostGenerations('f1')` (E1532S6-07, E1532S6-08, E1532S6-09); E1532S6-18 and E1532S6-19 record its scratch traces (hub.db, `cland host revoke` leftovers) as information only |
| T-1698 C1 (after a native-admission failure on f2 and a push that advances the tip, a retry onto f2 runs at the new tip with the same prepared checkout) | E1532S6-24 (the `f2` expansion of `retry native refusal onto <target> preserves prepared ownership`, repeated); E1532S6-20 (one run); E1532S6-26 (source and docs) |
| T-1698 C2 (after a native-admission failure on f2, a retry onto f3 runs on f3; f2's checkout and ref-watch reported as a retained obligation, no f2 state overwritten) | E1532S6-25 (the `f3` and `f4` expansions); E1532S6-20; E1532S6-26 |
| T-1698 decision (only the f2/f3 retry assertions of the `refused` case migrated; no-host, source-f1 and unknown outcomes stay fenced) | E1532S6-20 (the `refused` expansion of `host-relaunch.test.ts` and the retry file's no-host and `f1` fences); E1532S6-26 (the migration diff and the unknown-outcome source gate); E1532S6-01 |
| T-1692 C1/C2 (bounds classified, no behaviour change; listed files pass 5/5 under load) | E1532S6-01 (no changed assertion line in the sweep's test files, read-only), E1532S6-10 (the swept files, once each), E1532S6-12 (repetitions under this machine's load) |
| T-1693 C1 (the failing order named with a deterministic reproduction) | E1532S6-27 (`host-ref-watch-recovery.test.ts`, the `ended=true` and `ended=false` expansions of `producer completion during native observation is reread before settlement (ended=<bool>)`); E1532S6-01 (`src.mjs`: the receipt read after the census) |
| T-1693 C2 (host-push-on-ref-move under load, fences unchanged) | E1532S6-28 (local macOS repetitions only; the 10/10 heavy-load macOS and `docker run --init` Linux evidence is the item's, A-16984); E1532S6-10 |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1532 --json` lists in stage `relaunch elsewhere`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task with a branch still needs its landing receipt even if the branch has no commits; a task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**T-1614, T-1693 and T-1698 each need a landing**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `8e94398990e3391d835de4bdaf8a439a8b7011ae`): T-1696 landed as `04a72e2315a49c441c005d7aa74cef36d5bfde6f` (tracker commit `57d108144`), T-1692 as `18640b7b42fd1adf1328a531570fe3db79f55cab` (tracker `41908792b`), T-1614 as `36492afe738f120f0cf6dbd03a2154f756c95e93` and T-1693 as `df397e2e7fcc4a638f76d81dab30793e06031896` (tracker `8e9439899` for both). T-1698 landed as `e6a2a9f9166d90e868dbdde73248ac015d84f4dc` (batch 6cd591a9, A-17007/A-17008) from branch head `6896f1410ffb6c2c103cf45eea69198572781b97`. That head is `0245e5c46` plus a merge of dev `8e9439899` (T-1693) at `83a114382`, plus one allowance-only commit (f2 15 s to 18 s). Its first batch (16d0ab14, A-17000/A-17001) was red once on `hub/test/host-relaunch.test.ts` C2/C3 `running`, a territory-lock push refusal that did not reproduce in 30 runs (A-17002) and is filed as T-1702; that bug is out of scope here. After landing, the Coordinator committed the duration refresh `bffac59c3` (relaunch-retry allowances f2 22 s, f3 21 s, f4 30 s from the batch samples), which changes only `hub/test/durations.json`. E1532S6-00 compares the file lists and every difference is read before judging. The request names the tested dev SHA and any finding fixes added to the stage after writing.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No named file needs `web/dist`; E1532S6-02 runs the typecheck only.

**Where things live.** All scratch state is outside the project root: `$Q` (`/private/tmp/q36-…`, realpath, 23 bytes) holds the scratch project p1, the fake-host root `$Q/fh`, the territory clone `$Q/c1`, the scratch HOME and every directory `fixtureEnvironment` synthesizes (`$Q/home`, `$Q/config`, `$Q/opencode`, `$Q/state`, `$Q/cache`, `$Q/claude`, `$Q/codex`, `$Q/fake-*`, `$Q/executor-state`) and every helper file. `$T` is `TMPDIR` of every sealed command. The only paths under the repository are the ones QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1532/<run>/`. Nothing is written to `.cland/tasks/` of the live project; E1532S6-00 and E1532S6-23 print the root's non-tracker status, which must not change. (The scratch project p1 has its own tracker; that is the one the relaunch scratch rows create their item in.)

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed, through the seal. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its territory, its `hub.db` or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, the live `hub.json`, `~/.config/cland/sandbox-remote.secrets.toml` or any credential; never run a real `ssh`, `scp` or `sshd`; never read a real `known_hosts` or key. The scratch rows print the secret's mode and length only, never its value. The live hub is read only by QA's own shell for E1532S6-00's plan read and `quiet` (the live verify queue is read, nothing is submitted). Scratch reads of p1's own `hub.db` are read-only (`node:sqlite` with `readOnly: true`).

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree and the scratch roots, runs `quiet` and the plan read, runs the named test files through `nt` and `rp` (which seal each run with `$Q/env.sh`), runs the read-only source checks and records every check with `qa-record.sh`. **Every other command runs sealed** inside a subshell that sources `$Q/env.sh`. Never use `env -i`.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s6-$(date +%F)-1                        # unique run id for E-1532; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e1532s6-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1532/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts); NVD=$(dirname "$NV")   # the pinned Neovim; never a Homebrew nvim
T=/private/tmp/qa-e1532-s6-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q36-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
```

**The kit, by exact line range.** The unchanged helpers are taken from the stage-4 brief **as committed in the build** (`$W/qa/briefs/E-1532-stage-4.md`, blob `4ed467672750bf34179ed72549df863d1541eddb`, last changed by `6edcfe121`; the same blob on dev at `8e9439899`). The block below extracts them by line range and applies every rename; a different blob means the ranges moved, and the setup is BLOCKED (nothing else run). Taken, in that file:

- lines 133 to 140: the shell functions `holder`, `quiet`, `ld`, `nt` and `rp` (unchanged);
- lines 146 to 222 (the body of the "The seal" fence, section "Environment"): `seal.mjs`, `launch.mjs`, the `env.sh` generation with its helpers `cland`, `probe`, `hostcli`, `hp`, `hubstart`, `up`, `alive`, `run`, `has`, and the S0 prints. Renames: the root pattern `q34-` to `q36-` and the `TMPDIR` pattern `qa-e1532-s4-` to `qa-e1532-s6-` (both on line 156, the `seal.mjs` root guard);
- lines 228 to 279: `tap.mjs` (unchanged);
- lines 540 to 789: `probe.mjs` and its `node --check` line. Renames: `q34-` to `q36-` (line 548, the probe's root guard) and `secrets1532s4` to `secrets1532s6` (line 552, the redaction secrets file);
- **not taken:** lines 280 to 452 (stage 4's `expect.json`, replaced below), lines 456 to 535 (stage 4's `src.mjs`, replaced below: same engine, this stage's string list) and lines 794 to 903 (stage 4's check functions `s00` to `s16`: every function this brief's rows call is written out below, under this brief's names).

```sh
K="$W/qa/briefs/E-1532-stage-4.md"
echo "kit blob $(git -C "$W" rev-parse HEAD:qa/briefs/E-1532-stage-4.md) want 4ed467672750bf34179ed72549df863d1541eddb"
sed -n '133,140p' "$K" > "$Q/kit-shell.sh"
sed -n '146,222p' "$K" | sed -e 's/q34-/q36-/g' -e 's/qa-e1532-s4-/qa-e1532-s6-/g' > "$Q/kit-seal.sh"
sed -n '228,279p' "$K" > "$Q/kit-tap.sh"
sed -n '540,789p' "$K" | sed -e 's/q34-/q36-/g' -e 's/secrets1532s4/secrets1532s6/g' > "$Q/kit-probe.sh"
echo "kit renames left: $(cat "$Q/kit-shell.sh" "$Q/kit-seal.sh" "$Q/kit-tap.sh" "$Q/kit-probe.sh" | grep -c -E 'q34-|qa-e1532-s4-|secrets1532s4|E1532S4')"
echo "kit first lines: $(head -n 1 "$Q/kit-seal.sh" | cut -c1-28) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27) | $(head -n 1 "$Q/kit-probe.sh" | cut -c1-29)"
. "$Q/kit-shell.sh"; . "$Q/kit-seal.sh"; . "$Q/kit-tap.sh"; . "$Q/kit-probe.sh"
```

Expected: `kit blob` equal to `want`; `kit renames left: 0`; `kit first lines: cat > "$Q/seal.mjs" <<'JS' | cat > "$Q/tap.mjs" <<'JS' | cat > "$Q/probe.mjs" <<'JS'`; then the kit's own `launcher checked` and `probe checked` lines and its S0 prints (credential-prefix count, `CLAND_` names, sealed Neovim, TMPDIR, HOME, `setsid`, the three harness lines, the real-HOME `PATH` count, the byte counts). `launch.mjs hub` passes `CLAND_FAKE_HOSTS=f1,f2`, `CLAND_FAKE_HOST_ROOT`, `CLAND_SSH_BIN`, `CLAND_SCP_BIN`, the fake harness binaries (`CLAND_CODEX_BIN` among them) and `CLAND_TEST_SKIP_ORPHAN_SWEEP`. The fake-host control is `node $W/hub/test/fakes/fake-host.ts <create|kill-master|kill-agent|reboot|gone> <host>`; this brief calls it through `fh` below with the seal (VERIFIED, `hub/test/fakes/fake-host.ts:160` `hostControl`, `:184` `gone`): `gone` writes the `gone` marker in the host's directory (the host is unreachable until it is removed); `kill-master` makes the live master SIGKILL itself. The branch's own tests do `kill-master` first and then `gone` (`hub/test/host-relaunch.test.ts:97`–`:98`); the scratch rows do the same.

**Additions in stage 6.** `frame.mjs` is a sealed one-frame hub client (there is no CLI flag for a launch or resume host; `session.launch` and `session.resume` accept `host` as a frame field, `hub/src/adapters/requests.ts:4`, `:12`, `:47`, `:59`). `push.mjs` is stage 2's `launch.mjs push` mode (E1532S2-12's push shape, `qa/briefs/E-1532-stage-2.md` lines 178 to 180) on this kit's seal: a `git push` from the territory clone `$Q/c1` with `CLAND_PUSH_HOST` set as the git daemon sets it for that host.

```sh
cat > "$Q/frame.mjs" <<'JS'
// node "$QA_Q/frame.mjs" '<json frame without id>' [timeoutMs]    sealed, cwd = p1: one hub request over the project's socket; prints {"ok":..,"value|error":..}
// The secret is read from .cland/hub.json by askHubFrame and never printed. No session variables in the seal: the request is the human's.
import { readFileSync } from 'node:fs';
const { askHubFrame } = await import(`${process.env.QA_W}/shared/socket-client.ts`);
const d = { ...JSON.parse(readFileSync('.cland/hub.json', 'utf8')), root: process.cwd() };   // askHubFrame needs socket, secret and root
const frame = JSON.parse(process.argv[2]);
try { console.log(JSON.stringify({ ok: true, value: await askHubFrame(d, frame, Number(process.argv[3] ?? 60000)) })); }
catch (e) { console.log(JSON.stringify({ ok: false, error: String(e?.message ?? e) })); }
JS
cat > "$Q/push.mjs" <<'JS'
// node "$QA_Q/push.mjs" <host or ""> <git push args…>   sealed: git -C $QA_Q/c1 push origin …, with CLAND_PUSH_HOST as git daemon sets it (none for "")
import { spawn } from 'node:child_process';
const { seal } = await import(`${process.env.QA_Q}/seal.mjs`);
const [host, ...rest] = process.argv.slice(2);
const child = spawn('git', ['-C', `${process.env.QA_Q}/c1`, 'push', 'origin', ...rest], { env: seal(host ? { CLAND_PUSH_HOST: host } : {}), stdio: 'inherit' });
child.on('error', () => { process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
JS
node --check "$Q/frame.mjs" && echo "frame checked"; node --check "$Q/push.mjs" && echo "push checked"
cat >> "$Q/env.sh" <<'ENV'
# sj <js expression over v> [args…]: evaluates the expression on JSON from stdin; the arguments are the array a
sj() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const r=new Function("v","a","return ("+process.argv[1]+")")(v,process.argv.slice(2));console.log(typeof r==="string"?r:JSON.stringify(r))})' "$@"; }
# worker: the session named worker in `cland session list --json`, or null
worker() { cland session list --json | sj 'v.processes.find(p=>p.name==="worker")??null'; }
# hpush <label> <host or ""> <git push args…>: E1532S2-12's push shape from $QA_Q/c1; output kept in r.out/r.err for has
hpush() { l=$1; h=$2; shift 2; node "$QA_Q/push.mjs" "$h" "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; probe redact < "$QA_Q/r.err" | grep -E 'cland:|rejected|->' | sed 's/^/  err: /'; }
# fh <kill-master|kill-agent|gone|reboot> <host>: the build's fake-host control, with the fake-host root through the seal
fh() { node --input-type=module -e 'const [a,h]=process.argv.slice(1);const {seal}=await import(process.env.QA_Q+"/seal.mjs");const {hostControl}=await import(process.env.QA_W+"/hub/test/fakes/fake-host.ts");try{await hostControl(a,h,seal({CLAND_FAKE_HOSTS:"f1,f2",CLAND_FAKE_HOST_ROOT:process.env.QA_Q+"/fh"}));console.log("fake-host "+a+" "+h+": ok")}catch(e){console.log("fake-host "+a+" "+h+": "+e.message)}' "$1" "$2"; }
# ungone <host>: removes that fake host's gone marker (the tests' unlink of <host directory>/gone)
ungone() { node --input-type=module -e 'const {hostDirectory}=await import(process.env.QA_W+"/shared/fake-host-directory.ts");const fs=await import("node:fs");const p=hostDirectory(process.env.QA_Q+"/fh",process.argv[1])+"/gone";const was=fs.existsSync(p);if(was)fs.unlinkSync(p);console.log("gone marker "+process.argv[1]+": was "+was+", now "+fs.existsSync(p))' "$1"; }
# hdown <host>: polls `cland hub status` every 2 s, up to 60 s, until that host's line is no longer up
hdown() { local i l; for i in $(seq 1 30); do l=$(cland hub status 2> /dev/null | grep -E "^  $1  " | head -n 1); case "$l" in "  $1  up "*) sleep 2;; *) echo "$1 not up after $((i*2)) s: $(echo "$l" | cut -d'·' -f1)"; return 0;; esac; done; echo "$1 still up after 60 s"; return 1; }
# sk <label>: the hub-side per-session forward sockets (s-<24 hex>.sock, hostPaths) of f1 and f2 for p1 (cwd)
sk() { node --input-type=module -e 'const {hostPaths}=await import(process.env.QA_W+"/hub/src/host/records.ts");const fs=await import("node:fs");for(const h of ["f1","f2"]){const d=hostPaths(process.cwd(),h).socketDirectory;let n=[];try{n=fs.readdirSync(d).filter(x=>/^s-[0-9a-f]{24}\.sock$/.test(x)&&fs.lstatSync(d+"/"+x).isSocket())}catch{}console.log(JSON.stringify({label:process.argv[1],host:h,sessionForwardSockets:n.length,names:n}))}' "$1"; }
# retired: p1's harness_host_retirements rows (read only): host, pid, nativeClosure, status
retired() { node --input-type=module -e 'const {DatabaseSync}=await import("node:sqlite");const db=new DatabaseSync(".cland/hub.db",{readOnly:true});try{for(const r of db.prepare("select host,process_json from harness_host_retirements").all()){const p=JSON.parse(r.process_json);console.log(JSON.stringify({host:r.host,name:p.name,pid:p.pid,nativeClosure:p.nativeClosure??null,status:p.status}))}}finally{db.close()}'; }
ENV
```

The TAP expectations. `expect.json` lists, per file, every top-level name its source registers (literal titles and loop expansions, `exact`) or, for a file with earlier-stage cases, the names this stage needs (a subset). Lists were read at dev `8e9439899` and, for `host-relaunch-retry.test.ts`, at the T-1698 branch head `0245e5c46` (VERIFIED-on-branch). A list that differs from the tested build's source is re-derived from its loops before judging, and the difference recorded.

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/adapter-generation.test.ts": {"exact": true, "names": [
  "opencode isolates the same id and endpoint while unreachable old cleanup drains",
  "codex isolates the same id and endpoint while unreachable old cleanup drains",
  "claude-code isolates the same id and endpoint while unreachable old cleanup drains",
  "generation release joins admitted stop and permanently fences metadata and Host callbacks",
  "public wrappers surround routed operations and baseline fallback without recursion",
  "a fully stopped same-host fresh resume retires old aliases before its late release hook",
  "missing stopped-owner proof refuses release without touching a replacement carrier"]},
 "hub/test/adapter-generation-forward.test.ts": {"exact": true, "names": [
  "legacy session forward remains removable beside a generation-scoped forward",
  "Sessions drops unreachable forward inventory locally and reconnect restores only the replacement"]},
 "hub/test/host-relaunch-component.test.ts": {"exact": true, "names": [
  "C1 live host relaunch reuses placement and refuses a different requested host",
  "cross-host admission refuses missing generation receipt before destination effects",
  "cross-host admission refuses wrong-generation generation receipt before destination effects",
  "cross-host admission refuses not-released generation receipt before destination effects"]},
 "hub/test/host-relaunch.test.ts": {"exact": true, "names": [
  "C2/C3 admitted host relaunch running keeps durable native and checkout ownership",
  "C2/C3 admitted host relaunch refused keeps durable native and checkout ownership"]},
 "hub/test/host-relaunch-native.test.ts": {"exact": true, "names": [
  "C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input"]},
 "hub/test/host-relaunch-publication.test.ts": {"exact": true, "names": [
  "native publication commits row ready warning and completion atomically across failure and reopen"]},
 "hub/test/host-relaunch-retry.test.ts": {"exact": true, "names": [
  "retry native refusal onto f2 preserves prepared ownership",
  "retry native refusal onto f3 preserves prepared ownership",
  "retry native refusal onto f4 preserves prepared ownership"]},
 "hub/test/host-ref-watch-recovery.test.ts": {"exact": false, "names": [
  "producer completion during native observation is reread before settlement (ended=true)",
  "producer completion during native observation is reread before settlement (ended=false)"]},
 "hub/test/host-push-on-ref-move.test.ts": {"exact": false, "names": [
  "interrupted admitted native push survives agent SIGKILL and recovery publishes only the current head"]},
 "hub/test/launch-files.test.ts": {"exact": false, "names": [
  "rollback bounds a missing native exit receipt and fences undo and repeated stop until it resolves"]}
}
JSON
node --check "$Q/tap.mjs" && node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks. `src.mjs` is stage 4's engine (its lines 457 to 460 and 526 to 533) with this stage's string list; T-1698 lines name the branch head they were read at (`0245e5c46`) and are re-checked at the build.

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   exact-string counts at the build (no pattern syntax): ok or MISMATCH, label, file, count, expectation
import { readFileSync, existsSync } from 'node:fs';
const W = process.argv[2];
const C = [
  ['T-1614 stays on its host', 'hub/src/adapters/sessions.ts', 'task stays on its host while that host is available', '=2'],
  ['T-1614 local target refused', 'hub/src/adapters/sessions.ts', 'relaunch to local from a remote host is not supported yet; relaunch on a registered host', '=1'],
  ['T-1614 fenced failure', 'hub/src/adapters/sessions.ts', 'failed; destination remains fenced; reconciliation is required: ', '=1'],
  ['T-1614 loss note', 'hub/src/adapters/sessions.ts', 'native conversation history and uncommitted edits were lost', '=1'],
  ['T-1614 host is a frame field', 'hub/src/adapters/requests.ts', "| { type: 'session.resume'; id: string; session: string; relaunch?: boolean; fresh?: boolean; host?: string }", '=1'],
  ['T-1614 CLI resume sends no host', 'hub/src/cli/session.ts', "{ type: 'session.resume', session: name, relaunch: rest.includes('--relaunch'), fresh: rest.includes('--fresh') }", '=1'],
  ['lease refusal in the territory hook', 'hub/src/territory.ts', 'refuse "task branch $branch is not leased to this host"', '=1'],
  ['T-1696 release hook', 'hub/src/adapters/sessions.ts', 'releaseUnreachableGeneration', '>=1'],
  ['retained generation leftover reason', 'hub/src/adapters/sessions.ts', 'retained generation native closure is unknown; private files retained', '=1'],
  ['host revoke leftover line', 'hub/src/host/settle.ts', 'left generation ${row.generation} (${row.session}): ', '=1'],
  ['per-session forward socket name', 'hub/src/host/records.ts', "sessionSocket: (session: string) => join(socketDirectory, `s-${digest(session).slice(0, 24)}.sock`)", '=1'],
  ['fake hosts run the build CLI and spoke', 'hub/src/host/registry.ts', "...(fake ? {node:process.execPath,cli:join(installed,'hub/bin/cland.ts'),spoke:join(installed,'hub/bin/cland-spoke.ts')} : {})", '=1'],
  ['fake Codex input log', 'hub/test/fakes/codex/fake-codex.ts', 'inputs.jsonl', '=1'],
  ['host admission refusal', 'hub/src/hub/dispatch.ts', 'host frame requires its own role-holding session credential', '=1'],
  ['T-1693 receipt read after the census (df397e2e7)', 'hub/src/host/agent/ref-push.ts', '// ENOENT sampled while it was running cannot fence its completed result.', '=1'],
  ['T-1698 retryable intent (0245e5c46)', 'hub/src/host/relaunch-state.ts', 'retryable?: boolean;', '=1'],
  ['T-1698 retryable only after a settled native failure with a checkout (0245e5c46)', 'hub/src/adapters/sessions.ts', 'retryable:nativeEntered && !!intent.tree?.checkout && settledFailure', '=1'],
  ['T-1698 unknown outcome never settled (0245e5c46)', 'hub/src/adapters/sessions.ts', "(original as NodeJS.ErrnoException).code !== 'CLAND_HOST_OUTCOME_UNKNOWN'", '=1'],
  ['T-1698 retained note (0245e5c46)', 'hub/src/adapters/sessions.ts', 'retained with ref-watch for settlement: ', '=1'],
  ['T-1698 prune refusal (0245e5c46)', 'hub/src/host/task-worktrees.ts', 'retained host checkout/ref-watch obligations need settlement', '=1'],
  ['T-1698 documented (0245e5c46)', 'docs/agents/host-agent.md', 'Prune refuses while such obligations remain.', '=1'],
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

The check functions. Define them in QA's own shell (paste the block once). Rows on the scratch project call them as `( . "$Q/env.sh"; cd "$Q/p1" && <function> ) > "$EV/<id>.txt" 2>&1`; read the capture, then record it. Each prints a `PRE:` line first and then exactly the lines its row's expectation reads.

```sh
PRESERVED="hub/test/session-resume.test.ts hub/test/claude-code-sessions.test.ts hub/test/codex-adapter.test.ts hub/test/opencode-adapter.test.ts hub/test/claude-code-adapter.test.ts"
s00() {   # QA's own shell: build, the stage's plan facts, every landing; the T-1698 landing against its reviewed branch head
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  # .claude/settings.local.json is left out: a pre-existing harness-local file, not run output
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
  (cd "$R" && node hub/bin/cland.ts task plan show E-1532 --json) > "$EV/plan.json"
  node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const s of p.stages)console.log(JSON.stringify({name:s.name,state:s.state,qa:s.qa,members:s.items,merged:s.merged,total:s.total,statuses:s.statuses,verdict:s.verdict?{result:s.verdict.result,run:s.verdict.run,current:s.verdict.current}:null}))' "$EV/plan.json"
  for id in $(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(p.stages.find(s=>s.name==="relaunch elsewhere").items.join(" "))' "$EV/plan.json"); do
    echo "$id landings: $(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | tr '\n' ' ')"; done
  for spec in T-1698:0245e5c46a54e26faeee3fd720e583f439fbdf00:36492afe738f120f0cf6dbd03a2154f756c95e93; do   # id:reviewed head:its merge base; use the head the request names if it differs
    id=${spec%%:*}; rest=${spec#*:}; head=${rest%%:*}; base=${rest#*:}
    L=$(git -C "$R" log --first-parent --format=%H --grep "^Item: $id\$" "$S" | head -n 1)
    if [ -z "$L" ]; then echo "$id landing: none"; continue; fi
    git -C "$R" show --stat --format='%H%n%s%n%b' "$L" > "$EV/$id-landing.txt"
    git -C "$R" diff --name-only "$L^1" "$L" | sort > "$EV/$id-landing-files.txt"
    git -C "$R" diff --name-only "$base" "$head" | sort > "$EV/$id-branch-files.txt"
    echo "$id landing $L; only in the landing: $(comm -23 "$EV/$id-landing-files.txt" "$EV/$id-branch-files.txt" | tr '\n' ' '); only at the branch head: $(comm -13 "$EV/$id-landing-files.txt" "$EV/$id-branch-files.txt" | tr '\n' ' ')"
  done
}
s01() {   # QA's own shell, read-only in $W: what every landing touched; preserved files unedited; T-1692 assertion lines; exact source strings
  echo "PRE: HEAD $(git -C "$W" rev-parse HEAD)"
  for id in T-1696 T-1614 T-1698 T-1692 T-1693; do
    L=$(git -C "$W" log --first-parent --format=%H --grep "^Item: $id\$" HEAD | head -n 1)
    [ -n "$L" ] || { echo "$id landing: none"; continue; }
    echo "$id ($L) existing test files modified: $(git -C "$W" diff --diff-filter=M --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    git -C "$W" diff --diff-filter=M --numstat "$L^1" "$L" -- hub/test web/test nvim/test | sed "s|^|  $id added/deleted: |"
    echo "$id test files added: $(git -C "$W" diff --diff-filter=A --name-only "$L^1" "$L" -- hub/test web/test nvim/test | tr '\n' ' ')"
    echo "$id deleted or renamed paths: $(git -C "$W" diff --diff-filter=DR --name-only "$L^1" "$L" | tr '\n' ' ')"
    echo "$id package.json and lockfiles changed: $(git -C "$W" diff --name-only "$L^1" "$L" -- ':(glob)**/package.json' ':(glob)**/package-lock.json' | wc -l | tr -d ' ')"
    for f in $PRESERVED; do git -C "$W" diff --quiet "$L^1" "$L" -- "$f" || echo "  $id EDITED PRESERVED FILE $f"; done
  done
  L=$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1698$' HEAD | head -n 1)
  [ -n "$L" ] && for f in hub/test/host-relaunch-component.test.ts hub/test/host-relaunch-native.test.ts hub/test/host-relaunch-publication.test.ts; do git -C "$W" diff --quiet "$L^1" "$L" -- "$f" || echo "  T-1698 EDITED T-1614 FILE $f"; done
  L=$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1692$' HEAD | head -n 1)
  echo "T-1692 changed assertion lines: $(git -C "$W" diff -U0 "$L^1" "$L" -- hub/test ':!hub/test/durations.json' | grep -c -E '^[-+][[:space:]]*(assert\.|t\.assert\.|expect\()')"
  node "$Q/src.mjs" "$W"
}
s02() {   # sealed, in $W: the typecheck at the build
  echo "PRE: $(git -C "$QA_W" rev-parse HEAD) node $(node --version)"
  ( cd "$QA_W" && npm run typecheck > "$QA_EV/E1532S6-02-typecheck.log" 2>&1; echo "typecheck exit $?" )
  echo "dirty entries $(git -C "$QA_W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
}
s26() {   # QA's own shell, read-only in $W: T-1698's migration of host-relaunch.test.ts and the files it left alone
  L=$(git -C "$W" log --first-parent --format=%H --grep '^Item: T-1698$' HEAD | head -n 1); echo "PRE: T-1698 landing ${L:-none}"
  [ -n "$L" ] || return 1
  echo "host-relaunch.test.ts added/deleted: $(git -C "$W" diff --numstat "$L^1" "$L" -- hub/test/host-relaunch.test.ts | cut -f1,2 | tr '\t' ' ')"
  git -C "$W" diff -U0 "$L^1" "$L" -- hub/test/host-relaunch.test.ts | grep -E '^[-+][^-+]' | cut -c1-300
  echo "unedited by T-1698: $(for f in hub/test/session-resume.test.ts hub/test/host-relaunch-component.test.ts hub/test/host-relaunch-native.test.ts hub/test/host-relaunch-publication.test.ts; do git -C "$W" diff --quiet "$L^1" "$L" -- "$f" && printf '%s ' "$f"; done)"
  echo "test files added: $(git -C "$W" diff --diff-filter=A --name-only "$L^1" "$L" -- hub/test | tr '\n' ' ')"
  echo "tier line: $(grep -F '"hub/test/host-relaunch-retry.test.ts"' "$W/hub/test/tiers.json" | tr -d ' ')"
  echo "CLI files changed: $(git -C "$W" diff --name-only "$L^1" "$L" -- hub/src/cli | tr '\n' ' ')"
}
m13() {   # stages 2-4 regression base (stage 4's m11): p1 and the fake hosts f1 and f2: init, a different discovery planted on f2, hub start, agents, both up; f2's file replaced; no clone; host_worktrees empty; host-side TCP census
  echo "PRE: p1 entries $(ls -A | wc -l | tr -d ' '); fh entries $(ls -A "$QA_Q/fh" | wc -l | tr -d ' '); fakes $(ls "$QA_W/hub/test/fakes/claude-code/claude" "$QA_W/hub/test/fakes/codex/codex" "$QA_W/hub/test/fakes/opencode/opencode" "$QA_W/hub/test/fakes/fake-ssh.ts" "$QA_W/hub/test/fakes/fake-scp.ts" | wc -l | tr -d ' '); node $(node --version); credential-prefix names $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)'); CLAND_HOST_, CLAND_FAKE_, CLAND_SSH_ names $(env | cut -d= -f1 | grep -c -E '^CLAND_(HOST|FAKE|SSH|SCP)_'); setsid $(command -v setsid || echo none)"
  [ -z "$(command -v setsid)" ] || { echo "BLOCKED: a setsid binary on the sealed PATH would let the bootstrap start its own supervisor"; return 1; }
  ld || return 1
  git init -q -b dev && git config user.name 'QA One' && git commit -q --allow-empty -m init
  cland init . > "$QA_EV/E1532S6-13-init.txt" 2>&1; echo "init exit $?"
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
m14() {   # stage 2 smoke (the tunnel): status host lines; a scratch branch leased to f1 refuses f2's push and accepts f1's (E1532S2-12's push shape)
  echo "PRE: hub $(up); $(probe wait f1 5000); $(probe wait f2 5000)"
  run "hub status" cland hub status; echo "  lines: hosts $(has 'hosts: 2'); f1 up $(has '  f1  up since '); f2 up $(has '  f2  up since ')"
  node --input-type=module -e 'const {grantBranchLease}=await import(process.env.QA_W+"/hub/src/host/branch-leases.ts");await grantBranchLease(process.cwd(),"f1","t/qa-a");console.log("grant f1 t/qa-a ok")'
  echo "leases: $(tr '\t' ' ' < .cland/territory.git/cland-branch-leases | tr '\n' ';')"
  git clone -q .cland/territory.git "$QA_Q/c1" && git -C "$QA_Q/c1" switch -q -c t/qa-a && git -C "$QA_Q/c1" -c user.name=qa -c user.email=qa@example.invalid commit -q --allow-empty -m qa-a; echo "clone exit $?"
  hpush "t/qa-a by f2" f2 HEAD:refs/heads/t/qa-a; echo "  lines: $(has 'cland: host f2: task branch t/qa-a is not leased to this host')"
  hpush "t/qa-a by f1" f1 HEAD:refs/heads/t/qa-a
  echo "territory t/qa-a is the c1 commit: $([ "$(git --git-dir=.cland/territory.git rev-parse refs/heads/t/qa-a)" = "$(git -C "$QA_Q/c1" rev-parse HEAD)" ] && echo yes || echo no)"
}
m15() {   # stage 3 smoke: f1's forwarded hub.sock answers the host-side CLI; host admission refuses a frame without a role-holding session credential
  F1=$(probe home f1); D1=$F1/.cland-host/run/hub.json
  echo "PRE: hub $(up); $(probe wait f1 5000)"
  probe dfacts f1
  run "host CLI: hub status" hostcli "$D1" "$F1" hub status
  echo "  lines: running-remote $(has ' (remote)'); pid $(has '(pid '); host refusal $(has 'host frame requires its own role-holding session credential')"
}
m16() {   # stage 4 smoke (stage 4's m12): f1's agent SIGKILLed through the build's fake-host control; the shipped supervisor restarts it; f1 back up; its discovery untouched; f2 untouched
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
m17() {   # T-1614 C1/C4 on a live host: a Codex item session launched on f1 through the frame; another host and local refused; the CLI relaunch stays on f1
  F1=$(probe home f1)
  echo "PRE: hub $(up); $(probe wait f1 5000); $(probe wait f2 5000); fake codex $(ls "$QA_W/hub/test/fakes/codex/codex" | wc -l | tr -d ' ')"
  # the relaunch tests' role edit (host-relaunch-native.test.ts:63, host-relaunch-retry.test.ts:79): implementer writable_roots ["."]
  node --input-type=module -e 'const fs=await import("node:fs");const {setRoleKey}=await import(process.env.QA_W+"/hub/src/roles/editor.ts");const p=".cland/roles.toml";fs.writeFileSync(p,setRoleKey(fs.readFileSync(p,"utf8"),"implementer","launch","writable_roots",["."]));console.log("roles edited")'
  run "task create" cland task create "qa relaunch item" --kind task --size S
  ITEM=$(cland task list --json | sj 'v.items.find(i=>i.title==="qa relaunch item")?.id??"none"')
  run "artifact new" cland artifact new --kind prompt --title "qa recorded brief" --topic general --content "Continue the QA relaunch task."
  BRIEF=$(cland artifact list --json | sj '(v.artifacts??[]).find(a=>a.title==="qa recorded brief")?.id??"none"')
  echo "read back: item $ITEM brief $BRIEF"; echo "$ITEM" > "$QA_Q/item"
  [ "$ITEM" != none ] && [ "$BRIEF" != none ] || { echo "BLOCKED: the item or the brief was not read back"; return 1; }
  run "launch on f1" node "$QA_Q/frame.mjs" "{\"type\":\"session.launch\",\"name\":\"worker\",\"role\":\"implementer\",\"harness\":\"codex\",\"model\":\"gpt-fake-1\",\"host\":\"f1\",\"item\":\"$ITEM\",\"brief\":\"$BRIEF\"}" 120000
  echo "  launch ok $(has '"ok":true')"
  worker > "$QA_Q/w17a.json"
  echo "worker after launch: $(sj 'v&&{status:v.status,item:v.item,role:v.role,cwdOnF1:v.cwd.startsWith(a[0]+"/")}' "$F1" < "$QA_Q/w17a.json")"
  [ "$(sj 'v?.status==="running"&&v.cwd.startsWith(a[0]+"/")' "$F1" < "$QA_Q/w17a.json")" = true ] || { echo "BLOCKED: no running worker on f1; the scratch hub could not launch on a fake host"; return 1; }
  sj 'String(v.pid)' < "$QA_Q/w17a.json" | tee "$QA_Q/worker-f1-a.pid" >> "$QA_Q/pids"
  cland task view "$ITEM" --json | sj 'JSON.stringify({claim:(v.item??v).claim??null,topic:(v.item??v).topic??null})' > "$QA_Q/claim-17.json"; echo "claim and topic: $(cat "$QA_Q/claim-17.json")"
  run "(a) resume host f2 while f1 is up" node "$QA_Q/frame.mjs" '{"type":"session.resume","session":"worker","relaunch":true,"host":"f2"}' 60000
  echo "  lines: ok-false $(has '"ok":false'); stays on its host $(has 'task stays on its host while that host is available')"
  run "(b) resume host local" node "$QA_Q/frame.mjs" '{"type":"session.resume","session":"worker","relaunch":true,"host":"local"}' 60000
  echo "  lines: ok-false $(has '"ok":false'); local refused $(has 'relaunch to local from a remote host is not supported yet; relaunch on a registered host')"
  worker > "$QA_Q/w17b.json"
  echo "after (a) and (b): $(sj '({status:v.status,samePid:String(v.pid)===a[0],sameCwd:v.cwd===a[1]})' "$(cat "$QA_Q/worker-f1-a.pid")" "$(sj 'v.cwd' < "$QA_Q/w17a.json")" < "$QA_Q/w17b.json")"
  run "(c) CLI relaunch, no host" cland session resume worker --relaunch
  worker > "$QA_Q/w17c.json"
  echo "after (c): $(sj '({status:v.status,sameSessionId:v.sessionId===a[0],sameCwd:v.cwd===a[1],cwdOnF1:v.cwd.startsWith(a[2]+"/")})' "$(sj 'v.sessionId' < "$QA_Q/w17a.json")" "$(sj 'v.cwd' < "$QA_Q/w17a.json")" "$F1" < "$QA_Q/w17c.json")"
  sj 'String(v.pid)' < "$QA_Q/w17c.json" | tee "$QA_Q/worker-f1.pid" >> "$QA_Q/pids"
}
m18() {   # T-1614 C2/C3 and decisions on the scratch hub: a pushed commit on f1, f1 lost, the frame relaunches on f2; same session, fresh native, lease moved
  ITEM=$(cat "$QA_Q/item"); F1=$(probe home f1); F2=$(probe home f2); OLD=$(cat "$QA_Q/worker-f1.pid")
  worker > "$QA_Q/w18a.json"; CWD1=$(sj 'v.cwd' < "$QA_Q/w18a.json")
  echo "PRE: hub $(up); worker $(sj 'v.status' < "$QA_Q/w18a.json") on f1 $(sj 'v.cwd.startsWith(a[0]+"/")' "$F1" < "$QA_Q/w18a.json"); pid is the recorded f1 generation $(sj 'String(v.pid)===a[0]' "$OLD" < "$QA_Q/w18a.json")"
  BR=$(awk -F '\t' '$1=="f1" && $2 !~ /^t\/qa-/ {print $2}' .cland/territory.git/cland-branch-leases | head -n 1); echo "item branch leased to f1: ${BR:-none}"; echo "$BR" > "$QA_Q/branch"
  [ -n "$BR" ] || { echo "BLOCKED: no f1 lease for the item branch"; return 1; }
  git -C "$CWD1" -c user.name=qa -c user.email=qa@example.invalid commit -q --allow-empty -m 'qa pushed tip'; LOCAL=$(git -C "$CWD1" rev-parse HEAD)
  for i in $(seq 1 30); do [ "$(git --git-dir=.cland/territory.git rev-parse "refs/heads/$BR" 2> /dev/null)" = "$LOCAL" ] && break; sleep 1; done
  TIP=$(git --git-dir=.cland/territory.git rev-parse "refs/heads/$BR"); echo "$TIP" > "$QA_Q/tip"
  echo "pushed commit reached the territory: $([ "$TIP" = "$LOCAL" ] && echo yes || echo no) (waited up to 30 s)"
  fh kill-master f1; fh gone f1; hdown f1
  run "relaunch on f2" node "$QA_Q/frame.mjs" '{"type":"session.resume","session":"worker","relaunch":true,"host":"f2"}' 90000
  echo "  lines: ok $(has '"ok":true'); found $(has '"found":true'); relaunch note $(has 'relaunched on f2 from f1'); loss note $(has 'native conversation history and uncommitted edits were lost')"
  worker > "$QA_Q/w18b.json"; CWD2=$(sj 'v.cwd' < "$QA_Q/w18b.json")
  echo "after: $(sj '({status:v.status,sameSessionId:v.sessionId===a[0],newHarnessSessionId:v.harnessSessionId!==a[1],cwdOnF2:v.cwd.startsWith(a[2]+"/"),sameItem:v.item===a[3],role:v.role,warningNative:/native conversation history/.test(v.warning??"")})' "$(sj 'v.sessionId' < "$QA_Q/w18a.json")" "$(sj 'String(v.harnessSessionId)' < "$QA_Q/w18a.json")" "$F2" "$ITEM" < "$QA_Q/w18b.json")"
  sj 'String(v.pid)' < "$QA_Q/w18b.json" | tee "$QA_Q/worker-f2.pid" >> "$QA_Q/pids"
  echo "f2 worktree HEAD is the territory tip: $([ "$(git -C "$CWD2" rev-parse HEAD)" = "$TIP" ] && echo yes || echo no)"
  echo "claim and topic unchanged: $([ "$(cland task view "$ITEM" --json | sj 'JSON.stringify({claim:(v.item??v).claim??null,topic:(v.item??v).topic??null})')" = "$(cat "$QA_Q/claim-17.json")" ] && echo yes || echo no)"
  echo "leases: $(tr '\t' ' ' < .cland/territory.git/cland-branch-leases | tr '\n' ';')"
  echo "first input (informational): $(node -e 'const fs=require("fs");let t="";try{t=fs.readFileSync(process.argv[1],"utf8")}catch{}console.log(JSON.stringify({file:t.length>0,relaunched:t.includes("relaunched on f2 from f1"),loss:t.includes("native conversation history and uncommitted edits were lost"),tip:t.includes(process.argv[2]),brief:t.includes("Continue the QA relaunch task.")}))' "$QA_Q/fake-codex/log/$(cat "$QA_Q/worker-f2.pid").inputs.jsonl" "$TIP")"
  echo "retained generations (informational, hub.db read only):"; retired | sed 's/^/  /'
  git -C "$QA_Q/c1" fetch -q origin && git -C "$QA_Q/c1" switch -q -C qa-relaunch "origin/$BR" && git -C "$QA_Q/c1" -c user.name=qa -c user.email=qa@example.invalid commit -q --allow-empty -m 'qa after relaunch'; echo "c1 commit exit $?"
  echo "PRE refusal push: c1 HEAD differs from the territory branch: $([ "$(git -C "$QA_Q/c1" rev-parse HEAD)" != "$(git --git-dir=.cland/territory.git rev-parse "refs/heads/$BR")" ] && echo yes || echo no)"
  hpush "item branch by f1 after the move" f1 "HEAD:refs/heads/$BR"; echo "  lines: $(has "cland: host f1: task branch $BR is not leased to this host")"
  hpush "item branch by f2 after the move" f2 "HEAD:refs/heads/$BR"
  echo "territory branch is the c1 commit: $([ "$(git --git-dir=.cland/territory.git rev-parse "refs/heads/$BR")" = "$(git -C "$QA_Q/c1" rev-parse HEAD)" ] && echo yes || echo no)"
}
m19() {   # after the move (informational for T-1696 and the retained generation): forward sockets; f1 restored; the session stays on f2; TCP census; host revoke f1 leftovers
  F2=$(probe home f2)
  echo "PRE: hub $(up); worker running on f2 $(worker | sj 'v?.status==="running"&&v.cwd.startsWith(a[0]+"/")' "$F2")"
  sk before-restore
  ungone f1; probe wait f1 120000
  sk after-restore
  worker > "$QA_Q/w19.json"
  echo "worker after f1 returned: $(sj '({status:v.status,cwdOnF2:v.cwd.startsWith(a[0]+"/"),samePid:String(v.pid)===a[1]})' "$F2" "$(cat "$QA_Q/worker-f2.pid")" < "$QA_Q/w19.json")"
  probe tcp
  run "host revoke f1" cland host revoke f1
  echo "  lines: revoked $(has 'revoked host f1'); worker leftover $(has '(worker): '); retained unknown $(has 'retained generation native closure is unknown; private files retained')"
  run "host revoke f1 again" cland host revoke f1
}
m21() {   # the secret scan and the publication scanner, each with its positive control (stage 4's m14 on this run's secrets file)
  echo "PRE: kinds $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).map(k=>k.kind).join(" "))' "$QA_Q/secrets1532s6.json")"
  probe scan
}
m22() {   # cleanup census (stage 4's m15 plus the workers): worker stopped through cland, any fake Codex worker generation ended by its recorded pid, hub stopped, supervisors and agents ended, nothing names $Q, the alias or this build's fakes
  A=$(cat "$QA_Q/alias")
  run "session stop worker" cland session stop worker
  for f in worker-f1-a worker-f1 worker-f2; do [ -f "$QA_Q/$f.pid" ] || continue; p=$(cat "$QA_Q/$f.pid"); c=$(ps -o command= -p "$p" 2> /dev/null); case "$c" in *"$QA_W/hub/test/fakes/codex/"*) kill -TERM "$p"; for n in $(seq 1 40); do kill -0 "$p" 2> /dev/null || break; sleep 0.25; done; echo "$f pid $p was a live fake codex; after TERM: $(alive "$p")";; *) echo "$f pid $p: no fake codex process ($(alive "$p"))";; esac; done
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for id in f1 f2; do for p in $(cat "$QA_Q/sv-$id.pid") $(cat "$QA_Q/agent-$id.pid"); do kill -TERM "$p" 2> /dev/null; for n in $(seq 1 40); do kill -0 "$p" 2> /dev/null || break; sleep 0.25; done; echo "$id pid $p after TERM: $(alive "$p")"; done; done
  sleep 2; while read -r p; do [ -n "$p" ] && kill -0 "$p" 2> /dev/null && echo "alive $p $(ps -o command= -p "$p" | cut -c1-120)"; done < "$QA_Q/pids"
  echo "processes naming the scratch root, the alias, this build's fake ssh or fake codex: $(probe census "$QA_Q" "$A" "$QA_W/hub/test/fakes/fake-ssh.ts" "$QA_W/hub/test/fakes/codex/")"
  echo "host socket directories outside p1: $(ls -d "$TMPDIR"/cland-h-* /tmp/cland-h-* 2> /dev/null | wc -l | tr -d ' ')"
  probe unalias
}
s23() {   # QA's own shell: the build after every row (stage 4's s16)
  echo "HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) want $S"
  echo "dirty entries $(git -C "$W" status --porcelain | grep -v -x '?? node_modules' | wc -l | tr -d ' ')"
  echo "root non-tracker status entries $(git -C "$R" status --porcelain | grep -v -E ' \.cland/tasks/|^\?\? \.claude/settings\.local\.json$' | wc -l | tr -d ' ')"
  echo "T leftovers other than node-compile-cache $(ls -A "$T" | grep -v -x 'node-compile-cache' | wc -l | tr -d ' ')"
}
```

Record the setup as check `S0` with `qa-record.sh note`, its capture in `$EV/S0-env.txt`, exactly as stage 4's line 905 describes (the same lines and the same BLOCKED rules), with stage 4's scratch rows E1532S4-11 to E1532S4-15 read as this brief's E1532S6-13 to E1532S6-22, plus: `kit blob` equal to its `want`, `kit renames left: 0`, the `kit first lines` line as above, `frame checked`, `push checked`, `expect checked`, `src checked`. `Q bytes` is 23, `T bytes` equals the suite root's 61.

Cleanup after the evidence is recorded and E1532S6-22 removed the alias: print `$Q` and check it begins with `/private/tmp/q36-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1532-s6-` and holds nothing but `node-compile-cache`, and remove it by that literal path. A `cland-h-*` directory E1532S6-22 listed is removed by its literal path only when its name matches `hostPaths` for `$Q/p1`. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The secrets in `$Q/secrets1532s6.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/run/hosts/*/secret` and the fake hosts' `hub.json` and `secret` are never printed or posted.

## Cases

none. No headless-grid case covers this stage: it has no Neovim or web change, and the relaunch host is not shown in any grid. T-1698 adds no CLI or UI surface (its landing touches no `hub/src/cli` file: E1532S6-26). Every check below is a manual check recorded with `qa-record.sh note`.

### Web cases (when in scope)

none. The stage changes no web surface; no browser runs.

## Manual checks

Run in table order, which is the run order: the read-only and file rows (E1532S6-00 to E1532S6-12, then E1532S6-20 and E1532S6-24 to E1532S6-28), then the scratch rows (E1532S6-13 to E1532S6-19, E1532S6-21, E1532S6-22), then E1532S6-23. File rows run from `$W` through `nt` or `rp`: cover-quiet admission before each row, one-minute load at or below 10 and free disk space printed before each file, `TMPDIR=$T`. Targeted files take no suite lease; they never run in parallel with each other or with the scratch rows. Scratch rows depend on the state the rows before them leave, in that order. Record each row with `sh .agents/skills/qa/qa-record.sh note E-1532 "$RUN" <id> <surface> "<command run>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <captures…>` from `$W`, putting the capture in `$EV/<id>.txt` (or the named log and its `.check.txt`) first. "Clean" for a file row means: every file run prints `CLEAN` in `$EV/<id>.check.txt` (exit 0; `# fail`, `# cancelled`, `# skipped`, `# todo` all 0; `# pass` equal to `# tests`; no `not ok` at any depth; no SKIP or TODO directive; no `EINVAL`; not a bare per-file wrapper; every name `expect.json` lists for that file passing, and for an `exact` file the plan equal to the list and no unlisted name). Nothing here is platform-gated on macOS.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1532S6-00 | hub-api | QA | `s00 > "$EV/E1532S6-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA are the same 40 hex; `dirty entries 0`; the root's non-tracker count is recorded (E1532S6-23 compares). `$EV/plan.json` saved; the stage line `relaunch elsewhere` shows `qa` `{"scope":"full","when":"after-stage"}`, `members` holding T-1696, T-1614, T-1698, T-1692 and T-1693 plus any finding fixes the request names, `merged` equal to `total`, and `state` not `closed`; the stage lines `foundations`, `the tunnel`, `the ssh Host and the remote spoke`, `harnesses and git on hosts` and `push, attach and survival` are `closed`. Each member prints exactly one landing SHA (see Build). `T-1698 landing` names a commit (not `none`); its `only in the landing` and `only at the branch head` lists are read before judging: a merge with dev's T-1693 files, tracker files or `hub/test/durations.json` is expected, any other difference is read against the item. Else BLOCKED, nothing else run |
| E1532S6-01 | hub-api | QA | `s01 > "$EV/E1532S6-01.txt" 2>&1` (QA's own shell, read-only) | `existing test files modified` per landing, against these sets (VERIFIED at dev `8e9439899` for the landed four, at `0245e5c46` for T-1698): T-1696 `hub/test/durations.json hub/test/tiers.json` (`23 1`, `2 0`), added `hub/test/adapter-generation-forward.test.ts hub/test/adapter-generation.test.ts`; T-1614 `hub/test/durations.json hub/test/ssh-host-fixture.ts hub/test/tiers.json` (`21 0`, `1 2`, `4 0`; the fixture's `sshHostFixture` first parameter loosened from `TestContext` to `{ after(cleanup) }`, no assertion change), added the four `hub/test/host-relaunch*.test.ts` files; T-1698 `hub/test/durations.json hub/test/host-relaunch.test.ts hub/test/tiers.json` (`hub/test/host-relaunch.test.ts` `2 2`, the migration E1532S6-26 reads; `tiers.json` `1 0`), added `hub/test/host-relaunch-retry.test.ts`, and no `T-1698 EDITED T-1614 FILE` line; T-1692 only its swept files and `hub/test/durations.json` (at writing `claude-capture-concurrency`, `claude-code-remote`, `claude-stop`, `codex-host`, `host-attach-routing`, `host-attach`, `host-flush-native`, `host-push-on-ref-move`, `host-reboot-controller`, `host-reboot-native`, `host-reboot`, `host-revoke-native`, `host-revoke`, `host-survival-native`, `host-survival`, `launch-files`, `opencode-host`), none added, and `T-1692 changed assertion lines: 0`; T-1693 `hub/test/host-ref-watch-recovery.test.ts` (`17 0`: additions only), none added. `deleted or renamed paths` empty and `package.json and lockfiles changed: 0` for every landing. **No `EDITED PRESERVED FILE` line** (T-1696 C3, T-1614 C4). Every `src.mjs` line reads `ok`; a `MISMATCH` is read at the build before judging (a renamed string is followed to its new text). Any other edited existing test file is read against its item and reported, not silently passed |
| E1532S6-02 | hub-api | QA | `( . "$Q/env.sh"; s02 ) > "$EV/E1532S6-02.txt" 2>&1` | PRE shows Node 24. `typecheck exit 0` (the whole workspace at the integrated build, every landing included), `dirty entries 0` |
| E1532S6-03 | hub-api | QA | `nt E1532S6-03 hub/test/adapter-generation.test.ts` | `CLEAN` with the exact `expect.json` list (T-1696 C1, C2; VERIFIED at dev `8e9439899`): the `opencode`, `codex` and `claude-code` expansions of `<harness> isolates the same id and endpoint while unreachable old cleanup drains`, test `generation release joins admitted stop and permanently fences metadata and Host callbacks`, test `public wrappers surround routed operations and baseline fallback without recursion`, test `a fully stopped same-host fresh resume retires old aliases before its late release hook`, test `missing stopped-owner proof refuses release without touching a replacement carrier` |
| E1532S6-04 | hub-api | QA | `nt E1532S6-04 hub/test/adapter-generation-forward.test.ts` | `CLEAN` (T-1696 C1, C2, forward inventory). Tests: `legacy session forward remains removable beside a generation-scoped forward`, `Sessions drops unreachable forward inventory locally and reconnect restores only the replacement` |
| E1532S6-05 | hub-api | QA | `nt E1532S6-05 hub/test/session-resume.test.ts hub/test/claude-code-sessions.test.ts hub/test/claude-code-adapter.test.ts hub/test/codex-adapter.test.ts hub/test/codex-native.test.ts hub/test/opencode-adapter.test.ts hub/test/opencode-native.test.ts hub/test/launch-settlement.test.ts hub/test/host-stop-observation.test.ts` | Every run `CLEAN` (the unedited preservation set: T-1696 C3, T-1614 C4). If a listed file no longer exists at the build, the missing name is reported, not silently dropped |
| E1532S6-06 | hub-api | QA | `nt E1532S6-06 hub/test/host-relaunch-component.test.ts` | `CLEAN` with the exact list (T-1614 C1, C4; VERIFIED at `36492afe7`): test `C1 live host relaunch reuses placement and refuses a different requested host`, and the `missing`, `wrong-generation` and `not-released` expansions of `cross-host admission refuses <release> generation receipt before destination effects`. The test asserts: a `host: "f2"` resume of a session on f1 is refused with an error matching `task stays on its host`; `host: "local"` refused matching `relaunch to local from a remote host is not supported yet` (full source text continues `; relaunch on a registered host`, `sessions.ts:1752`); `host: "f1"` resumes on f1 with the original cwd; no resume reaches the adapter for the refused ones |
| E1532S6-07 | hub-api | QA | `nt E1532S6-07 hub/test/host-relaunch.test.ts` | `CLEAN` with both expansions (T-1614 C2, C3 and decisions; the `refused` expansion is judged in E1532S6-20). Outcome `running` (test lines `:110`–`:124` at dev): after `kill-master` and `gone` on f1, `session.resume` `{relaunch:true, host:'f2'}` succeeds; the worker's cwd is on f2 at the territory tip; same sessionId, role and item; new `harnessSessionId`; host `f2`, status `running`; the second spawn's brief matches `Continue the task.`, `relaunched on f2 from f1`, `native conversation history and uncommitted edits were lost` and contains the tip SHA, with no `resumeConversation`; the process warning (and `session.list`'s) matches `native conversation history`; claim, topic and subscriptions unchanged; intent meta cleared and the f2 worktree `ready`; the old f1 generation is in `retainedHostGenerations('f1')` with `nativeClosure` `unknown` (`:116`); an f1 push of the branch is refused matching `not leased to this host` and an f2 push is accepted into the territory |
| E1532S6-08 | hub-api | QA | `nt E1532S6-08 hub/test/host-relaunch-native.test.ts` | `CLEAN` (T-1614 C2, C3 with the production `CodexAdapter`, the shipped fake executable/app-server/spoke, two fake SSH carriers in one project/transport registry). Test `C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input`. It asserts a new native pid/birth, the resolved artifact brief plus loss note consumed as first input (the fake's `log/<pid>.inputs.jsonl`), the old generation retained with `nativeClosure` `unknown` (`:83`), the old scoped forward endpoint absent after the source carrier returns and a different destination forward id (T-1696 seen through T-1614), the source push refused and the destination push accepted |
| E1532S6-09 | hub-api | QA | `nt E1532S6-09 hub/test/host-relaunch-publication.test.ts hub/test/host-lease-lock.test.ts hub/test/territory-task-branch.test.ts hub/test/host-clone-integration.test.ts` | `CLEAN` (T-1614 atomic native publication: test `native publication commits row ready warning and completion atomically across failure and reopen`, including the reopened `retainedHostGenerations('f1')` `unknown` closure at `:38`; the lease lock and the host-clone file from stage 4 still green with the lease transfer path) |
| E1532S6-10 | hub-api | QA | `nt E1532S6-10 hub/test/launch-files.test.ts hub/test/claude-stop.test.ts hub/test/claude-code-remote.test.ts hub/test/host-revoke.test.ts hub/test/host-survival.test.ts hub/test/host-reboot.test.ts hub/test/host-attach-routing.test.ts hub/test/host-push-on-ref-move.test.ts` | Every run `CLEAN` (T-1692: swept files at the build, once each; the list is a subset of T-1692's landing, E1532S6-01, and the list-versus-landing difference is recorded). `launch-files.test.ts` includes test `rollback bounds a missing native exit receipt and fences undo and repeated stop until it resolves` (the case that went red at `{timeout:1000}`); `host-push-on-ref-move.test.ts` includes the T-1693 target case (E1532S6-28) |
| E1532S6-11 | hub-api | QA | `nt E1532S6-11 hub/test/suite-tiers.test.ts hub/test/build-guard-tiers.test.ts hub/test/test-docs.test.ts hub/test/cli-help.test.ts hub/test/cli-usage-compatibility.test.ts` | `CLEAN`: every new test file (the T-1696, T-1614 and T-1698 files) is in `tiers.json` with a guide in `docs/agents/tests/` (links resolve); CLI usage is unchanged by a stage that adds no CLI flag (`cland session resume <name> [--relaunch \| --fresh]` still has no host flag; a new `--host` flag in the help would be a documented contract change and is reported as a finding, not a pass) |
| E1532S6-12 | hub-api | QA | `: > "$EV/E1532S6-12.log"; rp E1532S6-12 hub/test/adapter-generation.test.ts 3 && rp E1532S6-12 hub/test/adapter-generation-forward.test.ts 3 && rp E1532S6-12 hub/test/host-relaunch.test.ts 3 && rp E1532S6-12 hub/test/host-relaunch-native.test.ts 3 && rp E1532S6-12 hub/test/launch-files.test.ts 5 && rp E1532S6-12 hub/test/claude-code-remote.test.ts 3; node "$Q/tap.mjs" check "$EV/E1532S6-12.log" "$Q/expect.json" > "$EV/E1532S6-12.check.txt"` (QA's own shell) | The timing-sensitive new and swept files under this machine's own load: every run line `CLEAN`, the `ok` count identical on each repetition of a file. Measured wall times and the load line before each run are recorded, never projected. This is macOS only; the items' Linux `docker run --init` evidence is theirs, not this run's. Timing allowances are not asserted here |
| E1532S6-20 | hub-api | QA | `nt E1532S6-20 hub/test/host-relaunch.test.ts hub/test/host-relaunch-retry.test.ts` | Every run `CLEAN` with the exact lists. **Failed native admission leaves the destination fenced (T-1614 decision) and the T-1698 migration**, read at the build in `hub/test/host-relaunch.test.ts`'s `refused` expansion (VERIFIED-on-branch `0245e5c46`, lines `:100`–`:108`): the relaunch error matches `failed; destination remains fenced.*injected native admission refusal`; the worker stays on f1 in the table; the f2 owner is `adding`; the intent is `failed` with the injected reason; then the retry loop: no host refuses matching `fenced`; `f2` refuses matching `injected native admission refusal` (the native admission is attempted again: migrated from `fenced` by Coordinator decision 8a85dc4d); `f3` refuses matching `unknown host\|not registered\|unavailable` (f3 is not registered in that file: migrated from `fenced`); spawns `3` (was `2`); the f2 owner unchanged. In `hub/test/host-relaunch-retry.test.ts` (every expansion, `:130`–`:132`): after the source f1 has returned `up`, a no-host retry and an `f1` retry both refuse matching `fenced`. Unknown native outcomes stay fenced by the source gate (`src.mjs` `T-1698 unknown outcome never settled`, E1532S6-01); no named test injects one. There is no scratch trigger for a failed native admission (no CLI flag, environment switch or fake-host control makes the destination's native spawn refuse), so this row is the proof; no scratch row stands in for it |
| E1532S6-24 | hub-api | QA | `: > "$EV/E1532S6-24.log"; rp E1532S6-24 hub/test/host-relaunch-retry.test.ts 3; node "$Q/tap.mjs" check "$EV/E1532S6-24.log" "$Q/expect.json" > "$EV/E1532S6-24.check.txt"` (QA's own shell) | Every run line `CLEAN` with the exact list (the `f2`, `f3` and `f4` expansions of `retry native refusal onto <target> preserves prepared ownership`). **T-1698 C1**, the `f2` expansion, read at the build (VERIFIED-on-branch `0245e5c46`, `:101`–`:170`): after f1 is lost (`kill-master`, `gone`) the first f2 relaunch fails matching `injected native admission refusal` and the intent records `retryable` true; a pushed territory tip advances (`commit-tree` plus `push` from the host clone) without touching the fenced checkout; altering the captured `directory` or `gitDirectoryBirth` inode makes a reuse-only `worktreeAdd` refuse matching `checkout.*changed\|checkout.*replaced\|checkout.*incomplete` with HEAD unchanged; f1 returns `up` before the retry; the explicit `{relaunch:true, host:'f2'}` retry succeeds with `found` true and the table host `f2`, the new worker's readiness receipt is written in the same prepared path, HEAD equals the advanced tip, the sessionId is unchanged, and the checkout directory identity, Git-admin path and Git-admin directory identity equal the captured ones; the intent meta is cleared and the owner `ready` |
| E1532S6-25 | hub-api | QA | `node "$Q/tap.mjs" names "$EV/E1532S6-24.log" > "$EV/E1532S6-25.txt"` (QA's own shell; reads E1532S6-24's log) | The `f3` and `f4` expansions are listed `ok` in every repetition of E1532S6-24 (their `CLEAN` lines there). **T-1698 C2**, the `f3` expansion, read at the build (VERIFIED-on-branch `0245e5c46`, `:156`–`:168`): the retry onto f3 runs the session on f3 at the original tip; f2's checkout directory identity and HEAD unchanged; the current owner's first `retained` entry deep-equals the full f2 record with `refWatch` true; f2's persisted `ref-watches.json` row for that checkout is unchanged; the session warning matches `f2.*retained.*ref-watch` (the reply note `<host> checkout <path> retained with ref-watch for settlement: <reason>`); a push from the f2 checkout is refused matching `not leased to this host`. The `f4` expansion (`:135`–`:140`, `:161`): f2 and then f3 refuse natively, f4 runs; the owner's `retained` trees are exactly the f2 record and the flat f3 record (no nested `retained`), f3's checkout HEAD, directory identity and ref-watch file unchanged |
| E1532S6-26 | hub-api | QA | `s26 > "$EV/E1532S6-26.txt" 2>&1` (QA's own shell, read-only) | PRE names the T-1698 landing. `host-relaunch.test.ts added/deleted: 2 2`, and the printed lines are exactly the migrated retry loop (`for(const host of [undefined,'f2','f3'])` with the `f2` `injected native admission refusal`, `f3` `unknown host\|not registered\|unavailable`, else `fenced` matches) and `assert.equal(spawns.length,3)`, each replacing its T-1614 line (the blanket `fenced` loop and `spawns.length,2`): Coordinator decision 8a85dc4d, recorded in the `host-relaunch` test guide under `docs/agents/tests/`. `unedited by T-1698` lists `hub/test/session-resume.test.ts`, `hub/test/host-relaunch-component.test.ts`, `hub/test/host-relaunch-native.test.ts` and `hub/test/host-relaunch-publication.test.ts`. `test files added: hub/test/host-relaunch-retry.test.ts`; `tier line` `"hub/test/host-relaunch-retry.test.ts":"T3",`; `CLI files changed` empty (no new CLI surface). Any other change in the migrated file is a finding |
| E1532S6-27 | hub-api | QA | `nt E1532S6-27 hub/test/host-ref-watch-recovery.test.ts` | `CLEAN` (T-1693 C1; VERIFIED at dev `8e9439899`): the whole file passes, including the `ended=true` and `ended=false` expansions of `producer completion during native observation is reread before settlement (ended=<bool>)` added by `df397e2e7` (`:192`–`:207`): the producer checkpoints its completed receipt during the native census, the owner's `observe` returns `{state:'gone',code:0,signal:null,result}` and the census runs once. The file's earlier fence cases (missing, mismatched, incomplete and unreadable receipts, the four `Linux exiting descendant ESRCH is retried before push classification: <terminal>` expansions) pass unchanged |
| E1532S6-28 | hub-api | QA | `: > "$EV/E1532S6-28.log"; rp E1532S6-28 hub/test/host-push-on-ref-move.test.ts 3; node "$Q/tap.mjs" check "$EV/E1532S6-28.log" "$Q/expect.json" > "$EV/E1532S6-28.check.txt"` (QA's own shell) | Every run line `CLEAN`, and in each repetition test `interrupted admitted native push survives agent SIGKILL and recovery publishes only the current head` passes (the case that failed with `producer result missing; native cleanup retained` before T-1693), as do test `C1-C4 socket pushes follow commits, amend, reset, rebase, refusal and downtime without hooks` and test `killed producer without result stays named and fenced until a later successful leased head`. Local macOS repetitions under this machine's load only; T-1693 C2's 10/10 heavy-load macOS and Linux container evidence is the item's (A-16984) |
| E1532S6-13 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m13 ) > "$EV/E1532S6-13.txt" 2>&1` (command timeout of at least 600000 ms) | Scratch regression base, stages 2 to 4: stage 4's E1532S4-11 expectations, line for line (`qa/briefs/E-1532-stage-4.md` line 934): PRE p1 and fh empty, `fakes 5`, both name counts 0, `setsid none`; `init exit 0`; `hub after init and stop: down`; `mkhosts` byte counts under 104; `planted` f2 `600`; `hub start exit 0`; `records` f1 and f2 `ssh`/`registered`/`knownHostsMatch` true/`secretMode` `600`/`secretLength` 64; `agent` f1 and f2 `versionIsBuild` true and `capabilities` exactly as the build's server advertises (read `hub/src/host/agent/server.ts` at the build; stage 4 saw `["host-prepared-v1","claude-launch-adopt-v1","claude-restart-adopt-v1"]`); `wait` f1 and f2 `reached` true; `discovery` modes `600`, `equalsBuild` true; `replaced` f2 all true; `clone` `territory` true, `cloneEvents` 0, `hostWorktreesRows` 0, no `work` and no `git-proxy` (no item has launched yet); `control` `listenerSeen` true, `tcpEntries` 0; `svpids` true. A difference is read against source (rule 22) and recorded |
| E1532S6-14 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m14 ) > "$EV/E1532S6-14.txt" 2>&1` | Stage 2 smoke (the tunnel). `hub status exit 0` with `hosts 1`, `f1 up 1`, `f2 up 1` (the `  <host>  up since … · reconnects …` lines, `hub/src/cli/hub.ts:46`–`:47`). `grant f1 t/qa-a ok`; `leases` holds `f1 t/qa-a`. `clone exit 0`. `t/qa-a by f2 exit 1` with `lines: 1` or more (`cland: host f2: task branch t/qa-a is not leased to this host`); `t/qa-a by f1 exit 0`; `territory t/qa-a is the c1 commit: yes`. Like E1532S2-12, these local pushes run the shipped hook with `CLAND_PUSH_HOST`; the git socket, receive lock and daemon settings are the named files' (stage 2) |
| E1532S6-15 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m15 ) > "$EV/E1532S6-15.txt" 2>&1` | Stage 3 smoke (the ssh Host and the remote spoke). `discovery` f1 `mode` `600`, `secretIsHost` true, `equalsBuild` true. `host CLI: hub status exit 0` with `running-remote 1`, `pid 0` and `host refusal 1`: the forwarded `hub.sock` on f1 answered with the f1 discovery secret (never printed), and the hub's host admission refused the status frame without a role-holding session credential (E1532S3-11 and E1532S4-12 shape) |
| E1532S6-16 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m16 ) > "$EV/E1532S6-16.txt" 2>&1` (command timeout of at least 300000 ms) | Stage 4 smoke (agent restart): stage 4's E1532S4-12 expectations (`qa/briefs/E-1532-stage-4.md` line 935): `killagent` f1 `receiptWasHello` true and `gone` true; `agent` f1 `second` with `sameAsPrevious` false and `versionIsBuild` true; `events` `f1RestoreGrew` true with `f1.lastRestore` `complete`; `wait` f1 `reached` true; `svpids` f1 `supervisorIsStarter` and `agentIsHello` true; `same` f1 all true; `agent` f2 `check` `sameAsPrevious` true; host CLI `running-remote 1`, `pid 0`. Stage 5 (push, attach, survival, reboot, revoke; scope `none`, no brief) is represented by E1532S6-10's files and E1532S6-28, and by the `cland host revoke` lines of E1532S6-19 |
| E1532S6-17 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m17 ) > "$EV/E1532S6-17.txt" 2>&1` (command timeout of at least 600000 ms) | **T-1614 C1/C4 on a live host (scratch).** `roles edited`; `task create exit 0`; `artifact new exit 0`; `read back:` an item id and an artifact id (rule 22: read from `task list --json` and `artifact list --json`, never from the create output). `launch on f1 exit 0` with `launch ok 1`; `worker after launch:` `status` `running`, `item` the read-back id, `role` `implementer`, `cwdOnF1` true. **If instead the line reads `BLOCKED: no running worker on f1…`, record this row and E1532S6-18 and E1532S6-19 BLOCKED, not FAIL**, with the launch output (redacted): no named test launches a session on a fake host through a CLI-started hub (every relaunch test injects its hosts into an in-process `projectHub`), so this path is unproven by source; T-1614 C1/C4 then rest on E1532S6-06 and E1532S6-05, C2/C3 on E1532S6-07 and E1532S6-08, the T-1696 forward inventory on E1532S6-04 and E1532S6-08. Otherwise: `claim and topic:` recorded. (a) `ok-false 1`, `stays on its host 1` or more; (b) `ok-false 1`, `local refused 1`; `after (a) and (b):` `status` `running`, `samePid` true, `sameCwd` true (nothing reached the adapter). (c) `CLI relaunch, no host exit 0`; `after (c):` `status` `running`, `sameSessionId` true, `sameCwd` true, `cwdOnF1` true (T-1614 C4: a resume without `host` behaves as before) |
| E1532S6-18 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m18 ) > "$EV/E1532S6-18.txt" 2>&1` (command timeout of at least 300000 ms) | **T-1614 C2, C3 and decisions on the scratch hub** (BLOCKED with E1532S6-17). PRE: worker `running` on f1, pid the recorded f1 generation. `item branch leased to f1:` a `t/…` branch (read from the territory's `cland-branch-leases`, rule 22). `pushed commit reached the territory: yes` (the f1 agent's ref-watch pushed it; a `no` makes the tip sub-checks use the territory head and is recorded INCONCLUSIVE for that sub-check, stage 5's push being E1532S6-10's and E1532S6-28's). `fake-host kill-master f1: ok`, `fake-host gone f1: ok`, `f1 not up after …` (elapsed recorded, not judged). `relaunch on f2 exit 0` with `ok 1`, `found 1`, `relaunch note 1` or more, `loss note 1` or more. `after:` `status` `running`, `sameSessionId` true, `newHarnessSessionId` true, `cwdOnF2` true, `sameItem` true, `role` `implementer`, `warningNative` true (`session list` has no host field: the host is read from the cwd under that fake host's home). `f2 worktree HEAD is the territory tip: yes`. `claim and topic unchanged: yes`. `leases` holds the item branch for `f2` and not for `f1` (and the earlier `f1 t/qa-a`). `PRE refusal push: … yes`; `item branch by f1 after the move exit 1` with `lines: 1` or more (`cland: host f1: task branch <branch> is not leased to this host`); `item branch by f2 after the move exit 0`; `territory branch is the c1 commit: yes` (T-1614 C3). **Information only, never a pass condition here:** the `first input` line (`file`, `relaunched`, `loss`, `tip`, `brief`; the fake Codex input log path is INFERRED for a CLI-started hub, and E1532S6-08 carries the first-input assertion) and the `retained generations` lines (a `host` `f1` row for `worker` whose `pid` is the recorded f1 generation and `nativeClosure` `unknown` is the expected reading; the pass condition is E1532S6-07/-08/-09's `retainedHostGenerations('f1')` assertions) |
| E1532S6-19 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m19 ) > "$EV/E1532S6-19.txt" 2>&1` (command timeout of at least 300000 ms) | **After the move** (BLOCKED with E1532S6-17). Pass conditions: PRE `worker running on f2 true`; `gone marker f1: was true, now false`; `wait` f1 `reached` true within 120000 ms; `worker after f1 returned:` `status` `running`, `cwdOnF2` true, `samePid` true (the returned source does not take the session back; restore happens only after the move completed, see "Probes that mislead"); `control` `listenerSeen` true, then `tcp` `tcpEntries` 0 (the host-side processes, the workers among them, hold no TCP file); `host revoke f1 exit 0` with `revoked 1`. **Information only** (the per-session forward sockets and the retained generation are surfaced by no CLI, status or session-list view; their pass conditions are E1532S6-04, E1532S6-08 and E1532S6-07): the two `sk` readings (`sessionForwardSockets` per host before and after f1 returned; the expected reading is an f2 forward and no f1 forward re-created after the return); the revoke's `worker leftover` and `retained unknown` counts (the `left generation <generation> (worker): worker (unconfirmed), private files (unconfirmed); retained generation native closure is unknown; private files retained` line, `hub/src/host/settle.ts:114` with `hub/src/adapters/sessions.ts:199`, is the expected reading); the second revoke's text |
| E1532S6-21 | hub-api | Human | `( . "$Q/env.sh"; m21 ) > "$EV/E1532S6-21.txt" 2>&1` | PRE: kinds `project host-f1 host-f2`. Positive control first: `control` exactly `["p1/.cland/log/qa-scan-control.txt"]`, then `controlRemoved` true (no control hit is INCONCLUSIVE); each `scan` line (`project`, `host-f1`, `host-f2`) has `sentinels` 1 and `hits` `[]` (the fake Codex logs and server records under `$Q/fake-codex` included); `publishRefused` is `"control"` alone (this stage runs neither T-1665 file); `publishControlRemoved` true. Any secret hit is a FAIL naming the kind and file only |
| E1532S6-22 | hub-api | Human | `( . "$Q/env.sh"; cd "$Q/p1" && m22 ) > "$EV/E1532S6-22.txt" 2>&1` | `session stop worker exit 0` (or, with E1532S6-17 BLOCKED, the refusal recorded); the `worker-f1-a` line names no fake codex process (the CLI relaunch stopped it); the `worker-f1` line is the retained old generation, a live fake codex ended by its recorded pid (`after TERM: no`; tunnel loss does not end a host worker, by design); the `worker-f2` line names no live process after the stop; `hub stop exit 0; hub down`; every supervisor and agent pid `after TERM: no`; no `alive` line names a fixture process (an unrelated command is pid reuse, recorded); `processes naming the scratch root, the alias, this build's fake ssh or fake codex: 0`; `host socket directories outside p1` recorded; `alias` `gone` true |
| E1532S6-23 | hub-api | QA | `s23 > "$EV/E1532S6-23.txt" 2>&1` (QA's own shell) | HEAD, dev and the request's SHA still the same 40 hex; `dirty entries 0`; the root's non-tracker count equals E1532S6-00's; `T leftovers other than node-compile-cache 0`, after the T-1676 residue precondition (inventory, liveness, per-file attribution, literal-path removal). A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1532-stage-6.md --commit <dev SHA>`, with a dev SHA that includes the T-1698 landing. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid and process-group census registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too.
- Edit existing keys in initialized configs (`m17` edits `implementer.launch.writable_roots` through the build's `setRoleKey`, as the relaunch tests do), list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures.
- **A scratch launch on a fake host is unproven.** Stage 4 launched no session on a scratch host. The production registry gives a fake host the build's own CLI and spoke (`hub/src/host/registry.ts:38`), and the launch frame accepts `host`, but no named test drives a CLI-started hub to launch on a fake host: every relaunch test builds its hosts and adapters inside an in-process `projectHub`. A launch failure in E1532S6-17 is therefore BLOCKED, not FAIL, and the named rows carry the criteria.
- **`session list` has no host field.** `HarnessProcessView` (`hub/src/protocol.ts:981`) carries `cwd`, not `host`; the scratch rows read the host from the cwd prefix under that fake host's home (`probe home <host>`).
- **The retained old generation and the per-session forwards are not user views.** The retained f1 generation lives in p1's `hub.db` table `harness_host_retirements` and reaches the user only as `cland host revoke`'s `left generation …` line; per-session forwards are `s-<24 hex>.sock` sockets in the host's hub-side socket directory (`hostPaths`, `hub/src/host/records.ts:64`). Both are recorded as information; the named tests carry the pass conditions.
- **The old native worker keeps running after the move.** Tunnel loss does not prove exit: the f1 fake Codex generation stays alive after `kill-master` and `gone` and after f1 returns, as the designed retained obligation. `m22` ends it by its recorded pid after checking that pid is still a fake codex process; a census hit for it before `m22` is not a leak.
- A `fake-host.ts gone f1` alone does not mark the carrier down at once; the scratch rows run `kill-master` first, as the tests do. Waiting for `down` is bounded and its elapsed time recorded, not asserted.
- A returning host (`ungone f1`) during the relaunch drain is a designed case in the test files; in scratch rows, f1 is restored only in `m19`, after the move completed, or the drain-time race would be a different case.
- The relaunch brief reaches a **fresh** native conversation; a fake harness that resumes the old conversation would show up as `resumeConversation` set. The scratch rows read the fake Codex input log only as information; the test files carry that assertion.
- **Local pushes emulate the host hook.** `push.mjs` runs `git push` from `$Q/c1` with `CLAND_PUSH_HOST`, as E1532S2-12 did: it exercises the shipped `update` hook and the live lease file, not the per-host git socket, its receive lock or the daemon's `receive.*` settings (the named files' evidence). Every refused push is a real ref move (a `PRE refusal push … yes` line before it).
- Exact strings are counted by `src.mjs` with `String.split`; error strings here hold `;`, `:` and `/`.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Speed criteria use measured wall times, never projections. E1532S6-12, E1532S6-24 and E1532S6-28 repeat files under this machine's load and record the load average before each repetition.
- Slots due or queued before the build count even when their results arrive later.
- Re-check helper and function names with grep at the tested build; renames happen. The kit's line ranges are pinned by the stage-4 brief's blob; a different blob is a setup BLOCKED, never a reason to guess new ranges.
- The scratch hub's host `work` directories (`~/.cland-host/work/<12 hex>`) exist only after the first item launch on a host; stage 4's "no work directory" check (E1532S6-13) is true only before E1532S6-17.
- T-1698 strings and titles were read on its branch head (`0245e5c46`), not on dev; the landing merges dev (T-1693) into them. Re-read every T-1698 line, title and string at the build before judging.

## Out of scope

- Real SSH, real hosts, droplets, volumes, real harnesses, accounts and the network.
- Linux and container runs (`docker run --init`): the items' own evidence (T-1614, T-1692, T-1693, T-1698); this run is macOS only and says so in the verdict.
- Duration allowances (`hub/test/durations.json`) as pass conditions: timings are recorded, not judged.
- A CLI or web surface for the relaunch host: there is none (frame field only); any UI for it is a later stage.
- A scratch failed native admission and a scratch retry: no trigger exists (E1532S6-20 and E1532S6-24 to E1532S6-26 are the proof). Automatic reconciliation of unknown preparation stays out of the product (T-1698 keeps it fenced).
- The T-1665 publication-scanner issue's test files (`spoke-unix-edge`, `host-secret-admission`): not run here.
- The `cland release`, the territory-merge flow and any publication to GitHub.

Missing authorization (a real-browser or GUI step, a droplet) is out of scope, not BLOCKED, because none of these cases needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fake hosts with a disposable HOME and no credential.

## Source provenance

VERIFIED = read in source at the named commit. VERIFIED-on-branch = read on T-1698's branch head `0245e5c46a54e26faeee3fd720e583f439fbdf00` before its landing; re-read at the build. INFERRED = not read at the tested build or not proven by a named test; re-read it at the build under test and record the difference before judging.

- T-1696 (VERIFIED at dev `04a72e231`, unchanged at `8e9439899`): test titles in `hub/test/adapter-generation.test.ts` (lines 26, 90, 121, 141, 165) and `hub/test/adapter-generation-forward.test.ts` (lines 18, 36); guides `docs/agents/tests/hub-test-adapter-generation*.test.ts.md`; its landing's test-file diff.
- T-1614 (VERIFIED at dev `36492afe7` and `8e9439899`): `session.launch` and `session.resume` accept `host?: string` (`hub/src/adapters/requests.ts` lines 4, 12, 27, 33, 47, 59, 117); the CLI resume sends no host (`hub/src/cli/session.ts:84`); error strings `task stays on its host while that host is available` (`hub/src/adapters/sessions.ts:1753`, `:1781`), `relaunch to local from a remote host is not supported yet; relaunch on a registered host` (`:1752`), `relaunch on <host> failed; destination remains fenced; reconciliation is required: <failure>` (`:1807`), warning `relaunch to <host> <phase>…` (`:824`), relaunch note (`:1791`); the old generation retained with `unknown` closure (`:1778`); lease refusal `task branch $branch is not leased to this host` (`hub/src/territory.ts:122`); the lease file `cland-branch-leases` with `host<TAB>branch` lines (`hub/src/host/branch-leases.ts:8`, `:30`); test titles in the four relaunch test files and the assertions cited in E1532S6-06 to E1532S6-09 (`host-relaunch.test.ts:110`–`:124`, `:116`; `host-relaunch-native.test.ts:83`; `host-relaunch-publication.test.ts:38`); the relaunch tests' role edit `writable_roots` `["."]` (`host-relaunch-native.test.ts:63`) and model `gpt-fake-1` (`:67`); docs `docs/agents/host-agent.md` section "Relaunching an item on another host", the four guides `docs/agents/tests/hub-test-host-relaunch*.test.ts.md`, evidence `docs/evidence/T-1614-consumers.md`.
- Surfaces of the retained generation and forwards (VERIFIED at dev `8e9439899`): `HarnessProcessView` has no host field (`hub/src/protocol.ts:981`–`:1020`; `Sessions.view`, `hub/src/adapters/sessions.ts:818`–`:864`); `retainedHostGenerations` is read only by host settlement (`hub/src/adapters/sessions.ts:191`), whose unknown-closure step reports `retained generation native closure is unknown; private files retained` (`:199`), printed by `cland host revoke` as `left generation <generation> (<session>): <remaining>; <reason>` (`hub/src/host/settle.ts:109`–`:116`, `hub/src/cli/host.ts:20`–`:26`); `host.revoke` is human-only on a local connection (`hub/src/hub/dispatch.ts:2050`–`:2056`); per-session forward sockets `s-<24 hex>.sock` (`hub/src/host/records.ts:64`); the host status line (`hub/src/cli/hub.ts:46`–`:47`); the host admission refusal `host frame requires its own role-holding session credential` (`hub/src/hub/dispatch.ts:2344`).
- Scratch launch path (VERIFIED in source at dev `8e9439899`, INFERRED as a run): a fake host's layout uses the build's CLI and spoke (`hub/src/host/registry.ts:38`); Codex runs the hub's `CLAND_CODEX_BIN` through the Host (`hub/src/adapters/codex.ts:383`, `:505`; `hub/src/adapters/index.ts:99`); the fake Codex writes `log/<pid>.inputs.jsonl` under `FAKE_CODEX_HOME` (`hub/test/fakes/codex/fake-codex.ts:89`, `:334`), which `fixtureEnvironment` sets to `$Q/fake-codex` (`test-support/fixture-environment.ts:25`). No named test launches through a CLI-started hub on a fake host (a search of `hub/test/` for `CLAND_FAKE_HOSTS` with `hub start`).
- T-1698 (VERIFIED-on-branch `0245e5c46`): `hub/test/host-relaunch-retry.test.ts` (the `target` loop over `f2`, `f3`, `f4` at line 27; assertions at `:101`–`:170`); the migrated lines of `hub/test/host-relaunch.test.ts` (`:105`–`:106`, numstat `2 2` against `36492afe7`); `retryable?: boolean` (`hub/src/host/relaunch-state.ts:13`); the retry admission and settled-failure gate (`hub/src/adapters/sessions.ts:1569`, `:1703`–`:1704`, `:1781`–`:1782`, `:1818`); the retained note (`:1801`); the prune refusal (`hub/src/host/task-worktrees.ts:49`); `HostWorktreeRecord.retained` (`hub/src/host/task-worktrees.ts:7`); docs `docs/agents/host-agent.md` (the relaunch section's retry paragraph), the new `host-relaunch-retry` test guide and the `host-relaunch` test guide's decision 8a85dc4d note under `docs/agents/tests/`, `docs/evidence/T-1698-consumers.md`; `tiers.json` `T3`; no `hub/src/cli` change; criteria C1 and C2 from `.cland/tasks/T-1698-relaunch-retry-after-a-failed-native.md`.
- T-1693 (VERIFIED at dev `df397e2e7` and `8e9439899`): `refPushOwner` reads the receipt after `observeNative` (`hub/src/host/agent/ref-push.ts:48`–`:53`); the `ended` loop of `hub/test/host-ref-watch-recovery.test.ts` (`:192`–`:207`) and its guide's T-1693 paragraph; the titles of `hub/test/host-push-on-ref-move.test.ts` (lines 42, 94, 129, 145); the item's evidence A-16984.
- T-1692 (VERIFIED at dev `18640b7b4`): the landing's modified test files and zero changed assertion lines (`git diff -U0`, lines starting with `assert.`, `t.assert.` or `expect(`); the item's audit and loaded campaigns are its evidence.
- Fake-host controls (VERIFIED at dev `8e9439899`): `hub/test/fakes/fake-host.ts` actions `create|kill-master|kill-agent|reboot|gone` (`:160`–`:196`), `fakeHost` refusing a host with a `gone` marker (`:33`–`:39`).
- The kit (VERIFIED at dev `8e9439899`): `qa/briefs/E-1532-stage-4.md` blob `4ed467672750bf34179ed72549df863d1541eddb`, line ranges as listed under "The kit, by exact line range"; its imports (`hostPaths`, `layout`, `hostDirectory`, `remoteDiscovery`, `remoteHostLayout`, `VERSION`, `AgentClient`, `removeFixtureSockets`, `assertPublishable`, `hasTerritory`, `fixtureEnvironment`) exist at dev; `push.mjs` follows `qa/briefs/E-1532-stage-2.md` lines 178 to 180; `grantBranchLease` (`hub/src/host/branch-leases.ts:38`) and `setRoleKey` (`hub/src/roles/editor.ts`) exist at dev.
- Plan JSON (VERIFIED at dev `8e9439899`): a stage carries `name`, `state`, `qa`, `items`, `merged`, `total`, `statuses`, optional `verdict` (`hub/src/tracker/tracker.ts:2004`–`:2008`); lanes are not in the JSON (the epic file's plan block lists them: T-1696, T-1614, T-1698; T-1692; T-1693).

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "relaunch elsewhere"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1532 stage relaunch elsewhere` or `qa not clear E-1532 stage relaunch elsewhere` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
