# Stage QA brief: E-1283 stage 1 — clauses, lint and early actions

## Stage

- Epic: E-1283.
- Exact stage name: clauses, lint and early actions.
- Items: T-1275, T-1260 (one lane); T-1225; T-323; T-1300.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the stage.
  - T-1275: the onboarding skill, the Aide's role clause and hub/README say the Aide commits root `dev` and runs `cland push` only with root Git write access. Otherwise the Coordinator commits and publishes, map-only onboarding included.
  - T-1260: a session refused a test slot by cover-quiet receives one durable slot-available report and does not poll; the clause wording says so within its byte reserve.
  - T-1225: `cland qa lint` and runtime verification admission share one authorization decision, so Aide verification rows the clause allows are no longer rejected.
  - T-323: plan navigation (`gp` and plan commands) and the launcher role, when issued before the initial task, ladder and role snapshots, are deferred until those arrive, instead of being discarded.
  - T-1300: every `cland task` subcommand answers `--help` with its own usage and exit 0.

Read membership, counts and other plan facts from `task plan show E-1283` at the run; retain its output instead of writing numeric stage totals here.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt (an `Item: T-n` trailer on dev). A dirty build, missing required merge or moved dev blocks this run; retain any collected evidence and report to the requester.

Give the detached worktree `node_modules` and `hub/node_modules` symlinks to the project root's installed dependencies before running any test.

## Cases

none

### Web cases (when in scope)

none

## Manual checks

Selectors: the test files below are the ones each item changed on dev. Recheck named cases with grep at the tested build; renames happen.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test hub/test/roles-clauses.test.ts`, then `node --test hub/test/roles-editor.test.ts`, in the detached worktree | both exit 0 (T-1275 generated and migrated clause wording; T-1260 clause lines) |
| M2 | hub-api | `grep -nE "root Git (write|metadata) access" .agents/skills/onboarding/SKILL.md hub/README.md .cland/roles.toml hub/src/roles/default-roles.ts` in the detached worktree | the onboarding skill, the README, the project's Aide clause and the default Aide clause each state the conditional: commit and push only with root Git write access, otherwise the Coordinator commits and publishes. No remaining line tells the Aide to commit or push unconditionally |
| M3 | hub-api | `node --test hub/test/test-admission.test.ts` in the detached worktree | exit 0; the T-1260 slot-available cases pass (one durable report per refusal, no polling) |
| M4 | hub-api | `node --test hub/test/suite-admission.test.ts` in the detached worktree | exit 0; the T-1225 common Aide case matrix passes through both the lint and the runtime admission paths |
| M5 | hub-api | `node --test nvim/test/plan-component.test.ts`, then `node --test nvim/test/launcher-component.test.ts`, in the detached worktree | both exit 0; the T-323 delayed-snapshot cases pass in both snapshot orders |
| M6 | hub-api | `node --test hub/test/cli-command-help.test.ts`, then `node --test hub/test/cli-help.test.ts`, in the detached worktree | both exit 0 (T-1300) |
| M7 | hub-api | `node hub/bin/cland.ts task criterion --help; echo "exit $?"` from the detached worktree | prints the criterion subcommand's own usage, with no "Unknown option" line, and `exit 0` |

Run M1 and M3–M6 one file at a time, and never in parallel with each other. M5 uses sealed headless Neovim from the tests themselves; it starts no workbench. Record every check with `qa-record.sh note` under E-1283 and one unique run id; retain the captures in the project's .cland/qa tree.

Before requesting QA, run `cland qa lint qa/briefs/E-1283-stage-1.md` at the build under test.

## Probes that mislead

- The live hub and the live workbench run the code of their last restart, not the tested dev SHA. Live clause text delivered to running sessions, and live Neovim behaviour, are not evidence for this stage; the build's files and tests are.
- M7 runs the build's CLI from the detached worktree. A `cland` on PATH, or the root's CLI, may be older.
- `node --test` exit 0 with a name that matches nothing is not a pass: confirm the named cases appear in the output.
- Re-check case names with grep at the tested build; renames happen.

## Out of scope

The full T3/T4 suites (the stage cover pair covers them), a real onboarding run on a new project, the real workbench GUI or a browser, a hub restart, and any change to sessions, holds or the tracker.

## Grants

none
