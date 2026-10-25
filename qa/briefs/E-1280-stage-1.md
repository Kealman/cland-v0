# Stage QA brief: E-1280 stage 1 — deaf sessions, long threads and logins

## Stage

- Epic: E-1280.
- Exact stage name: deaf sessions, long threads and logins.
- Items: T-1256, T-1224 (one lane); T-1265; T-1230, T-1302 (one lane); T-1258.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the stage.
  - T-1256: a Claude Code delivery counts as injected only on a model turn, not on a bridge acknowledgement after a re-exec. Unconfirmed Coordinator deliveries alert General and the named Aide after five minutes, despite reconnects.
  - T-1224: Codex sessions get a 120 s inject-stalled grace measured from the hub's serving receipt.
  - T-1265: a long Codex thread reattaches with a metadata-only `thread/resume` (`excludeTurns`), and a reply over the frame limit names `payload limit` on the row.
  - T-1230: role clause assembly no longer rescans the skills directory synchronously on every hello.
  - T-1302: the roles-timing test waits on the refresh completion receipt that T-1230 made asynchronous.
  - T-1258: OpenCode `Model unavailable` errors and `cland doctor` name the database whose provider credentials are missing, and print the standalone login command.

Read membership, counts and other plan facts from `task plan show E-1280` at the run; retain its output instead of writing numeric stage totals here.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt (an `Item: T-n` trailer on dev). A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester.

Give the detached worktree `node_modules` and `hub/node_modules` symlinks to the project root's installed dependencies before running any test.

## Cases

none

### Web cases (when in scope)

none

## Manual checks

Selectors: the test files below are the ones each item changed on dev. Recheck every named case with grep at the tested build; renames happen.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test hub/test/claude-code-schedule.test.ts` in the detached worktree | exit 0; the case "Claude re-exec bridge acknowledgement without a model turn remains unconfirmed" passes (T-1256 C1) |
| M2 | hub-api | `node --test hub/test/inject-stalled.test.ts` in the detached worktree | exit 0; the case "five minutes of unconfirmed Coordinator delivery alerts General and the named Aide despite reconnect" passes (T-1256 C2) |
| M3 | hub-api | `node --test hub/test/mod-bridge.test.ts` in the detached worktree | exit 0 |
| M4 | hub-api | `node --test hub/test/codex-delivery.test.ts` in the detached worktree | exit 0; the T-1224 startup-grace cases (grace anchored at the serving receipt, including the delayed-initialization case) pass |
| M5 | hub-api | `node --test hub/test/codex-native.test.ts` in the detached worktree | exit 0; the T-1265 long-thread reattach and `payload limit` cases pass |
| M6 | hub-api | `node --test hub/test/codex-adapter.test.ts` in the detached worktree | exit 0, including "Codex launches Implementer with narrow workspace roots, QA full access, Reviewer read-only, and the configured T-48 profile (T-1222)", which now asserts `excludeTurns` on resume |
| M7 | hub-api | `node --test hub/test/roles-component.test.ts`, then `node --test hub/test/config-reload-component.test.ts`, then `node --test hub/test/roles-timing.test.ts`, in the detached worktree | all exit 0 (T-1230, T-1302) |
| M8 | hub-api | `node --test hub/test/doctor-harness-probe.test.ts`, then `node --test hub/test/opencode-launch-policy.test.ts`, then `node --test hub/test/opencode-native.test.ts`, in the detached worktree | all exit 0 (T-1258) |

Run M1–M8 one file at a time, and never in parallel with each other. Record every check with `qa-record.sh note` under E-1280 and one unique run id; retain the captures in the project's .cland/qa tree.

Before requesting QA, run `cland qa lint qa/briefs/E-1280-stage-1.md` at the build under test.

## Probes that mislead

- The live hub runs the code of its last restart, not the tested dev SHA. Never use live-session behaviour, such as a Codex row's state or an inject-stalled notice in Agents, as evidence for this stage. The tests above are the evidence.
- Never run a live `cland doctor` here: it calls the real harness credential probes against the human's HOME (rule 15). T-1258's doctor behaviour is covered by M8's sealed tests.
- `node --test` exit 0 with a name that matches nothing is not a pass: confirm each named case appears in the output.
- Re-check case names with grep at the tested build; renames happen.

## Out of scope

The full T3/T4 suites (the stage cover pair covers them), real providers and real Claude Code/Codex/OpenCode binaries, real browsers, a hub restart, and any change to sessions, holds or the tracker.

## Grants

none
