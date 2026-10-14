---
id: T-391
kind: task
title: "Lazy CLI imports: cland loads only the subcommand it runs, with its usage text in a light module and a module-count guard test"
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by: []
topic: topic-248
branch: t/T-391-lazy-cli-imports-cland-loads-only-the
created: 2026-10-14T12:28:10.700Z
updated: 2026-10-14T20:34:52.185Z
closed: 2026-10-14T20:34:52.185Z
---

## Summary

`hub/bin/cland.ts` statically imports every subcommand module. Each `cland` process, about 3,700 per suite run plus every agent's own calls, therefore loads 139 of the 144 `hub/src` modules with TypeScript stripping, about 0.09 s idle and more under load. This ticket makes each subcommand a dynamic import and moves the usage texts into a light module, so `cland --help` loads a handful of modules. A guard test keeps it that way. The research estimates 180–300 s of test-time, 0.8–1.3 minutes of a full run.

## Parent

"Test speed: quick wins" (R-228), tracer bullet 3; research #4 (`docs/research/test-speed.md` §3.10 "Lazy CLI subcommand imports", §1 "Fixed setup cost per spawned hub").

## What to build

**Usage texts.** The entry builds its help from 21 `*_USAGE` constants imported from the subcommand modules (`ACCOUNT_USAGE` … `SUBSCRIPTIONS_USAGE`). Move them into one module, `hub/src/cli/usage.ts`, that imports nothing from `hub/src` except `version.ts`. Each subcommand module re-exports its constant from there, so its own `--help` output and its tests are unchanged.

**Dynamic dispatch.** Each `case` in `hub/bin/cland.ts` does `const { runTask } = await import('../src/cli/task.ts')` (and so on) inside its existing `try`, so import errors land in the same `cland: …` error path with the same exit code. `--version`, `--help` and the no-command branch import only `usage.ts` and `version.ts`. The internal `--qa-fixture` path keeps its exit-code behaviour.

**Heavy imports inside subcommands.** Where one subcommand module statically pulls in a large graph for a rarely used branch, move that branch to a dynamic import as well. Example: `cli/hub.ts` importing the daemon for `start`, when `status` and `stop` only need the socket client. Do this only where the guard test's numbers show it pays. The detached daemon process itself is out of scope.

**The guard test, `hub/test/cli-imports.test.ts`.**

- It spawns `node --import <counter> hub/bin/cland.ts <args>` for `--help`, `--version`, `task list --json` (in a temporary project without a hub) and `hub status`. The counter is a `module.registerHooks` resolve hook in a test fixture that counts `hub/src` URLs and writes the count to a file.
- It asserts `--help` and `--version` load at most 10 `hub/src` modules.
- It asserts each other command loads no more than a recorded budget: today's measured closure plus a 10% margin, written in the test with a comment naming how it was measured.

This is a real-process test with no hub, so it runs in the `machine` shard; add it to `hub/test/shards.json`.

## Acceptance criteria

- [x] C1. `cland --help` and `cland --version` load at most 10 `hub/src` modules (139 today), measured by the guard test.
  - done: impl-391 · 2026-10-14T12:36:28.299Z
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-1 · 2026-10-14T17:11:26.994Z · commit 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-2 · 2026-10-14T20:34:26.495Z · commit 695f89f4d12b3a28e6cba83014d138b812e60805
- [x] C2. Each subcommand loads only its own closure, and the guard test fails when a static import of another subcommand module is added to `hub/bin/cland.ts`.
  - done: impl-391 · 2026-10-14T12:36:29.113Z
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-1 · 2026-10-14T17:11:26.994Z · commit 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-2 · 2026-10-14T20:34:26.495Z · commit 695f89f4d12b3a28e6cba83014d138b812e60805
- [x] C3. Measured on an idle machine: `cland --help` takes at most 50 ms (median of 20, about 90 ms today) and `cland task list --json` against a running hub is at least 30 ms faster (median of 20); before/after numbers are posted on the item.
  - done: impl-391 · 2026-10-14T12:36:29.916Z
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-1 · 2026-10-14T17:11:26.994Z · commit 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-2 · 2026-10-14T20:34:26.495Z · commit 695f89f4d12b3a28e6cba83014d138b812e60805
- [x] C4. Every subcommand's help text, exit codes and error lines are unchanged; existing CLI tests pass without changed assertions.
  - done: impl-391 · 2026-10-14T12:36:30.492Z
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-1 · 2026-10-14T17:11:26.994Z · commit 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-2 · 2026-10-14T20:34:26.495Z · commit 695f89f4d12b3a28e6cba83014d138b812e60805
- [x] C5. An import failure inside a subcommand reports `cland: <message>` with that subcommand's existing exit code, proven by a test.
  - done: impl-391 · 2026-10-14T12:36:31.003Z
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-1 · 2026-10-14T17:11:26.994Z · commit 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-2 · 2026-10-14T20:34:26.496Z · commit 695f89f4d12b3a28e6cba83014d138b812e60805
- [x] C6. `hub/README.md` (the CLI section) notes that subcommands load lazily and that the guard test holds the counts.
  - done: impl-391 · 2026-10-14T12:36:31.764Z
  - verified: rev-26 [reviewer] · run rev-20261014-391-source-1 · 2026-10-14T12:38:12.615Z · commit 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-1 · 2026-10-14T17:11:26.994Z · commit 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
  - verified: rev-26 [reviewer] · run rev-20261014-391-source-2 · 2026-10-14T18:21:53.688Z · commit 8bf2500e10ae8350b583b1a997674554c95af2cd
  - verified: rev-26 [reviewer] · run rev-20261014-391-source-3 · 2026-10-14T19:57:19.315Z · commit 695f89f4d12b3a28e6cba83014d138b812e60805
  - verified: rev-26 [reviewer] · run rev-20261014-391-final-2 · 2026-10-14T20:34:26.496Z · commit 695f89f4d12b3a28e6cba83014d138b812e60805

## Comments

### impl-391 · 2026-10-14T12:32:32.117Z

First real-process guard failed before implementation: --help resolved 56 hub/src modules at baseline e0cecd0004ea9df3f7cca08a2f111117b554a16f (the research's 139 predates recent lazy SQLite changes). After lazy dispatch/extracted usage: help/version/noninteractive no-command 2 modules; task list --json 13; hub status 16. Recorded budgets are 15 and 18 (ceil of +10%). Existing cli-imports.test.ts already has a machine shard entry; preserved its SQLite assertions unchanged. Daemon import was already lazy; no further branch split is justified by this small closure.

### coord · 2026-10-14T12:32:42.014Z

Coordinator reading of C3 (2026-10-14 12:33Z): no idle window is needed. C3 is met by 20 paired, interleaved runs (baseline e0cecd0 against the head), sequential and single-process, with the 1-minute load recorded per pair. The evidence is the median of each and their ratio. Absolute idle-machine numbers come from E-386's QA demo.

### impl-391 · 2026-10-14T12:35:18.434Z

C3 evidence per Coordinator's 2026-10-14 decision: 20 sequential interleaved baseline/candidate pairs under shared load, each recording 1-minute load; absolute idle numbers remain the epic QA demo. Artifact A-2353 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2353-t-391-paired-before-after-cli-timings.md). --help median 186.30 → 84.44 ms (saved 101.86 ms; ratio 0.453); task list --json against the running project hub 292.25 → 252.75 ms (saved 39.49 ms; ratio 0.865). Help stdout matched byte-for-byte in all 20 pairs. Planted a static account.ts import in entry: guard failed on unwanted CLI modules despite its total 7 being under 10; restored entry afterward.

### rev-26 · 2026-10-14T12:38:12.615Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-391-source-1
commit: 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
scope: full

No high/medium findings. hub/bin/cland.ts imports implementations inside the existing command handlers, preserving aliases/error codes and the uncaught internal fixture path. All 22 extracted usage literals independently match baseline bytes; source bodies otherwise unchanged. Real-process count/allowed-closure and all dispatch import-failure guards retain existing SQLite coverage. C3 raw paired medians checked under Coordinator's explicit non-idle decision; absolute idle help timing remains epic QA. Standards and Spec clear. C6 docs verified from source; C1–C5 final settlement awaits accepted same-head mode-selected verification. Evidence A-2359: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2359-t-391-source-review-clear-at-4d459f99-lazy-cli-dispatch-and-import-guards.md.

Criteria: C6 verified.

### rev-26 · 2026-10-14T17:11:26.994Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-391-final-1
commit: 4d459f99be50d60a9aa7f7ddbbaebe81c93efc36
scope: evidence

No high/medium findings. Accepted same-head auto run eb12f4c3/A-2463 passed typecheck and full 2014/2014 (37 free,1599 hub machine,378 Neovim), zero fail/cancel/skip/todo. CLI module counts 2/2/2/13/16 and import-failure/unchanged CLI assertions pass. Executor was local darwin arm64: explicit droplet request fell back because remote budget 2/2 full, as Coordinator permitted. C3 is verified under Coordinator's 12:32:42 paired-load interpretation: A-2353 help median186.295→84.440ms, task292.250→252.755ms; absolute idle <=50ms remains epic QA, not claimed here. Source A-2359 retained; cancelled A-2440/A-2451 excluded. C1–C6 checked. Evidence A-2464: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2464-t-391-final-review-clear-at-4d459f99-accepted-auto-selected-full-verification.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-26 · 2026-10-14T18:21:53.688Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-391-source-2
commit: 8bf2500e10ae8350b583b1a997674554c95af2cd
scope: delta

No high/medium findings. Independently compared all 22 extracted usage literals to dev 878d70e7: exact matches. account.ts and suite.ts preserve current dev implementation bodies, including account clear/limit text and remote queue display; differences are usage plumbing only. Entry dispatch, CLI import guards/counter are byte-identical to prior source-clear 4d459f99. Task diff remains 26 files,371+/179-. C6 docs renewed; C1–C5 final execution settlement awaits accepted verification at this new head. A-2499 targeted checks green; prior A-2463 does not establish new-head green. C3 keeps the recorded paired-load interpretation. Evidence A-2500: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2500-t-391-delta-source-clear-at-8bf2500e-current-dev-cli-behavior-and-help-retained.md.

Criteria: C6 verified.

### rev-26 · 2026-10-14T19:55:43.055Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261014-391-evidence-2
commit: 8bf2500e10ae8350b583b1a997674554c95af2cd
scope: evidence

Medium — nvim/test/explorer-card.test.ts:243: gi thread-reference case fails with 'card T-11 expects fallback human picture' / 'no row under the cursor'. e51b85d9/A-2541 is failed: 2041/2042 pass, one fail, zero cancel/skip/todo; typecheck and hub/CLI checks green. File is outside T-391 diff; source-clear A-2500 retained and no unrelated criterion failed. Lead reports exact T-439 match and follows Coordinator's shared-fix pick/delta-review instruction; current receipt stays red. Evidence A-2542: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2542-t-391-verification-not-clear-at-8bf2500e-unrelated-explorer-card-assertion.md.

### rev-26 · 2026-10-14T19:57:19.315Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-391-source-3
commit: 695f89f4d12b3a28e6cba83014d138b812e60805
scope: delta

No high/medium findings. Shared T-439 a2f60f7a changed lines match the local pick exactly. nvim/test/explorer-card.test.ts:247 polls actual view/cursor/card drawn state while yielding for queued input; first navigation waits for composer/thread/reference readiness. All original assertions and five-second bounds preserved. Prior rev-23 T-439 source/final verdicts and A-2543 targeted 15/15 checked. T-391 CLI entry, usage, guards/counter and README unchanged from source-clear 8bf2500e. C6 renewed; C1–C5 final execution settlement awaits accepted new-head no-mode local verify. Earlier e51b85d9/A-2541 remains failed. Evidence A-2544: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2544-t-391-source-clear-at-695f89f4-unchanged-shared-t-439-readiness-fix.md.

Criteria: C6 verified.

### rev-26 · 2026-10-14T20:34:26.496Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-391-final-2
commit: 695f89f4d12b3a28e6cba83014d138b812e60805
scope: evidence

No high/medium findings. Accepted same-head local auto/full 6e61b4b3/A-2552 passes typechecks and 2042/2042 (37 free,1618 hub machine,387 Neovim), zero fail/cancel/skip/todo. CLI counts/import-failure guards and gi case pass. Source A-2500/A-2544 retained; prior e51b85d9/A-2541's unrelated gi failure remains preserved and is addressed by the reviewed T-439 shared pick. C3 uses A-2353 and Coordinator's paired-load interpretation; absolute idle timing remains epic QA. C1–C6 checked. Evidence A-2554: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2554-t-391-final-clear-at-695f89f4-full-local-verification-and-shared-readiness-fix-c.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-14T20:34:52.185Z

Merged 44c305924a1470dce81e747e9949eaa9f91d6a0f onto dev.
