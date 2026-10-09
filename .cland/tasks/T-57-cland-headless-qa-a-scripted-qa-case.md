---
id: T-57
kind: task
title: "cland --headless --qa: a scripted QA case drives a headless workbench and exits with its verdict"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-57
parent: T-20
blocked_by: []
topic: topic-14
branch: t/T-57-headless-qa-runner
created: 2026-10-09T08:33:53.699Z
updated: 2026-10-09T10:07:35.010Z
---

## Parent

Part of T-20 (slice 2, ticket 10 of 12). Spec sections 4.10 and 7(c); the qa-astra research. This is the ticket that frees QA from Codex sandbox approvals and from the headless gap found in T-42: it belongs to the first wave.

## What to build

`cland --headless --qa <case.lua> [--out <dir>]` runs one QA case in one Neovim process with no socket. It builds a fixture project in the temp dir from the case's fixture (items, roles, config): a case always runs against a fixture project with its own stdio hub or the stub hub, never the live project (decision D13). It then starts the standalone Neovim under its own app name, `--clean` with cland's init, headless, with a fixed 160×45 grid, pinned `TERM`, `LANG` and `TZ`, no `--listen` and no redraw timers. The hub is its stdio child (`cland hub serve --stdio --no-listen` on the fixture), or the stub hub with the case's scenario for sessions and states. The case runs inside Neovim through a Lua QA API: `keys` (over `nvim_input`), `wait_for(predicate, timeout)` (over `vim.wait`), `screen()` (over `screenstring()`), `state()` (a JSON snapshot of what the client knows: sessions and their states, roles, topics and their statuses, open asks, items), `expect(condition, message)`, and `dump(path)` (the grid as text and the state as JSON, also as `:Cland qa dump <path>` in any run). The run prints one JSON line (case, result PASS, FAIL, INCONCLUSIVE or BLOCKED, duration, build, evidence) and exits 0, 1 or 2. Without `--out`, the evidence is printed inline. Two cases ship, the epic's first scripted QA cases: `qa/cases/SHELL-001.lua` (General shows and a message goes `queued`) and `qa/cases/ITEMS-001.lua` (a fixture item in the items panel and its view).

## Acceptance criteria

- [ ] `cland --headless --qa qa/cases/SHELL-001.lua` exits 0 and prints one JSON line with `"result":"PASS"`; a case whose `expect` fails exits 1, with `"result":"FAIL"`, the expectation's message and a grid dump in `--out`.
- [ ] A `wait_for` timeout ends `INCONCLUSIVE` and a Lua error `BLOCKED`, both exiting 2 with the last screen dumped.
- [ ] Under `sandbox-exec` with the network denied, both cases pass; with file writes also denied outside the temp dir, both pass; a stub-hub case without `--out` passes with every file write denied, as in a read-only rescue run. The test skips with the reason where `sandbox-exec` is missing.
- [ ] `qa.state()` returns the stub scenario's sessions with their states, and the topics, asks and items the screen shows.
- [ ] The run reads no user configuration, never touches the live project's hub or tracker, and leaves no process behind.
- [ ] `npm run typecheck && npm test` pass; `nvim/README.md` documents the QA API and the case file.

## Notes

Test seam: `cland --headless --qa` as a process: exit codes, the JSON lines and the dump files, under `sandbox-exec` profiles (the edges tests are prior art); the stub hub's scenarios. Size L. Implementer: Claude Code, the one with the most context on the harness and the hub (the sandbox criteria need `sandbox-exec`, which does not nest inside a Codex sandbox, and driving Neovim from inside itself needs careful event-loop reasoning). Can start immediately.

## Comments

### coord · 2026-10-09T08:39:13.201Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/52 (a sub-issue of #20; the item is the source of truth).

### impl-57 · 2026-10-09T08:52:39.689Z

Progress (impl-57, branch t/T-57-headless-qa-runner, not committed yet).

Working: `cland --headless --qa <case.lua> [--out <dir>] [--hub stdio|stub] [--timeout <s>]` (hub/src/cli/qa.ts) starts the pinned Neovim headless with an environment of its own (NVIM_APPNAME=cland-qa, TERM/LANG/TZ pinned, HOME and XDG inside the run's temp dir), and nvim/lua/cland/qa.lua builds the fixture project, starts the shell on a stdio hub with `--no-listen` (or the stub hub) and runs the case. qa/cases/SHELL-001.lua and ITEMS-001.lua pass, also under sandbox-exec with the network denied and with writes denied outside the temp dir; a stub-hub case passes with every file write denied.

Design decisions worth knowing:
- The case runs as a coroutine. Keys from nvim_input() are consumed only by Neovim's main loop, never while Lua runs (vim.wait() included; probed), so `keys` and `wait_for` yield to the main loop and resume from a scheduled callback. Consequence for case authors: a mapping's keys go in one `keys()` call (`<Space>i`), because an event between two calls ends a pending mapping.
- A case is a Lua file returning a table: title, hub, fixture (project, items, roles, config), scenario (stub only), run(qa).
- `--hub stdio|stub` overrides the case's hub, so a portable case (both shipped ones) also runs in a read-only rescue run, where the stdio hub cannot (it needs the temp dir); there the stdio run is BLOCKED and says so.
- The stub hub stays at nvim/test/stub-hub.ts (other branches edit it); it gained CLAND_STUB_SCENARIO_JSON, the scenario inline, since a read-only run has nowhere to write the file.
- The JSON line's duration field is `duration_ms`; `build` is the short commit, else `v<version>` where git cannot run.

### impl-57 · 2026-10-09T09:07:55.040Z

Done on t/T-57-headless-qa-runner: 3ee6f2d (the runner, the Lua QA API, the two cases, tests, docs) and 43b0ad8 (fixes after the two-axis code review).

Checks: `npm run typecheck` clean. nvim/test/qa.test.ts 16/16 (run alone, after the last commit). Full suite once, under the machine load: hub 268/269, nvim 77/78; both failures are waits that timed out in tests this branch does not touch (`a Claude Code StopFailure is recorded…` in hub/test/claude-code-adapter.test.ts, `the tree follows task events…` in nvim/test/shell.test.ts) and each passes when rerun alone. The hub suite ran before 43b0ad8, which changes no hub code path but hub/src/cli/qa.ts.

Acceptance criteria, each with a test in nvim/test/qa.test.ts: PASS/exit 0 and FAIL/exit 1 with message and dumps in --out; INCONCLUSIVE and BLOCKED/exit 2 with the last screen; the three sandbox-exec profiles (skipped with the reason where it is missing); qa.state() against a stub scenario; no user configuration, the live project untouched, no process left (also after --timeout and SIGTERM); README.

Review findings left as they are, on purpose:
- The stub hub stays at nvim/test/stub-hub.ts, so `hub = 'stub'` runs a file under test/. Moving it would conflict with the branches that edit it now; worth a follow-up once they merge.
- qa.lua writes the fixture's item files itself (the tracker's file format, a second writer): the fixture has to exist before its hub starts. ITEMS-001 against the stdio hub guards the format.
- The client's data refresh timers still run in a QA run (they are the client's behaviour, not redraw timers); no timer drives the redraw.
- Beyond the ticket: `--hub stdio|stub`, `--timeout`, the `hub` and `message` keys in the JSON line, `wait_for`'s third argument, `qa.root`, extra state fields (project, root, mode, view, panels, coordinator, needs_you).
- A session terminal's job is a process session of its own: on --timeout or a signal it gets the hang-up from its terminal closing, not the group kill.
- GLOSSARY.md has no entry for QA case, fixture project, evidence or QA lane.

### rev-6 · 2026-10-09T09:16:26.956Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-20261009-57-1

Reviewed b8368b3..43b0ad892b98d92c6cc5067bc3db0372af9f13b4 (3ee6f2d, 43b0ad8), main thread only.

Medium (Spec) — nvim/lua/cland/qa.lua:178: fixture.project is joined into a filesystem path without confinement; project='../live' targets <temp-parent>/live/.cland/tasks and its item files, outside the run directory. This violates D13 and the acceptance criterion that the live tracker is never touched, and the runner only removes its own directory. Use a fixed or validated directory component and reject item ids that can escape their tasks directory before any write.

Medium (Spec) — nvim/lua/cland/qa.lua:293: qa.keys ignores nvim_input's accepted-byte count, silently discarding the remainder when the input buffer fills; a read-only in-memory case submitted 1,000,000 plain bytes and accepted only 16,368, while qa.keys returned normally. A long message can lose its trailing <CR> and test different behavior. Resume and submit the remainder until all input is accepted, preserving key notation boundaries.

Medium (Spec; also possible Duplicated Code under Standards) — nvim/lua/cland/qa.lua:120: the second tracker writer emits unquoted YAML list/scalar values instead of using the tracker's serializer; fixture labels {'priority, high', 'ui: shell'} become ['priority', 'high', '[object Object]'] through the real parseItem, while the stub retains the original two strings. Reuse hub/src/tracker/item.ts's writer (or a shared fixture creation entry point) so fixtures have the same data under either hub; ITEMS-001 only covers simple values and does not guard this drift.

No high findings. Other reviewed requirements are represented in the implementation and tests. --hub, --timeout, result hub/message fields, and the scenario environment variable are useful for T-62 and read-only runs; no scope-creep finding. Keeping the stub under test/ and the client's data-refresh timers is acceptable for this ticket. No .cland/tasks files are in the change.

Validation: npm run typecheck passes on the target worktree; git diff --check passes. Read-only probes confirmed input truncation and fixture path generation (all fixture writes intercepted), and the real tracker parser confirmed label corruption. The 16/16 process tests and sandbox-profile results are implementer-reported; the file-writing suite was not rerun in this read-only review.

### impl-57 · 2026-10-09T09:38:36.556Z

Fixes for review rev-20261009-57-1 in 7af7f8c (on top of 3ee6f2d, 43b0ad8), each with a regression in nvim/test/qa.test.ts:
1. Fixture paths: `fixture.project` must be a plain directory name and an item id `T-<n>`; otherwise the case is BLOCKED before any write, under either hub. Test: ESCAPE-001 (`../live`) and ESCAPE-002 (`../../T-1`) on stdio and stub, with nothing left in the test's own TMPDIR.
2. Long keys: `qa.keys` hands nvim_input() at most 4 KiB at a time, cut between two keys, and pauses for the main loop to read them. Probed: Neovim 0.12's 16 KiB input buffer, once filled to the brim, takes nothing more even after it is read; that is how the rest of the sequence was lost. Input that stalls for about 5 s ends the case BLOCKED. Test: KEYS-001, 36,000 bytes of `xy<BS>`; every key arrives, whole, and the final `<Esc>` is taken.
3. Item writer: the fixture's items are written by the tracker's own serializeItem (`cland --qa-fixture`, hub/src/cli/qa-fixture.ts), and the second writer in Lua is removed. Test: LABELS-001 with labels `priority, high` and `ui: shell`, a title with quotes, commas, brackets and `#`, a body with `---`, on stdio and stub; the items read back identically.
`npm run typecheck && npm test` once: typecheck clean, hub 269/269, nvim 81/81.

### rev-6 · 2026-10-09T09:43:40.987Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-20261009-57-2

Second review: 7af7f8c524ff17f7521bc0886d2ad82512648d55, including main...t/T-57-headless-qa-runner. Main thread only.

Medium (Spec) — nvim/lua/cland/qa.lua:295: the pause between 4 KiB chunks breaks a multi-key mapping when its keys straddle the boundary, despite being in one qa.keys call. Read-only reproduction on the real pinned Neovim: qa.keys(string.rep('x', 4084) .. '<Esc><Space>i') leaves the items panel closed and mode 'i'; waiting 1500 ms ends INCONCLUSIVE. The adjacent control with 4083 x characters opens the panel and ends in normal mode. The first chunk ends after <Space>, and the resumed 'i' becomes an independent command. Preserve mapping behavior across internal chunk boundaries and add this regression; KEYS-001 currently checks indivisible <BS>/<Esc> tokens but does not cover multi-key mappings. The original byte-loss issue is fixed, but the keys contract is not yet clear.

Low (Scope/direct use) — hub/src/cli/qa-fixture.ts:66: --qa-fixture accepts an arbitrary caller-supplied dir and writes into an existing project without refusal, so direct use can overwrite item files or roles/config. The runner supplies a fresh directory, making this acceptable as its hidden internal serializer bridge; it should not be treated as a safe standalone fixture command without refusing existing roots or allocating its own temp directory. A write-intercepted probe with dir='.', project='live' targets cwd/live/.cland/tasks.

Closed from rev-20261009-57-1: fixture.project and item-id path escape are rejected before the fixture writer runs, under either hub, including the read-only stub path; the Lua item-file writer is removed, and the tracker serializer preserves the comma/colon labels, title, body and comments. The helper is appropriately scoped to that serializer bridge, with the direct-use limitation above. No other high or medium Standards findings; the prior duplicated-writer finding is closed. No .cland/tasks changes in the branch diff.

Validation: npm run typecheck and git diff --check pass. Read-only real-Neovim probes: KEYS-001 PASS, LABELS-001 on stub PASS, ESCAPE-001 and ESCAPE-002 BLOCKED on both hub selections. Write-intercepted tests of the real TypeScript writer reject both bad paths before any write and round-trip labels/title/body/comments through parseItem. The mapping-boundary probe and its adjacent passing control confirm the remaining medium. The full file-writing suite and sandbox-profile checks remain implementer-reported (hub 269/269, nvim 81/81).

### impl-57 · 2026-10-09T09:59:08.313Z

Fixes for review rev-20261009-57-2 in db59c1b:
- qa.keys now cuts a long sequence only where no mapping can be pending: inside a run of text (two plain characters on each side), else right after `<CR>` or `<Esc>`, else after a plain character. It never cuts between a `<…>` key and the key after it.
  - Regression KEYS-002: rev-6's exact `x×4084 .. '<Esc><Space>i'` opens Items. For every text length from 4086 to 4098 and from 8182 to 8194, `<Space>c` + text + `<Esc><Space>i<Space>c` + text + `<Esc>` toggles the panel, ends in Normal mode and types no notation as text, so mappings fall before, after and across each boundary.
  - The case fails on 7af7f8c ("x×4084 then <Esc><Space>i opened the items panel") and passes now.
- `cland --qa-fixture` refuses a project directory that already exists. Regression: a second write to the same project exits 1 and leaves the first file as it was.
Checks: typecheck clean; the full suite once: hub 266/267, the one failure being a timing failure in hub/test/claude-code-sessions.test.ts ("late Claude start and StopFailure hooks…"), which passes when rerun alone; nvim 83/83.

### qa-12 · 2026-10-09T10:01:58.515Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-20261009-57-db59c1b

Verified db59c1b9b85239b8e9b67c6402037da278773bee on t/T-57-headless-qa-runner. git log/rev-parse matched before and after the refresh; working tree clean. No implementation changes by QA.

Ran:
- On db59c1b: `npm run typecheck` passed. `node --test nvim/test/qa.test.ts` passed: 21 total, 18 passed, 0 failed, 3 sandbox-profile skips. Read KEYS-002 and the existing-target refusal. Covered the exact x×4084 + <Esc><Space>i regression and mappings around 4/8 KiB boundaries; a second --qa-fixture write exits 1 and preserves the original item; path and label regressions; all result codes/dumps, state/scenarios, pinned environment, ordinary :Cland qa dump, timeout/SIGTERM cleanup and configuration/live-project isolation.
- Direct CLI refresh from the worktree: `node hub/bin/cland.ts --headless --qa qa/cases/SHELL-001.lua` and ITEMS-001.lua: PASS/exit 0, exactly one JSON line, build db59c1b, inline 45-row grids. Verified queued message and item detail/body. SHELL-001 with --hub stub also PASS/0.
- `/tmp/qa-20261009-57-2/MANUAL-FAIL.lua` is SHELL-001 with a deliberate failed expectation: FAIL/1, exact message, queued text, screen/state files under fail-out. MANUAL-WAIT.lua: INCONCLUSIVE/2 after 300 ms, named wait, last Items screen under wait-out. MANUAL-ERROR.lua: BLOCKED/2, Lua error/line/traceback and General screen under error-out. Every report names db59c1b and has one JSON line.
- MANUAL-ESCAPE.lua with project ../live: BLOCKED/2 before fixture creation; controlled TMPDIR remained empty. Successful runs' temporary fixture directories were removed.
- Independent MANUAL-LONG.lua through the real stdio hub: 12,276 and 24,564 z characters followed by <Esc><Space>i. PASS/0: all input preserved (accounting for the prompt buffer's prefix), Normal mode, Items open with the fixture item visible. Inline dumps length-12276 and length-24564 retained.
- Initial required `npm run typecheck && npm test` at 7af7f8c: typecheck passed; hub 269 total, 261 passed, 7 environment skips, one 15-second clause-turn timeout at hub/test/claude-code-sessions.test.ts:186. Exact test rerun alone passed (1/1, 6.6 s). Because && stopped before Neovim, ran `npm run test:nvim`: 83 total, 80 passed, 3 skips. That run included the third-round changes before commit; SHA-256 comparison confirms all six changed files match db59c1b. The final standalone QA refresh above ran after commit.
- `cland task list --json` and task view T-57 --json succeeded. Initial manual pass: all 66 summaries identical before/after. Refresh: only T-53/T-54 changed, closed by Coordinator merge comments at 10:00:10Z (confirmed through task.view); no QA fixture items entered the real tracker. Updated nvim/README.md QA API/case documentation and hub/README.md match the exercised behavior.

Findings by severity:
- High/medium: none in the requested scope.
- Low / verification observation: the initial full hub invocation was not wholly green due to the untouched relaunch test's wait timeout; it passed alone without code or timeout changes, consistent with load sensitivity.

Evidence limits: nested sandbox-exec is unavailable here, so the three QA profiles skip; initial hub suite skipped six ps-dependent tests and one sandbox-exec test. /bin/ps is denied and normal runner reports expose no PID, so manual per-run process absence was not independently established. Automated process-group cleanup checks pass for normal completion, timeout and SIGTERM. No own-project hub start/stop, role set or topic answer was run.

Evidence: /tmp/qa-20261009-57-2/{typecheck.log,qa-test.log,manual.py,manual.log,manual-summary.json,*.json}, manual Lua cases and fail-out/wait-out/error-out. Prior suite evidence: /tmp/qa-20261009-57-1/{full-test.log,relaunch-rerun.log,nvim-test.log,qa-test.log,tested-working-files.json}.

### rev-6 · 2026-10-09T10:02:38.545Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-20261009-57-3

Third review: db59c1b9b85239b8e9b67c6402037da278773bee, including main...t/T-57-headless-qa-runner. Main thread only.

Medium (Spec) — nvim/lua/cland/qa.lua:65: consecutive plain characters are treated as a safe text boundary without considering Normal mode or plain-character mappings such as cland's gi/gt/gs. In Normal mode, qa.keys(string.rep('h', 4095) .. 'gi') splits gi after g: the first nvim_input call receives 4096 bytes ending 'hhhhhhhg', and the deferred callback never submits i while Neovim waits for the pending g command. A read-only pinned-Neovim probe remained inside qa.keys until its external 5 s watchdog stopped it (also reproduced with 10 s); no QA result was produced. With General bound to fixture T-1, the adjacent 4094-h control opens T-1 and returns PASS in Normal mode. Preserve plain-character mappings across chunk boundaries using mode/mapping context, or explicitly refuse sequences that cannot be safely split; add the Normal-mode gi regression. KEYS-002 verifies leader mappings around inserted text, which does not cover this path. The earlier mapping-boundary medium remains partially fixed, not closed.

Closed: the exact 4084-x then <Esc><Space>i regression now passes through KEYS-002; KEYS-001 and KEYS-002 both PASS in read-only real-Neovim probes. The prior low in hub/src/cli/qa-fixture.ts is closed: an existing root is refused before mkdir or any file write, confirmed by a write-intercepted probe. Fixture path confinement and use of the canonical tracker serializer remain intact. No other high/medium Standards findings and no remaining low findings. No .cland/tasks files are in the branch diff.

Validation: npm run typecheck and git diff --check pass. All probes used the stub hub without filesystem writes; fixture writes were intercepted. The full suite/sandbox checks remain implementer-reported (hub 266/267 with the timing failure passing alone; nvim 83/83).

### impl-57 · 2026-10-09T10:07:35.010Z

Fix for review rev-20261009-57-3 is in 0fd3df9.

qa.keys now cuts a sequence longer than 4 KiB only right after `<Esc>` or `<CR>`. A cut inside plain text is never treated as safe, because the pause between chunks ends whatever command or mapping is pending, in any mode. A stretch of more than 4 KiB with neither key is BLOCKED before anything is typed, with this message: "keys: N bytes from byte K on hold no <Esc> or <CR> within 4096 bytes, the most typed at once; put an <Esc> or a <CR> where the mode is known, or split the keys over several qa.keys calls".

Regressions:
- KEYS-001 and KEYS-002 are kept; they now carry `<Esc>` cut points. KEYS-002 includes rev-6's x×4084 then `<Esc><Space>i`, and puts the cut at every distance from the limit (n = 4060…4091).
- KEYS-003: a Normal-mode `gi` after `h×4000<Esc>h×200` runs once, and qa.keys returns.
- KEYS-004: the reported `h×4095 gi` is refused at once with the message above, with nothing typed (Normal mode, nothing pending). On db59c1b the same case hung until the run's timeout.

Checks: typecheck clean; nvim/test/qa.test.ts 22/22. The README's qa.keys row says the same.
