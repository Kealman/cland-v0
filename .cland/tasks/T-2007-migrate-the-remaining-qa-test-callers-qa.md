---
id: T-2007
kind: task
title: Migrate the remaining QA test callers (qa.test, qa-shipped via qa-runner) to whole-caller fixture ownership
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1789
branch: t/T-2007-migrate-the-remaining-qa-test-callers-qa
created: 2026-11-19T14:04:47.226Z
updated: 2026-11-25T13:42:16.256Z
---

## Summary

The existing QA test callbacks in `nvim/test/qa.test.ts`, and the T4 `nvim/test/qa-shipped.test.ts` through `qa-runner.ts`, still use raw test contexts. Their async root and setup work runs before the child process starts, with no whole-caller owner or join. T-1805 migrated only its five new QA controls to `receiptFixtureCase` (rev-36 source review 4, A-21807). impl-1805 found the rest by reading the code on 2026-11-19; nothing reproduced.

## What to build

Migrate the remaining QA callers to the shared whole-caller fixture ownership that T-1805 used: pre-acquisition normal and signal ownership, named setup bounds, and joins of original work, late roots and children before storage cleanup. Keep every QA case's assertions unchanged.

## Acceptance criteria

- [x] C1. Every callback in `nvim/test/qa.test.ts` and `nvim/test/qa-shipped.test.ts` that acquires a root or child runs under whole-caller fixture ownership, listed by name in the item (test).
  - done: impl-2007 · 2026-11-25T13:41:30.065Z
- [x] C2. A control interrupting setup mid-acquisition shows the root and child joined before storage removal (test).
  - done: impl-2007 · 2026-11-25T13:41:30.295Z

## Comments

### impl-2007 · 2026-11-25T13:38:12.667Z

C1 ownership inventory (test titles; generated tamper variants missing/tampered × shim/preload):
'SHELL-001 passes against its own stdio hub: exit 0 and one JSON line with the result, the duration, the build and the evidence inline'
'the QA fixture seals its CLI environment before the product starts'
'QA child hubs register allocated roots without grant variables in the case environment'
`QA refuses a ${change} ${target} before launching Node`
'a failed expectation exits 1 with FAIL, its message, and the grid and the state dumped in --out'
'a wait_for that times out exits 2 with INCONCLUSIVE and the last screen'
'a Lua error in the case exits 2 with BLOCKED, the error with its line, and the last screen'
'a case that is not there, or does not load, is BLOCKED with exit 2; a bad command line is a usage error'
'qa.state() holds the stub scenario: the sessions with their states, the roles, and the topics, asks and items the screen shows'
'ITEMS-001 passes against its own stdio hub, and against the stub hub with --hub stub'
"the fixture's roles.toml and config.toml are the stdio hub's: the launcher fills in the Coordinator's defaults including its danger-full-access sandbox"
'every run is given the fixed grid, the pinned TERM, LANG and TZ, paths of its own and no server socket, whatever the caller has'
'FOLLOWS-001 reaches its closed predecessor task under both the stdio and stub hubs'
'fixture values YAML would read as structure reach the client whole, the same under the stdio hub and the stub hub'
'a fixture that would write outside the run directory (its project name, an item id) is BLOCKED before any write'
'keys longer than Neovim\'s input buffer are all typed, the last ones too'
'a long sequence is cut only right after <Esc> or <CR>: rev-6\'s x×4084 then <Esc><Space>i, and the cut at every distance from the limit'
'a Normal-mode command after a long stretch arrives whole when there is an <Esc> to cut at; with none in over 4 KiB the keys are refused, never left hanging'
'`cland --qa-fixture` writes a new fixture project only: an existing one is refused and left as it was'
'a case that never returns is ended by --timeout: BLOCKED, exit 2, and no Neovim left spinning'
'a run that is interrupted (SIGTERM) takes its Neovim with it and still says BLOCKED'
':Cland qa dump <path> writes the grid and the state in an ordinary run'
'with the network denied (no socket to bind or reach), both cases pass'
'with file writes also denied outside the temp dir, both cases pass and dump their evidence there'
'with every file write denied, as in a read-only rescue run, a stub-hub case without --out passes; one that needs the stdio hub is BLOCKED and says why'
'a run reads no user configuration, leaves the live project it was started in alone, and leaves no process and no fixture behind'
'stub QA accepts user-authored frames absent from the T2 recording catalog'
`${name} passes through the headless QA runner`
Generated shipped callbacks:
ARTIFACT-001 passes through the headless QA runner
ARTIFACT-002 passes through the headless QA runner
EXPLORER-001 passes through the headless QA runner
EXPLORER-002 passes through the headless QA runner
GRAPH-001 passes through the headless QA runner
ITEMS-002 passes through the headless QA runner
PANELS-005 passes through the headless QA runner
PANELS-006 passes through the headless QA runner
PANELS-007 passes through the headless QA runner
PANELS-008 passes through the headless QA runner
PANELS-009 passes through the headless QA runner
PANELS-010 passes through the headless QA runner
PANELS-011 passes through the headless QA runner
PANELS-012 passes through the headless QA runner
PANELS-013 passes through the headless QA runner
PANELS-014 passes through the headless QA runner
PANELS-015 passes through the headless QA runner
PANELS-016 passes through the headless QA runner
PANELS-017 passes through the headless QA runner
PANELS-018 passes through the headless QA runner
PANELS-019 passes through the headless QA runner
PANELS-020 passes through the headless QA runner
THREAD-001 passes through the headless QA runner
THREAD-002 passes through the headless QA runner
THREAD-003 passes through the headless QA runner
THREAD-004 passes through the headless QA runner
THREAD-005 passes through the headless QA runner
THREAD-006 passes through the headless QA runner
THREAD-007 passes through the headless QA runner
THREAD-008 passes through the headless QA runner
THREAD-009 passes through the headless QA runner
THREAD-010 passes through the headless QA runner
Consumer search: qa-runner.ts:qa/ownedQa callers are qa.test.ts, qa-shipped.test.ts and the new fake controls in hub/test/case-deadlines.test.ts. Existing receiptFixtureCase contract unchanged; no wire, CLI/help, settings or role-policy changes.

### impl-2007 · 2026-11-25T13:39:56.150Z

C2 tests: QA setup interruption joins late root work before guarded storage removal; QA setup interruption joins late child work before guarded storage removal. Before migrating the shared runner wrapper, the child control failed with AssertionError: 0 !== 1 (missing stop receipt). After migration both pass. The controls count acquisition/completion/stop once, assert the root still exists in the pre-removal cleanup hook, then observe absence after actual drainFixtureCleanup. An intermediate assertion-hook ordering error was corrected; the complete case-deadlines.test.ts file now passes 12/12 on macOS, Node 24.21.0, local executor. Changed native files pass 30/30 T3 and 32/32 T4, no skips. No suite receipt yet.
