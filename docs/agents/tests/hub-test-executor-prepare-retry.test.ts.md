# hub/test/executor-prepare-retry.test.ts

`node --test hub/test/executor-prepare-retry.test.ts` runs T2 scripted-provider
checks in disposable projects. It covers transient builder-release failures,
neutral `Executor.prepare({})` and `Executor.reap({ authorize })` calls, and typed
local `not-applicable` results without admission, checkpoint or provider effects.
Native image provisioning and CLI rendering remain covered by the existing
executor preparation and droplet tests; the scripted transport does not prove
image contents or SSH behaviour.

## T-373 consumer inventory

The shared interface lives in `hub/src/executor/executor.ts`. Preparation options
carry progress and reaping options carry authorization. Backend results expose
summary and preparation timing/accounting; concrete droplet results retain
snapshot and deleted resource identities. Existing key/callback overloads remain
available to callers holding backend-specific inputs.

Production callers: `hub/src/hub/suites.ts` (local preparation and startup
recovery), `hub/src/hub/dispatch.ts` (authorized droplet reap and asynchronous
prepare), and `hub/src/executor/droplet/droplet.ts` (submitPrepare and sweep).
Local recovery now calls `reconcile`, preserving its previous work; interface
`reap` is a no-op. Local preparation callers no longer supply an unused identity.

Direct tests: `executor-prepare-retry.test.ts` retains the captured-key overload
and adds neutral interface calls. `executor-contract.test.ts` checks the nine
operations. Recovery mocks move from `reap` to `reconcile` in
`suite-unit-fixture.ts`, `suite-component-fixture.ts`, `task-card-component.test.ts`,
`executor-liveness.test.ts`, `verify-submission.test.ts`,
`suite-human-component.test.ts`, `suite-persistence.test.ts`,
`suite-queue-policy.test.ts` and `merge-queue.test.ts`. Preparation mocks are
removed so fixtures use the production no-op.

Searches included method names, string-based prototype mocks, interface imports,
PrepareKey/Prepared, submitPrepare and executor.prepare/executor.reap frame names
across hub/web/Neovim/shared, all test tiers, docs, skills and QA briefs.
Other `.prepare` calls are SQLite statements. `prepare-key.test.ts`,
`droplet-fixture.ts`, snapshot recovery and persisted snapshot readers still use
the unchanged backend key/snapshot contract. Remaining interface imports use
Lease, Platform, RunRef, RunStatus or ExecutorKind and are unaffected.

CLI/frame consumers retain their previous shapes: `hub/src/cli/executor.ts`,
protocol/dispatch, web authority checks, executor preparation/component/safety,
droplet/component and scenario tests, `qa/briefs/T-271.md`, executor docs and
shipped skill instructions. `submitPrepare` and reap keep the exact previous
objects and summary bytes, so neither help nor the wire schema changes. An older
hub remains compatible with the unchanged CLI. No gate or permission is added.

## Setup and effect ownership

The neutral-interface proof composes `caseDeadlines` (pre-owned acquisition and
late fixture hooks) with `uploadOwner` (shared setup/result/drain controls).
Acquisition is registered before launch; setup and method results have separate
bounds. The owner closes the backend and stops the hub, joins tracked operations,
and gates all fixture roots on successful disposal. No copied timeout policy is
introduced. Omitted/aborted setup controls hold preparation at its key receipt,
then prove cancellation releases and joins its exact result with zero pending
operations or setup timers before fixture/root cleanup.
