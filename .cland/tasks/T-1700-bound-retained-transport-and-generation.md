---
id: T-1700
kind: task
title: Bound retained transport and generation ownership receipts
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1576
branch: t/T-1700-bound-retained-transport-and-generation
created: 2026-11-05T20:18:31.073Z
updated: 2026-11-17T05:13:59.711Z
closed: 2026-11-17T05:13:59.711Z
---

## Summary

Non-blocking follow-up from rev-35's fourth source review of T-1696 at 3c30df86 (review-loop bar; recorded by coord). Exact finding text:

"stoppedOwners retains every successful transport-stop owner and its forward-id set for the module lifetime, without retirement. Sessions.#localForwardOwners and the generation facade's scope/identity indexes also retain old entries. Define bounded retention tied to outstanding current/retained generation obligations, preserving idempotent release and refusing unknown proof."

This is resource retention and maintainability only. No C1–C3 or T-1614 main-path failure was demonstrated.

## What to build

Retire entries from the transport stop-owner receipts, `Sessions.#localForwardOwners` and the generation facade's scope and identity indexes once no current or retained generation obligation refers to them. Repeated release must stay idempotent while an obligation exists, and a release with unknown or retired proof must still be refused.

## Acceptance criteria

- [x] C1. After a generation's obligations settle, its stop-owner receipt, local-forward owner and facade scope or identity entries are gone, and the maps stay bounded across many relaunch cycles (test).
  - verified: rev-36 [reviewer] · run rev-36-1700-final-1 · 2026-11-17T01:39:34.274Z · commit 72bc7e910188e40b8ab680baf0e4f2fc32ec1fa4
  - done: impl-1700 · 2026-11-17T03:38:57.258Z
  - verified: rev-36 [reviewer] · run rev-36-1700-final-2 · 2026-11-17T04:23:51.786Z · commit 46e807ff6ceedfea8cb983abca80a1750e518bf1
- [x] C2. Release stays idempotent while an obligation is outstanding, and a release presenting unknown or retired proof is refused (test).
  - verified: rev-36 [reviewer] · run rev-36-1700-final-1 · 2026-11-17T01:39:34.274Z · commit 72bc7e910188e40b8ab680baf0e4f2fc32ec1fa4
  - done: impl-1700 · 2026-11-17T03:38:57.743Z
  - verified: rev-36 [reviewer] · run rev-36-1700-final-2 · 2026-11-17T04:23:51.786Z · commit 46e807ff6ceedfea8cb983abca80a1750e518bf1

## Comments

### impl-1700 · 2026-11-16T23:54:58.055Z

Consumer inventory (rule 20): transport claim/stop proof is produced by transport/ssh.ts, read by adapters/sessions.ts and transport/transport.ts; generation facade is constructed by codex.ts, opencode.ts and claude-code.ts. HarnessAdapter contract consumers include Sessions release, host settlement/destroy/relaunch, adapter-generation T2 and adapter-generation-forward T3 fixtures. Search across hub/src, hub/test, nvim, web, docs and shipped skills found no other stop-proof/index readers. Persisted ProcessTable retainedHostGenerations/clearHostGeneration, restart register/watch and pending-stop restoration remain the owners of durable obligations; no persisted schema/wire shape change planned. Additive in-memory retirement hook will follow positive clearHostGeneration. Existing old-shape adapters keep optional-hook compatibility.

### impl-1700 · 2026-11-17T00:01:42.511Z

Coordinator-posted shared fix T-1923 added unmodified as separate commit 594f59418 (source 15757e4d4); new pushed review head 594f59418. Shared fix files byte-identical; stable patch-id ca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. At new head, local Darwin arm64 Node 24.21.0: hub-priority.test.ts 1/1 passed and hub typecheck passed. T-1700 implementation unchanged at 337aa165b. npm run test:lint completed exit 0 on that implementation tree (0 refusals; advisory findings report-only). Review head update sent to reviewer role in existing item topic; waiting for queued assignment.

### rev-35 · 2026-11-17T00:12:13.712Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1700-source-1
commit: 594f59418cafa0c841dd64c3ad8338d83ce438f3
scope: full
findings: [{"severity":"medium","text":"The retirement hook has no production local stop/relaunch or fresh-resume caller. Superseded positively stopped local generations remain strongly indexed until facade close; the 100-cycle test invokes retirement manually rather than through that lifecycle owner. Retire settled superseded scopes at the positive boundary while retaining current/pending obligations (C1).","file":"hub/src/adapters/generation-adapter.ts","line":149},{"severity":"medium","text":"All three new callbacks start asynchronous fixture setup before any whole-body owner. Later adapter/Sessions cleanup hooks do not fence/join setup, loop/body continuations or late acquisitions before storage/root removal. Use the shared lifetime owner before first acquisition and retain the final assertions (rule 12).","file":"hub/test/adapter-generation.test.ts","line":186}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear A-20492, two medium findings consolidated. Implementer222e0678 confirms missing local retirement owner and missing whole-callback fixture owner, with no approved exclusions. Remote settlement/refcount retirement, idempotent references and pinned forward namespace otherwise match the task; optional hook retains old adapter compatibility. Coordinator Agents1a096385 authorizes identity-only shared-fix review: independent complete diff equality confirms594f59418 matches15757e4d4 exactly. A-20482/A-20491 original targeted counts, early/final source linkage, lint concurrency and missing raw/hash/signal/scan limits retained; independent current consumer search normalizes ten T2/six T3/one Web direct matches without implying exhaustive dynamic coverage. No configured/Linux/browser evidence or Reviewer runtime. C1/C2 failed; hold released for consolidated correction and fresh committed source review before verify. No post-review dev merge implied.

Criteria: C1 failed (Superseded settled local generations lack production lifecycle retirement; the manually driven hook test does not establish bounded production relaunch cycles.), C2 failed (The new release/proof regression callbacks lack whole-fixture lifetime ownership during cancellation.).

### impl-1700 · 2026-11-17T00:23:13.089Z

Consolidated corrections pushed at 805c727a3 (tree a85b8ad8266d8268d474f49a76678b68702421d0). Production facade now retires superseded settled local scopes on successful relaunch/stop+replacement, including restored rows and late stop; unknown closure retains scope. New test fixtures own whole bodies before acquisition and guard root removal. A-20498 preserves current-head immutable-source targeted checks and expanded symbol/importer/field census with manifest-normalized tiers, executed/deferred disposition, unchanged persisted/wire contracts and explicit evidence limits. Local Darwin arm64 Node24.21.0: generation15/15, host-revoke41/41, hub typecheck exit0, whole-source test:lint exit0/0refusals (advisory findings retained), closed-item wording0 findings. No configured verification submitted; fresh review first.

### rev-36 · 2026-11-17T00:27:51.213Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1700-source-2
commit: 805c727a30bf1d5ca3311bcc4cfa6817c6bd11b1
scope: full
findings: [{"severity":"medium","text":"C1: a local spawn that rejects before returning a process leaves its strong facade scope after obligations have settled, including failure before native acquisition. make()/launching precede await spawn, but replacement retirement requires prior.stopped and prior.process; subsequent success overwrites launching without removing that scope. Claimant c94257d2 confirms no settlement owner/exclusion and no failed-spawn regression. Retire on positive failed-launch settlement and cover repeated settled failures plus later success; preserve unknown cleanup obligations.","file":"hub/src/adapters/generation-adapter.ts","line":181}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear A-20500. Standards0: prior whole-body fixture ownership corrected with pre-acquisition owner/body join/resource disposal/root guard. Successful local resume/stop/spawn/restored/late-stop retirement now accepted; remote settlement, idempotent retained proof and replacement namespace accepted. Spec1medium: settled failed spawn scopes have no production retirement owner (generation-adapter.ts:181, predicate98-102), claimantc94257d2 confirms. C1failed; C2 policy accepted but unverified. Shared T-1923 complete diff/patch identity independently unchanged. A-20498 local immutable-source15/15+41/41/compiler/lint positives and A-20491 historical capture limits retained; they do not cover this gap. No configured or Reviewer runtime. Hold released for consolidated settled-failure correction and fresh source review before verification/window; unknown cleanup must remain retained.

Criteria: C1 failed (Settled failed spawns without a returned process retain strong facade scopes; later successful replacement does not retire them.).

### impl-1700 · 2026-11-17T00:37:49.245Z

Remaining C1 correction uses an additive optional in-memory AdapterHost.spawnFailureSettled receipt and shared withSpawnSettlement preparation boundary. Consumer inventory before finalizing: all AdapterHost/HarnessAdapter importers/constructors are enumerated in A-20498; new receipt producers are Codex/OpenCode LaunchSettled and Claude local/remote failed-generation settlement, reader is generation-adapter's scope-captured hook. launch-settlement.ts existing boundedSettlement/LaunchSettled consumers include LaunchFiles and launch-settlement.test.ts; their signatures/behavior remain unchanged. No persisted recovery state, wire shape or CLI/role change. Existing hosts/fakes omit the optional callback and remain compatible. Native adapters share the same pre-acquisition receipt policy; acquired failures require positive existing rollback/settlement, including delayed durable recovery. Unknown outcomes keep the scope even across replacement. New tests exercise all three native producers with isolated recording Hosts and retain the earlier whole-body owner.

### impl-1700 · 2026-11-17T00:40:50.346Z

Fresh source review requested at b274aa8e6 (tree7338708a723c9d164f702253ed5cc4e87e3043c1). A-20508 documents the positive failed-spawn producer owner, unchanged optional/old-shape compatibility, and exact-source57 targeted T2 passes plus hub typecheck/test:lint exit0 (0 refusals, advisory findings retained). C1/C2 done. Awaiting reviewer assignment/verdict; no configured verify submitted. A-20498 consumer census remains applicable with new launch-settlement export and callback producer/reader accounting in A-20508.

### rev-36 · 2026-11-17T00:43:24.620Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1700-source-3
commit: b274aa8e6ba238e995eead560def89dc10662c86
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-20511, Standards0/Spec0. Remaining A-20500 settled failed-spawn gap resolved by exact-scope optional producer receipt plus spawnFailed/no-process predicate. Shared no-acquisition boundary and Codex/OpenCode/Claude positive native/file/transport rollback producers traced; failed undo, unknown outcome and replacement alone retain scope. Early/late receipts remove only captured failed scope, preserving replacement indexes. Eight added T2 real-producer/shared-policy cases retain whole-body fixture owner; prior successful-cycle/remote settlement/carrier idempotence/refusal accepted. A-20508 immutable-source57/57 targeted/compiler/lint0 positives and original raw/hash/native limits retained; no configured/Linux/native-harness/browser proof or Reviewer runtime. Shared T-1923 unchanged, no dev merge. C1/C2 implementation accepted but unverified pending completed same-head configured evidence or explicit Coordinator waiver. Hold released; claimant follows Coordinator window before verify.

### rev-36 · 2026-11-17T01:08:40.401Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1700-evidence-1
commit: b274aa8e6ba238e995eead560def89dc10662c86
scope: evidence
findings: [{"severity":"medium","text":"Configured direct consumer stops the original process after successful changed-identity resume and now fails on the intentional retired-generation fence. A-20517:31862-31867/typed fail11278; claimant668885aa confirms missed consumer migration with no compatibility exception. Narrow found and stop resumed.process while preserving all environment, conversation, command-count, remedy and signed-out assertions; do not weaken production fencing.","file":"hub/test/claude-code-environment.test.ts","line":192}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed same-head evidence A-20520, detailed partial ledgerA-20518. A-20517/26ee09ad atb274aa8e6: T0/T1exit0,T2exit1;5802ordinarypass/1fail,607filepass/1fail;95scopedpasses separately. Sole failure stale-generation stop in Claude environment consumer:192, claimantconfirmed. My source review missed this already-inventoried consumer. All23generation basecases and16added5/5load identities positive, plus cleanup/settlement/revoke consumers; retained as partial positives only.224T1/384T2filesfinished;44T2+T3/T4/Webunexecuted,browsernull. No shared/infra diagnosis, no Reviewer runtime; original limits/report-only advisories retained. C1failed,C2unverified. Production fence remains intentional; consumer correction plus fresh exact-head source review before new window/run. Hold released; no retry/dev-merge authorization.

Criteria: C1 failed (Configured T2 Claude environment consumer still stops a retired pre-relaunch process; run26ee09ad exits1 and later phases are unexecuted.).

### impl-1700 · 2026-11-17T01:10:26.001Z

Corrected stale-generation consumer pushed at72bc7e910 (treee72c8e31ae3ce99761c04921b1daccaf9f288ee0). Only test delta: stop returned resumed.process after successful resume, retaining original found/environment/conversation/count/signed-out assertions and production fence. Corrected-source environment file19/19 and hub typecheck exit0. Evidence A-20522: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20522-t-1700-resumed-process-consumer-migration-and-validation.md. Fresh source review delivered to reviewer role; no configured retry until clearance/window. Earlier run26ee09ad remains failed/partial.

### rev-36 · 2026-11-17T01:11:14.945Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1700-source-4
commit: 72bc7e910188e40b8ab680baf0e4f2fc32ec1fa4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear A-20523, Standards0/Spec0. Complete parent diff is only Claude environment consumer: retains found assertion, explicitly narrows and stops resumed.process; all environment/conversation/count/discovery/remedy/signed-out assertions and intentional production fence unchanged. No dev merge/shared-fix alteration. Prior full implementation A-20511 remains basis. A-20522 local corrected-source19/19/typecheck0 and precommit/raw/hash/signal limits retained. Parent configured26ee09ad remains failed; A-20518 positives partial and historical. C1/C2 implementation accepted but unverified pending completed configured evidence at72bc7e910 or explicit Coordinator waiver. No Reviewer runtime. Hold released; claimant obtains Coordinator window before another verify.

### impl-1700 · 2026-11-17T01:36:00.356Z

Corrected-head configured runaf14bbb3-7bb0-4c5a-8184-73ccc3a5c3db passed at72bc7e910 (A-20528).6539 tests/pass6539/fail0/cancelled0/skipped0. Completed hostT0, T1, fallback allT2, mapped inbox-verifier-load T4 once (no repetitions), Web; remaining T3 deferred to queue-enabled merge batch. Durable log provenance: verification tree8cf3075c9010f9ced9479b224eb123385cff3932; droplet Linuxx64 6.8.0-147-generic, Node24.21.0, Neovim0.12.5; browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4; no cache/skips. Lint/duration/ratchet diagnostics report-only; no memory-performance claim. Machine lifetime/cost were absent from the delivered excerpt/log provenance read, so not restated here. Reviewer received the same-head result automatically and will settle final evidence; status remains review, head unchanged, claim retained. No new verification request or source change.

### rev-36 · 2026-11-17T01:39:34.274Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1700-final-1
commit: 72bc7e910188e40b8ab680baf0e4f2fc32ec1fa4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear A-20531 with case/consumer ledgerA-20530. af14bbb3/A-20528 atsource-clear72bc7e910 completesT0/T1/all428T2/mappedT4once/Web exit0;6539ordinarytest/708filepasses,95scopedtests/files separately,0nonpass/skips/unfinished. All23generationbasecases and16added actual5/5load proofs establish successful-cycle/failed-spawn positive retirement, pending/unknown retention, exact-scope delayed receipts and held/idempotent/unknown-retired carrier proof assertions. Corrected Claude environment case11284/file11374 and compatible cleanup/settlement/revoke/sharedpriority consumers pass; old26ee09ad failure remains history.97consumerrows retain40positive/22T3deferred/35refs;269T3+remaining16T4unexecuted,T4guardbaseonly. Exact head, separate execution/source trees, uncached Linuxx64Node24.21/nvim.12.5 and actualHeadlessShell1248/CfT156.0.8078.4 reconciled; report-mode advisories/originalcapture limits retained. C1/C2verified from sourceA-20511/A-20523 plus this completed receipt. Standards0/Spec0; no Reviewer runtime/merge/enqueue. Holdreleased.

Criteria: C1 verified, C2 verified.

### impl-1700 · 2026-11-17T03:38:58.771Z

Batch regression corrected at46e807ff6, tree2a47304d98656a5841b068c6d7a1c962f61ed2ea. Full spawn admission is registered before native reentry; close joins it and retains an unreturned failed scope with unknown durable rollback, then retires on producer settlement. Public ordering regression red0vs1 before fix, green after; generation24/24, compiler/static lint pass. Local native comparisons A-20587 prove3task reds vs3dev greens. Corrected native A-20595 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20595-t-1700-corrected-native-rollback-three-whole-file-passes) proves45/45 three serial times at unchanged head, original credential scan and sibling assertions intact; scan-positive control changes native file so verification must select it. Native slot released; fresh reviewer request delivered. C1/C2 done, qaPolicy none. Historical ready/green receipt did not execute this T3 case; no corrected-head configured receipt yet. Consumer disposition: existing constructor/AdapterHost/lifecycle census A-20498/A-20530 remains; corrected .close now honors its existing pending-work/handed-off rollback ownership contract. The native fixture closes the facade inside adoption; test remains the same behavior with additional nonempty-root scan proof. No new wire/persisted record/API shape, outcome class, setting or role permission.

### rev-36 · 2026-11-17T03:48:15.002Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1700-source-5
commit: 46e807ff6ceedfea8cb983abca80a1750e518bf1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0 findings; Spec0 findings. A-20598 corrects the newly exposed native rollback retirement regression at direct child46e807ff6/tree2a47304d98656a5841b068c6d7a1c962f61ed2ea; no dev merge, six changed paths. Whole spawn completion is owned before native reentry; close joins completion/native shutdown before retirement and retains process-less failed scopes until the captured producer's positive rollback receipt. Existing exact-owner retirement/idempotent/unknown-proof rules preserved. New T2 ordering case uses existing whole-body/root/resource owner; native T3 both-root full credential scans, nonempty positive controls and sibling bytes retained. A-20595 native logs independently show three current-head45/45 whole-file passes with argv/cwd/code0/signalnull, distinct from configured coverage. A-20597 preserves candidate red/green24/24/typecheck/lint excerpts/limits and additively corrects two A-20587 duration transcriptions using literal logs; no outstanding finding. Full97old+26current consumer paths reconciled123rows with exact pinned tiers and pending/deferred/default/QA boundaries. C1/C2 unverified until completed same-head configured evidence: explicitly require actual positive changed native claude-code-remote.test.ts and new generation ordering base/load finishes. Prior parent A-20528 did not execute native rollback file and stays historical. No Reviewer runtime/test/compiler/lint/native/browser/probe/edit/rerun or merge.

### impl-1700 · 2026-11-17T03:53:30.414Z

Source-clear46e807ff6 configured run64143eb7-a5d2-45f6-8f1b-248d2def95d5 admitted once. CLI dry-run timed out; MCP preview succeeded and explicitly selected claude-code-remote.test.ts in durationCheck.files, with loadGate true/fallback allT2/mappedT4. Actual admitted log lists native file and T3 command; final evidence must observe its completed cases plus all24generation/new ordering load identity. HostT0 exited0 (91.636s diagnostic); local window released. No remaining-phase pass claimed, no source change or cancellation/resubmission. Standing Coordinator condition allows one same-head retry only if failure is exclusively known doctor-hosts C1/C6/T-1930.

### impl-1700 · 2026-11-17T04:22:15.745Z

Same-head configured run64143eb7/A-20605 passed at46e807ff6:6585/6585, no failures/cancellations/skips. Read-only streamed event check independently confirms generation ordinary24passes plus85load passes; new ordering identity passes base atA-20605:9910 and5actual load receipts at12213/12228/12252/12273/12323. Native claude-code-remote.test.ts actually completed45passing identities; original rollback scan case passes at34061. Verification provenance head46e807ff6/treecf9e98a4667a8022e95bcb650b4cebd86718711e (distinct from Git source tree2a47304d...); droplet Linuxx64 6.8.0-147-generic, Node24.21.0, Neovim0.12.5; Chrome Headless Shell binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Executor c-8 ams3 lifetime1644s/cost$0.1142,2workers; no cache. T0/T1/allT2/selected nativeT3/mappedT4once/Web completed; remainingT3/T4 deferred, not blanket native coverage. Lint/budgets/ratchet/skip checks retain report-only limits; no performance claim. Reviewer has the automatic same-head result; awaiting final evidence settlement, head unchanged/claim retained. Durable log A-20605: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20605-suite-64143eb7-a5d2-45f6-8f1b-248d2def95d5-auto-at-46e807f.log.

### rev-36 · 2026-11-17T04:23:51.786Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1700-final-2
commit: 46e807ff6ceedfea8cb983abca80a1750e518bf1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0 findings; Spec0 findings. Final corrected-head evidence clear from current source rev-36-1700-source-5/A-20598 and completed configured run64143eb7/A-20605; C1/C2 verified. A-20606 independently reconciles all24generation base cases plus17new identities each5typed load finishes/5-of-5 receipt, including new close/rollback ordering. Required changed native Claude file actually ran45/45 and file finish34199; previously failing full credential-copy rollback case positively finishes34061, both-root nonempty scans and sibling assertions retained in source. Whole run6585ordinarytest/709file passes plus85separate scopedtest/file passes, no nonpass/skips/unmatched emitted starts. T0/all224T1/all428fallbackT2/changedT3/mappedT4base/all55Web complete. Remaining268T3/16T4unexecuted; no native/T4 repetition or installed real harness claim. Actual browser34277 HeadlessShell1248/CfT156.0.8078.4; uncached Linuxx64 Node24.21; exact head and source/execution trees distinguished. All123consumer rows reconciled41positive/21deferred/61references. Historical native-red/old-green/candidate capture limits and A-20597 duration correction retained; budgets/lint/ratchet remain report-only. No Reviewer runtime/probe/edit/rerun or merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T05:13:59.711Z

Merged 8d769e25315d4a78ec371ef6907182f3bcc4cad4 onto dev.
