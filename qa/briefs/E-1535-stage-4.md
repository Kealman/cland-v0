# Stage QA brief: E-1535 stage 4 — signed out, signing in again and from cards, remove, reconciliation and the amendment

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers, does not split unquoted path lists and does not split `set -- $pair`; always brace a variable before `:`. Stage 3's run correction C-1 came from exactly that: an unsplit file list made `git diff -- $F` match nothing). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`, `shasum`, `getconf DARWIN_USER_TEMP_DIR`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, snapshot, DigitalOcean API, key, credential, harness login, browser sign-in, sudo, mount, Telegram, Discord, speech API, npm registry or network (R-1530's QA rule).** The named files use only their own fakes (the fake host provider and its directory-backed volumes, fake SSH and scp, fake agents on Unix sockets, the fake Claude Code, Codex and OpenCode binaries with their fake login files and dead-login signals, the test messenger, FakeClock, in-memory or temporary SQLite). Key values are fixture sentinels only. The scratch rows start one hub through the real CLI in a disposable project with one fake pool that has no minimum; they create no host and sign in nothing. **No real harness, no browser, no Neovim, no GUI.** Never read, print or log `DIGITALOCEAN_TOKEN` or any key value; no secret is ever an argv element.

**Every member has landed; no landing marker is open.** First drafted at dev `25e4525ae` (T-1793, T-1789 and T-1792 landed). Since then T-1790 (`44a2775c9`), T-1794 (`6aa8c95df`), T-1815 (`7d2f0a59b`, split out of T-1791 into lane 1), T-1791 (`3cfbebfce`), T-1814 (`1dcb32ec4`, joined stage 4 from the backlog) and last T-1795 (`a03cd7b97`, docs, a direct landing with no merge batch) landed; every marker is filled and removed (see "Landing markers" at the end). E1535S4-04 expects `open landing markers: 0`: a request sent while any marker is open is BLOCKED.

**Written at dev `792c9c301dca0826bddee517d8614bffd59b608b`** (the tracker commit after T-1795's landing; the earlier pass at `99356638a9319380a3e4695d04ccbd7c6dcc2854`, the tracker commit after T-1814's landing; first drafted at `25e4525ae0e5772e4e895414d7186c3dbb7b4f77`). Markers: VERIFIED = read in source, Git or the tracker at that dev (every member's lines read at its landing with `git show`; the lines of the members that landed by `99356638a` read there and unchanged at `792c9c301`, since `a03cd7b97` and `792c9c301` touch only docs and `.cland/tasks/`; `s02`, `s05`, the `s07` probes, `src.mjs` and `ids.mjs` rehearsed read-only at `792c9c301` and at `9c98a5747`); INFERRED = a reasoned expectation no read or run has proven (rule 22: an INFERRED line is never a pass condition on its own). The Coordinator's durations-only commit `9c98a5747` (`9c98a5747646b75f248f952290d69e54073376ef`, parent `792c9c301`, `hub/test/durations.json` only) is accepted (E1535S4-02); the run's expected dev is `9c98a5747` plus this brief's own commit on top. Any other dev SHA later than `792c9c301` is re-read under "Rows to verify after landing" before the run; E1535S4-02 names which later commits are acceptable.

The stage closes the login lifecycle: dead-login signals mark a login signed out with one sign-in card per episode (T-1789), `cland login signin` renews a login in place with the one-sign-in hint (T-1790), an agent-owned interactive sign-in operation with input, bounded output and close receipts (T-1815), cards sign a login in from the hub cards every surface shows, with the remotes' secret answer and message deletion (T-1791), a new login's owner loss goes through the shared interrupt and exact-machine fence (T-1814), a sign-in can relaunch its host's sessions behind a switch (T-1794), `cland login remove` (T-1792), reconciliation at hub start (T-1793), and the ADR, the spec amendment and the logins notes (T-1795). The run is meant to take about four and a half hours: setup and E1535S4-00 to E1535S4-07 about 30 minutes; the sealed rows E1535S4-10 to E1535S4-56 about 75 minutes; the native rows E1535S4-60 to E1535S4-73 about 140 minutes, one file per preservation slot; scratch rows about 10 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief reuses blocks from three fixed commits, never by blob (A-17643): the kits of stages 1 to 3 from commit `K` (`f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`); the stage-2 brief's helpers from commit `M3` (`18911bda46c7c0dc332619e93d25041069d3704a`), exactly as stage 3 took them; and the stage-3 brief's own check and scratch functions from commit `M4` (`85e60f6cb34ec320cc7a1f5456de3a4693acbe17`, the tracker commit that recorded stage 3's clear verdict and the parent of this stage's first commit; the stage-3 brief's blob there is `b2febfa90b5b88c41cdf1954303543b6a3953359`, which already holds its "Run 1 corrections" C-1, R-1 and R-2, VERIFIED; it was unchanged on dev at `25e4525ae`, and T-1791's landing `3cfbebfce` later prepended 35 lines to it, see below). It therefore carries the whole chain of corrections:

- the stage-1 chain as `qa/briefs/E-1535-stage-1.md` holds it at `M2` (`0d0618042fae7b76919d1be152e252b09e4a43ad`; blob `dd84d5b93927798242c0bee78ddc3310145ecbf0`; 127 lines), read into `$EV/carried-from-M2.md`;
- the stage-2 chain as `qa/briefs/E-1535-stage-2.md` holds it at `M3` (55 lines), read into `$EV/carried-from-M3.md`;
- the stage-3 chain as `qa/briefs/E-1535-stage-3.md` holds it at `M4` (every section from `## Carried corrections` up to `## Stage`, 80 lines, VERIFIED, SHA-1 `e4ad4448829797e25c364afad87b0f3f2cf3b06e`; it includes "Run 1 corrections" C-1, R-1 and R-2), read into `$EV/carried-from-M4.md`;

all followed as written, then the stage-3 run's outcome and this stage's evidence below. T-1789's landing `f10710982` later edited `qa/briefs/E-1535-stage-2.md` (two `src.mjs` lines now quote `markSignedOut`, VERIFIED); that edit is outside every line this brief extracts, and this brief reads the stage-2 brief at `M3`, never at dev. T-1791's landing `3cfbebfce` prepended a "Current secret-card replay mapping" (41 lines) to `qa/briefs/E-1535-stage-1.md` and a "Current card-owner replay mapping" (35 lines) to `qa/briefs/E-1535-stage-3.md` (VERIFIED with `git diff 3cfbebfce^ 3cfbebfce -- qa/briefs/`); this brief reads those two briefs only at `M2` and `M4`, so no extracted line or SHA-1 moves. Their content is current and is applied here: `login-wait` now has eight cases, `login card option <option> folds once across retries and restart` checks the installed card owner (`Signing in`), and the secret-answer replay is `secret hub answers reach the handler verbatim and remote replay stores message identity` (E1535S4-45).

### From the E-1535 stage-3 run (qa-678, A-18617, clear at `1ce802084`)

Its three corrections are in the carried `M4` text and apply here as follows:

- **C-1 (a landing that is not byte-identical to its tip).** A landing whose reviewed tip predates a dev commit can carry that commit's change. Here **T-1789** prints `own lines … : yes` and `files byte-identical to 1470a7b09… at its landing: no: docs/hub/logins.md hub/README.md hub/test/login-release.test.ts`: its tip was built on `10711a330`, its landing's parent is `a38929ae8` (T-1810's out-of-stage landing), and the tip-to-landing difference in each of the three files equals `a38929ae8`'s change line for line (VERIFIED with sorted diff lines). E1535S4-02 accepts that line only with its explicit equality line `yes`. T-1793, T-1792, T-1790, T-1794, T-1815, T-1791, T-1814 and T-1795 print `yes` for both (VERIFIED, in bash, at `99356638a` and again at `792c9c301` and `9c98a5747`): each later landing was built on its landing's parent or on a parent whose intervening commits touch none of its files (T-1815's tip was built on `6aa8c95df`, its landing's parent is `68ed9d82b`; the two between, `7d50d44b3` and T-1818's `68ed9d82b`, touch no T-1815 file; T-1795's tip `90410ef27` descends from `99356638a`, its landing's parent, and its tree equals the landing's tree).
- **R-1 (expected dead receipts).** The two attributed receipts are carried: the T-1805 `login-add` receipt (E1535S4-66 here) and the T-1676-class `opencode-adapter` CLI-hub receipt (E1535S4-71 here). A receipt from any other row, a live owner PID or an open handle fails E1535S4-99.
- **R-2 (the scratch pool needs `slots = 1`).** The `r80` this brief extracts from `M4` already writes it (VERIFIED in the range's text).
- **Found aside at stage 3, Low:** T-1806 (24 dead `cland-h-*` directories), T-1805 and T-1676. Here T-1806 is recorded as found aside with its count per native row (E1535S4-99), never a stage failure.

### From the stage-4 implementer, reviewer and Coordinator evidence (not a QA run)

- **A-18760, decisions on dev the rows check** (`.cland/artifacts/A-18760-e-1535-stage-4-lane-1-addendum-decisions-on-dev-t-1790-t-1791-t-1794.md`, VERIFIED): (1) every transition to `signed-out` goes through `LoginRecords.markSignedOut(name, {reason, host})`, from `creating`, `ready` or `in-use`, writing `signedOut: {id, reason, host, at}` with a per-episode UUID; a bare `transition(name, 'signed-out')` refuses; a failed sign-in records `reason: 'sign-in failed', host: null`; (2) exactly one `login-signin` card per signed-out episode, keyed by `signedOut.id`, Not now folded across restarts, the Agents notice once per episode through a `noticed` flag, withdrawn when the login reads `ready`; (3) reconciliation runs after lease reconciliation and before the pool runtime's first pass, reads volume inventory only, and leaves pending bindings, reader intents, snapshot intents and receipts to their owners; (4) a private removal claim and the snapshot owner's private `snapshot_admission` column fence bind and sign-in and are never cleared by others; (5) a release retry never rewrites a `destroyed` provision (T-1810). E1535S4-03 checks the source of each; the rows below check their behaviour.
- **T-1790's recovery policy** (VERIFIED in T-1790's tracker comments, Coordinator decisions recorded there; source at its landing `44a2775c9`, byte-identical to its reviewed tip `3683b2f7b`): an interrupted sign-in's fence is cleared only by the exact captured machine's deletion receipt or by the CLI's own post-close completion on its pinned connection; owner loss without a close receipt keeps the interrupted exact-machine fence (decision e516d138); no timer settles it (decision feb9d4e1 withdrew the timer exception; decision 1cd13e7f keeps the fence until the existing deletion receipt). Native next-turn renewal is proven for OpenCode only; Codex and Claude Code native next-turn renewal belongs to T-1813 (decision 82ab5bec). The tip `3683b2f7b` ("Preserve renewal ownership on disconnect and drain prior backups", after `rev-35-1790-source-2` was not clear at `85352c52d`) added the `renewal terminal <outcome> distinguishes native close receipt from owner loss` matrix, `unbound renewal interruption retains its native fence without invoking disk cleanup` and the `renewal drains an older held snapshot generation …` pair (VERIFIED with `git diff 85352c52d 3683b2f7b`; 15 files). The new-login (`login add`) fallback it left is T-1814 (rev-35's source-3 clear, A-18804), now a stage member.
- **T-1814's shared new-login recovery** (VERIFIED in its tracker comments and source at `1dcb32ec4`): `cland login add` and the card's Create one take a durable add admission with the captured host and machine (`beginAddSignIn`) before attach; peer close, hub stop or a rejected preparation interrupts through the same exact-machine fence as a renewal; the CLI's own post-close completion keeps success and failure; only the captured machine's deletion receipt settles an interrupted add (T-1814 C1 to C4).
- **T-1815's interactive operation** (VERIFIED at `7d2f0a59b`): the host agent runs the harness sign-in under one admission (`signin-v1`), writes hub input to its stdin with both stream redactors registered, streams at most `SIGNIN_OUTPUT_BYTES` (64 KiB) in chunks of at most 4096 bytes, checkpoints a close receipt with a real code or signal, and releases writer admission only after that receipt; a receipt for another admission is refused.
- **T-1810, out of stage, landed `a38929ae8`** (rev-35 `rev-35-1810-final-1`; byte-identical to its tip `3ee73e112`, VERIFIED): `destroyHost` on a `destroyed` provision retries only its login obligation and returns, never reopening the terminal machine lifecycle; `hub/test/host-restart.test.ts` now records every state the gone host's provision publishes and asserts the first `destroyed` stays. **T-1810 is no longer a known flake**: a `'destroying'` read at `host-restart` is a FAIL here, a regression of T-1810's fix.
- **T-1818, out of stage, landed `68ed9d82b`** (`68ed9d82b489ed5e74817bd842b3b7e040194c8f`; rev-36 `rev-36-1818-final-1`; own lines and files byte-identical to its tip `0679105b1`, VERIFIED in bash; 2 files): `hub/test/host-restart.test.ts` now waits through the named bounded wait `eventually('reopened live host login disk reachable',()=>liveHost.loginDiskReachable?.()===true?true:undefined,SETUP_MS)` before reading the live host's login file after restart; every earlier assertion is kept, and the file's per-test note says so (VERIFIED: one added test line, six note lines). Its verify `8046292f` (A-18872) and batch `ad37ee0a` (A-18882, A-18883) are read in E1535S4-06. A read of the reopened live host's login file failing before its tunnel is up at `host-restart` is a FAIL here, a regression of T-1818's fix.
- **Coordinator docs commit `10711a330`** (one `docs/hub/logins.md` sentence about pending bindings, for the closed-item wording lint; VERIFIED: one file, two lines).
- **Durations commit `697c33ddd`** (VERIFIED with `durdelta`: `entries outside allow changed or removed 0; added 4; allowances removed 0; changed 0 …; added 0; version same true`). No Coordinator durations or docs commit follows it up to `792c9c301`; the six later non-landing commits (`e744bc339`, `7d50d44b3`, `065cf1416`, `91fcb5113`, `99356638a`, `792c9c301`) touch only `.cland/tasks/` (VERIFIED).
- **Durations commit `9c98a5747`** (`9c98a5747646b75f248f952290d69e54073376ef`, "Durations: add-only refresh from the E-1535 stage-4 logs", parent `792c9c301`; one file, `hub/test/durations.json`, 293 insertions and 3 deletions, the deletions being two trailing-comma lines and the header's `commit` value; VERIFIED with `git show --stat`, `git diff` and `durdelta`: `entries outside allow changed or removed 0; added 227; allowances removed 0; changed 0 (renewals keeping seconds and owner 0; reason-only 0); added 0; version same true`). It is treated as `697c33ddd` is: accepted only with that add-only shape.

### Known flakes for this stage

Carried by exact signature only: T-1731 (`hub/test/host-ssh-contract.test.ts`; not run here) and T-1770 (`hub/test/host-provider-digitalocean.test.ts`, the `422` expansion failing at line 368 with `['created','failed','created']`; not run here). T-1810 is dropped (fixed; see above). **Regressions, never reruns:** T-1735, T-1732, T-1797, T-1810 and T-1818. Any other failure is judged as it stands.

### Known non-blocking items (record if seen; never a stage failure on their own)

Each read with `task view` at writing (VERIFIED; all `backlog` with `needs-triage`; T-1676 also `qa-found`). T-1814, listed here in the first draft, joined the stage and landed (`1dcb32ec4`); it is a member, and its ordering is now a pass condition (E1535S4-40, E1535S4-42, E1535S4-45, E1535S4-66), never a known item:

- **T-1806:** native host fixtures leave `cland-h-*` socket directories in `/private/tmp`. Record the new count after each native row as found aside; QA leaves them.
- **T-1808:** no shared evidence-publish helper with a positive-control secret scan yet; QA publishes only after a clean scan with a positive control (rule 15).
- **T-1809:** the `login-snapshots` ten-thousand-login budget case; plain `node --test` enforces no budget, so its wall time is recorded only.
- **T-1812:** a spoke that starts while the hub is down never connects. A session spoke that never connects after a hub restart in this run is this item, recorded with its timing.
- **T-1813:** native fake-host end-to-end dead-login cases for Codex and Claude Code are not built; native coverage here is OpenCode only (component cases cover every listed signal).
- **T-1816:** `startServer`'s port retry spins without bound when `freePort` keeps returning an already-attempted port (found by impl-1794; the native fixture that pinned one port was fixed in T-1794). A native row that ends in `RangeError: Map maximum size exceeded` after about 30 s is this item, recorded with its row; the row is INCONCLUSIVE, never a pass.
- **T-1817:** `hub/test/login-metadata-owners.ts` closes the borrowed Store even when `hub.stop` rejected (found in source by impl-1791, not a reproduced failure). A fault-path diagnostic in `login-add-component`, `login-list` or `login-signin-recovery` that lost its storage after a rejected stop is this item.
- **T-1801:** `LoginBinder.close` cannot abort in-flight volume operations; a slow but positive close is this item.
- **T-1802:** `cland-auth thaw` is not idempotent; a retained fence after a lost thaw receipt is this item.
- **T-1804:** explorer protocol recordings key on archive-loading state; this brief runs no recording refresh; a changed `nvim/test/fixtures/` is this item (it also makes `dirty entries` non-zero: report it).
- **T-1805:** the `login-add` fixture-owner receipt naming the source worktree (R-1; E1535S4-66). Never remove it or act on its `roots`.
- **T-1676:** dead fallback sockets, Codex placeholder sockets and fixture-owner receipts from unchanged producers (R-1's `opencode-adapter` receipt; E1535S4-71).

### How this brief applies them, and the reconciliation

- **Two environments (carried).** Sealed T1/T2 rows, the typecheck, the wording lint and every scratch command run through the stage-3 kit's `fresh.mjs`. Native rows (the T3 files, plus `hub/test/host-unreachable.test.ts` and `hub/test/host-stop.test.ts`, grouped native since stage 2) run through the stage-2 brief's `std.mjs`, one file per preservation slot.
- **Kit and helper pins.** From `K` and `M3`: exactly the blocks and ranges stage 3 took (listed in "Environment", each SHA-1 checked). From `M4`, in `qa/briefs/E-1535-stage-3.md`: line 737 (`landing`), lines 743 to 745 (`durdelta`), lines 748 to 755 (`s00`) of its `checks.sh`; lines 813 to 839 (`SENT`, `SENT2`, `r80` with R-2's `slots = 1`, `r81`) and 851 to 860 (`r83`) of its `scratch.sh`. Not taken from `M4`: its `expect.json`, `src.mjs`, `ids.mjs`, `preserved`, `s02`, `s05`, `s06`, `r82`; this brief writes its own.
- **Reconciliation of the reused blocks with the stage-3 corrections.** C-1 is applied by this brief's own `s02` (an explicit equality line for T-1789); R-1 by E1535S4-99's receipt count; R-2 is already in the extracted `r80`. No extracted block is edited.
- **Per-file name-set inventories (carried).** Exact before and after name sets, taken only after each file's `exit` line. A new own-family name is a FAIL of that row against the member whose landing edited the file (or whose product change an unedited consumer reaches, named in the row); every other new name is recorded and attributed; a live new name is a FINDING.
- **Expected-registration correction (carried).** Every exact list below was expanded from source through its loops, then matched name by name (VERIFIED at `99356638a`; the lists of files no landing after `25e4525ae` edited were read at `25e4525ae` and are byte-unchanged at `99356638a`; every test file is byte-unchanged from `99356638a` to `9c98a5747`, whose only paths outside `.cland/tasks/` are T-1795's nine docs files and `hub/test/durations.json`, VERIFIED with `git diff --name-only`).
- **Landing delta (carried, C-1).** E1535S4-02 compares each member's own changed lines at its landing with its reviewed tip's against their merge base, and names every tree difference with its source.
- **Presentation substitution, mapping ids, dead receipts and sockets, cleanup order (carried).** As in stage 3: a withheld line makes a row INCONCLUSIVE; E1535S4-04 checks map ids and markers; QA removes only dead `$T` residue by literal path and nothing in the shared system TMPDIR or `/private/tmp`; if any inventory shows a new own-family name, nothing is removed.
- **Evidence split (this stage).** T1, T2, Web and each member's changed T3 come from the member's mode-free `cland verify` on the Linux droplet at its reviewed head; full T3 from the merge batch that landed it (T-1795, docs only, landed directly with no batch: its own full-mode verify at its tip stands in, and the stage covers carry full T3 at the request); the stage covers (the Coordinator's cover pair at the requested dev SHA: a Linux `verify all --occasion stage` and a macOS `--executor local --workers 1` run) are submitted by the Coordinator. **QA starts none of them**: E1535S4-06 reads them.
- **Not applicable here:** Neovim and web rows (no stage path under `nvim/` or `web/` from `BASE` to `9c98a5747`, VERIFIED: T-1791's card sign-in reaches the web and Neovim only through the existing hub cards, whose consumers `hub-cards` and its `web` and `neovim` fold expansions run sealed in E1535S4-45; `nvim/test/remotes.test.ts`, a T3 importer of the edited test messenger, is not run: no Neovim); the epic occasion suite and `cland demo` (the epic's Definition of done is a separate run).

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED or INFERRED.
- **TAP.** Plans count top-level registrations; counters include nested subtests; `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`; tree-wide checks use `git grep` at `$S`, excluding `qa/briefs/` and `.cland/`.
- **The preservation lock** `/tmp/cland-preserve.lock`: `mkdir` must exit 0, owner file, owner-checked literal-path release; one native file per slot, at most 15 minutes (`std.mjs` exits 124: INCONCLUSIVE); a held lock is BLOCKED for now.

### Run 1 corrections (qa-678, A-18954, clear at `e2eb555d4`)

- **R-1 (s06's census Git call is sealed).** The batch-candidate census in `s06` called `execFileSync("git", …)` from its embedded Node script with the inherited environment, outside the shared seal (rule 15). Run it through the same wrapper as every other Git call, built with `fixtureEnvironment` + `scratchGitEnvironment`; every argument, count and the positive control stay as written (`merge-batch candidates naming T-1814: 1; T-1795: 0`). The original and replacement lines are in A-18954 `corrections.md`. Any brief reusing `s06` applies R-1.
- **Documentary.** The out-of-scope Neovim bullet said `nvim/test/remotes.test.ts` was included; it is not run (no Neovim), as the opening and the case table say. Fixed in the text above.

## Stage

- Epic: E-1535 (Logins).
- Exact stage name: signed out, signing in again and from cards, remove, reconciliation and the amendment.
- Items, in plan order, by lane (VERIFIED in `task plan show E-1535 --json` at `99356638a` and again at `792c9c301`): [T-1789 (dead-login signals mark the login signed out), T-1790 (`cland login signin` in place, and the one-sign-in hint), T-1815 (an agent-owned interactive sign-in operation with input, bounded output and close receipts), T-1791 (signing in from a card), T-1814 (`login add` treats a dispatcher-synthesized sign-in completion as a close receipt and unmounts before the CLI's SSH has closed), T-1794 (relaunch after sign-in, behind a switch)], [T-1792 (`cland login remove`)], [T-1793 (login reconciliation at hub start)], [T-1795 (the ADR, the v0.1.2 §3.13 amendment and the logins notes)]. T-1815 was split out of T-1791 and T-1814 joined the stage in tracker commit `7d50d44b3` (VERIFIED: its subject and the plan). The run reads membership, counts and state from `task plan show E-1535 --json` (E1535S4-00), never from this list. QA finding fixes added after writing are listed in the request.
- Policy: affected/after-stage (no item override; every member's `qaPolicy`, T-1815's and T-1814's included, is `{"scope":"affected","when":"after-stage"}` with no QA criteria, VERIFIED at `99356638a`; T-1795's re-read at `792c9c301`).
- Scope: **affected.** The combined changed behaviour through the stage's named test files, the importers of the fixtures and fakes the stage edits, the native files the stage reaches, read-only source and tree checks, the closed-item wording lint, the evidence read of E1535S4-06, and scratch checks of key-login removal on a CLI-started hub.
  - T-1793 (landed `15ee52343`, the first landing; VERIFIED; byte-identical to its reviewed tip `e3767adfd`, rev-35 `rev-35-1793-final-1`; 28 files): `LoginReconciliation` (`hub/src/host/login-reconcile.ts`, new) runs inside session restore after `restoreHostLeaseOwners` and before pool scaling (`hub/src/hub/daemon.ts`): per provider it lists volumes, frees a binding whose host is destroyed, destroying, failed or deleted and whose volume reads detached (`releaseDetachedLoginBinding`, `hub/src/host/login-release.ts`), deletes detached reader volumes with a confirming receipt (`hub/src/host/login-reader.ts`), signs out a login whose volume is not listed with `volume missing`, keeps every row on a failed inventory with one Agents line and a retry, logs unmatched tagged volumes, and leaves pending bindings and reader intents to their owners. Tests: `hub/test/login-reconcile.test.ts` (T2, new); `host-restart` (T3: C1 and C2 natively), `host-relaunch` (T3), `waiting-launch-restart`, `host-status`, `host-stop`, `login-records`, `login-selection`, `pool-failures`, `pool-scale`, `session-pool-placement`, `waiting-launch` (edited); fixtures `hub/test/settled-login-fixture.ts` (the volume now in the fake provider's inventory) and `hub/test/ssh-host-fixture.ts`.
  - T-1789 (landed `f10710982`; VERIFIED; own lines equal to its tip `1470a7b09`, rev-36 `rev-36-1789-final-1`, byte-identical except the three files `a38929ae8` also changed (C-1); 37 files): the adapters classify dead-login signals (`deadLoginReason` in `hub/src/host/login-signals.ts`, new; `hub/src/adapters/claude-code.ts`, `codex.ts`, `opencode.ts`, `opencode/state.ts`) and report them through the optional `loginDead` callback (`hub/src/adapters/contract.ts`); `LoginSignals.report` ignores local rows and unbound logins and calls `markSignedOut` with the host (`hub/src/adapters/sessions.ts`); `LoginCards` keeps one `login-signin` card per episode with a once-only Agents notice of kind `login-signed-out` (`hub/src/host/login-cards.ts`, `hub/src/hub/agents-topic.ts`); `markSignedOut` and the bare-transition refusal (`hub/src/host/logins.ts`). Tests: `hub/test/login-signed-out.test.ts` (T2, new), `hub/test/login-signed-out-native.test.ts` (T3, new), `codex-host`, `login-native-environment` (edited), and one-line migrations in `login-records`, `login-wait`, `login-capacity`, `login-host-pin`, `login-add-component`, `login-reconcile`, `login-release`, `login-selection`, `login-signin`, `login-snapshots`; fixtures `hub/test/host-create-fixture.ts`, `hub/test/login-native-environment.ts`, `hub/test/fakes/opencode/fake-opencode.ts`.
  - T-1792 (landed `ee483c2a0`; VERIFIED; byte-identical to its reviewed tip `efaba34f8`, rev-37 `rev-37-1792-evidence-2`; 24 files): `cland login remove <name>` (frame `login.remove`, local human CLI or Neovim only; `hub/src/cli/login.ts`, `usage/login.ts`, `help.ts`, `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`, `web-authority.ts`, `shared/wire/index.ts`) through `removeLogin` (`hub/src/host/login-remove.ts`, new): a durable removal claim first (`beginRemove`, which refuses in-use naming the host, `creating` naming the running sign-in, and a pending binding), then the snapshot owner's admission (`login-snapshots.ts`), then each snapshot and the volume deleted with confirmation, each confirmed item recorded through `deleteStorage` (`confirmRemovedResource`), an unconfirmed deletion keeping the row and exiting nonzero naming the remaining ids, a key login's file removed with the `[auth]` key kept (`login-keys.ts`), and the sign-in card withdrawn while removing (`login-cards.ts`). Tests: `hub/test/login-remove.test.ts` (T2, new), `login-list` (edited); docs `docs/agents/auth.md`.
  - T-1790 (landed `44a2775c9`; VERIFIED; byte-identical to its reviewed tip `3683b2f7b`, rev-35 `rev-35-1790-source-3` and `rev-35-1790-final-1` clear there, C1 to C5 verified; 45 files): `cland login signin <name>` (frame `login.signin`), renewal through `beginSignIn`/`finishSignIn` on the existing volume with the shared snapshot owner's freeze, snapshot and thaw (`hub/src/host/login-signin.ts`, `login-snapshots.ts`, `logins.ts`, `login-add.ts`), startup sign-in recovery after reconciliation (`recoverLoginSignIns`, `hub/src/hub/daemon.ts`), settlement only on the exact machine's deletion (`settleLoginSignInsForHost` in `provision-host.ts`), receipt-less owner loss interrupting rather than completing (`hub/src/hub/dispatch.ts`, `hub/src/cli/login-terminal.ts`), the one-sign-in hint with a 24 h hub-clock window (`ONE_SIGN_IN_HINT`, `login-signals.ts`; a `HINT` column in `cland login list`). Tests: `hub/test/login-signin-recovery.test.ts` (T2, new), `hub/test/login-resignin-native.test.ts` (T3, new), `login-signin` (T1), `login-signed-out`, `login-remove`, `login-release`, `login-list`, `login-snapshots`, `login-add-component` (edited); fixture `hub/test/login-metadata-owners.ts` (new; imported by `login-add-component`, `login-list` and `login-signin-recovery`).
  - T-1815 (landed `7d2f0a59b`; VERIFIED; byte-identical to its reviewed tip `2b2add0f2`, rev-37 `rev-37-1815-delta-1` and `rev-37-1815-evidence-1` clear there, C1 to C5 verified; 32 files): the host agent's `signin-v1` operation (`hub/src/host/agent/signin.ts`, `signin-command.ts`, `signin-redactor.ts`, `signin-types.ts`, new; `processes.ts`, `server.ts`, `login-disk.ts`, `state-paths.ts`, the regenerated `closure.json`), its hub client (`hub/src/host/signin-client.ts`, new; `agent-client.ts`), the optional `Host.signIn` (`hub/src/host/host.ts`, `ssh-host.ts`) used by `login-signin.ts`, and the OpenCode database path helper moved to `agent/state-paths.ts` (`hub/src/accounts/registry.ts`). Tests: `hub/test/host-agent-signin-op.test.ts` (T3, new), `signin-client`, `signin-command`, `signin-owner`, `signin-redactor` (T1, new), `accounts-policy`, `host-contract-coverage` (T1), `host-agent-client` (T2) (edited); fixture `hub/test/host-contract.ts` (an added `optionalSignInHostContract`, imported only by `host-contract-coverage`, VERIFIED with `git grep`). C5 names the unedited `host-agent-boundary` and `host-agent-closure` (T1).
  - T-1791 (landed `3cfbebfce`; VERIFIED; byte-identical to its reviewed tip `26b09338a`, rev-35 `rev-35-1791-delta-6` and `rev-35-1791-final-1` clear there, C1 to C7 verified; 54 files): `LoginCardSignIn` (`hub/src/host/login-card-signin.ts`, new) answers Create one (`login-create`) and Sign in again (`login-signin`) through the shared login preparation and the prepared Host's `signin-v1` operation, raises the `login-signin-code` card with the parsed link and code (`login-signin-output.ts`, new), takes the Claude Code code as a secret free answer, withdraws at 15 minutes of hub clock and keeps durable card intents (`login-card-intents.ts`, new; `hub/src/hub/store.ts`); the remotes keep a secret answer's native message identity and delete it, or send one line where they cannot (`hub/src/remote/secret-answer.ts`, `ingress.ts`, `signin-link.ts`, new; `gateway.ts`, `telegram*.ts`, `discord*.ts`, `state.ts`; `hub/src/hub/hub-cards.ts`, `dispatch.ts`, `daemon.ts`, `server.ts`, `login-add.ts`). Tests: `hub/test/login-card-signin.test.ts` (T3, new), `login-card-signin-owner`, `login-card-signin-remote`, `login-card-recovery` (T2, new), `hub-cards`, `login-wait`, `discord-api`, `telegram-api` (edited); fixtures `hub/test/login-card-fixture.ts`, `hub/test/login-card-signin-trace.ts` (new), `hub/test/fakes/messenger.ts` (a `deleteMessage` and a `secretAnswerNotice`), `hub/test/fakes/telegram/fake-api.ts` and `fakes/discord/fake-api.ts` (a delete route each), `hub/test/harness.ts` (an optional `runLoginSignIn`), `hub/test/host-create-fixture.ts` (an optional `cardSignIn`). It also prepended the current replay mappings to the stage-1 and stage-3 briefs (see "Carried corrections").
  - T-1814 (landed `1dcb32ec4`; VERIFIED; byte-identical to its reviewed tip `c111a20aa`, rev-35 `rev-35-1814-source-3` and `rev-35-1814-final-1` clear there, C1 to C4 verified; 18 files): `beginAddSignIn` (`hub/src/host/logins.ts`) gives a new disk login a durable add admission with its captured host and machine; `prepareLoginSignIn` (`hub/src/host/login-signin.ts`) interrupts that admission on rejected or abandoned preparation and revalidates it across awaits; the dispatcher aborts preparation on a terminal close (`hub/src/hub/dispatch.ts`); the card's unknown Create one outcome interrupts through the same owner (`hub/src/host/login-card-signin.ts`). Tests: `hub/test/login-add-component.test.ts`, `hub/test/login-host-pin.test.ts`, `hub/test/login-signin.test.ts`, `hub/test/login-card-signin-owner.test.ts` (edited), `hub/test/login-add.test.ts` (T3, edited: the terminal disconnect now reads `sign-in interrupted` with the captured host, the volume still attached and its mount symlink); it reaches `login-card-signin`, `login-resignin-native`, `login-terminal` (T3), `login-card-signin-remote` and `host-stop` (T2).
  - T-1794 (landed `6aa8c95df`; VERIFIED; byte-identical to its reviewed tip `dd4650fa7`, rev-36 `rev-36-1794-source-2` and `rev-36-1794-final-1` clear there, C1 to C3 verified; 23 files): `[hosts] relaunch_after_signin` (boolean, default false, refused otherwise naming the key, omitted by init; `hub/src/host/pools.ts`, `hub/src/init/config-set.ts`, `usage/config.ts`), read from the live settings when a sign-in succeeds; the success hook `afterSignIn` (`login-signin.ts`, `login-add.ts`, `dispatch.ts`) calls `Sessions.relaunchAfterSignIn` (`hub/src/adapters/sessions.ts`), which resumes each running session of that harness on that host through the same-conversation resume, admitted under its lifecycle slot. Tests: `hub/test/login-relaunch.test.ts` (T2, new), `host-pools-config` (T1), `config-set` (T2), `login-resignin-native` (T3) (edited).
  - T-1795 (landed `a03cd7b97`, `a03cd7b970bb18b1dee041d5972cf72a19db2f0b`, by a direct `cland merge` with no merge-queue batch; first parent `99356638a`, one `Item: T-1795` trailer, `Reviewed-by: rev-35 (rev-35-1795-final-1)`; VERIFIED; byte-identical to its reviewed tip `90410ef27` (`90410ef27b35fbbb7c21ee306412adc03f80467b`, whose whole tree equals the landing's), rev-35 `rev-35-1795-delta-13` and `rev-35-1795-final-1` clear there (A-18938, A-18942), C1 to C4 verified at that commit; its own verify `df8e426a` (A-18940) passed at that tip; 9 files, 430 insertions and 2 deletions, docs only, VERIFIED with `git show --stat`): `docs/adr/0009-login-storage-boundary.md` (new), an appended dated amendment at the end of `docs/spec/v0.1.2.md` §3.13 (12 added lines, none removed), 298 added lines in `docs/hub/logins.md` (none removed), four new T1 per-test notes `docs/agents/tests/hub-test-signin-{client,command,owner,redactor}.test.ts.md` with their four rows in `docs/agents/tests/index.md`, and the `login-card-signin-owner` note now naming both `: native loss` and `: setup failure` titles.
- **Merge watch** (VERIFIED with `git rev-list --first-parent` per file from `BASE` to `99356638a`, and to `9c98a5747` for the files T-1795 and `9c98a5747` touch). `hub/README.md` is edited by every member except T-1795 and by T-1810; `docs/hub/logins.md` by every member except T-1815, by T-1810 and by `10711a330`; `docs/agents/tests/index.md` (T-1795 included), `hub/test/tiers.json` and `hub/test/durations.json` (and `9c98a5747`) by most landings; the `login-card-signin-owner` per-test note under `docs/agents/tests/` by T-1791, T-1814 and T-1795; `hub/src/host/login-signin.ts` by T-1789, T-1790, T-1794, T-1815 and T-1814; `hub/src/hub/dispatch.ts` by T-1792, T-1790, T-1794, T-1791 and T-1814; `hub/src/host/logins.ts` by T-1793, T-1789, T-1792, T-1790 and T-1814; `hub/src/host/login-add.ts` by T-1789, T-1790, T-1794 and T-1791; `hub/src/host/login-cards.ts` by T-1789, T-1792 and T-1790; `hub/src/host/login-card-signin.ts` by T-1791 and T-1814; `hub/src/adapters/sessions.ts` by T-1789, T-1790 and T-1794; `hub/src/hub/daemon.ts` by T-1793, T-1790 and T-1791; `hub/src/host/login-release.ts` by T-1793 and T-1790; `hub/src/host/provision-host.ts` by T-1810 and T-1790; `docs/agents/host-agent.md` by T-1794, T-1815, T-1791 and T-1814. E1535S4-02 names every later commit that touched a member's files.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. E1535S4-04 checks that every row id named here exists in the tables below. VERIFIED at `99356638a` (every landed member's test titles read from the test files at `99356638a`, byte-unchanged at `9c98a5747`; the T-1789, T-1792 and T-1793 rows first read at `25e4525ae` and re-read there; T-1795's criteria and marks read with `task view T-1795 --json` at `792c9c301`, each criterion `checked` with its current `rev-35-1795-final-1` mark at `90410ef27`, and its docs read at `a03cd7b97`). Generated titles are named as expansions of their templates; `expect.json` holds every full title.

| criterion | proven by |
| --- | --- |
| T-1789 C1 (each listed signal from each fake harness on a fake host marks the session's login `signed-out` with its host) | E1535S4-10 (the eight expansions of `<harness> classifies dead login <reason>`; test `hub login-dead callback persists sign-out and routes the next launch away without stopping existing sessions`; test `Claude remote hooks report login death; local hooks retain their signed-out latch`; test `OpenCode stream classifies provider.auth only for the owning session`; the three expansions of `Codex remote native error reports dead login <reason> without stopping` in `codex-host`); E1535S4-60 (native OpenCode `provider.auth`; native Codex and Claude Code are T-1813); E1535S4-03 |
| T-1789 C2 (the next launch skips that host; sessions there keep running, no stop, no exit) | E1535S4-10 (the login-dead callback test above); E1535S4-60 (the next launch's native PID on the other host, the original PID alive, no stop call) |
| T-1789 C3 (one sign-in card per sign-out, folding when the login reads `ready`) | E1535S4-10 (the `work` and `constructor` expansions of `sign-in card for <name> is once per sign-out, survives reconstruction, and folds on ready`; test `rapid same-clock sign-outs replace the old card and keep distinct notice receipts`; test `Not now remains folded for its durable episode after card-owner reconstruction`); E1535S4-03 |
| T-1789 C4 (a local session's signal changes no login and keeps the local latch) | E1535S4-10 (the Claude hooks test above; test `reader reports sign out the bound login once and local or unrelated reports do nothing`); E1535S4-03 |
| T-1789 C5 (one Agents line naming login, host and signal) | E1535S4-10 (test `notice retention does not republish a still-signed-out episode after restart`; test `project startup recovers an episode committed before card and notice publication`; the three expansions of `signed-out reconstruction repairs publication <fault>`); E1535S4-03 |
| A-18760 one sign-out path and one card per episode (decisions; no ticket criterion) | E1535S4-10 (test `every sign-out requires its durable episode owner, including failed sign-in`; test `signed-out rows missing durable episode identity refuse recovery explicitly`; test `signed-out recovery streams only indexed active rows across retained login history`); E1535S4-03 |
| T-1790 C1 (`cland login signin` on a signed-out login runs the fake sign-in over `ssh -t` on its host, same volume id, no volume created) | E1535S4-61 (test `native bound Codex renews its own dead credential home without replacing the disk`); E1535S4-40 (test `sign-in admission retains bindings, fences competing attempts and publishes renewed in-use state`); E1535S4-03 |
| T-1790 C2 (freeze, snapshot and thaw through the snapshot owner; in-use while bound or ready when unbound; new last sign-in) | E1535S4-40 (test `renewing a mounted login snapshots under freeze and keeps the writer mounted`; test `renewal snapshot owner joins held freeze before release can thaw or shutdown can finish`; test `renewal rate refusal publishes native success and the shared owner retries its pending backup`; the three expansions of `renewal freeze recovery <outcome>`; the four expansions of `renewal fences <mutation> across held inventory before freeze or snapshot`); E1535S4-35 (both expansions of `renewal drains an older held snapshot generation then <outcome>`); E1535S4-03 |
| T-1790 C3 (sessions keep running through the sign-in; their next turn uses the renewed login) | E1535S4-61 (`native opencode sign-in renews the mounted writer with relaunch false`: the same PID keeps running and its renewed turn lands on the same volume; Codex and Claude Code next-turn renewal is T-1813 by decision 82ab5bec) |
| T-1790 C4 (a signed-out login bound nowhere is attached and mounted on a ready pool host, then detached) | E1535S4-61 (test `native sign-in of unbound Claude, Codex and OpenCode disks reuses and detaches each volume`) |
| T-1790 C5 (a second sign-out of one account within 24 h adds the one-sign-in hint to the card, the Agents line and `login list`; 24 h or more later does not) | E1535S4-10 (the four expansions of `one-sign-in hint uses account and an exclusive 24h clock window (<elapsed>ms)`; test `removal sign-out does not count as a dead-login episode for the shared account hint`); E1535S4-30 (test `recovered one-sign-in hint appears in the card, Agents notice and login list`); E1535S4-03 |
| T-1790 recovery policy (decisions e516d138, feb9d4e1, 1cd13e7f; no ticket criterion) | E1535S4-40 (test `interrupted admission stays fenced across time and replacement births until its exact machine deletion receipt`; test `restart reverts an admitted renewal without native effects, retains bindings and refuses the old token`; test `startup sign-in recovery reads only indexed admissions across retained login history`; test `unbound renewal interruption retains its native fence without invoking disk cleanup`; the five expansions of `sign-in refuses retained <fence> ownership`); E1535S4-42 (the seven expansions of `renewal terminal <outcome> distinguishes native close receipt from owner loss`); E1535S4-35 (test `confirmed host destruction clears interrupted renewal and detached snapshot release fences`; both machine-deletion expansions); E1535S4-30 (test `login remove refuses an interrupted unbound renewal until its exact machine deletion receipt`); E1535S4-03 |
| T-1815 C1 (a fake harness sign-in on a fake host's agent gets a hub-written input line on stdin and streams its output within a fixed byte bound) | E1535S4-73 (test `sign-in streams bounded output, redacts split input echoes and persists its exact close`; test `sign-in output overflow terminates with an explicit bounded close outcome`); E1535S4-43 (test `sign-in planners use only public harness arguments and mounted paths`); E1535S4-03 |
| T-1815 C2 (the exit is a close receipt with code or signal, pinned to the admission; another admission's receipt refused) | E1535S4-43 (test `a close receipt for another admission is refused and never settles this run`; the three expansions of `malformed close <exit> stays incomplete`; test `connection loss after admission has no native close receipt`; test `optional sign-in contract covers absence, typed refusal and admission-bound shape with planted controls`); E1535S4-73 (the exact close of the first case); E1535S4-03 |
| T-1815 C3 (a hub cancel ends the process tree and reports its close receipt; nothing unmounted before it) | E1535S4-73 (test `sign-in cancel joins descendants and durable close before unmount`; test `post-release rejection retains descendant birth and refuses unmount`; test `failed native-close publication emits incomplete and refuses a waiting unmount`); E1535S4-43 (test `uncertain rejection after native admission retains the operation and disk hold`; test `native completion failure reaches the peer and retains writer admission`); E1535S4-03 |
| T-1815 C4 (the input bytes in no log line, journal record, agent file or receipt) | E1535S4-43 (test `registered input is hidden across every output split and at close`); E1535S4-73 (the first case's split input echoes and persisted close); E1535S4-03 |
| T-1815 C5 (`host-agent-boundary` and `host-agent-closure` pass with the regenerated closure) | E1535S4-43 (`hub/test/host-agent-boundary.test.ts` and `hub/test/host-agent-closure.test.ts` `CLEAN`, unedited) |
| T-1791 C1 (Create one on the test messenger creates a login of that harness and pool and raises a card with the fake sign-in's link and code) | E1535S4-45 (test `Create one offers the Claude link and its secret answer completes one snapshot`; the `1` expansion of `login card option <option> folds once across retries and restart`); E1535S4-72 (both expansions of `native Claude card creates and renews one disk across both remotes with <outcome>`); E1535S4-03 |
| T-1791 C2 (the fake Claude Code's free answer reaches the sign-in prompt's input; the login reads `ready` with one snapshot) | E1535S4-45 (the Create one case above; test `a prompt emitted during held native start becomes actionable only with its captured input handle`); E1535S4-72 (the native Claude card expansions); E1535S4-03 |
| T-1791 C3 (the fake Codex reads `ready` when the device sign-in finishes, with no answer) | E1535S4-45 (both expansions of `Codex <format> output raises its code card and closes ready without an answer`); E1535S4-72 (test `native Codex card completes device sign-in without an answer`) |
| T-1791 C4 (Sign in again re-runs on the login's host and volume; the card folds on both remotes) | E1535S4-45 (both expansions of `test messenger signs a disk in again through the <binding>`; the six expansions of `hub cards publish and fold both native copies after <via>`); E1535S4-72 (the native Claude card's renewal on the same host and volume through the other messenger); E1535S4-03 |
| T-1791 C5 (the pasted code in no log line, journal record, history row or remote outcome line) | E1535S4-45 (test `secret hub answers reach the handler verbatim and remote replay stores message identity`; both expansions of `native secret <via> retention probe`; test `test messenger preserves only the stored sign-in link and masks other URLs and registered bytes`; test `Telegram secret prompt checkpoint retains native ingress and drops code text and hash`); E1535S4-72 (the bounded no-symlink scan for the pasted sentinel after a planted positive control); E1535S4-03 |
| T-1791 C6 (15 minutes of hub clock withdraws the card and leaves the login `signed-out` with its volume) | E1535S4-45 (test `the fifteen-minute limit waits for the matching cancellation close before signing out`); E1535S4-72 (test `native cancelled Claude card closes its admitted writer before failed disk completion`: the native close before `signed-out` with the volume kept); E1535S4-03 |
| T-1791 C7 (a messenger that can delete deletes the code message after the hub reads it; otherwise one line says so) | E1535S4-45 (both expansions of `secret card native replay retains message identity with <outcome>`; test `Discord deletes the exact native message and confirms an already absent replay`; test `Telegram deletes the exact native message after a confirmed API result`; test `secret cleanup recovers captured ingress without a repeated update and retries on the hub clock`); E1535S4-72 (deletion or one fallback on the captured sender); E1535S4-46 (the gateway's unedited consumers of the edited test messenger); E1535S4-03 |
| T-1814 C1 (a peer close mid-add on a fake host leaves the disk mounted and attached and records the interrupted add with its host) | E1535S4-42 (the `disconnect` expansion of `new login terminal <outcome> retains disk until owner close or exact machine deletion`; both `peer close` expansions of `<held/rejected> new-login preparation records interruption after <loss>`); E1535S4-66 (`login-add`'s terminal disconnect: `sign-in interrupted` with the captured host, the volume attached to that machine, its mount symlink); E1535S4-03 |
| T-1814 C2 (a graceful hub stop mid-add does the same) | E1535S4-42 (the `hub stop` expansion above; both `hub stop` preparation expansions); E1535S4-03 |
| T-1814 C3 (the CLI's own post-close completion keeps today's success and failure; an exact-machine deletion receipt settles an interrupted add) | E1535S4-42 (the `exit success`, `exit failure`, `exit null` and `recovery` expansions of the new-login terminal test; the `attach`, `mount` and `publish` expansions of `sign-in revalidates captured host authority after <boundary>`); E1535S4-40 (both expansions of `new login revalidates recovered admission after held <boundary>`; both expansions of `new login preparation distinguishes <failure>`); E1535S4-67 (`login-terminal`: the CLI's native SSH ownership through close); E1535S4-03 |
| T-1814 C4 (a Create one run that ends without the agent's close receipt is recovered by the same owner, its exact machine captured, the disk kept until that machine's deletion receipt or the owner's close) | E1535S4-45 (both expansions of `unknown Create one outcome retains its mounted disk and reports the captured login and host once: <failure>`; test `recovered unknown new-login intent keeps disk ownership and publishes the named cut once`; test `a close without a native exit fact interrupts rather than authorizing disk cleanup`); E1535S4-03 |
| T-1794 C1 (`[hosts] relaunch_after_signin` parses as a boolean defaulting to false, refused otherwise naming the key, applied on hot reload) | E1535S4-47 (test `hosts relaunch_after_signin defaults false, accepts booleans and init omits it`; test `config set applies optional template keys now with normalized parser readback`, which sets both values with `applies now`; test `config set refuses unknown keys, invalid parser values and silently ignored values without changing bytes`, which refuses the string `'true'`); E1535S4-03 |
| T-1794 C2 (false relaunches nothing) | E1535S4-47 (the `disabled` expansion of `renewal <outcome> relaunches only the signed-in host and harness after durable success`); E1535S4-61 (`native opencode sign-in renews the mounted writer with relaunch false`: the same PID); E1535S4-03 |
| T-1794 C3 (true relaunches each session of that harness on the host in its worktree with its conversation resumed; other harnesses untouched) | E1535S4-47 (the `enabled`, `failed` and `interrupted` expansions above; the three expansions of `sign-in relaunch yields to queued <competitor> at lifecycle admission`); E1535S4-61 (`native opencode sign-in renews the mounted writer with relaunch true`: a new PID with the same conversation, worktree and session); E1535S4-03 |
| T-1792 C1 (remove of an in-use login refused naming its host, nothing changed) | E1535S4-30 (test `in-use and creating refusals retain every byte and name the host or running sign-in`; test `remove CLI refuses a bound login, then removes ready storage and leaves list after release`); E1535S4-03 |
| T-1792 C2 (after the host stops, the volume and both snapshots deleted with confirming reads; the login leaves `login list`) | E1535S4-30 (both tests above); E1535S4-03 |
| T-1792 C3 (an unconfirmed deletion keeps the row with the remaining ids; nonzero exit naming them) | E1535S4-30 (test `unconfirmed volume delete retains exact id and storage accrual, retry completes after restart`; test `remove CLI reports remaining volume and persists the real signed-out removal receipt`; test `a lost volume-delete response retries from its captured identity after the volume disappears`); E1535S4-03 |
| T-1792 C4 (a key login's file and row removed; the `[auth]` key kept) | E1535S4-30 (test `remove key deletes only its encrypted file and metadata, retaining the auth store key`); E1535S4-84 (scratch: the real CLI); E1535S4-03 |
| T-1792 C5 (removing a `creating` login refused naming the running sign-in) | E1535S4-30 (the in-use and creating refusals test); E1535S4-03 |
| T-1792 C6 (confirmed deletions recorded through `deleteStorage`; only unconfirmed items keep accruing; a fully removed login leaves host status) | E1535S4-30 (the unconfirmed volume test; both expansions of `snapshot receipt recovery restores accounting and partial-delete accrual; reopen=<reopen>`; the four expansions of `direct removal repairs failed snapshot accounting; reopen=<reopen>; partial=<partial>`); E1535S4-03 |
| A-18760 removal fences and card suppression (decision; no ticket criterion) | E1535S4-30 (the three expansions of `removal suppresses unusable sign-in cards and preserves genuine notice; <scenario>`; test `sign-in card eligibility uses removal claim rather than sign-out reason text`; test `hub startup reconciliation preserves removal claim and unsettled snapshot admission`; test `pending reader intent refuses removal without clearing its owner fence`; both expansions of `unknown snapshot keeps removal fenced through retry and reconciliation; reopen=<reopen>`); E1535S4-03 |
| T-1793 C1 (a fake host its watchdog deleted while the hub was stopped leaves its login `ready`, same volume, after the next start) | E1535S4-62 (`host-restart`, the native C1 and C2 proof); E1535S4-20 (the `deleted=true` expansion of `settled fixture login restart follows positive provider volume inventory; deleted=<deleted>`); E1535S4-03 |
| T-1793 C2 (a login bound to a live host stays `in-use` through a restart; its sessions keep using it) | E1535S4-62 (live worker and binding retained, the same rotated bytes through the Host); E1535S4-20 (the `deleted=false` expansion above) |
| T-1793 C3 (a gone host's reader volume deleted at start with a confirming read) | E1535S4-20 (the four expansions of `detached reader deletion has a provider receipt and storage stamp; phase=<phase>`; test `unknown reader deletion intent obtains exact-id deletion receipt after inventory omission`; both expansions of `unknown host reader cleanup survives signed-out metadata; missing original=<missing>`); E1535S4-03 |
| T-1793 C4 (a login whose volume is not listed reads `signed-out` with `volume missing`) | E1535S4-20 (test `missing volume signs out while failed inventory preserves rows and retries once`; both expansions of `held old inventory cannot sign out a newly published ready identity; volume=<volumeId>`); E1535S4-03 |
| T-1793 C5 (a failed inventory changes no login, is retried, one Agents line) | E1535S4-20 (the missing-volume test above); E1535S4-03 |
| T-1793 C6 (pending bindings and reader intents left to their owners; confirmed deletions through `deleteStorage`) | E1535S4-20 (the `pending`, `creating` and `deleted` phase expansions above; test `reconciliation preserves retained snapshot receipt through its release owner`; test `writer snapshot-fence wait retains a replacement binding episode`; test `signed-out receipt retains bindings, removes capacity and clears on sign-in`); E1535S4-03 |
| A-18760 terminal host state (T-1810, out of stage) | E1535S4-62 (`host-restart`: the gone host's first `destroyed` stays); E1535S4-35 (test `destroyed host release retry settles disk without a provision write`); E1535S4-03 |
| T-1795 C1 (a new ADR in `docs/adr/` states what cland stores and never stores for logins, and links spec v0.4 §3.7 and §3.12) | E1535S4-07 (`ADR files for login storage: 1`, `docs/adr/0009-login-storage-boundary.md`); E1535S4-03 (the five `T-1795 C1` lines: both v0.4 links, the stored metadata, the never-read disk contents, the link to the notes) |
| T-1795 C2 (spec v0.1.2 §3.13 carries an appended, dated amendment naming logins on hosts and linking the ADR, with no existing paragraph changed) | E1535S4-07 (`dated logins amendment paragraphs inside section 3.13: 1`, `spec v0.1.2 amendment lines naming logins: 1`, `pre-stage lines of docs/spec/v0.1.2.md changed or removed: 0`); E1535S4-03 (the three `T-1795 C2` lines) |
| T-1795 C3 (`docs/hub/logins.md` covers login states, binding, release, snapshots, the key store, the login cards and reconciliation) | E1535S4-07 (the seven `logins notes heading lines with <word>` probes, each with its count read at `a03cd7b97`, and `logins notes state-transition lines: 1`); E1535S4-03 (the two `T-1795 C3` lines); E1535S4-56 (`test-docs`: the four new signin notes and their index rows) |
| T-1795 C4 (the closed-item wording lint passes on the three files) | E1535S4-07 (`closed-item wording lint exit 0`, sealed, at the build) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1535 --json` lists in stage `signed out, signing in again and from cards, remove, reconciliation and the amendment`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member needs a landing here**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `792c9c301dca0826bddee517d8614bffd59b608b`, and unchanged at `9c98a5747`): T-1793 landed as `15ee52343` (`15ee523432c0b8e2acbab8552b40485eaeec947c`), T-1789 as `f10710982` (`f1071098238ed3aa9aa4ff73fe5e3e685a8bdbdf`), T-1792 as `ee483c2a0` (`ee483c2a0210d2e0f333f51cfcdc768093ecdb30`), T-1790 as `44a2775c9` (`44a2775c9f7fb25fca92f9f528fca3b34dec495c`), T-1794 as `6aa8c95df` (`6aa8c95df36f133ea36003b5f66c1a863ad24a1b`), T-1815 as `7d2f0a59b` (`7d2f0a59bc03d2b2e6f07359204d079921d5c7b8`), T-1791 as `3cfbebfce` (`3cfbebfceed93e7b7c323050397537e6f440cad8`), T-1814 as `1dcb32ec4` (`1dcb32ec4a7d124b034d8213f41c83432a0bebb4`) and T-1795 as `a03cd7b97` (`a03cd7b970bb18b1dee041d5972cf72a19db2f0b`, a direct landing with no merge batch), each with exactly one `Item:` trailer on the first-parent history (VERIFIED: `git log --first-parent --grep "^Item: T-1795$"` prints only `a03cd7b97…` at `792c9c301` and at `9c98a5747`); T-1810 landed out of stage as `a38929ae8` (`a38929ae8b2ed60cc7e2a50abd02735b7f3c6094`) and T-1818 as `68ed9d82b` (`68ed9d82b489ed5e74817bd842b3b7e040194c8f`). The plan read at `792c9c301` (VERIFIED with `task plan show E-1535 --json`): the stage `open`, `items` in the plan order "Stage" lists, `merged 9`, `total 9`, `statuses {"done":9}`, cover `tree 5cf18f329f07492aa3379dfd5c863c83cb55a9fc`, `missing ["Linux droplet","macOS"]` (the Coordinator's cover pair is still to run).

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No row needs `web/dist`, a browser or Neovim.

**Where things live, isolation, the three kinds of command and removals: exactly as stage 3** (carried at `M4`): `$Q` (`/private/tmp/q53-…`, 23 bytes) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`) are the only scratch roots; native rows read the system per-user TMPDIR `$ST` and `/private/tmp` and write nothing there; the scratch project is `$Q/p1`; the only paths under the repository are `$W` in `.cland/worktrees/` and `$EV` in `.cland/qa/E-1535/<run>/`; nothing is written to `.cland/tasks/`. Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, never the human's HOME; never `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland host …` or `cland hub …` against the live project. QA's own shell reads the live hub only for the plan and item reads and `quiet`. Every `rm` names one literal path.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json` (`>=24.13.0 <25`). If TMPDIR is unset in QA's shell, export it to the value `getconf DARWIN_USER_TEMP_DIR` prints. In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
K=f43f4e21049e9c62a97c8dec1ebf37f9c7035a62     # the fixed kit commit (A-17643: pin a commit, never a blob)
M2=0d0618042fae7b76919d1be152e252b09e4a43ad    # the stage-1 brief's carried corrections
M3=18911bda46c7c0dc332619e93d25041069d3704a    # the stage-2 brief: its helpers and carried corrections
M4=85e60f6cb34ec320cc7a1f5456de3a4693acbe17    # the stage-3 brief with run-1 corrections C-1, R-1, R-2: its functions and carried corrections
RUN=qa-e1535s4-$(date +%F)-1                   # unique run id for E-1535; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
echo "QA shell credential-prefix names: $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
W=$R/.cland/worktrees/qa-e1535s4-$RUN
EV=$R/.cland/qa/E-1535/$RUN
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
ST=$(cd "$(getconf DARWIN_USER_TEMP_DIR)" && pwd -P)
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh" "$Q/bin" "$Q/kit"
chmod 700 "$Q/claude" "$Q/fake-claude"
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","ST":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$ST" "$QA_SESSION" > "$Q/state.json"
carried() { git -C "$R" show "$1:qa/briefs/$2.md" | awk '/^## Carried corrections/{f=1} /^## Stage$/{exit} f' > "$EV/carried-from-$3.md"; echo "$3 commit $(git -C "$R" rev-parse "$1^{commit}"); carried lines $(wc -l < "$EV/carried-from-$3.md" | tr -d ' ') want $4; sha1 $(shasum < "$EV/carried-from-$3.md" | cut -c1-40)"; }
carried "$M2" E-1535-stage-1 M2 127; carried "$M3" E-1535-stage-2 M3 55; carried "$M4" E-1535-stage-3 M4 80
echo "M4 stage-3 brief blob $(git -C "$R" rev-parse "$M4:qa/briefs/E-1535-stage-3.md") want b2febfa90b5b88c41cdf1954303543b6a3953359"
```

Expected: the three commits equal `M2`, `M3`, `M4`; carried lines 127, 55 and 80; the `M4` carried SHA-1 `e4ad4448829797e25c364afad87b0f3f2cf3b06e`; the blob equal to `want`.

**The kits and helpers, from fixed commits.** From `K` and `M3` exactly as stage 3 took them; from `M4` the stage-3 functions by line range. A missing block or a SHA-1 other than `want` is a setup BLOCKED.

```sh
for b in E-1532-stage-4 E-1533-stage-3; do git -C "$R" show "$K:qa/briefs/$b.md" > "$Q/kit/$b.md"; done
git -C "$R" show "$M3:qa/briefs/E-1535-stage-2.md" > "$Q/kit/E-1535-stage-2.md"
git -C "$R" show "$M4:qa/briefs/E-1535-stage-3.md" > "$Q/kit/E-1535-stage-3.md"
sed -n '133,136p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-shell.sh"; sed -n '228,279p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
kitb() { awk -v n="$2" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/$1.md"; }
for n in seal.mjs fresh.mjs frame.mjs body.sh helpers.sh; do kitb E-1533-stage-3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: $(head -n 1 "$Q/kit3-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ')"; . "$Q/kit3-$n.sh"; done
for n in std.mjs invd.mjs rcp.mjs; do kitb E-1535-stage-2 "$n" > "$Q/kit2-$n.sh"; echo "kit2 $n: $(head -n 1 "$Q/kit2-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit2-$n.sh" | tr -d ' ')"; . "$Q/kit2-$n.sh"; done
kitr() { sed -n "$3" "$Q/kit/$1.md" > "$Q/$2.sh"; echo "$2: sha1 $(shasum < "$Q/$2.sh" | cut -c1-40) want $4"; }
kitr E-1535-stage-2 kit2-fns '308,332p' 7d3265fb3617e213677b78ee5a78cb95aa12eae6          # snapt, snaps, nt, slot, unslot, ns
kitr E-1535-stage-2 kit2-mrow '336,337p' 9f2fc5c7c2f7ba41f5fbec54a9db636cfe014e57         # mrow
kitr E-1535-stage-2 kit2-s0 '345,347p' 6ec8beed74eb77e5f2620b034a1373099ab3e63e           # the S0 environment probes
kitr E-1535-stage-2 kit2-checks '857,861p;870p;901,915p' eff5097fdb01c670d784454447777dd771be3dbd   # ownlines, s01, s99
kitr E-1535-stage-2 kit2-scratch '922p;965,973p' 65943c4003fe5a3470de235d677def6f9a0116dc    # sentinels, r89
kitr E-1535-stage-3 kit3-checks '737p;743,745p;748,755p' 3a747a75f89dd49791888683cae6949c55dd9647   # landing, durdelta, s00
kitr E-1535-stage-3 kit3-scratch '813,839p;851,860p' da282d723d88e6490c402e450c6598d842b849d4      # SENT, SENT2, r80 (with R-2), r81, r83
. "$Q/kit2-fns.sh"; . "$Q/kit2-mrow.sh"
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/frame.mjs" && node --check "$Q/std.mjs" && node --check "$Q/invd.mjs" && node --check "$Q/rcp.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && bash -n "$Q/kit2-checks.sh" && bash -n "$Q/kit2-scratch.sh" && bash -n "$Q/kit3-checks.sh" && bash -n "$Q/kit3-scratch.sh" && echo "kits checked"
. "$Q/kit2-s0.sh"
```

Expected: `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; each `kit3` and `kit2` heredoc line starts with `cat > "$Q/<name>" <<'` (`kit2 std.mjs` 58 lines, `invd.mjs` 25, `rcp.mjs` 20); every `sha1` equal to its `want`; `kits checked`; then the S0 lines exactly as stage 3 expected them (both seals with no credential-prefix name, `TMPDIR is T true`, `HOME is Q/home true`; `std` with the user HOME and system TMPDIR, `NODE_COMPILE_CACHE set false`; `Q bytes 23`; each redaction count 0). A `std: BLOCKED` line or a non-zero credential count stops the run (BLOCKED).

**This brief's own helpers.**

```sh
OWN61='^(key-spawn-|key-composed-)'          # login-key-spawn: mkdtemp key-spawn-, tempProject key-composed-
OWN65='^(cland-proj-|cland-init-machine-)'    # host-stop tempProject default; host-unreachable (stage-2 run-1 correction)
OWN71='^(cland-proj-|fake-opencode-)'         # opencode-adapter
```

The TAP expectations (`exact: true` lists every registration; `exact: false` with names requires them; with `[]` the whole file must be `CLEAN`). Every list was read from the test files at `99356638a` and expanded through its loops (VERIFIED; the count of `test(` call sites in each exact file equals its registration lines): T-1789's, T-1792's and T-1793's (`login-reconcile` 22, `login-signed-out-native` 1, and the subsets), T-1790's (`login-signed-out` 30, `login-remove` 26, `login-signin-recovery` 3, `login-list` 5; byte-identical to T-1790's draft head `85352c52d` in those four files), the files later landings also edited (`login-signin` 31 with T-1790's and T-1814's cases, `login-add-component` 22, `login-host-pin` 13, `login-resignin-native` 4 after T-1794's `relaunch <false|true>` split of T-1790's third case, `login-snapshots` with T-1790's pair), T-1815's (`signin-client` 6, `signin-command` 1, `signin-owner` 4, `signin-redactor` 1, `host-agent-client` 1, `host-agent-signin-op` 5, and the subsets), T-1791's (`login-card-signin-owner` 12 after T-1814's `: <failure>` split, `login-card-signin-remote` 8, `login-card-recovery` 8, `login-card-signin` 4, `login-wait` 8, and the subsets) and T-1794's (`login-relaunch` 9 and the subsets). The unedited files' lists are stage 3's, unchanged (VERIFIED: `git diff 85e60f6cb 99356638a` empty for each, `host-agent-boundary`, `host-agent-closure` and the four gateway consumers included).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/login-signed-out.test.ts": {"exact": true, "names": [
  "removal sign-out does not count as a dead-login episode for the shared account hint",
  "one-sign-in window pruning bounds expired history without decoding login rows",
  "renewal selection and finish bound retained reader history",
  "one-sign-in hint uses account and an exclusive 24h clock window (0ms)",
  "one-sign-in hint uses account and an exclusive 24h clock window (86399999ms)",
  "one-sign-in hint uses account and an exclusive 24h clock window (86400000ms)",
  "one-sign-in hint uses account and an exclusive 24h clock window (86400001ms)",
  "project startup recovers an episode committed before card and notice publication",
  "notice retention does not republish a still-signed-out episode after restart",
  "Not now remains folded for its durable episode after card-owner reconstruction",
  "signed-out rows missing durable episode identity refuse recovery explicitly",
  "signed-out reconstruction repairs publication before-card",
  "signed-out reconstruction repairs publication after-card",
  "signed-out reconstruction repairs publication after-notice",
  "rapid same-clock sign-outs replace the old card and keep distinct notice receipts",
  "hub login-dead callback persists sign-out and routes the next launch away without stopping existing sessions",
  "sign-in card for work is once per sign-out, survives reconstruction, and folds on ready",
  "sign-in card for constructor is once per sign-out, survives reconstruction, and folds on ready",
  "reader reports sign out the bound login once and local or unrelated reports do nothing",
  "Claude remote hooks report login death; local hooks retain their signed-out latch",
  "OpenCode stream classifies provider.auth only for the owning session",
  "claude-code classifies dead login authentication_failed",
  "claude-code classifies dead login Login expired",
  "claude-code classifies dead login OAuth token revoked",
  "claude-code classifies dead login 401",
  "codex classifies dead login refresh_token_reused",
  "codex classifies dead login unauthorized",
  "codex classifies dead login 401",
  "opencode classifies dead login provider.auth",
  "ordinary failures, model output and other harness signals are not dead logins"]},
 "hub/test/codex-host.test.ts": {"exact": false, "names": [
  "Codex remote native error reports dead login refresh_token_reused without stopping",
  "Codex remote native error reports dead login unauthorized without stopping",
  "Codex remote native error reports dead login 401 without stopping"]},
 "hub/test/login-native-environment.test.ts": {"exact": false, "names": [
  "native login decoration retains admitted account and routing fields with sealed inherited environment"]},
 "hub/test/login-records.test.ts": {"exact": false, "names": [
  "every sign-out requires its durable episode owner, including failed sign-in",
  "signed-out recovery streams only indexed active rows across retained login history"]},
 "hub/test/login-capacity.test.ts": {"exact": false, "names": []},
 "hub/test/login-add-component.test.ts": {"exact": true, "names": [
  "renewal terminal disconnect distinguishes native close receipt from owner loss",
  "renewal terminal hub stop distinguishes native close receipt from owner loss",
  "renewal terminal interrupt distinguishes native close receipt from owner loss",
  "renewal terminal exit success distinguishes native close receipt from owner loss",
  "renewal terminal exit failure distinguishes native close receipt from owner loss",
  "renewal terminal exit null distinguishes native close receipt from owner loss",
  "renewal terminal disconnect after receipt distinguishes native close receipt from owner loss",
  "new login terminal disconnect retains disk until owner close or exact machine deletion",
  "new login terminal hub stop retains disk until owner close or exact machine deletion",
  "new login terminal recovery retains disk until owner close or exact machine deletion",
  "new login terminal exit success retains disk until owner close or exact machine deletion",
  "new login terminal exit failure retains disk until owner close or exact machine deletion",
  "new login terminal exit null retains disk until owner close or exact machine deletion",
  "rejected new-login preparation records interruption after peer close",
  "rejected new-login preparation records interruption after hub stop",
  "held new-login preparation records interruption after peer close",
  "held new-login preparation records interruption after hub stop",
  "login add disconnect settles only its admitted connection",
  "login add failure settles only its admitted connection",
  "login add success settles only its admitted connection",
  "login add preparation failure reaches CLI without a terminal plan",
  "dispatcher shutdown joins every login closer and still closes the suite owner after failure"]},
 "hub/test/login-host-pin.test.ts": {"exact": true, "names": [
  "terminal outcome 0 holds its host through cleanup and releases the pin",
  "terminal outcome 1 holds its host through cleanup and releases the pin",
  "terminal outcome null holds its host through cleanup and releases the pin",
  "login admission refuses INVALID before host creation or pinning",
  "login admission refuses work before host creation or pinning",
  "login admission refuses empty name before host creation or pinning",
  "a pinned host renews its lease and idle-stop waits for unpinning",
  "sign-in revalidates captured host authority after create",
  "sign-in revalidates captured host authority after attach",
  "sign-in revalidates captured host authority after mount",
  "sign-in revalidates captured host authority after publish",
  "sign-in revalidates captured host authority after replacement",
  "login add creates a host while its only login is still creating"]},
 "hub/test/signin-client.test.ts": {"exact": true, "names": [
  "a close receipt for another admission is refused and never settles this run",
  "connection loss after admission has no native close receipt",
  "malformed close {\"code\":null,\"signal\":null} stays incomplete",
  "malformed close {\"code\":null,\"signal\":\"\"} stays incomplete",
  "malformed close {\"signal\":\"SIGTERM\"} stays incomplete",
  "missing capability is positively not admitted without a native request"]},
 "hub/test/signin-command.test.ts": {"exact": true, "names": [
  "sign-in planners use only public harness arguments and mounted paths"]},
 "hub/test/signin-owner.test.ts": {"exact": true, "names": [
  "uncertain rejection after native admission retains the operation and disk hold",
  "native completion failure reaches the peer and retains writer admission",
  "settled native objects retire and only a bounded receipt cache remains",
  "peer shutdown joins another run receipt checkpoint after one run fails"]},
 "hub/test/signin-redactor.test.ts": {"exact": true, "names": [
  "registered input is hidden across every output split and at close"]},
 "hub/test/host-agent-client.test.ts": {"exact": true, "names": [
  "new client accepts original protocol-1 hello without capabilities"]},
 "hub/test/host-contract-coverage.test.ts": {"exact": false, "names": [
  "Host contract exercises every interface member and detects an uncovered addition",
  "optional sign-in contract covers absence, typed refusal and admission-bound shape with planted controls"]},
 "hub/test/accounts-policy.test.ts": {"exact": false, "names": [
  "mounted database path permits only one exact pure agent helper"]},
 "hub/test/host-agent-boundary.test.ts": {"exact": false, "names": []},
 "hub/test/host-agent-closure.test.ts": {"exact": false, "names": []},
 "hub/test/login-card-signin-owner.test.ts": {"exact": true, "names": [
  "a prompt emitted during held native start becomes actionable only with its captured input handle",
  "Create one offers the Claude link and its secret answer completes one snapshot",
  "unknown Create one outcome retains its mounted disk and reports the captured login and host once: native loss",
  "unknown Create one outcome retains its mounted disk and reports the captured login and host once: setup failure",
  "card shutdown joins a held second native writer after the first writer fails",
  "a close without a native exit fact interrupts rather than authorizing disk cleanup",
  "accepted card intent interrupted before follow-up reports once on owner recovery",
  "runner refusal with not-admitted proof completes failed",
  "runner refusal without proof interrupts",
  "Codex device label output raises its code card and closes ready without an answer",
  "Codex one-time prompt output raises its code card and closes ready without an answer",
  "the fifteen-minute limit waits for the matching cancellation close before signing out"]},
 "hub/test/login-card-signin-remote.test.ts": {"exact": true, "names": [
  "secret card native replay retains message identity with deletion",
  "secret card native replay retains message identity with one fallback notice",
  "acknowledged secret cleanup survives component reopen without another native update",
  "test messenger signs a disk in again through the shared injected preparation entry",
  "test messenger signs a disk in again through the default Host.signIn operation",
  "test messenger preserves only the stored sign-in link and masks other URLs and registered bytes",
  "card fixture setup failure and failed gateway close keep storage owned until all safe joins settle",
  "Telegram secret prompt checkpoint retains native ingress and drops code text and hash"]},
 "hub/test/login-card-recovery.test.ts": {"exact": true, "names": [
  "secret cleanup recovers captured ingress without a repeated update and retries on the hub clock",
  "Discord adapter stop joins its native deletion after cancellation",
  "card recovery retires a positively completed login without an unknown-outcome notice",
  "failed unknown-outcome notice retains its intent for one later recovery publication",
  "Gateway shutdown joins a held second deletion after the first durable checkpoint fails",
  "card intent recovery pages only captured active records off the startup turn",
  "secret cleanup startup bounds indexed pages and shares concurrent work per native message",
  "recovered unknown new-login intent keeps disk ownership and publishes the named cut once"]},
 "hub/test/hub-cards.test.ts": {"exact": false, "names": [
  "secret hub answers reach the handler verbatim and remote replay stores message identity",
  "hub cards publish and fold both native copies after web",
  "hub cards publish and fold both native copies after neovim",
  "hub cards publish and fold both native copies after telegram",
  "hub cards publish and fold both native copies after discord",
  "hub cards publish and fold both native copies after withdraw",
  "hub cards publish and fold both native copies after secret",
  "native secret telegram retention probe",
  "native secret discord retention probe"]},
 "hub/test/discord-api.test.ts": {"exact": false, "names": [
  "Discord deletes the exact native message and confirms an already absent replay"]},
 "hub/test/telegram-api.test.ts": {"exact": false, "names": [
  "Telegram deletes the exact native message after a confirmed API result"]},
 "hub/test/login-wait.test.ts": {"exact": true, "names": [
  "login waits share one create card and the final cancellation withdraws it",
  "login cards are scoped by pool and harness across repeated scheduler passes",
  "login add ready receipt wakes host growth, changes the reason and places the launch",
  "login card option 1 folds once across retries and restart",
  "login card option 2 folds once across retries and restart",
  "login card option decline folds once across retries and restart",
  "login create without a sign-in owner keeps the terminal command hint and one wait card",
  "open login card survives restart and a later independent wait gets a new card"]},
 "hub/test/gateway.test.ts": {"exact": false, "names": []},
 "hub/test/gateway-secrets.test.ts": {"exact": false, "names": []},
 "hub/test/gateway-state.test.ts": {"exact": false, "names": []},
 "hub/test/outbox-gateway.test.ts": {"exact": false, "names": []},
 "hub/test/config-set.test.ts": {"exact": false, "names": [
  "config set refuses unknown keys, invalid parser values and silently ignored values without changing bytes",
  "config set applies optional template keys now with normalized parser readback"]},
 "hub/test/login-relaunch.test.ts": {"exact": true, "names": [
  "renewal disabled relaunches only the signed-in host and harness after durable success",
  "renewal enabled relaunches only the signed-in host and harness after durable success",
  "renewal failed relaunches only the signed-in host and harness after durable success",
  "renewal interrupted relaunches only the signed-in host and harness after durable success",
  "sign-in relaunch yields to queued stop at lifecycle admission",
  "sign-in relaunch yields to queued archive at lifecycle admission",
  "sign-in relaunch yields to queued resume at lifecycle admission",
  "relaunch fixture attempts all writer joins and retains storage after incomplete cleanup",
  "relaunch fixture setup failure still closes acquired storage"]},
 "hub/test/login-reconcile.test.ts": {"exact": true, "names": [
  "settled fixture login restart follows positive provider volume inventory; deleted=false",
  "settled fixture login restart follows positive provider volume inventory; deleted=true",
  "unknown host reader cleanup survives signed-out metadata; missing original=true",
  "unknown host reader cleanup survives signed-out metadata; missing original=false",
  "reader inventory cannot replace the captured native volume birth",
  "held reader deletion cannot bless a same-values writer rebind with stale detached inventory",
  "writer snapshot-fence wait retains a replacement binding episode",
  "unknown host delayed detachment is retried through a positive inventory receipt",
  "unknown reader deletion intent obtains exact-id deletion receipt after inventory omission",
  "reconciliation preserves retained snapshot receipt through its release owner",
  "reader-heavy startup uses bounded binding pages without materializing retained bindings",
  "startup cursor decodes only active disks across retained signed-out history",
  "detached reader deletion has a provider receipt and storage stamp; phase=settled",
  "detached reader deletion has a provider receipt and storage stamp; phase=pending",
  "detached reader deletion has a provider receipt and storage stamp; phase=creating",
  "detached reader deletion has a provider receipt and storage stamp; phase=deleted",
  "missing volume signs out while failed inventory preserves rows and retries once",
  "close joins admitted inventory and concurrent callers share the pass",
  "held old inventory cannot sign out a newly published ready identity; volume=old",
  "held old inventory cannot sign out a newly published ready identity; volume=new",
  "fixture disposal joins work and closes storage after an earlier close rejection",
  "signed-out receipt retains bindings, removes capacity and clears on sign-in"]},
 "hub/test/login-selection.test.ts": {"exact": false, "names": []},
 "hub/test/pool-failures.test.ts": {"exact": false, "names": []},
 "hub/test/pool-scale.test.ts": {"exact": false, "names": []},
 "hub/test/session-pool-placement.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch-restart.test.ts": {"exact": false, "names": []},
 "hub/test/host-status.test.ts": {"exact": false, "names": []},
 "hub/test/login-remove.test.ts": {"exact": true, "names": [
  "remove key deletes only its encrypted file and metadata, retaining the auth store key",
  "in-use and creating refusals retain every byte and name the host or running sign-in",
  "login remove refuses an interrupted unbound renewal until its exact machine deletion receipt",
  "unconfirmed volume delete retains exact id and storage accrual, retry completes after restart",
  "a lost volume-delete response retries from its captured identity after the volume disappears",
  "concurrent disk removals join one deletion owner",
  "pending reader intent refuses removal without clearing its owner fence",
  "remove CLI refuses a bound login, then removes ready storage and leaves list after release",
  "removal joins an accepted snapshot and deletes its retained receipt before the row",
  "unknown snapshot keeps removal fenced through retry and reconciliation; reopen=false",
  "unknown snapshot keeps removal fenced through retry and reconciliation; reopen=true",
  "forced fixture failure releases held writers and joins them before storage closes",
  "confirmed snapshot not-sent releases admission for removal",
  "confirmed snapshot refused releases admission for removal",
  "snapshot receipt recovery restores accounting and partial-delete accrual; reopen=false",
  "snapshot receipt recovery restores accounting and partial-delete accrual; reopen=true",
  "remove CLI reports remaining volume and persists the real signed-out removal receipt",
  "hub startup reconciliation preserves removal claim and unsettled snapshot admission",
  "direct removal repairs failed snapshot accounting; reopen=false; partial=false",
  "direct removal repairs failed snapshot accounting; reopen=false; partial=true",
  "direct removal repairs failed snapshot accounting; reopen=true; partial=false",
  "direct removal repairs failed snapshot accounting; reopen=true; partial=true",
  "removal suppresses unusable sign-in cards and preserves genuine notice; ready-full",
  "removal suppresses unusable sign-in cards and preserves genuine notice; ready-partial",
  "removal suppresses unusable sign-in cards and preserves genuine notice; signed-out-partial",
  "sign-in card eligibility uses removal claim rather than sign-out reason text"]},
 "hub/test/login-list.test.ts": {"exact": true, "names": [
  "recovered one-sign-in hint appears in the card, Agents notice and login list",
  "login fixture retains borrowed-store ownership after before-hub failure",
  "login fixture retains borrowed-store ownership after hub-drain failure",
  "login list text and JSON expose rows and hosts, retained across hub restart",
  "login list refuses session, web and remote edges like host list"]},
 "hub/test/login-keys.test.ts": {"exact": true, "names": [
  "key files encrypt a sentinel, reuse the store key and authenticate project and name",
  "key store refuses symlink directories and files and never overwrites a key",
  "a held key-store write fences other key creation and store-key rotation",
  "key admission registers plaintext before storing metadata and refuses invalid ciphertext without a row",
  "store key cannot rotate while a retained key login has lost its file",
  "stdin key CLI publishes metadata only and the hub retains no sentinel bytes"]},
 "hub/test/secrets.test.ts": {"exact": false, "names": []},
 "hub/test/login-exclusive.test.ts": {"exact": false, "names": []},
 "hub/test/login-release.test.ts": {"exact": false, "names": [
  "destroyed host release retry settles disk without a provision write",
  "confirmed host destruction clears interrupted renewal and detached snapshot release fences",
  "machine deletion never borrows interrupted admission authority for another freeze identity",
  "machine deletion abandons an unbound interrupted freeze through snapshot ownership while retaining its receipt"]},
 "hub/test/login-snapshots.test.ts": {"exact": false, "names": [
  "renewal drains an older held snapshot generation then admits its own backup",
  "renewal drains an older held snapshot generation then refuses an invalidated admission",
  "one login save has bounded scheduling work across ten thousand retained logins"]},
 "hub/test/login-snapshot-cli.test.ts": {"exact": false, "names": []},
 "hub/test/login-signin.test.ts": {"exact": true, "names": [
  "new login revalidates recovered admission after held attach",
  "new login revalidates recovered admission after held umount",
  "new login preparation distinguishes refused attach",
  "new login preparation distinguishes unknown mount",
  "unbound renewal interruption retains its native fence without invoking disk cleanup",
  "renewal rate refusal publishes native success and the shared owner retries its pending backup",
  "active renewal refuses replacing its admitted volume before settlement",
  "durable renewal admission refuses binding changes at the final transaction boundary",
  "renewal freeze recovery thaws on the same admitted machine",
  "renewal freeze recovery refuses another birth",
  "renewal freeze recovery refuses absent live host",
  "renewal fences unbind across held inventory before freeze or snapshot",
  "renewal fences episode across held inventory before freeze or snapshot",
  "renewal fences detach across held inventory before freeze or snapshot",
  "renewal fences birth across held inventory before freeze or snapshot",
  "renewal snapshot owner joins held freeze before release can thaw or shutdown can finish",
  "sign-in refuses retained pending ownership",
  "sign-in refuses retained release ownership",
  "sign-in refuses retained snapshot ownership",
  "sign-in refuses retained removal-admission ownership",
  "sign-in refuses retained snapshot-admission ownership",
  "finish sign-in refuses a newly acquired ownership fence without publishing ready",
  "a queued backup without native admission does not strand signed-out renewal",
  "renewing a mounted login snapshots under freeze and keeps the writer mounted",
  "sign-in admission retains bindings, fences competing attempts and publishes renewed in-use state",
  "all harness sign-in plans contain only the documented home and native arguments",
  "production harness command sources contain no logout commands",
  "failed terminal sign-in 1 keeps a detached signed-out disk",
  "failed terminal sign-in null keeps a detached signed-out disk",
  "disk sign-in stays creating until unmount, snapshot and detach receipts",
  "sign-in records volume and snapshot lifetime receipts in the admitted pool"]},
 "hub/test/login-signin-recovery.test.ts": {"exact": true, "names": [
  "startup sign-in recovery reads only indexed admissions across retained login history",
  "interrupted admission stays fenced across time and replacement births until its exact machine deletion receipt",
  "restart reverts an admitted renewal without native effects, retains bindings and refuses the old token"]},
 "hub/test/host-pools-config.test.ts": {"exact": false, "names": [
  "hosts relaunch_after_signin defaults false, accepts booleans and init omits it"]},
 "hub/test/cli-usage-compatibility.test.ts": {"exact": false, "names": []},
 "hub/test/cli-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-command-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-usage.test.ts": {"exact": false, "names": []},
 "hub/test/web-authority.test.ts": {"exact": false, "names": []},
 "hub/test/web-authority-unit.test.ts": {"exact": false, "names": []},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []},
 "hub/test/login-signed-out-native.test.ts": {"exact": true, "names": [
  "native opencode provider.auth signs out without stopping existing sessions"]},
 "hub/test/login-resignin-native.test.ts": {"exact": true, "names": [
  "native bound Codex renews its own dead credential home without replacing the disk",
  "native sign-in of unbound Claude, Codex and OpenCode disks reuses and detaches each volume",
  "native opencode sign-in renews the mounted writer with relaunch false",
  "native opencode sign-in renews the mounted writer with relaunch true"]},
 "hub/test/login-card-signin.test.ts": {"exact": true, "names": [
  "native Claude card creates and renews one disk across both remotes with deletion",
  "native Claude card creates and renews one disk across both remotes with one fallback",
  "native Codex card completes device sign-in without an answer",
  "native cancelled Claude card closes its admitted writer before failed disk completion"]},
 "hub/test/host-agent-signin-op.test.ts": {"exact": true, "names": [
  "sign-in streams bounded output, redacts split input echoes and persists its exact close",
  "sign-in cancel joins descendants and durable close before unmount",
  "sign-in output overflow terminates with an explicit bounded close outcome",
  "post-release rejection retains descendant birth and refuses unmount",
  "failed native-close publication emits incomplete and refuses a waiting unmount"]},
 "hub/test/host-restart.test.ts": {"exact": true, "names": [
  "restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership"]},
 "hub/test/host-relaunch.test.ts": {"exact": false, "names": [
  "nested provider cleanup joins its captured machine after close rejection and leaves sibling alive"]},
 "hub/test/host-create-ready.test.ts": {"exact": false, "names": []},
 "hub/test/host-destroy-native.test.ts": {"exact": false, "names": []},
 "hub/test/host-stop.test.ts": {"exact": false, "names": []},
 "hub/test/host-unreachable.test.ts": {"exact": false, "names": []},
 "hub/test/login-add.test.ts": {"exact": true, "names": [
  "terminal disk logins create a host, reuse it and retain only public metadata"]},
 "hub/test/login-terminal.test.ts": {"exact": true, "names": [
  "terminal sign-in joins native SSH after hub disconnect",
  "terminal sign-in joins native SSH after CLI cancellation"]},
 "hub/test/login-write-back.test.ts": {"exact": true, "names": [
  "rotated disk reaches the next host and release closes only disk writers"]},
 "hub/test/login-exclusive-native.test.ts": {"exact": true, "names": [
  "two hosts rotate separate writer and reader files; stop deletes only the reader volume"]},
 "hub/test/login-key-spawn.test.ts": {"exact": true, "names": [
  "composed key launches on two hosts resume a persisted conversation after hub and agent restart",
  "composed fixture early failure joins native and storage before root disposal",
  "two fake hosts receive a key only at spawn and retain no plaintext through agent restart"]},
 "hub/test/opencode-adapter.test.ts": {"exact": false, "names": []}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split`; with a commit argument it reads that commit through `git show`. At `792c9c301` and at `9c98a5747` all 81 lines read `ok` (VERIFIED with `node "$Q/src.mjs" "$R" 792c9c301dca0826bddee517d8614bffd59b608b` and with `9c98a5747646b75f248f952290d69e54073376ef`; the first 71 also at `99356638a`): the 35 of T-1789, T-1793, T-1792, T-1810 and the A-18760 decisions (first read at `25e4525ae`), T-1790's six (first read at its head `85352c52d`, unchanged at its landing), T-1815's eight, T-1791's nine, T-1814's seven, T-1794's six and T-1795's ten docs lines (five in the ADR for C1, three in the §3.13 amendment for C2, two in the logins notes for C3; read at its landing `a03cd7b97`).

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W> [commit]   ok, MISMATCH or MISSING per line; counts use String.split. With a commit, files are read through git show.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [W, COMMIT] = process.argv.slice(2);
const read = f => { if (COMMIT) { try { return execFileSync('git', ['-C', W, 'show', `${COMMIT}:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }); } catch { return null; } }
  return existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null; };
const LG = 'hub/src/host/logins.ts', LS = 'hub/src/host/login-signals.ts', LC = 'hub/src/host/login-cards.ts', AT = 'hub/src/hub/agents-topic.ts', CT = 'hub/src/adapters/contract.ts', SI = 'hub/src/host/login-signin.ts';
const RC = 'hub/src/host/login-reconcile.ts', DM = 'hub/src/hub/daemon.ts', RM = 'hub/src/host/login-remove.ts', CL = 'hub/src/cli/login.ts', WA = 'hub/src/hub/web-authority.ts', PH = 'hub/src/host/provision-host.ts';
const ST = 'hub/src/host/agent/signin-types.ts', AS = 'hub/src/host/agent/signin.ts', SC = 'hub/src/host/signin-client.ts', CS = 'hub/src/host/login-card-signin.ts', GW = 'hub/src/remote/gateway.ts', DP = 'hub/src/hub/dispatch.ts', PL = 'hub/src/host/pools.ts', SS = 'hub/src/adapters/sessions.ts';
const AD = 'docs/adr/0009-login-storage-boundary.md', SP = 'docs/spec/v0.1.2.md', LN = 'docs/hub/logins.md';
const C = [
  // A-18760 one sign-out path (T-1789 and the stage's shared records)
  ['A-18760 markSignedOut is the one way to signed-out', LG, 'markSignedOut(name:string,receipt:{reason:string;host:string|null}):void {', '=1'],
  ['A-18760 accepted from creating, ready or in-use only', LG, "if(row.state!=='creating'&&row.state!=='ready'&&row.state!=='in-use')throw Error(`login ${name} cannot mark signed out from ${row.state}`);", '=1'],
  ['A-18760 the episode record with a UUID and the store clock', LG, "state:'signed-out',signedOut:{id:randomUUID(),reason:receipt.reason,host:receipt.host,at:this.clock.now().toISOString()", '=1'],
  ['A-18760 a bare transition to signed-out refuses', LG, "if(state==='signed-out')throw Error(`login ${name} from ${row.state}: use markSignedOut for signed-out`);", '=1'],
  ['A-18760 a failed sign-in records sign-in failed with no host', SI, "markSignedOut(name,{reason:'sign-in failed',host:null})", '>=1'],
  // T-1789 (dead-login signals)
  ['T-1789 C1 the optional loginDead callback', CT, 'loginDead?: (sessionId: string, hit: { reason: string }) => void;', '=1'],
  ['T-1789 C1 OpenCode provider.auth', LS, "if(harness==='opencode')return row.type==='provider.auth'?'provider.auth':undefined;", '=1'],
  ['T-1789 C1 Claude Code and Codex text signals', LS, "const signals=harness==='claude-code'?['authentication_failed','Login expired','OAuth token revoked']:harness==='codex'?['refresh_token_reused']:[];", '=1'],
  ['T-1789 C1 Codex unauthorized', LS, "if(harness==='codex'&&row.codexErrorInfo==='unauthorized')return 'unauthorized';", '=1'],
  ['T-1789 C4 a local or unbound row changes no login', LS, "if(!row.host||row.host==='local'||!row.login)return;", '=1'],
  ['T-1789 C1 the report signs out with its host', LS, 'this.options.markSignedOut(login.name,{reason:hit.reason,host:row.host});', '=1'],
  ['T-1789 C3 one sign-in card per episode', LC, "const id=this.cards.raise('login-signin','general',`Login ${name} is signed out. Sign in again?", '=1'],
  ['T-1789 C3 its two options keyed by the episode id', LC, "['Sign in again','Not now'],false,{login:name,episode:episode.id});", '=1'],
  ['T-1789 C5 the notice once per episode', LC, 'if(!card||card.episode!==episode.id||card.noticed)return;', '=1'],
  ['T-1789 C3 the card withdraws when ready', LC, "if(this.store.ask(card.id)?.state==='open')this.cards.withdraw(card.id,login?'Login ready':'Login removed');", '=1'],
  ['T-1789 C5 the Agents line names login, host and signal', AT, 'text:`Login ${String(entry.login)} on host ${String(entry.host)} is signed out (${String(entry.reason)}). Sign in again from its card.`', '=1'],
  // T-1793 (reconciliation at hub start)
  ['T-1793 C1 a gone host frees its detached binding', RC, "const gone=!host||['destroyed','destroying','failed'].includes(host.state)||!!host.machineDeletionRead;", '=1'],
  ['T-1793 C4 an unlisted volume signs out with volume missing', RC, "if(!disk.volumeId||!volumes.has(disk.volumeId))r.markSignedOut(disk.name,{reason:'volume missing',host:null});", '=1'],
  ['T-1793 C5 a failed inventory keeps rows, retries and notices once', RC, 'retry=true;if(!this.noticed.has(name)){this.noticed.add(name);o.notice(`login reconciliation: ${name} volume inventory unavailable; logins unchanged, retry pending`);}continue;', '=1'],
  ['T-1793 C6 pending bindings stay with their owners', RC, 'if(r.hasPendingBinding(disk.name))continue;', '=1'],
  ['T-1793 C6 a confirmed reader deletion records deleteStorage', LG, "if(operation.volume&&operation.phase==='deleted')this.deleteStorage(operation.login,'volume',operation.volume.id);", '=1'],
  ['T-1793 the pass runs inside session restore, after the lease owners', DM, 'await loginReconciliation.start();', '=1'],
  // T-1792 (login remove)
  ['T-1792 C1 in use refuses naming the host', LG, "if(bindings.length||row.state==='in-use')throw Error(`login ${name} is in use on host ${bindings.map(b=>b.host).join(', ')||'unknown'}`);", '=1'],
  ['T-1792 C5 creating refuses naming the running sign-in', LG, "if(row.state==='creating')throw Error(`login ${name}: sign-in is running`);", '=1'],
  ['A-18760 the removal claim fences other work', LG, 'if(this.isRemoving(name))throw Error(`login ${name}: removal in progress; retry login remove`);', '=1'],
  ['A-18760 the snapshot admission fence', LG, "if(this.db.prepare('select snapshot_admission from logins where name=?').get(name)?.snapshot_admission)throw Error('login snapshot outcome requires reconciliation');", '=1'],
  ['T-1792 C4 a key removal deletes the file and the row only', RM, "if(row.kind==='key') {o.logins.beginRemove(name);removeLoginKey(o.root,name);o.logins.remove(name);return {removed:name};}", '=1'],
  ['T-1792 C2 C6 a confirmed volume deletion is recorded', RM, "else o.logins.confirmRemovedResource(name,'volume',id);", '=1'],
  ['T-1792 C6 confirmed removal goes through deleteStorage', LG, ' confirmRemovedResource(name:string,kind:\'volume\'|\'snapshot\',id:string):void {\n  this.atomic(()=>{\n   this.deleteStorage(name,kind,id);', '=1'],
  ['T-1792 C3 an unconfirmed deletion names the remaining ids', RM, "if(remaining.length)throw Error(`login ${name}: deletion unconfirmed: ${remaining.join(', ')}`);", '=1'],
  ['T-1792 the remove command syntax', CL, "throw Error('usage: cland login remove <name>');", '=1'],
  ['T-1792 the web edge refuses login.remove', WA, "'login.remove': 'requires the local human CLI or Neovim',", '=1'],
  ['A-18760 removal withdraws the sign-in card', LC, "this.cards.withdraw(previous.id,'Login removal in progress');", '=1'],
  // T-1810 (out of stage; the terminal host state)
  ['A-18760 a destroyed provision never reopens its machine lifecycle', PH, '  // retries its own cleanup without reopening the terminal machine lifecycle.', '=1'],
  ['A-18760 a destroyed provision returns after its login obligation', PH, "if(record.state==='destroyed'){", '>=1'],
  // T-1790 (VERIFIED at its landing 44a2775c9 and at 99356638a)
  ['T-1790 the signin command syntax', CL, "throw Error('usage: cland login signin <name>');", '=1'],
  ['T-1790 C5 the one-sign-in hint text', LS, "export const ONE_SIGN_IN_HINT='This account seems to allow one sign-in: set exclusive or add an account.';", '=1'],
  ['T-1790 recovery at start after reconciliation', DM, 'recoverLoginSignIns(store.hosts);', '=1'],
  ['T-1790 settlement only on the exact machine deletion', PH, 'settleLoginSignInsForHost(o.records,record.id);', '=2'],
  ['T-1790 the web edge refuses login.signin', WA, "'login.signin': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1790 the login list hint column', CL, "row.lastSignIn ?? '-',loginSignInHint(row.signedOut),", '=1'],
  // T-1815 (the agent-owned interactive sign-in operation)
  ['T-1815 C1 the output bound', ST, 'export const SIGNIN_OUTPUT_BYTES = 64 * 1024;', '=1'],
  ['T-1815 C1 output over the bound ends the run', AS, 'if(sent+Buffer.byteLength(text)>SIGNIN_OUTPUT_BYTES){limited=true;void cancel();return;}sent+=Buffer.byteLength(text);', '=1'],
  ['T-1815 C1 hub input reaches the process stdin', AS, "await new Promise<void>((resolve,reject)=>child!.stdin!.write(text,error=>error?reject(new Error('sign-in input failed')):resolve()));", '=1'],
  ['T-1815 C2 the close receipt is pinned to its admission', AS, "const receipt=parseSignInClose({admission,state:'closed',...exit,...(limited?{outcome:'output-limit' as const}:{})},admission);", '=1'],
  ['T-1815 C2 a receipt for another admission is refused', ST, "if(!r||r.admission!==admission||r.state!=='closed'||", '=1'],
  ['T-1815 C2 the client ignores another admission', SC, 'if(frame.admission!==admission)return;', '=1'],
  ['T-1815 C3 writer admission is released only after the durable receipt', AS, 'settled=true;release();runs.delete(admission);receipts.set(admission,receipt);', '=1'],
  ['T-1815 C4 input bytes are registered with both stream redactors', AS, 'for(const s of Object.values(streams))s.redactor.register(text);', '=1'],
  // T-1791 (signing in from a card)
  ['T-1791 C1 Create one starts a card sign-in', CS, "o.cards.onAnswer('login-create',(payload,_answer,context)=>{", '=1'],
  ['T-1791 C1 C4 Create one and Sign in again start the installed owner', CS, "context.afterCommit(()=>this.#start(context.id,input));return 'Signing in';", '=2'],
  ['T-1791 C1 C2 the code card with link and code, a free answer for Claude Code', CS, "card=o.cards.raise('login-signin-code','general',`Sign in ${name}: ${url}${code?' Code: '+code:''}`,", '=1'],
  ['T-1791 C4 Sign in again renews the signed-out disk', CS, 'const input={name:login,harness:row.harness,signin:true};', '=1'],
  ['T-1791 C5 the pasted code is registered as a secret', CS, 'o.registerSecret(text);', '=1'],
  ['T-1791 C6 the 15-minute limit', CS, 'const limitMs=15*60*1000;', '=1'],
  ['T-1791 C6 on the hub clock', CS, "const timer=o.clock.setTimeout(()=>cancel('sign-in timed out; closing'),Math.max(1,accepted+limitMs-o.clock.now().getTime()));", '=1'],
  ['T-1791 C7 the code message deleted where the messenger can', GW, 'const deleted=await remote.deleteMessage?.(ingress)??false;', '=1'],
  ['T-1791 C7 otherwise one line says so', GW, "if(!deleted){const text='This messenger could not delete your sign-in code message. Delete it yourself.';", '=1'],
  // T-1814 (new-login owner loss)
  ['T-1814 C1 a new disk sign-in holds a durable admission with its host', LG, ' beginAddSignIn(name:string,host:SignInHost):string {', '=1'],
  ['T-1814 C1 the add admission captures the exact machine', SI, 'if(!o.admission)addAdmission=o.logins.beginAddSignIn(name,{id:o.host.name,machine:o.machine,...(o.identity?{identity:o.identity}:{})});', '=1'],
  ['T-1814 C1 C2 owner loss interrupts through the shared fence', SI, 'o.logins.interruptSignIn(name,addAdmission);', '=2'],
  ['T-1814 C1 a peer close aborts preparation', DP, "const preparing=new AbortController(),abortPreparing=()=>preparing.abort(Error('terminal disconnected during sign-in preparation'));", '=1'],
  ['T-1814 C3 the CLI post-close completion keeps success and failure', SI, "if(code===0&&!failure)o.logins.finishSignIn(name,addAdmission!,o.clock.now().toISOString());else o.logins.markSignedOut(name!,{reason:'sign-in failed',host:null});", '=1'],
  ['T-1814 C4 a Create one run without a close receipt interrupts', CS, 'else if(pending.interrupt)await pending.interrupt();', '=1'],
  ['T-1814 C4 its unknown-outcome cut no longer skips an interruptible add', CS, 'const unknown=pending&&!completionStarted&&!notAdmitted&&!input.signin;', '=1'],
  // T-1794 (relaunch after sign-in, behind a switch)
  ['T-1794 C1 relaunch_after_signin defaults false', PL, 'const relaunchAfterSignIn = source.relaunch_after_signin === undefined ? false : source.relaunch_after_signin;', '=1'],
  ['T-1794 C1 refused otherwise naming the key', PL, "if (typeof relaunchAfterSignIn !== 'boolean') throw new Error('hosts.relaunch_after_signin must be a boolean');", '=1'],
  ['T-1794 C1 C2 read from the live settings at each success', SS, 'if (!this.#poolRuntime?.settings().relaunchAfterSignIn) return;', '=1'],
  ['T-1794 C3 only that harness on that host', SS, 'const admitted = this.#table.activeOnHost(host).filter(p => p.harness === harness);', '=1'],
  ['T-1794 C3 relaunched through the same-conversation resume', SS, 'const result = await this.resume(current.name, true, untimed, authorize, false, undefined, undefined, row => {', '=1'],
  ['T-1794 C2 C3 the hook runs after the durable sign-in success', SI, 'await o.afterSignIn?.(o.host.name,row.harness);', '=1'],
  // T-1795 (docs; VERIFIED at its landing a03cd7b97, byte-identical to its tip 90410ef27)
  ['T-1795 C1 the ADR links spec v0.4 section 3.7', AD, '[v0.4 §3.7](../spec/v0.4.md#37-logins-disk-and-key-capacity-sign-in-signed-out-and-operations)', '=1'],
  ['T-1795 C1 the ADR links spec v0.4 section 3.12', AD, '[§3.12](../spec/v0.4.md#312-security-and-secrets)', '=1'],
  ['T-1795 C1 what cland stores for logins', AD, 'stores its metadata: name, harness, account, state, last sign-in, bindings and,', '=1'],
  ['T-1795 C1 what cland never stores', AD, 'detaches and snapshots it without reading its contents, extracting or keeping', '=1'],
  ['T-1795 C1 the ADR points at the notes', AD, 'See [the implementation notes](../hub/logins.md#storage-boundary).', '=1'],
  ['T-1795 C2 the dated amendment names logins on hosts and links the ADR', SP, '**Amendment, 2026-11-11 — logins on hosts.** [ADR 0009](../adr/0009-login-storage-boundary.md)', '=1'],
  ['T-1795 C2 the amendment links v0.4 section 3.7', SP, '[§3.7](v0.4.md#37-logins-disk-and-key-capacity-sign-in-signed-out-and-operations)', '=1'],
  ['T-1795 C2 the amendment links v0.4 section 3.12', SP, '[§3.12](v0.4.md#312-security-and-secrets)', '=1'],
  ['T-1795 C3 the notes record the one sign-out transition', LN, '`markSignedOut(name, {reason, host})` changes a creating, ready or in-use login to', '=1'],
  ['T-1795 C3 the notes storage-boundary section the ADR links', LN, '\n## Storage boundary\n', '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : t === null ? 'MISSING' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
node --check "$Q/src.mjs" && echo "src checked"
# ids.mjs <brief>: every E1535S4-NN the criteria map names exists as a row; the open landing markers of the members first drafted unlanded
cat > "$Q/ids.mjs" <<'JS'
import { readFileSync } from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8'), map = t.slice(t.indexOf('### Criteria map'), t.indexOf('## Build'));
const named = new Set(map.match(/E1535S4-\d+/g) ?? []), rows = new Set([...t.matchAll(/^\| (E1535S4-\d+) \|/gm)].map(m => m[1]));
const missing = [...named].filter(id => !rows.has(id));
const open = ['T-1790', 'T-1791', 'T-1794', 'T-1795'].map(id => `${id} ${t.split('TODO(' + id + '-landing)').length - 1}`);
console.log(`criteria-map ids ${named.size}; table rows ${rows.size}; missing from the tables: ${missing.length}${missing.length ? ' ' + missing.join(' ') : ''}`);
console.log(`open landing markers: ${open.reduce((n, s) => n + Number(s.split(' ')[1]), 0)} (${open.join(', ')})`);
JS
node --check "$Q/ids.mjs" && echo "ids checked"
```

The check functions (`landing`, `durdelta` and `s00` come from the stage-3 brief at `M4`; `ownlines`, `s01` and `s99` from the stage-2 brief at `M3`) and this brief's scratch functions (`SENT`, `SENT2`, `r80`, `r81` and `r83` from `M4`; `sentinels` and `r89` from `M3`):

```sh
cat > "$Q/checks.sh" <<'SH'
. "$Q/kit2-checks.sh"; . "$Q/kit3-checks.sh"
BASE=85e60f6cb34ec320cc7a1f5456de3a4693acbe17    # M4, the tracker commit recording stage 3's clear verdict; the parent of the stage's first commit
MEMBERS="T-1789 T-1790 T-1815 T-1791 T-1814 T-1794 T-1792 T-1793 T-1795"
STAGE="signed out, signing in again and from cards, remove, reconciliation and the amendment"
WROTE=792c9c301dca0826bddee517d8614bffd59b608b   # the dev this brief was written at (the tracker commit after T-1795's landing; first drafted at 25e4525ae)
T1795=${T1795_TIP:-90410ef27b35fbbb7c21ee306412adc03f80467b}   # T-1795's reviewed tip (rev-35-1795-final-1); it landed directly, with no merge batch
# reviewed tips (the commit of each member's final clear verdict)
TIPS="T-1793 e3767adfd76507a471ec0d1e1b692e4bb5f42e1a T-1789 1470a7b09c1518781aa566c45d36b4e22c6a7214 T-1792 efaba34f89faa875019921b2a203e1fd8e9a74a4 T-1790 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa T-1794 dd4650fa7ebe7590f46c758582734ce5ab26d3d9 T-1815 2b2add0f218e8f9c957a776bd33731c71856f307 T-1791 26b09338a1fe4424330154fd14c30cad991dd4c1 T-1814 c111a20aab7ec0fb227c366324a8a810f0a1d783 T-1795 $T1795"
preserved() { printf '%s\n' hub/test/login-keys.test.ts hub/test/secrets.test.ts hub/test/login-exclusive.test.ts hub/test/login-snapshot-cli.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage.test.ts hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts hub/test/host-create-ready.test.ts hub/test/host-destroy-native.test.ts hub/test/host-unreachable.test.ts hub/test/login-terminal.test.ts hub/test/login-write-back.test.ts hub/test/login-exclusive-native.test.ts hub/test/login-key-spawn.test.ts hub/test/opencode-adapter.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts hub/test/host-agent-boundary.test.ts hub/test/host-agent-closure.test.ts hub/test/gateway.test.ts hub/test/gateway-secrets.test.ts hub/test/gateway-state.test.ts hub/test/outbox-gateway.test.ts; }
# samechange <commit> <tip> <landing> <files…>: the tip-to-landing difference in each file equals <commit>'s own change there (stage-3 run correction C-1)
samechange() { local c=$1 h=$2 l=$3 f a b ok=yes; shift 3; for f in "$@"; do a=$(git -C "$W" diff "$c^" "$c" -- "$f" | grep -E '^[+-]' | grep -v -E '^(\+\+\+|---) ' | sort | shasum); b=$(git -C "$W" diff "$h" "$l" -- "$f" | grep -E '^[+-]' | grep -v -E '^(\+\+\+|---) ' | sort | shasum); [ "$a" = "$b" ] || ok="no: $f"; done; echo "$ok"; }
s02() {   # landing diffs (read-only), the stage-wide invariants, the landing check and every first-parent commit of the stage
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "stage paths under nvim/ or web/: [$(git -C "$W" diff --name-only "$BASE" "$S" -- nvim web | tr '\n' ' ')]"
  echo "remote authority table changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- hub/src/remote/authority.ts | tr '\n' ' ')]"
  set -- $TIPS
  while [ $# -ge 2 ]; do id=$1; head=$2; shift 2; L=$(landing "$id" | head -n 1)
    [ -n "$L" ] && [ "$head" != none ] && git -C "$W" cat-file -e "$head^{commit}" 2> /dev/null || { echo "$id landing ${L:-none} tip $head: BLOCKED (no landing or no tip)"; continue; }
    F=$(git -C "$W" diff --name-only "$L^1" "$L" | grep -v '^\.cland/' | tr '\n' ' ')
    echo "$id own lines at its landing $L equal its tip $head: $(ownlines "$L" "$head")"
    echo "$id files byte-identical to $head at its landing: $(git -C "$W" diff --quiet "$head" "$L" -- $F && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "$L" -- $F | tr '\n' ' ')")"
    echo "$id commits after its landing touching its files: [$(git -C "$W" log --format=%h "$L..$S" -- $F | tr '\n' ' ')]"; done
  echo "T-1789 tip-to-landing difference equals a38929ae8's change in its three files: $(samechange a38929ae8b2ed60cc7e2a50abd02735b7f3c6094 1470a7b09c1518781aa566c45d36b4e22c6a7214 "$(landing T-1789 | head -n 1)" docs/hub/logins.md hub/README.md hub/test/login-release.test.ts)"
  L=$(landing T-1795 | head -n 1); [ -n "$L" ] && echo "T-1795 direct landing (no merge batch): Item trailers $(git -C "$W" log -1 --format=%B "$L" | grep -c -x 'Item: T-1795'); parents $(git -C "$W" rev-list --parents -n 1 "$L" | wc -w | awk '{print $1-1}'); first parent $(git -C "$W" rev-parse "$L^1"); tree equals its tip's tree: $([ "$(git -C "$W" rev-parse "$L^{tree}")" = "$(git -C "$W" rev-parse "$T1795^{tree}")" ] && echo yes || echo no)"
  echo "writing dev is an ancestor of the request: $(git -C "$W" merge-base --is-ancestor "$WROTE" "$S" && echo yes || echo no)"
  echo "first-parent commits from BASE to the request: $(git -C "$W" rev-list --first-parent --count "$BASE..$S"); after the writing dev: $(git -C "$W" rev-list --first-parent --count "$WROTE..$S")"
  others=0
  for c in $(git -C "$W" rev-list --first-parent --reverse "$BASE..$S"); do P=$(git -C "$W" diff --name-only "$c^1" "$c" | LC_ALL=C sort | tr '\n' ' ')
    it=$(git -C "$W" log -1 --format=%B "$c" | grep -E '^Item: ' | tr '\n' ' '); k=other
    if [ -n "$it" ]; then case "$it" in "Item: T-1789 "|"Item: T-1790 "|"Item: T-1815 "|"Item: T-1791 "|"Item: T-1814 "|"Item: T-1794 "|"Item: T-1792 "|"Item: T-1793 "|"Item: T-1795 ") k=member;; "Item: T-1810 ") [ "$(git -C "$W" rev-parse "$c")" = a38929ae8b2ed60cc7e2a50abd02735b7f3c6094 ] && k=out-of-stage-T-1810;; "Item: T-1818 ") [ "$(git -C "$W" rev-parse "$c")" = 68ed9d82b489ed5e74817bd842b3b7e040194c8f ] && k=out-of-stage-T-1818;; esac
    else
      [ -n "$P" ] && ! printf '%s' "$P" | tr ' ' '\n' | grep -v -x '' | grep -q -v -x -E '\.cland/tasks/[^/]+\.md' && k=tracker
      [ "$P" = "hub/test/durations.json " ] && k=durations
      [ "$P" = "docs/hub/logins.md " ] && [ "$(git -C "$W" rev-parse "$c")" = 10711a330d6f90bf9d6b218e9bdefd1eb3224f76 ] && k=coord-docs-10711a330
      [ "$P" = "qa/briefs/E-1535-stage-4.md " ] && k=brief-only
      [ "$P" = "hub/test/durations.json qa/briefs/E-1535-stage-4.md " ] && k=brief-and-durations
    fi
    [ "$k" = other ] && others=$((others+1))
    echo "  commit $(git -C "$W" rev-parse --short=9 "$c") class $k trailers [$it] paths $(printf '%s' "$P" | wc -w | tr -d ' ')"
    case "$k" in durations|brief-and-durations) echo "    $(durdelta "$c")";; esac; done
  echo "commits of class other: $others"
}
s05() {   # tree-wide checks at the build (read-only git; the briefs and the tracker excluded)
  echo "bare transitions to signed-out in production source: $(git -C "$W" grep -n -E "transition\([^)]*'signed-out'" "$S" -- hub/src shared | wc -l | tr -d ' ')"
  echo "markSignedOut callers outside logins.ts: [$(git -C "$W" grep -l -F 'markSignedOut(' "$S" -- hub/src ':!hub/src/host/logins.ts' | sed "s#^$S:##" | tr '\n' ' ')]"
  echo "logout commands in production source: $(git -C "$W" grep -n -E 'codex[[:space:]]+logout|claude[[:space:]]+auth[[:space:]]+logout|/logout' "$S" -- hub/src shared | wc -l | tr -d ' ')"
  echo "removal claim cleared outside logins.ts: $(git -C "$W" grep -n -F 'removing=0' "$S" -- hub/src ':!hub/src/host/logins.ts' | wc -l | tr -d ' ')"
}
s06() {   # evidence to read, never to start: member verify receipts, merge-batch logs, the Coordinator's cover pair at the requested dev SHA
  for pair in "T-1793 e3767adfd76507a471ec0d1e1b692e4bb5f42e1a" "T-1789 1470a7b09c1518781aa566c45d36b4e22c6a7214" "T-1792 efaba34f89faa875019921b2a203e1fd8e9a74a4" "T-1810 3ee73e112385461b3e4607bb445e60687146c7b9" "T-1790 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa" "T-1794 dd4650fa7ebe7590f46c758582734ce5ab26d3d9" "T-1818 0679105b1205c8421377272b364756af332cce73" "T-1815 2b2add0f218e8f9c957a776bd33731c71856f307" "T-1791 26b09338a1fe4424330154fd14c30cad991dd4c1" "T-1814 c111a20aab7ec0fb227c366324a8a810f0a1d783" "T-1795 $T1795"; do set -- $pair
    (cd "$R" && node "$W/hub/bin/cland.ts" task view "$1" --json) | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s).item.verify??{};console.log(process.argv[1]+" verify "+v.id+" executor "+v.executor+" state "+v.state+" result "+v.result+" artifact "+v.artifact+" head is the reviewed tip "+(v.head===process.argv[2]))})' "$1" "$2"; done
  for id in 83feb4c8-7b5e-4baf-ae9d-dd95c2b17e00 d434a460-aea3-4ecf-84cf-9af25b9bf8e2 47472a71-687e-4355-9e81-5bd7a4975204 b25f6338-5a98-4962-9cb1-d11b144b1715 df9f5f80-e367-4cd2-8db0-5ffe79e2eabf 893edbaa-e382-4bd8-9aa4-a87b00ca35c2 ad37ee0a-48cd-4e1f-b4e0-efebd06ddcb3 e4d0f05f-3879-4911-aa3b-f151063c7319 38613bb6-e16c-4a4b-9f7a-6c27356d9a50 69857123-819a-4dc3-accb-31442373ca3b df8e426a-a494-4ffd-a8fd-8b6543b52b04 $(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log([s.cover?.linux,s.cover?.macos].filter(Boolean).join(" "))' "$EV/stage-members.json"); do
    for f in $(ls "$R/.cland/artifacts" | grep -F -- "-suite-$id-"); do
      node -e 'const fs=require("fs"),t=fs.readFileSync(process.argv[1],"utf8"),line=t.split("\n").find(l=>l.startsWith("suite provenance "));let p={};try{p=JSON.parse(line.slice(17))}catch{}const fails=t.split("\n").filter(l=>/^ℹ fail [1-9]/.test(l)).length,zero=t.split("\n").filter(l=>/^ℹ fail 0$/.test(l)).length,workers=(t.match(/^Workers \d+[^\n]*/m)??["none"])[0];console.log(process.argv[2]+" "+process.argv[1].split("/").pop().slice(0,8)+" head "+p.head+" occasion "+p.occasion+" executor "+p.executor+" os "+(p.platform??{}).os+" failing phase lines "+fails+"; passing phase lines "+zero+"; "+workers+"; head is the request "+(p.head===process.argv[3]))' "$R/.cland/artifacts/$f" "$id" "$S"; done; done
  # T-1795 landed directly: count the merge-batch candidates (the head of a batch-occasion suite log whose subject is "Batch candidate …") naming it; T-1814's is the positive control
  node -e 'const fs=require("fs"),cp=require("child_process"),[d,w,...ids]=process.argv.slice(1),heads=new Set();for(const f of fs.readdirSync(d)){if(!f.includes("-suite-")||!f.endsWith(".log"))continue;const l=fs.readFileSync(d+"/"+f,"utf8").split("\n").find(x=>x.startsWith("suite provenance "));if(!l)continue;let p;try{p=JSON.parse(l.slice(17))}catch{continue}if(p.occasion==="batch"&&p.head)heads.add(p.head)}const n=Object.fromEntries(ids.map(i=>[i,0]));for(const h of heads){let s="";try{s=cp.execFileSync("git",["-C",w,"log","-1","--format=%s",h],{encoding:"utf8",stdio:["ignore","pipe","ignore"]})}catch{}if(s.startsWith("Batch candidate "))for(const i of ids)if(s.trim().split(/\s+/).includes(i))n[i]++}console.log("merge-batch candidates naming "+ids.map(i=>i+": "+n[i]).join("; "))' "$R/.cland/artifacts" "$W" T-1814 T-1795
}
s07() {   # T-1795 docs: presence, the amendment's position, the notes' headings, the closed-item wording lint (sealed)
  echo "ADR files for login storage: $(git -C "$W" ls-tree --name-only "$S" docs/adr/ | grep -c -E '^docs/adr/0009-')"
  echo "spec v0.1.2 amendment lines naming logins: $(git -C "$W" show "${S}:docs/spec/v0.1.2.md" | grep -c -i -E 'amendment.*login|login.*amendment')"
  echo "dated logins amendment paragraphs inside section 3.13: $(git -C "$W" show "${S}:docs/spec/v0.1.2.md" | awk '/^### 3\.13 /{f=1;next} /^### /{f=0} f&&/^\*\*Amendment, [0-9-]+ .* logins on hosts\.\*\* \[ADR 0009\]\(\.\.\/adr\/0009-login-storage-boundary\.md\)/{n++} END{print n+0}')"
  echo "pre-stage lines of docs/spec/v0.1.2.md changed or removed: $(git -C "$W" diff "$BASE" "$S" -- docs/spec/v0.1.2.md | grep -c -E '^-[^-]')"
  for h in 'store api' binding releasing snapshot 'key store' card reconciliation; do echo "logins notes heading lines with $h: $(git -C "$W" show "${S}:docs/hub/logins.md" | grep -c -i -E "^#+ .*$h")"; done
  echo "logins notes state-transition lines: $(git -C "$W" show "${S}:docs/hub/logins.md" | grep -c -F 'changes a creating, ready or in-use login to')"
  node "$Q/fresh.mjs" "$W" plain node hub/test/lint-closed-item-wording.ts > "$EV/wording-lint.txt" 2>&1; echo "closed-item wording lint exit $?"
}
SH
cat > "$Q/scratch.sh" <<'SH'
# this stage's scratch rows; SENT, SENT2, r80, r81 and r83 from the stage-3 brief at M4; sentinels and r89 from the stage-2 brief at M3; helpers from the kit
. "$QA_Q/kit2-scratch.sh"; . "$QA_Q/kit3-scratch.sh"
r84() {   # T-1792 C4 on the real CLI: an unknown and a malformed name refused, one key login removed, its file gone, the other kept, the [auth] store key kept
  cd "$QA_Q/p1" || return 1
  D0=$(dg .cland/secrets.toml)
  run "(remove unknown)" cland login remove nosuch; echo "  unknown-login lines $(has 'unknown login: nosuch')"
  run "(remove malformed)" cland login remove Bad_Name; echo "  usage lines $(has 'usage: cland login remove <name>')"
  run "(remove key)" cland login remove opencode-1; echo "  removed lines $(has 'removed login opencode-1')"
  echo "  key file opencode-1 $(there .cland/auth/opencode-1.key); key file keytwo $(there .cland/auth/keytwo.key)"
  echo "  store key file unchanged by the removal: $([ "$D0" = "$(dg .cland/secrets.toml)" ] && echo yes || echo no)"
  run "(login list json after remove)" cland login list --json
  node -e 'let v;try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  rows: not JSON");process.exit(0)}console.log("  rows after remove: "+v.map(r=>r.name+" "+r.state).join(", "))'
  for s in "$SENT" "$SENT2"; do sentinels "$s"; done
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `ids checked`, `scratch checked`. The landed members' reviewed tips (the commit of each final clear verdict, read with `task view`) and merge-batch suites are written in (VERIFIED: each batch log's `suite provenance` head is a `Batch candidate T-<id>` commit whose tree equals that landing's tree): T-1790 `3683b2f7b`, batch `df9f5f80` (A-18813, A-18814); T-1794 `dd4650fa7`, batch `893edbaa` (A-18859, A-18860); T-1818 (out of stage) `0679105b1`, batch `ad37ee0a` (A-18882, A-18883); T-1815 `2b2add0f2`, batch `e4d0f05f` (A-18886, A-18887); T-1791 `26b09338a`, batch `38613bb6` (A-18908, A-18909); T-1814 `c111a20aa`, batch `69857123` (A-18931, A-18932); T-1795 `90410ef27` (`T1795`, defaulting to `90410ef27b35fbbb7c21ee306412adc03f80467b`; QA sets `T1795_TIP` only if the request names another tip). **T-1795 has no merge batch** (it landed by a direct `cland merge`, VERIFIED: no batch candidate names it), so there is no `T1795_BATCH`: in its place `s02` checks the direct landing (`Item trailers 1; parents 1; first parent 99356638a9319380a3e4695d04ccbd7c6dcc2854; tree equals its tip's tree: yes`, with the generic `own lines` and `files byte-identical` lines `yes`), and `s06` reads T-1795's own verify log `df8e426a` (A-18940, mode full at `90410ef27`) in the suite list and counts the merge-batch candidates naming it, with T-1814's as the positive control (VERIFIED: `merge-batch candidates naming T-1814: 1; T-1795: 0`).

**Cleanup, in this order (carried).** Step 1, after E1535S4-89 passes: inventory and remove by literal path the dead T-1676 residue in `$T` only. Step 2: E1535S4-99 with `$Q` and `$T` present. Step 3, after the verdict: remove `$Q` and `$T` by their printed literal paths (prefix checks `/private/tmp/q53-` and `/private/tmp/qa-e1533-s3-`), then `git -C "$R" worktree remove "$W"`. Nothing in `$ST` or `/private/tmp` outside `$Q` and `$T` is removed, ever (the T-1805 receipt and the T-1806 directories included). If any inventory shows a new own-family name, nothing is removed.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through `nt` (sealed, `TMPDIR=$T`) or `ns` (standard environment, one preservation slot per file), recorded with `qa-record.sh note` (surface `hub-api`), with the evidence files stage 3 named. A case passes only when every check line reads `CLEAN` and its delta reads `own-family new entries in all files: 0`. A missing file is a FAIL naming it. Run in table order; never two files at once. Tiers are read from `hub/test/tiers.json` at `99356638a` and agree with each new file's first-line tier header (VERIFIED). A slow but positive file is recorded with its wall time (T-1801, T-1809).

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1535S4-10 | hub-api | QA | `nt E1535S4-10 hub/test/login-signed-out.test.ts hub/test/codex-host.test.ts hub/test/login-native-environment.test.ts hub/test/login-records.test.ts hub/test/login-capacity.test.ts` | Each `CLEAN` (T2, T2, T1, T1, T2). `login-signed-out` exact 30 (26 T-1789 cases and T-1790's four hint and history cases): the eight expansions of `<harness> classifies dead login <reason>` and test `ordinary failures, model output and other harness signals are not dead logins` (T-1789 C1); test `hub login-dead callback persists sign-out and routes the next launch away without stopping existing sessions` (C1, C2); both expansions of `sign-in card for <name> is once per sign-out, survives reconstruction, and folds on ready` (C3); test `Claude remote hooks report login death; local hooks retain their signed-out latch` and test `reader reports sign out the bound login once and local or unrelated reports do nothing` (C4); test `notice retention does not republish a still-signed-out episode after restart` (C5); the four expansions of `one-sign-in hint uses account and an exclusive 24h clock window (<elapsed>ms)` (T-1790 C5). `codex-host` with the three `Codex remote native error reports dead login <reason> without stopping` expansions; `login-native-environment` with test `native login decoration retains admitted account and routing fields with sealed inherited environment`; `login-records` with test `every sign-out requires its durable episode owner, including failed sign-in` (A-18760). `login-capacity` carries T-1789's one-line `markSignedOut` migration (T-1789's other migrated files run in E1535S4-20, -35, -40, -42 and -45; `login-wait`, `login-host-pin` and `login-add-component` moved out of this row because later landings edited them) |
| E1535S4-20 | hub-api | QA | `nt E1535S4-20 hub/test/login-reconcile.test.ts hub/test/login-selection.test.ts hub/test/pool-failures.test.ts hub/test/pool-scale.test.ts hub/test/session-pool-placement.test.ts hub/test/waiting-launch.test.ts hub/test/waiting-launch-restart.test.ts hub/test/host-status.test.ts` | Each `CLEAN` (T2 each). `login-reconcile` exact 22: both `settled fixture login restart follows positive provider volume inventory; deleted=<deleted>` expansions (T-1793 C1, C2 at T2); the four `detached reader deletion has a provider receipt and storage stamp; phase=<phase>` expansions (C3; `pending`, `creating` and `deleted` keep their owners, C6); test `missing volume signs out while failed inventory preserves rows and retries once` (C4, C5); test `reconciliation preserves retained snapshot receipt through its release owner` and test `signed-out receipt retains bindings, removes capacity and clears on sign-in` (C6, A-18760). The other seven carry T-1793's settled-fixture migration (the volume now in the fake provider's inventory; one line each) |
| E1535S4-30 | hub-api | QA | `nt E1535S4-30 hub/test/login-remove.test.ts hub/test/login-list.test.ts hub/test/login-keys.test.ts hub/test/secrets.test.ts hub/test/login-exclusive.test.ts` | Each `CLEAN` (T2 each). `login-remove` exact 26 (25 T-1792 cases and T-1790's test `login remove refuses an interrupted unbound renewal until its exact machine deletion receipt`): test `remove key deletes only its encrypted file and metadata, retaining the auth store key` (T-1792 C4); test `in-use and creating refusals retain every byte and name the host or running sign-in` (C1, C2, C5); test `unconfirmed volume delete retains exact id and storage accrual, retry completes after restart` (C3, C6); the snapshot accounting expansions (C6); the three card-suppression expansions and the removal-claim cases (A-18760). `login-list` exact 5: its two earlier cases, T-1790's test `recovered one-sign-in hint appears in the card, Agents notice and login list` (T-1790 C5) and both expansions of `login fixture retains borrowed-store ownership after <fault> failure` (T-1790's new `login-metadata-owners.ts` fixture; a lost-storage diagnostic is T-1817). `login-keys` exact 6, `secrets` and `login-exclusive` are unedited consumers of `login-keys.ts`, `logins.ts` and the binder (VERIFIED `preserved`) |
| E1535S4-35 | hub-api | QA | `nt E1535S4-35 hub/test/login-release.test.ts hub/test/login-snapshots.test.ts hub/test/login-snapshot-cli.test.ts` | Each `CLEAN` (T2 each). `login-release` with test `destroyed host release retry settles disk without a provision write` (T-1810, A-18760's terminal host state) and T-1790's test `confirmed host destruction clears interrupted renewal and detached snapshot release fences` and both machine-deletion expansions (the recovery policy). `login-snapshots` (one T-1789 line; T-1790's two cases; T-1792 and T-1790 edit `login-snapshots.ts`): both expansions of `renewal drains an older held snapshot generation then <outcome>` (T-1790 C2: an older held generation drained before the renewal's own backup is admitted, an invalidated admission refused) and the snapshot owner's admission, freeze and release fences; record the wall time of `one login save has bounded scheduling work across ten thousand retained logins` (T-1809). `login-snapshot-cli` unedited |
| E1535S4-40 | hub-api | QA | `nt E1535S4-40 hub/test/login-signin.test.ts hub/test/login-signin-recovery.test.ts` | Each `CLEAN` (T1, T2). `login-signin` exact 31: T-1790's nine static renewal cases, among them test `renewing a mounted login snapshots under freeze and keeps the writer mounted` and test `sign-in admission retains bindings, fences competing attempts and publishes renewed in-use state` (C1, C2) and test `unbound renewal interruption retains its native fence without invoking disk cleanup` (the recovery policy), and its twelve loop expansions (`renewal freeze recovery <outcome>` 3, `renewal fences <mutation> across held inventory before freeze or snapshot` 4, `sign-in refuses retained <fence> ownership` 5); T-1814's four: both expansions of `new login revalidates recovered admission after held <boundary>` (no mount, snapshot or detach after the interrupted admission) and both of `new login preparation distinguishes <failure>` (a refused attach records failure without an interrupted-host fence; an unknown mount keeps the fence and does no cleanup) (T-1814 C3); the six earlier cases. `login-signin-recovery` exact 3: test `interrupted admission stays fenced across time and replacement births until its exact machine deletion receipt` (no timer, no borrowed replacement-machine authority) and test `restart reverts an admitted renewal without native effects, retains bindings and refuses the old token` (the recovery policy) |
| E1535S4-42 | hub-api | QA | `nt E1535S4-42 hub/test/login-add-component.test.ts hub/test/login-host-pin.test.ts` | Each `CLEAN` (T2 each; `login-add-component` edited by T-1789, T-1790 and T-1814, `login-host-pin` by T-1789 and T-1814). `login-add-component` exact 22: the seven expansions of `renewal terminal <outcome> distinguishes native close receipt from owner loss` (T-1790's recovery policy: a receipt-less disconnect or hub stop interrupts, a close receipt completes); the six expansions of `new login terminal <outcome> retains disk until owner close or exact machine deletion` (T-1814 C1 `disconnect`, C2 `hub stop`, C3 `exit success`, `exit failure`, `exit null` and `recovery`: the captured host and `mount` recorded, replacement-machine deletion refused, the persisted exact-machine receipt admits a fresh sign-in); the four expansions of `<rejected|held> new-login preparation records interruption after <peer close|hub stop>` (T-1814 C1, C2: interruption with no disk cleanup while attach is held); the three expansions of `login add <outcome> settles only its admitted connection` and the two other earlier cases. `login-host-pin` exact 13: the `attach`, `mount` and `publish` expansions of `sign-in revalidates captured host authority after <boundary>` keep the interrupted host and disk fence, refuse absent and replacement-machine receipts and settle only on the actual fake machine's positive deletion read, after which the disk reads detached and a retry is admissible (T-1814 C3); `create` and `replacement` keep the pre-capture failure without a fence |
| E1535S4-43 | hub-api | QA | `nt E1535S4-43 hub/test/signin-client.test.ts hub/test/signin-command.test.ts hub/test/signin-owner.test.ts hub/test/signin-redactor.test.ts hub/test/host-agent-client.test.ts hub/test/host-contract-coverage.test.ts hub/test/accounts-policy.test.ts hub/test/host-agent-boundary.test.ts hub/test/host-agent-closure.test.ts` | Each `CLEAN` (T1, T1, T1, T1, T2, T1, T1, T1, T1). `signin-client` exact 6: test `a close receipt for another admission is refused and never settles this run` (T-1815 C2), the three expansions of `malformed close <exit> stays incomplete` (`<exit>` is the `JSON.stringify` of `{code:null,signal:null}`, `{code:null,signal:''}` and `{code:undefined,signal:'SIGTERM'}`: no observed code or signal is never a receipt, C2), test `connection loss after admission has no native close receipt` (C2, C3), test `missing capability is positively not admitted without a native request`. `signin-command` exact 1 (C1: public harness arguments and mounted paths only). `signin-owner` exact 4: test `uncertain rejection after native admission retains the operation and disk hold` and test `native completion failure reaches the peer and retains writer admission` (C3), the receipt-cache and peer-shutdown cases. `signin-redactor` exact 1: test `registered input is hidden across every output split and at close` (C4). `host-agent-client` exact 1 (its one case now also refuses `startSignIn` on an agent without `signin-v1`). `host-contract-coverage` with test `optional sign-in contract covers absence, typed refusal and admission-bound shape with planted controls` and the exhaustive Host-member guard `Host contract exercises every interface member and detects an uncovered addition` (C2). `accounts-policy` with test `mounted database path permits only one exact pure agent helper` (the moved OpenCode path helper). `host-agent-boundary` and `host-agent-closure` unedited, `CLEAN` over the regenerated `closure.json` (C5; VERIFIED `preserved`) |
| E1535S4-45 | hub-api | QA | `nt E1535S4-45 hub/test/login-card-signin-owner.test.ts hub/test/login-card-signin-remote.test.ts hub/test/login-card-recovery.test.ts hub/test/hub-cards.test.ts hub/test/login-wait.test.ts hub/test/discord-api.test.ts hub/test/telegram-api.test.ts` | Each `CLEAN` (T2 each). `login-card-signin-owner` exact 12, `login-card-signin-remote` exact 8, `login-card-recovery` exact 8, `login-wait` exact 8; `hub-cards`, `discord-api`, `telegram-api` with their named cases. **C1:** test `Create one offers the Claude link and its secret answer completes one snapshot` (the secret card, input pipe, `ready` and exactly one snapshot); the `1` expansion of `login card option <option> folds once across retries and restart` answers `Signing in` through the installed owner with one injected failed preparation and no native admission; test `login create without a sign-in owner keeps the terminal command hint and one wait card` keeps the old fallback. **C2:** the Create one case and test `a prompt emitted during held native start becomes actionable only with its captured input handle`. **C3:** both expansions of `Codex <format> output raises its code card and closes ready without an answer` (`device label`, `one-time prompt`). **C4:** both expansions of `test messenger signs a disk in again through the <binding>` (the same volume, the code card folded) and the six expansions of `hub cards publish and fold both native copies after <via>`. **C5:** test `secret hub answers reach the handler verbatim and remote replay stores message identity`, both expansions of `native secret <via> retention probe`, test `test messenger preserves only the stored sign-in link and masks other URLs and registered bytes`, test `Telegram secret prompt checkpoint retains native ingress and drops code text and hash`. **C6:** test `the fifteen-minute limit waits for the matching cancellation close before signing out` (exactly 900000 ms of hub clock, the reason `sign-in timed out; closing`, a later answer refused, `signed-out` with the volume kept only after the matching close). **C7:** both expansions of `secret card native replay retains message identity with <outcome>` (`deletion` once, or `one fallback notice` on a messenger without deletion), test `Discord deletes the exact native message and confirms an already absent replay`, test `Telegram deletes the exact native message after a confirmed API result`, test `secret cleanup recovers captured ingress without a repeated update and retries on the hub clock`. **T-1814 C4:** both expansions of `unknown Create one outcome retains its mounted disk and reports the captured login and host once: <failure>` (`native loss`, `setup failure`), test `recovered unknown new-login intent keeps disk ownership and publishes the named cut once` and test `a close without a native exit fact interrupts rather than authorizing disk cleanup` |
| E1535S4-46 | hub-api | QA | `nt E1535S4-46 hub/test/gateway.test.ts hub/test/gateway-secrets.test.ts hub/test/gateway-state.test.ts hub/test/outbox-gateway.test.ts` | Each `CLEAN` (T2 each; unedited, VERIFIED `preserved`): importers of the edited test messenger (`hub/test/fakes/messenger.ts` now declares `deleteMessage` and `secretAnswerNotice`) and of `hub/src/remote/gateway.ts` (T-1791's secret-answer cleanup owner). The messenger's other importers and the importers of the two fake platform APIs reach the added code only through `deleteMessage`, which in `hub/src` only the gateway's secret-answer cleanup calls (VERIFIED with `git grep -n deleteMessage`); they are not run here |
| E1535S4-47 | hub-api | QA | `nt E1535S4-47 hub/test/host-pools-config.test.ts hub/test/config-set.test.ts hub/test/login-relaunch.test.ts` | Each `CLEAN` (T1, T2, T2). **T-1794 C1:** test `hosts relaunch_after_signin defaults false, accepts booleans and init omits it` (undefined reads false; `true` and `false` accepted; `'true'`, `1`, `null` and `{}` refused matching `hosts.relaunch_after_signin.*boolean`; the rendered default config has no `relaunch_after_signin`); `config-set` test `config set applies optional template keys now with normalized parser readback` sets both values with `applies` `now` (the hot reload), and test `config set refuses unknown keys, invalid parser values and silently ignored values without changing bytes` refuses the string `'true'`. **C2, C3:** `login-relaunch` exact 9: the `disabled` expansion of `renewal <outcome> relaunches only the signed-in host and harness after durable success` runs the hook and resumes nothing; `enabled` resumes exactly the two running Codex sessions on that host with their worktree, conversation and session ids, and leaves the OpenCode session, the session on another host and the stopped session untouched; `failed` and `interrupted` run no hook; the three expansions of `sign-in relaunch yields to queued <competitor> at lifecycle admission` (`stop`, `archive`, `resume`) |
| E1535S4-55 | hub-api | QA | `nt E1535S4-55 hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage.test.ts hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts` | Each `CLEAN` (T1, T2, T1, T1, T2, T1; unedited, VERIFIED `preserved`). The frozen usage fixture `hub/test/fixtures/cli-usage/commands.json` migrated by T-1792 (`login remove`), T-1790 (`login signin`) and T-1794 (`CONFIG_USAGE`, `hosts.relaunch_after_signin`) (VERIFIED with `git log` on the file), and the web edge's refusals of `login.remove` and `login.signin` |
| E1535S4-56 | hub-api | QA | `nt E1535S4-56 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1 each). Every new stage file has its tier in `hub/test/tiers.json` and its per-file note with its index row (VERIFIED at `9c98a5747`): `login-reconcile`, `login-signed-out`, `login-remove`, `login-signin-recovery`, `login-relaunch`, `login-card-recovery`, `login-card-signin-owner`, `login-card-signin-remote` T2; `login-signed-out-native`, `login-resignin-native`, `login-card-signin`, `host-agent-signin-op` T3; `signin-client`, `signin-command`, `signin-owner`, `signin-redactor` T1, whose notes `docs/agents/tests/hub-test-signin-{client,command,owner,redactor}.test.ts.md` and four index rows T-1795 added (T-1795 C3; the notes' tier headers say T1, as `tiers.json` and the files' first lines do). The `login-card-signin-owner` note now names both `: native loss` and `: setup failure` titles (T-1795) |
| E1535S4-60 | hub-api | QA | `ns E1535S4-60 '^hc-' hub/test/login-signed-out-native.test.ts` | `CLEAN` with its exact list (T3; two fake provider hosts with real fake SSH agents and the fake OpenCode binary). The `opencode` `provider.auth` expansion of `native <harness> <reason> signs out without stopping existing sessions`: the persisted episode and signal, the binding retained, the next pool launch's native PID on the other host, the original PID alive, no stop (T-1789 C1, C2). Own family `hc-` (the host-create fixture). Record the new `cland-h-*` count (T-1806) |
| E1535S4-61 | hub-api | QA | `ns E1535S4-61 '^hc-' hub/test/login-resignin-native.test.ts` | `CLEAN` with its exact list of 4 (T3; added by T-1790, edited by T-1794, reached by T-1814; fake provider, fake SSH and the fake harness binaries). Test `native bound Codex renews its own dead credential home without replacing the disk` (T-1790 C1); test `native sign-in of unbound Claude, Codex and OpenCode disks reuses and detaches each volume` (C4: ready, last sign-in, snapshot, unchanged volume id and count, confirmed detach); `native opencode sign-in renews the mounted writer with relaunch false` (T-1790 C3 and T-1794 C2: the session keeps its PID, the login reads `in-use` with its bindings and a last sign-in, the volume ids unchanged, the next turn lands on the same volume); `native opencode sign-in renews the mounted writer with relaunch true` (T-1794 C3: after `config.set hosts.relaunch_after_signin true` answers `applies now`, a new PID with the same conversation, worktree and session id, and the renewed turn on the same volume). Record the `cland-h-*` count |
| E1535S4-62 | hub-api | QA | `ns E1535S4-62 '^hc-' hub/test/host-restart.test.ts` | `CLEAN` with its exact list (T3; edited by T-1793, T-1810 and T-1818). It now waits through `reopened live host login disk reachable` before reading the live host's login file (T-1818; a failure of that read is a regression of T-1818's fix, not a flake). The production watchdog deletes the gone host while the hub is stopped; its login volume returns `ready` only after detached inventory; the live worker, binding and machine generation are retained and the Host returns the same rotated bytes (T-1793 C1, C2). The gone host's provision states published after restart end in `destroyed` and never leave it (T-1810; a `'destroying'` read is a FAIL, a regression of T-1810's fix, not a flake). Record the `cland-h-*` count |
| E1535S4-63 | hub-api | QA | `ns E1535S4-63 '^$' hub/test/host-relaunch.test.ts` | `CLEAN` (T3; edited by T-1793). Directory-provider acquisition with `mountedSettledLogin` on both hosts, then test `nested provider cleanup joins its captured machine after close rejection and leaves sibling alive`. No own family is claimed (INFERRED, as in stage 3) |
| E1535S4-64 | hub-api | QA | `ns E1535S4-64 '^hc-' hub/test/host-create-ready.test.ts hub/test/host-destroy-native.test.ts` | Each `CLEAN` (T3 each, two slots; unedited): consumers of `host-create-fixture.ts` (T-1789; T-1791's optional `cardSignIn`, unused by them) and of `provision-host.ts` (T-1810; T-1790's `settleLoginSignInsForHost`). Record the `cland-h-*` counts |
| E1535S4-65 | hub-api | QA | `ns E1535S4-65 "$OWN65" hub/test/host-stop.test.ts hub/test/host-unreachable.test.ts` | Each `CLEAN` (T2 each, standard environment, own slots; `host-stop` one T-1793 line, `host-unreachable` unedited): stop and loss paths over the edited release owner and T-1814's shared interrupt on hub stop |
| E1535S4-66 | hub-api | QA | `ns E1535S4-66 '^hc-' hub/test/login-add.test.ts` | `CLEAN` with its exact list (T3; edited by T-1814). Test `terminal disk logins create a host, reuse it and retain only public metadata`: its terminal disconnect now waits on `disconnect durable interrupted receipt`, then reads `signedOut.reason` `sign-in interrupted` with `signedOut.host` the first host, the volume still attached to that host's machine and its `cland/auth/codex-disconnected` mount symlink pointing at the volume's contents (T-1814 C1); the success and failure paths stay the CLI's post-close completion (C3). **R-1:** one T-1805 receipt naming the source worktree is expected, recorded, untouched |
| E1535S4-67 | hub-api | QA | `ns E1535S4-67 '^login-term-' hub/test/login-terminal.test.ts` | `CLEAN` with its exact list (T3; unedited): the CLI's native SSH ownership through close, which T-1790's recovery policy and T-1814 C3 rely on (the CLI's own post-close completion) |
| E1535S4-68 | hub-api | QA | `ns E1535S4-68 '^lwb-' hub/test/login-write-back.test.ts` | `CLEAN` with its exact list (T3; unedited): release over T-1793's and T-1790's edits to `login-release.ts` |
| E1535S4-69 | hub-api | QA | `ns E1535S4-69 '^login-exclusive-' hub/test/login-exclusive-native.test.ts` | `CLEAN` with its exact list (T3; unedited): reader clones over T-1793's reader-deletion receipt |
| E1535S4-70 | hub-api | QA | `ns E1535S4-70 "$OWN61" hub/test/login-key-spawn.test.ts` | `CLEAN` with its exact list (T3; unedited): key logins over T-1792's key-file removal path and T-1789's OpenCode adapter edits |
| E1535S4-71 | hub-api | QA | `ns E1535S4-71 "$OWN71" hub/test/opencode-adapter.test.ts` | `CLEAN` (T3, the `opencode` contract; unedited): T-1789's OpenCode adapter and fake-binary edits. **R-1:** one T-1676-class CLI-hub receipt naming the source worktree is expected, recorded, untouched |
| E1535S4-72 | hub-api | QA | `ns E1535S4-72 '^hc-' hub/test/login-card-signin.test.ts` | `CLEAN` with its exact list of 4 (T3; added by T-1791, reached by T-1814; the host-create fixture with `cardSignIn`, the real fake-host agent, the existing fake Claude and Codex binaries and a pair of test messengers; no real provider, credential, sign-in endpoint or browser). Both expansions of `native Claude card creates and renews one disk across both remotes with <outcome>`: Create one from no host creates one pool host and disk, the fake link reaches the card, a secret input is written and the login reads `ready` with exactly one snapshot (T-1791 C1, C2); renewal through the other messenger keeps the same host and volume with a distinct native admission and both messengers see the answered code card (C4); the code message deleted once (`deletion`) or one fallback line (`one fallback`) on the captured sender (C7); the bounded no-symlink scan finds the pasted sentinel nowhere after a planted positive control (C5). Test `native Codex card completes device sign-in without an answer` (C3). Test `native cancelled Claude card closes its admitted writer before failed disk completion` (the exact admission's durable native close before `signed-out` with a detached, kept volume: the native half of C6; the fifteen-minute hub clock itself is E1535S4-45's owner case, as the file's note says). Record the `cland-h-*` count |
| E1535S4-73 | hub-api | QA | `ns E1535S4-73 '^ldt-' hub/test/host-agent-signin-op.test.ts` | `CLEAN` with its exact list of 5 (T3; added by T-1815; the native agent socket and fake volume links; own family `ldt-`, the file's `fixtureRoot` prefix, VERIFIED). Test `sign-in streams bounded output, redacts split input echoes and persists its exact close` (T-1815 C1, C2, C4); test `sign-in cancel joins descendants and durable close before unmount` (C3); test `sign-in output overflow terminates with an explicit bounded close outcome` (C1); test `post-release rejection retains descendant birth and refuses unmount` and test `failed native-close publication emits incomplete and refuses a waiting unmount` (C3). Record the `cland-h-*` count |

### Web cases (when in scope)

None: no stage path is under `web/` or `nvim/` (VERIFIED: `git diff --name-only 85e60f6cb 9c98a5747 -- nvim web` is empty, T-1791's and T-1795's landings included). The web and Neovim show the sign-in cards through the existing hub cards, run sealed in E1535S4-45 (`hub cards publish and fold both native copies after web` and `… after neovim`); no real-browser run and no human notice.

## Manual checks

Run in table order: E1535S4-00 to E1535S4-07 before the cases, E1535S4-80 to E1535S4-89 after them, then cleanup step 1, then E1535S4-99. Record each with `sh .agents/skills/qa/qa-record.sh note E-1535 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Scratch rows begin with the kit's `PRE gate` line and end with `# fresh: redacted or withheld lines 0` and `row exit 0`.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1535S4-00 | hub-api | QA | `s00 > "$EV/E1535S4-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`. `plan read exit 0`; the stage line with the exact name, `qa` `{"scope":"affected","when":"after-stage"}`, `items` T-1789, T-1790, T-1815, T-1791, T-1814, T-1794, T-1792, T-1793, T-1795 plus any finding fixes the request names, `merged` equal to `total`, `state` not `closed`. Every member `landings 1` (VERIFIED at `792c9c301` and `9c98a5747`: `T-1789 landings 1 f10710982…`, `T-1790 landings 1 44a2775c9…`, `T-1815 landings 1 7d2f0a59b…`, `T-1791 landings 1 3cfbebfce…`, `T-1814 landings 1 1dcb32ec4…`, `T-1794 landings 1 6aa8c95df…`, `T-1792 landings 1 ee483c2a0…`, `T-1793 landings 1 15ee52343…`, `T-1795 landings 1 a03cd7b970bb18b1dee041d5972cf72a19db2f0b`). At `792c9c301` the plan read `merged 9`, `total 9`, `statuses {"done":9}`, state `open` (VERIFIED); `cover` there read `missing ["Linux droplet","macOS"]`, which E1535S4-06 requires to read `missing []` at the run |
| E1535S4-01 | hub-api | QA | `s01 > "$EV/E1535S4-01.txt" 2>&1` | Node 24; `typecheck exit 0`; `dirty entries 0` |
| E1535S4-02 | hub-api | QA | `s02 > "$EV/E1535S4-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0` and `preserved files edited at its landing: []`; `stage paths under nvim/ or web/: []`; `remote authority table changed in the stage: []`. **Landing check** (VERIFIED in bash at `99356638a`, `792c9c301` and `9c98a5747`): T-1793, T-1792, T-1790, T-1794, T-1815, T-1791, T-1814 and T-1795 each `own lines … : yes` and `files byte-identical … : yes` (T-1795's two: `T-1795 own lines at its landing a03cd7b970bb18b1dee041d5972cf72a19db2f0b equal its tip 90410ef27b35fbbb7c21ee306412adc03f80467b: yes` and `T-1795 files byte-identical to 90410ef27b35fbbb7c21ee306412adc03f80467b at its landing: yes`), and, since T-1795 has no merge batch, `T-1795 direct landing (no merge batch): Item trailers 1; parents 1; first parent 99356638a9319380a3e4695d04ccbd7c6dcc2854; tree equals its tip's tree: yes`; T-1789 `own lines … : yes` and `files byte-identical to 1470a7b09… at its landing: no: docs/hub/logins.md hub/README.md hub/test/login-release.test.ts`, accepted only with `T-1789 tip-to-landing difference equals a38929ae8's change in its three files: yes` (C-1). Later commits touching their files at `9c98a5747` (newest first; VERIFIED): `T-1793 [9c98a5747 a03cd7b97 1dcb32ec4 3cfbebfce 7d2f0a59b 68ed9d82b 6aa8c95df 44a2775c9 ee483c2a0 f10710982 a38929ae8 10711a330]`, `T-1789 [9c98a5747 a03cd7b97 1dcb32ec4 3cfbebfce 7d2f0a59b 6aa8c95df 44a2775c9 ee483c2a0]`, `T-1792 [a03cd7b97 1dcb32ec4 3cfbebfce 7d2f0a59b 6aa8c95df 44a2775c9]`, `T-1790 [9c98a5747 a03cd7b97 1dcb32ec4 3cfbebfce 7d2f0a59b 6aa8c95df]`, `T-1794 [9c98a5747 a03cd7b97 1dcb32ec4 3cfbebfce 7d2f0a59b]`, `T-1815 [9c98a5747 a03cd7b97 1dcb32ec4 3cfbebfce]`, `T-1791 [9c98a5747 a03cd7b97 1dcb32ec4]`, `T-1814 [a03cd7b97]`, `T-1795 []`. T-1795's landing `a03cd7b97` appears wherever a member's files include `docs/hub/logins.md`, `docs/agents/tests/index.md` or the `login-card-signin-owner` note; the durations commit `9c98a5747` wherever they include `hub/test/durations.json` (T-1792, T-1814 and T-1795 landed none). At `792c9c301` the lists are the same without `9c98a5747` (VERIFIED). At the request a list may also open with this brief's own commit only when that commit is `brief-and-durations` and the list holds `9c98a5747`; nothing else. **Stage commits** (first-parent from `BASE`, VERIFIED to `9c98a5747`, 24 in order): `697c33ddd class durations` (its `durdelta` line: `entries outside allow changed or removed 0; added 4; allowances removed 0; changed 0 …; added 0; version same true`), `2d9c76af8 class tracker`, `15ee52343 class member` (`Item: T-1793`), `71962ff09 class tracker`, `10711a330 class coord-docs-10711a330`, `a38929ae8 class out-of-stage-T-1810`, `f10710982 class member` (`Item: T-1789`), `5baccac29 class tracker`, `ee483c2a0 class member` (`Item: T-1792`), `25e4525ae class tracker`, `44a2775c9 class member` (`Item: T-1790`), `e744bc339 class tracker`, `6aa8c95df class member` (`Item: T-1794`), `7d50d44b3 class tracker`, `68ed9d82b class out-of-stage-T-1818`, `7d2f0a59b class member` (`Item: T-1815`), `065cf1416 class tracker`, `3cfbebfce class member` (`Item: T-1791`), `91fcb5113 class tracker`, `1dcb32ec4 class member` (`Item: T-1814`), `99356638a class tracker`, `a03cd7b97 class member` (`Item: T-1795`, paths 9), `792c9c301 class tracker`, `9c98a5747 class durations` (paths 1; its `durdelta` line: `entries outside allow changed or removed 0; added 227; allowances removed 0; changed 0 (renewals keeping seconds and owner 0; reason-only 0); added 0; version same true`). At `9c98a5747`: `first-parent commits from BASE to the request: 24; after the writing dev: 1`; at a request that is `9c98a5747` plus this brief's own commit: `25` and `2`. After `792c9c301`, each commit must be one of: the durations commit `9c98a5747` with exactly that add-only `durdelta` line (no allowance changed or removed, `version same true`), `tracker`, `brief-only` or `brief-and-durations` for `qa/briefs/E-1535-stage-4.md` (a durations line with `entries outside allow changed or removed 0`, `allowances removed 0`, every changed allowance a renewal or reason-only, `version same true`), or another `durations` commit with that same shape. A second `member` commit or any `Item:` trailer after `792c9c301` is not acceptable. `commits of class other: 0`; any other commit (an out-of-stage landing the request does not name included) makes the run BLOCKED: keep the evidence and report |
| E1535S4-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1535S4-03.txt" 2>&1` | Every line `ok`, 81 lines (VERIFIED at `792c9c301` and `9c98a5747` for all 81: the 35 of A-18760, T-1789, T-1793, T-1792 and T-1810, T-1790's six, T-1815's eight, T-1791's nine, T-1814's seven, T-1794's six and T-1795's ten docs lines, from `ok T-1795 C1 the ADR links spec v0.4 section 3.7 | docs/adr/0009-login-storage-boundary.md | 1 | =1` to `ok T-1795 C3 the notes storage-boundary section the ADR links | docs/hub/logins.md | 1 | =1`). A `MISMATCH` on a settled line is read at the build; it is a FAIL unless the landing changed it with a recorded decision |
| E1535S4-04 | hub-api | QA | `node "$Q/ids.mjs" "$W/qa/briefs/E-1535-stage-4.md" > "$EV/E1535S4-04.txt" 2>&1` | `missing from the tables: 0` and `open landing markers: 0 (T-1790 0, T-1791 0, T-1794 0, T-1795 0)`; a non-zero marker count is BLOCKED (the brief was not completed at a landing) |
| E1535S4-05 | hub-api | QA | `s05 > "$EV/E1535S4-05.txt" 2>&1` | `bare transitions to signed-out in production source: 0` (A-18760; VERIFIED 0 at `25e4525ae`, `99356638a`, `792c9c301` and `9c98a5747`; the four scans read the same at each); `markSignedOut callers outside logins.ts: [hub/src/adapters/claude-code.ts hub/src/adapters/sessions.ts hub/src/host/login-add.ts hub/src/host/login-reconcile.ts hub/src/host/login-signals.ts hub/src/host/login-signin.ts ]` (VERIFIED at `25e4525ae` and unchanged at `99356638a`: no later landing, `login-card-signin.ts` included, adds a caller; `claude-code.ts` matches only through its private local-latch method `#markSignedOut`, VERIFIED; any other file is a finding to read); `logout commands in production source: 0`; `removal claim cleared outside logins.ts: 0` (A-18760). Each scan excludes `qa/briefs/` and `.cland/` |
| E1535S4-06 | hub-api | QA | `s06 > "$EV/E1535S4-06.txt" 2>&1` (after E1535S4-00; reads only) | **Member verify receipts** (VERIFIED at writing): `T-1793 verify 98952686-… executor droplet state finished result passed artifact A-18666 head is the reviewed tip true`; `T-1789 verify 53625592-… … A-18736 … true`; `T-1792 verify 95ecfec4-… … A-18792 … true`; T-1810 (out of stage) `fe2368bf-… … A-18729 … true`; `T-1790 verify 5de902e2-… … A-18807 … true`; `T-1794 verify f9326204-… … A-18847 … true`; T-1818 (out of stage) `8046292f-… … A-18872 … true`; `T-1815 verify bdc78299-… … A-18875 … true`; `T-1791 verify db4a0b0a-… … A-18903 … true`; `T-1814 verify 1e207d4d-… … A-18925 … true`; `T-1795 verify df8e426a-a494-4ffd-a8fd-8b6543b52b04 executor droplet state finished result passed artifact A-18940 head is the reviewed tip true` (each `executor droplet state finished result passed`, VERIFIED with `task view` at writing; T-1795's read at `792c9c301`). **T-1795 has no merge batch** (a direct landing): no batch line is expected for it; instead its own verify log is read in the suite list, `df8e426a-a494-4ffd-a8fd-8b6543b52b04 A-18940- head 90410ef27b35fbbb7c21ee306412adc03f80467b occasion null executor droplet os linux failing phase lines 0; passing phase lines 5; Workers 2 · source hub config; head is the request false` (VERIFIED; its log reads `mode full`, the merged-landing tests and mapped guards of the stage), and the last line reads `merge-batch candidates naming T-1814: 1; T-1795: 0` (VERIFIED at writing; T-1814's `1` is the positive control: a `0` there means the scan read nothing, INCONCLUSIVE; a non-zero T-1795 count contradicts the direct landing and is read before judging). **Merge-batch logs** (full T3; `occasion batch`, `executor droplet`, `os linux`, `failing phase lines 0`; VERIFIED from each log's deciding files): T-1793 suite `83feb4c8-…` (A-18671, A-18672), T-1810 `d434a460-…` (A-18740, A-18741), T-1789 `47472a71-…` (A-18758, A-18759), T-1792 `b25f6338-…` (A-18797, A-18798), T-1790 `df9f5f80-…` (A-18813, A-18814), T-1794 `893edbaa-…` (A-18859, A-18860), T-1818 `ad37ee0a-…` (A-18882, A-18883), T-1815 `e4d0f05f-…` (A-18886, A-18887), T-1791 `38613bb6-…` (A-18908, A-18909), T-1814 `69857123-…` (A-18931, A-18932) (VERIFIED for the six new ones: `failing phase lines 0`, `passing phase lines 3` in each log; their `head is the request` reads `false`, a batch candidate is never the request); T-1795 has none (see above). **Stage covers: the Coordinator's cover pair at the requested dev SHA** (QA starts neither): the plan's `cover` reads `missing []`; the Linux log `occasion stage`, `executor droplet`, `os linux`, `head is the request true`, `failing phase lines 0`; the macOS log `occasion stage`, `executor local`, `os darwin`, `Workers 1 · source explicit --workers`, `head is the request true`, `failing phase lines 0`. Record skips and remote lifetime and cost. A cover missing, running or at another head is BLOCKED (never submit one) |
| E1535S4-07 | hub-api | QA | `s07 > "$EV/E1535S4-07.txt" 2>&1` | Exactly these lines, each count read at the landing `a03cd7b97` and at `9c98a5747` (VERIFIED with the probes themselves): `ADR files for login storage: 1` (C1; `docs/adr/0009-login-storage-boundary.md`); `spec v0.1.2 amendment lines naming logins: 1`, `dated logins amendment paragraphs inside section 3.13: 1` (the paragraph `**Amendment, 2026-11-11 — logins on hosts.** [ADR 0009](…)` between `### 3.13 Accounts and limits` and `### 3.14 The remote executor`) and `pre-stage lines of docs/spec/v0.1.2.md changed or removed: 0` (C2, appended only); for C3, each heading word chosen from the landed `docs/hub/logins.md` headings: `logins notes heading lines with store api: 1` (`## Store API`, which holds the login states and their transitions; the notes have no heading with `state`), `… with binding: 1` (`## Binding at launch`), `… with releasing: 1` (`## Releasing host disks`), `… with snapshot: 1` (`## Backup snapshots`), `… with key store: 1` (`## Key store`), `… with card: 2` (`## Login wait cards`, `## Sign-in from a card: secret answers and expiry`), `… with reconciliation: 1` (`## Startup reconciliation owner`), and `logins notes state-transition lines: 1` (the `markSignedOut(name, {reason, host})` paragraph naming creating, ready and in-use); `closed-item wording lint exit 0` (C4; INFERRED at this build: not run while writing; A-18942 records the lint's fixture diagnostics passing with 0 findings at `90410ef27`, whose tree the landing equals, and `792c9c301` closed T-1795 after that, so the run's own exit decides). A count other than the one named is a FAIL against T-1795 unless a later accepted commit changed the file (none of them may) |
| E1535S4-80 | hub-api | Human | `mrow E1535S4-80 r80` | **Setup** (stage 3's `r80` with R-2): `PRE p1 entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `qa pool tables before: 0`; `qa pool tables written: 1`; `hub start exit 0; hub up`; `host rows 0`; `fake machines 0`; `auth directory before any key login: absent` (VERIFIED as stage 3's run recorded them; INFERRED unchanged at this build). A failure makes E1535S4-81 to E1535S4-84 BLOCKED |
| E1535S4-81 | hub-api | Human | `mrow E1535S4-81 r81` | Stage 3's `r81`: both key logins `added lines 1`; `key files 2`; both sentinels `sentinel occurrences 0`; `capacity lines 1` and `qa opencode capacity lines 1`; both JSON rows `kind key; state ready; exclusive absent; storage absent; bindings 0` (INFERRED unchanged; T-1790's landing added a `HINT` column to the text header, which no expectation reads) |
| E1535S4-83 | hub-api | Human | `mrow E1535S4-83 r83` | Stage 3's `r83` across a real restart: `new hub pid yes`; `store key present true; store key value occurrences in the listing 0`; `rows unchanged across the restart true`; both sentinels `sentinel occurrences 0` (reconciliation, T-1790's sign-in recovery and T-1791's card-intent and secret-cleanup recovery run at this start and change no key row, INFERRED) |
| E1535S4-84 | hub-api | Human | `mrow E1535S4-84 r84` | **T-1792 C4 on the real CLI.** `(remove unknown)` exit non-zero with `unknown-login lines` at least 1; `(remove malformed)` exit non-zero with `usage lines` at least 1; `(remove key) exit 0` with `removed lines 1`; `key file opencode-1 absent; key file keytwo present`; `store key file unchanged by the removal: yes`; `rows after remove: keytwo ready`; both sentinels `sentinel occurrences 0`. INFERRED: the exact strings from `hub/src/host/login-remove.ts` and `hub/src/cli/login.ts`, not from a run |
| E1535S4-89 | hub-api | Human | `mrow E1535S4-89 r89` | `hub stop exit 0; hub down`; every recorded pid `alive no`; `processes naming the scratch root: 0`; `processes naming the worktree: 0`. Then cleanup step 1 |
| E1535S4-99 | hub-api | QA | `s99 > "$EV/E1535S4-99.txt" 2>&1` (after cleanup step 1) | HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `slot overruns: 0`; `own-family new entries across all rows: 0`; `new fixture-owner receipts naming the source worktree or repository`: exactly the two R-1 receipts (E1535S4-66, E1535S4-71), dead; a third, a live owner or an open handle fails the row; `T entries other than node-compile-cache 0`. **Found aside, recorded:** the `historical cland-h-` counts and the per-row `cland-h-*` deltas (T-1806); other new entries attributed per row |

Before requesting QA, run `node hub/bin/cland.ts qa lint qa/briefs/E-1535-stage-4.md --commit <dev SHA>` from the root, with a dev SHA that includes every stage landing. The brief is complete only when qa lint passes at the build and no landing marker remains.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** The loop titles (`<harness> classifies dead login <reason>`, `one-sign-in hint uses account and an exclusive 24h clock window (<elapsed>ms)`, `signed-out reconstruction repairs publication <fault>`, `sign-in card for <name> …`, `Codex remote native error reports dead login <reason> without stopping`, the `login-reconcile` and `login-remove` parameterised cases, `native <harness> <reason> signs out …`, `native <harness> sign-in renews the mounted writer with relaunch <relaunch>`, the `login-signin`, `login-add-component`, `login-host-pin`, `login-list`, `login-snapshots`, `login-relaunch`, `login-wait`, `hub-cards`, card-owner, card-remote and native card loops) are expanded in `expect.json`; `86400000-1` expands to `86399999`; `malformed close ${JSON.stringify(exit)} stays incomplete` expands to the JSON text of each exit, and `{code:undefined,signal:'SIGTERM'}` drops `code` (`{"signal":"SIGTERM"}`); `login admission refuses ${name||'empty name'} …` expands the empty name to `empty name`.
- **Per-file notes can lag their titles; the test file is the source, never the note.** At `99356638a` the `login-card-signin-owner` note named `unknown Create one outcome retains its mounted disk and reports the captured login and host once` without the `: <failure>` suffix T-1814 added, and the four T1 `signin-*` files had no notes or index rows; T-1795's landing fixed both (VERIFIED at `a03cd7b97`). A stale title in an older brief or report about those notes is history, not a finding.
- **`login-resignin-native`'s third case was split.** T-1790 landed it as `native <harness> sign-in renews the mounted writer while its session keeps running`; T-1794 renamed and doubled it into `… with relaunch false` and `… with relaunch true`. An old name in a report is a stale expectation, not a missing case.
- **`login-wait`'s option 1 answers `Signing in` now** (the installed card owner, T-1791); its open-ask count is one because of the legitimate new sign-in-again card (stage-3 brief's current mapping at dev). The terminal command hint lives on only in `login create without a sign-in owner keeps the terminal command hint and one wait card`.
- **An interrupted new login keeps its disk attached and mounted** (T-1814): after owner loss the login reads `signed-out` with `sign-in interrupted` and the captured host while the volume stays attached; only that exact machine's deletion receipt or the owner's own close settles it. Elapsed time never does.
- **T-1818 is fixed.** A failed read of the reopened live host's login file in `host-restart` is a regression, never a known flake.
- **A signed-out row keeps its bindings.** `markSignedOut` retains binding and reader rows by design (A-18760); placement skips the host for that harness through the verdict, not through unbinding.
- **Removing a ready login first marks it signed out** (`reason: 'removing'`, host null) under the removal claim; that episode raises no usable sign-in card and does not count toward the one-sign-in hint.
- **A missing volume is a sign-out, not a deletion.** Reconciliation signs the login out with `volume missing` and keeps its row.
- **The T-1789 byte difference is expected** (C-1): accept it only with the explicit equality line.
- **T-1810 is fixed.** A `'destroying'` read in `host-restart` is a regression, never a known flake.
- **Native coverage is OpenCode only for dead-login and next-turn renewal** (T-1813); component cases cover every signal.
- **Two environments, pre-existing names, inventories taken during a file, a clean TAP versus root removal, the T-1805 receipt, seeded sentinels, plain Node file runs versus the suite runner, process censuses, mtime probes, wall times, platform-only cases and renamed helpers:** exactly as stage 3's "Probes that mislead" (carried at `M4`).

## Out of scope

- The real DigitalOcean API, droplets, volumes, snapshots, keys, tokens and any network; real harness sign-in, browser sign-in links and real terminals; real remotes (T-1791 uses the test messenger).
- Native Codex and Claude Code dead-login and next-turn renewal (T-1813); the product fixes of T-1812, T-1816 and T-1817.
- Neovim and web consumers (no stage path under `nvim/` or `web/`, VERIFIED at `9c98a5747`; `nvim/test/remotes.test.ts`, a T3 importer of the edited test messenger, is not run: no Neovim).
- Linux and container runs, the stage covers, the merge batches, the members' mode-free verifies and loaded repetitions: their evidence is read in E1535S4-06.
- Duration allowances as pass conditions; T-1731 and T-1770 as bugs; T-1801, T-1802, T-1804, T-1805, T-1806, T-1808, T-1809, T-1812, T-1813, T-1816, T-1817 and T-1676 as fixes (recorded if seen).
- Any `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland hub …` or `cland host …` on the live project.

Missing authorization (a real provider token, a harness account, a GUI) is out of scope, not BLOCKED, because no case needs one. A stage cover that has not finished at the requested SHA is BLOCKED (E1535S4-06).

## Grants

none. Every case runs on this Mac against fakes, the sealed rows with a disposable HOME and the native rows with fixture-sealed children, and no credential.

## Rows to verify after landing

**Every line here was settled at dev `792c9c301dca0826bddee517d8614bffd59b608b`** (every member landed, T-1795 last at `a03cd7b97`, and the out-of-stage T-1810 and T-1818), and the Git-only rows again at `9c98a5747`; the lines of the members that landed earlier were settled at `99356638a` (the T-1789, T-1792 and T-1793 lines first at `25e4525ae`) and are unchanged since, because `a03cd7b97`, `792c9c301` and `9c98a5747` touch only docs, `.cland/tasks/` and `hub/test/durations.json`. Before requesting QA, the Coordinator re-reads each line below at the requested dev SHA and records each difference. Acceptable commits after `792c9c301` are the durations commit `9c98a5747` (`9c98a5747646b75f248f952290d69e54073376ef`, add-only, with E1535S4-02's exact `durdelta` line), tracker commits (`.cland/tasks/` only), this brief's `qa/briefs/E-1535-stage-4.md` commit with or without `hub/test/durations.json`, and a further durations-only commit with the E1535S4-02 shape; the commits after `25e4525ae` already accepted are T-1790's `44a2775c9`, T-1794's `6aa8c95df`, T-1815's `7d2f0a59b`, T-1791's `3cfbebfce`, T-1814's `1dcb32ec4` and T-1795's `a03cd7b97` landings, the out-of-stage T-1818 landing `68ed9d82b` and the tracker commits `e744bc339`, `7d50d44b3`, `065cf1416`, `91fcb5113`, `99356638a` and `792c9c301` (no Coordinator docs commit since `10711a330`; durations commits `697c33ddd` and `9c98a5747` only).

**Settled at `792c9c301` and `9c98a5747` (VERIFIED):** the nine landing receipts, their landing checks in bash (C-1 for T-1789; byte-identical for the other eight, and for T-1818 and T-1810; T-1795's direct landing with no merge batch) and later-commit lists; the 24 first-parent stage commits to `9c98a5747` and their classes; the durations deltas of `697c33ddd` and `9c98a5747`; the plan read (`merged 9`, `total 9`, `statuses {"done":9}`, covers missing); T-1795's criteria, verify `df8e426a` and docs probes (E1535S4-07, the ten `src.mjs` docs lines); the preserved list unedited (`login-add` removed from it: T-1814 edits it); the 81 source lines; every `expect.json` list, read from the test files and expanded through their loops; the tiers and tier headers; the reviewed tips from each member's final clear verdict; the verify receipts and the batch logs (batch candidate trees equal to the landing trees) of T-1793, T-1789, T-1792, T-1790, T-1794, T-1815, T-1791, T-1814, T-1810 and T-1818; the carried sections at `M2`, `M3` and `M4` and every extracted range's SHA-1 (T-1791's edits to the stage-1 and stage-3 briefs are outside `M2` and `M4`); the own-family prefixes (`hc-` for the host-create fixture's `tempProject`, which `login-card-signin` uses and neither its test file nor `login-card-fixture.ts` nor `login-card-signin-trace.ts` adds to; `ldt-` for `host-agent-signin-op`'s `fixtureRoot`); E1535S4-05's four scans; no stage path under `nvim/` or `web/`.

**Needs a landing commit (the landing markers):** none; every marker is filled (see "Landing markers").

**INFERRED, with the reason:** the scratch rows' exact strings (from source and stage 3's passing run, not a run at this build); E1535S4-07's `closed-item wording lint exit 0` (not run while writing; A-18942 records it passing at T-1795's tip, before `792c9c301` closed T-1795); the stage covers' outcome (not yet run at writing); that `host-relaunch` claims no own family; that the publication scanner passes every stage title and sentinel; that no native file writes under the user's HOME; that the two new native files (`login-card-signin`, `host-agent-signin-op`) leave no fixture-owner receipt naming the source worktree, so that E1535S4-99 still expects exactly the two R-1 receipts (not read from a run here: each new native row's receipts are recorded and attributed before E1535S4-99 is judged); that the messenger's and the fake platform APIs' other importers are unaffected (reasoned from `deleteMessage`'s only production caller, not run).

## Source provenance

VERIFIED = read in source, Git or the tracker at dev `792c9c301dca0826bddee517d8614bffd59b608b` and, for the Git rows, at `9c98a5747646b75f248f952290d69e54073376ef` (the earlier pass at `99356638a9319380a3e4695d04ccbd7c6dcc2854`; first drafted at `25e4525ae0e5772e4e895414d7186c3dbb7b4f77`).

- Kits and helpers: `K` = `f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`; `M3` = `18911bda46c7c0dc332619e93d25041069d3704a` (stage-2 brief blob `a5df2de9a6ae74874906244473cac002ea0dab22`); `M4` = `85e60f6cb34ec320cc7a1f5456de3a4693acbe17` (stage-3 brief blob `b2febfa90b5b88c41cdf1954303543b6a3953359`, ranges 737, 743–745, 748–755, 813–839, 851–860); `M2` = `0d0618042fae7b76919d1be152e252b09e4a43ad`. The stage-3 run: A-18617 (clear at `1ce802084`), its corrections folded in `fe2f9af99`.
- Decisions: A-18760 (lane-1 addendum), read with A-18587; T-1790's tracker comments (Coordinator decisions e516d138, feb9d4e1, 1cd13e7f, 82ab5bec, 18d3cb27, cec7ed39).
- T-1793 (`15ee52343`, tip `e3767adfd`, 28 files; verify `98952686` A-18666; batch `83feb4c8` A-18671, A-18672).
- T-1810 (`a38929ae8`, out of stage, tip `3ee73e112`, 11 files; verify `fe2368bf` A-18729; batch `d434a460` A-18740, A-18741).
- T-1789 (`f10710982`, tip `1470a7b09`, 37 files, C-1 difference from `a38929ae8`; verify `53625592` A-18736; batch `47472a71` A-18758, A-18759).
- T-1792 (`ee483c2a0`, tip `efaba34f8`, 24 files; verify `95ecfec4` A-18792; batch `b25f6338` A-18797, A-18798).
- T-1790 (`44a2775c9`, tip `3683b2f7b`, 45 files; `rev-35-1790-source-1` not clear at `a756d5c2d`, `rev-35-1790-source-2` not clear at `85352c52d`, `rev-35-1790-source-3` and `rev-35-1790-final-1` clear at `3683b2f7b`; verify `5de902e2` A-18807; batch `df9f5f80` A-18813, A-18814).
- T-1794 (`6aa8c95df`, tip `dd4650fa7`, 23 files; `rev-35-1794-source-1` not clear at `225aa5bdf`, `rev-36-1794-source-2` and `rev-36-1794-final-1` clear at `dd4650fa7`; verify `f9326204` A-18847; batch `893edbaa` A-18859, A-18860).
- T-1818 (`68ed9d82b`, out of stage, tip `0679105b1`, 2 files; `rev-36-1818-source-1` and `rev-36-1818-final-1` clear there; verify `8046292f` A-18872; batch `ad37ee0a` A-18882, A-18883).
- T-1815 (`7d2f0a59b`, tip `2b2add0f2`, 32 files; split out of T-1791 in `7d50d44b3`; two source verdicts not clear, then delta and final clears ending `rev-37-1815-delta-1` and `rev-37-1815-evidence-1` at `2b2add0f2`; verify `bdc78299` A-18875; batch `e4d0f05f` A-18886, A-18887).
- T-1791 (`3cfbebfce`, tip `26b09338a`, 54 files; `rev-35-1791-delta-6` and `rev-35-1791-final-1` clear at `26b09338a`; verify `db4a0b0a` A-18903; batch `38613bb6` A-18908, A-18909).
- T-1814 (`1dcb32ec4`, tip `c111a20aa`, 18 files; filed in `e744bc339`, joined stage 4 in `7d50d44b3`; `rev-35-1814-source-3` and `rev-35-1814-final-1` clear at `c111a20aa`; verify `1e207d4d` A-18925; batch `69857123` A-18931, A-18932).
- T-1795 (`a03cd7b97`, direct landing with no merge batch, first parent `99356638a`; tip `90410ef27`, tree equal to the landing's; 9 files; branch `t/T-1795-the-adr-the-v0-1-2-3-13-amendment-and`; `rev-35-1795-delta-11` not clear at `47998ff8f`, `rev-35-1795-delta-12` clear at `4ede548a9`, `rev-35-1795-delta-13` and `rev-35-1795-final-1` clear at `90410ef27` (A-18936, A-18938, A-18942); verify `df8e426a` A-18940; status `done`, Coordinator comment "Merged a03cd7b970bb18b1dee041d5972cf72a19db2f0b onto dev.").
- Coordinator commits: `697c33ddd` and `9c98a5747` (durations add-only), `10711a330` (one `docs/hub/logins.md` sentence); tracker commits `2d9c76af8`, `71962ff09`, `5baccac29`, `25e4525ae`, `e744bc339`, `7d50d44b3`, `065cf1416`, `91fcb5113`, `99356638a`, `792c9c301`.
- Known non-blocking items, read with `task view`: T-1806, T-1808, T-1809, T-1812, T-1813, T-1816, T-1817, T-1801, T-1802, T-1804, T-1805 (backlog, needs-triage), T-1676 (backlog, qa-found); T-1810, T-1811 and T-1818 `done`; T-1814 is now a stage member (`done`).

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "signed out, signing in again and from cards, remove, reconciliation and the amendment"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1535 stage signed out, signing in again and from cards, remove, reconciliation and the amendment` or `qa not clear E-1535 stage signed out, signing in again and from cards, remove, reconciliation and the amendment` to the requester in the epic topic. Publish evidence only after a clean secret scan with a positive control (rule 15; T-1808).

## Landing markers

Open at writing: none (`open landing markers: 0`, VERIFIED with `ids.mjs` on this file). Each landing's markers were filled at that landing and removed; find any with a fixed-string grep for `TODO(` followed by the member id. If a landing is not byte-identical to the head its rows were written from, every line it touches is re-read. T-1790's, T-1791's and T-1794's markers were filled at `99356638a` from their landings (`44a2775c9`, `3cfbebfce`, `6aa8c95df`), each byte-identical to its reviewed tip; T-1815 and T-1814 joined lane 1 after the first draft and were written straight from their landings (`7d2f0a59b`, `1dcb32ec4`), so they never carried markers.

**T-1795** (filled at `792c9c301` from its landing `a03cd7b97`, byte-identical to its reviewed tip `90410ef27`; first drafted from `acfa3d7f6`, then its branch head `4ede548a9`): "Stage" (its scope entry); "Criteria map" (one row per criterion C1 to C4, read with `task view`); "Build" (its landing receipt and the plan read `merged 9`, `total 9`); the `src.mjs` paragraph and block (ten docs lines); the defaults paragraph (`T1795` defaulting to `90410ef27…`; no batch, so the direct-landing checks in `s02` and `s06` replace it); E1535S4-00, -02 (its landing check lines, the direct-landing line, its place in the later-commit lists), -03, -06 (its verify line, its own verify log in place of a batch, the batch-candidate count) and -07 (the heading words re-derived from the landed headings: at `4ede548a9` the earlier `state` and `release` probes read 0, and they still do at `a03cd7b97`, so they are now `store api` and `releasing`, each probe's count read there).
