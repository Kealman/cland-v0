---
id: T-2007
kind: task
title: Migrate the remaining QA test callers (qa.test, qa-shipped via qa-runner) to whole-caller fixture ownership
state: open
status: ready
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
updated: 2026-11-26T19:16:57.677Z
---

## Summary

The existing QA test callbacks in `nvim/test/qa.test.ts`, and the T4 `nvim/test/qa-shipped.test.ts` through `qa-runner.ts`, still use raw test contexts. Their async root and setup work runs before the child process starts, with no whole-caller owner or join. T-1805 migrated only its five new QA controls to `receiptFixtureCase` (rev-36 source review 4, A-21807). impl-1805 found the rest by reading the code on 2026-11-19; nothing reproduced.

## What to build

Migrate the remaining QA callers to the shared whole-caller fixture ownership that T-1805 used: pre-acquisition normal and signal ownership, named setup bounds, and joins of original work, late roots and children before storage cleanup. Keep every QA case's assertions unchanged.

## Acceptance criteria

- [x] C1. Every callback in `nvim/test/qa.test.ts` and `nvim/test/qa-shipped.test.ts` that acquires a root or child runs under whole-caller fixture ownership, listed by name in the item (test).
  - done: impl-2007 · 2026-11-26T19:16:08.732Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2007-final · 2026-11-26T19:16:56.154Z · commit b7ae99b5c5ef68d1188a0f5ee2652d36030d2afa
- [x] C2. A control interrupting setup mid-acquisition shows the root and child joined before storage removal (test).
  - done: impl-2007 · 2026-11-25T14:14:41.604Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2007-final · 2026-11-26T19:16:56.154Z · commit b7ae99b5c5ef68d1188a0f5ee2652d36030d2afa

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

### rev-35 · 2026-11-25T13:46:03.652Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2007-source-1
commit: 8ad4ea3b119345ebfc7b5cee2259d89fd17ca784
scope: full
findings: [{"severity":"medium","text":"M1: Dump client is assigned only after startClient's post-spawn RPC setup. The early release cannot see its child while that setup is pending; ownStubClient cleanup on the proxy is behind the whole-case join. No early-capture/case-interruption proof covers this migrated C1 caller.","file":"nvim/test/qa.test.ts","line":413},{"severity":"medium","text":"M2: Fake interrupted child's kill only increments stopped/resolves resume; callback completed counts settlement, not independently held child close. Null exit/signal fields remain and no delayed close is observed, so root removal can be credited after a stop request rather than positive child closure. C2 proof gap confirmed.","file":"hub/test/case-deadlines.test.ts","line":28}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23439 consolidates both confirmed medium findings and clear bar. Preserve existing root control/all QA assertions/whole-caller ownership; complete added proof callbacks and fallback releases must be pre-enrolled with named setup/proof bounds. Other migrated callbacks and moved ownedQa logic reviewed without another finding. Local12/30/32 and related checks scoped, stop-count red retained as stop-request proof only. Hold released for correction; fresh committed-head source review before verification; human midnight/Coordinator budget hold remains. Reviewer ran no tests/lint/probes/native/Neovim/browser.

Criteria: C1 failed (M1: enroll dump-client child stop before joining held post-spawn RPC setup, with positive closure before storage release.), C2 failed (M2: hold/observe independent child closure, assert root retained before it, then original completion and real guarded removal.).

### impl-2007 · 2026-11-25T13:48:13.105Z

Review correction M1 consumer search before adding optional opts.started to createClient: searched createClient/startClient/ownStubClient/screenPollMs in production test clients, fixtures, docs, skills, all tiers and frozen JSON. Consumers below retain identical behavior when started is absent; harness.ts forwards the options object unchanged. Only the QA dump callback will opt in. No wire, persisted format or CLI text changes.
nvim/README.md
nvim/test/stub-client.ts
nvim/test/verification-view.test.ts
nvim/test/verification-queue.test.ts
nvim/test/rulebook-component.test.ts
nvim/test/shell-fixture.ts
nvim/test/explorer-summary.test.ts
nvim/test/declined-ask-component.test.ts
nvim/test/sessions-lifecycle.test.ts
nvim/test/explorer-roots-component.test.ts
nvim/test/harness.ts
nvim/test/headless-launch.ts
nvim/test/explorer-card.test.ts
nvim/test/events-quiet.test.ts
nvim/test/artifact-browser.test.ts
nvim/test/client.test.ts
nvim/test/thread.test.ts
nvim/test/explorer-compose.test.ts
nvim/test/layers-component.test.ts
nvim/test/hub-read-component.test.ts
nvim/test/ui.test.ts
nvim/test/explorer-outline-fixture.ts
docs/agents/tests.md
hub/test/tier-tripwire-runner.test.ts
hub/test/test-lint.test.ts
hub/test/fixture-orphans-lifecycle.test.ts
nvim/test/criteria.test.ts
nvim/test/rulebook.test.ts
nvim/test/scenarios/workbench.test.ts
nvim/test/crew.test.ts
nvim/test/startup-budget-support.ts
nvim/test/client.ts
nvim/test/hosts-native.test.ts
nvim/test/human-marks-component.test.ts
nvim/test/item-prefixes.test.ts
nvim/test/plan.test.ts
hub/test/cover-quiet.test.ts
nvim/test/graph.test.ts
nvim/test/session-resume.test.ts
nvim/test/explorer.test.ts
nvim/test/account-poll.test.ts
nvim/test/criteria-component.test.ts
nvim/test/needs-you.test.ts
nvim/test/inbox-sections.test.ts
nvim/test/inbox-requests.test.ts
nvim/test/plan-component.test.ts
nvim/test/inbox-actions.test.ts
nvim/test/progress-counts-component.test.ts
nvim/test/palette.test.ts
nvim/test/thread-oracle.ts
nvim/test/remote-via.test.ts
nvim/test/vboard.test.ts
nvim/test/plan-support.ts
nvim/test/palette-component.test.ts
nvim/test/layers.test.ts
nvim/test/message-users.test.ts
nvim/test/artifact-screen-fixture.ts
nvim/test/events.test.ts
nvim/test/qa.test.ts
nvim/test/host-attach.test.ts
nvim/test/message-users-live.test.ts
nvim/test/session-archive.test.ts
nvim/test/artifact-browser-component.test.ts
nvim/test/remotes.test.ts
nvim/test/closed-pages.test.ts
nvim/test/telegram-marks.test.ts
nvim/test/client-component.test.ts
hub/test/fixtures/test-lint-sources.json
nvim/test/artifact-upload.test.ts
nvim/test/explorer-compose-component.test.ts
nvim/test/explorer-roots.test.ts
nvim/test/explorer-card-component.test.ts
nvim/test/shell.test.ts
docs/evidence/T-709-admission-audit.md
docs/evidence/T-709-validation.md
docs/evidence/T-709-neovim-frame-audit.md
docs/agents/tests/nvim-test-qa.test.ts.md

### impl-2007 · 2026-11-25T13:51:33.060Z

Review M1 correction: new retained dump client interruption during held RPC attach retains storage until independent child close calls actual createClient with a positively guarded fake spawn and real local msgpack RPC socket. The peer holds nvim_ui_attach. Before opts.started publication, red was early dump child stop request observed: deadline exceeded after 5000 ms; the corrected-fallback red run completed with exactly one failed test and no worker-drain failure. After early handle publication and independent close enrollment, changed file passes 13/13. The control observes the stop request while closeCount/completed are zero and root remains, then closes/joins socket server, publishes close, joins original RPC failure and actual guarded removal. M2 child control now independently holds nativeClose after stop, verifies root retained and original incomplete, then publishes close before removal; root-acquisition control preserved. All proof/fallback release and cleanup owners are registered before acquisition. Intermediate fake-only exitCode assignment type errors corrected; final full typecheck passed. Full lint is running. client.ts adds only an optional started callback after ownership enrollment and before connect/attach; previous omitted-options shape remains unchanged. Frozen test-lint fixture snippets use the old supported shape and need no edit. Updated graph: 73 known affected tests plus 19 incomplete graphs (92 conservative), not a full local closure receipt.

### rev-35 · 2026-11-25T14:01:45.021Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2007-source-2
commit: 0a429f44f1c8b0516bd612c1e1a5e6f1f160c255
scope: full
findings: [{"severity":"medium","text":"M3: Memoized finish can complete before fakeSpawn/listen and publish synthetic close; fallback awaits original before closing nested owner. A late listen can outlive the cached finish receipt. No retained admission/late-resource join fence covers pre-listen interruption; successful held-attach proof starts after listen.","file":"hub/test/case-deadlines.test.ts","line":51},{"severity":"medium","text":"M4: Existing KEYS-002 product --timeout120 remains, but new receiptFixtureCase/ownedQa original and completion observers default to60s. No per-case budget preserves the120s product allowance plus headroom, and no approved shortening exists.","file":"nvim/test/qa.test.ts","line":334}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23450 consolidates remaining M3/M4 bar; exact pinned locators are case-deadlines:51 and qa:334 (the note's45/335 are offset). Prior M1/M2 early-capture/independent-close corrections retained. Fix fallback terminal/admission ordering and existing120s allowance; preserve all controls/assertions/old option shape/defaults, no new120s timing run or broader rewrite requested. Both retained-source answers confirm gaps. Hold released for corrections; fresh committed-head review before verification; human midnight/Coordinator spending hold remains. Reviewer ran no tests/lint/probes/native/Neovim/browser.

Criteria: C1 failed (M4: preserve existing120s QA product allowance with scoped owner/completion headroom and separate setup bounds.), C2 failed (M3: fence late fake listen, close nested owner before joining original and prove pre-listen fallback retains/joins resources without premature close.).

### impl-2007 · 2026-11-25T14:04:55.920Z

M4 additive test-helper budget consumer search before change: caseDeadlines/receiptFixtureCase/ReceiptStep names, imports and raw callers across hub/nvim tiers, fixtures, docs and shipped skills. Listed paths below retain existing default bounds and signatures; optional completion owner budget and per-step override are opt-in only for KEYS-002 and fake-clock controls. Previous omitted-options shape remains covered by existing default-owner tests. No wire, CLI/help or persisted format changes.
nvim/test/qa-shipped.test.ts
hub/test/lint-baseline.json
hub/test/suite-soak-component.test.ts
nvim/test/qa.test.ts
hub/test/durations.json
nvim/test/qa-runner.ts
hub/test/session-host.test.ts
docs/evidence/T-1858-consumers.md
hub/test/evidence-publish.test.ts
hub/test/web-authority.test.ts
docs/agents/tests/hub-test-dev-t3-search-component.test.ts.md
docs/agents/tests/hub-test-executor-droplet-component.test.ts.md
hub/test/sqlite-hot-reads.test.ts
docs/agents/tests/hub-test-import-github.test.ts.md
hub/test/suite-retention-fixture.ts
docs/agents/tests/hub-test-codex-delivery.test.ts.md
docs/agents/tests/hub-test-evidence-publish.test.ts.md
hub/test/harness-framing.test.ts
hub/test/executor-safety.test.ts
hub/test/tracker-conflict-captures.test.ts
hub/test/host-ssh-registry.test.ts
hub/test/suite-accounting.test.ts
hub/test/tier-tripwire-component.test.ts
hub/test/aide-migration.test.ts
hub/test/suite-log-backfill.test.ts
docs/agents/tests/hub-test-merge-batch-dependencies.test.ts.md
docs/agents/tests/hub-test-suite-protocol.test.ts.md
docs/agents/tests/hub-test-merge-batches.test.ts.md
hub/test/executor-copy-fixture.ts
hub/test/suite-remote-log.test.ts
hub/test/suite-candidate.test.ts
docs/agents/tests/hub-test-host-ref-watch-recovery.test.ts.md
hub/test/suite-case-fixture.ts
docs/agents/tests/hub-test-suite-accounting.test.ts.md
hub/test/fixture-residue-control.ts
docs/agents/tests/hub-test-doctor.test.ts.md
docs/agents/tests/web-test-hosts-view.test.ts.md
hub/test/inject-stalled.test.ts
docs/agents/tests/hub-test-host-destroy.test.ts.md
hub/test/dev-t3-search-component.test.ts
hub/test/suite-close-component.test.ts
hub/test/suite-runner.test.ts
docs/agents/tests/hub-test-executor-contract.test.ts.md
hub/test/gateway-state.test.ts
hub/test/config-set.test.ts
hub/test/merge-batch-dependencies.test.ts
docs/agents/tests/hub-test-case-deadlines.test.ts.md
hub/test/test-lint-policy.test.ts
docs/agents/tests/hub-test-executor-prepare-retry.test.ts.md
docs/agents/tests/hub-test-outbox-gateway.test.ts.md
hub/test/suite-protocol.test.ts
hub/test/setup-remotes.test.ts
hub/test/suite-close-recovery.test.ts
docs/agents/tests/hub-test-verifier-routing.test.ts.md
docs/agents/tests/hub-test-heartbeat.test.ts.md
hub/test/host-ref-watch-recovery.test.ts
docs/agents/tests/hub-test-executor-lease-index.test.ts.md
hub/test/outbox-gateway.test.ts
hub/test/claude-stop-owner-component.test.ts
docs/agents/tests/hub-test-suite-soak-component.test.ts.md
hub/test/host-destroy.test.ts
docs/agents/tests/hub-test-host-survival.test.ts.md
hub/test/suite-persistence.test.ts
hub/test/executor-droplet-component.test.ts
docs/agents/tests/hub-test-suite-log-backfill.test.ts.md
docs/agents/tests/hub-test-session-retry.test.ts.md
docs/agents/tests/hub-test-suite-close-component.test.ts.md
hub/test/executor-lease-index.test.ts
docs/agents/tests/hub-test-suite-soak.test.ts.md
hub/test/fake-harness.test.ts
hub/test/receipt-fixture-case.ts
hub/test/git-maintenance.test.ts
docs/agents/tests/nvim-test-qa.test.ts.md
docs/agents/tests/hub-test-process-cleanup.test.ts.md
docs/agents/tests/hub-test-config-set.test.ts.md
hub/test/suite-billing-fixture.ts
hub/test/case-deadlines.test.ts
hub/test/heartbeat.test.ts
docs/agents/tests/hub-test-host-destroy-native.test.ts.md
hub/test/import-github.test.ts
hub/test/login-add.test.ts
docs/agents/tests/hub-test-suite-runner.test.ts.md
docs/agents/tests/hub-test-inject-stalled.test.ts.md
hub/test/telegram-liveness.test.ts
docs/agents/tests/hub-test-merge-queue.test.ts.md
hub/test/account-fixture-env.ts
hub/test/claude-code-schedule.test.ts
hub/test/case-deadlines.ts
hub/test/merge-queue.test.ts
hub/test/worktree-cli.test.ts
docs/agents/tests/hub-test-aide-migration.test.ts.md
hub/test/fixture-orphans.test.ts
hub/test/suite-soak.test.ts
hub/test/rename-case.ts
docs/agents/tests/index.md
hub/test/verifier-routing.test.ts
docs/agents/tests/hub-test-suite-persistence.test.ts.md
docs/agents/tests/hub-test-suite-remote-log.test.ts.md
hub/test/executor-prepare-retry.test.ts
docs/agents/tests/hub-test-setup-remotes.test.ts.md
hub/test/session-retry.test.ts
hub/test/merge-batches.test.ts
hub/test/connection-snapshot.test.ts
hub/test/transport-status.test.ts
hub/test/tiers.json
hub/test/executor-prepare-component.test.ts
docs/agents/tests/hub-test-claude-code-schedule.test.ts.md
hub/test/host-survival-native.test.ts
hub/test/executor-run.test.ts
hub/test/host-destroy-native.test.ts
hub/test/executor-lease-fixture.ts
hub/test/executor-prepare.test.ts
hub/test/suite-cover.test.ts
hub/test/recovery-scan.ts
hub/test/gateway.test.ts
hub/test/digitalocean-pacing.test.ts
hub/test/doctor.test.ts
hub/test/host-survival.test.ts
hub/test/inbox-query.test.ts

### impl-2007 · 2026-11-25T14:10:49.718Z

M3 correction: finish now fences fake native admission synchronously, waits the acquired listening receipt, joins server close, and publishes child close only for an admitted child. Outer cleanup initiates nested owner closure before joining original. Retained pre-listen control first failed 1 !== 0 for premature child-close publication, then passed with one late attempt refused before listen and no published child-close. M4 correction: ReceiptStep/caseDeadlines.wait accept an additive per-operation bound; receiptFixtureCase completionMs raises owner teardown and optional sequence-join backstop while keeping setup steps and omitted defaults unchanged. KEYS-002 passes one computed120s+shared headroom budget to owner/original/completion; startup retains its setup default. Optional clock injects deterministic fake control. Existing source-consumer inventory includes these helpers; joinTimeoutMs raw default remains fixtureWork35s when omitted. Fake-clock controls separately cover setup cutoff, full simulated120s completion, and owner closure held across that work. No real120s timing run. Shared-helper graph744 known affected +19 incomplete=763 conservative, not local full closure.

### rev-40 · 2026-11-25T14:16:48.389Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2007-source3
commit: b7ae99b5c5ef68d1188a0f5ee2652d36030d2afa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23462 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23462-t-2007-correction-source-clear-at-b7ae99b5c.md), no findings. M3 fixed by synchronous fake-admission fence, listening/server-close join before acquired-child close, no close for unadmitted child, and nested close before original join; pre-listen and held-attach controls retain actual guarded removal assertions. M4 preserves product120s plus shared headroom through original/completion/owner/sequence-join budgets with separate setup default. Prior early-handle and independent-close M1/M2 retained. Shared optional contracts and callback/consumer inventories inspected; omitted defaults unchanged. A-23460 current owner17/17/static0 and selected importers are scoped; native30/32 samples precede final undefined-option omission and are not exact-final native proof. C1/C2 final marks pending exact-head configured evidence with actual QA caller/guard coverage. Earlier failed/interrupted rounds retained. Human midnight UTC hold/Coordinator window unchanged. Reviewer made no edits or executions.

### rev-40 · 2026-11-26T02:44:27.028Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261126-2007-evidence1
commit: b7ae99b5c5ef68d1188a0f5ee2652d36030d2afa
scope: evidence
findings: [{"severity":"medium","text":"E1: configured run143/deadline75m/package closure incomplete; changed qa-shipped catalogue incomplete (GRAPH-001/PANELS-019 unfinished), no completeT4/Web.","file":".cland/artifacts/A-23537-suite-2c7ccbb2-56a5-43df-9a14-c8d01da9caea-auto-at-b7ae99b.log","line":53051},{"severity":"low","text":"L1: GRAPH-001 timingpass conflicts with producer unfinished and absent finish; no completion credit. S Bugs follow-up/deduplicate timing-progress reporting.","file":".cland/artifacts/A-23537-suite-2c7ccbb2-56a5-43df-9a14-c8d01da9caea-auto-at-b7ae99b.log","line":53053}]
finding_counts: {"high":0,"medium":1,"low":1}

Evidence not clear; A-23538 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23538-t-2007-configured-evidence-not-clear-at-b7ae99b5c.md). Producer143/deadlineExpiredtrue primaryrun timeout75m, secondarypackage closure incomplete/machine deletionrequired; complete T0/T1/T2/T3exit0, no completeT4/Web, canonicala1def99f executablematch. Producer confirms exactlyGRAPH/PANELS unfinished; timingpassGRAPH not positive completion. All7 new owner controls base+5/5 and owner17unique cases pass, QA27pass/3skip inclKEYS002, shipped19finishpass retained. C2 positive control assertions not failed, but final marks pending overall completion. Linuxc8nyc1 workers2 Node24.21/Nvim0.12.5 noncache,12skips,no browser, budget noticesadvisory. Hold released; pin source for lead/Coordinator disposition, no Reviewer edit/probe/retry.

Criteria: C1 failed (Configured2c7ccbb2 timed out with incomplete package closure; only19 shipped positive finish receipts, GRAPH-001/PANELS-019 unfinished, later catalogue unexecuted.).

### rev-40 · 2026-11-26T18:31:28.446Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261126-2007-evidence2
commit: b7ae99b5c5ef68d1188a0f5ee2652d36030d2afa
scope: evidence
findings: [{"severity":"medium","text":"E1: configured T3 exit1; prune restart fails foreground discovery with process inspection deadline diagnostic. Both QA catalogues, T4 and Web unexecuted; final every-caller coverage incomplete. Structured cause empty/unknown.","file":".cland/artifacts/A-23560-suite-5e40e738-948e-4af6-8c9d-790e69f5187c-auto-at-b7ae99b.log","line":52126},{"severity":"low","text":"L1 retained: prior GRAPH-001 timing pass conflicts with producer unfinished/absent finish. This retry never executes catalogue and supplies no resolution; reporting follow-up remains separate.","file":".cland/artifacts/A-23537-suite-2c7ccbb2-56a5-43df-9a14-c8d01da9caea-auto-at-b7ae99b.log","line":53053}]
finding_counts: {"high":0,"medium":1,"low":1}

Evidence not clear; A-23563 records exact-head failed 5e40e738/A-23560. Producer1/cause empty, deadlineExpired/packageClosure absent (unknown), unfinished[]. T0/T1/fallbackT2 complete0, selectedT3 complete1; QA catalogue/T4/Web unexecuted. Literal failure: foreground hub durable discovery not within20000ms; recovery reservation process inspection deadline reached, writers fenced. No source-cause inference from diagnostic. Owner17 unique/52 pass rows retain C2 positive assertions; C2 not failed. Noncached Linuxc16nyc1 workers4 Node24.21/Nvim0.12.5,9 prerequisite skips, browsernull, budgetsreportonly. Prior143 timeout and GRAPH conflict retained. Implementer cites Coordinator T-2031 attribution/one retry; admitted0d880984 is pending, not pass. Hold released; no Reviewer executions.

Criteria: C1 failed (Configured 5e40e738 fails T3 prune restart; QA catalogue/T4/Web unexecuted, so every-caller final evidence remains incomplete.).

### rev-40 · 2026-11-26T19:16:56.154Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261126-2007-final
commit: b7ae99b5c5ef68d1188a0f5ee2652d36030d2afa
scope: evidence
findings: [{"severity":"low","text":"L1 retained: historical GRAPH-001 timing pass conflicts with absent finish/producer unfinished. Current run supplies actual pass completion but does not repair old reporting; existing S Bugs/T-2108 follow-up remains separate.","file":".cland/artifacts/A-23537-suite-2c7ccbb2-56a5-43df-9a14-c8d01da9caea-auto-at-b7ae99b.log","line":53053}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear; A-23587 audits0d880984/A-23586 at unchanged source3 b7ae99b5c. Producer0/cause empty/unfinished[]; complete T0–T4/Web exit0 at canonicala1def99f, executablematch. C1: actual shipped32/32 finishes incl GRAPH001/PANELS019, qa.test27pass/3declared macOS sandbox skips; every callback source ownership retained. C2: owner17unique/52pass rows, all7new exact controls base+5/5 retaining late root/child join and guarded removal proofs. Linuxc16nyc1 workers4 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156 noncache,12prerequisite skips, budget/skip checksreportonly. T4onecataloguefile32identitiesonce; remainingT3batch/otherT4unexecuted. Prior143timeout and code1prune failure remain failed; historical timing-conflict low retained separately. Both criteria verified; no high/medium findings. Hold released. No Reviewer executions.

Criteria: C1 verified, C2 verified.
