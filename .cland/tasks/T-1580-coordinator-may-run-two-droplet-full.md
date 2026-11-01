---
id: T-1580
kind: task
title: Coordinator may run two droplet full suites at once (verification.coordinator_suites)
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: topic-1301
branch: t/T-1580-coordinator-may-run-two-droplet-full
created: 2026-11-01T09:02:54.695Z
updated: 2026-11-01T14:02:52.740Z
closed: 2026-11-01T14:02:52.740Z
---

## Summary

The hub admits one active suite per session (`hub/src/hub/suites.ts` `#existingSubmission`: "this session already has a suite queued or running"). So the Coordinator's full suites (stage covers, T4-needing items, integrated covers) run one at a time, about 40 min each, even when droplet slots and the daily cap have room. On 2026-11-01 at 09:01Z the human chose to allow two at once, as option 3 of ask 31d43750. The merge batches with T1–T3 (config e818d2dc) are the other half of that decision.

Hot files: `hub/src/hub/suites.ts`, `hub/src/init/config.ts`, `docs/agents/tests.md`.

## Acceptance criteria

- [x] C1. A `[verification] coordinator_suites` setting (default 1) lets the Coordinator session hold up to that many active droplet suites with different submission keys at once; this project sets it to 2 (test).
  - done: impl-1580 · 2026-11-01T09:10:01.544Z
  - verified: rev-37 [reviewer] · run rev-37-1580-evidence-1 · 2026-11-01T09:41:56.284Z · commit 904f137e8ddd81176857e4965a3b6685e3a47bb6
- [x] C2. A second active local suite for the same session is still refused with today's text, so the local machine never runs two Coordinator suites (test).
  - done: impl-1580 · 2026-11-01T09:07:06.051Z
  - verified: rev-37 [reviewer] · run rev-37-1580-evidence-1 · 2026-11-01T09:41:56.284Z · commit 904f137e8ddd81176857e4965a3b6685e3a47bb6
- [x] C3. A submission whose key matches an active suite still joins it, and a submission over the cap is refused with today's text naming the cap (test).
  - done: impl-1580 · 2026-11-01T09:10:01.649Z
  - verified: rev-37 [reviewer] · run rev-37-1580-evidence-1 · 2026-11-01T09:41:56.284Z · commit 904f137e8ddd81176857e4965a3b6685e3a47bb6
- [x] C4. Remote slots, the shard count, the remote budget and the daily spend cap still bound admission. A suite admitted under the cap but without a free slot queues, exactly as today (test).
  - done: impl-1580 · 2026-11-01T09:07:07.793Z
  - verified: rev-37 [reviewer] · run rev-37-1580-evidence-1 · 2026-11-01T09:41:56.284Z · commit 904f137e8ddd81176857e4965a3b6685e3a47bb6
- [x] C5. Other roles keep one active suite per session, and the existing suite-admission test files pass with no test edited.
  - done: impl-1580 · 2026-11-01T09:07:07.871Z
  - verified: rev-37 [reviewer] · run rev-37-1580-evidence-1 · 2026-11-01T09:41:56.284Z · commit 904f137e8ddd81176857e4965a3b6685e3a47bb6
- [x] C6. `docs/agents/tests.md` and `cland config` help describe the setting. Rule 19 applies: the project setting is committed only after the hub runs this code.
  - done: impl-1580 · 2026-11-01T09:19:42.810Z
  - verified: rev-37 [reviewer] · run rev-37-1580-source-1 · 2026-11-01T09:20:39.056Z · commit 904f137e8ddd81176857e4965a3b6685e3a47bb6
  - verified: rev-37 [reviewer] · run rev-37-1580-evidence-1 · 2026-11-01T09:41:56.284Z · commit 904f137e8ddd81176857e4965a3b6685e3a47bb6

## Comments

### impl-1580 · 2026-11-01T09:04:12.682Z

Rule 20 consumer inventory before change: Suites.#existingSubmission at early retry, inspected-head and final admission fences; submissionKey persisted in suite jobs and legacy fallback; executor override/stage pairing in suite-stage-rules.test.ts; suite.test.ts CLI duplicate refusal; suite-admission.test.ts and suite-admission-native.test.ts frame/installed CLI admission; suite-remote-budget, suite-accounting, suite-cover, suite-stage-cover, suite-close-component, suite-persistence tests; configuration parser/default/template, config-set template-derived keys, configuration reload applied list, daemon scheduler config; config-set/config-reload tests and close-run fixture. Documentation consumers: hub/README verification and executor sections, docs/agents/tests.md, implement skill; historical specs/QA briefs T-230,T-271,T-386,E-423,E-426 reference unchanged remote budgets. Searched field/function/refusal names across hub/nvim/web/shared/qa/.agents/docs including T3/T4. No wire fields change: old suite.start input and persisted submissionKey fallback retained; existing stage-rule and admission regressions run unedited. Project config remains Coordinator-owned after restart per launch instruction.

### impl-1580 · 2026-11-01T09:07:21.518Z

Source review requested from reviewer at pushed d11680b33c33f21a2a8f011573175d0bc6d14396; evidence artifact A-15262 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15262-t-1580-source-evidence-and-contract-inventory.md). Additional unedited suite-stage-cover.test.ts 1/1 green, local macOS Node; no browser. Targeted file checks only, not full tier receipt. Awaiting clear source review before mode-free verification.

### rev-35 · 2026-11-01T09:09:12.147Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1580-source-1
commit: d11680b33c33f21a2a8f011573175d0bc6d14396
scope: full
findings: [{"severity":"medium","text":"A matching local-only job bypasses the distinct droplet-key cap: with local C active and droplet A/B at cap2, requesting droplet C skips !matching.length and admits a third remote key. Check new droplet-key admission independently of matching local jobs; retain exact joins/remote variants and cover this interleaving.","file":"hub/src/hub/suites.ts","line":688},{"severity":"low","text":"This says requests queue behind daily spend limits, but spend refusal yields provider-capacity/not-run. Distinguish capacity queueing from spend refusal here and in the new tests guide paragraph.","file":"hub/README.md","line":4962},{"severity":"low","text":"Rule16 requires the matching role clause to change with admission policy. The Coordinator verification clause has no new configurable droplet-key cap/default/local restriction; add its concise policy reference alongside existing verification guidance.","file":"hub/src/roles/default-roles.ts","line":64}]
finding_counts: {"high":0,"medium":1,"low":2}

Source not clear. Spec medium: suites.ts:688 skips remote cap for local-only matching key; localC + dropletA/B then dropletC exceeds cap2. Implementer confirmed red Missing expected rejection in reply8e1536ba. Standards lows: README:4962 misstates spend refusals as queueing (tests paragraph too), and Coordinator role clause:64 lacks changed admission policy reference required by rule16. A-15263 contains source evidence; role-clause low additionally recorded here. Parser/default/template/reload and stored-session identity otherwise match scope; legacy keys and final synchronous admission fence retained. No full verification/Reviewer execution. C1 project setting2 remains deferred to Coordinator after deployed restart per C6/rule19. Fix/head change needs fresh source review before verify.

Criteria: C1 failed (Matching local-only key can be admitted on droplet after distinct remote keys fill coordinator_suites cap.), C3 failed (Over-cap mixed-executor submission is accepted instead of refused; exact retry/override behavior must remain preserved.).

### rev-35 · 2026-11-01T09:10:31.114Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1580-source-2
commit: ae4bc6c4abfd2b2874016694527199e760167ab7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear; Standards/Spec no findings. All three prior findings resolved: droplet-key cap checks independently of local-only matches, bounded mixed-executor regression retains exact local join and final job-count assertion; spend documentation distinguishes not-run from queueing; existing Coordinator clause names setting/default/local bound. Additive config parser/template/reload, stored-session identity, legacy retry and final admission fences reviewed; existing admission/stage tests unedited. C6 source verified. C1–C5 runtime evidence awaits exact-head mode-free verify, with C1 project setting2 deferred until deployed restart under rule19/brief. A-15264 checklist if assigned id differs see artifact in topic. No Reviewer execution.

Criteria: C6 verified.

### coord · 2026-11-01T09:12:36.566Z

Correction recorded for rev-35, whose role may comment only verdicts: the source verdict rev-35 at ae4bc6c4 names artifact A-15264, but its actual review artifact is A-15265. The verdict, head and findings are unchanged.

### impl-1580 · 2026-11-01T09:16:37.263Z

Rule20 inventory addendum: CONFIG_USAGE also feeds frozenUsage via hub/test/fixtures/cli-usage/commands.json and exports.json, aggregate usage exports in hub/src/cli/usage.ts, cli-usage-compatibility.test.ts and cli-help.test.ts (help.txt placeholders). cli-usage-merge.test.ts reads frozen bytes for independent native merge assertions; unchanged exports composition/help template and untouched command entries remain valid. Run3544e718 failed actual CONFIG_USAGE includes coordinator_suites help line while frozen CONFIG_USAGE lacks it. Correcting only that independent frozen entry. Shared init-config expectation defect is Coordinator-confirmed (e818d2dc) and assigned T-1581; no local edit, awaiting posted reviewed shared commit.

### rev-35 · 2026-11-01T09:16:41.401Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1580-evidence-1
commit: ae4bc6c4abfd2b2874016694527199e760167ab7
scope: evidence
findings: [{"severity":"medium","text":"Frozen CONFIG_USAGE was not migrated for the added coordinator_suites help line; cli-usage-compatibility full deepEqual fails. Update independent fixture/aggregate consumers while keeping their full assertions.","file":"hub/test/fixtures/cli-usage/commands.json","line":8},{"severity":"medium","text":"Shared dev defect T-1581: repository batch tiers actual T1,T2,T3 versus expected T1 fails T1 at this head. Obtain Coordinator-posted shared fix; no arbitrary dev merge.","file":"hub/test/init-config.test.ts","line":177}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear. A-15272 exit1: actual AssertionError deepEqual adds coordinator_suites help line absent from frozen CONFIG_USAGE; init-config actual['T1','T2','T3'] expected['T1'] is known shared T-1581 (XS Bugs). T0 passed,T1 native1300 tests/1298pass/2fail,zero cancel/skip/todo; T2/T3/Web unexecuted. Linux x64 droplet Node24.21.0,Neovim0.12.5,no browser execution; advisory gates report-only. C6 failed; remaining runtime criteria unverified. Source fix + Coordinator shared fix require fresh source review before verification. No Reviewer execution.

Criteria: C6 failed (Changed config help is incompatible with frozen usage consumer; T1 cli-usage-compatibility deepEqual fails.).

### rev-37 · 2026-11-01T09:20:39.057Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1580-source-1
commit: 904f137e8ddd81176857e4965a3b6685e3a47bb6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear for requested two-fixture patch since rev-35 source-clear ae4bc6c4. Standards: no findings. Spec: no findings. Frozen CONFIG_USAGE precisely matches shipped setting help with full independent deepEqual preserved; init-config change matches authorized shared 4091d481 and committed T1/T2/T3 config. No other changes, dev merge, or edits to existing admission/CLI assertions. A-15279 records review boundaries. C6 source verified; C1–C5 remain run-dependent pending exact-head mode-free verification, project setting2 deferred to Coordinator after deployment/restart. Prior run3544e718 remains failed (T0 complete, T1 failed, later tiers/Web unexecuted). Local targeted receipts in A-15277/topic are supplemental partial evidence only. No Reviewer test execution/browser. Fresh source scope is the requested patch, carrying forward rev-35's reviewed implementation.

Criteria: C6 verified.

### rev-37 · 2026-11-01T09:41:56.284Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1580-evidence-1
commit: 904f137e8ddd81176857e4965a3b6685e3a47bb6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear. A-15285 run808ddf5d exact reviewed head/tree46a8e56c: exit0, T0/T1/T2/Web and roles-only changed T3 completed, remaining T3/T4 deferred. Linux x64 droplet Node24.21.0 Neovim0.12.5, isolated chromium_headless_shell-1248 Chrome156.0.8078.4; not cached. Aggregate4573 pass,0 fail/cancel/skip/todo. Independently checked named completion outcomes: coordinator10, admission9, stage-rules10, remote-budget17, cli-usage compatibility1, init-config17 all pass. A-15287 supplies retained exact-head local macOS Node native exit0 and named outcomes for unchanged admission-native8/8 and stage-cover1/1 (fake providers,no browser,targeted T3 only). Budgets/lint/ratchets report-only. A-15289 records criterion mapping and complete evidence bounds. C1–C6 verified across source and run evidence; C1 live setting2 remains explicitly deferred to Coordinator after deployment/restart per C6/brief. No Reviewer execution. Standards/Spec no findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-01T14:02:52.740Z

Merged 7483a185ed45826d8f9a3b9837057b103b82af21 onto dev.
