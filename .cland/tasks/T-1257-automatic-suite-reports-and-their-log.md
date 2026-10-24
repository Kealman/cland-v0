---
id: T-1257
kind: task
title: Automatic suite reports and their log chips land in General and drown the human's dialogue
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-993
branch: t/T-1257-automatic-suite-reports-and-their-log
created: 2026-10-24T18:41:42.785Z
updated: 2026-10-24T19:24:07.759Z
closed: 2026-10-24T19:24:07.759Z
---

## Summary

General is meant for the human's dialogue with the Coordinator, but the hub posts every automatic run there: periodic dev T3 results, each culprit-search probe rerun, the search summary, executor prepare reports, and the log artifact chip that goes with each. The topic is hard-coded to 'general' (hub/src/hub/suites.ts periodic and dev starts, hub/src/hub/dev-t3-probe.ts probes, the executor.prepare default in dispatch.ts) and is also the default for `cland verify` without `--report`. On 2026-10-24 this put dozens of full suite logs into General (human, 18:40Z).

## Acceptance criteria

- [x] C1. Periodic dev T3 runs, culprit-search probes and their summaries, executor prepare reports and verify runs without `--report` report to the Agents topic, still addressed to the coordinator, and their log artifact chips go to the same topic, never General (test).
  - done: impl-1257 · 2026-10-24T19:00:00.656Z
  - verified: rev-23 [reviewer] · run rev-20261024-1257-final · 2026-10-24T19:19:36.436Z · commit 6a59c4d9d91c83ece1ea08f1c8953b56c5834f86
- [x] C2. A test plants each automatic run kind and asserts that General receives no message or artifact chip from it (test).
  - done: impl-1257 · 2026-10-24T19:00:00.768Z
  - verified: rev-23 [reviewer] · run rev-20261024-1257-final · 2026-10-24T19:19:36.436Z · commit 6a59c4d9d91c83ece1ea08f1c8953b56c5834f86
- [x] C3. Help and docs name Agents as the default report topic, and --report still chooses any topic explicitly; no role clause grows (test).
  - done: impl-1257 · 2026-10-24T19:00:01.084Z
  - verified: rev-23 [reviewer] · run rev-20261024-1257-final · 2026-10-24T19:19:36.436Z · commit 6a59c4d9d91c83ece1ea08f1c8953b56c5834f86

## Comments

### impl-1257 · 2026-10-24T18:44:51.285Z

Red regression receipt on initial tree (macOS arm64, local targeted Node files; no suite gate): four selected cases failed before source edits. Nightly expected agents but got general; culprit-search lacked an Agents report; prepare lacked an Agents report within its bound; CLI without --report rejected with usage. New cases use existing sealed component/scheduler seams.

### impl-1257 · 2026-10-24T18:49:36.896Z

Implementation covers periodic/nightly starts, probes/search summaries and blocked notices, skip notices, quarantine proposals, merge-batch notices, executor prepare and verify defaults. Reports and chips share topic; explicit General/item topics still win. Per Coordinator decision b0762833, exit/vacancy recovery notices remain General; docs explain why. Fetch/merge origin/dev completed before first review (8fd6195f). Working-tree typecheck green; all affected T1/T2 files were exercised (85 tests: 84 passed, one stale General consumer then migrated and its 13-case file rerun green); targeted follow-up 6/6 green. T3 executor-prepare consumers migrated; runtime proof deferred to reviewed-head verify.

### rev-23 · 2026-10-24T18:53:41.902Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1257-source
commit: d69e145dd50cdb3b4df4cd1161d6ea9f43a68a4a
scope: full
findings: [{"severity":"medium","text":"M1: no-report CLI sends omitted report to an older running hub that requires it; materialize compatible default routing/recipients and retain previous-wire-shape client regression.","file":"hub/src/cli/suite.ts","line":70},{"severity":"medium","text":"M2: rule20 consumer inventory/search and migrated/unaffected dispositions are missing for changed validation/routing/default policy across production/clients/docs/QA/startup/persisted readers and all test tiers."},{"severity":"medium","text":"M3: new suite-admission and executor-prepare-component routing regressions need exact-path per-test guides/index entries.","file":"hub/test/suite-admission.test.ts","line":16}]
finding_counts: {"high":0,"medium":3,"low":0}

T-1257 full source review — not clear

Head d69e145dd50cdb3b4df4cd1161d6ea9f43a68a4a/tree8f576a2dc37a3ca25e116e407510283d33715084; sole parent/fixed base8fd6195fd9fb83d0e50db635e4508e9e429689c2. git diff8fd6195f...d69e145d:23files151insertions59deletions,onecommit. Branch request matches. Scope full, run rev-20261024-1257-source. Reviewer both axes in-session/subagents disabled; static read-only source/Git/tracker/docs/artifact inspection only,no tests/probes/edits/mutation/browser/delegation.

## Standards
M2 medium — task consumer inventory absent (rule20). This changes suite.start validation, CLI/MCP omission policy, report/artifact routing and persisted run-topic interpretation. Item/A-11331 describe affected features and counts but do not list every consumer/search scope with migrated/unaffected reasons. Record production CLI/MCP/raw callers, clients, scheduler/search/batch/prepare, shipped skill/examples/QA/startup/persisted-record readers and tests across all tiers including T3/T4. Distinguish intentional explicit General from default consumers and how pre-change persisted jobs/report retries retain or migrate their topic. Selecting changed files and eight targeted files is not proof inventory is complete. Existing migrated T3prepare consumers are useful but not the required full list.

M3 medium — hub/test/suite-admission.test.ts:16 and hub/test/executor-prepare-component.test.ts:63 add new fixture/behavior cases without required exact-path guides/index entries. Neither docs/agents/tests/hub-test-suite-admission.test.ts.md nor hub-test-executor-prepare-component.test.ts.md exists. Add guidance for sealed projectHub/scripted executor, observing exact completed default/override results, positive Agents log/chip assertions and empty General, old-shape client compatibility, and no real provider/browser. Existing shared tests.md text and dev-t3-search guide do not replace file-specific guidance (rule16/docs/agents/tests.md opening rule). No demand to move shared procedures into per-file docs.

Otherwise production routing is consistently scoped: periodic/nightly jobs and probes originate in Agents; search/blocked/skip/quarantine/batch notices move to Agents; prepare uses noticeTo/Coordinator; suite result/log/shard/coverage notices share job.topic; ordinary human artifact creation retains its old author/routing because new hubNotice flag is opt-in only at suite artifact call sites. Hub-owned Agents log chips now use hub notice, not a human-send side effect. Explicit report topics stay in the job. Role clauses/permission checks unchanged.

New T1/T2 regressions use existing sealed semantic executor/clock/projectHub seams, no new real provider/native/browser process. They retain positive Agents report/log/chip observations and empty General assertions after completed reports; explicit item/General overrides remain. Coordinatorb0762833 read directly authorizes exit/vacancy recovery notices remaining General, correctly documented. Help/frozen rows,README/shared tests and implement skill CHANGES mostly track shipped intent; whitespace clean. No material smell finding apart from missing documented guides/inventory.

## Spec
M1 medium — hub/src/cli/suite.ts:66–70: no-report invocation is now accepted but sends report:undefined over the socket. A new CLI binary can meet the running pre-change hub, whose suiteStartIssues at base8fd6195f still requires report for non-dryRun. From those two sources, the transmitted JSON necessarily lacks the field and old validator yields 'report must be a string (required unless dryRun is true)' instead of admitting the documented Agents default. This is static incompatibility proof, not a Reviewer-run reproduction. Rule20 explicitly requires prior-wire-shape client regression. Preserve compatible outgoing shape for the new default (for example, materialize Agents and intended default Coordinator recipients client-side), retain raw optional-field behavior on a new hub, and add a regression against the previous validator/request contract. Explicit report/recipient and report-free dry-run semantics must remain deliberate. MCP tool schema no longer requiring report does not repair a separately installed CLI talking to an older hub.

C1/C3 default behavior therefore incomplete across supported old/new boundary; C2 lacks required compatibility case and per-file fixture guidance. All three criteria failed for these findings; preserve final assertions/bounds and do not submit verify before corrected exact-head source clearance. Consolidated remaining finding set is M1–M3; no other source issue found in reviewed production/test/docs paths.

A-11331 is summary-level local macOSarm64 targeted evidence: four planted red cases (nightly agents!=general, missing Agents search/prepare report, no-report CLI usage), then four selectedgreen. Eight affected T1/T2files85cases include one stale-General consumer failure; migrated prepare13-case file plushelp then15/15green, later sixselectedgreen; typecheck and final hubtypecheck green, lint133reportfindings/0refusals. No configured-suite/T3runtime receipt, exact per-run tree/native command/output/exits/timing artifacts attached here. Preserve available original outputs/exits/native timings during correction with source/platform limits; do not rerun for transcription or infer totalcheckwall. New T3prepare changes await ordinary post-source verify. No per-itemQA(none/after-stage),stage/landing claim. Standards2medium(M2,M3); Spec1medium(M1).

Durable audit A-11334.

Criteria: C1 failed (M1: no-report CLI cannot admit documented Agents default against previous running-hub validation.), C2 failed (M1/M2/M3: previous-shape regression, complete consumer inventory and new fixture guidance missing.), C3 failed (M1: documented optional-report default requires incompatible new hub validation with no compatibility guard.).

### impl-1257 · 2026-10-24T18:59:51.345Z

Rule 20 / review M2 consumer inventory: A-11338 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11338-t-1257-complete-consumer-inventory-and-compatibility-dispositions.md lists all 401 matched/followed paths and migrated/unaffected reasons: 51 production/client, 243 all-tier test/fixture readers, 33 skill/docs, 68 QA briefs, 6 historical evidence. Searches include all General posters, CLI/MCP/raw suite.start validation, suite/probe/search/batch/prepare producers, artifact paths, shared wire/renderers, persisted job readers, startup probes and explicit General waits. Existing admitted job.topic stays pinned through restart/retry/accounting for explicit destination and crash-idempotence compatibility; completed history/artifacts are not relocated. New admission defaults and as-yet-unpublished search notices use Agents. Prior-validator wire compatibility is admission-only; hosting hub must load the routing change for new publication. QA T-271 supplies --report general explicitly, so its General waits stay valid. New CLI/MCP clients materialize defaults; old launch-time required-report schemas remain supported.

### rev-23 · 2026-10-24T19:02:22.825Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1257-source2
commit: 6a59c4d9d91c83ece1ea08f1c8953b56c5834f86
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1257 corrected full source review — clear

Head6a59c4d9d91c83ece1ea08f1c8953b56c5834f86/tree01f2fe708dbacd013e4f195ed1480a0361ff724c; sole parent first reviewed d69e145dd50cdb3b4df4cd1161d6ea9f43a68a4a. No post-review dev merge; branch ref matches. Scope full, run rev-20261024-1257-source2. Review correction plus full-head validity carrying A-11334's routing audit. Reviewer both axes in-session/subagents disabled, static read-only source/Git/tracker/docs/artifact inspection only; no tests/probes/edits/mutation/browser/delegation.

## Standards
M2 resolved. Rule20 inventory A-11338 is linked in item comment and lists401unique existing matched/followed paths with dispositions: production/CLI/MCP/UI, all-tier test+fixture callers/readers, skills/docs/site/QA/historical examples, startup/coverage/status/cache and persisted jobs/probes/search readers. Search spans T1–T4/Web rather than changed paths; table includes31T1/100T2/58T3/25Web and29support files. Explicit General fixtures/QA(T271) remain deliberate overrides; generic topic/artifact clients retain same fields. No row/reply/schema field removal. Existing admitted job.topic stays pinned through retries/restarts/accounting/cache lookup; completed history/artifacts not relocated; new admissions/new unpublished notices use Agents. This explicit compatibility disposition avoids rewriting already-admitted destinations/idempotence. Publication needs hosting hub to load change; admission compatibility does not claim old hub acquired new publication behavior.

M3 resolved. Exact-path suite-admission and executor-prepare-component guides/index now describe sealed semantic fixtures, exact completed report observation before positive Agent chip/negative General assertions, explicit overrides and old-validator wire seam. Prepare has no suite-log artifact; guide correctly names completed snapshot report instead of inventing a chip. Prior-wire test's disposable socket peers/listener are closed before directory teardown; env uses shared fixture builder. Socket is actual client/protocol boundary in existing T2 file, no native child/provider/browser added. Shared tests procedures remain shared, file-specific guidance separate. Public site CLI reference now matches defaults. Skill provenance/unchanged role clauses retained; whitespace clean. No material smell finding.

## Spec
M1 resolved. New CLI materializes report:'agents' plus default to:['coordinator'] only when report omitted and not dryRun; explicit recipients win, explicit topics/shorthand retained, report-free preview preserves omitted defaults. New spoke materializes the same boundary before request while preserving explicit arguments. New hub still separately supports raw omitted report; old spokes requiring report keep valid explicit requests.

Prior-hub regression uses literal old8fd6195f report-required validation and minimal previous reply, not imported new validator. It asserts received frames as well as CLI success for default/explicitrecipient/General/item+recipient/report-freepreview. The actual default/newhub result test now separately sends raw omitted frame and CLI default, then observes exact suite:<id> and positive log/chip/Coordinator delivery while General stays empty; explicititem/General passes retained. This tests old request contract and new default producer separately.

All original routing scope remains accepted: periodic/nightly/probe jobs, search/blocked/skip/proposal/batch/prepare notices and their suite log/shard/coverage artifacts use Agents/new job.topic, Coordinator recipients preserved. Human/ordinary artifact pathways unchanged by suite-only hubNotice flag. Coordinatorb0762833 General harness-exit/vacancy recovery exception remains documented; no role/permission expansion. Current restored C1–C3 done marks present. All are test-dependent, remain runtime-unverified here.

A-11339 retains correction-source local macOSarm64 attribution (d69e145d+uncommitted fixes subsequently committed): frozen prior-validator case red1/1fail/Error 'report must be a string (required unless dryRun is true)',Node339.632791ms; selected prior-wire/default/MCP5/5green,Node471.444541ms; broader33/33green,Node6094.834917ms for suite-admission,prepare-component,verify-tool,verify-submission,docs; hubtypecheckexit0,diffcheck0. These are retained summary/native excerpts, not full original orchestration envelopes or exact per-run committedtree. A-11331 original partial local evidence limits remain, including earlier migrated staleGeneral consumer; no rerun for transcription or inferred checkwall. No configuredsuite/Linux/T3/Web/QA proof claimed.

Clear corrected source permits one ordinary mode-free configured verify at exact unchanged6a59c4d9, then original evidence review naming actual phases/generated cases/platform/report gates. New T3prepare migrations still need runtime receipt; neither count of inventoried paths nor source exit0 is coverage. No forced full cover/extra repetitions requested. QA none/after-stage; no item brief/stage/landing claim. Coordinator owns enqueue/merge. Standards0remaining findings; Spec0findings.

Durable audit A-11341.

### rev-23 · 2026-10-24T19:19:36.436Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1257-final
commit: 6a59c4d9d91c83ece1ea08f1c8953b56c5834f86
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1257 final evidence review — clear

Head6a59c4d9d91c83ece1ea08f1c8953b56c5834f86/tree01f2fe708dbacd013e4f195ed1480a0361ff724c unchanged since full source2 rev-20261024-1257-source2/A-11341. Scope evidence, run rev-20261024-1257-final. Original mode-free configured34eeb614-0e34-459c-b965-10942fc51864/A-11348 and task.view confirm passed exact head. Reviewer parsed retained native log and read Git/tracker/source statically only; no test/probe/browser/edit/fetch/delegation.

Independently parsed3068 ordinary test passes/433 ordinary file passes,0fail/cancel/skip/todo.15 additional load test passes/15load file passes are separate: each of the three new routing/old-wire identities has5/5 repetitions. No cache-hit claim. T0 host npm run check exit0,28.257s; allT1(142files), fallback allhub/NeovimT2(246files; shared protocol contract), one changed T3 executor-prepare file with5ordinary identities once, all44Web files completed. T4 and remaining unchanged T3 did not run; this is not all-T3/T4/stage coverage. Tier exit0 envelopesT1 67s,T2 368s,T3 15s,Web157s; actual suite walls62.01/363.67/11.37/152.21s. Changed-phase addedwall11.320s excludes machinewait; manifest observed sums/projections are separate.

Runtime Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, c-8lon1 droplet cland-v0-e6006cfb, workers2(Web4), lifetime698s/cost$0.0485. Host typecheck marker aeeda0459dc6905d1a3d990fdb49330fe8b978df independently resolves to Git tree, not commit; hostT0 is not repeated Linux typecheck. Actual prepared browser Chrome Headless Shell156.0.8078.4 / Playwright chromium-headless-shell v1248 at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248; candidate Web harness runs prerequisite.executablePath headlessly.0newWebfiles/0repetitions required, not new-browser-load proof.

Required generated routing/native outcomes are explicit ordinary passes:
- hub/test/suite-admission.test.ts::verify materializes Agents defaults for a prior hub wire contract and preserves previews and overrides —0.027725924s, plus5/5load.
- Same file::verify without --report sends its result and log chip to Agents; explicit topics still win —0.511336808s, plus5/5load.
- hub/test/executor-prepare-component.test.ts::executor prepare defaults to Agents and honors an explicit report topic —0.537421385s, plus5/5load.
- hub/test/suite-soak-component.test.ts::green nightly publishes a coverage map that selects task tests —0.202657115s.
- Same file::periodic dev T3 posts a hub-owned structured red result to the Coordinator —0.205516072s.
- hub/test/dev-t3-search-component.test.ts::red periodic run files one Bug with live last-claimant delivery —0.843638417s.
- Same file::red periodic run reports a passing rerun as a flake without filing —0.544639237s.
- Same file::red periodic run runs Web probes and names the first red merge —1.098256253s.
Full relevant files complete: suite-soak-component35/35, suite-soak9/9, dev-t3-search-component14/14, prepare-component13/13, admission8/8, verify-tool3/3, verify-submission6/6, cli-help3/3, cli-usage-compatibility1/1, docs3/3.

All5 changed native preparation identities pass once: a project without pins prepares a reusable snapshot for delivery(0.673985520s); prepare accepts independent optional parts but rejects incomplete Neovim pins(0.369746969s); prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes(4.372176310s); prepared snapshots preserve the runner key hook across cloud-init clean and inject the new lease key on boot(2.348874217s); hub stop cancels and drains preparation before closing its store and preserves the one outcome(2.567291613s). No missing current changed-T3 receipt.

Carry A-11341 source findings0: fixtures plant periodic/nightly/probe/search/defaultverify/prepare production paths and assert positive Agents/Coordinator result/artifact-chip routing with no corresponding General traffic; explicit topics/recipients remain honored. Prepare normally has no artifact and does not invent a chip. Frozen pre-change hub validator regression observes actual prior-shape frames, report-free dry-run and explicit General/item overrides; MCP materializes the same default. This distinguishes old server acceptance from new hosting-hub publication: already admitted persisted job.topic and old history keep their original topic, hosting hub must load new source for new automatic publication. Coordinator b0762833 rare harness-exit/vacancy-recovery human notices remain the accepted General exception. No role-clause expansion or permission bypass. Complete consumer inventory A-11338 and exact-path guides/help/site/frozen usage were source-audited; current help/compatibility/docs runtime cases pass.

Local correction A-11339 remains separately attributed macOSarm64 d69e145d+uncommitted correction source, summary/native excerpts, not captured exact per-run committed trees/full orchestration envelopes. Prior validator red and33/33 corrected local green remain useful history; current Linux evidence is independent. No elapsed checkwall inferred.

Lint133findings/60files, general duration/resource/T3-ratchet/Web-wall gates report-only with warnings retained; Web phase over40s and named overages are not enforced timing success. No hard duration-budget failure. C1/C2 routing and negative General assertions pass at reviewed head; C3 explicit override/help/docs regressions plus unchanged role scope satisfy source/runtime requirements. Verify C1–C3 all. Findings0. No per-itemQA(none/after-stage), merge, stage, release or live-host rollout claim. Coordinator owns enqueue/merge after fresh conflict check; any changed head needs fresh review/evidence.

Durable audit A-11353.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T19:24:07.759Z

Merged 5d1fa2889515889e722d116d9db9bf64c2795b3e onto dev.
