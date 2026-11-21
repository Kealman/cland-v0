# T-2050 ready-transition consumer audit

Internal Daemon-return compatibility search (`serveProject` and `Daemon`, plus
raw object spread/JSON/key readers) found the following callers. The added
Tracker reference is in-process only; CLI discovery/status replies are built
explicitly, and existing fields remain. Harness-return spreads do not carry the
internal Daemon object. Whole-project typecheck covers every caller; native
startup/return behavior remains part of configured importer verification.

- `hub/src/cli/hub.ts`
- `hub/src/hub/daemon.ts`
- `hub/test/account-fixture-env.ts`
- `hub/test/account-fixture-isolation.test.ts`
- `hub/test/fake-harness.test.ts`
- `hub/test/freshness-harness.ts`
- `hub/test/harness.ts`
- `hub/test/inbox-load.ts`
- `hub/test/journal-async.test.ts`
- `hub/test/orphan-servers.test.ts`
- `hub/test/startup-cleanup.test.ts`
- `hub/test/territory-lock.test.ts`
- `hub/test/tracker-ready-native.test.ts`
- `nvim/test/shell-component.test.ts`

## Widened ready-wait audit after configured T2 evidence

Run 59022dad / A-22559 established a missed consumer: 45 merge-queue cases failed
with `Error: reviewed task ready: not within 3000 ms`. The fixture configured
`test="true"`, returned a nonempty patch, posted clear review, and supplied no
completed verification receipt. This is a fixture migration required by T-2050;
the gate correctly held review. The earlier broad inventory was insufficient.

The widened search scans all literal ready task-status comparisons, waits,
assertions, helper calls (including status('ready')), and review-driven event
waits in hub/test, Web tests and QA cases. Host/provider boot, transport hello,
login readiness and text saying 'ready' are separate domains, not task-ready
transitions. Their matches are excluded for that reason. No tests were re-tiered.

| Test file | Fixture and disposition |
| --- | --- |
| `hub/test/verdict-commit-component.test.ts` | openHub fake Git: empty diff / no test command; unchanged. |
| `hub/test/suite-importer-ready.test.ts` | importer fixture: existing persisted completed producer receipt; unchanged. |
| `hub/test/planned-stage.test.ts` | planStageHub / plan-stage-fixture.ts: no configured test command; unchanged. |
| `hub/test/tracker-summary.test.ts` | per-case Tracker: injected receipts and deliberate missing/pending/failed controls. |
| `hub/test/default-subscriptions-workflow.test.ts` | copyPreparedProject territory: no configured test command; unchanged. |
| `hub/test/suite-stage-cover.test.ts` | integrated / close-run-fixture.ts / remote-fixture.ts / projectHub: now injects explicit same-head completed receipt; integrated stage-cover producer retained. |
| `hub/test/stage-qa.test.ts` | stage-qa-support.ts / copyPreparedProject territory: no configured test command; unchanged. |
| `hub/test/scenarios/stage-close.test.ts` | stage-qa-support.ts / territory: no configured test command; unchanged. |
| `hub/test/scenarios/ticket-flow.test.ts` | ticket fixtures: verdict-only no-command flow and existing actual configured verify receipt. |
| `hub/test/tracker-status-component.test.ts` | direct hub status fixtures: explicit status edits / label assertions; no gate migration. |
| `hub/test/merge-queue.test.ts` | shared fixture: configured test=true retained; explicit completed receipt before review; fresh head receives a separate explicit completion. |
| `hub/test/merge.test.ts` | merge-support.ts / observableProject territory: no configured test command; unchanged. |
| `hub/test/merge-policy.test.ts` | local project / preparedProject territory: no configured test command; unchanged. |
| `hub/test/merge-gate.test.ts` | merge-support.ts project territory: no configured test command; unchanged. |
| `hub/test/tracker-ready.test.ts` | direct Tracker/startHub/projectHub fixtures: no configured test command; unchanged. |
| `hub/test/aide-claims.test.ts` | projectHub claimant fixtures: no configured test command; unchanged. |
| `hub/test/tracker-status.test.ts` | status authority fixture: explicit human status edit; unchanged. |
| `hub/test/roles-launch-permissions.test.ts` | role permission fixture: forbidden ready edits; unchanged. |
| `hub/test/plan-gate.test.ts` | planStageHub: no configured test command; unchanged. |
| `hub/test/aide-claims-lifecycle.test.ts` | preparedProject territory: no configured test command; unchanged. |
| `hub/test/task-migrate.test.ts` | legacy migration fixture: no configured test command; unchanged. |
| `hub/test/startup-ready-component.test.ts` | startup/readiness fixtures: no configured test command / seeded statuses; unchanged. |
| `hub/test/heartbeat.test.ts` | heartbeat fixture: explicit human status edits; unchanged. |
| `hub/test/verifier-routing.test.ts` | routing fixtures: explicit human status edits and legacy reservations; unchanged. |
| `hub/test/custom-roles-component.test.ts` | custom claimant: configured test=true but fake task diff empty; existing approved disposition, unchanged. |
| `hub/test/pinned-tracker.test.ts` | static status vocabulary over pinned tracker text; no transition. |
| `hub/test/host-flush-native.test.ts` | host publication fixture: explicit ready admission and no-command local verdict flow; unchanged. |
| `hub/test/tracker-ready-native.test.ts` | native territory/Tracker fixtures: no configured test command; unchanged. |
| `hub/test/lead-routing.test.ts` | lead routing fixture: explicit status-edit authority; unchanged. |
| `web/test/graph.test.ts` | web/items-fixture.ts seedItem status rows; renderer only, no automatic transition. |
| `web/test/board.test.ts` | web/items-fixture.ts seedItem status rows; renderer only, no automatic transition. |

Fixture path key: projectHub/startHub are in `hub/test/harness.ts`;
planStageHub is `hub/test/plan-stage-fixture.ts`; preparedProject and
copyPreparedProject are `hub/test/prepared-project.ts`; native merge helpers
are `hub/test/merge-support.ts`; importer completion setup is in
`hub/test/suite-importer-ready.test.ts` using `hub/test/suite-component-fixture.ts`;
Web setup is `web/test/harness.ts` plus `web/test/items-fixture.ts`.

QA cases `qa/cases/GRAPH-001.lua`, `PANELS-011.lua`, `PANELS-012.lua` and
`PANELS-013.lua` provide explicit ready rows through the stub hub. They exercise
rendering/filtering, not verdict-to-ready settlement. Historical briefs remain
historical evidence. The cases are checked through nvim/test/qa-runner.ts with
fixture-owned HOME/Git state and headless Neovim; no GUI or human browser.

Fixture API consumers: `ready-verification-fixture.ts` binds a fixture-owned
receipt map at Tracker.useVerify, and only an explicit call records a passed
head. It never follows a head change automatically. The merge-queue changed-head
case records a new completion before its next ready wait. The stage-cover case
records its committed task head before review. The configured commands remain.
Single-argument lookup rebinding retains the existing requirement and stage-cover
supplier; the production dispatcher still supplies all three arguments explicitly.
Daemon's in-process return gains an additive Tracker reference, used by the
optional projectHub configureTracker fixture hook after owned shutdown is armed.
Existing Daemon/projectHub callers and wire replies retain their fields and shape;
no new required config, command, wire field or public role capability is added.


The gate previously consulted only gateVerdicts; it never consulted Suites.latest. Thus the reported T-1983 transition did not count either the launching receipt or an older cache entry. This conclusion comes from source and the supplied incident receipt; no live hub database was accessed.

The contract retains status strings and the previous wire shape. Verification is required when the running project config has test or any tier command. No command and an empty task patch against its merge base are the only dispositions. No suite waiver record was found by searching disposition and suite/verify waiver terms across hub/src, skills and docs. verification.decline returns review/QA service to its requester and grants no suite exemption.

Consumers and disposition:

- Tracker #scheduleReady/#checkReady and freshness: migrate to finished, passed, finished-at, exact-tip verification, with the existing shared patch cache for empty diffs. Recheck before publication and on verifyChanged/useVerify binding. Restart binds restored scheduler receipts. Pending/failed/cancelled/absent/stale-head receipts keep review; a new pending run demotes ready to review.
- Suites.latest/verifyResult and dispatcher onJob: latest admitted submission wins, including a pending submission after an older pass. Cache results already have the submitted exact head, finished state and provenance; preserve that protocol. Dispatcher supplies the current configuration requirement.
- Merge #message and enqueue preflight, merge queue and batches: preserve independent verdict and timing checks. They do not themselves require ready or a passed task suite; that separate admission gap is reported to the Coordinator. This item changes automatic ready only, not explicit status-edit authority or merge overrides.
- Core onItem/verifier routing, subscription delivery and visibility: receive the same persisted task status event later; accepted verifier reservations remain until genuine readiness. Heartbeat stale-ready rows read that corrected status without deriving suite success themselves.
- CLI task view/list, explorer/index-db retained rows, Web and Neovim cards/graph/plan: unchanged status and verify payloads. Prior wire fixtures remain compatible. No added required field.
- Roles/skills/QA briefs: the implement flow and tracker docs describe the finished-green requirement; role clause additions explicitly excluded by launch brief. Historical QA briefs and protocol snapshots use the same status labels, no migration needed. Host/spoke 'ready' matches below are a separate lifecycle boundary and unaffected.
- Tests at T1/T2/T3/Web and frozen fixtures: search includes raw status comparisons, gate/function names and fixtures. tracker-summary adds fake-native-guarded Tracker regressions; existing tracker-ready component timing and routing tests retain their verdict-only fixtures because their project has no test command. Native merge/host tests remain unchanged; integrated T3 belongs to the merge batch. No tier changes or proof borrowing.

Search inventory (matching files; separate ready host/session boundaries are unaffected as above):

Additional importer/producer and frozen-reader checks: `hub/src/hub/suites.ts`,
`hub/src/hub/merge-queue.ts`, `hub/src/hub/merge-batches.ts`,
`hub/src/hub/enqueue-preflight.ts`, `hub/src/verification-commands.ts`,
`hub/src/verification-plan.ts`, `hub/src/tracker/freshness.ts`,
`hub/test/fixtures/cli-usage/commands.json` and
`nvim/test/fixtures/protocol-frames*.json` plus its per-view directory.
No help export or wire bytes change; frozen readers retain their exact bytes.
The shared tier-key export replaces the command planner's private tuple, so
configuration admission and readiness use one list.

- `docs/evidence/T-702-assertion-inventory.md`
- `hub/src/cli/task.ts`
- `hub/src/host/provider/digitalocean.ts`
- `hub/src/host/provider/fake.ts`
- `hub/src/host/provision-host.ts`
- `hub/src/hub/core.ts`
- `hub/src/hub/dispatch.ts`
- `hub/src/hub/heartbeat.ts`
- `hub/src/hub/merge.ts`
- `hub/src/hub/visibility.ts`
- `hub/src/tracker/explorer-fields.ts`
- `hub/src/tracker/gate-verdicts.ts`
- `hub/src/tracker/index-db.ts`
- `hub/src/tracker/tracker.ts`
- `hub/test/aide-claims-lifecycle.test.ts`
- `hub/test/aide-claims.test.ts`
- `hub/test/custom-roles-component.test.ts`
- `hub/test/default-subscriptions-workflow.test.ts`
- `hub/test/epic-close.test.ts`
- `hub/test/events.test.ts`
- `hub/test/heartbeat.test.ts`
- `hub/test/host-create-ready.test.ts`
- `hub/test/host-flush-native.test.ts`
- `hub/test/host-flush.test.ts`
- `hub/test/host-provider-contract.ts`
- `hub/test/host-provider-fake.test.ts`
- `hub/test/host-provision-recovery.test.ts`
- `hub/test/host-tunnel-outage-native.test.ts`
- `hub/test/host-unreachable.test.ts`
- `hub/test/host-watchdog-loop.test.ts`
- `hub/test/hosts-state.test.ts`
- `hub/test/item-summary.test.ts`
- `hub/test/lead-routing.test.ts`
- `hub/test/login-provision-bind.test.ts`
- `hub/test/login-release.test.ts`
- `hub/test/merge-gate.test.ts`
- `hub/test/merge-policy.test.ts`
- `hub/test/merge-queue.test.ts`
- `hub/test/merge.test.ts`
- `hub/test/plan-gate.test.ts`
- `hub/test/planned-stage.test.ts`
- `hub/test/pool-failures.test.ts`
- `hub/test/remote-scripted.test.ts`
- `hub/test/roles-launch-permissions.test.ts`
- `hub/test/scenarios/ticket-flow.test.ts`
- `hub/test/spoke-readiness.test.ts`
- `hub/test/stage-closure-component.test.ts`
- `hub/test/stage-qa-support.ts`
- `hub/test/startup-ready-component.test.ts`
- `hub/test/suite-importer-ready.test.ts`
- `hub/test/suite-stage-cover.test.ts`
- `hub/test/task-card-component.test.ts`
- `hub/test/task-migrate.test.ts`
- `hub/test/tracker-ready-native.test.ts`
- `hub/test/tracker-ready.test.ts`
- `hub/test/tracker-status.test.ts`
- `hub/test/tracker-summary.test.ts`
- `hub/test/verdict-commit-component.test.ts`
- `hub/test/verifier-routing.test.ts`
- `nvim/lua/cland/graph.lua`
- `nvim/lua/cland/items.lua`
- `nvim/lua/cland/plan.lua`
- `nvim/lua/cland/vboard.lua`
- `nvim/test/explorer-card-component.test.ts`
- `nvim/test/explorer-outline-fixture.ts`
- `nvim/test/explorer.test.ts`
- `nvim/test/graph.test.ts`
- `nvim/test/plan-component.test.ts`
- `nvim/test/shell-component.test.ts`
- `qa/briefs/E-1537-stage-5.md`
- `qa/briefs/T-270.md`
- `qa/cases/GRAPH-001.lua`
- `qa/cases/PANELS-012.lua`
- `web/src/ItemsGraph.tsx`
- `web/src/ItemsPlan.tsx`
- `web/src/ItemsTree.module.css`
- `web/src/ItemsTree.tsx`
- `web/src/items-tree.ts`
- `web/test/board.test.ts`
- `web/test/graph.test.ts`

