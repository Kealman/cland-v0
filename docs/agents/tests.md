# Running tests

The root `npm run typecheck` uses native TypeScript 7.0.2 for the hub's bin, src
and test files, Neovim's bin and test files, and the web workspace, through their respective
`tsconfig.json` files. It also checks `shared/wire/tsconfig.json` with DOM libraries
and `types: []`, so the browser leaf has no ambient Node types.
`npm run typecheck --workspace hub` checks only the hub, including the compile-time
wire conformance assertions in `hub/test/wire-conformance.ts`. These compare the
independently restated shapes (including nested and optional fields) to their hub
owners; keep the assertions outside the browser leaf. New snapshot and delta
types belong in `shared/wire/` when their protocol extensions are implemented.
`web.link` and its `{url}` result have explicit conformance assertions there too.
The scripts use `hub/bin/typecheck.ts` to resolve the pinned `typescript7` npm
alias, including from task worktrees that inherit the root install. This avoids
the two compilers' shared `tsc` executable name. TypeScript 5.9.3 stays installed as
`typescript` because `hub/test/executor.test.ts` and
`hub/test/lint-tracker-container-source.ts` use its compiler API, which 7 does
not provide. T-427 records matching diagnostics on both clean projects and
planted strict-option/import errors before the switch.

## This repository's verification commands

This repository records these `[verification]` values in `.cland/config.toml`:

```toml
prepare = "node hub/bin/verify-prepare.ts"
check = "npm run check"
test = "npm test"
```

`npm run check` runs `npm run typecheck`, builds `web/dist`, then runs static/test lint.
The web typecheck keeps the hub strict flags, adds DOM/JSX and browser-only types,
and runs the colour fixtures, text contrast checks and oxlint React hooks rules
(including a rejected conditional-hook fixture). The T0 workspace guard checks
the build order. Root `npm install` builds the bundle through `prepare`; the
post-typecheck build also runs on local verification, where remote prepare is absent.
`web/dist` is ignored. See [the web workspace](../../web/README.md). Prepare installs
dependencies and seeds the pinned Neovim on the builder and before every droplet
delivery; it never runs during local verification. See
[Verification commands](../../hub/README.md#verification-commands) for the shell,
clean-tree and snapshot-key contract.

The T0 skill provenance gate (`hub/test/lint-skill-provenance.ts`) checks the
kept upstream skills' origin/MIT headers, `LICENSE`, stable `metadata.changes: CHANGES`
pointers, nonempty `CHANGES` files and per-skill union merge attributes. For a
skill edit, append a new change/item line in its sibling `CHANGES`, as described
in [skill maintenance](../../skills/README.md). The T1 lint fixture rejects missing
or empty records; `skill-provenance-merge.test.ts` proves native Git merge,
`merge-tree` and one-parent squash preservation after copying the shipped skills.

The T0 dictionary membership guard (`hub/test/lint-dictionary-membership.ts`)
checks every `in` expression in `hub/src` with the TypeScript compiler API.
String-indexed dictionaries (including `Record<string, …>`), `any`, `unknown`,
bare object types and dynamic or undeclared keys require `Object.hasOwn(record, key)`
or `Map.has(key)`. Structural narrowing by a declared finite key is allowed automatically.
A genuine prototype-chain check may carry `// cland-allow-in: <reason>` on the
same or immediately preceding line. The reason is mandatory; strings containing
the marker do not exempt code. Diagnostics name the source file and line.
The guard's in-memory compiler cases run as T0 self-checks, without a test worker.

The T0 child-environment guard (`hub/test/lint-child-environment.ts`) checks
native Node child-process launches throughout `hub/test` (TypeScript and JavaScript,
including helpers, fakes and manual tools). Named, renamed, namespace, default,
dynamic-import, CommonJS and promisified child-process functions are resolved
through the compiler, including call/apply forwarding. Dynamic method lookups
need an explicit exemption. Supply `env: fixtureEnvironment(disposableRoot, base, extras)` or
`env: await accountFixtureEnvironment(extras)` after the final overlay.
Extras contain explicit owned inputs; passing `process.env` or its full spread as
extras is refused because it can restore account paths. The guard checks the
third argument of `fixtureEnvironment` and the first argument of
`accountFixtureEnvironment`, including renamed imports and captured const extras. Fresh runner children use
`runnerFixtureEnvironment(root, inherited)` instead: it filters the inherited base
and retains only `CLAND_SUITE_*`, `CLAND_TEST_*`, `CLAND_LOAD_GATE_*`,
`CLAND_COVERAGE_*`, hub admission FILE/URL/SECRET and session NAME/ID/ROLE
controls. HOME, XDG,
Claude/Codex/fake profiles and executor state still come from the disposable root. A local
const alias is accepted only when used directly as a native launch's `env`;
mutating or escaping it requires an explicit exemption. Environment spreads after
the builder and options spreads after `env` are refused.
The phase and repetition launch boundaries provision its owned directories with
`prepareRunnerFixture(root)` before spawning; environment construction stays pure.
The init machine deliberately removes `CLAND_EXECUTOR_STATE` to exercise the
product default ledger under its scratch XDG state directory.
The pure builders live in `test-support/fixture-environment.ts`; the hub test
entry point re-exports them, and the guard resolves both entry points to those
trusted declarations. Native Claude attach and replacement-process launches use
`accountFixtureEnvironment(fake.env)` so the launch and later account discovery
select the same worker-owned configuration. Re-sealing under the project root
would change that account even when `FAKE_CLAUDE_HOME` is unchanged.
The prepare-script fixture writes legacy snapshot inputs below the sealed HOME,
as production reads them there. The init/setup machine preserves a deliberately
empty provider variable as a disabled-provider input; non-empty provider values
are still removed at launch. Keep these product inputs and their assertions when
changing fixture sealing.

A real line comment `// cland-allow-child-env: <reason>` on the launch's line or
immediately preceding line exempts an intentional seam. Every exemption names
its reason: typed synthetic-provider/native-credential contracts, sealed lifecycle
or setup helpers, or another justified boundary such as an OS-only probe or
read-only repository metadata. No whole-file exemptions apply. Keep owned scratch
paths and synthetic inputs explicit; an exemption does not waive rule 15. Reviewers
check the sealing owner and preserved assertions. `--inventory` lists every
recognized launch with file, line and builder/exemption reason. `--help` describes
this tool. Diagnostics never include source expressions or environment values.
Embedded generated programs are covered at their parent launch boundary; this
is a source guard, not whole-program runtime taint analysis. Its negative and
positive compiler cases run in memory at T0, without workers or subprocesses.

`npm test` enters `hub/test/run-suite.ts auto`. Whole-suite `hub`, `nvim`, `all`,
coverage-selected runs and close-run shards use that same runner, with the
admitted selection in `CLAND_SUITE_SELECTION` (or `CLAND_SUITE_SELECTION_FILE`
for large selections). Package modes choose hub or Neovim; `all` chooses the full
admitted tier set. Coverage chooses files, and shards partition those files;
neither changes the project command contract.

This repository also sets `test_unit`, `test_component`, `test_integration` and
`test_soak` to `node hub/test/run-suite.ts --tier T1` through `--tier T4`.
These explicit tier commands replace the whole `npm test` step in tiered plans,
using the same selection and runner. The table below describes when each runs;
`test = "npm test"` remains the whole-suite entry when no tier plan applies.
These values control the release path and go through review like code.

## Tiers and the merge queue

### Project commands

`[verification]` records POSIX shell command strings, independent of the stack.
`check` is the fast gate. Before creating a droplet, the host runs the recorded
command and logs `Host gate: <command>`; a failure reports
`host check failed (exit <n>); no droplet created`. An unset check logs
`Host gate: check not set` and continues. `prepare` installs dependencies on the remote executor.
Stage, epic and release closes shard only candidates carrying cland's own runner.
Other projects log `sharding skipped: project commands are not sharded` and run
their recorded test once on one machine.
Set available runtime tiers with `cland config set verification.test_unit '<command>'`
and the corresponding `test_component`, `test_integration` and `test_soak` keys.
Empty tier commands are unset. A candidate worktree with a nonempty `test` and
no nonempty tier commands keeps its whole-test execution even under a tiered
hub root. Candidates with no test commands inherit the root's commands.
Commands are pinned at admission, including the
selected tier plan; queued runs keep those commands after a config reload.

| Run | Commands after check |
| --- | --- |
| Task with hosting merge queue enabled | `test_unit`, `test_component` |
| Merge batch | Commands matching `merge.batch_tiers` (default unit/integration; this repo unit only) |
| Periodic `dev-t3` | `test_integration` |
| Integrated dev, explicit all, or task without batch protection | unit, component, integration |
| Stage, epic, release or nightly soak | all four |

Each executed tier reports its exit code, duration and output tail. Projects
without cland file/duration manifests still use the command plan; the configured
`run_timeout` bounds their nightly run without cland-specific repetition estimates. A project
with only `test` set runs that whole command per task and retains the default
`[merge] queue = false`; it has no tier split. Set `merge.queue = true` for batch
landing. `merge.batch` (default 3) caps heads per batch; `merge.batch_wait`
(default `"10m"`) starts a partial batch after the oldest request has waited.
Both settings are writable with `cland config set`.

This repository uses `node hub/test/run-suite.ts --tier T1` through `T4`.
The runner narrows the admitted file selection to that tier, preserving all T1
rules and coverage-selected T2 files.

### Test levels (D53)

Every test belongs to one of four runtime tiers, T1–T4. T0 is the static check before a run. D53 (docs/spec/v0.1.4.md) makes moving tests to the lowest adequate tier the project's top priority. The study is A-4143. `hub/test/tiers.json` declares runtime tiers; manifest lint, source guards and the resource tripwire check their boundaries. Reviewers apply the rules below where enforcement is still report-only.

| Tier | What it holds | What it may use | Budget per test |
| --- | --- | --- | --- |
| T0 static | typecheck, manifest and test lint; deterministic whole-repository source guards | no test process | |
| T1 unit | pure modules, tracker, store, planners, hub rules in-process | a fake clock and in-memory fakes; no sockets, child processes or real time | 0.5 s |
| T2 component | a hub served in the test process (`projectHub`) with real socket edges; the CLI as a subprocess only when the CLI itself is the subject | an in-process fake adapter and a fake clock; no `startDaemon`, `spawnSpoke`, fake harness binaries or Neovim (except the stub-hub client below) | 2 s |
| T3 integration | a curated set of real-process scenarios, plus true process-lifecycle files and one real-binary contract file per harness | anything | 10 s |
| T4 soak | load repetitions, long waits, macOS-only checks | anything | |

`hub/test/durations.json` declares the tier budgets. File budgets sum top-level
test-seconds; wall budgets project whole-file scheduling at the run's workers.

| Tier | Per test | Per file | Projected wall |
| --- | --- | --- | --- |
| T1 | 0.5 s | 10 s | 120 s |
| T2 | 2 s | 30 s | 480 s |
| T3 | 10 s | 120 s | 900 s |
| T4 | none | none | none |

This repository's budget manifest uses report mode until after v0.1.4 (D73);
enforcement returns under E-880. The duration-budget section below describes
allowances, enforcement and the T3 growth ratchet.

Task branches with `tiers.json` and `[merge] queue = true` verify T0–T2: the check step, all T1 files, coverage-selected hub T2 files and diff-selected Neovim T2 files. Coverage fallbacks run all T2 across both packages, clearing inherited Neovim subsets, and never admit T3. Successful coverage keeps diff-selected Neovim T2. T3 runs in batches whose configured tiers include it, in periodic `dev-t3` runs, and at integrated `dev`, stage, epic and release runs; T4 runs nightly and at occasions. The hosting hub must also have its effective merge queue enabled; a candidate-only opt-in keeps prior process coverage until the host provides batch protection. Task reports name whether T3 is in the merge batch or deferred to periodic dev and integrated occasions, with the queue state; that line is deferred evidence, not a passing process receipt. A task's same-head green receipt plus its green batch landing supplies merge evidence. T1 uses the serial hermetic phase, T2–T4 use the machine phase, and Neovim retains its package phase. Candidate packages with only the legacy resource manifest retain their existing file sets.

| Run kind | Plan after T0 |
| --- | --- |
| Queue-enabled task, no mode | All T1, selected T2; fallback is all T2 in both packages |
| Hub-owned merge batch | Configured `batch_tiers` (default T1 and T3; this repository T1); five repetitions of T3 identities absent from the last green batch or stage receipt |
| Ordinary integrated `dev` or explicit `all` | T1–T3 |
| Stage, epic or release occasion | T1–T4; five repetitions of identities absent from the last green stage receipt |
| Periodic dev (`dev-t3`) | T2 and T3, one droplet; no load repetitions |
| Nightly soak | T1–T4; five repetitions of identities absent from the last green soak |

T4 files run only in their selected base soak phase. They never acquire extra
parallel load-gate repetitions: latency assertions under self-generated load
would otherwise measure contention with the base phase. The selection and run
result name this choice as `load gate: T4 repetitions skipped`, with the file
count. Nightly deadline planning excludes those repetitions before budgeting.

Task load repetitions cover new T1/T2 identities against the duration baseline
plus durable 5/5 load proofs from task heads that have landed on dev.
The hub owns batch, dev-t3 and soak occasions. The Coordinator requests stage, epic and
release occasions; QA may request epic for its demo. An explicit `all` on a task
head requires authorization and retains T3. A flaky-gate second task receipt
uses the same mode-free selection. T3 smoke files are filtered out of task plans.

### Periodic dev T2/T3 and release gate

`[merge] batch_tiers` selects a nonempty set of T1–T4 tiers for each batch.
Its default is `["T1", "T3"]`; this repository sets `["T1"]` (D67).
Task verification stays T0–T2. A green batch with T1 only supplies no T3 receipt.
With this repository's T1-only batches, automated T2 coverage after merge runs
only in the periodic dev run, the nightly soak and close occasions (stage, epic
and release). Ordinary integrated `dev` or explicit `all` remains available for
manual checks. This catches interactions between separately verified task heads
that their selected task T2 runs cannot catch before landing.

`[verification] dev_t3_every = "2h"` enables a hub-owned `dev-t3` occasion;
`""` (the default) disables it. The first attempt is due one interval after
activation. Later runs are due after the interval since the last attempt/start,
only when dev's verification candidate tree differs from the last started run's
tree. This uses the shared exclusions in `hub/src/verification-tree.ts`, so
tracker-only commits do not start another run. The cursor survives restart, and a queued,
running or unreported periodic run prevents another. A refused admission is
throttled for one interval. The hub requires clean root dev at freshly fetched
origin/dev and retries unavailable candidates on later clock ticks. It uses one
droplet under the ordinary shared remote budget and daily spend cap, selects T2
and T3 without load repetitions, and never holds or rebuilds a merge batch.
Nightly soak still runs T1–T4 independently.

Each periodic result goes to the Coordinator in General with head, previous green
periodic head, first-parent commits since that green, outcome and failing files.
The `verification-dev-t3-result` message detail exposes `run`, `head`, `tree`,
`previousGreenHead`, `previousGreenRun`, `merges: [{head, subject}]`, `result`,
`failingFiles`, `artifact` and `path` for T-887. Missing baseline or unavailable
Git range is explicit (`null`), including timeout or I/O rejection; it cannot
block publication or the next periodic run. The previous
green is pinned at admission and retained with the durable job.

A red periodic result starts a separate durable culprit search for T2 and T3
failures alike, retaining the `DevT3Result` interface above. Each failing file
reruns at the red head first (an executed pass is a flake), then at the pinned
last green head (a failure is pre-existing), then bisects the intervening landed
commits. Probes run only that file, with no load repetitions or full-suite cache
proof, through the shared droplet budget and queue. Interrupted or missing
execution, unavailable baselines/ranges and preparation failures are inconclusive;
they never assign blame. Search state and probe receipts survive restart. The
hub files one Bugs item per culprit merge, retaining both heads, files, run ids
and artifact paths, and reports in General to the Coordinator and the merge's
last claimant if live. Merges continue while the search runs. Filing errors
report a blocked search to the Coordinator and retry without holding batches.

`cland release`, including `--dry-run`, refuses with `release-t3` unless a
completed, reported green dev-t3, soak, stage or release occasion covers the
pinned release head's verification tree (excluding `.cland/tasks` and
`.cland/RULES.md`, exactly as verification admission does). A different commit
with the same build tree qualifies;
T1-only batches, partial selections, cancelled or incomplete runs do not. The
refusal names the head/tree and the needed `cland verify all --occasion release
--report general` run. Evidence has no age limit. Recovery of an already published
release finishes its original receipt even after dev moves.

### Nightly soak

`[verification] soak = "03:00"` enables a nightly UTC run; `""` disables it
(the default for new projects). The hub attempts at most once per UTC day after
that time, including when it starts late, and persists the attempt across restarts.
It requires clean `dev` at freshly fetched `origin/dev` and skips an unchanged
candidate tree. A soak uses one droplet with Coordinator priority, plans T1–T4
with `CLAND_TEST_SOAK=1`, and load-repeats measured identities absent from the last
green soak. Admission pins the timeout/configuration and a five-repetition identity
list from `durations.json`. Its estimate uses the package phase worker projection for the base run (including
the manifest median for missing files), then charges each repeated identity its
whole file cost (or identity cost, if greater) serially, plus one second per fresh
process. It reserves 20% of `run_timeout` for load variance
and 60 seconds for check/coverage/runner overhead, trimming repetitions to fit.
Unmeasured identities still run in the base phase but do not acquire repetitions;
a missing duration manifest or a base projection beyond that budget refuses admission
with a reason before any machine is created. The plan and omitted counts stay in
the selection/log. The executor reserves shared daily spend before creating the machine;
a cap refusal skips the night with one notice naming `daily_spend_usd`'s cap.
Results go to the Coordinator in General. Green coverage maps feed task selection.
A red soak leaves queued merges intact and does not prevent another batch.

Soak quarantine proposals are General reports, one per failing identity with an
observed last green and no executable-code change since it (unknown Git facts
produce no proposal). A last green requires explicit completed-pass progress;
timing-only, skipped, TODO, cancelled, unfinished, quarantined non-pass and mixed
repetition/descendant outcomes cannot establish it. Finish-only cancellation
is retained; unknown or ambiguous child ancestry withholds greens for that file,
and malformed/unknown outcome receipts supply no green evidence. The shared
`quarantineProposal` builder carries `identity`,
`run`, `tree`, `lastGreen: { run, head, tree, log: { artifact, path } }` and
`log: { artifact, path }` in the `quarantine-proposal` detail. These are proposals
for Coordinator triage; the independent receipts, isolated repetitions, owner
item, reason and expiry required below still govern manifest additions.

### Test placement and review

**When you write or change a test (Implementer):**

- Choose the lowest tier that can prove the behaviour, and state it in the file header or the test's comment. A new file is T1 or T2 unless its header names the process-lifecycle behaviour it proves.
- Wait on an event, a frame or a journal record, never on elapsed time. Timer behaviour uses the fake clock. A test injects one complete Clock for timestamps and scheduling, never a bare `now` callback. A new literal `sleep(n)`, a `setTimeout` used as a wait, or a `Date.now()` difference in an assertion is a finding.
- Prove persistence by reopening the store or tracker in-process, not by stopping and restarting a hub.
- Prove a hub rule once through one real frame per tool or refusal family. Its duplicates call the dispatcher or tracker directly. Don't repeat a hub-side rule through each harness's fake.
- A test proves one behaviour. A title with "and" twice is a finding. Permutations over inputs are a table inside one fixture, not a fixture per cell.
- A new duration allowance carries a non-TODO reason, an open owner item, and UTC `added`/`expires` dates at most seven days apart (31 days for the configured legacy owner under D72); it lands with the test.
- Before review, run typecheck and the touched files one at a time. Put each file's seconds into the review request.

**When you move or split tests:**

- Map each original test title and its assertions to their destinations; account for every assertion.
- Report timing and process starts across every destination file, including retained originals, so a split cannot hide cost.
- Keep each native claim at a named T3 boundary. Declare fixture native resources and verification commands, and cite the hub's tripwire report as tier evidence.
- Keep shared fakes faithful by importing production semantics and round-tripping their output through the real decoder.

**When you review a test (Reviewer):**

- Count `startDaemon(`, `spawnSpoke(`, `cland(` and `sleep(` in each new or changed test. For each one, ask which is the frame proof and why a lower tier can't prove the rest.
- A new file that spawns a process with no lifecycle sentence in its header, or a new wall-clock wait, is a finding of at least medium severity.
- Use the task's same-head verify receipt and the hub's green merge batch as the runtime evidence for a queued landing.

Deterministic whole-repository source guards run through `npm run test:static`, included in the task host gate’s `npm run test:lint`.

The wire import guard (`hub/test/lint-wire-imports.ts`) rejects imports and
re-exports outside `shared/wire/`, including type-only and dynamic imports,
Node built-ins, package imports and ambient type references. Its negative source
fixtures exercise these refusals without starting a test process. Add wire
dependencies only within that directory; restate hub shapes there and add
conformance assertions in the hub's typecheck instead of re-exporting hub types.

### Queued merge batches

On an item's final `ready` event, its supervising Lead or the Coordinator calls
`cland merge T-<n>`. Reviewed heads with paths outside the documentation/tracker
allowlist enqueue; the CLI returns `queued <n>`, their current FIFO position.
Allowlisted-only changes still use the immediate gate with their required
verdicts. The allowlist is the human-override scope in the merge skill; skills
and role configuration are outside it. `cland merge queue [--json]` lists pinned
heads, requesters and the current batch. `cland merge T-<n> --cancel` removes a
request through the same role/subtree permission check as merge. Cancellation
waits for any active worker to finish before the candidate checkout is replaced.
A changed or deleted head, a closed item or a not-clear verdict drops its entry.

With `[merge] queue = true`, reviewed code heads wait in a durable FIFO. The hub
starts the oldest `batch` entries (default 3) when full, or after `batch_wait`
(default `"10m"`) from the oldest request. It prepares squash objects in order,
checks immutable merged-tree lint and duration budgets, and verifies a detached
candidate with the hub-owned `batch` occasion. That run selects
`[merge] batch_tiers` (default T1 and T3), with five load repetitions only for T3
identities absent from the last green batch or stage receipt. It uses the configured executor and Coordinator
priority, occupying one suite slot.

On green, each member lands through the existing merge receipt, checkout,
territory publication and cleanup path. Dev movement reuses green candidate
evidence when the immutable candidate diff stays within `refusedOverridePaths`'s
documentation/tracker allowlist, the same policy that selects immediate merges.
Other changed paths rebuild and rerun, with a notice naming the forcing commit.
The reused receipt retains its original head and tree. Conflicts or
landing gate refusals drop their member with a reason and rebuild the rest.
Queue and batch state survive reopening the hub store. `cland merge queue` and
`cland verify queue` show the current batch and its members. Results and logs go
to Agents and each member's requester and item lead. A
red batch of one refuses its member with `merge-bisected`, naming the failed
tests. Larger red batches rerun only the failing files on each leave-one-out
tree, pinned to the original integration base. A unique green removal refuses
that member and lets the others land on the green tree. Otherwise those files
rerun once on the original batch tree: completed passing receipts for every
original failure let it land, while red or incomplete proof refuses every
member with `merge-bisect-unresolved` and sends the Coordinator one evidence
notice. File jobs retain their run, tree, log, seconds and provider cost, use the
same queue, and supply no full-suite cache proof.
Aborted, timed-out, unavailable or otherwise inconclusive original runs or file
jobs hold the batch with their retained receipts and one Coordinator notice. They establish
neither a red alternative nor an unresolved red repeat; recovery is an explicit
Coordinator decision. `merge-bisected` goes to the rejected item's lead for a fix,
fresh review and task verification. `merge-bisect-unresolved` goes to the
Coordinator for diagnosis before re-enqueueing. A `merge-conflict` goes to the
item lead to integrate dev in its worktree, then repeat review and verification.
Measured `duration budget` failures naming a test identity or test file use the
same file-rerun policy, even when all assertions passed. Refusals and diagnostic
reports retain the budget line with its observed seconds and threshold.
For `merge-budget`, the item lead reduces the named tier growth or records a
valid allowance under the budget rules before retrying. The supervising Lead or
Coordinator submits the repaired item through the gate again. The merge skill
has the command and refusal workflow.

Executed passing identities on a green batch-tree rerun record a flake
observation with both failure and green receipts. Two different batches produce
one quarantine question to the Coordinator carrying those receipts. The
Coordinator still needs five isolated greens, an owner item, a non-TODO reason
and an expiry within seven days before editing `quarantine.json`; the hub never
edits it. The merge queue remains opt-in for other projects; this repository enables it together with the T0–T2 task protocol.

### Named T3 scenarios

The eleven scenarios below prove process seams once the rules are covered in T1/T2. Each is one manifest entry with tier T3 and a unique scenario name, one whole-file scheduling unit, at most 120 seconds of manifest test time, and at most one live hub. Headers name the flow, lower-tier rule coverage and the expected hub process starts. Other T3 lifecycle regressions and the three harness contracts remain separate. The target cadence is T3 in configured merge batches, periodic dev runs, and at stage, epic and release; task admission excludes these T3 scenarios, which run in periodic dev and integrated occasions, plus batches configured for T3.

| Scenario | File | Seam proved |
| --- | --- | --- |
| hub-lifecycle | [hub/test/scenarios/hub-lifecycle.test.ts](../../hub/test/scenarios/hub-lifecycle.test.ts) | Start, discovery, graceful stop, explicit restart and startup orphan sweep |
| startup-smoke | [hub/test/scenarios/startup-smoke.test.ts](../../hub/test/scenarios/startup-smoke.test.ts) | Detached CLI startup serves status and tracker, then stops and reaps its PID |
| crew-launch | [hub/test/scenarios/crew-launch.test.ts](../../hub/test/scenarios/crew-launch.test.ts) | Coordinator launches Claude Code, Codex and OpenCode; native role clauses and correlated replies cross each bridge |
| ticket-flow | [hub/test/scenarios/ticket-flow.test.ts](../../hub/test/scenarios/ticket-flow.test.ts) | Claim, criteria, review, real verify/cache evidence and verdict-gated merge |
| stage-close | [hub/test/scenarios/stage-close.test.ts](../../hub/test/scenarios/stage-close.test.ts) | Three review-only merges, stage QA retry, persisted stage evidence and separate epic demo |
| release | [hub/test/scenarios/release.test.ts](../../hub/test/scenarios/release.test.ts) | Atomic push to a bare GitHub remote and sync/replay into the local territory |
| droplet-verify | [hub/test/scenarios/droplet-verify.test.ts](../../hub/test/scenarios/droplet-verify.test.ts) | HTTP fake provider with real process machines: acquire, deliver, execute, collect, release and watchdog reaping |
| hook-bridge | [hub/test/scenarios/hook-bridge.test.ts](../../hub/test/scenarios/hook-bridge.test.ts) | A native mod bridge reconnects across hub replacement and expires while its parent stays alive |
| workbench | [nvim/test/scenarios/workbench.test.ts](../../nvim/test/scenarios/workbench.test.ts) | Real Neovim attaches, sends and receives, answers an ask, opens an artifact, explorer, graph and plan approval |
| message-tracer | [hub/test/scenarios/message-tracer.test.ts](../../hub/test/scenarios/message-tracer.test.ts) | Real spokes carry message metadata and a correlated reply through the hub |
| setup | [hub/test/scenarios/setup.test.ts](../../hub/test/scenarios/setup.test.ts) | CLI prompts, fake installation/login, account decline, trust, one hub/Aide, launcher and idempotent terminal/nonterminal reruns |

Add a scenario only for a new flow across processes whose rules are already covered in T1/T2. Reuse existing steps and assertion meanings; add a header with those rule files and expected hub starts, a unique scenario manifest entry, measured duration and reasoned dated allowances. Record a declaration-to-step assertion audit and a spawn census; an extra hub start needs a lifecycle reason in the header. Run the entire file five times serially on the Mac at one-minute load below 15. For Linux proof, cite a droplet merge-batch or integrated-occasion receipt that actually executes the scenario file, naming its tested head/tree and log artifact. Input and refusal permutations stay in the lower tiers.

HUB_SMOKE selects hub-lifecycle, startup-smoke and message-tracer. NVIM_SMOKE selects workbench (attach and the main views) and `nvim/test/startup-budget.test.ts` (the thousand-item startup budget).

### Neovim workbench startup budget (T-1010)

Correctness regressions bound counted operations, allocations or bytes; keep instrumentation inside a measured callback bounded too. Machine-speed ratios belong in deliberately unloaded benchmarks. Preserve the existing budget guards rather than raising them to accommodate a change (A-8634 R5; T-963, T-1007, T-1010, T-1003, T-983, T-1037, T-1038, T-1045).

`nvim/test/startup-budget.test.ts` is T3: real headless Neovim consumes the
production socket protocol from `projectHub`; there are zero hub or harness
subprocesses. T1 tracker-summary and T2 shell-component cover projection and
settling rules. It belongs to `NVIM_SMOKE`, including reduced hub-only and
coverage-selected hub runs; web-only diffs retain this smoke baseline too.
Queue-enabled task verification still defers all T3 to the configured process
occasions; smoke membership does not override that tier filter.

The fixture generates 1,000 Markdown items in a disposable project: 200 open,
800 closed (200 releases, 200 epics and 400 tasks), a release/epic/task tree,
roughly 1.7 KB bodies, two criteria and an
implementation comment per item. No generated tracker is committed. Hub,
Neovim and spoke fixtures use scratch HOME/XDG/Git/account state with credentials
filtered from launch environments. The Coordinator and Implementer spokes run
in-process and are pinned so both session rows remain visible. Before connecting,
the test places Sessions left of the explorer; no GUI or harness starts.

The hard limits are **3,000 ms**, **131,072 bytes (128 KiB)** for the first item reply, **262,144 bytes (256 KiB)** per startup reply and **1,048,576 bytes (1 MiB)** across the eight startup reads. A transparent
socket relay counts UTF-8 bytes of the *first task.list response*, including the
JSON result envelope and trailing newline. It also checks that exactly one
open-summary request with `include_containers:true` returns precisely the open
items and their ancestor chain (including closed ancestors of open work), and that Neovim
installs them all. `hub/test/startup-budget.test.ts` exercises these shared probe
assertions at T1, including missing ancestors, fully closed subtrees, extra and duplicate wire or installed rows.
The generated fixture and copied-live manual probe also assert a 120 KiB first-item
margin while retaining the hard 128 KiB budget policy.
The startup clock runs from delivery of the authenticated
hub welcome to observation of the explorer item row, Coordinator header,
header session count and both session rows in their physical screen columns.
All downstream frames wait behind the welcome until the screen observer is
armed, preserving order. Process/RPC/hub/fixture setup has separate bounds;
the completed render has a ten-second observation bound, followed by the
three-second assertion. These are elapsed startup measurements, not fake time
or a pending-callback/title-only receipt, and the hard limits are not load-scaled.

Measured on local macOS arm64 at the T-1010 working tree based on `5453c280`
(Neovim 0.12.5, 160×45 headless screen): the generated baseline rendered in
27.4 ms with 67,588 bytes. A copy of the live tracker (1,020 items, 106 open)
rendered in 48.2 ms with 42,344 bytes. These are warm, quiet scratch-hub
connection-to-render measurements, excluding fixture/hub/process setup and
production crew/indexer load. The three-second limit preserves E-1006's
acceptance target with substantial measured headroom; 128 KiB is about 1.9×
the generated baseline and 3.1× the copied tracker payload.

Two negative fixtures feed the same measurement and budget checker as the normal
case: withholding task.list for 3,100 ms must complete rendering then fail the
time check, with bytes still in budget; adding the generated real bodies to its
rows must fail the byte check, with startup still in budget. Initial local values
were 3,118.4 ms / 67,588 bytes and 27.8 ms / 415,880 bytes respectively.
The negative tests assert the named budget failure, rather than counting an
unrelated setup timeout as proof.

For a fresh local C4 receipt run (headless, macOS only):

```sh
node nvim/test/startup-budget-probe.ts /absolute/project/.cland/tasks
```

The probe reads each matching item once and writes that text into its scratch
tracker before creating a hub. It copies no live database, discovery, config,
conflict captures, run state or accounts, and never starts against the source
tracker. Its output reports total/open counts, connection-to-render milliseconds
and first response bytes. Post the original output with head/tree, platform and
executor attribution; a local receipt supplies no Linux, full-suite or loaded
production-workbench claim.

### Test lint reports

`npm run check` runs typecheck, then `npm run test:lint` once. This repository
names it as `[verification] check` and names `npm test` as `test`. Verification
resolves each nonempty command from the candidate's `.cland/config.toml`, then
falls back to the hub root's value. Without `test`, submission refuses before
queueing; an empty `check` is skipped. Resolved `prepare`, `check` and `test` are
recorded at submission and survive config changes and restarts. A matching host
gate reuses the whole check on the droplet, including lint, so it is not repeated.
Local runs never execute `prepare`. All request modes run the same configured
`test` line; cland's runner receives its phases through `CLAND_SUITE_SELECTION`.

By default, test lint prints a short census with counts by finding kind,
reachable-resource counts by kind (diagnostic only), and the refusal count.
Every refusal still prints its full file, line, rule and message and fails the
check. Use `npm run test:lint -- --details` for per-file tiers, the first twelve
census findings and every reachable-resource path. `--details` also combines
with `--shrink`. The summary names this opt-in command.

The direct-source census remains a report of existing debt. The policy gate
refuses growth, before verify reserves a queue slot or merge changes refs:
`verify-test-lint` and `merge-test-lint` name the file, line and rule.
Dry runs perform the same admission and return the same refusal lines.
A test absent from the base `tiers.json` must obey its T1/T2 resource rules;
a new T3 file needs `// T3: <process behaviour>` in its first comment block.
A valid contract or scenario manifest entry supplies that lifecycle declaration.

`hub/test/lint-baseline.json` freezes counts by file and category:
`wall-clock-wait`, `wall-clock-assertion`, `startDaemon`, `spawnSpoke`,
`fakeClaude`, `fakeCodex` and `fakeOpenCode`. Missing categories mean zero.
No count may exceed its frozen allowance. Process-helper growth is permitted
only with a T3 lifecycle header or contract/scenario entry; wall-clock growth
still needs a trailing reasoned `// lint-allow-wall-clock: <reason>`.
The baseline itself may only shrink, including in lifecycle files; it cannot
be removed to disable enforcement. After removing debt, run
`npm run test:lint -- --shrink` and commit the reduced baseline. The tool
takes the minimum of the current count and existing allowance, so it cannot
bless new debt. Files and categories can independently be lowered to zero.
While the first freeze awaits publication on dev, lint validates it against its
original sources and retains that reference across dev merges. Once dev carries
a baseline, that baseline supplies the branch's reference.

The log, result and admitted `cland verify --dry-run` retain
`test lint (report only): <n> findings in <m> files`. Suite check logs now record
the compact CLI census above; their former per-file tiers, first twelve census
findings and full reachable paths require the opt-in command. Dry-run reporting
is unchanged: it retains the first twelve census findings and each file's lowest
qualifying resource tier. Delivered results put counts, tier and tier-share summaries,
lint summary and budget lines first; one detail count line points to the log
artifact instead of repeating per-file tiers or individual lint findings.
Dry-run puts the same summaries before its detail. Those census lines describe
existing debt; policy refusals are separate, stay named in full and fail the check.
Budget summaries count missing baselines instead of copying per-file diagnostics;
the run log retains every diagnostic. Oversized fresh and cached result messages
keep their priority summaries and log id before optional execution/selection detail
when those summaries fit the configured cap.
It inspects the entire tier manifest, independently of the selected test phases.
Import and call syntax distinguish the in-process fake harness and FakeClock
from process helpers and real timers; comments and planted source strings do not
count as resource use. The existing T1 hermetic admission still refuses real
machine resources.

Rules report disallowed tier imports/process helpers, numeric wall-clock waits,
elapsed-clock assertions (including local timestamp/delta variables), and T3
files without a lifecycle sentence in their first comment block. Contract and
scenario manifest entries are exempt from the header rule. A wall-clock finding
may be suppressed by a trailing `// lint-allow-wall-clock: <reason>` on the call's
line. A blank reason does not suppress it. This is syntax analysis, not a proof
of runtime reachability. A separate **reachable** diagnostic follows repository-local literal runtime
imports transitively (including helpers, fixtures and re-exports). Named imports
follow the exported declaration and its local value dependencies; unused helper
exports do not contribute resources. Module-level execution is always included.
Namespace, dynamic/require and `export *` imports may charge the whole module and
name that fallback in their diagnostics. The analysis does not evaluate branches,
injected arguments or method overrides; selected class declarations include their
members. Allowed seams and wait reasons do not suppress reachable resources.
It caches module analysis, export slices and resolution for one lint run; cycles
retain all resources. Declaration-only type imports/exports, external packages
and data imports are not followed. Resource diagnostics name the import chain and
location. `test:lint -- --details` lists every resource path; diagnostic dry runs summarize
resource kinds and show one highest-tier path per file to fit the protocol frame.
They never change the direct-source `qualifies` value or policy findings used by
admission and the tier lint gate. The qualifying tier never automatically retags
a file. The legacy hermetic manifest admission checks each test's own source only.

The default dry-run keeps all refusal-relevant checks but omits the report-only
reachability graph. Use `cland verify --dry-run --diagnostics` (or MCP `verify`
with `dryRun: true, diagnostics: true`) to include it, with a separate 120-second
request deadline. The default admission deadline remains 15 seconds. Direct
facts are cached by path, source digest and tier entry, bounded to 1024 compact
records without compiler ASTs. After startup and each observed dev-tip move,
the hub warms dev's facts in the background, yielding between files; admission
still reads current disk sources and judges each baseline independently.

Neovim files that use only `nvim/test/stub-hub.ts` may use the documented
`startClient` headless Neovim launch at T2. This exception covers that client
boundary only, not real hubs, sessions, arbitrary children or native process
probes. Stub-client teardown uses the owned child handle and observes its
process group's exit before directory removal; a restarted server retains
identity-based cleanup and belongs at T3.

### Neovim recorded frames

Panel placement is covered by `nvim/test/panel-placement-component.test.ts` at T2, using the palette, `:Cland panel <kind> left|right`, `gm`, native closes, buffer keys and committed stub frames. It also covers toggles after moving, chip and `gp` openers, scoped palette actions, action audits and Normal/Terminal focus with an in-memory terminal (no harness process). `qa.state().panels` retains `left` as a visibility boolean, `right` as a kind and `dock` as a visibility boolean; its additive `kinds.left` and `kinds.right` fields identify either side's visible panel. Use these fields for side-neutral QA. `qa/cases/PANELS-017.lua` reads the swapped headers and a live session-row change from their physical grid columns. `qa/cases/PANELS-018.lua` moves Items right and Inbox left with `gm` and reads both headers and rows from their physical grid columns. The local targeted T3 `ui.test.ts` and `shell.test.ts` runs cover native resize/close ordering and cold starts; T1-only merge batches supply no T3 evidence.

The same T2 panel file covers optional version-2 homes/occupants, legacy preference files, invalid-assignment fallback without losing other preferences, restart snapshot/restore, home-aware presets and both reset entry points. Reset clears side widths, keeps dock height and open panels, and leaves colliding occupants in place while restoring their homes. `PANELS-019` saves swapped panels, reloads UI state in-process and rebuilds, then asserts headers and rows in their physical grid columns. Targeted local `ui.test.ts` covers a real cold restart with swapped panels; `shell.test.ts` keeps the swap through real `:restart` and terminal reattachment. Run these headless with scratch HOME/XDG/Git state and the shared credential filter. T-1002 adds per-side manual width/move/view/preset/reload checks and Topics dock geometry, uniqueness and retained height to the T2 panel file. The T2 explorer component checks each of the four right occupants is covered on narrowing and restored on widening or leaving the explorer, keeping homes unchanged. `PANELS-020` repeats the shipped manual-size walk with Items right and Sessions left; `PANELS-005` and `PANELS-006` remain unchanged. The cold-start swapped-panel case also asserts saved and restored side widths.

Workbench settling tests count outbound frames after completed startup and reconnect snapshots, advance
a client-local fake deadline clock ten minutes, and retain the final no-list-read assertion. Delayed-read
cases release the oldest original answer after its retry deadline and observe installed state, then verify
only the missing read retried with backoff. Waiting for a replacement request alone cannot prove recovery:
a late original reply must still complete startup. Rendered header and explorer-row assertions cover
independent session answers and local task-event updates. These use the T2 recorded stub, without crew
load or real-time latency claims.

T2 client tests use `nvim/test/stub-client.ts` and `nvim/test/fixture.ts` for
scratch projects, condition waits and client ownership. Native/T3 callers keep
`nvim/test/harness.ts`. The hub's `tier-nvim.ts` compatibility export and the
Neovim client share one exact synchronous launch marker.

Both Neovim fixture entry points (`tempProject` and `createClient`) await the
neutral `test-support/admission.ts` guard before allocating directories or
starting the client. Its read-only discovery, transport and clock primitives
live under `shared/`; hub compatibility exports preserve their identities and
the typed `AdmissionTimeout`. Cached Neovim admission returns a fresh async
promise for each caller, preserving node:test resource attribution. Changes to
these shared paths keep full package selection, and the T2 import guard follows
them transitively.

`nvim/test/stub-hub.ts` replays committed JSON recordings for config, criteria,
visibility counts and frame projections. It retains scripted actions and frame
barriers, with no runtime hub import. A missing recording fails with the refresh
command. The T1 boundary guard reads every current T2 import closure, including
the stub; the workbench T3 recorder checks the catalog against hub-owned
producers and real `projectHub` attach snapshots. Ordinary T2 tests never load
those producers. The human QA CLI keeps its arbitrary/read-only scenario API
through the explicit T3 `qa-stub-hub.ts` adapter; it is outside T2 client imports.

Run `npm run test:nvim-fixtures` to capture existing stub consumers serially and
rewrite the live attach baseline. Full discovery follows runtime imports and stub
launch URLs through helpers, including non-T2 consumers. Test tiers alone do not
select recording files. Type-only dependencies and the shared client launcher
(`nvim/test/client.ts`, which only validates the stub command) do not make a
native real-hub test a recording consumer; `artifact-browser.test.ts` is excluded.
The named local-only checks `explorer-summary.test.ts` and
`hub-read-component.test.ts` are also excluded: they launch the stub client but
assert local Lua summary/decoder results without awaiting a stub frame. Incidental
startup traffic is not recording coverage. Other selected consumers still fail
if they record zero frames.
This maintenance command requires one-minute load below 15. A trailing test file refreshes that file while retaining the
catalog; `--from-recordings` regenerates existing inputs and the live baseline
without replaying client assertions. Use the full command after adding scenarios.
Capture runs must finish successfully with at least one test and no skips. The
recorder validates every requested file before replacing any fixture: each file
must record at least its existing slice's frame count (and at least one frame),
and the replacement catalog must contain at least as many frames as the current
catalog. An unavailable Neovim binary, incomplete run or reduced capture refuses
the refresh and names the affected file, leaving the fixtures unchanged. A
deliberate reduction of recorded scenarios requires updating the expected fixture
counts through a reviewed fixture change.
For an expensive consumer, `npm run test:nvim-fixtures -- --slice <test-file>`
also commits a per-file catalog under `nvim/test/fixtures/protocol-frames/`.
The parent test selects that slice for its stub processes; consumers without a
slice use the full catalog. A slice miss lazily loads the main committed catalog
once, so another recorded request ordering can still replay; a frame absent
from both catalogs is refused. Refreshing a
consumer updates its existing slice, and `--from-recordings` regenerates slices
from their recorded keys. The workbench recorder checks every slice against the
full catalog as well as checking that catalog against the hub producers.
Review the generated JSON with the assertions that consume it. The catalog
interns repeated JSON nodes, binds transient machine paths, UUIDs and timestamps,
and retains the seven-day visibility age class and original wire values.

`node hub/test/nvim-selection-replay.ts [dev-ref]` reports the latest 40 task
landings against the current importer graph, failing an incomplete window or any
T2 selection decided by a runtime hub import.

### Runtime tier resource report

The suite runner preloads a resource tripwire in each manifest-declared T1/T2
worker before loading its test file. It runs in ordinary package phases, explicit
manifest test targets and load-gate repetitions. T3/T4 workers retain their native
APIs. T1 reports child-process starts and socket listen/connect
entry points (including HTTP, HTTPS, TLS and fetch through the shared net boundary); T2 reports child-process starts. The documented `cland` and
`clandWithEnv` helpers exempt only their synchronous CLI launch in T2. Calling the
same CLI directly is still a mismatch. The `clandCliLaunch` boundary also admits
exactly two shipped CLI subjects: `/bin/sh .agents/skills/qa/qa-record.sh …` and
`node --import hub/test/v01-migration-cli-preload.ts hub/bin/migrate-v01-release.ts …`.
Commands and entry paths are resolved against the worker cwd; the migration
preload is mandatory. This closed set grants only the synchronous `execFile`
launch, with no permission for altered entries, other process APIs or async
descendants. Incidental executable discovery uses filesystem PATH facts.
In Neovim T2 workers, `startClient` also
exempts only its synchronous `spawn` with the exact headless client arguments.
A direct lookalike, altered arguments, a different process API or async work
outside that launch still trips; native Git/ps probes and fake harness binaries
are not exempt.

Each `tier-mismatch {…}` line carries file, full test name, declared tier,
resource, mode and the first stack for that test/resource pair. It never includes
call arguments, environment values or command lines. `CLAND_TEST_TIER_MODE` is
the single rollout setting: `report-only` by default, `enforce` when D53 goes
hard. Report-only delegates to the real API without changing the test result;
enforce reports and throws at the call. Its receipt remains a hard run failure
after assertion quarantine, even if the error is caught or the worker exit code
is reset. Each load repetition checks its own receipt before excusing assertions.

Names use Node's public [`getTestContext()`](https://nodejs.org/docs/latest-v24.x/api/test.html#gettestcontext) when available. On Node before 24.19,
the tripwire stays active with file-only attribution and one missing-API warning
per instrumented worker. Import-time calls and file cleanup have an explicit
file-level label. Node 24.21 attributes global hooks to their owning scope (for
example `<root>` for file-level `beforeEach`), while test bodies use their full
nested names. No global async hook or per-test instrumentation is added.

### In-process harnesses

Hub rules use `projectHub(t, root, env, { clock })` by default,
with a `FakeClock`. It replaces Claude Code, Codex and OpenCode under their real
harness names, so `roles.toml` launch choices still work. The returned `fakes`
map exposes each adapter. `probes: 'fake'` supplies no-repository Git answers and
an in-process lock identity, so startup and teardown spawn no infrastructure
processes either. A test needing branch/provenance facts may override `git` and
`readBase`; a lock test may override `processes` (`alive` and `started`).
`projectHub` defaults to fake harnesses and probes; explicitly supplied adapters,
Git, base-reader, territory and process facts take precedence. T3 contracts and lifecycle
files opt into production defaults by importing `nativeProjectHub` (which passes
`harnesses: 'native', probes: 'native'`). Either option can also be selected
independently. Receipt-only suite fixtures may inject `compatibility` holder/occupied
observations and a process table for lease identity reads. `serveProject` retains
its production Git, lock and ps defaults. Import `NO_PS` only from
`hub/test/native-process.ts` in native tests; importing the generic harness never
probes the OS. For a lower-level fixture, use
`fakeHarness(flavour, { host, clock })` from `hub/test/fakes/harness.ts`.
Capabilities and first-clause semantics come from the production adapters.

The test drives `busy(name)`, `idle(name)`, `turn(name, { afterMs, usage, model })`,
`exit(name, code)` and `crash(name)`. No process or automatic turn starts.
`spawns` records full launch requests (including clause, brief, cwd and policy).
`scriptInject(name, ...outcomes)` queues `accept`, `reject`, `uncertain` or `hold`;
`{ outcome, afterMs }` schedules an outcome on the injected clock. A held inject
settles through `settle(name, messageId, outcome)` or the adapter's `confirm`.
Use `feedUsage`, `model` and `scriptResume(name, 'found' | 'gone')` for reports and
recovery. Inspect `injections`, `stops` and `resumes` for adapter receipts.
The fake supplies the harness adapter only: connect the session's protocol peer
in-process or over a test socket and acknowledge delivered frames as usual.

For a role-bearing MCP caller, use `inProcessSpoke(t, { discover: true, cwd: root,
name: 'impl', role: 'implementer', sessionId: 'impl-id' })` after `projectHub`.
It accepts the same options and returns the same `Session` API as `spawnSpoke`:
tool calls, channel events, presence waits and logs. The real spoke handlers run
over an in-memory MCP transport; their `HubClient` uses the real WebSocket edge.
Each spoke closes automatically before the hub's teardown and checks its owned
resources. `close()` is idempotent and can be called early to test offline routing.
Its `pid` is 0 because there is no child: use `spawnSpoke` in T3 for process signals
or a real stdio binary contract.

The spoke's `artifact.create` reply budget is 120 s; `artifact.list` retains the
ordinary 10 s. This is separate from the outer harness/MCP deadline, which may
expire earlier; a caller using the full creation budget must allow more than
120 s, plus up to 20 s of readiness and transport overhead. Neither timeout
cancels the hub's copy. After a timeout, inspect the destination topic with
`artifact.list` before retrying to avoid a duplicate publication. See
[Spoke readiness and deadlines](../../hub/README.md#spoke-readiness-and-deadlines).
`spoke-artifact-budget.test.ts` tests these reply boundaries with `FakeClock`
and a slow fake hub. Its setup, result receipts and teardown have separate
failure bounds. After a late result, it waits for an acknowledgement of the
next frame on that ordered WebSocket before asserting no duplicate request;
advancing virtual time alone is not evidence that real socket I/O completed.

The fake harness **binaries** in `hub/test/fakes/{claude-code,codex,opencode}`
are reserved for one real-binary adapter contract file per harness and T3
scenarios. They are not the default for routing, roles, subscriptions or tracker
rules. Existing files migrate under E-677; new tests use the in-process adapter.

`fakeClaude` owns every fake CLI invocation, including adapter polls, through a
home-local process-identity registry. After resource and hub shutdown it closes
writer admission, reaps session groups (including hooks and spokes), and allows
in-flight CLIs to exit. After 5 seconds a stuck-writer error names the remaining
PID/start identities and retains the home, without killing the polls or starting
removal. Release or stop those writers before retrying cleanup. Only observed OS
exit permits removal; a delayed `execFile` callback is awaited separately.
Removal retries ENOTEMPTY/EBUSY for 1 second and reports remaining paths
if exhausted. A stale fixture environment cannot recreate a closed home.
`fake-claude-cleanup.test.ts` proves the held-poll late write, delayed callback,
home retention at the injected-clock drain deadline, orphan hook cleanup,
closed-home admission and bounded remaining-file diagnostic at the T3 process
lifecycle seam. The same writer drain applies during signal recovery.

### Human kinds and queued withdrawal

`topics-component.test.ts` exercises `topic.send` kinds through public frames, history and a second client's message deltas; only a Question starts a wait, and a later Message cannot change its addressee. `topic-withdraw.test.ts` uses sealed `projectHub` fixtures with fake time and a raw fake spoke. Observe accepted delivery before withdrawing across a busy transition, then send a late acknowledgement and require the next retained message's injected receipt. Keep assertions that the withdrawn input was never injected and its held progress was delivered once. Adapter submission is a durable exclusion fence, even without confirmation; test refusal at that boundary and after injection. `hub/src/hub/store.test.ts` reopens the Store in-process to prove withdrawal and its cleared Question wait persist without replay. `web-authority.test.ts` keeps the authenticated human edge proof. Neovim's recorded `thread.test.ts` checks the terminal glyph/colour and rejects older delivery stages; refresh only its recording when adding frame inputs. No browser or live hub is needed for this hub-side slice.

The sender-specific native admission paths stay covered in `opencode-adapter.test.ts`
(T3 HTTP/SSE contract) and `codex-native.test.ts` (T2 scripted RPC): a human
message sent in state `busy` waits, an agent report steers the running turn,
and the human input starts a new native turn after completion. Hold the native
turn explicitly, observe the agent's injected receipt before asserting the
human input has not reached the adapter, then release and require the human's
injected receipt. OpenCode's fake `/test/turn` endpoint holds execution without
changing the busy state. Existing human steering during `waiting for approval`
is a different state and remains covered by the Codex contract/reconciliation tests.

Exact delivery observers in `store.test.ts`, `topics-component.test.ts` and the
stdio `topics.test.ts` retain their full objects including optional eligibility:
the direct core admits an accepted delivery, while a bare spoke refuses recall.
Native Codex/OpenCode/Claude contract receipts retain acceptance, submission and
confirmation events, including the repeated delivered stage and eligibility
true/false/false. Non-human brief deliveries retain their original stage sequence.
`human-routing.test.ts` waits for the aggregate-queued eligibility receipt before
advancing TTL, rejects any premature stage advancement, and retains expired-input
non-delivery and delivered/dropped final receipts.

### Waiting for an observable condition

Use `until(predicate, { what })` from `hub/test/harness.ts` for a condition
without an event API. It yields to I/O between observations and owns one deadline,
including asynchronous predicate time. The failure names `what`; the final
assertion still states the behaviour proved. `timeoutMs` defaults to the harness
wait budget (15 seconds, or `CLAND_TEST_WAIT_MS`). The deadline is multiplied by
`CLAND_TEST_LOAD_FACTOR`; absent an override, the executor default is 2 on a
droplet and 1 locally. Invalid factors fall back to 1. Tests of the helper inject
one complete `Clock` and a `loadFactor`, without waiting for real time.

The heartbeat reconnect regression in `hub/test/hygiene.test.ts` is the worked
example. Its hand-written loop slept 25 ms after each probe. It now waits for
the observable fresh hello, then keeps both identity assertions:

```ts
await until(async () => {
  after = await connectedAt('alpha');
  return after !== undefined && after !== before;
}, { what: 'a fresh alpha hello after heartbeat reconnect' });
assert.ok(after !== undefined && after !== before);
assert.equal(await connectedAt('beta'), betaBefore);
```

For live journal file observations, `hub.status { flushLogs: true }` drains the
accepted prefix; later producers can already be appending when the reply arrives.
Use `completeJournalLines` from `hub/test/journal-lines.ts` before parsing: it
defers only the unterminated tail and still fails on malformed complete JSON.
Wait with `eventually` for the exact record ids/events being asserted, keeping the
final assertions. `subscription-frame.test.ts` and `subscriptions.test.ts` wait
for both `event-delivery` and `injected` for their message id; the T1 regression
in `journal-flush.test.ts` exercises every cut of a following record.

Prefer a frame, journal receipt or fake clock when one exists. A negative assertion
needs a positive completion boundary or fake time; an already-true predicate does
not prove that nothing happens later. Existing intentional expiry waits remain
part of the baseline until migrated.

Rule 9's boundary depends on the assertion. Worked examples:

- **Neovim rows:** after navigation or resize, use `waitScreen` for the anchored
  item row and the fields the assertion reads, then keep the exact row, order or
  highlight assertion. A connected client or updated panel title can precede the
  content render; see the row wait in `nvim/test/vboard.test.ts`'s `select` helper.
- **Worker PID:** after `f.launch()`, use `await f.workerPid(job.id)` to read the
  matching live job record and register ownership for cleanup. The launch reply
  can still have a null PID. Before fault injection, also observe the relevant
  package-start log or filesystem marker; keep the crash/recovery assertions
  (`hub/test/suite.test.ts` and `hub/test/suite-recovery.test.ts`).
- **Tracker frames:** subscribe before the mutation, then wait for a `task` frame
  matching both the item id and the expected transition, such as released holds
  and `status === 'review'`. Assert the resulting claim/status as before; request
  acceptance or an attempt timestamp does not prove the continuation published
  its result (`hub/test/tracker-ready.test.ts`).
- **Demo setup:** successful `demo.start` calls use `startDemo` from
  `hub/test/demo-start.ts`. It arms a lease observer before sending and waits
  for a new matching lease with `state: active`, `execution.delivered` and
  `demo.ready`, excluding leases from earlier starts. Setup has the remote
  fixture's load-scaled 30-second bound; the correlated result has a separate
  load-scaled five-second bound after that durable receipt. Keep the caller's
  result and behaviour assertions. Refusal tests use the ordinary request seam
  because a refused start must never produce a ready lease. Set
  `CLAND_TEST_DEMO_START_TIMINGS=1` for observed lease/provision/delivery/ready/reply
  times and persisted preparation/provider timings. Observation times are
  sampled upper bounds; scripted lease timestamps use the fake clock.

### Real-binary adapter contract checklist

Each harness has one T3 manifest entry `{ "tier": "T3", "contract": "<harness>" }`.
Its header maps each of these steps to the test that proves it once through the
fake binary and the real spoke, hooks/mod or native protocol:

- Launch and the harness's attach command.
- Role clause in the first native turn.
- Delivery through the adapter bridge to `injected`, with the reply correlated to its input.
- Harness signals reaching session state, including approval and failure where supported.
- Model and usage reports, matching the advertised capabilities.
- Stop; resume across a hub-process restart; native-conversation relaunch.

Input permutations use a table at the environment/planning seam, with one binary
frame proof. Hub-owned brief ordering, artifact envelopes and Lead claims belong
in `hub/test/adapter-composition.test.ts`, shared across all three flavours.
Contract files retain assertions about the native first-turn/transport boundary;
they do not repeat the shared hub rule. Negative assertions wait for a positive
completion receipt or use fake time. Record a declaration-by-declaration assertion
map, before/after file seconds and process-start call sites in the review evidence.

## Fixtures

Cleanup requires positive ownership receipts: a child-owning helper settles after its process and pipes close, including deadline and spawn-error paths. Close writer admission before draining a process-backed fixture, and register each invocation before its first write; regressions cover both present and missing ownership evidence. Missing evidence does not authorize orphan cleanup; see rule 12 for directory removal (A-8634 R7; T-552, T-972, T-974, T-1035).

Tests consuming generated assets, build outputs or copied projects declare and check their own prerequisites on every shard, with fixture-owned output directories for present and missing cases. Resolve paths and lists from shipped scripts and workspace metadata. Put static wording/size contracts at T1 and only delivery at the live boundary; runner prerequisites name the consuming worker (A-8634 R11; T-955, T-978, T-1019, T-1023, T-1031; A-9063 R8 source T-1096).

Rule 15: shared fixtures use the pure `test-support/fixture-environment.ts`
(`hub/test/fixture-environment.ts` remains a compatibility export) to replace
inherited HOME, XDG, account roots and Git configuration with worker-owned scratch
paths. Every inherited `GIT_*` override is removed, including `GIT_DIR`,
`GIT_COMMON_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, object directories, templates
and inline/system config. Filtering runs again after extras. An inherited
`GIT_DIR` plus an implicit `git init --bare` can rewrite a parent repository's
shared config even when cwd and HOME are scratch-owned. A linked worktree of the
live project is not a disposable repository for these probes.
Git system/config injection and inherited identities are removed.
The builder supplies `Fixture Test <fixture@example.test>` as both author and
committer so commits, rebases and releases never depend on host identity detection.
Tests may override these defaults with explicit synthetic Git identities in extras.
Ambient SSH-agent, askpass, npm/yarn configuration and other credential-file
handles are removed from both parent input and extras too.
`accountFixtureEnvironment(extra)` admits the worker and applies that builder;
use its complete result for child launches, with no later environment overlays.
Explicit profile/fake paths and Git identities must be scratch-owned. Provider
and account credentials are filtered after extras, including the shared
`withoutExecutorCredentials` filter. HOME and Git configuration cannot be
overridden. The T0 child-environment guard above enforces the builder boundary
for native launches, with reasoned inline exemptions for reviewed seams.
The sealed init/setup machine seam preserves its owned HOME and deliberately
unset profile inputs through `machineEnvironment`; re-rooting it at the project
would change the product's default-account and trust-file contract. Its native
self-tests may deliberately supply synthetic poison inputs, with an adjacent
exemption. The scratch-machine constructor filters inherited credentials first. The init
machine clears worker-default Git identities so its absent/configured Git identity
contracts use only its disposable HOME configuration.

Account product contracts may supply `projectHub`'s typed `scratchAccountPaths`
dependency for HOME fallback and a conflicting OpenCode database. Both paths
must be absolute and contained in that fixture's disposable project. Ordinary
HOME/OPENCODE_DB extras stay sealed; these explicit inputs preserve default,
exclusion and restart assertions without exposing a machine account.
Native Git contracts may supply `projectHub`'s typed `scratchGitConfig` with an
`excludesFile` inside the disposable project. `scratchGitEnvironment` admits only
that named `core.excludesFile` setting through `GIT_CONFIG_COUNT/KEY_0/VALUE_0`;
arbitrary Git config extras remain filtered. The remote fixture's `gitExcludes`
option writes that file inside its own project and reapplies the typed setting
after sealing the hub environment. Provider fixtures must pass their typed
`syntheticProvider` dependency again on daemon restart; env extras alone do not
preserve its sentinel token.

Bare-root merge admission uses the hub's injected read-only Git probe in component
fixtures; the production boundary runs native Git. `project-probes.test.ts` proves
the injected bare fact still refuses while imports, merge preflight and cleanup
retain the zero-child census.

The pure T1 poisoned-parent/overlay test is `fixture-environment.test.ts`.
The native T3 bare-init/clone proof in `territory-cli.test.ts` compares the scratch
parent's config bytes after each operation, including clone from a linked cwd.
`init-machine.ts` and `init-fixture.ts` also use the shared builder; child extras
must never be spread onto an already sealed result. The scratch machine removes
the builder's `CLAND_EXECUTOR_STATE` default so its own scratch HOME/XDG ledger
and legacy migration paths remain the product defaults under test.
`claude-code-accounts.test.ts` deliberately injects three synthetic auth variables
at the native adapter seam to prove default-account inheritance and named-account
exclusion. Such credential-handling tests never inject into shared fixture defaults
or use real credentials. Diagnostics print variable names or counts, never values.
Fake DigitalOcean transport records in `machine-calls.jsonl` keep sorted environment
variable names only. The shared writer has a T1 durable-file regression proving
that a synthetic credential value and other environment values never reach the log.

Provider contracts use the separate typed `syntheticProvider` fixture dependency
(`projectHub`/`startDaemon`) or `clandWithProvider` for the provider CLI. It accepts
only `cland-test-…` sentinel tokens, paired with an explicit HTTP loopback endpoint
with a port, or the exact fake API injected through `droplet.api` for an embedded
hub. Arbitrary env extras cannot enable this exception. `synthetic-provider.ts`
validates the dependency before adding its sentinel to a sealed environment;
its pure rejection proof lives in `fixture-environment.test.ts`.
Migrated seams are the remote fixture and its restart callers, executor lifecycle,
executor liveness, native/component preparation (including reopen paths), and
suite dry-run contracts.
The manual `inbox-load.ts` probe uses the same pure builder under its disposable
project; run it only on a quiet machine through the project's load policy.

Use `projectHub(t, root, env?)` from `hub/test/harness.ts` for project tests by
default. Each test serves its own project through `serveProject` in the test
process, with normal discovery, Unix socket and WebSocket edges. Real CLI
subprocesses, discovering spokes and fake harnesses keep their production
protocols. Pass environment overrides to the fixture; never temporarily mutate
`process.env` for one hub. Teardown stops the served hub, disposes the fixture's
owned processes, then fails on surviving owned handles, timers or process
listeners, with `process.getActiveResourcesInfo()` diagnostics.

Web-edge component tests use `projectHub` discovery (`webPort`), HTTP requests
and `hub.status.web` frames. `hub/test/web-edge.test.ts` is T2: its restarts
exercise listener port persistence without starting a daemon process. Bundle
fixtures live inside the disposable project, selected through `[web] dist`;
missing-bundle cases use a missing fixture directory/index, so building the real
`web/dist` cannot change their expected result. An occupied web port leaves the
spoke and Unix-socket edges available; inspect the `web-unavailable` log and
`cland doctor` warning rather than expecting a hub startup failure. Set
`[web] port` or `[web] dist` before startup; both require a restart to apply.
The T2 `hub-status-component.test.ts` checks available and unavailable web details
in the CLI's hub block, before `sessions: N`. The T3 hub-lifecycle scenario keeps
the discovery `webPort` contract and checks that session rows follow that heading
directly. The compiler contract fixture in `typecheck.test.ts` includes each root
typecheck project, including `shared/wire/tsconfig.json` and a browser-safe source.

Events subscription tests use the same frame seam: `events.test.ts` covers a
warning filter's first page and live rows beside an unfiltered client;
`connection-snapshot.test.ts` changes kind/subject filters without reconnecting,
checks inherited pagination and snapshot fallback, and verifies contiguous live
and replay cursors via row-free `model.advance` deltas. An omitted filter resets
the subscription; an explicit `events.list` filter overrides only that read.

Approval record changes use `hub/test/approval-records.test.ts`: sealed `projectHub`, real frame clients and the in-process fake's `raiseApproval`/`closeApproval`. Observe the `approval` delta before advancing the fake clock for its coalesced inbox publication. The same file covers snapshots, per-request counts, UTF-8 subject limits, archive persistence and the CLI. For the human-only `approval.answer` gate, script the fake's `scriptApproval('accept'|'fail'|'hold')`, observe `answering` before `settleApproval`, and assert the adapter answer plus the closed delta/archive. Cover competing clients, unoffered/TUI choices, all agent roles (Aides included), failure-to-pending with a journal warning, native note delivery or item-topic/General fallback (including byte-cap refusal before any native answer), and no answer after 24 virtual hours. For that long suspension, `FakeClock.block` followed by `advance(0)` runs overdue callbacks once; missed interval ticks do not replay. `clock.test.ts` checks that wakeup behaviour. The authenticated-cookie gate case is in `web-authority.test.ts`. `nvim/test/inbox-actions.test.ts` checks Enter's `session.attach` request on a recorded Claude Code row, with attachment refused at the stub edge to avoid a T2 shell; T3 terminal transport remains in the existing session scenarios. The same recorded-frame/headless file covers Neovim approval keys in the panel and full-width inbox: once, always/unoffered choices, denial notes, TUI-only refusals, live answering/pending/closed deltas and a refused race resolved from the archived outcome. Observe the exact outbound `approval.answer` and the rendered fold; a selected fold survives the confirming inbox departure until the human leaves the inbox. Keep the fold while moving between rows, retire it on leave/reopen, and hold a race lookup across newer approval/inbox pushes to prove it consumes only the winner without replacing current rows or counts. The scripted stub reply carries recorded gate results, without duplicating gate rules. Refresh its slice and the inbox recordings through the Neovim recording workflow above.

The Codex relay uses `hub/test/codex-native.test.ts` at T2 with the scripted app-server double: native response ids and decisions, matching file-item readback, malformed-field TUI fallback, external resolution on two frame clients, note fallback and reconnect replay. File approval params name a turn/item; paths and diffs come from that item's `thread/read {includeTurns: true}` result. Keep arbitrary tool input out of the record. `hub/test/codex-adapter.test.ts` is the T3 fake-binary contract: the same request id reaches existing and late subscribers, Approve once produces the command's filesystem receipt, and Deny completes the turn without that receipt or a command-run log. The fake's `approve` file and SIGUSR1 resolve through the same decision path as another client. Run this contract file explicitly when changing its relay; task verification's T0–T2 selection does not supply this process evidence.

Codex file-read races stay at that same native frame seam: hold `thread/read` after reconnect and refuse answers until validation completes, including failed/malformed reads. Resolve an initial file request while its read is held and require a closed-first delta on both clients plus its exact archive outcome, with no pending resurrection, even if the native connection drops before readback settles. Keep unresolved stale reads suppressed and request-start time no later than the outcome. The optional internal `ApprovalRequest.outcome` and `since` provide atomic publication with the observed chronology; the internal host admission receipt keeps early closed outcomes until watch can replay them, and known terminal process rows admit only closed-first history. Cover the real `session.stop` frame while a resolved file lookup is held and native first-turn events before process publication; pending records stay running-only. Other adapters keep their existing path. Test complete authorization subjects at the exact 64 KiB serialized UTF-8 boundary and a distinct operation beyond it: oversized subjects are TUI-only, their clipped text informational, and their native answers refused. Failure paths retain the same public-field allowlist.

The OpenCode relay uses `hub/test/opencode-native.test.ts` and its scripted HTTP/SSE transport: assert human `approval.answer` frames against native `decision`/`message` receipts, child endpoint routing, external reply outcomes on two clients, reconnect identity and disappearance, and TUI-only shape fallback with a warn-level log. Hold the command lookup to prove an early native reply still closes the exact request without changing a later waiting episode. Plant private metadata in failed native HTTP replies and assert safe status/category, pending/no-outcome and a later native close. Check complete commands at the serialized 64 KiB UTF-8 boundary and oversized ASCII/multibyte commands staying TUI-only with no endpoint call. Private permission metadata must never enter frames. The existing `hub/test/opencode-adapter.test.ts` permission scenario adds the T3 binary proof: Deny with a note must appear in the fake's durable `permission-reply` log as `reject` with that message; keep this targeted contract receipt separate from mode-free task verification's T0–T2/Web coverage.

Approval races use those same T2 scripted native/frame seams: hold Codex's response write, resolve externally before its receipt and assert a refused Deny plus one harness outcome on both clients and in the archive. Its own resolution echo follows completed delivery; a synchronous pre-receipt echo is indistinguishable from an external winner. Hold OpenCode's HTTP response and report an attached-client reply before its 404, including reject against reject, to prove attribution is not inferred from equal choices.

`hub/test/approval-restart.test.ts` is T3 because it restarts actual scratch hub processes while all three fake harnesses stay alive. It checks native replay/snapshot and Claude's state-only waiting episode against the original ids and subjects, answers the replayed Codex request and observes the command's filesystem receipt, then answers Codex and OpenCode through their fake TUI paths while the hub is down. A further restart must close those missing requests as `answered in the harness` and retain the previous human outcome in the archive. Keep the fake `approve` file and attached-client HTTP reply receipts, the hub PID-reaped boundary, and observed harness teardown. Hold Codex's native resume and prove disk-restored rows precede the `approval-rebuilt` native-validation journal receipt; release recovery, wait for that exact request's receipt, then send the single answer. The OpenCode T2 restart regression preserves a pre-existing child's pending id/subject and native child reply endpoint without replaying `session.created`. Its authorization regression also holds a replayed command lookup, requires `approval.answer` to refuse with no native endpoint call, releases a malformed lookup and checks the same id/since as TUI-only with empty choices, then reconnects with a changed valid command and checks refreshed public authorization before one native reply. The fake-adapter frame case also refreshes native authorization during an answering attempt and requires the latest TUI fields to survive its failure reset without another adapter call. This file requires explicit T3 evidence beyond mode-free task verification; its reasoned duration allowance covers native startup/restarts, without time-based assertions.

Hub scheduling tests pass one complete clock at the fixture boundary:
`projectHub(t, root, env, { clock: new FakeClock() })` (`hub/test/fake-clock.ts`).
`await clock.advance(ms)` runs due hub timers in deadline order and yields to
real I/O between callbacks; then await the expected frame or journal record.
The clock covers timestamps and hub schedules together, including heartbeat,
inbox notifications, archive/usage windows and retention. Use the same clock
for every time-dependent collaborator in a fixture. Bare `now` overrides are
refused; inject a complete Clock instead. A real-process fixture that needs
progressing native schedules may explicitly supply an offset real clock.

Give that shared clock one advancing driver. Before advancing, observe the timer
wait under test and native I/O receipts from every participant sharing the clock.
`FakeClock.advance` is not a completion barrier; repeated advances must not stand
in for those receipts.

Do not mock global timers in a `projectHub` scheduling test: sockets, journal
flush and I/O retries, native transport/reconnect and kill deadlines, AccountPoller child-process deadlines and suite
execution keep real time. AccountPoller eligibility and Claude directory schedules
use the hub Clock. Verification-wait metrics alone use hub time.

Keep `startDaemon` only when an assertion concerns the hub process: startup,
shutdown, signals, crash/restart, lock/discovery/PID identity, orphan sweeping,
watchdog behavior, or CLI behavior with the hub down or unreachable. Session
stop, resume and native harness crashes alone do not require a spawned hub.
New tests using `startDaemon` must name the process lifecycle behavior they
prove. Do not share one project hub across unrelated tests. Validation duplicates
may call the existing dispatcher or tracker directly while retaining one real
frame proof per tool/refusal family; adapter parsing edges use a fake native
transport while launch/inject/turn/stop/resume retain frame coverage.

Package runners set a 120-second default per-test timeout (`[verification].test_timeout`).
The local verification worker stops a command after ten minutes without stdout
or stderr (`[verification].stall_timeout`), reports the last started tests, and
reaps the verified process tree before releasing its leases. Both settings accept
positive durations such as `"120s"` and `"10m"`; explicit test-level timeouts
override Node's default. Droplet runs also have their enforced total `run_timeout`.
Droplet verification uses the same admitted `stall_timeout` (default `10m`). The
hub watches new stdout/stderr bytes in the mirrored suite log; status replies
and failed log reads do not renew it. Collection normally polls every 10 seconds and checks
earlier when the silence deadline falls between polls. With a responsive
transport, detection is bounded by `stall_timeout` plus that 10-second progress
interval. The hub checkpoints observed output before appending mirror bytes;
replaying bytes after restart retains that original silence boundary. It reports a
`timeout` with in-flight file/test receipts, cancels the run and releases its
droplet through the ordinary confirmed-release path. Cleanup/accounting can take
additional time after detection. Each shard has its own silence bound.
A deadline interruption reports `timeout: N tests completed, M failed` before
in-flight diagnostics, preserving completed pass/fail/skip counts. An unfinished
test is labelled `in flight`; `hung` requires an observed native `testTimeoutFailure` receipt for that
identity, proving its own effective timeout expired (including explicit overrides).
Elapsed time beyond the run-wide default alone and unknown per-test budgets never
establish a hang.
When an inherited-pipe writer cannot be verified, the result explicitly says
cleanup is incomplete, Agents and the inbox receive one warning, and the queue
is released. Unknown processes are preserved; exact fast-writer ownership is
the follow-up T-410.

Implementers run verification through the hub, one invocation at a time per session:

```sh
cland verify --report <item-topic> --to <reviewer-name> --to <your-name>
```

D29: submit task runs with no mode. The diff and coverage selector chooses T2 files under the queue-enabled T0–T2 protocol above. A flaky-gate second receipt uses that same selection. The hub verifies T3 in configured merge batches and periodic dev runs; the Coordinator requests integrated occasions at stage and epic close and before release. `all` is reserved to the Coordinator, the human and authorized occasions.

Task runs may report `hub-selected`: changed hub tests and tests covering the
changed functions, filtered to T2 after selection. All T1 files still run.
A changed hub source imported by Neovim selects the Neovim T2 files reaching it
directly or through `nvim/test` helpers. Declaration-level `import type` and
`export type` do not create runtime dependencies. Inline type specifiers retain
module execution under Node type stripping, so those imports and re-exports
still count. A coverage fallback selects all T2 in both packages, including for
harness or process-cleanup changes. The report names the deciding functions,
selected Neovim tests and coverage artifact. T3 smoke remains in integrated and
legacy package plans.

Clean integrated `dev` full runs record per-test-file V8 coverage, including the
CLI, lifecycle daemons, spokes and fake harness descendants, and publish a
function-range map with their head and canonical candidate tree. Close-run shard
maps merge into one artifact. Task runs never refresh the map.

Admission reads the newest artifact whose head is an ancestor of the task's merge
base. `[verification].coverage_max_age` is a positive duration, default `"2d"`.
This is a reporting threshold: an older ancestor map still selects when every
hunk maps through the intervening diff, with its age and the limit in the report.
Missing, invalid, future-dated or unrelated maps keep the package rules and name
the reason. Protocol/contract, package, harness, fixture, runner and executor changes,
unsupported paths, unknown source files, missing covering tests and hunks changed
since the map also keep those rules. A top-level insertion or edit, or a hunk in
an untested function of a mapped `hub/src` file, instead selects all tests covering
any function of that file, plus `HUB_SMOKE`; the report names this widening. A
file with no covering tests still falls back.
Unchanged lines are translated from the merge base back to the map across the
intervening diff. Integrated full runs remain the regression backstop; a selected
run can miss a regression which the next batch detects.

Coverage artifacts remain the source of truth; `.cland/run/coverage-maps/` holds
rebuildable pointers shared by linked task worktrees. Cache reuse for
`hub-selected` also requires the same selected tests and Neovim phase, including
its explicit importer subset.
`node hub/test/selection-replay.ts <first-parent-range> --coverage` prints the last
40 task landings, the selecting count, missing-map fallbacks, deciding functions and each selected share
of hub test-time. `--nearest` explicitly labels retrospective maps that may postdate
the merge; live admission always requires an ancestor and mappable hunks. Supply
`--failures <json>` to include historical failed test paths keyed by full/short
merge SHA. The replay also reads retained suite logs by item and names their count; old logs
without source identities remain unavailable rather than guessed.
An optional positional selector git ref loads both its package and coverage selectors
for before/after comparisons on the same range and maps.
`--count N` changes the replay window (default 40); an incomplete window exits 2.
Exit 1 reports own or historical misses for inspection; the agreed own-test bar
and historical miss causes are reported separately.
Shares use the current duration manifest, rather than claiming historical wall
times. The replay bar is zero misses on those merges' own changed/added tests;
every wider miss must be listed with its cause.

Close runs on integrated `dev` use `cland verify all --occasion stage|epic|release --report <topic>`. The Coordinator sets any occasion; QA may set `epic` for the epic demo. The hub requires the clean project-root `dev` head to match freshly fetched `origin/dev` and refuses other roles or task heads. The MCP `verify` request accepts the same `occasion` field. An ordinary Coordinator integrated `cland verify all` on the same clean root `dev` head may shard too, with no occasion or stage provenance. The hub-owned merge batch and nightly soak each use one slot. Task heads and non-Coordinator requests without an authorized occasion use one slot. A local executor still uses one local slot.

Every `after-stage` stage, even with `qa.scope: none`, needs green integrated full-suite receipts at one verification tree from a Linux droplet `--occasion stage` run and a macOS local run. Non-none scopes additionally need a clear stage QA verdict on that tree. Per-item stage gates are unchanged. `task plan show` and stage-run results name missing platforms and the expected tree. Submit the missing run separately: the usual stage request for Linux and `cland verify all --occasion stage --executor local --report <topic>` on the Mac. Stage-request cache reuse preserves executor/platform; Linux stage evidence must come from a stage run (sharded, or the documented one-slot fallback). A completed stage retains its tested tree across later descendant builds while its plan and landing evidence remain valid.

After a restart, stage tree and ancestry checks run in the background. `task plan show`
labels unresolved platform evidence `pending`, separately from a genuinely missing
cover. JSON stage covers expose optional `pending` platform names beside `missing`;
unresolved stage QA verdicts omit `current`. Pending evidence cannot close a stage
or advance its next stage. The restart proof is in `stage-qa.test.ts`; tree and
landing checks have lower-tier coverage in `stage-closure-component.test.ts`.

A remote close run or ordinary Coordinator integrated full run uses the free remote slots up to `[verification] shards` (default 2), balances hub files largest-first by `hub/test/durations.json` (unknown files use its median), and places Neovim on the lightest hub shard. Each droplet preserves the free/machine resource classes. Before creating any droplet, the hub atomically reserves every shard's lifetime cost in the shared spend ledger against the project's daily cap ($3 here). Fewer than two free slots or an insufficient cap gives one whole run on one slot and one warn notice, `sharding skipped: fewer than 2 remote slots free` or `sharding skipped: daily spend cap $3 would be exceeded`. Other executor unavailability follows the configured local fallback.

One result sums counts, labels failures by shard, and includes each machine, size, duration and cost, total cost, and wall time from admission through final collection. Each `shard duration` spans admission through the durable remote finish, for successful and failed receipts alike; live polling and restored receipts use the same boundary. A separate `shard collection` line spans remote finish through final log/coverage collection and machine release (or the bounded accounting wait). Missing timestamps are labelled `unavailable`. Collection completion is persisted independently, so reporting retries do not extend it. The merged `suite duration` remains the overall wall from parent admission through collection of every shard. Recovery downtime never extends a finished run’s `runMs` or the queue estimates based on it. Each shard has a log artifact beside the merged log. A failed or lost shard fails the run without an automatic retry; cleanup must be confirmed before its slot is released. At $0.25/hour per c-8, two ten-minute droplet lifetimes estimate $0.0833 total (provisioning and cleanup count too); read the measured cost in the result. Cache reuse requires identical tree, mode and soak coverage, so an ordinary T1–T3 integrated run cannot satisfy a T1–T4 occasion; stage requests additionally match executor/platform and require stage provenance for Linux cache hits.

Before the first source review, fetch and merge `origin/dev` into the task branch, then commit and push the head to review. After that review, take dev changes only through shared fixes posted by the Coordinator; merge dev again only on its request or after a merge-conflict refusal. Request source review first. Only after a clear source verdict, run `cland verify` at the exact reviewed head. A fix or later merge that changes the head needs a new source review before a new run. The Reviewer settles the final verdict when the same-head result arrives; source-only criteria may be verified earlier, while run-dependent criteria stay unverified until then. The CLI prints the run id, worker PID (null while queued) and hub queue position, then exits. Go idle: the hub delivers one result with the exit code, test counts, failures, branch/head and durable log artifact.

If the CLI writes a submission but receives no reply within 15 seconds, it exits
75 with ``submission sent; no reply within 15 s; check `cland verify queue` before resubmitting``.
This is an unconfirmed submission, not a failed run. Check the queue first. The
hub persists an idempotency key for the session, worktree, head and requested
mode: retrying while that run is queued or running returns the same run id and prints
`already queued/running: <id>; no new run` (`reused: true` in JSON).
After a terminal run, ordinary cache and `--fresh` rules apply, so a red run can
receive another receipt. Dry-run and pre-write timeouts retain their ordinary
failure outcome because they did not submit a run.

`cland verify` uses the project's `[verification] executor` (`local` by default).
`--executor local|droplet` overrides it for one run; use `--executor local` on a
macOS host for a macOS-only question or when the human asks. The result's executor
line follows its branch/head, for example:

```text
Executor local · <os> <arch> · Node <version> · Neovim <pin>
Executor droplet · c-8 lon1 · <machine> · linux x64 <release> · Node <version> · Neovim <pin> · lifetime 1398 s · cost $0.0971
```

The worker measures Node on its PATH and the candidate's Neovim pin (`none` for
fixtures without a pin); cache hits retain the original executor and platform.
A green same-head Linux result supplies gate suite evidence. It lists macOS-only
cases as `suite skip` records; they run in the release's final local suite
("Release v0.1.2 from the item"). A full suite costs about $0.10 on c-8 at $0.25/hour;
c-16 is $0.50/hour, twice the hourly price, with cost depending on elapsed lifetime.
These are estimates; see [executor costs and configuration](../../hub/README.md#remote-executors-droplets).

When droplets are unavailable (missing token, refused create, no prepared snapshot,
unavailable size, daily cap or dirty candidate), the hub posts a warning:
`verify <id>: droplet unavailable (<cause>); running locally`. The requested run
still happens, through the local queue; wait for its result rather than resubmitting
or handling a droplet yourself. This fallback applies when the executor flag is omitted and
`[verification].local_fallback` is `true` (the default). This project sets it to
`false`: default droplet requests wait for remote capacity and never run locally.
Other acquisition failures are reported without local execution. An explicit
`--executor local` still uses the local slot, and human `npm test` is unchanged.
An explicit `--executor droplet` never falls back: it waits for remote capacity,
refuses submission if the daily spend cap cannot cover its reservation (naming
the cap), and reports other remote acquisition failures without running locally.
Acquisition rechecks and reserves spend atomically, so a cap reached after
submission fails that run rather than moving it to the local queue.
Only the hub creates, lists and deletes droplets; `cland executor status|prepare|reap`
belongs to the human and Coordinator.

The worker survives the caller's shell exiting. The hub keeps its run record across restart; a killed worker produces a result naming the signal while the hub is live, or a missing-exit-receipt crash report after restart. A permission change can hold reporting: `cland hub status --history --json` exposes pending runs and their reporting error; restoring permission lets the hub retry without duplicating a committed result. A recipient hygiene refusal holds the whole result until every intended recipient is admissible, so a partially muted recipient cannot lose its report.

Omitting the mode selects phases from the branch diff against freshly fetched `origin/dev`, including working changes. Linked worktrees share one in-flight dev fetch per canonical Git common directory, bounded to five seconds; each admission diffs against its captured commit. A failed fetch may use the last known `origin/dev` only if it has a merge base with the candidate, with an explicit warning. That ref does not count as fresh-fetch proof for an integrated occasion. Without a usable base, selection falls back to full. Fallback warnings retain sanitized Git stderr and appear in the first result lines, including capped and cached reports. `all` or `--all` forces full only for the Coordinator, the human shell or an authorized `--occasion` request. Other sessions receive `verify-all-reserved` with the automatic diff selection and no queue entry. A flaky-gate second receipt is another ordinary diff-selected verify, with no mode. Integrated `dev`, shared or ambiguous changes, empty diffs and fetch failures without a usable base run full. A package-local diff runs that package plus the cross-package smoke baseline; `hub` and `nvim` reduce only matching qualifying diffs. The duration line and report include the mode, reason and deciding files. See [phase rules and smoke baselines](../../hub/README.md#tests). Each run first executes `npm run check` (typecheck and test lint) when the candidate declares it and `test:lint`, otherwise `npm run typecheck`, then the package test script from the calling worktree. For queue-enabled tiered task branches the task tier cap applies after package selection: all T1, selected T2 and no T3/T4, including process smoke baselines. `--report` names the result topic; repeat `--to` to name recipients. With a session name in `--report`, the hub uses the caller's claimed item topic and addresses that session. Reporting uses the caller's stable session identity and current artifact/send permissions; an Implementer needs its own item topic or a topic with a delivered request.

The hub persists the request, exact head, item, diff selection, enqueue time and priority in its database before acknowledging it. Admission gives the Coordinator's integrated dev requests first priority, then human `npm test` waiters in enqueue order, then the item rank captured at submission, then other requests in enqueue order. The local slot admits one run; `[verification].remote_budget` admits parallel
droplet runs beside it (a positive integer, 4 by default; this project's D27 build value is 2). The scheduler walks the
ordered queue past waiters whose slot is busy. Remote acquisition reserves a slot
through confirmed release and each acquire checks the shared daily spend cap.
When remote slots are full and the local slot is free, a default droplet request with
`local_fallback = true` falls back
locally with a warn notice naming `remote budget <n>/<n> full` and a
`verification-executor-fallback` record with cause `remote budget full`.
A request that already recorded a `remote budget full` local fallback, but has
not been admitted locally, reclaims a freed remote slot in its original queue
order, including across hub restart. Its topic and recipients receive
`verify <id>: remote capacity available; moving queued local fallback to droplet`,
and the journal records `verification-executor-reclaimed`. Other acquisition
failures stay local, and explicit `--executor local` requests stay local.
An explicit droplet request, or a default droplet request with `local_fallback = false`,
remains a remote waiter, including when preparation
or unconfirmed cleanup holds the remote budget; later local requests can proceed.
The hub persists a finished remote run's outcome and collected log before cleanup.
Its final result waits up to 120 seconds on the hub Clock for confirmed lease
lifetime and cost. If release stays unconfirmed, the result marks accounting
"pending confirmation"; the executor retains its remote reservation and retries
lease recovery every minute, independently of the ten-minute orphan sweep. This
lets a late provider deletion confirm within the six-minute recovery bound. Once
the durable lease confirms release, the hub posts one
accounting correction in the same topic. Restart resumes from the saved outcome
without polling the deleted machine and retains the wait window/correction state.
Sharded parents also report despite a broken spend ledger once all shards have
reported. The executor retains durable group-release requests and retries them
during reconciliation, including after restart and for shards with no lease.
The T2 cases in `hub/test/suite-close-component.test.ts` corrupt only the scratch
ledger, observe the parent receipt and freed scheduler slots, then repair the
fixture and prove both lease settlement and pre-lease reservation recovery.
`--executor local` and human hand runs use the local slot behind compatibility leases. The queue and its order survive restart; a known dead requester's queued run becomes one hub cancellation note to its original recipients. A disconnected spoke alone is not evidence of death.

`cland verify queue [--json]` prints `local: <holder or none>`, then one
`remote <active>/<budget>: <session> · <item> · droplet <name> <size> <region> ·
since <t> · ETA <d>` line per remote run, then ordered waiters with their requested
executor, elapsed wait and admission ETA. Remote-only waiters are labelled
`waiting for remote` with their queue position; their ETA uses remote capacity only.
JSON identifies them with `waitingFor: "remote"`. Acquiring machines are labelled
`acquiring` until their lease is available. JSON keeps `holder` as the local
holder and adds `remote`, `remoteBudget`, `localFallback` and each waiter's `executor`.
The text queue also prints `local fallback: true|false`. The sessions panel follows hub queue events live.
`hub status --history --json` includes historical per-run wait/run timings; compact status retains queue metrics and median/p90 over the last
20 completions. Cache hits record zero timing; executed-run estimates use recent
successful durations for the effective mode and executor. Remote durations
include acquire time; remote holders do not delay local waiter estimates. Unknown history gives a null ETA.

A green run may be reused for the identical committed candidate tree and effective
mode. The candidate excludes only `.cland/tasks` and `.cland/RULES.md`, so tracker-only
and rulebook-only dev merges hit; other paths and dirty working changes do not.
`--fresh` forces execution, and `[verification].cache_max_age_minutes` defaults to
1440 (0 disables reuse). Hits
name the requested head, original run/head, original occasion/executor and tree
hash and post once as usual. Release requests reuse only matching full coverage
on the effective executor and OS (Linux droplets or the local host OS), even
when configured rather than explicit. Compatible Linux droplet stage/release
receipts qualify; macOS stage receipts cannot satisfy a droplet release request,
and missing platform evidence cannot supply a release cache hit.
An explicit `--executor droplet` reuses only a green that ran on a droplet. A
local-only green triggers a fresh remote run, with the reason in the result
header and log. Outside stage and release occasions, omitting the executor flag preserves cross-executor reuse even
with a droplet default; `--executor local` also keeps cross-executor reuse.
Cache hits retain their original executor and platform.
The Reviewer still verifies criteria at the requested exact head using that
result; a cached result never revives an old criterion mark automatically.

`[verification].budget` in `.cland/config.toml` defaults to 1. Values above 1 log `verification-budget-capped` and use 1. T-215 keeps this conservative budget after classifying only five files as hermetic; process-heavy overlap remains disabled. `cland suite` remains an alias, including cancellation.

The compatibility shim retains `/tmp/cland-suite.lock` and `/tmp/cland-suite-nvim.lock` for hand-run `npm test` and pre-V1 branches. A holder or earlier live legacy ticket blocks local admission; droplets use their own machine's locks. The local worker atomically takes both leases before typecheck to cover a racing hand run. A V1 package runner borrows that verified lease and publishes its per-run recovery record in `<lock>.runs/<token>.json` through every shard; a pre-V1 package runner takes its own legacy lease after protected typecheck. A queued head change cancels the request; successful results keep the submitted exact head. The merge gate's rules are unchanged.

The underlying package scripts remain available for humans and isolated CI:


- `npm test`: automatic phase selection; `npm test -- --all` forces full.
- `npm test --workspace hub` and `npm run test:nvim`: request the matching reduced mode, widening to full when the diff does not qualify.

`hub/test/tiers.json` declares every `hub/src/**/*.test.ts`, `hub/test/**/*.test.ts`, `nvim/test/**/*.test.ts` and `web/test/**/*.test.ts` file in one path-sorted `tests` map, with `version: 1`. Add a new path at its sorted position in that map in the same commit as the test. Choose T1 (unit), T2 (component), T3 (integration), T4 (soak) or Web (browser) using the levels above. An entry is a tier string, or a T3 descriptor with exactly one nonempty `contract` or `scenario` string, for example `{ "tier": "T3", "contract": "codex" }`. Fixture/tool writers use `serializeTierManifest` from `hub/src/suite-shards.ts` to keep path order.

Run `npm run test:tiers`; `test:shards` remains an alias for one release. The lint rejects unclassified files, entries for missing files, invalid tier strings/objects and unsorted maps (naming the first out-of-order path). T1 still rejects process/port/timer APIs, process-fixture helpers, real-time waits, lock paths or Neovim in the source. In projects carrying the manifest, `cland verify` checks both the working files and immutable submitted head before queueing (`verify-tiers`), and `cland merge` checks the merged candidate before changing refs or the root checkout (`merge-tiers`). The old wire codes `verify-shards` and `merge-shards` remain accepted aliases. An in-flight candidate with only `hub/test/shards.json` still verifies: `free` reads as T1 and `machine` as T3, with its original hub-only classification coverage and no sorted-map requirement. When both manifests exist, `tiers.json` wins.

`cland verify --dry-run` (MCP `verify` with `dryRun: true`) runs the same
selection and manifest admission without submitting a job, taking a lease,
creating a droplet or reserving spend. `--report` is optional for a preview.
It prints the mode, reason, deciding files, planned tiers and tier projections;
`--json` returns the structured selection, tier plan and report lines. Executor,
worker and size overrides apply to the preview too.

Run logs and results show each planned tier's file count, observed top-level
test count and test-seconds, and projected wall from the duration baseline at
the run's workers. T1's serial phase stays at one worker. Projection uses the
close planner's longest-processing-time placement, summed across sequential
package phases. Missing duration baselines are named and use the known-file
median for projection; their missing seconds do not enter the manifest share.
Dry runs show baseline test counts as planned and observations as unavailable.
Wall budgets are T1 120 s, T2 480 s and T3 900 s; T4 has no wall budget.
An overage says `over wall (report only)` and does not change the run's exit.
The final `tier share: T1+T2 …` line counts manifest seconds for the unique
planned files, including the applicable smoke files. Load-gate repetitions
supply no extra census seconds or tier observations.

The hermetic T1 phase runs on one worker; hub T2–T4 and Neovim use `[verification] workers` (default 4), with `[verification.droplet] workers` overriding it on droplets (this repository: 2 per D53, measured on c-8; T-655, A-4106 and A-4156). Ordinary `all` and integrated `dev` runs plan T1–T3. Stage, epic and release occasions include T4 on both platforms and set `CLAND_TEST_SOAK=1` in test workers and their load-gate repetitions. Close-run balancing treats each hub file, including T4, as one job; merged results retain tier lines labelled by shard. `cland verify --workers N` overrides either policy for one durable run; `--size <slug>` overrides a droplet size with provider availability and spend checks. Use `--fresh` for timed comparisons, because cache reuse otherwise requires matching worker counts and size overrides. Only machine phases take `<lock>.machine`. Suite reports include shard durations, machine wait, total wall time, compatibility wait and hub queue wait. Local process-heavy overlap stays disabled.

Every package run takes both legacy locks jointly and retains them through its phases, including smoke, so hub and Neovim suites on the same machine serialize across sessions, projects and worktrees. Runs admit only when both locks are free, under both recovery guards; they hold neither while waiting. A legacy Neovim-first waiter can therefore take the free machine lock and finish without a cycle. No other run can pass between phases and the remaining waiters keep their order. Targeted single-file `node --test <file>` runs do not take a suite lease; they still obey cover-quiet admission.

Both locks use the same PID/start-time ownership, stale-holder recovery and interruption cleanup. Before polling any recovery guard, each waiter atomically publishes its PID, process start identity, monotonic queue time and worktree in `<lock>.queue/`. This persistent queue sits beside the temporary ownership directory so release and stale-holder recovery preserve waiting tickets. The oldest live ticket alone can take all required free locks, regardless of poll timing. Dead or reused-PID tickets are swept; interruption removes the waiter’s own ticket. A waiter prints its queue position, the holder, start time and holder worktree (unavailable for older holders). A dead holder is recovered after a one-second grace period, with its owned processes and temporary root cleaned before a new phase starts. Interrupting a waiter leaves the live holder's lock intact.

New lease records retain the legacy local `started` field and add `startedUtc`, probed with `TZ=UTC` and `LC_ALL=C`. Recovery and display compare the UTC identity, including recovery guards and phase cleanup anchors. An older record has no timezone basis: a live PID whose start differs by at most 26 hours remains held, since UTC-12 through UTC+14 can explain that difference. Scratch daemons started by the test harness use fixture-local compatibility paths, including projects with no verification override.

An ownerless manual lock stays held. The wait message names the lock's `rmdir` command; use it only after verifying that no suite using that lock is running. `CLAND_TEST_SKIP_LOCK=1` is for isolated CI jobs.

`hub/test/quarantine.json` quarantines an exact top-level `file::test` identity
(including its subtests), without skipping it. Task, integrated, close and release
runs execute it normally. The result's **Quarantine** section lists passes,
failures and skips with the owner and expiry. Raw Node counts and diagnostics
stay in the log; an accounted quarantined test failure does not make the run red
or become a shared-defect candidate. Other failures, process crashes, cancellation,
duration budgets and incomplete reporter receipts still fail normally. New-test
load repetitions also run, with quarantined failures reported separately.

Only the Coordinator adds an entry, after two known-flake failure receipts from
different runs and five isolated green repetitions. Record those run/artifact
references and the isolated proof in the owner ticket. The manifest starts empty:

```json
{
  "version": 1,
  "tests": {
    "hub/test/example.test.ts::known flake": {
      "owner": "T-123",
      "reason": "Two independent flaky runs; isolated 5/5 green (evidence in T-123).",
      "added": "2026-10-16",
      "expires": "2026-10-23"
    }
  }
}
```

Dates are UTC dates; expiry is exclusive at midnight and must be after `added`
and at most seven days later. Admission and the runner refuse expired entries by
name, missing owner tickets, invalid dates and empty or TODO reasons. The owner
fixes the test before expiry. The hub records one outcome per test and executed
run, across task and integrated runs; duplicate smoke observations use the worst
outcome. Twenty consecutive passes report **cleared**, so the Coordinator can
remove the committed entry. Skips and failures reset the streak; absent tests,
cache hits and report retries add no green observations. Renewed entries start
a new streak. The hub persists streaks and publishes their update atomically
with the result, including after restart; it never edits the manifest itself.

`hub/test/durations.json` declares the budgets listed under Test levels in
`budget.T1` through `budget.T4`.

Tier budgets check every observed identity, including known baselines and files
missing from the duration manifest. Missing files are named with their observed
seconds. In report mode, logs keep the complete `budget (report only): would fail …` list;
results show the ten largest overages ranked by seconds over budget. An allowance
covers its exact key up to its declared `seconds`; file allowances do not cover
individual tests. Tier-wall projection uses the declared wall budget.

The T3 ratchet pins the merge base with `origin/dev` at admission. It starts with
that base manifest's T3 file seconds, subtracts removed files and tests or files
moved out of T3, then adds observed seconds for new T3 identities (including
promotions from other tiers). Unchanged tests retain their baseline seconds;
smoke repeats count once. Changed literal/template titles are checked in the
submitted source; unresolved dynamic titles conservatively retain their baseline.
Whether a test is new comes from the pinned base source, independently of
missing timing keys: unchanged T3 files and pre-existing literal/template titles
never become growth just because they lack a timing baseline. Reports flag
incomplete base timings separately; unresolved source identities are retained
conservatively and flagged as uncertain.
Growth needs an allowance keyed `T3`, whose `seconds` is the permitted projected
total. The log and result show `T3 ratchet (report only): … s vs base … s` and
`would refuse growth` when unallowed. Missing base data is reported as unavailable.
T1 and T2 may grow within their wall budgets.

`budget.mode` selects `report` or `enforce`; omission keeps report mode for
older manifests. D73 restores report mode until after v0.1.4, superseding D71's
enforcement rollout through T-915; enforcement returns under E-880.
D72 moves the remaining speed exceptions to the open E-880 epic before
E-677 closes, retaining measured baselines and adding bounded allowances for
the stage-cover and periodic-run overages.

In enforce mode, every observed test and file must fit its tier's budget or an
exact allowance covering the measured seconds. A known baseline does not exempt
it. The runner fails with `duration budget`, independently of assertion
quarantine; T4 stays unbounded. Existing allowance validation and live owner
checks still apply, including the legacy exception below.

Before changing refs or the checkout, merge admission checks the immutable
merged candidate against the current integration base. Unallowed T3 growth or
a projected T2 wall above 480 seconds refuses with `merge-budget`. Projection
uses the complete manifests at configured `[verification].workers`, placing
whole files on workers and summing the sequential hub and Neovim phases.
Required immutable inspection failures refuse with `merge-budget`, rather than
disabling the ratchet or accepting partial source estimates. A successful tree
listing may confirm genuinely absent historical manifests; those retain the
unavailable-base diagnostic. Missing file timings use the known-file median.
A new T3 source identity with
no timing receipt is projected at its per-test tier budget (normally 10 seconds)
and labeled `estimated (no receipt)` in the merge-budget line. The estimate
must fit the ratchet or a `T3` allowance; the batch run then measures the test
and enforces its real duration. Existing unmeasured source identities stay old.

The T3 wall refuses above 900 seconds only when the base manifest's own T3 wall
projection at the same workers is strictly below 900 seconds. While the base is
900 seconds or more, merge diagnostics say
`T3 wall 900 s not yet enforced: base <s> s`; the T3 ratchet still applies.

In report mode, tier and ratchet diagnostics cannot change an exit status, and
the existing new-identity gate below remains active unchanged.

`hub/test/durations.json` sets a 5-second test budget and a 60-second file budget
for hub and Neovim. Files sum top-level test-time; nested durations are included
in their parent. Only a new over-budget test or file fails its run with a named
`duration budget` diagnostic. A test is known when its exact `file::test` key is
in `tests` or `allow`; a file is known when its path is in `files` or `allow`.
A known file never exempts a new test inside it, and a renamed test is new.
Before requesting review, add an exception in your
task branch with the observed `seconds` and a reason explaining why the test
needs that time:

```json
"hub/test/example.test.ts::real lifecycle": {
  "seconds": 6.1,
  "owner": "T-123",
  "added": "2026-10-17",
  "expires": "2026-10-24",
  "reason": "Starts multiple real workers and proves their confirmed teardown."
},
"hub/test/example.test.ts": {
  "file": true,
  "seconds": 65.2,
  "owner": "T-123",
  "added": "2026-10-17",
  "expires": "2026-10-24",
  "reason": "Aggregates independent end-to-end lifecycle and recovery cases."
}
```

These entries go in `allow`; a file exception does not exempt individual tests.
The working-tree and immutable-candidate manifest lint names missing or TODO
reasons, missing or closed owner items, invalid dates, excessive date spans,
and expired allowances (expiry is midnight UTC). D72 allows at most 31 days
between `added` and `expires` for dated allowances owned by `budget.legacyOwner`;
all other owners keep the seven-day maximum. Ownership
is checked in the live authoritative tracker, including linked worktrees.
Both paths also refuse duration test/allow keys with no matching source test
identity, and file baselines/allowances naming a missing test file. Literal and
template titles are checked in their own file; computed titles remain uncertain.
Renaming or moving a test therefore requires removing its stale manifest keys
in the same change. A later stage cover supplies the new identity's baseline.
An unmatched key refuses during shard planning, before any test receipt exists.
A merge batch therefore holds as inconclusive with nothing to bisect; the
Coordinator diagnoses the named key, arranges cleanup and recovers the batch.

By the Coordinator's D53 exception, pre-existing allowances carry `legacy: true`
and have no calendar dates. D72 makes their owner `budget.legacyOwner` (E-677
when omitted); this repository sets E-880. They expire when that owner closes.
T-915 converts undersized legacy allowances to dated E-880 allowances, keeping
their original reason and appending the observed peak and headroom. Every other
legacy entry retains its reason and seconds through the owner migration.
New allowances must use dated fields under the span limits above; `legacy` is
reserved for the original migration, and changing its owner never admits a new
legacy key. Reports show the legacy count, sum of seconds and configured owner,
so its progress is visible. Refresh
preserves ownership, dates, legacy metadata and the T3 allowance without extending
expiry. Missing manifests disable the budget and its reporter.
In report mode, known entries never fail the duration budget. Those over budget always produce a
`duration regression` notice annotated `over budget`, even when flat or faster.
Those under budget report when at least 1 second and 50% slower than their
baseline. Both kinds share a five-line cap, ranked by seconds over baseline.
The suite result includes these notices, budget failures, and `suite budget overhead <ms> ms` for
the runner's self-measured loading, bookkeeping, checking and reporting work.

At each stage close the Coordinator runs
`npm run test:durations -- --add-only <latest-green-integrated-log-artifact-path>` on `dev`
and commits the added baselines. Until T-931 decides allowance-refresh policy,
use `node hub/test/durations.ts refresh --add-only <log>…`: it adds only missing
test and file baselines, prints each addition, preserves existing entry bytes
and number formatting, and leaves every allowance unchanged (including omitted
identities and over-budget new tests). Review any new over-budget identity's
allowance separately. Source artifact ids are retained and the source head is
updated. Repeating the same refresh adds nothing.

The full `node hub/test/durations.ts refresh <log>…` mode
accepts several logs (newest last), takes per-test medians, sums file test-time,
preserves reasons and retains baseline entries for files absent from every supplied
log. For each observed file, it drops tests absent from the newest supplied log
that ran that file. Ordinary passing file-completion receipts also mark empty files
as observed: removing a file’s last test drops its old identities and records zero
test-time. Load-gate file envelopes do not mark ordinary execution. Partial task (T0–T2) and batch (T1+T3) logs can therefore refresh
their tiers without erasing the others. Unobserved allowances remain intact even
when their files have no timing baseline. Retained entries keep source artifact
references; timings for observed identities still use per-test
medians across supplied logs. It reads the durable
`suite timing` records or older top-level spec timings with start/source title
mapping. Refresh writes a `TODO` allowance only for an over-budget identity absent
from both its previous baseline and `allow`; replace it before admission.
Reasoned entries stay, and a known entry that becomes slow only updates its
baseline seconds.
Keep artifact ids and the source head in `source` so timings remain traceable.

Task-branch verifies have a **load gate** for each admitted T1/T2 top-level `file::test` identity
missing from both the duration manifest's `tests` baseline and the hub's durable
landed-task proof set. The hub retains exact identities with completed `5/5 passed`
load-gate receipts on reported green task runs. A proof becomes known only when
that run's item has a dev landing receipt matching its exact branch and head.
Unlanded branches and other revisions supply no exemption; skips, partial passes
and quarantined failures supply no proof. Suite history retains the proofs across
hub restarts without a dev commit per landing; retained pre-upgrade logs are read
once to recover older proofs. As the phase discovers
new names, `[verification] load_gate_workers` parallel lanes (default 2) repeat
each identity five times in fresh Node processes with an escaped, exact `--test-name-pattern` on the file, alongside the ordinary
phase. Ordinary integrated `dev` runs receive no repetitions. At stage, epic and release occasions, the hub instead pins the identities observed in the latest completed, reported green integrated stage run. Every T1–T3 identity absent from that receipt receives five repetitions, even if it appears in the current duration manifest; T4 runs only in the base soak phase. A later ordinary batch, failed stage or cache hit does not advance that baseline. Without a retained stage receipt, all observed identities are treated as new. Each shard carries the same pinned baseline. Each lane finishes all five repetitions of one identity
sequentially before taking another; the gate never drops repetitions to meet a
wall deadline. Its worker count is included in the log and run report. Increasing
it trades wall time for load, independently of ordinary phase workers.
An `allow` entry permits duration; task identities become known through a duration
baseline refresh or a matching landed-task 5/5 proof. Stage, batch and soak occasions
continue to use their own pinned receipt baselines, independently of landed-task proofs.
The live hub sets the task flag in the selection JSON. Updating a candidate
runner alone does not enable it when the running hub predates this feature;
bootstrap uses package-runner fixtures, followed by a live task proof after the
hub update.

Each repetition must exit green and produce exactly one receipt for the named
test. Five passes supply load proof. If all five repetitions skip with a
nonblank reason each time, verification accepts the prerequisite skip and the
log and run report name it as `skipped, not load-gated`, with the reasons. This
supplies no load proof: obtain five passing repetitions under load on a machine
with the platform or binary prerequisite, recording that machine and its
receipts in the item topic before claiming load proof. A skip without a reason,
a mixture of skips and passes or failures, TODOs and pattern-missed tests still
fail the gate.
The log reports `load gate: <file>::<test> <passes>/5 passed` for other outcomes;
fewer than five passes fails verification and appears in the failure summary.
The run's `suite duration` line includes `load gate extra wall <seconds>s`: the
sum of the tails spent finishing repetitions after their ordinary phase exits.
It does not estimate
contention during overlap. Repetition receipts do not refresh duration baselines
or enter coverage maps. Missing manifests disable this gate too.

The eight-new-test wall probe uses the same package-runner regression with 20s
per fixture test (normally 0.1s). It reports extra wall and peak one-minute load:

```sh
CLAND_LOAD_GATE_SLOW_PROBE=1 node --test --test-name-pattern='task load gate bounds eight' hub/test/durations-runner.test.ts
```

At the default two lanes this takes about seven minutes overall: the acceptance
bound is under five minutes of extra wall after the ordinary phase, with all
forty fresh repetitions retained.

See [the runner and process-fixture notes](../../hub/README.md#tests) when adding tests that spawn processes.

Hook bridges retry missing or unreachable hubs for 60 seconds, including a silent
handshake. Their expiry stops the mod's restart loop too. The real-hub lifecycle
test uses `CLAND_TEST_BRIDGE_GRACE_MS=2000`; a T1 test pins the production default
to 60 000 ms and the mod's expiry decision has an in-process no-retry proof.
`CLAND_TEST_SMOKE_BUDGET_MS` shortens readiness only for planted startup hangs.
The ordinary T2 thread differential oracle always uses 2 seeds × 12 renders,
including when `CLAND_TEST_SOAK=1`. The separate T4 case in
`nvim/test/thread-oracle-soak.test.ts` runs 4 × 25 through the same oracle helper. The shipped QA walk, orphan performance cases,
and hub harness self-tests are T4. A `hub/test` helper diff keeps the package
fallback, filtered to T1/T2 on a queue-enabled task; T4 self-tests run at
occasions and in the nightly soak. Each phase's existing discovery sweep reports bridge counts before and
after cleanup and fails if a phase candidate survives, preserving ambiguous processes.
For old orphans use `cland doctor` to inspect and `cland doctor --fix` to sweep only
the calling user's verified bridges whose explicit hub file is missing. An existing
hub file, ambiguous argv or unverifiable identity prevents cleanup. Doctor fixtures
scope deleted hubs, bridges and fixtures with `CLAND_TEST_ORPHAN_ROOT`; both CLI
and embedded daemon launches through the test harness default startup fixture sweeping to their own
project root too. Explicit scratch scopes may widen that test boundary. A doctor
cleanup case uses the default skipped startup sweep, or observes its completion
before removing roots, so a pending startup sweep cannot consume doctor's target.
Deleted-project hub OS proof wins over fixture classification in doctor's output.
The native fixture-ownership T3 case checks the open receipt separately from its
PID/birth match, then observes both client/stub receipts and confirmed process
death before removing the root. Linux `ps lstart` truncation needs the one-second
lower birth margin already used by self receipts; fd inheritance alone is not
the complete ownership proof.

Read-only QA stub runs keep serving inline scenarios when receipt creation fails
with EACCES, EPERM or EROFS. Without a receipt they have no ownership authority:
doctor may report a missing-root hint as unowned, but never signals it. Other
receipt errors still fail startup. The RPC client fixture still requires a
writable temporary directory before creating its receipt; read-only QA launches
Neovim directly rather than through that fixture.

## Cover-quiet

Before fixture setup, the hub and Neovim test harnesses ask the project hub for
a read-only `suite.slot` check. When an integrated cover holds the local
compatibility slot, an unrelated test exits with `cover-quiet` and the run id.
Wait for that cover to release the slot. Its own workers pass with the matching
inherited lease; remote covers do not occupy this machine's local slot. Without
a project hub there is no refusal. A connected hub must answer. Admission waits
at least 15 seconds, scaling with one-minute load per available CPU to a maximum
of 60 seconds. A timeout is a typed `AdmissionTimeout`, with the nonzero outcome
`admission timed out after N s: project hub busy; not a test result`. Package
reports count admission timeouts separately and omit affected assertion ids from
test failures and shared-defect candidates, including load-gate repetitions.
The package entry returns 75 when its own admission times out; Node's worker
still exits nonzero when its admission hook fails. The harness registers that
hook before account fixtures, so test registration completes before admission
waits, and neither test bodies nor fixture hooks run after a refusal or timeout.
A disconnect also fails admission before fixtures. Discovery follows `CLAND_HUB_FILE`
and linked worktrees, as the CLI does. Only the human may set
`CLAND_TEST_IGNORE_COVER=1` to bypass this check. The check never joins the queue
or acquires a lease; normal full-suite queueing stays in effect.
An older hub that refuses or does not recognize the check fails startup with
`test admission unavailable`, naming the missing read-only `suite.slot/check`
capability and the required hub restart. Wait for that authorized restart.

### Droplet storage health and fixture filesystem (T-755)

Each dedicated run machine mounts `/tmp` as tmpfs before starting its worker.
The cap is the smaller of 4 GiB and half the machine's RAM; the repo,
`node_modules`, logs and coverage maps remain on disk. The existing suite and
reaper continue to own their normal `/tmp/cland-suite-*` roots. A failed or
unavailable mount keeps disk-backed `/tmp` and reports an explicit fallback.
The mount lives until that run's machine is released.

A startup probe measures four 1 KiB writes with fsync and eight SQLite WAL/FULL
autocommit inserts (including database initialization/close), separately on disk
and on the fixture filesystem. The entire probe has a ten-second bound plus a
one-second kill grace; failure leaves unavailable measurements and preserves the
suite outcome. A final three-second sample plus one-second kill grace reports
aggregate `/proc/stat` iowait and steal tick deltas and percentages across the
package run, excluding startup probes. Guest counters are not added twice.
Missing or reset counters report unavailable rather than zero. These are machine
CPU percentages, not per-process CPU use or a proof of device-level latency.

The structured `suite machine health` lines stay in the log. The final complete
receipt is copied into `result.json`, the result header and the `suite-result`
and `verification-timing` journal records, retaining run attribution through
recovery and cache reuse. Sharded results retain a `shardHealth` collection with
original child run, shard label and machine identity in durable receipts, journal
records and cached/recovered headers; they never treat concatenated child logs
as one machine's sample.
Only timing/counter/filesystem facts are captured; no environment dump or
command line is collected. Compare completed phases when investigating timings:
a failed hub phase can omit both Neovim and coverage reduction.


### Legacy spend retirement fixtures

`cland executor retire-legacy --confirm-registered-hubs` belongs to the human or
Coordinator. The flag asserts that both ledgers' registered projects cover all
of the user's hubs. Each project must return `spend.legacyRetirement: 1` and the same primary spend
path through live `executor.status`; absent, unreachable, non-capable and old-path
hubs refuse with the
registered project list. Neither a discovery version nor the new path alone proves marker support.
Never-registered hubs and later downgrades are outside that check: upgrade and
register every hub before confirming, and do not downgrade afterwards.

Retirement preserves the legacy file in place and publishes `spend-retirement.json`
with its bytes beside the new ledger before activating retirement. Tests exercise
this boundary at T1 with injected hub responses, fake time and a scratch HOME/XDG
state directory (`hub/test/executor-spend.test.ts`); socket authentication and
command routing belong at T2. Never exercise this command against the human's
actual state. See [the operational contract](../../hub/README.md#retiring-legacy-spend-write-through).

### Rendered artifact checks

`nvim/test/artifact-render.test.ts` exercises the T2 recorded-client boundary:
read-only thread projections, exact editable raw source, rendered-on-open defaults,
and a 2,000-line artifact’s bounded first paint: only visible rows plus four source
rows are parsed before the first rendered grid; the remaining parse is deferred.
The T2 load gate keeps a 200 ms gross guard. The 50 ms target is measured separately
as a median of several local macOS runs on a quiet machine, reported in the item
topic with head/tree and individual samples. Its parser counter
is read after the final rendered screen is observed; unchanged file versions
(path, mtime and size) reuse the cached projection. Unsaved raw edits are separate
buffer versions. `qa/cases/ARTIFACT-001.lua` checks the visible Markdown features,
block quote, raw toggle, help and palette through the headless grid. Prompt and
browser compatibility remain in `nvim/test/artifacts.test.ts`. T-1005 adds T2
recorded-client proofs in `artifact-render.test.ts` for folder entry/`.md`/`.markdown`
children selected in the browser, palette `CTRL-v` with unequal centre/split widths
and independent toggles, and both `␣ps`/`␣pa` sending exact saved Markdown bytes
with the correct attachment flag. These assert rendered grids, editable raw
source and protocol receipts, without timing targets. The headless-grid case
`qa/cases/ARTIFACT-002.lua` reads a rendered folder child and palette split side
by side, then checks that a split raw toggle leaves the centre rendered. It is
appended to the shipped T4 catalogue; E-795 after-stage QA remains separate.

The same T2 file covers artifact-event refresh with an already-loaded raw buffer,
raw saves replacing a cached version, 120→80→120 table relayout against the thread
projection, source-line cursor mapping across a stacked table and deferred table
completion, rendered-on-restart snapshot/restore, and a recorded move into a folder
followed by a save on the rebound raw path. These assert grids, exact source lines,
buffer identity/options and final decoration receipts; they add no timing targets.
The shared projector returns a one-based `source_line` on each metadata row,
including table rows and their generated separators. Artifact refreshes consume
this mapping without changing mode; unchanged versions keep their cursor row.

The 20,000-line scenario in that T2 file also observes a `j` key and its cursor movement before rendering finishes, then waits for the final decoration receipt before checking start/middle/end grids and zero new parsers on reopen. Parser instrumentation asserts continuous Markdown region extensions of at most 128 rows and injected-language batches of at most 64 regions; scheduled-callback instrumentation records every artifact/projector/native-parser turn, including synchronous reused-parser and query-only turns, and asserts at most 256 extraction/projection steps, 128 buffer rows and 256 decorations per slice. A one-second gross slice guard catches a stalled callback under load. Source-row counting stops after first paint: scanning the full source inside a timing spy would introduce unbounded work of its own. The context case covers a fence and table spanning many batches, a reference resolved from the end of the document, recursive Markdown and Vim-in-Lua injections, combined/include-children and child-excluding injection ranges, comparison of text, canonical spans, link metadata and applied extmark styles with the unsliced thread projection, and a superseded-version callback barrier. A reused-parser regression requires every synchronous parse turn to appear in the timing audit.

The 16 ms target is a quiet local macOS measurement, separate from load-gate repetitions. Report five fresh-client runs' maximum render-callback times, their median, head/tree, queue state and machine load/idle evidence in the item topic. Include initial projection-buffer construction as well as every native parser callback, extraction/projection and buffer decoration turn. The full first-paint open/redraw/grid observation is also reported separately. Timing includes the observation wrappers; it is diagnostic in T2 and never substitutes for the deterministic work assertions.

## Browser sign-in fixtures

Network-edge tests use loopback aliases (`::1` for the web edge while spokes
stay on `127.0.0.1`) or scratch config; never bind the live hub to a network
interface. `web-edge.test.ts` reads both actual listener addresses from `hub.status` and confirms both connected
addresses, plus doctor's
stopped-hub config warning. `web-auth.test.ts` covers tunnel Host/Origin admission,
Secure only on the configured Host + Origin pair, forwarded-header spoofing,
and executable `web --qr` output/refusal with scratch browser openers.
`web-network-unit.test.ts` covers LAN/wildcard/IPv6 link selection and half-block
QR vectors at T1, including link-local-first/only-link-local wildcard selection
and tunnel precedence; its independent byte-mode decoder reads format/mask/data from
the terminal rendering (L, versions 1–6; it does not correct damaged symbols).
`web.link` optionally takes `qr: true`; it remains a human-only Unix-socket frame.


`cland web` is human-only. A session shell carries its own actor and is refused;
never remove the live session's identity to mint a link. In a disposable project,
`projectHub` plus `askHubFrame(discovery, {type: 'web.link'}, 3000, {})` mints a
link for a test client. Trade it at `/auth` and supply the returned per-project
cookie and exact page Origin on `/ws`; the hello is a client hello without a
secret. Cookie sessions persist in `hub.db` as SHA-256 hashes, with public ids
and creation/last-use timestamps; expiry is fixed at 30 days after creation, not renewed by admission.
`web.sessions` and `web.revoke` also require a human test client on the Unix
socket. Session shells, browser sockets and stdio cannot manage browser sessions.

Web authority is a separate request boundary: `hub/src/hub/web-authority.ts`
classifies every human request and denies missing rows before replay or actor
resolution. `wire-conformance.ts` checks the inventory at typecheck; a new frame
needs a policy row in the same change. See `hub/README.md` for the 0.2.0 refusal
list and the `cli-neovim-only` result code. `web-authority-unit.test.ts` covers
pure policy decisions at T1; `web-authority.test.ts` exercises authenticated
`/ws` and Unix sockets at T2. The local comparisons preserve normal handler
preconditions: they do not publish, invoke Git or acquire provider resources.
Use the scratch hub and filtered HOME/XDG/Git fixture for both edges.
The same T2 file covers human `session.history` on Unix and web (both traffic
directions across topics, exclusive numeric pages, count/byte bounds and
unchanged spoke `history`), web-only `web.session` with two independent cookies
and a reconnect (own creation/last-use/fixed expiry, no identity selector), and
web launch-directory refusal with a root launch and a local-directory comparison.
Use fake adapters for launches and fake time for sign-in expiry; do not probe
these requests against the live hub. The T1 authority file classifies the two
reads and refuses every own `session.launch.cwd` field before dispatch.

`web-auth-unit.test.ts` covers digest storage, one-time spending and expiry with
an injected clock at T1. It also reads the explicit acceptance row to verify
cookie hash-only persistence and last-use updates across store reopenings.
`web-auth.test.ts` restarts an in-process hub twice on one disposable project to
prove cookie persistence; no process lifecycle assertion requires a daemon.
Its executable `web --sessions`/`--revoke` tests count sockets, arm close observers
before revoking, assert the server `web-session-socket-closed` receipts by CLI
return, and separately bound client closure plus cookie refusal. It also
covers HTTP upgrade checks, client/spoke admission and secret leakage at T2
with an in-process project hub. Its standalone prerequisite uses the shared
web-build helper to build a missing or stale bundle once before tests; the leak
scan requests every file of the actual installed bundle. Suite shards containing
any `installedBundleReaders` entry in `hub/test/run-suite.ts` build before workers,
even without a Web phase or an available browser. That list includes this file
and all real-doctor bundle readers, including `doctor-cli.test.ts`; targeted
standalone doctor CLI runs require a current build.
Doctor component fixtures inject the installation bundle check; the separate
`web-bundle.test.ts` retains missing/stale/current diagnosis on scratch files.
The tests use scratch HOME/XDG/Git configuration
and filtered environments through the shared fixtures. Both `open` and
`xdg-open` are stubbed on scratch PATH even for `--no-open`, so a regression
cannot launch the human's browser or touch its keychain. Real browser checks
belong to the dedicated headless web phase (T-991/T-992).

`web-artifacts.test.ts` exercises `artifact.url` on a cookie-authenticated web
client and cookie-free HTTP reads at T2. It covers extension types, file/folder
confinement, traversal and symlink refusal, HTML sandbox headers, relative
stylesheets, revocation and the fixed session expiry with an injected clock.
It also restarts the in-process hub to prove capability persistence and covers
moved-file owning-folder substitution. The injected filesystem open port swaps
a folder parent at the final open boundary: Linux must serve the already-anchored
file, macOS must refuse the symlink, and neither can return the outside bytes.
The T2 fixture keeps an explicit symlinked project ancestor on every platform:
authorized reads must succeed while artifact and nested-folder symlink swaps
remain refused. Only the trusted project prefix is resolved once by the web
edge; artifact paths outside it retain full-path no-follow checks.
`web-artifacts-unit.test.ts` checks outside-prefix no-follow reads, digest-only database rows and cascading
removal on revocation and expiry at T1. The frame is web-only; local test clients create source artifacts and manage
sessions through the Unix socket. Capability digests persist beside their cookie sessions across hub restarts.

## Thread history pages

`hub/src/hub/store.test.ts` covers numeric `topic.history` pagination at T1 through
`HubCore` and the store: 450 rows in three pages each way, exclusive cursors,
interleaved writes, timestamp-independent sequence order, cursor validation and
unchanged no-cursor/message-id history. `TopicMessage.seq`, `TopicHistoryFilter`
and the request fields are checked against `shared/wire` by the T0 conformance
assertions. Neovim's thread tests exercise the unchanged message-id archive reader.
The existing monotonic store sequence is reused; no new migration/backfill is
needed for an already numbered database. Measure upgrades only on a consistent
SQLite backup in a disposable root with the shared fixture environment, never on
the live file; report copy size, row count, startup duration, writes, head/tree and
platform separately from suite evidence.

`hub/test/thread-runs.test.ts` proves the additive history/live-frame seam at T2
with a disposable `projectHub`, in-process Implementer/Reviewer/Aide peers and a
complete fake clock: four-message facts, a fifth message's same-id delta without
a history read, tracked ask/answer/verdict/human/Aide boundaries, the hub-local
midnight rule, queued verifier assignment with a later run member, and full first-three/+N metadata on mid-run numeric/message-id
pages. Observers are armed before sends; final run/count/identity assertions
remain. A late client reads a suffix without seeing the run's first message.
`thread-runs-store.test.ts` is T1: store reopen, role-at-send boundaries,
transaction rollback, retention rebuild with a surviving former-Aide boundary, lazy backfill across 405 existing
messages and byte-capped run pages. No new native process is involved. Wire conformance checks `ThreadRun`
and `TopicMessage`; run facts count toward the existing history reply cap.

## Implementer test selection

Archived merged session reads use the public `session.list`/snapshot seam in
`connection-snapshot.test.ts` at T2. A sealed project with a fake clock compares
merged rows against the snapshot, archives a stopped process, and checks the
archived-only result and byte-identical legacy fields with unmanaged presence
connected. `web-authority-unit.test.ts` covers the archived read at T1, and
`wire-conformance.ts` checks `SessionListRows` at T0. Existing process lists,
counts, snapshot membership and startup observers remain unchanged.

Startup explorer regressions use `item-summary-scale.test.ts` at T2: a thousand
durable rows with a planned epic and retained verdicts count recompute batches.
The serving case arms the existing task-write gate before startup, observes the
listening and serving receipts separately, and keeps an unscaled two-second
monotonic gap assertion. It then observes the held planned write, proves a status
reply while it is held, releases it and observes the planned status. Fixture
setup has its own bound. No real daemon or browser is needed. The diagnostic
`hub/scripts/measure-startup.ts` copies durable live inputs into a sealed scratch
root; its measurements are diagnostic evidence, not a suite receipt.

Lease-recovery startup coverage uses `startup-ready-component.test.ts` at T2:
persist a releasing lease before `projectHub`, hold the scripted fake DigitalOcean
provider list, inject executor lock process facts through `droplet.processes`,
observe listening separately from session restoration and serving,
and retain the unscaled two-second listening-to-serving bound. Recovery admission
(`executor-recovery-started`) must follow serving. A status socket reply while
the provider is held proves responsiveness; release the gate and observe both
`executor-sweep` and the durable released lease. Separate coverage checks every
named start/completion pair between binding and serving and finite nonnegative
monotonic `durationMs`. No provider credentials, daemon, browser or real machine
are involved; the synthetic provider uses the sealed fixture environment.

Claude re-exec ownership uses the frame/MCP seam in
`claude-code-schedule.test.ts`: the production adapter reads a scripted native
CLI boundary, synthetic PID/start facts and a fake clock in a sealed scratch
project. Production grace is one second from the first missing-PID observation;
a dedicated expiry callback observes native identity before finalizing death,
without waiting for the next liveness tick. Default-window tests prove prompt
genuine exit, reconnect-before-missing-PID ordering and expiry cleanup at stop.
Race fixtures inject a longer virtual window with `ClaudeCodeOptions.reexecGraceMs`.
Native fixture timing uses `fakeClaude(t, { reexecGraceMs: 100 })` via the internal
`CLAND_TEST_CLAUDE_REEXEC_GRACE_MS` hook; the native crash contract advances its
clock only after observing OS exit. Integration tests retain their existing
event/row/screen bounds and final assertions; no death wait is lengthened.
Tests retain the published replacement PID, role, claim and absence of
revocation, with hello before the first missing-PID poll and after both that
poll and the last scheduled native snapshot. A
distinct native id is also learned after launch through discovery and hooks;
a held launch query crosses the grace boundary before the replacement PID is
published, retaining role and claim. Known-PID hook coverage independently
changes the native identity before replacement. Held process-start probes,
with known and unavailable results, cannot overwrite a newer hook identity or
revoke ownership before the next poll reconciles it. A held native query also
returns its earlier snapshot after a newer hook, proving that the same fence
covers discovery as well as process-start probes. A
conflicting native conversation cannot inherit a reused background id and the
original process exits after the grace. `store.test.ts` checks the ten-minute
General decision and cancellation with fake time, including store reopen with
an absent remembered holder, deadline recovery and durable alarm deduplication.
The native Claude contract
keeps the actual process-exit assertion and advances only the hub watcher's
grace after the OS has reaped the fixture PID.
Vacancy shutdown coverage retains the connected-Coordinator `projectHub.stop`
and zero-timer assertions in `project-clock.test.ts`. The core/store regression
closes both before delivering a late disconnect, then checks no database access,
no lifecycle publication and no timer rearming across the notice deadline.

For session archive scheduling, `session-archive.test.ts` uses 250 durable rows
in a scratch `projectHub` with fake time. It retains scan-count and public
`session.list` archive receipts across ten idle minutes, the exact dated
threshold, unrelated item updates, stop/close transitions and reopening. Deferred
failed-resume rollback retains its stopped row across lifecycle release, then
proves recovery settlement archives an overdue row or arms its future deadline.
These two smaller Sessions fixtures share the hub fake clock with an explicitly
owned `recoveryClock`; production native cleanup retries retain real time.
`node hub/scripts/measure-idle.ts /absolute/project/.cland/tasks` copies canonical
tracker files into a sealed scratch hub with 250 synthetic stopped session rows.
It measures ten real minutes of process CPU after startup, reports archive sweep
counts and separately times the hourly P90 calculation on 10,000 scalar receipts.
This is local diagnostic evidence, not a suite pass. Run on a quiet machine,
record the implementation head/tree and platform, and publish the output through
`artifact.create`. Adapters and native probes are fixture substitutes; it makes
no claim about native harness idle load or the live workbench.

Freshness scheduling and Git batching have native contracts in
`follows-native.test.ts`: generate 1,000 commits, hold a demo history read, then
require the settled ancestor/contains receipt within two seconds. Each native
repository-setup Git command, including fast-import, has a five-second timeout;
demo entry has its own five-second observation bound. These setup bounds are
separate from the unscaled two-second foreground bound. The test prints the
observed foreground time, retains both final
cache assertions and requires the demo to remain outstanding until that receipt.
It then observes demo completion and counts two history reads, with no per-commit
`diff-tree` calls. A native merge/side-branch/rename/revert case keeps exact
conflict commit/path results. Closed-demo restart reads and pending-tree cover
filtering use T2 injected facts.

For copied-live diagnostic evidence, `node hub/scripts/measure-freshness.ts
/absolute/project` copies tracker, durable finished suite history and private Git
objects/refs into a disposable project, starts a `projectHub` with sealed fixture
accounts/config and observes E-412 stage 3 through the `task.plan show` request.
This repository-specific probe retains the Linux and macOS cover IDs. Source
hooks, remotes, provider credentials, PIDs and queued workers are excluded; the
fake hub clock suppresses schedules, while timings use the real monotonic clock.
`--recompute` additionally removes only the scratch derived stage-closure
checkpoints, recreating a restart before closure persistence. Label that stronger
case separately. Output records elapsed time, Git invocation counts and history
scan ranges; publish it with source head/tree and platform. This is a diagnostic,
not a suite receipt. Let other local measurements finish before comparing times.

For remote watchdog regressions, use the executor fake with a shared fake clock:
emit an in-flight receipt, observe its mirrored bytes, stop output, then assert
the terminal timeout receipt and released resource. Exercise status replies
without bytes, failed log reads, new-byte renewal, and restart at both sides of
the output-checkpoint/append boundary without resetting the admitted limit.

For hub shutdown, `daemon.test.ts` runs a real `hub serve` with the web edge
enabled and a scratch epic-demo freshness Git command held at its batched raw history read.
It arms the durable `stopped` log observer before stopping, then separately
bounds process exit to two seconds and asserts both hub and Git PIDs are gone.
The background-drain regression holds conflict-retention native I/O outside the
storage operation queue. After its entry receipt, it requires an idle operation
queue, an abandonment event with `operations: []`, a durable `stopped` receipt,
exit code 1 and a reaped hub PID. The normal-stop case retains exit code 0 and
asserts that no abandonment event was recorded.
Provisioning shutdown uses the fake DigitalOcean HTTP API: hold create after its
durable lease is armed, observe `stopped` and OS exit within an unscaled three
seconds of `hub.stop`, then release the late create and confirm reconciliation
deletes the owned resource while preserving a foreign-tagged one. Separate
SIGTERM cases retain that exit bound, including a native socket-close callback
held through the CLI's two-second signal deadline (exit 1 with incomplete cleanup).
`executor-safety-component.test.ts` covers detached create replies after store
closure and interrupted provider cleanup on fake time at T2. Preparation's
restart test waits for the durable released lease before its empty-resource
assertions; the outcome notice alone is not a deletion receipt.
The CLI diagnostic case keeps a fully stopped process alive deliberately and
advances only its stop deadline after the shutdown receipt. It expects exit 1
and `stopped, lock released, process still alive`, with no signal after lock
release; the unrelated-PID case retains its separate safety assertion.

Clause procedure (defaults implementer, project implementer):

- `hub-selected` names changed functions, covering tests and the map artifact. Queue-enabled tasks run all T1 and selected T2, with all T2 in both packages on fallback. T3 smoke runs in batches and integrated runs. Coverage maps come from green integrated runs; ancestry, mapping and fallback rules are in docs/agents/tests.md.

Clause procedure (defaults implementer, project implementer):

- Use `projectHub(t, root, env?)` from `hub/test/harness.ts` for project tests by default. Keep `startDaemon` only when an assertion concerns the hub process (startup, shutdown, signals, crash/restart, lock/discovery/PID identity, orphan sweeping, watchdog behavior, or CLI behavior with the hub down or unreachable); such tests name the process lifecycle behavior they prove. See docs/agents/tests.md.

## Web phase

`web/test/phone-install.test.ts` owns the install-entry, Badging API and QR sign-in
seams through the sealed 390×844 touch/mobile fixture. Read the actual manifest's
start URL after persisting Sessions, observe Inbox and `/`, and keep ordinary
reload persistence. Stub badge methods before navigation and follow the hub's
needs-you count through public ask/answer frames to zero; explicitly remove the
API in the fallback case. `cliLink: 'qr'` runs the executable CLI with a synthetic
tunnel origin, decodes the QR against its printed link, and redeems its exact
token on the scratch loopback edge in a fresh phone context. Observe the auth
response, 30-day cookie and live authenticated socket. `web-auth.test.ts` checks
the project-named manifest, token theme, HTML links and PNG signatures/dimensions
at T2. Build first; run web-auth, phone*.test.ts, shell and web typecheck guards
before mode-free task verification. Real installability and the real badge stay
in QA's full-Chromium demo. New passing identities reaching their tier's 80%
threshold need dated, reasoned E-880 allowances at about 1.5× the worst sample.

`web/test/phone-approvals.test.ts` owns phone approval presentation through the
sealed 390×844 touch/mobile `webFixture`, fake Codex/Claude Code adapters and
public hub frames. Keep complete command/file subjects and session facts,
full-width 44 px choices, optional Deny notes on the label row, visual-viewport
resize receipt, physical Escape/close/scrim/swipe without any answer, TUI-only
Claude and payload fallback marks without a sheet, exact frame/archive outcomes
and a held losing answer recovering the native winner. Reuse `ApprovalCard`'s
gate/recovery and `BottomSheet`'s field context; do not add native processes or
touch the live hub. Build first; run phone*.test.ts, inbox, session-drawer and
key-contexts targeted before mode-free verification. New passing Web identities
reaching 4 s need a dated, reasoned E-880 allowance at about 1.5× the worst sample,
citing its run.

`web/test/phone-thread.test.ts` uses the sealed 390×844 touch/mobile context and
public hub frames for full-screen Topics, read-only card return at the exact
message position, two-line run facts and pinned expansion, full-screen HTML
chips and 390 px verdict/long-id/code layout. Keep the shared thread mounted
behind detail views, suspend covered read receipts and restore focus on Back.
Observe `data-phone` after resizing before measuring the desktop boundary.
Build first; run phone*, topics, thread-runs, thread-artifacts, key-contexts and
palette as targeted neighbors before mode-free task verification. New passing
Web identities reaching 4 s on any platform need a dated, reasoned E-880
allowance near 1.5 times the worst passing sample, citing its run.

`web/test/phone-asks.test.ts` uses the existing sealed phone `webFixture`, public
frames and fake asker seam. Keep 48 px full-width numbered options, 44 px options
and a three-line question after field focus with a resized visual viewport,
label-row Decline with a required reason and an exact asker receipt, physical
Escape from both field and option, close/scrim and CDP swipe no-answer readback,
independent-context settlement with the confirmed Inbox departure and leave
rule, and thread Answer opening the same sheet. Build first; run phone*, inbox,
asks, key-contexts and palette targeted before mode-free verification. A new
passing Web identity reaching four seconds on any platform needs the dated,
reasoned E-880 allowance described below before verification.

`web/test/phone-inbox.test.ts` owns the phone Inbox home seam through the sealed
`webFixture` touch/mobile context at 390×844 and public hub frames with a fake
sender. Keep the four ordered full-width 44 px fold buttons, zero counts and
saved folds, empty/check title and a live ask's count, two-line rows, inline
message/request replies with per-topic reload drafts and exact sender/topic
receipts, the waiting plan's counts without Plan controls or Enter navigation,
and the 44 px Events/Archive controls with in-place archive and Events entry.
Build first; run phone, phone-more, inbox, composer, events, key-contexts and
palette as targeted neighbors before mode-free task verification. Existing
desktop cases keep their desktop expectations; migrate any phone-width
assumptions to the phone surface rather than restoring desktop actions there.

`web/test/phone.test.ts` owns the phone-frame seam through sealed `webFixture`
and Headless Shell. `pageCase`'s fourth argument `{ phone: true }` selects
390×844 with touch/mobile and five-slot bar readiness; existing desktop contexts
still wait for seven rail areas. Keep 640/639 live resizing, touch controls,
More's physical Escape/outside/selection dismissal, complete shared last-look
counts, exact Inbox row selection with inline actions and no independent drawer,
and the saved desktop split across a phone reload. Build first; run
area-slots, shell, key-contexts, palette, sessions and inbox as targeted neighbors
before mode-free task verification. New passing Web identities reaching four
seconds on any platform need a dated, reasoned E-880 allowance at roughly 1.5
times the worst sample, citing the run without relaxing assertions or bounds.

`web/test/phone-more.test.ts` uses that same phone context and sealed public
hub/CLI seam for More's read-only Items, Artifacts and Accounts. Keep exact card
and viewer identities, both back controls, phone-key no-write CLI readback,
desktop physical keys and the 640 px boundary, account window facts and absent
phone notification switches. Saved desktop planning views must yield to the
phone tree. Hold a public item-summary read across both Back paths, then observe
the exact target's arrival before asserting that the list stays open. Build
first; run phone, items, artifacts, accounts, key-contexts, palette and plan
as targeted neighbors before mode-free task verification. The same
dated E-880 allowance rule applies to each new passing identity reaching 4 s.

`web/test/session-drawer.test.ts` owns the selected session → thread/card/composer
seam through sealed `webFixture`, fake Codex harnesses and public hub frames.
Keep both directions of cross-topic history, exclusive numeric page boundaries,
the exact older rows and live messages after a held history reply, and the reading
anchor. The reusable `SessionRecentThread` feeds the shared `Thread`; the existing
Inbox same-session/new-approval held-read regression must still pass. Session
selection refresh failures retry the recent page even after older history is
complete; retain the actual retry request and its held successful reply. Approval
drawers in Inbox forward the same thread controls: physical j/k focus exact recent
message ids and Escape returns to the selected approval row. Approval
answers retain the fake native receipt and folded human outcome; drive the fake's
post-answer state explicitly before asserting Waiting departure. TUI-only cards
have no controls. Composer routing is proven by the fake adapter's injected
message and topic, both for an item's topic and General. Arm focus observers
before physical Enter or Open thread and observe the exact log/row; no elapsed
frame wait proves focus. Shared composer/key routing changes also run composer,
topics, thread-runs and shell alongside area-slots, key-contexts, palette, inbox
and the Sessions files. Build first. New passing Web identities reaching four
seconds on any platform require a dated, reasoned E-418 allowance near 1.5 times
the worst passing sample, without relaxing assertions or request/DOM bounds.

`hub/test/web-notifications.test.ts` owns the T1 pure notification eligibility,
text and target seam, including all Inbox row kinds and pre-transition task layers.
`web/test/notifications.test.ts` uses sealed `webFixture` and fake sender frames
with `Notification`, visibility and focus stubs: hidden ask text/tag/click,
including an active secondary pane and open palette with exact ask-id row focus
while browser animation time is paused (mount is observed separately from focus),
visible+focused/off/watch suppression, snapshot no-replay, finished task/card
(including a split and open palette), shared per-browser Profile switches in
Accounts (Finished off after reload and cross-tab updates), palette action absence,
first-enabling permission and denied/revoked tooltips. Observe the exact Inbox
row, item card or completed-item count before absence/duplicate assertions;
watch-layer rows retain their exact browser socket receipt. No actual browser
notification, service worker, live hub or human browser is used. Build first;
run area-slots, key-contexts, palette, accounts and inbox as targeted neighbors before the
mode-free task verification. New passing Web identities reaching four seconds on
any platform need the dated, reasoned E-417 allowance at roughly 1.5 times the
worst sample; batch independent serial setup first.

`web/test/events.test.ts` owns the authenticated Events journal seam through
sealed `webFixture`, fake hub/browser clocks and Headless Shell. Literal local-day
labels, bounded 200-row pages and rendered ids prove paging; real `subscribe`
and `events.list` frames prove kind/warning/subject filters, including reload.
Peer `marks.get` and the exact `marks` push prove a visit's last look before the
Inbox zero assertion. Retain bookkeeping/coalescing facts, physical `za` and
subject navigation, including an artifact outside the first inventory page.
Hold an older-page or obsolete-filter reply before a live burst; retain every
coalescing replacement and the visible paging boundary, focused identity and
older rows after the receipt. The filtered subscription uses a separate cookie
socket so a split Inbox still counts events outside the filter. Keep the actual
rail target in the key regression: digits navigate, Sessions action keys remain
local, and focused Events rows filter. Run `session-launch.test.ts`,
`sessions.test.ts` and `shell.test.ts` alongside the named neighboring files
after changing shared context routing. The launch native-control regression
dispatches document Enter at focused Cancel, retains the unprevented receipt,
then observes native cancellation and a public session list with zero launches. Batch independent
serial setup before considering the dated E-417 Web-duration allowance policy.

`web/test/withdraw.test.ts` owns the authenticated thread → `topic.withdraw`
seam with a sealed `webFixture`, fake clock, in-process spoke and busy fake
adapter. Hold the successful receipt to assert shared pending state across topic
navigation, no duplicate writes and no early restoration; then retain the exact
restored text before newer typing, reload persistence and the fake's next injected
message with zero withdrawn inputs. A controlled busy→idle step proves the
injected stage removes Withdraw. For refusal, hold the outgoing withdrawal while
the fake takes the input, withhold its injected browser delta, then release the
real request: assert the hub's actual injected-stage refusal tooltip, unchanged
draft/message and later delta application. That race strips optional eligibility
to exercise an older hub. A two-recipient broadcast retains aggregate queued but
loses Withdraw after one recipient submits; history/reload retain false eligibility.
A visibility refresh held before submission is applied after its delivery delta;
the new layer must render without restoring Withdraw. A fresh refresh includes
current eligibility. Visibility replacements retain newer delivery/ask patches.
A single batched fixture covers older A withdrawn while newer B is pending and C
is typed: refusal and uncertain reload recover A/B/C, success keeps A/C, and edits
before/after the pending boundary retain order. No live hub or native harness is used.

`web/test/composer.test.ts` owns the authenticated composer → `topic.send` seam:
sealed `webFixture`, fake Coordinator and second in-process session, rendered
kinds plus peer frame history, default role addressing and the `@` session picker,
physical Enter/newline/command Enter, palette focus/draft retention and `~`
artifact chips. Artifacts from another topic or the archive are excluded; a
batched 101-artifact setup proves selection beyond the initial inventory page.
Per-topic reload and fresh-epoch disconnect checks retain drafts, disable offline
writes, and prove zero replay. The peer reads the exact sent message's `readSeq`.
Controlled browser time drives reconnect retries up to the existing retry cap and
handshake deadline, retaining the final Live assertion. A held real outbound send
crosses topic navigation; archiving its artifact before release produces an actual
hub refusal and restores text/chips before newer typing. A held successful receipt
retains the newer draft, and reload recovers uncertain text without a second send.
Pending state is checked
before release and the refusal receipt before restored-state assertions. No live
hub, real harness or human browser participates.

`web/test/inbox.test.ts` also owns the reusable approval-card seam (T-1129):
complete command and file-change subjects, session/harness/since, once and always
answers, attributed frame/archive outcome, optional denial notes and Escape's
no-answer boundary, Claude Code and adapter/payload fallback without controls,
and held native delivery with failure-to-pending and manual retry. The selected
approval drawer reads the session's recent messages through `session.history`;
retain the exact rendered message id, refresh on a different approval from the
same session, and hold the prior history result across that selection to prove
it cannot replace the new message. All use sealed fake adapters and the
authenticated isolated browser; no live hub or native binary is needed.

`web/test/inbox.test.ts` owns the four Now sections through the sealed
`webFixture`, a fake Coordinator sender, fake native approvals and authenticated
Headless Shell. Literal DOM assertions cover section order, counts, the five-row
cap and oldest wait, saved folds and controlled browser age updates. Request
decline waits for the fake sender's delivery and the folded outcome in its original DOM row;
message removal retains a peer Inbox read proving the other message survives.
Enter navigation loads an exact message older than the latest history page and
focuses it in the thread; the plan case waits for the rendered stage heading.
The empty Inbox's Events footer compares real journal rows and shared last-look
marks, including warning counts beyond the first 200 rows. Held successful
read/decline replies retain newer pushed Inbox rows/counts after the action's
pending marker clears. An older-than-five ask link reveals saved folds and
focuses the secondary-pane card while the primary copy remains mounted. Exact-id
approval recovery covers a peer answer while offline across a new hub epoch and
a real refused answer; a held archive reply cannot replace newer rows/counts or
a later same-id authorization delta. Approval controls use the native record's
choices and Neovim's keys; TUI-only rows have no answer controls. Existing
`asks.test.ts` retains multi-client winner, receipt, failure and reconnect checks.
`palette.test.ts` retains shell number keys outside answer rows and now expects
the handled Inbox navigation, reply, archive and removal actions in help.
The drawer test keeps row focus while following the exact message, exercises
Split/Close and sends a one-line physical `r` reply to the fake sender with its
original `reply_to` while the split remains open; bounded focus observers are armed before each `r`. A split native approval remains visible after another area takes focus, then follows same-id revalidation and the fake native peer's durable closed outcome, compared with fresh archive state. The existing older-than-history-page case also observes the
drawer's bounded scroll before Enter navigation. The visit test waits for the
exact ask departure and checks both area re-entry and focus into a non-Inbox
pane; completed rows and selection clear even while Inbox remains mounted.
The archive test blocks fake time across eight days (without replaying every
periodic tick), retains a recent answered outcome and excludes the older one,
then checks its footer below four empty sections. Browser clocks are controlled
where needed so incidental one-second thread read receipts cannot settle action
targets before the action under test. New passing Web identities need a dated,
reasoned E-417 allowance only if any platform's sample reaches four seconds;
batch serial setup before sizing it at roughly 1.5 times the worst sample.



`web/test/asks.test.ts` owns the shared ask-card seam through the sealed
`webFixture`, a fake Coordinator asker and authenticated Headless Shell contexts.
It covers physical option keys with a Cyrillic key value, thread and Inbox cards,
required decline reasons, free-answer failure/draft retention, pending/offline
write suppression, the Inbox link, context help and thread navigation. C2 mounts
Inbox and thread in two panes of a second independent cookie context against the
same hub; the observer is armed before answering, and the explicit one-second
criterion starts at the first browser's successful answer receipt. Final DOM
assertions retain the hub option, answerer and exact timestamp. C5 holds a real
outbound answer until a second context has won, withholds the winning ask delta,
then observes the actual refusal and the history-recovered fold. A peer hub read
proves the topic read mark reaches the ask without viewing its thread. Fresh-epoch
recovery uses the existing in-process hub restart and controlled browser clock;
it asserts disabled offline writes and zero replayed answers. No native harness
or live project participates. A second competing-client regression moves the
answer beyond the seven-day archive and more than 100 later messages, then
asserts exactly two one-row history reads, the winner's exact outcome and
unchanged newer Inbox rows/counts. The secondary-thread Inbox-link regression
keeps another copy in the primary pane and asserts destination list and focus.
The existing fold tests name the exact outer Inbox list and Fold Inbox button,
separately from its nested Asks and approvals fold. Existing held-history/live
Topics cases anchor asks by message id and assert the card's state attribute and
chosen outcome; question text disappears on folding. Their pagination, viewport
anchor, cross-pane persistence and zero-extra-read assertions remain intact.

`web/test/thread-artifacts.test.ts` owns the authenticated thread → inline HTML
artifact seam: the exact `artifact.url` reply as frame source, 240 px geometry,
the script-only sandbox, posted and live-attached pages, file/folder chips and an
unservable page's reason tooltip. The hostile script records its completed parent
document read and top-navigation attempts; observe that receipt before asserting
that both were refused and the workbench stayed put. Open full observes the new
page and no opener, while Open in a pane retains the thread beside a full-height
artifact older than the initial inventory page. Use the shared sealed Headless
Shell fixture with CSP intact. A public move delta after opening from the thread
must remove the top-level artifact row and list the child only under its folder;
viewer selection metadata must never repopulate the authoritative inventory.

`web/test/thread-runs.test.ts` owns the hub-history/delta → rendered run seam:
verbatim hub fold lines, click/Enter/physical `za`, inline expansion with the
original viewport anchor, sticky anchor geometry and collapse, and protected
ask/answer/verdict/human/Aide messages. A real new message frame supplies the
expected replacement fold line for both closed and open growth; no browser-side
count is an oracle. Context help/palette and native item-link Enter retain the
same production dispatcher. Use the shared sealed Headless Shell fixture.
Partial-run paging retains the first actual message's offset while the anchor
stays pinned. Controlled browser time proves that toggling without scrolling
reschedules the visible read mark; open runs exclude their offscreen tail, and a
closed anchor represents the last loaded member. The final peer read receipt
still proves hub application.

`web/test/messages.test.ts` owns the authenticated history/delta → rendered P12
message seam: headers, role gutters, human/Aide bands, watch text, recorded
verdict criteria, safe Markdown elements, whole-item navigation and artifact
chips. The shared isolated Headless Shell fixture retains CSP and observes
cleanup. Thread paging tests capture each message's actual pre-load offset,
including a date separator, and retain the final anchor assertion; tall read-mark
fixtures use Markdown paragraphs so their offscreen tail stays offscreen.

Message Markdown has a lower-tier seam: `hub/test/web-markdown.test.ts` (T1)
imports the pure `web/src/markdown.ts` parser. Literal contracts cover blocks,
inline tokens, configured whole item ids, message-local fences and hostile
HTML/images/URL schemes. No browser or hub fixture is needed for parsing.
Web typecheck runs `web/check-html.ts` (T0): seeded source fixtures exercise the
same AST guard that scans `web/src`, refusing named raw-HTML sink references
(`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`).
Renderers still need their own element/navigation/browser evidence.

Edge fixtures bind only loopback aliases. Revocation checks observe socket-close receipts after admission closes; no-follow filesystem regressions also prove an authorized read beneath a symlinked trusted ancestor on every supported OS (A-8634 R9; T-966, T-981, T-982, T-987, T-988, T-1042).

Standalone generated-asset and bundle consumers declare their build prerequisites and check them themselves, independent of prior files or shard order; use fixture-owned present/missing output directories and derive asset lists from shipped scripts and workspace metadata (A-8634 R11; T-955, T-978, T-1019, T-1023, T-1031; A-9063 R8 source T-1096).

`web/test/key-contexts.test.ts` covers T-1115 through the production shell: an
explicit composer field reserves its Enter chords while ordinary fields inside
a declared block keep native input; stand-in area selection, drawers and split
content remain intact; Sessions launch actions appear in help and palette alongside navigation, session
actions and archive;
and a handled Items palette action runs after modal focus restoration. The pure
resolver cases stay in T1 `hub/test/web-keymap.test.ts`. Existing shell, palette,
fold and Items Web tests retain their existing coverage.

`web/test/artifacts.test.ts` uses the same sealed hub/Headless Shell seam for
Mine/Kept/By role/Archived counts and saved folds, physical `k` versus ↑,
keep/unkeep with fresh hub inventory readback, human archive without deletion,
on-demand folder files, and three bounded inventory pages without duplicate ids.
Its opening cases assert the capability iframe's exact `allow-scripts` sandbox,
a script's direct parent-document/cookie denial, full drawer height and split
opening; capability text, named binary download completion, folder-child paths
and missing bytes; and HTML/SVG diagrams versus raw Mermaid source plus download.
Notes/prompts assert rendered Markdown, literal HTML and the source toggle's
native Enter. This topic follows thread opening and survives reload; physical
`s` preserves draft text, and public topic history retains the sent artifact.
Refusals retain the draft for archived/other-topic artifacts and no writable
topic. A split thread keeps an unfinished ask answer untouched while the shared
composer gains one deduplicated chip.
`area-slots.test.ts` holds capability reads across the artifact slot/identity
checks, so asynchronous file/download content cannot supply identity by accident.
The fixtures create all source bytes in the disposable root; no live project,
GUI browser or added hub process is used.
`hub/test/web-area-state.test.ts` keeps the lower-tier callback proof for live
artifact changes raced against a page and reconnect replacement.

`web/test/sessions.test.ts` owns the Sessions list seams against fake harnesses:
group/header counts, browser-only fold persistence, merged row facts and live
hold/request changes, full waiting commands and human-ask topics, visible-row
physical navigation, stopped/archived inventories and `gs` into a folded group.
Archive reads consume the additive hub-merged `session.list.rows` field.
The merged-facts case checks P22 geometry at 1440 px and P27's 52 px two-line
rows at a test-set 600 px viewport, including the pending command, hold/request
facts, page-only metadata and absent list actions.

`hub/test/web-verification-model.test.ts` is the pure T1 queue presentation seam,
using recorded sealed scratch frames in `web/test/fixtures/verification.json`.
`web/test/verification.test.ts` covers the Sessions verification line and in-place
queue with hand-run reservations in a sealed `projectHub`: physical Enter,
executor-status read per opening, no-frame ageing with the browser fake clock,
replacement receipt and browser-only fold persistence. It runs no suite worker
or real droplet. The explicit recording refresh is
`node --test web/test/record-verification.ts`; its executor and machine receipts
are fake, and its public executor-status read uses a second sealed scratch hub.

`web/test/session-actions.test.ts` owns Stop confirmation/cancellation, Resume
identity/role/claim retention, Archive, adapter capabilities and missing adapters,
the session page at desktop and narrow widths, and the fresh-launch brief after
unavailable resume. It uses sealed in-process fake harnesses and Headless Shell,
with CLI `session list` readback for Stop/Resume. The held fake Stop observes
adapter submission with a separate bound, checks duplicate Enter is inert until
the receipt, releases the gate in cleanup and retains the final stopped row.
The narrow-page case checks Stop cancellation, Esc back to the same focused row,
inert list action keys, Enter re-entry and archived-row return with the toggle retained. Failed actions retain the hub's reason.
No real harness or live hub is used.

`web/test/session-launch.test.ts` owns the inline launcher seam through the
sealed authenticated Headless Shell fixture: Aide defaults and Enter, role and
harness changes, selected-account model catalog visits, limited-account reset
refusals, physical keys and palette dispatch, pending duplicate prevention,
offline drafts and session-page routing. Setup waits for the enabled launch
action, which fences authenticated status and the role snapshot; form observers
are armed before shortcuts. A held initial role snapshot proves this readiness
boundary independently of the rail and connection label. The fake adapters receive all launches;
CLI `session list` proves the Aide role and project-root directory after the
Yours row appears. The item/brief case forwards the item and artifact id without
`cwd`; the no-territory fixture keeps its root, while the existing hub worktree
seam covers actual worktree creation. Model discovery replies are scripted at the
WebSocket harness boundary so no installed account or provider binary is probed;
all other frames reach the scratch hub. A held old catalog reply cannot replace
current choices. No real session or live project is used.

`web/test/item-criteria.test.ts` owns T-1078's three card-edit seams, one Web
case per criterion against one sealed scratch hub and Headless Shell. C1 adds,
edits and removes with `cland task view` readback, preserving other ids and
proving a removed id is not reused; fields exclude the `Ck.` label and refused
text retains its draft. Mixed legacy/explicit-id and retained high-water
fixtures keep id-less rows read-only until an Add receipt supplies persisted ids;
subsequent edit/done/remove CLI readbacks preserve the untouched row's id,
text and marks. C2 observes the rendered done receipt and reads the
`human` writer through the CLI, checking the outgoing frame has no `as` field.
C3 checks the available fields, read-only agents' text and inert `e` outside
the block, unchanged full item readback and absence of other item write frames.
Rendered acknowledgements are armed before actions and retain final assertions;
fresh contexts and observed browser/hub teardown use the shared fixture.

`web/test/items-actions.test.ts` owns the three Items interaction seams: selecting
three rows, switching to Board and sending one General message received by an in-process fake
Coordinator, creating and reusing a missing item topic, and scope/breadcrumb/back
navigation plus closed-item links. It uses the shared isolated Headless Shell
fixture, observes the actual message/DOM receipts before asserting, and checks
`gi`, `gt`, `gs` through the shared physical-code dispatcher. The marked selection
keeps its composer when the cursor moves to an unmarked row. A browser-edge held
summary reply proves that later area/row navigation survives after the loaded
lookup target appears in the palette; the Board cases retain later epic and All
tab choices too. A non-first epic selected in Tree remains the Board x/s target.
By-id summary pages
carry a complete compact tree row so closed links need no body fetch. Board
and Graph share the scope breadcrumbs and physical selection keys; item links
from either view open Tree to reveal their ancestor chain. The Graph interaction
case checks x/Shift-j, a selection quick message, Escape, s and back.

`web/test/plan.test.ts` proves T-1077 through one sealed hub/Headless Shell:
`a` approves a waiting plan and the real CLI reads approval by the human; changes
paint with the watch token, entry durably advances the shared mark and live
updates preserve the visit's earlier receipt; resizing below 1280 px removes
approval and makes `a` inert, including at phone width. The approval case also
checks stage gates, summary facts and the Lead-topic discussion receipt. A
Plan-first entry with done hidden proves a closed member is absent from the open
snapshot, loads its title/done/fraction/verdict through a bounded by-id summary,
retains a later closed-member delta and sends no body read for that member.
Opening through a selected live task and closing it under the same done filter
keeps the epic, mounted visit and closed-row facts without another marks write. Fresh
contexts isolate the criteria; browser and scratch-hub teardown is observed.

`web/test/graph.test.ts` proves T-1076's three criteria with one sealed hub/browser:
a Graph-first release loads a closed epic from its parent page and displays hub
progress/work and token done colours without reading that epic's children;
Tree/Graph round trips retain scope/filter/selection, node navigation selects the
matching tree row and card return restores focus; the source colour guard and
computed SVG paints retain the shared tokens. Cases use fresh contexts and
observe browser/hub teardown. The typecheck retains the token-only source guard.

`web/test/board.test.ts` proves T-1075's three criteria through the sealed browser
fixture: scoped Tree → Board → Tree retains filter and selection; release epics
retain hub done/total before closed-child pages arrive and unfold into status
sections; keyboard and mouse expose no rank/move action. Epic-tab narrowing keeps
the release's authoritative next. The final read-only task list retains unchanged
ranks and parents after inert rank chords and drag gestures. One hub/browser
serves the file, with a fresh context per criterion and observed teardown.

`web/test/item-card.test.ts` observes real Headless Shell DOM and outgoing frames
against a sealed scratch hub: ten selected rows send zero `task.view`, opening
agents’ text sends one body request, Enter/Esc/`h` preserves the tree row, and a
closed card reads by-id summary facts and refreshes on a task delta. Split/Swap
focus round trips and a closed container with an open verdict owner retain the
matching owner reason/round/scope through a real verdict delta. The hub's
T1 tracker-summary test checks compact verification and open/closed transport;
the copied-live Lua oracle retains the snapshot byte cap. Ordinary summary lists
omit card-only transport fields while snapshots opt in, and the native
`startup-budget.test.ts` keeps the 128 KiB limit with a tighter 120 KiB margin
assertion for the 1,000-item fixture.


`web-auth.test.ts` exercises liveness on an injected clock at T2 (30-second
ping, 60-second silence, incoming traffic renewal), binary close 4003, the exact
1 MiB UTF-8 JSON boundary and oversize close 1009, welcome build stamps and
protocol restart instructions, plus `terminal: 'none'` through `session.list`.
`web/test/connection.test.ts` uses the isolated Headless Shell to prove a stale
page reloads to the current digest and that protocol refusal renders **Restart hub**
without retries. Frame navigation and final live DOM state are separate receipts.

For human-only sign-in, session management and web authority policy tests, follow
[Browser sign-in fixtures](#browser-sign-in-fixtures).

Browser tests carry `Web` in `hub/test/tiers.json`, outside T0–T3, with a separate
4 s/test and 40 s/phase budget in `hub/test/durations.json` (report mode follows
the repository budget setting). The package runner reports actual phase wall time
separately from tier projections and keeps a 180 s gross hang guard. Web runs after
the hub phases with resource `machine`, two workers locally and four on droplets.
It keeps the suite's joint lease and never runs in load-gate repetition lanes.

A diff wholly under `web/**` selects `web-only`: all Web tests plus `HUB_SMOKE`
and `NVIM_SMOKE`. Other reduced modes include `web/test/smoke.test.ts`; protocol,
shared wire, web edge and mixed web/non-web paths force full. Queue-enabled task
runs keep Web beside all T1 and selected T2. Hub-owned merge batches exclude Web;
periodic dev (`dev-t3`), integrated, stage, epic, release and soak runs include it.
The candidate's `supportsWebPhase` runner capability adds a recorded Web command
to tier-based verification; other projects and older candidates retain their
commands. Close shards place Web with the shard that owns Neovim so it runs once.

`npm install` builds the bundle and installs the lockfile-pinned Headless Shell
in `node_modules/playwright-core/.local-browsers`. Use `npm run test:web:install`
to repair it (`-- --with-deps` for Linux system libraries). Never launch the
human's installed browser or normal profile. `npm run test:web` runs the selected
Web files through suite admission; `node --test web/test/smoke.test.ts` is a free
targeted file after `npm run build`. Crew full suites still go through mode-free
`cland verify` after source review. The root check builds once before verification;
the package runner checks the source receipt and builds once before workers only
when a hand run lacks a current bundle.

Prepared Ubuntu 24.04 executor snapshots include Headless Shell's Chromium runtime
libraries. Root cloud-init (`hub/src/executor/droplet/provision.sh`) installs them
before the non-root runner executes the project's prepare command. For this repo,
`verify-prepare.ts` runs `npm ci` on a cold image; its `prepare` lifecycle downloads
the lockfile-pinned shell into the checkout. The snapshot key includes the committed
`package-lock.json` SHA-256, so a changed browser pin invalidates the image.
After provisioning changes land, the Coordinator or human restarts the hub onto
that code and runs `cland executor prepare`: cloud-init comes from the running hub,
not the delivered task branch. A branch receipt on the old image cannot prove new
system libraries; collect a droplet Web receipt after that rebuild. Implementers
report missing image libraries to their item lead for this preparation.

Use `web/test/harness.ts`: one scratch `projectHub` and Headless Shell per file,
one fresh context per sequential case. The fixture mints a test-client `web.link`
frame, trades it through `/auth`, stubs `Notification` in an init script and keeps
CSP enabled. Poll with `pageUntil`/`page.evaluate`; retain the final DOM assertion.
Fixture setup and behavioural waits have separate bounds. All homes, profiles,
TMPDIR and Git state are scratch-owned, with filtered child environments.
Failures save trace ZIPs in ignored `web/test-results/`; publish them through
`artifact.create`. Teardown observes browser exit and an empty process-group
census, closes the scratch hub and its edges, then removes directories. The smoke
also proves context isolation, one-time links, same-origin fonts/requests, strict
inline-script CSP and trace/cleanup on a planted failure. See
[web/README.md](../../web/README.md#browser-tests).

The candidate's `web/test/prerequisite.ts` exports `webPrerequisite()` and returns
`{available: true, executablePath}` or `{available: false, reason}` without
launching a browser. For a missing executable or system library, the runner emits
"Web unavailable on this machine" and a structured `suite web phase` receipt
with `status: "not-run"` and the reason. It skips browser workers and continues
the other phases. Results retain `webPhase` in the durable job and result JSON;
an unavailable phase supplies no passing Web evidence and cannot be reused as a
green cache receipt. A broken or missing probe with Web selected is an error.
The probe checks the pinned executable and, on Linux, the shell and bundled shared
libraries with bounded `ldd` calls in a sealed scratch environment. It launches
no browser; the fixture launches exactly its returned executable.

`web/test/shell.test.ts` proves the rail/top-strip boundary through ordinary
frames from a disposable hub holding an ask and a busy fake session. It observes
rendered attention/title changes, manual and responsive 60 px collapse,
release/rail persistence, physical-code navigation with Cyrillic key values,
storage denial, and computed focus/hover/id layout. One browser and hub serve
the file; each case has a fresh context. `hub/test/web-keymap.test.ts` is T1:
the pure shortcut resolver keeps exact modifiers and browser-reserved chords
unbound. Neither file is a timing claim.

`web/test/folds.test.ts` proves chevron and physical left/right folding through
the rendered shell, reload persistence under the area's versioned local key,
zero outgoing fold frames, independent browser contexts/areas, synchronized
panes, retained preference fields, malformed state and denied storage. Its
mechanical `web/test/prose.ts` detector rejects visible text nodes ending in a
full stop or exceeding six words; planted header fixtures must fail while the
shell passes. Hidden text, title attributes, role tooltips and the marked `?`
help panel are excluded. These are Web checks, not hub persistence tests: folds
never enter the hub or Neovim's `ui.json`.

`web/test/items.test.ts` copies the tracker files into its disposable root before
starting `projectHub`, then observes the Items tree at 1440×900 in Headless Shell.
Deterministic additional rows retain stage groups, cell/proportional bars, rank
and ordinal facts, claims, holds, verdict rounds, category previews and archives.
CLI status mutations are fenced by the rendered changed row and ancestor meter;
the task keeps focus and selection when it moves. Folds, `D` and `A` persist in
browser-only preferences and are independent between contexts. A separate exact
300-item fixture asserts a completed `cland.items.rebuild` PerformanceMeasure
below 15 ms after a CLI delta: synchronous tree-model work only, excluding setup,
transport and React commit. The durable DOM assertions remain separate.
The test arms each affected ancestor observer before mutation, then retains its
final DOM assertion. It also checks verdict rounds after status/verdict deltas.
`web/test/items-order.test.ts` checks sibling ordering after a rank event followed
by ordinary rank/reparent file changes, using a separate seven-item scratch hub
with unchanged request/DOM bounds and authoritative sibling comparisons. The
copied-tracker fixture owns large-model coverage rather than adding an unrelated
full-tracker rescan to the ordering regression. The 300-item transition preserves every rebuild measure and compares
that buffer with an independently armed PerformanceObserver capture.

### phone-composer.test.ts

`web/test/phone-composer.test.ts` uses the sealed phone `webFixture` at 390×844,
touch/mobile Headless Shell and public frames with a fake Coordinator and busy
session. Keep the two rows of 44 px controls docked above the bar, default
Coordinator and session-chip routing, 44 px addressee clearing with implicit
hub routing and reload persistence, physical Return/Shift/Command newlines
with zero sends until Send, exact multiline/kind history receipts, and matching
palette keys without phone send/attach actions. The checked kind sheet remains
inline, reduces history by its occupied height and leaves history reachable
without a modal or scrim. Withdrawal waits for the held successful receipt
before restoring text ahead of newer typing; a test-controlled idle transition
removes Withdraw at submission. Per-topic text and kinds survive navigation and
reload without sending. Build first; run phone*, composer, withdraw, topics and
key-contexts targeted before mode-free verification. New passing Web identities
reaching four seconds need dated, reasoned E-880 allowances before verification,
at roughly 1.5 times the worst observed passing sample and citing its run.

### phone-disconnected.test.ts

`web/test/phone-disconnected.test.ts` uses the sealed 390×844 touch/mobile
`webFixture`, public frames and fake sessions. Stop and observe the scratch
hub’s closed socket before testing the phone strip, stable dropped-at and
last-applied times, countdown, immediate Retry and reset backoff. Observe each
failed real socket close before advancing its next timer; use
`reconnectUntilLive` for paused-clock reconnects. Wait for `data-phone` after
resizing before checking the desktop boundary. Keep the retained Inbox rows,
stale time, all disabled answer/reply controls and unsent reply label. A forced
offline submit sends no frame; after restart, compare the resume cursor, new
snapshot epoch, exact raised ask row and durable topic history, retaining the
draft and document identity. Never stop the live hub. Build first; run phone*,
connection, inbox, asks, composer and withdraw targeted before mode-free task
verification. New passing Web identities reaching 4 s need dated, reasoned
E-880 allowances at about 1.5× the worst sample, citing its run.

## Human marks fixtures

`web/test/topics.test.ts` uses the isolated Headless Shell and disposable
`projectHub` frame seam for topic grouping, browser-only group folds, a
300-message numeric history traversal and item links. It holds real history
replies while an ask is answered and a message arrives, then retains the final
ordered identities and prepend anchor assertions against fresh history pages.
A rejected earlier page stays failed after another scroll event; a later live
DOM row fences that event before asserting the error and absence of another
request. Explicit Retry followed by a held reply retains the old top message
and complete ordered identities. A real public resume request forces a fresh
snapshot across a held initial read: the replacement request must arrive before
the stale reply is released, and a later live DOM row fences that stale reply.
A held fake-adapter injection proves delivery-stage updates without another
history or topic-list read. Reconnect tests retain cached history during ring
replay and require a new history read after a restarted hub's snapshot.
Browser-controlled time proves the one-second read threshold; a controlled
document visibility boundary cancels incomplete intervals and keeps hidden
messages unread. A second frame client checks the hub's unread count, including
a viewport whose last visible message precedes the thread's end. These are Web
checks, with no native hub process or GUI browser.

The partial-viewport read case holds the outgoing read frame, checks the unread
count before applying it, then arms a second client's exact topic read-sequence
and unread receipt before release. The final list assertion follows that receipt;
observing only a browser-sent frame cannot fence another client's list request.
Topics also asserts its registered pane/page surfaces after area-module integration.
`hub/test/web-area-state.test.ts` retains topic and artifact visibility replacements
in one frame and asserts no inventory reads through the public connection callback.

`hub/test/human-marks.test.ts` proves cross-client monotonic events timestamps,
plan-history receipts and topic read positions through real frame clients. Its
persistence case stops and reopens `projectHub` in-process, retaining the exact
marks, topic position and one-time import receipt; it makes no OS-process
restart claim. `nvim/test/human-marks-component.test.ts` uses the headless recorded
stub and a second scripted frame peer for the Events visit, shared topic reads,
one-time legacy import and stale-copy cleanup. A held initial marks reply and a separately deferred preference write prove that startup without validated legacy keys makes no write attempt, preserving the original invalid-file notice. Peer marks updates must reach an
already connected editor, including a delta that precedes a held older
`marks.get` response. The Events visit observer starts before navigation and
waits for the exact peer-visible timestamp; cold-start replacement waits for
editor close and owned process-group disappearance. Its HOME/XDG/Git paths are scratch
and child launch applies the shared credential filter. Refresh its recording
slice and only other changed consumers with
`npm run test:nvim-fixtures -- --slice <test-file>`; startup mark frames have no
visibility projection context, so the same recording serves unchanged consumers.
The recorded mark merge calls the production function through the T3 recorder;
T2 never imports hub runtime code. `plan.test.ts` retains the native plan/restart
contract and reads receipts from the hub rather than `ui.json`.

## Connection snapshots

While client derivations or cross-client ports remain, retain an independent differential oracle (for example Lua against TypeScript), with a stated removal condition. Pair each delta-rebuilt row assertion with a fresh snapshot comparison, including hub totals while rows remain unloaded (A-8634 R4; T-979, T-1044, T-1061, T-1053, T-1052, T-1072, T-1058, T-1071; A-9063 R7 sources T-1075, T-1076, T-1056).

Pagination regressions include tied and backdated timestamps, traverse at least two pages, race a state change against a held page and retain the final one-row-per-identity assertion after replay (A-8634 R8; T-984, T-985, T-986, T-989, T-992, T-1046, T-1055; A-9063 R4; T-1073, T-1081).

`item-summary.test.ts` also proves card verdict reasons/rounds/scopes, Decision
previews and agents' text outlines through snapshots and mutation deltas, without
body/comment reads. Closing a task removes its row from the open snapshot; its final delta still
carries the compact closed row. Closing other rows removes card facts from their
snapshot and delta; a bounded by-id page restores them without a body/comment payload. Scoped
verdict history must not emit posted-verdict notifications on close/reopen; the
frame regression retains one genuine new-verdict subscription delivery. The
copied-live boundary asserts its measured items size at or below 50% of 1 MiB. Stage summaries and cover-settlement deltas retain complete
merged/total/status counts; closed tasks without landing receipts do not count
as merged. `progress-counts-component.test.ts` renders unloaded closed stage
members in the plan, explorer and card, then observes a stage-count delta. The
thousand-item startup guard includes card facts and preserves both the eight
reply budgets and the full 1 MiB items-snapshot cap.

`item-summary.test.ts` exercises summaries, provenance, roll-ups, claims/holds,
verdicts, topic activity and bounded closed-text pages through `projectHub` frames
at T2. It also retains the stage-only delta on platform-cover settlement and
checks next through closed-ancestor reopening and reparenting. The ordinary
mutation assertion retains only changed task/ancestor deltas; existing
logger diagnostics record which rows were recomputed. `item-summary-scale.test.ts`
uses 1,000 durable rows and bounds their three-row recomputation at 100 ms,
excluding setup, I/O, transport and freshness probes. This is a local synchronous
measurement, not a whole-request latency claim. T-1038's eight startup byte guards
remain in `startup-replies-scale.test.ts`.

`item-summary-lua.test.ts` is T3 because its independent oracle executes the real
Lua through headless Neovim. It copies every live tracker file into a disposable
project, adds a guaranteed closed-release/open-epic/planned-task regression,
recursively restores closed containers and tasks through bounded parent pages,
deduplicating retained ancestors by identity, then compares every summary
and the Lua roll-up rules with the snapshot plus bounded by-id closed-text reads, and asserts the copied items
frame fits 1 MiB.
It also feeds separate plan reads to Lua's stage selector. The dated E-880
allowance preserves this all-body differential guard. Neither the source tracker
nor the human's HOME, accounts or Git configuration is used for execution.


`item-summary.test.ts` tests parent cursors, limits, closed-ancestor retention and
the close-delta/open-set boundary through public frames. The recorded stdio stub
returns every closed kind on parent pages as well; its
legacy full-list scenarios retain closed container and question identities through
archive replacement. Its summary mode retains open rows and their ancestor
chain, including closed legacy parents. The many-closed-container forest asserts
a first-item reply at or below 120 KiB independently of task density,
complete release roll-ups, bounded container pages and nested task retrieval. A second client that
has never fetched closed pages observes an unloaded closed task's removal and
its authoritative done total, then compares a fresh snapshot. `nvim/test/closed-pages.test.ts`
copies the live tracker into a disposable project and renders 105 paged closed
children in a real headless explorer, board and card. It also keeps release counts
while a closed epic is unloaded, unfolds that epic and recursively discovers a
closed release/epic/task archive without duplicate identities. It is T3 for the real client
boundary. `web/test/items.test.ts` observes a 105-child page continuation, close
delta and reload through the real browser. Its separate 105-closed-epic fixture
asserts release progress before loading, container cursor continuation, nested
closed tasks, archived roots and unique rows after reload. A D-hidden regression holds closed
rows unloaded while asserting stage merged/state and global done totals, then
reopens a closed child and retains the final fraction/state assertions. New closed-page screen frames can be
recorded by naming their individual component file; regenerate existing Neovim
protocol/live fixtures with `npm run test:nvim-fixtures -- --from-recordings`.


Resume coverage adds `model-ring.test.ts` (T1 fake-clock age/UTF-8 byte bounds,
including terminal close after a late disconnect publication) and
`model-output.test.ts` (T1 stalled transport at exactly/past 4 MiB).
`connection-resume.test.ts` uses real Unix clients of `projectHub` for five
missed item changes, expiry/foreign-epoch snapshots, request-frame exclusion
from replay and two hub starts. `connection-resync.test.ts` uses a stalled
in-memory dispatcher peer for exact replay continuity and a real paused Unix
reader for the outgoing queue boundary. It also races a synchronous action
against replay and retains the final replay-then-live order assertion. Explicit
resume during another subscriber's fan-out also proves that replaced callbacks
cannot resend either the current or a queued publication. All
projects, homes, Git configuration and account environments come from the sealed
fixture. These tests add no hub child process. Clients resume from their last
applied cursor; a completed request after replay/drain fences preceding writes.

`hub/test/computed-sessions.test.ts` exercises the same disposable T2 frame seam
for authoritative unread/last-message values, `topic.read`, merged session
snapshots and row replacements. Fake time proves waiting age without timer-only
updates; the row carries approval command, account, usage, newest verifier hold
and +N, or accepted requested work. A later snapshot is compared with each
presence/process/rename/disconnect delta, and an ordered request fences the
single-row assertion. Snapshot-only subscribers also receive unmanaged rows and
removals; unknown identities remain separate by name. No new process is used.

`hub/test/connection-snapshot.test.ts` uses a disposable `projectHub` at T2 for
feature negotiation, the seven domain frames and end marker, legacy compatibility,
UTF-8 overflow fallback, and a model change raced against the first snapshot
frame. The observer is armed before the hello/change, and final assertions retain
the complete contiguous transaction and the later change receipt.
The same file proves numbered model continuity across tracker, topic, session and
inbox changes, slim task layers (including other items affected by a release
change), pin/mute row re-projection, and one serialization per feature set with
three clients. An in-memory dispatcher peer proves that a synchronous action
during fan-out cannot invert the order another client receives. These tests use
the existing frame seam; they add no process. `suite-queue.test.ts` proves with
fake time that elapsed timing does not republish a held queue, while holder and
waiter changes do and explicit reads keep current timing.
Pin/mute/toggle-off also compare pushed topic-owned artifacts with a fresh read.
A scratch pre-extension store with 401 affected older messages and unrelated
history proves attachment-reference backfill, complete affected-row delivery and
bounded wire chunks. The snapshot cursor equality uses `FakeClock` so a legitimate
coalesced inbox publication cannot race the no-number-consumed assertion.
The cross-topic move case compares old-thread creation chips with fresh history
through pin/mute/toggle-off of the destination topic.
`hub/test/snapshot-framing.test.ts` proves each domain cap and the exact-byte
boundary at T1. The wire conformance check keeps the browser leaf aligned.

For copied-live-tracker evidence, run
`node hub/scripts/measure-snapshot.ts /path/to/project/.cland/tasks`.
Only source files are copied; the tracker and hub open in the script's disposable
root with a filtered environment and fake Git/clock. The output labels other
domains as default scratch state and excludes setup/copy/transport from the five
compose/framing samples. Publish that output through `artifact.create` and name
the implementation head/tree and platform; it is a measurement, not a suite pass.


### Startup reply byte budgets (T-1038)

Count UTF-8 bytes at the consuming boundary, including framing, with a separate budget for every startup reply; keep the budget guard unchanged (A-8634 R5; T-963, T-1007, T-1010, T-1003, T-983, T-1037, T-1038, T-1045).

Before compacting a reply, inventory readers, count/wait assertions, QA brief waits and startup probes; use rule 19 for migration and capability landing order. Check budgets against a copied live tracker and synthetic fixtures varying closed-container density independently of task count. Add small probe-assertion fixtures for each retained state/kind and cover changed row kinds through both real stdio hub and recorded stub (A-8634 R3; T-1025, T-991, T-999, T-1027, T-1038, T-993; A-9063 R1; T-1088, T-1089, T-1091).

When expanding verification phases, prove the command plans are unchanged when no file is classified into the new phase; use rule 19 before dependent work is enqueued (A-8634 R3; T-1025, T-991).

The startup relay records exact UTF-8 JSON result frames, with envelope and
newline, for status, rules, General history, artifacts, open item summaries,
events, sessions and accounts. It retains the rendered completion assertion and
waits separately for the eight reply receipts. An oversized rule reply exercises
the per-reply failure guard without depending on an oversized item list.
`hub-status-component.test.ts` checks compact/default and opt-in historical
status, complete-message before-id pages, artifact cursor pages and all eight
budgets on a small durable fixture. It uses the smoke's shared pure byte guard,
including per-reply and total oversize controls. Timing still requires the
rendered Neovim receipt.

`startup-replies-scale.test.ts` retains the eight byte assertions on 1,000 tasks,
8,163 artifacts, 200 General messages and 200 event records. It also restores
1,645 completed suite receipts, 217 stopped sessions, four plans with 250 children
each, and 800 closed topics. T-1094 enforces deterministic work through the first
completed status socket reply, excluding fixture creation: one suite checkpoint
visits the 1,645 retained jobs once, at most four explorer recomputation batches
run, and all 1,004 item files are read at most twice each (the initial scan plus
plan validation). Native `readFileSync` and `readFile` observers are armed before
startup; the existing explorer log and `verification-checkpoint { jobs }` completion
log count work even when cached serialized snapshots avoid database writes.
The checkpoint receipt is emitted after its transaction and in-memory publication;
it counts jobs visited, not rows changed. Reintroducing per-stopped-session
`#save()` calls must fail the checkpoint count, independent of the machine clock.

First-status process CPU, wall time, work counts and named startup-step wall
durations remain diagnostic. The attempted fixed CPU budget failed on Linux at
10,558.0 ms CPU / 9,603.4 ms wall (A-9776), so it is no longer a performance gate.
A gross **30-second wall guard** catches startup hangs through the completed
status receipt; the 120-second whole-test watchdog bounds completion. Neither
is the computational scaling gate. Byte limits remain unchanged. These counts
guard the known save/recompute/read regressions; arbitrary CPU work or blocking
I/O inside a counted unit is outside them. The separate copied-state CLI
measurement retains its five-second end-to-end target.
Every restored plan must retain its children. This Coordinator-approved T3 scale seam adds no
native process; task verification defers it to periodic and integrated runs.
T-1039 removes the C-325 duration allowance after the expanded file ran in
2.768 seconds on local Darwin arm64; this is targeted local T3 evidence, not
a new Linux or integrated receipt. A-8181's original 6.636-second Linux T2 result
remains historical evidence.
At startup, unbranched non-ready tasks with retained verdicts skip readiness I/O:
the merge gate cannot promote them without a branch. A branchless `ready` row
still runs its check and demotes. `startup-ready-component.test.ts` observes both
filesystem boundaries and final frame statuses; `startup-replies-scale.test.ts`
retains the original durable-scale fixture and measures first completed status.


The recorded artifact screen file checks browser/palette page reads and General
archive continuation when byte-capped pages contain fewer than 200 messages.
It also opens older-page rendered centre/split folder-child views, holds detail
reads across reconnect and visibility reset, and proves both rendered/raw views
retain their artifact identities before those detail receipts arrive.

Status readers that assert completed-suite receipts, covers or harness launch
rows explicitly request `history: true` (`cland hub status --history` for CLI
checks). Cleanup waits do the same: finished jobs leave compact status, so an
active-only snapshot cannot prove that an owned run finished. Tests of compact
status and its startup budgets keep the default request. The merge gate, periodic
dev T3 and verification cache read the scheduler/store history directly.

For copied durable-state evidence, run `node hub/scripts/measure-startup.ts
/absolute/project/.cland`. Add `--cli` for the actual `cland hub start`, native
daemon and first `hub.status` socket receipt, with an enforcing five-second bound.
The default embedded run reports per-phase monotonic startup times and dispatcher
composition separately; its fake clock does not supply performance timings.
Both modes take a read-only consistent SQLite backup plus
copies of tracker, rules, roles, crew and journal into one disposable project.
Recoverable jobs and leases are removed; completed reported history and artifact
paths are rebased; process PIDs/account environments are cleared. Accounts,
configuration and adapters are scratch-owned. A fake hub clock prevents schedule
execution in the default run; CLI mode uses the isolated native daemon's real clock.
No source hub, artifact content or inherited credential is used.
The eight public dispatcher replies measure compose-to-receipt time separately
from JSON encoding/decoding; byte counts include the wire envelope and newline.
A serving receipt precedes requests, each has a 60-second bound, and a failed
request is recorded before continuing. Shutdown completes before root removal.
Publish the output as an artifact with head/tree and platform. This is diagnostic
measurement, not suite evidence; local runs require cover-quiet admission.


`hub/test/ask-outcomes.test.ts` covers E-413's answered asks at the T2 public
frame seam with `FakeClock`: C1 retains the chosen option, answerer and time in
live cards and later history; C2 compares the same outcome in the inbox departure
and archive. Both use a disposable `projectHub`. C3 uses the existing `startHub`
frame fixture without a journal, so an incidental journal projection cannot read
the inbox before its rapid free-text/stand-in answer. It observes exactly one
matching departure/archive outcome, then checks that the next inbox publication
does not repeat the departure. Observers are armed before answering. A T1 test
in `hub/src/hub/store.test.ts` proves option/free-text outcomes survive Store
reopen, without restarting a hub. These cases add no native process.


T-1059's decline cases in `hub/test/ask-outcomes.test.ts` use the same T2
public-frame seam: a fake Implementer's question is forwarded by the Coordinator,
declined by the human, and returned through `ask.answer`; the topic admits the
next question. Missing/blank reasons leave the ask open, and the thread,
departure and archive retain the declined reason, answerer and FakeClock time.
`nvim/test/declined-ask-component.test.ts` is T2: headless Neovim consumes only
recorded frames and asserts a single folded row with the reason on history and
live updates. Refresh only its recording with
`npm run test:nvim-fixtures -- --slice nvim/test/declined-ask-component.test.ts`.
The shipped-role wording regression and unchanged byte reserve run at T1 in
`hub/test/roles-clauses.test.ts`. A declined ask is a decision and never consent.
