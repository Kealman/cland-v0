# Stage QA brief: E-1216 stage 3 — re-qualification with durable usage

## Stage

- Epic: E-1216.
- Exact stage name: re-qualification with durable usage.
- Items: T-1271, T-1266 (two lanes).
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of T-1271 (a review or QA request whose first line continues after the item id resolves one verifier and never broadcasts; Lead scope and the heartbeat's pending-review row use the same matcher) and T-1266 (the grouped parsed-metadata recorder case fits the 2 s T2 budget with its assertions unchanged). This run is also E-1216's post-fix QA qualification run (DoD C2/C3): the QA session must be an OpenCode session.

Read membership, counts and other plan facts from `task plan show E-1216` at the run; retain its output instead of writing numeric stage totals here.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt (an `Item: T-n` trailer on dev). A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester.

Give the detached worktree `node_modules` and `hub/node_modules` symlinks to the project root's installed dependencies before running any test.

## Cases

none

### Web cases (when in scope)

none

## Manual checks

Selectors and names: the test file paths and the test titles named below were verified against the item branches' source before landing (T-1271 at 12694139, T-1266 at c844df2e); recheck them with grep at the tested build.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test hub/test/verifier-resolver.test.ts` in the detached worktree | exit 0; the case "a first line that continues after the item is one verifier request, never a role broadcast" passes |
| M2 | hub-api | `node --test hub/test/lead-permissions-component.test.ts` in the detached worktree | exit 0 |
| M3 | hub-api | `node --test hub/test/heartbeat.test.ts` in the detached worktree | exit 0; the case "bare and prefixed continued requests suppress the missing-review row while an unrelated review stays stale" passes |
| M4 | hub-api | `node --test --test-name-pattern="demo recorder scans parsed JSON metadata" hub/test/skills-qa.test.ts` in the detached worktree | exit 0; that one case passes; record its reported duration (the 2 s budget is report-only, so a slower local sample is noted, not failed) |
| M5 | hub-api | `node hub/bin/cland.ts session list --archived --json` from the project root (read-only) | the rows oc-1270, oc-1271 and oc-1266 (harness opencode) each carry `usage.total` with `totalTokens` > 0 and a numeric `cost`; record each value |

Run M1–M4 one file at a time. Record every check with `qa-record.sh note` under E-1216 and one unique run id; retain the captures in the project's .cland/qa tree. Report the QA session's own usage (`session list --json`, your row) in the verdict text.

## Probes that mislead

- M5 reads the live hub; never mutate it. A row that is still running shows its current total, which is fine.
- `node --test` exit 0 with a name pattern that matches nothing is not a pass: confirm the named case appears in the output.
- Re-check helper and test names with grep at the tested build; renames happen.

## Out of scope

The full T3/T4 suites (the stage cover pair covers them), real browsers, provider calls, and any change to sessions, holds or the tracker.

## Grants

none
