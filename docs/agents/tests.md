# Running tests

The root `npm run typecheck` uses native TypeScript 7.0.2 for the hub's bin, src
and test files and Neovim's bin and test files, through their respective
`tsconfig.json` files. `npm run typecheck --workspace hub` checks only the hub.
The scripts use `hub/bin/typecheck.ts` to resolve the pinned `typescript7` npm
alias, including from task worktrees that inherit the root install. This avoids
the two compilers' shared `tsc` executable name. TypeScript 5.9.3 stays installed as
`typescript` because `hub/test/executor.test.ts` and
`hub/test/tracker-container-source.test.ts` use its compiler API, which 7 does
not provide. T-427 records matching diagnostics on both clean projects and
planted strict-option/import errors before the switch.

## Test levels (D53)

Every test has a level, and most belong lower than where they're written today. D53 (docs/spec/v0.1.4.md) makes this the project's top priority. The study is A-4143. The hub enforces declared tiers through `hub/test/tiers.json` and its manifest lint. Further tier import rules and per-tier budgets are landing incrementally. Implementers and Reviewers apply the level rules below by hand where enforcement has not landed, and a review that finds a breach records it as a finding.

| Tier | What it holds | What it may use | Budget per test |
| --- | --- | --- | --- |
| T0 static | typecheck, manifest and test lint | no test process | |
| T1 unit | pure modules, tracker, store, planners, hub rules in-process | a fake clock and in-memory fakes; no sockets, child processes or real time | 0.5 s |
| T2 component | a hub served in the test process (`projectHub`) with real socket edges; the CLI as a subprocess only when the CLI itself is the subject | an in-process fake adapter and a fake clock; no `startDaemon`, `spawnSpoke`, fake harness binaries or Neovim | 2 s |
| T3 integration | a curated set of real-process scenarios, plus true process-lifecycle files and one real-binary contract file per harness | anything | 10 s |
| T4 soak | load repetitions, long waits, macOS-only checks | anything | |

The target strategy is task verification at T0–T2, T3 once per merge batch and at stage, epic and release, and T4 nightly and at occasions. During the initial manifest migration, every run keeps its existing file sets and phases: T1 uses the serial hermetic phase, T2–T4 use the machine phase, and Neovim retains its package phase.

**When you write or change a test (Implementer):**

- Choose the lowest tier that can prove the behaviour, and state it in the file header or the test's comment. A new file is T1 or T2 unless its header names the process-lifecycle behaviour it proves.
- Wait on an event, a frame or a journal record, never on elapsed time. Timer behaviour uses the fake clock. A test injects one complete Clock for timestamps and scheduling, never a bare `now` callback. A new literal `sleep(n)`, a `setTimeout` used as a wait, or a `Date.now()` difference in an assertion is a finding.
- Prove persistence by reopening the store or tracker in-process, not by stopping and restarting a hub.
- Prove a hub rule once through one real frame per tool or refusal family. Its duplicates call the dispatcher or tracker directly. Don't repeat a hub-side rule through each harness's fake.
- A test proves one behaviour. A title with "and" twice is a finding. Permutations over inputs are a table inside one fixture, not a fixture per cell.
- A new duration allowance carries a non-TODO reason, an open owner item, and UTC `added`/`expires` dates at most seven days apart; it lands with the test.
- Before review, run typecheck and the touched files one at a time. Put each file's seconds into the review request.

**When you review a test (Reviewer):**

- Count `startDaemon(`, `spawnSpoke(`, `cland(` and `sleep(` in each new or changed test. For each one, ask which is the frame proof and why a lower tier can't prove the rest.
- A new file that spawns a process with no lifecycle sentence in its header, or a new wall-clock wait, is a finding of at least medium severity.
- Don't ask for a full run on a task head. A task verify plus the integrated cover (later, the merge-queue batch) is sufficient evidence.

### Named T3 scenarios

The ten scenarios below prove process seams once the rules are covered in T1/T2. Each is one manifest entry with tier T3 and a unique scenario name, one whole-file scheduling unit, at most 120 seconds of manifest test time, and at most one live hub. Headers name the flow, lower-tier rule coverage and the expected hub process starts. Other T3 lifecycle regressions and the three harness contracts remain separate. The target cadence is T3 once per merge batch and at stage, epic and release; this inventory does not change task admission policy.

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

Add a scenario only for a new flow across processes whose rules are already covered in T1/T2. Reuse existing steps and assertion meanings; add a header with those rule files and expected hub starts, a unique scenario manifest entry, measured duration and reasoned dated allowances. Record a declaration-to-step assertion audit and a spawn census; an extra hub start needs a lifecycle reason in the header. Run the entire file five times serially on the Mac at one-minute load below 15 and once through task droplet verification. Input and refusal permutations stay in the lower tiers.

HUB_SMOKE selects hub-lifecycle, startup-smoke and message-tracer. NVIM_SMOKE selects workbench, covering attach and the main views in one file.

### Test lint reports

`npm run check` runs typecheck, then `npm run test:lint` once. Verification uses
this check for candidates declaring it and `test:lint`; older candidate packages
keep their typecheck command. A matching host gate reuses the whole check on the
droplet, including the lint, so the report is not repeated there.

The lint currently reports only. The log, result and `cland verify --dry-run`
include `test lint (report only): <n> findings in <m> files`, the first twelve
findings with file, line and rule, and each file's lowest qualifying resource tier.
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
location. `test:lint` lists every resource path; verification dry runs summarize
resource kinds and show one highest-tier path per file to fit the protocol frame.
They never
change the direct-source `qualifies` value or policy findings used by admission
and the tier lint gate. The qualifying tier never automatically retags a file.
The legacy hermetic manifest admission still checks each test's own source only.

### Runtime tier resource report

The suite runner preloads a resource tripwire in each manifest-declared T1/T2
worker before loading its test file. It runs in ordinary package phases, explicit
manifest test targets and load-gate repetitions. T3/T4 workers retain their native
APIs. T1 reports child-process starts and socket listen/connect
entry points (including HTTP, HTTPS, TLS and fetch through the shared net boundary); T2 reports child-process starts. The documented `cland` and
`clandWithEnv` helpers exempt only their synchronous CLI launch in T2. Calling the
same CLI directly is still a mismatch; native Git/ps probes and fake harness
binaries are not exempt.

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

Hub rules use `projectHub(t, root, env, { harnesses: 'fake', probes: 'fake', clock })` by default,
with a `FakeClock`. It replaces Claude Code, Codex and OpenCode under their real
harness names, so `roles.toml` launch choices still work. The returned `fakes`
map exposes each adapter. `probes: 'fake'` supplies no-repository Git answers and
an in-process lock identity, so startup and teardown spawn no infrastructure
processes either. A test needing branch/provenance facts may override `git` and
`readBase`; a lock test may override `processes` (`alive` and `started`).
`serveProject` and legacy `projectHub` calls without this option keep native Git
and ps defaults, covered by the T3 lifecycle files. Import `NO_PS` only from
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

The fake harness **binaries** in `hub/test/fakes/{claude-code,codex,opencode}`
are reserved for one real-binary adapter contract file per harness and T3
scenarios. They are not the default for routing, roles, subscriptions or tracker
rules. Existing files migrate under E-677; new tests use the in-process adapter.

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

Use `projectHub(t, root, env?)` from `hub/test/harness.ts` for project tests by
default. Each test serves its own project through `serveProject` in the test
process, with normal discovery, Unix socket and WebSocket edges. Real CLI
subprocesses, discovering spokes and fake harnesses keep their production
protocols. Pass environment overrides to the fixture; never temporarily mutate
`process.env` for one hub. Teardown stops the served hub, disposes the fixture's
owned processes, then fails on surviving owned handles, timers or process
listeners, with `process.getActiveResourcesInfo()` diagnostics.

Hub scheduling tests pass one complete clock at the fixture boundary:
`projectHub(t, root, env, { clock: new FakeClock() })` (`hub/test/fake-clock.ts`).
`await clock.advance(ms)` runs due hub timers in deadline order and yields to
real I/O between callbacks; then await the expected frame or journal record.
The clock covers timestamps and hub schedules together, including heartbeat,
inbox notifications, archive/usage windows and retention. Use the same clock
for every time-dependent collaborator in a fixture. Bare `now` overrides are
refused; inject a complete Clock instead. A real-process fixture that needs
progressing native schedules may explicitly supply an offset real clock.

Do not mock global timers in a `projectHub` scheduling test: sockets, journal
flush and I/O retries, native transport/reconnect deadlines, AccountPoller child-process deadlines and suite
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
When an inherited-pipe writer cannot be verified, the result explicitly says
cleanup is incomplete, Agents and the inbox receive one warning, and the queue
is released. Unknown processes are preserved; exact fast-writer ownership is
the follow-up T-410.

Implementers run verification through the hub, one invocation at a time per session:

```sh
cland verify --report <item-topic> --to <reviewer-name> --to <your-name>
```

D29: task runs use the diff selection with no mode: hub-only, Neovim-only or full. Use `all` only when the selection or the Coordinator asks for a full run. Full suites are the Coordinator's integrated `dev` runs per batch of about three merges, at stage and epic close, and before release.

Task runs may report `hub-selected`: changed hub tests, tests covering the changed
functions, and `HUB_SMOKE`/`NVIM_SMOKE`. A changed hub source imported by Neovim
selects only the Neovim test files reaching it directly or through `nvim/test`
helpers, plus `NVIM_SMOKE`. Declaration-level `import type` and `export type` do
not create runtime dependencies. Inline type specifiers retain module execution
under Node type stripping, so those imports and re-exports still count.
Changes to `hub/test/harness.ts` or `hub/test/process-cleanup.ts` retain the full
Neovim phase. The report names the deciding functions, selected Neovim tests and
coverage artifact.
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

Close runs on integrated `dev` use `cland verify all --occasion stage|epic|release --report <topic>`. The Coordinator sets any occasion; QA may set `epic` for the epic demo. The hub requires the clean project-root `dev` head to match freshly fetched `origin/dev` and refuses other roles or task heads. The MCP `verify` request accepts the same `occasion` field. Ordinary batch and task runs use one slot. A local executor still uses one local slot.

Every `after-stage` stage, even with `qa.scope: none`, needs green integrated full-suite receipts at one verification tree from a Linux droplet `--occasion stage` run and a macOS local run. Non-none scopes additionally need a clear stage QA verdict on that tree. Per-item stage gates are unchanged. `task plan show` and stage-run results name missing platforms and the expected tree. Submit the missing run separately: the usual stage request for Linux and `cland verify all --occasion stage --executor local --report <topic>` on the Mac. Stage-request cache reuse preserves executor/platform; Linux stage evidence must come from a stage run (sharded, or the documented one-slot fallback). A completed stage retains its tested tree across later descendant builds while its plan and landing evidence remain valid.

A remote close run uses the free remote slots up to `[verification] shards` (default 2), balances hub files largest-first by `hub/test/durations.json` (unknown files use its median), and places Neovim on the lightest hub shard. Each droplet preserves the free/machine resource classes. Before creating any droplet, the hub atomically reserves every shard's lifetime cost in the shared spend ledger against the project's daily cap ($3 here). Fewer than two free slots or an insufficient cap gives one whole run on one slot and one warn notice, `sharding skipped: fewer than 2 remote slots free` or `sharding skipped: daily spend cap $3 would be exceeded`. Other executor unavailability follows the configured local fallback.

One result sums counts, labels failures by shard, and includes each machine, size, duration and cost, total cost, and wall time from admission through final collection. Each shard has a log artifact beside the merged log. A failed or lost shard fails the run without an automatic retry; cleanup must be confirmed before its slot is released. At $0.25/hour per c-8, two ten-minute droplet lifetimes estimate $0.0833 total (provisioning and cleanup count too); read the measured cost in the result. The identical tree/mode cache serves both ordinary and occasion requests; stage requests additionally match executor/platform and require stage provenance for Linux cache hits.

Before requesting review, fetch and merge `origin/dev` into the task branch, then commit and push the head to review. Request source review first. Only after a clear source verdict, run `cland verify` at the exact reviewed head. A fix or later merge that changes the head needs a new source review before a new run. The Reviewer settles the final verdict when the same-head result arrives; source-only criteria may be verified earlier, while run-dependent criteria stay unverified until then. The CLI prints the run id, worker PID (null while queued) and hub queue position, then exits. Go idle: the hub delivers one result with the exit code, test counts, failures, branch/head and durable log artifact.

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

The worker survives the caller's shell exiting. The hub keeps its run record across restart; a killed worker produces a result naming the signal while the hub is live, or a missing-exit-receipt crash report after restart. A permission change can hold reporting: `cland hub status --json` exposes pending runs and their reporting error; restoring permission lets the hub retry without duplicating a committed result. A recipient hygiene refusal holds the whole result until every intended recipient is admissible, so a partially muted recipient cannot lose its report.

Omitting the mode selects phases from the branch diff against freshly fetched `origin/dev`, including working changes. `all` or `--all` forces full only for the Coordinator, the human shell or an authorized `--occasion` request. Other sessions receive `verify-all-reserved` with the automatic diff selection and no queue entry. A flaky-gate second receipt is another ordinary diff-selected verify, with no mode. Integrated `dev`, shared or ambiguous changes, empty diffs and fetch failures run full. A package-local diff runs that package plus the cross-package smoke baseline; `hub` and `nvim` reduce only matching qualifying diffs. The duration line and report include the mode, reason and deciding files. See [phase rules and smoke baselines](../../hub/README.md#tests). Each run first executes `npm run typecheck`, then the package test script from the calling worktree. `--report` names the result topic; repeat `--to` to name recipients. With a session name in `--report`, the hub uses the caller's claimed item topic and addresses that session. Reporting uses the caller's stable session identity and current artifact/send permissions; an Implementer needs its own item topic or a topic with a delivered request.

The hub persists the request, exact head, item, diff selection, enqueue time and priority in its database before acknowledging it. Admission gives the Coordinator's integrated dev requests first priority, then human `npm test` waiters in enqueue order, then the item rank captured at submission, then other requests in enqueue order. The local slot admits one run; `[verification].remote_budget` admits parallel
droplet runs beside it (a positive integer, 4 by default; this project's D27 build value is 2). The scheduler walks the
ordered queue past waiters whose slot is busy. Remote acquisition reserves a slot
through confirmed release and each acquire checks the shared daily spend cap.
When remote slots are full and the local slot is free, a default droplet request with
`local_fallback = true` falls back
locally with a warn notice naming `remote budget <n>/<n> full` and a
`verification-executor-fallback` record with cause `remote budget full`.
An explicit droplet request, or a default droplet request with `local_fallback = false`,
remains a remote waiter, including when preparation
or unconfirmed cleanup holds the remote budget; later local requests can proceed.
The hub persists a finished remote run's outcome and collected log before cleanup.
Its final result waits up to 120 seconds on the hub Clock for confirmed lease
lifetime and cost. If release stays unconfirmed, the result marks accounting
"pending confirmation"; the executor sweep retains its remote reservation and
retries cleanup. Once the durable lease confirms release, the hub posts one
accounting correction in the same topic. Restart resumes from the saved outcome
without polling the deleted machine and retains the wait window/correction state.
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
`hub status --json` includes per-run wait/run timings and median/p90 over the last
20 completions. Cache hits record zero timing; executed-run estimates use recent
successful durations for the effective mode and executor. Remote durations
include acquire time; remote holders do not delay local waiter estimates. Unknown history gives a null ETA.

A green run may be reused for the identical committed candidate tree and effective
mode. The candidate excludes only `.cland/tasks`, so tracker-only dev merges hit;
other paths and dirty working changes do not. `--fresh` forces execution, and
`[verification].cache_max_age_minutes` defaults to 1440 (0 disables reuse). Hits
name the requested head, original run/head and tree hash and post once as usual.
An explicit `--executor droplet` reuses only a green that ran on a droplet. A
local-only green triggers a fresh remote run, with the reason in the result
header and log. Omitting the executor flag preserves cross-executor reuse even
with a droplet default; `--executor local` also keeps cross-executor reuse.
Cache hits retain their original executor and platform.
The Reviewer still verifies criteria at the requested exact head using that
result; a cached result never revives an old criterion mark automatically.

`[verification].budget` in `.cland/config.toml` defaults to 1. Values above 1 log `verification-budget-capped` and use 1. T-215 keeps this conservative budget after classifying only five files as hermetic; process-heavy overlap remains disabled. `cland suite` remains an alias, including cancellation.

The compatibility shim retains `/tmp/cland-suite.lock` and `/tmp/cland-suite-nvim.lock` for hand-run `npm test` and pre-V1 branches. A holder or earlier live legacy ticket blocks local admission; droplets use their own machine's locks. The local worker atomically takes both leases before typecheck to cover a racing hand run. A V1 package runner borrows that verified lease and publishes its per-run recovery record in `<lock>.runs/<token>.json` through every shard; a pre-V1 package runner takes its own legacy lease after protected typecheck. A queued head change cancels the request; successful results keep the submitted exact head. The merge gate's rules are unchanged.

The underlying package scripts remain available for humans and isolated CI:


- `npm test`: automatic phase selection; `npm test -- --all` forces full.
- `npm test --workspace hub` and `npm run test:nvim`: request the matching reduced mode, widening to full when the diff does not qualify.

`hub/test/tiers.json` declares every `hub/src/**/*.test.ts`, `hub/test/**/*.test.ts` and `nvim/test/**/*.test.ts` file in one path-sorted `tests` map, with `version: 1`. Add a new path at its sorted position in that map in the same commit as the test. Choose T1 (unit), T2 (component), T3 (integration) or T4 (soak) using the levels above. An entry is a tier string, or a T3 descriptor with exactly one nonempty `contract` or `scenario` string, for example `{ "tier": "T3", "contract": "codex" }`. Fixture/tool writers use `serializeTierManifest` from `hub/src/suite-shards.ts` to keep path order.

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

The hermetic T1 phase runs on one worker; hub T2–T4 and Neovim use `[verification] workers` (default 4), with `[verification.droplet] workers` overriding it on droplets. T4 currently runs wherever T3 does, and close-run balancing still treats each hub file as one job. `cland verify --workers N` overrides either policy for one durable run; `--size <slug>` overrides a droplet size with provider availability and spend checks. Use `--fresh` for timed comparisons, because cache reuse otherwise requires matching worker counts and size overrides. Only machine phases take `<lock>.machine`. Suite reports include shard durations, machine wait, total wall time, compatibility wait and hub queue wait. Local process-heavy overlap stays disabled.

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

`hub/test/durations.json` also declares tier budgets in `budget.T1` through
`budget.T4`:

| Tier | Per test | Per file (top-level test-seconds) | Projected wall |
| --- | --- | --- | --- |
| T1 | 0.5 s | 10 s | 120 s |
| T2 | 2 s | 30 s | 480 s |
| T3 | 10 s | 120 s | 900 s |
| T4 | none | none | none |

Tier budgets check every observed identity, including known baselines and files
missing from the duration manifest. Missing files are named with their observed
seconds. Logs keep the complete `budget (report only): would fail …` list;
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

D53's report-only period lasts one week after `tiers.json` lands. These tier
and ratchet diagnostics cannot change an exit status. T-716 (C-07) switches on
enforcement after that week. Until then, the existing new-identity gate below
remains active unchanged.

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
reasons, missing or closed owner items, invalid dates, expiries more than seven
days after `added`, and expired allowances (expiry is midnight UTC). Ownership
is checked in the live authoritative tracker, including linked worktrees.

By the Coordinator's D53 exception, pre-existing allowances retain every reason
and second, carry `legacy: true` with owner `E-677`, and have no calendar dates.
They expire when E-677 closes. New allowances must use the seven-day fields;
`legacy` is reserved for that one migration. Reports show the legacy allowance
count and sum of seconds separately, so E-677's progress is visible. Refresh
preserves ownership, dates, legacy metadata and the T3 allowance without extending
expiry. Missing manifests disable the budget and its reporter.
Known entries never fail the duration budget. Those over budget always produce a
`duration regression` notice annotated `over budget`, even when flat or faster.
Those under budget report when at least 1 second and 50% slower than their
baseline. Both kinds share a five-line cap, ranked by seconds over baseline.
The suite result includes these notices, budget failures, and `suite budget overhead <ms> ms` for
the runner's self-measured loading, bookkeeping, checking and reporting work.

At each stage close the Coordinator runs
`npm run test:durations -- <latest-green-integrated-log-artifact-path>` on `dev`
and commits the refreshed manifest. `node hub/test/durations.ts refresh <log>…`
accepts several logs (newest last), takes per-test medians, sums file test-time,
preserves reasons and drops tests absent from the newest log. It reads the durable
`suite timing` records or older top-level spec timings with start/source title
mapping. Refresh writes a `TODO` allowance only for an over-budget identity absent
from both its previous baseline and `allow`; replace it before admission.
Reasoned entries stay, and a known entry that becomes slow only updates its
baseline seconds.
Keep artifact ids and the source head in `source` so timings remain traceable.

Task-branch verifies have a **load gate** for each top-level `file::test` identity
missing from the duration manifest's `tests` baseline. As the phase discovers
new names, `[verification] load_gate_workers` parallel lanes (default 2) repeat
each identity five times in fresh Node processes with an escaped, exact `--test-name-pattern` on the file, alongside the ordinary
phase. Known names and integrated `dev` runs, including sharded close runs,
receive no repetitions. Each lane finishes all five repetitions of one identity
sequentially before taking another; the gate never drops repetitions to meet a
wall deadline. Its worker count is included in the log and run report. Increasing
it trades wall time for load, independently of ordinary phase workers.
An `allow` entry permits duration; only the stage-close baseline refresh makes a test known to this gate.
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
The thread differential oracle uses 2 seeds × 12 renders on the merge path and
4 × 25 with `CLAND_TEST_SOAK=1`. The shipped QA walk, orphan performance cases,
and hub harness self-tests are T4; any `hub/test` helper diff retains the full
hub selection, including those self-tests. Each phase's existing discovery sweep reports bridge counts before and
after cleanup and fails if a phase candidate survives, preserving ambiguous processes.
For old orphans use `cland doctor` to inspect and `cland doctor --fix` to sweep only
the calling user's verified bridges whose explicit hub file is missing. An existing
hub file, ambiguous argv or unverifiable identity prevents cleanup. Doctor fixtures
scope both deleted hubs and bridges with `CLAND_TEST_ORPHAN_ROOT`.

## Cover-quiet

Before fixture setup, the hub and Neovim test harnesses ask the project hub for
a read-only `suite.slot` check. When an integrated cover holds the local
compatibility slot, an unrelated test exits with `cover-quiet` and the run id.
Wait for that cover to release the slot. Its own workers pass with the matching
inherited lease; remote covers do not occupy this machine's local slot. Without
a project hub there is no refusal. A connected hub must answer: a timeout or
disconnect fails startup before fixtures. Discovery follows `CLAND_HUB_FILE`
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
