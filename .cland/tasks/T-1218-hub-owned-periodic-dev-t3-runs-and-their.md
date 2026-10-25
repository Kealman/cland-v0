---
id: T-1218
kind: task
title: Hub-owned periodic dev T3 runs and their artifacts are attributed to the human
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: topic-1034
branch: t/T-1218-hub-owned-periodic-dev-t3-runs-and-their
created: 2026-10-24T09:20:07.524Z
updated: 2026-10-25T10:29:17.748Z
closed: 2026-10-25T10:29:17.748Z
---

## Summary

The periodic dev T3 is submitted by the hub itself, but the heartbeat lists it as "run … running · human", and its log and coverage-map artifacts are posted in General as messages from the human (from_kind human; A-10360 at 07:17Z, A-10635 and A-10636 at 09:19Z on 2026-10-24). On 2026-10-24 the Coordinator took the red periodic run f00422cf for the human's own run and told the human so, then had to correct it.

## Acceptance criteria

- [x] C1. A periodic dev T3 run, its heartbeat line and its artifact posts name the hub (or a "periodic" origin) as their author, not the human (test).
  - done: impl-1218 · 2026-10-25T10:06:28.470Z
  - verified: rev-32 [reviewer] · run rev-20261025-1218-final · 2026-10-25T10:22:48.561Z · commit ad056a82044d652e5052067224132dd490760a35
- [x] C2. Runs the human submits from their own shell are still attributed to the human (test).
  - done: impl-1218 · 2026-10-25T10:06:28.565Z
  - verified: rev-32 [reviewer] · run rev-20261025-1218-final · 2026-10-25T10:22:48.561Z · commit ad056a82044d652e5052067224132dd490760a35

## Comments

### impl-1218 · 2026-10-25T10:02:43.627Z

Clean inherited worktree; triage A-11669 locates null-actor fallbacks in suites.ts and dispatch.ts. Test seams authorized by launch brief: T1 Suites.queue/snapshot + heartbeatDigest over retained legacy-shaped SuiteJob facts (queued/running periodic versus human); T2 projectHub scripted-executor public frames for persisted log/coverage artifacts and their chip authors, plus human shell suite.start frames (no as) as control. No real provider, child hub or browser.
Rule 20 consumer inventory before changes: Suites.snapshot/queue, verification-timing/admitted logs, heartbeatDigest and persisted suite-jobs/history readers; Dispatcher suite report and artifact creator/chip publication; core.publishVerification and snapshot.ts; CLI suite.ts; Web sessions/verification.ts and artifact displays; Neovim verification.lua and artifact displays; Store.humanArtifact retention/edit policy. Existing string/session and creatorKind fields suffice: infer hub ownership from existing dev-t3/soak/batch/probe facts; keep human actor-null ordinary runs human. No new wire/persisted shape, row membership, schema or permissions. Client consumers display arbitrary session/creator strings and existing hub message kind, so unaffected. Regression uses the previous SuiteJob shape without a new origin field (older hubs/records remain readable). Reviewed test/fixture consumers across T1–T4: suite-soak[-component], suite-{queue,human,human-component,protocol,persistence,recovery,remote-process}, heartbeat[-digest], verify-submission/tool, connection-snapshot/startup diagnostics, web-verification-model and nvim verification-view/queue; artifact T1/T2/T3/Web suites and recorded protocol frames. Shipped implement/release skill examples, QA verification/artifact briefs/cases, startup probes and persisted readers do not require human ownership for periodic rows; no migrations needed. Tests will cover periodic ownership without changing their row counts or missing-field fallbacks.

### rev-32 · 2026-10-25T10:09:45.702Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1218-source
commit: ad056a82044d652e5052067224132dd490760a35
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1218 full source review

Reviewed ad056a82044d652e5052067224132dd490760a35, tree6f8297a5ac3af74ad2823571cbbffcfde4008b41, sole parent/merge base82cf0f6caae30e159a6fb4644171abcd29c32d05. One task commit; pinned diff82cf0f6c...ad056a82 changes13files127insertions/22deletions. git diff --check exit0. Full Standards/Spec audit in-session, read-only, no tests, probes, edits or delegation. Item claimant/request/criteria confirmed; rev-32 owns the hold.

## Standards

No findings. suiteAuthor is a small shared projection of existing SuiteJob actor/occasion/batch/probe facts, eliminating duplicated null-to-human fallbacks without a new wire or persistence field. Named actors remain authoritative; null-actor scheduled dev-t3/soak and batch/probe facts identify hub; ordinary null-actor jobs remain human. Existing public admission refuses human-supplied hub-owned occasions, and no permissions are loosened. Queue holders/waiters, admission/timing journal records and heartbeat agree through this helper, including old stored jobs with the same existing shape.

Artifact provenance uses the established schema: automatic hub artifacts have creator hub and creatorKind agent, matching existing batch artifacts; human shell artifacts retain creator human/creatorKind human. Store.humanArtifact plus Neovim/Web artifact policy readers already distinguish that existing kind and need no new schema/client migration. Generic artifact.create still uses its actual caller or human default when no suite context is passed. Dynamic topic/tool authorization and caller revalidation remain intact. Prior immutable artifact provenance is not rewritten.

Tests use the intended seams: T1 scripted Suites queue/snapshot plus heartbeat over real retained job facts; T2 projectHub/scripted provider public frames for completed log/map artifacts and chip authors. Execution/completion waits are bounded at actual receipts; no real provider, browser or new native process is introduced. Existing coverage map selection/no-General assertions remain. Human null-actor General/Agents requests go through public suite.start and assert persisted artifact ownership, not only text. Tests continue using shared fixture isolation/cleanup. No missing tier or unjustified latency assertion.

README, verify help and its frozen fixture, both per-file notes, implement skill and CHANGES match shipped attribution. The skill retains its provenance metadata. No role permission/clause or setting behavior changes require expansion. The item inventory covers production queue/core/snapshot/heartbeat, timing/persistence, CLI, Web, Neovim, artifact retention, skills/QA/probes and tests across tiers; unchanged public fields remain supported.

## Spec

C1 source implementation is present end to end. Scheduler-created periodic dev-t3 and nightly soak rows remain actor null but now project to hub in queued/running snapshots and heartbeat. Dispatcher passes the job context for log, shard and coverage-map registration. Automatic periodic artifacts are recorded as hub/agent and their chips use core.noticeTo rather than sendFromHuman. Existing scheduled result messages already use hub notices and stay so. Stored occasion facts support resumed job projection without modifying historic author provenance.

C2 source compatibility is preserved. Ordinary no-as shell suite.start yields actor null with no hub-owned occasion, so queue/timing/heartbeat and artifact ownership remain human. General chips remain human. Automatic report chips in read-only Agents remain hub notices as before; the artifact is still human-owned there. Named session submissions retain their caller identity. Batch/probe existing special report paths remain unchanged.

Required generated cases in the source are 'periodic queue and heartbeat name the hub while human shell runs keep human attribution', 'green periodic dev T3 publishes a coverage map that selects task tests', strengthened 'green nightly publishes a coverage map that selects task tests', and 'human shell verification keeps human queue and artifact authors in General and Agents'. They assert both positive hub attribution and the prior null-actor human shape; no origin-field simulation substitutes for real runtime projection.

## Evidence limits and disposition

A-11674 retains implementation-tree local Darwin arm64/Node24.21.0 summaries and actual red excerpts: queued periodic 'human' !== 'hub', persisted artifact 'human' !== 'hub', followed by reported T1 file10/10 and T2 file37/37, typecheck and lexical docs lint passes. It is explicitly pre-commit identical-patch attribution, with no same-head configured run, Linux durations, browser, native provider or full-suite evidence. Full raw stdout/exits/native timing records were not included in that summary; retain available originals with real source/platform limits without reruns for transcription.

Clear source at ad056a82, findings[]. C1/C2 source paths are implemented; leave their run-dependent verification unmarked until the same-head mode-free configured task receipt and actual new-test load repetitions/publication facts are checked. No full-all verification is requested. Standards0; Spec0.
Durable review: A-11684.

### rev-32 · 2026-10-25T10:22:48.561Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1218-final
commit: ad056a82044d652e5052067224132dd490760a35
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1218 final same-head evidence review

Reviewed ad056a82044d652e5052067224132dd490760a35, tree6f8297a5ac3af74ad2823571cbbffcfde4008b41, unchanged branch tip and current source-clear rev-20261025-1218-source/A-11684. task.view confirms configured mode-free runada4e697-81d8-4280-87b3-d54c88e50bf5 passed at that exact head, native logA-11708. Read-only review; no reviewer tests or source changes.

## Standards

No findings. Parsed native suite progress confirms3117 ordinary passing tests and438 passing file records, plus30 separately scoped passing load-gate tests/files; no failed/cancelled/skipped outcomes. Fifteen repetitions belong to this item's three new attribution cases; fifteen are the three inherited install-claims cases selected by the baseline. Do not add repetitions to the ordinary total.

Actual execution: host T0 check32.238s; Linux all T1 and fallback all hub/Neovim T2, plus full Web. No T3/T4 was selected or run; 'periodic dev T3' in the component case name describes the scheduler under test, not a completed real T3 suite. Remaining T3 is deferred to configured periodic/integrated occasions, queue enabled/batch idle at receipt. Host macOS gate tree4fef5dd75e9171fdd017f0f4fe3da6bcce1b11e6 is reused host evidence, not repeated Linux typecheck.

Runtime: Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-cfe2dfb2, Node24.21.0/Neovim0.12.5,2workers; Web internal shard4. Browser isolated Chrome Headless Shell156.0.8078.4/Playwright1248. Droplet lifetime626s/$0.0435 is machine lifetime/cost, not suite wall. Phase envelopes61/328/139s differ from internal runner walls56.91/325.16/134.69s. Performance/lint policies remain report-only: lint133/60, Web over40s, existing would-fail lines and one missing baseline retained; T3 ratchet2209.786s equals base. No enforce-mode performance clearance or native provider/browser QA inference.

## Spec

C1 exact generated cases and recorded passes:
- T1 'periodic queue and heartbeat name the hub while human shell runs keep human attribution': base0.086303144s; five load-gate pass receipts0.097584100/0.091119658/0.105920797/0.090252469/0.082754775s. Log4428 confirms5/5. Source-reviewed assertions cover queued/running authors, heartbeat lines and completed timing records with old-shaped null-actor facts.
- T2 'green periodic dev T3 publishes a coverage map that selects task tests': base0.265622333s; five repetitions0.419862948/0.429213526/0.393986998/0.457933103/0.468581588s, log12258 confirms5/5. It reads persisted log/map creator hub/creatorKind agent and durable hub/fromKind hub chips through public frames, preserving coverage-selection checks.
- Existing strengthened T2 'green nightly publishes a coverage map that selects task tests': base0.261154504s, same provenance/chip assertions, no separate new-identity repetition inferred.

C2 control 'human shell verification keeps human queue and artifact authors in General and Agents': base0.299120502s; five repetitions0.517583645/0.532070930/0.615209357/0.576475765/0.565100700s, log12274 confirms5/5. Its no-as public submissions keep queue/creator human, creatorKind human, General chip human, and the existing automatic Agents hub notice. The T1 mixed control independently retains human heartbeat/timing attribution. Both frozen usage compatibility and full-help file records pass, so the help change did not bypass equality guards.

A-11688 (corrected id, not A-11685) preserves pre-commit Darwin arm64 local transcribed excerpts/exits and native reporter timings, including the original human!=hub queue/artifact reds. Its excerpt/source limits remain explicit and it is supplementary to the exact-head Linux receipt, not reconstructed or substituted evidence.

Disposition: clear final evidence at ad056a82, C1/C2 verified across A-11684 source and A-11708 actual runtime. Findings[]. No historical author rewrite, full-T3/T4 cover, QA or real provider claim. Standards0; Spec0.
Durable review: A-11711.

Criteria: C1 verified, C2 verified.

### impl-1218 · 2026-10-25T10:23:19.724Z

Ready at ad056a82044d652e5052067224132dd490760a35; no head changes after source review. Full source clear rev-20261025-1218-source and final evidence clear rev-20261025-1218-final, C1/C2 verified. Configured mode-free verify ada4e697-81d8-4280-87b3-d54c88e50bf5: 3117/3117 pass; host T0 plus Linux droplet all T1/fallback all T2/Web, no T3/T4 runtime; report-only budgets/lint. All three added attribution cases have base passes and explicit 5/5 load finish receipts; maximum added-case Linux duration 0.615209357 s, below 3 s allowance trigger. Evidence A-11708/A-11710/A-11711, original local excerpts A-11688. Fresh git fetch --no-auto-maintenance origin dev at 10:23Z retained dev 82cf0f6caae30e159a6fb4644171abcd29c32d05; git merge-tree --write-tree HEAD origin/dev produced 6f8297a5ac3af74ad2823571cbbffcfde4008b41 without conflicts. Worktree clean; origin task branch pushed. No merge performed; Coordinator owns enqueue. Claim retained.

### coord · 2026-10-25T10:29:17.748Z

Merged 15d47490025104c3b5fb833a262121f19f9ba724 onto dev.
