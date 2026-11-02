---
id: E-1531
kind: epic
title: The Host interface and the local host
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1315
branch: null
created: 2026-10-31T18:22:03.207Z
updated: 2026-11-02T05:41:32.579Z
---

## Goal

Everything the hub does to a session's files and processes goes through one Host interface, and today's behaviour becomes its first implementation, the `local` host. After this epic the adapters, the worktree code and the artifact path reads no longer touch the hub's machine directly: they ask the session's Host. A remote host can then be added in "The SSH transport, the host agent and git through the tunnel" without touching the adapters again. Nothing changes for the human: every session still runs on the Mac, and every existing test still passes. The host prototype showed which operations the interface needs, and that Codex's sandbox roots and item branches were tied to the hub's machine (Q-1517, decisions 8, 9, 15 and 16).

## Contents

- **The Host interface** (spec §3.1). The operations: spawn a detached process with an environment and a working directory; liveness and stop of a process by its birth identity; the host's process table with memory and CPU per process tree; stat of a working directory; `git worktree add` and `remove` with the root `node_modules` symlink; read a file's bytes by path; "who stands inside this worktree"; limit polls; and a realpath, or sandbox-root, operation. Demo: a contract test suite exercises every operation against the `local` host.
- **The `local` host** (§3.1). The in-process implementation that carries today's behaviour. The adapters (`hub/src/adapters/sessions.ts`, `claude-code.ts`, `codex.ts`, `opencode.ts`), the worktree code (`hub/src/hub/worktrees.ts`, `hub/src/territory.ts`) and the artifact path reads (`artifact.create` with a path, `artifact.upload`) call only through it. Demo: the full suite is green with every caller moved behind the interface, and a grep of the adapters finds no direct `spawn`, `kill` or `stat` of a session's process or directory.
- **The `host` column** (§3.1). `harness_processes` gains `host`, `local` for every existing row, migrated in place. A remote row's liveness, stop and signals are routed to its host only, and checked by a Linux birth identity (boot id plus process start ticks); no pid of a remote row is probed or signalled on the hub's machine. Demo: a row marked with a test host is never probed locally, even when its pid matches a live local process.
- **The realpath operation** (§3.1). Codex's sandbox roots, and any path the hub hands a harness, are computed by the session's Host. Demo: a Codex launch on the `local` host gets the same sandbox roots as before, read through the operation.
- **Item branches in the territory** (§3.1). An item launch creates its task branch `t/<id>-<slug>` in the territory from `dev`, and the session's Host adds the worktree from there, instead of creating a local worktree first. Demo: on the `local` host the branch and the worktree are as before, and the branch exists in the territory before the worktree.
- **Claude Code found once** (§3.1). On a Host, one `claude agents --json` at launch finds the worker; no short-lived `claude` command runs on a timer. Demo: the contract test counts one discovery call per launch for a host other than `local`.
- **Coordinator and Aide stay local** (§3.1). The hub refuses any placement other than `local` for the Coordinator and the Aide. Demo: a launch of either with a test host is refused with a reason.

Not in this epic: the remote host and its transport ("The SSH transport, the host agent and git through the tunnel"); pools and the `[<role>.launch] pool` key ("Pools, placement and the scheduler"); limits on remote hosts beyond the interface's operation.

## Order

1. **The interface and its contract tests.** The operations as a type, with the contract suite run against `local`. Demo: the contract suite is green on `local`.
2. **The adapters behind it.** Spawn, liveness, stop and cwd checks of all three harnesses through the Host. Demo: the full suite is green.
3. **Worktrees, artifacts and realpath.** Worktree add and remove, "who stands inside", artifact bytes by path, sandbox roots. Demo: a task launch, an artifact by path and a Codex sandbox all read through the Host.
4. **The `host` column and remote rows.** The migration, routing by host and birth identity. Demo: a test host's row is never probed locally.
5. **Item branches in the territory and the local-only roles.** Demo: the branch exists in the territory before its worktree; a Coordinator launch with a test host is refused.

## Definition of done

QA runs the demo below on `dev` through the hub's frame protocol and the `cland` CLI against a temporary project, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real provider, droplet or key is involved.

In a scratch project QA launches a Claude Code, a Codex and an OpenCode session, an item session included, and checks that each runs as before: its worktree, its sandbox roots and its liveness. It reads the task branch in the territory before the worktree appears. It creates an artifact from a path inside a session's worktree. It inserts a row on a test host whose pid matches a live local process and checks that the hub never probes or signals it locally. It tries to launch the Coordinator with a test host and reads the refusal. It reads the contract suite's report for the `local` host and the green full suite.

- [ ] C1. Every operation of the Host interface has a contract test, and the `local` host passes them all.
- [ ] C2. The adapters, the worktree code and the artifact path reads act on sessions only through their Host, and sessions of all three harnesses behave as before.
- [ ] C3. `harness_processes` has a `host` column, existing rows read `local`, and a remote row is never probed or signalled on the hub's machine.
- [ ] C4. Codex sandbox roots and other paths handed to a harness come from the Host's realpath operation.
- [ ] C5. An item launch creates its task branch in the territory before its Host adds the worktree.
- [ ] C6. The hub refuses a placement other than `local` for the Coordinator and the Aide.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. No new runtime dependency.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fakes in `hub/test/fakes/` the second. This epic is a refactor: the full suite stays green at every merge, and no behaviour a human can see changes.
- **Liveness.** The birth identity guards against pid reuse as `pid_started` and `pid_identity` do today; never weaken the local check while adding the remote one.
- **ADRs.** 0003 (the hub owns the harness processes through adapters): the adapters keep that ownership, through the Host. 0004 (the territory): branches are created there.
- **The prototype.** `prototype/agent-host` at 7f7ecb0f is never merged. The build may read its code (the `harness_processes.host` column and the `rowAlive`, `processAlive`, `sameProcess` and `endProcess` changes marked `PROTOTYPE (Q-1517)`) and take what fits, but follows the spec (Q-1522).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** First in the hub lane. "The SSH transport, the host agent and git through the tunnel" follows it, and "Shape-B readiness" may start once it closes.

## References

- Spec: `docs/spec/v0.4.md` §3.1 (the Host interface and the local host), §3.13 (hygiene) and §4 (the cut).
- Items: R-1530; the map M-1511, round 2 decision 1 and round 1 decisions 2 and 9; Q-1519 §7 to §9; Q-1517 (decisions 8, 9, 15 and 16).
- Prototype, on `prototype/agent-host` at 7f7ecb0f: `hub/src/host/README.md` ("Hub changes outside this folder", decisions 8, 9, 15 and 16), the hub changes marked `PROTOTYPE (Q-1517)` in `hub/src/adapters/`.
- Code: `hub/src/adapters/sessions.ts`, `processes.ts`, `claude-code.ts`, `codex.ts`, `opencode.ts`, `session-cwd.ts`; `hub/src/hub/worktrees.ts`; `hub/src/territory.ts`; `hub/src/hub/artifacts.ts` and `artifact-upload.ts`; `hub/src/process-identity.ts`; `hub/src/executor/executor.ts` (the interface style to mirror).
- GLOSSARY: Host, Session (amended for v0.4); Adapter, Territory, Task branch.

## Plan

```yaml
stages:
  - name: the Host interface and the sessions layer
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1542
        - T-1543
        - T-1544
  - name: adapters, worktrees, artifacts and the host column
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1545
      - - T-1546
        - T-1548
      - - T-1547
      - - T-1549
        - T-1550
      - - T-1551
      - - T-1552
        - T-1553
  - name: routing by host, the territory branch and the boundary
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-1554
        - T-1556
      - - T-1555
      - - T-1557
```

## Comments

### qa-678 · 2026-11-02T01:54:35.547Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-s2-2026-11-02-qa678-1
commit: 6fe6289c98a43c2c1153414528b6821907ff84f6
stage: adapters, worktrees, artifacts and the host column
stage_hash: 61374d1cc472715d817e642e92b6343776594899064fb167df7047631a79e6cf
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Result | Evidence |
| --- | --- | --- |
| S0 | PASS | S0.txt |
| E1531S2-00 | PASS | E1531S2-00.txt |
| E1531S2-01 | PASS | E1531S2-01.txt |
| E1531S2-02 | PASS | E1531S2-02.log |
| E1531S2-03 | PASS | E1531S2-03.log |
| E1531S2-04 | PASS | E1531S2-04.log |
| E1531S2-05 | PASS | E1531S2-05.log |
| E1531S2-06 | PASS | E1531S2-06.log |
| E1531S2-07 | PASS | E1531S2-07.log |
| E1531S2-08 | PASS | E1531S2-08.log |
| E1531S2-09 | PASS | E1531S2-09.log |
| E1531S2-10 | PASS | E1531S2-10.log |
| E1531S2-11 | PASS | E1531S2-11.log |
| E1531S2-12 | PASS | E1531S2-12.txt |
| E1531S2-13 | PASS | E1531S2-13.txt |
| E1531S2-14 | PASS | E1531S2-14.txt |
| E1531S2-15 | PASS | E1531S2-15.txt |
| E1531S2-16 | PASS | E1531S2-16.txt |
| E1531S2-17 | PASS | E1531S2-17.txt |
| E1531S2-18 | PASS | E1531S2-18.txt |
| E1531S2-19 | PASS | E1531S2-19.txt |
| E1531S2-20 | PASS | E1531S2-20.txt |

Clear — E-1531 stage "adapters, worktrees, artifacts and the host column".
Run qa-s2-2026-11-02-qa678-1 at 6fe6289c98a43c2c1153414528b6821907ff84f6. All nine stage members landed. Clean detached worktree; HEAD/dev matched before and after. No epic criterion marks. No blocking findings.

All 543 tests across 46 named files passed, with no failures, cancellations or skips. Each file ran separately and sequentially, with quiet admission and an enforced one-minute vm.loadavg <10 gate; load and free disk readings retained in each TAP log. Required literal titles were checked in source and on passing TAP lines; generated Host contract and coordinator/aide launch/relaunch/fresh-resume/set/move cases also passed. test-summary.json contains counts and full generated names. The macOS synthetic Seatbelt Git test executed rather than skipped; it proves scratch Git path access, not native Codex enforcement or Linux parity.

The scratch hub launched and stopped all three fake harnesses on local with darwin identities and live/dead process observations. Task T-5 received the expected branch/worktree and root node_modules link; pruning kept it while qa-wt stood inside and removed both directory and branch after stop. Binary, folder and relative artifact paths copied byte-for-byte, missing source was refused, and these operations did not touch t1. Local host rows omit the host field from session list as specified. Unknown hosts and nonlocal Coordinator/Aide placement were refused. Restart without CLAND_TEST_HOSTS made t1 unknown. Cleanup stopped the hub, found no surviving registered fixture PID, and counted zero processes naming the scratch root.

Diagnostic note — E1531S2-18: the Implementer launch on t1 returned ok:false, code invalid-cwd, error `launch cwd "<scratch>/p1" is not an accessible directory`. The actual unaltered error is in E1531S2-18.txt. The operation window is exactly ["t1:statDirectory"], with no local operation, no spawned process and no row for qa-impl-t1. Per brief lines 407 and 416, the inferred error wording is not the pass condition: judge t1 reached, nothing local, no row. Coordinator message 08f8e3c7-f5be-46af-b266-62d89553df63 explicitly confirms that interpretation and is filing the diagnostic gap separately. Source sessions.ts:1135–1137 catches the statDirectory refusal and translates it to InvalidLaunchCwd; requests.ts:148 returns invalid-cwd. This does not fail the scoped routing check. No code was fixed.

Platform: local macOS Darwin arm64, Node 24.21.0. No browser, GUI, real harness, provider or account used. Full T3/T4 suites, soak and cover pair were out of scope and not rerun in this QA pass. Stage cover receipts were supplied separately: Linux 327a36bd (A-15512), macOS e2010a1c (A-15516), tree f2462b2831f03da4554b20ce4c70749e957a3396. No timing or benchmark claim; no droplet lifetime/cost for these local checks.

Evidence excludes scratch HOME, environment exports, secrets and raw process census. Shared assertPublishable scan passed with a positive control. All scratch commands used the brief's shared fixtureEnvironment; inherited credentials and Git controls were stripped, with only the documented synthetic CLAND names retained. Evidence and recorded case lines were saved before the verdict.

Evidence A-15518: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15518-e-1531-stage-2-qa-clear-6fe6289c/report.md

### qa-678 · 2026-11-02T05:41:32.579Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-s3-2026-11-02-qa678-1
commit: c14994a248fee18f1affcc4e49e2c67288f91dfe
stage: routing by host, the territory branch and the boundary
stage_hash: 47094421c2e2d32645f4232c5ec57679507efd5b3e5d94967435472fdf09bb73
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-1531 stage 3 — QA clear

Stage: routing by host, the territory branch and the boundary. Run `qa-s3-2026-11-02-qa678-1` at `c14994a248fee18f1affcc4e49e2c67288f91dfe`. All 25 setup/check rows pass; no product findings. The clean detached HEAD and root dev matched the request before and after; all four stage members have landings and stages 1–2 are closed. No epic criterion marks.

Platform: local macOS 27.0.1 (26A434), Darwin arm64, Node 24.21.0. No browser binary, GUI, real harness/provider, remote executor or droplet used. Every scratch command used the brief's shared fixtureEnvironment, with scratch HOME/XDG/Git and credential filtering. Credentials count zero and only the expected synthetic CLAND variables were present.

The named-file phase ran **735 tests across 62 files**, serially, with no failures, cancellations or skips. Literal required names matched source and passing TAP; generated Host contract, routing, restart/abandonment, prune/divergent-tip and coordinator/aide placement cases were checked separately. Full names are in test-summary.json, source loops in generated-test-source.txt. Each file retains enforced quiet-queue and one-minute vm.loadavg below10 admission plus free disk readings; no timing benchmark or whole-suite wall-time claim. The macOS Seatbelt test executed; it proves synthetic scratch Git access, not real Codex sandbox enforcement or Linux parity.

The separate planted-boundary control ran the enforcing T1 boundary test in a disposable adapter copy: expected exit1, exactly the recursive scan failed, and all four forbidden uses were named with file/line diagnostics. Its eleven cases are separate from the 735 passing tests; expected failure is not silently included as a green test.

Full T3/T4 suites, soak, and stage covers were not rerun in QA. Supplied stage covers are Linux 801d32a7/A-15573 and macOS 11f9a8be/A-15577, tree f605d08ac83205d3bbda879f82faf516e174dc46. No remote lifetime/cost claim.

| Case | Result | Command and observation |
| --- | --- | --- |
| S0 | PASS | committed brief setup; clean detached worktree, sealed fixtureEnvironment scratch HOME/Git, zero credential names, expected synthetic CLAND names only, probe syntax checked |
| E1531S3-00 | PASS | m00; HEAD/dev/request equal, clean, four stage members landed, previous stages closed |
| E1531S3-01 | PASS | m01; preserved files unchanged, approved routing exception recorded, source/doc strings and native boundary pass, no web changes |
| E1531S3-02 | PASS | nt row02: ten named files serial, quiet/load gates; literal and eleven generated Host contract cases pass with no skips/failures |
| E1531S3-03 | PASS | nt row03; serial files, quiet/load gates; routing and lifecycle tests pass; generated counts 2/2/2/0/6 as required |
| E1531S3-04 | PASS | nt row04; nine serial files, quiet/load gates; nonlocal discovery and local schedule pass, both generated restart/abandonment pairs pass |
| E1531S3-05 | PASS | nt row05; eight serial files, quiet/load gates; territory ordering/lock/rollback/prune pass, generated unchanged/pushed and local/recording subcases pass |
| E1531S3-06 | PASS | nt row06; eleven serial files, quiet/load gates; OpenCode/Codex Host, native, sandbox and permission cases pass, required names present |
| E1531S3-07 | PASS | nt row07; macOS synthetic Seatbelt Git test executed and passed, no platform skip |
| E1531S3-08 | PASS | nt row08; twelve serial files, quiet/load gates; artifacts, placement, fixture environment and orphan checks pass; generated coordinator/aide cases present |
| E1531S3-09 | PASS | nt row09; enforcing T1 source boundary passes all eleven named cases |
| E1531S3-10 | PASS | m10; disposable adapter copy with four planted bypasses; expected exit1 only recursive-boundary case, all file/line/use diagnostics present twice |
| E1531S3-11 | PASS | m11; scratch init clean on dev, local executor lock configured, territory present, t1-enabled hub up, host column present with no rows |
| E1531S3-12 | PASS | m12; all three fake harnesses running local/darwin/alive, no t1 ops; local Claude agents 5 to17 in10s; all survive hub stop and resume same PIDs; no close diagnostics |
| E1531S3-13 | PASS | m13; all three fake harness stops complete, local/darwin rows stopped and process gone, no t1 operations |
| E1531S3-14 | PASS | m14; T-5 local item launch: territory/root/worktree/base equal, unpublished root commit included, territory dev unchanged, expected path/install link/session, no t1 ops |
| E1531S3-15 | PASS | m15; prune keeps occupied worktree, then removes directory/root branch/unchanged territory launch ref/base after session stop |
| E1531S3-16 | PASS | m16; T-6 inferred slug confirmed; preexisting territory tip supplies worktree/root, no launch base, prune removes local worktree/root but retains territory tip |
| E1531S3-17 | PASS | m17; T-7 slug confirmed, launch base matches then pushed work advances territory; prune removes worktree and preserves pushed territory tip |
| E1531S3-18 | PASS | m18; T-8 remote launch refused by t1 worktreeAdd; only t1 operation, no branch/base/worktree/row, both dev tips unchanged |
| E1531S3-19 | PASS | m19; file/folder/relative artifact bytes match, missing source refused, no t1 operations |
| E1531S3-20 | PASS | m20; Coordinator/Aide nonlocal and unknown host refused before t1 ops; implementer reaches only t1 statDirectory with invalid-cwd/no row; local Coordinator launches/stops normally |
| E1531S3-21 | PASS | m21 in persistent exec; live local PID collision survives startup/stops with zero signals, unknown-host row unknown; only t1 ops including identity+stop, role assignment refused, coordinator none; positive control in22 |
| E1531S3-22 | PASS | m22; restart without t1 makes both remote rows unknown; local host fields unchanged, trap alive/zero signals; positive control captures exactly one TERM then fixture KILL leaves trap dead |
| E1531S3-23 | PASS | m23; hub stopped, all43 fixture PIDs gone, zero processes naming scratch; final clean HEAD/dev match request |

## Findings and observations

Findings ranked by severity: none. No code changes or brief corrections were needed.

All inferred setup assumptions under the request held. Row12: local Claude agents invocations rose from5 to17 during the prescribed10s observation, excluding launch/restart time; all three native fake processes stayed alive through hub stop and resumed the same PIDs. Rows16/17: expected slugs matched, pre-existing and pushed territory work survived prune. Rows21/22 ran in one persistent exec so the collision trap remained owned until its positive control and cleanup.

The real-hub collision window contains only t1 operations, including identity and stop. The colliding local sh stayed alive with zero TERM/HUP receipts, then captured exactly one deliberate TERM; explicit fixture KILL left it dead. This proves no signal reached it during the tested window. A signal-0 probe leaves no trace: the “never probed locally” evidence is the spy-local-host routing test in row03, not the absence of local entries in testHostOps. Unknown hosts stayed state unknown/reason unknown host; Coordinator placement remained unassigned after refusal.

Row20 actual Implementer refusal: `invalid-cwd`, `launch cwd "<scratch>/p1" is not an accessible directory`, with exactly t1:statDirectory and no row. This matches the brief's explicit pass conditions, which do not require the underlying test-host refusal wording; the original full capture is retained. This diagnostic gap was already tracked separately as T-1586 after stage2. Row18 reached t1:worktreeAdd and returned `T-8: no worktree for the launch: test host t1 refuses worktreeAdd`, then removed all launch-created refs/base/worktree state.

Real-hub territory checks prove final state, including unpublished local dev ancestry, matching launch-base/ref/worktree tips, rollback and prune. Ordering before Host worktreeAdd and the territory lock are proven by the recording-Host tests in row05, not a raced real-hub observation. Real nonlocal successful launches are outside scope; the tests use the recording Host. Codex launch arguments were captured in row14 as evidence only, not judged as live sandbox-root proof.

## DoD coverage and limits

| Epic criterion | Checked here | Remaining outside this stage verdict |
| --- | --- | --- |
| C1 | All local Host contract operations and coverage omission controls, row02 | No criterion mark; epic demo separate |
| C2 | Boundary tests/negative control, adapters/worktrees/artifacts tests, real-hub fake launches/resume/stop and file copies | Full-suite occasion belongs to epic demo |
| C3 | Host column/local rows, spy-local routing, real PID collision and unknown-host states | Real-hub signal0 cannot be directly observed |
| C4 | Codex Host root/path tests and macOS Git sandbox test; launch argv retained | Live sandbox-root read reserved for DoD demo |
| C5 | Recording-Host ordering/lock tests and real-hub territory end states | No extra real-hub ordering claim |
| C6 | Generated placement tests; real nonlocal launch and role refusals | No criterion mark; epic demo separate |

Cleanup: scratch hub stopped, census of43 fixture PIDs empty and zero processes naming scratch root. Export contains only declared captures/receipts/report, no scratch HOME, environment export, cookies, hub secret or raw database. Shared publication scan passed with a positive control. Evidence and recorder lines precede this verdict.

Evidence A-15587: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15587-e-1531-stage-3-qa-clear-c14994a2/report.md
