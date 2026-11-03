---
id: T-1598
kind: task
title: Per-session forwards on the master
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1595
topic: topic-1363
branch: t/T-1598-per-session-forwards-on-the-master
created: 2026-11-02T03:33:54.978Z
updated: 2026-11-03T09:55:50.276Z
closed: 2026-11-03T09:55:50.276Z
---

## Summary

The carrier adds a per-session forward on the live master with `-O forward -L`. It runs from a hub-side Unix socket to a host Unix socket (Codex) or to a host loopback port (OpenCode), is cancelled with `-O cancel`, and is re-added with a short retry after every reconnect.

Hot files: `hub/src/transport/ssh.ts`, `hub/test/transport-forwards.test.ts` (new)

## Acceptance criteria

- [x] C1. A forward to a host Unix socket and one to a host loopback port each give a hub-side Unix socket under the host's directory that reaches its target, and no hub-side TCP listener is created (test).
  - verified: rev-35 [reviewer] · run rev-35-1598-final-1 · 2026-11-03T08:25:18.768Z · commit a60b02a3c1dbe6fc9b6cc1ca0b7f60aeb6df200e
  - done: impl-1598 · 2026-11-03T08:26:29.414Z
  - verified: rev-35 [reviewer] · run rev-35-1598-final-2 · 2026-11-03T08:49:17.739Z · commit 1bccf9a6cd4a962bd8a587f5c91ee26cf55c8191
- [x] C2. Cancelling a session's forwards removes them from the master and their hub-side socket files (test).
  - verified: rev-35 [reviewer] · run rev-35-1598-final-1 · 2026-11-03T08:25:18.768Z · commit a60b02a3c1dbe6fc9b6cc1ca0b7f60aeb6df200e
  - done: impl-1598 · 2026-11-03T08:26:29.650Z
  - verified: rev-35 [reviewer] · run rev-35-1598-final-2 · 2026-11-03T08:49:17.739Z · commit 1bccf9a6cd4a962bd8a587f5c91ee26cf55c8191
- [x] C3. After a SIGKILLed master reconnects, every forward still recorded is back within the retry window, and one that keeps failing is logged once with its session and given up after the last retry (test).
  - verified: rev-35 [reviewer] · run rev-35-1598-final-1 · 2026-11-03T08:25:18.768Z · commit a60b02a3c1dbe6fc9b6cc1ca0b7f60aeb6df200e
  - done: impl-1598 · 2026-11-03T08:26:29.854Z
  - verified: rev-35 [reviewer] · run rev-35-1598-final-2 · 2026-11-03T08:49:17.739Z · commit 1bccf9a6cd4a962bd8a587f5c91ee26cf55c8191

## Notes

Shared files: `hub/src/transport/ssh.ts`

## Comments

### impl-1598 · 2026-11-03T07:21:52.203Z

Consumer inventory (field/function and importer search across hub/src, hub/test, shared, web, nvim, skills, docs and QA): SshTransport production has no constructors yet; existing transport-ssh.test.ts is its only constructor consumer. Transport status/registry/policy consumers remain unchanged. HostEndpoint forward/unforward consumers are local.ts, test-host.ts, host-contract.ts and launch-files.test.ts; no Host interface change. hostPaths.sessionSocket is consumed by host-records.test.ts; reused unchanged. fake-ssh.ts/common supports forward/cancel already; fake-ssh tests and transport-contract remain unedited. QA stage-2 constructor census and transport docs remain valid. Additive carrier methods prepare T-1599; no wire/persisted shape changes.

### impl-1598 · 2026-11-03T07:26:45.076Z

Implemented and pushed 0563dcda2ed53a4c33c0a860f690cb085ed02439; all criteria done; source review requested. A-16208 retains local named-case and static evidence, initial fixture/manifest errors and C3 red observation, with platform/coverage limits. Final long-TMPDIR forward2 and unchanged carrier6 pass; typecheck, tiers and lint exit0. Await clear source verdict before mode-free verify. QA affected/after-stage remains separate.

### rev-35 · 2026-11-03T07:31:06.676Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1598-source-1
commit: 0563dcda2ed53a4c33c0a860f690cb085ed02439
scope: full
findings: [{"severity":"medium","text":"unforward deletes its sole session entry before socket unlink. Non-ENOENT failure leaves no retry/stop cleanup owner; retry returns success without removal. Exhausted restore repeats delete-before-unlink at213–215 and skips terminal session log on error; initial failed install also lacks retained cleanup if unlink fails. Keep captured pending-cleanup/cancelled-or-retired state until positive removal, preventing reinstall/repeated cancellation, and add injected failure/retry/stop controls.","file":"hub/src/transport/ssh.ts","line":104},{"severity":"low","text":"No-TCP assertion scans only master control-socket owners. Positive TCP control remains open in the worker until teardown, which is never inspected after creation; a worker-side accidental listener would pass. Close/join the control after detection and include worker plus master in the negative census.","file":"hub/test/transport-forwards.test.ts","line":68}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source not clear:1medium/1low, source state-transition findings, no Reviewer reproduction. Cleanup ownership must survive unlink failure in cancellation/exhaustion/initial install; retain terminal phase to avoid reinstall or re-cancel on retry. Serial queue/master native joining otherwise reviewed; stable Transport unchanged. A-16208 local forwards2/carrier6/static evidence is supplemental; C3 red valid, C1 setup failure not baseline-red behavior. No queued verification yet. Fresh fixed-head source review before verify; affected after-stage QA separate. Detail A-16209: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16209-t-1598-source-review-retain-cleanup-ownership-after-forward-removal-failures.md.

Criteria: C2 failed (Socket unlink failure loses cancellation cleanup ownership; later unforward reports success without retrying removal.), C3 failed (Exhausted-restore unlink failure forgets the session and skips the required terminal session log.).

### impl-1598 · 2026-11-03T07:33:24.790Z

A-16209 correction in progress: private SessionForward cleanup phase retains removal ownership through filesystem failures. Additive SshOptions.unlinkSessionSocket fault seam is consumed only by transport-forwards.test.ts; existing transport-ssh.test.ts and production construction compatibility unchanged. No wire or persisted-shape changes. Wired red tests reproduced missing second cancellation/stop rejection and missing terminal restore log; correction tests now pass. No dev merge after first review.

### impl-1598 · 2026-11-03T07:36:45.357Z

Pushed corrected heada391280549dfcc277957fbb1896016b461aa1968 and requested fresh full source review for A-16209. A-16212 retains wired-red3 and corrected long-TMPDIR forwarding5, unchanged carrier6, final-head typecheck/lint exit0 (122 advisory findings, zero refusals). No dev merge, queued verification or QA claim; awaiting source verdict.

### rev-35 · 2026-11-03T07:38:50.638Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1598-source-2
commit: a391280549dfcc277957fbb1896016b461aa1968
scope: full
findings: [{"severity":"low","text":"Wait for replacement cleanup uses a count of generic SSH connection/admission failure diagnostics, which can include unrelated failures and does not identify this socket's completed cleanup on a captured replacement. Use a bounded specific completion receipt armed before reconnect, retaining final no-reinstall/log assertions (rule9).","file":"hub/test/transport-forwards.test.ts","line":123}]
finding_counts: {"high":0,"medium":0,"low":1}

Corrected full source clear with1low. A-16209 medium resolved: pending-removal state retained until unlink success/ENOENT, cancellation acknowledgement not repeated, failed initial install retained, reconnect never reinstalls cleanup entries, terminal exhaustion log follows owned-master close before fallible removal. Stop serializes cleanup and retains registry ownership on error. Native TCP low resolved by joined control and worker+master census. New fault cases cover retry/stop/exhaustion/initial install; remaining low is intermediate generic-log wait specificity at test123. C1–C3 runtime-unverified pending fresh exact-head mode-free verify; local A-16212 forwards5/carrier6 is supplemental macOS pre-commit/source-linked evidence. Task.view still showed C2/C3 failed marks despite request's done claim; Implementer should restore done separately. QA affected/after-stage separate. Reviewer read only. Detail A-16214: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16214-t-1598-corrected-source-review-pending-cleanup-state.md.

### rev-35 · 2026-11-03T07:41:43.796Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1598-source-3
commit: 56c90e626fcb3d9cadce8b5cc098964348856138
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, no findings. Remaining A-16214 low resolved: setup-armed collector records exact socket/EACCES/master token at injected rejection; test waits for first abandonment then same socket failure on distinct replacement before manual unforward, with explicit receipt and final no-reinstall/log assertions retained. Only test+guide differ from source-clear a39128054; production pending-cleanup fix unchanged. C2/C3 done marks restored. C1–C3 runtime-unverified until fresh same-head mode-free verify/named five forward outcomes; in-progress local checks not inferred as passed, prior A-16212 retains provenance limits. QA affected/after-stage separate. Reviewer read only. Detail A-16216: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16216-t-1598-source-review-specific-replacement-cleanup-receipt.md.

### rev-35 · 2026-11-03T07:58:22.782Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1598-evidence-1
commit: 56c90e626fcb3d9cadce8b5cc098964348856138
scope: evidence
findings: [{"severity":"medium","text":"Required queued T3 is rejected by legacy enforcing duration limits: C3 SIGKILL restore19.4s>5s and C3 exhausted-cleanup9.727s>5s, without exact-case allowances. All five functional identities pass; this is duration-admission failure, not failed recovery/ownership assertions. Add justified narrow allowance or reduce work while retaining functional bounds; fresh source review for changed head.","file":"hub/test/transport-forwards.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; exact-head7a0241dd/A-16222 overall/T3 exit1. Independently checked five functional pass rows and suite test failures[], then actual enforcing lines25860–61 `19.4 s > 5 s`/`9.727 s > 5 s`; report-only tier/lint/ratchet notices are distinct. Whole-case timing is not recovery latency; no new production failure inferred. T0/T1/allT2 completed,Web unexecuted,remainingT3 deferred,T4 unexecuted. Uncached Linuxx64 c-8lon1 Node24.21/Nvim0.12.5, tree8500c0a89656868cd7c7eec271dd8726eee8382e, browser null. C3 failed on required verification; C1/C2 final marks pending. Lead preparing narrow allowance; changed head needs fresh source review before verify. Reviewer read only. Detail A-16223: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16223-t-1598-evidence-not-clear-enforcing-duration-limits.md.

Criteria: C3 failed (Queued T3 rejects both C3 case durations19.4s and9.727s against enforcing5s cap despite functional passes; overall verification incomplete.).

### impl-1598 · 2026-11-03T07:59:22.962Z

Per Coordinator a1375ab0, no allowance: SshOptions adds optional reconnectDelayMs and forwardRetryDelaysMs schedule seams, used only by transport-forwards.test.ts; existing carrier tests omit them and retain defaults. Transport members/wire/storage unchanged. Search of hub/src, hub/test, docs, QA and skills found no other schedule-field consumers or old combined test-title keys requiring migration. Split answering-recovery/exhaustion cases preserve assertions. Local long-TMPDIR6 pass, slowest2.151s; Linux timing awaits reviewed-head verify.

### rev-35 · 2026-11-03T08:00:58.944Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1598-source-4
commit: a60b02a3c1dbe6fc9b6cc1ca0b7f60aeb6df200e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Scheduling correction source clear, no findings. Independently read Coordinatora1375ab0: inject short schedules, retain defaults/receipts, no allowance. Omitted reconnectDelayMs retains computed jittered policy; omitted forwardRetryDelaysMs retains100/200ms. Retry count/abort/native ownership/cleanup phases unchanged. Fixture10ms/10–10ms and case split retain distinct-master answering recovery, cancelled absence,3 failures/one log/no future retry, survivor exchanges and exact cleanup receipts; reconnect count3→2 reflects removed earlier fixture cycle. All10s functional bounds retained; docs/CHANGES/inventory updated, no durations change. C1–C3 runtime-unverified until fresh same-head verify/six named forwards/budgets. Local reported6+carrier6 precommit source-linked, not Linux/queued timing. A-16222 remains failed history. QA affected/after-stage separate. Reviewer read only. Detail A-16224: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16224-t-1598-source-review-injectable-lifecycle-schedules.md.

### impl-1598 · 2026-11-03T08:25:07.238Z

Exact-head b5488b24/A-16228 green at a60b02a3c: hub4913pass, no failures/cancels/skips/todo. A-16229 independently streams all6 named forwarding outcomes/pass,<5s. Linuxc-8nyc1 Node24.21/Nvim0.12.5 HeadlessShell1248 ChromeForTesting156.0.8078.4; T0/T1/allT2/selectedT3/Web complete; restT3 deferred/T4 not run. Final evidence review requested before Coordinator-authorized dev merge cc6ea768. Fresh merge-tree exit1 solely tiers.json; head clean/unchanged. Coordinator holds landing for E-1536 demo about3h.

### rev-35 · 2026-11-03T08:25:18.768Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1598-final-1
commit: a60b02a3c1dbe6fc9b6cc1ca0b7f60aeb6df200e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C3 verified, no findings. Exact-headb5488b24/A-16228 exit0,4913 pass/zero fail/cancel/skip/todo. Independently streamed six named forward outcomes at25845–70, all enforcing5s cap satisfied(max4.566730917s), no allowance/manifest change. Unix/loopback relay/native worker+master census, cancellation retry/stop retained ownership, distinct-master recovery,3 retries/one terminal log/no reinstall and failed-initial cleanup assertions pass. Policy/status ordinary passes; unchanged default-carrier6 exists only in A-16225 local macOS precommit/source-linked raw evidence, not selected Linux T3. T0/T1/allT2/Web + changedT3 sixcases once completed; remainingT3 deferred,T4 unexecuted. Uncached Linuxx64 c-8nyc1 Node24.21/Nvim0.12.5, tree05cf179b4dd5b0c1416b05eb3c27555709871b3e, isolated HeadlessShell1248/Chrome156.0.8078.4. Report-only tier/lint/ratchet/skip diagnostics distinct from satisfied enforcing identity gate; skips[]/missing0. Whole-case times not recovery latency. Old A-16222 remains failed; affected after-stage QA separate. Reviewer read only. Detail A-16230: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16230-t-1598-final-evidence-session-forwards-and-retained-cleanup.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1598 · 2026-11-03T08:26:40.910Z

Authorized cc6ea768 merge completed after final-clear A-16230. New head1bccf9a6c merges dev30dfeeede; sole tiers.json conflict union retains forwarding+fake-contract+ssh-contract entries. npm test:tiers and long-TMPDIR forward6 pass locally; production/forward test source unchanged from prior green. A-16231 parent-relative evidence; delta review requested before fresh verify. Landing held for E-1536 demo.

### rev-35 · 2026-11-03T08:28:10.534Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1598-delta-source-1
commit: 1bccf9a6cd4a962bd8a587f5c91ee26cf55c8191
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear, no findings. Independently read Coordinatorcc6ea768 and both parent diffs: carrier and forwarding source unchanged from prior final-clear a60b02a3; incoming T-1625 contract/fixture/entries unchanged from30dfeeede. Tier conflict union retains all3 T3 entries sorted, guide index retains all3 memberships. Stable Transport and pending-cleanup/schedule behavior preserved. C1–C3 unverified at new head pending fresh mode-free verify/six forward and both contract outcomes. A-16228 predecessor proof not merged-head receipt; A-16231 local precommit/source-linked checks supplemental. Coordinator demo landing hold remains separate. Reviewer read only. Detail A-16232: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16232-t-1598-authorized-merge-delta-source-review.md.

### impl-1598 · 2026-11-03T08:29:24.569Z

Merged-head source clear A-16232 at1bccf9a6c. Exact-head local unedited fake/SSH contract identities2pass, native exits0, A-16233; macOSarm64Node24.21, fakes only. Fresh mode-free verify31623968 admitted queue1. Source unchanged/clean, awaiting hub receipt and final evidence review; landing hold retained.

### rev-35 · 2026-11-03T08:49:17.739Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1598-final-2
commit: 1bccf9a6cd4a962bd8a587f5c91ee26cf55c8191
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final evidence clear; C1–C3 verified, no findings. Exact-head31623968/A-16236 exit0,4915 pass/zero fail/cancel/skip/todo. Independently streamed all6 named forwarding outcomes(max3.324497262s, enforcing5s cap satisfied) plus both correct-file transport contract outcomes; policy/status also pass. No allowance or assertion weakening, production/defaults/cleanup unchanged since delta-source clear A-16232. T0/T1/allT2/Web + selectedT3 threefiles/eightcases once complete; remainingT3 deferred,T4 unexecuted. Uncached Linuxx64 c-8nyc1 Node24.21/Nvim0.12.5, treee730cd9c05619a342451834cd0f741ae5686138a, isolated HeadlessShell1248/Chrome156.0.8078.4, skips[]/missing0 report. A-16233 local exact-head contracts supplementary; A-16231 precommit/source-linked forwards separate. Tier/lint/incomplete ratchet advisories report-only; whole-case times not recovery latency. Old A-16222 failed history. Affected after-stage QA and Coordinator demo landing hold separate. Reviewer read only. Detail A-16237: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16237-t-1598-merged-head-final-evidence-with-transport-contracts.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1598 · 2026-11-03T08:50:00.011Z

Merged-head final evidence clear A-16237; C1–C3 verified, hub statusready. Exact-head31623968/A-16236 exit0,4915pass/zero fail,cancel,skip,todo; A-16238 independently confirms all8 forwarding/contract pass,<5s. Linuxc-8nyc1 Node24.21/Nvim0.12.5 HeadlessShell1248 ChromeForTesting156.0.8078.4; T0/T1/fallbackallT2/selectedT3once/Web complete, remainingT3 deferred/T4 unexecuted/after-stageQA separate. Lifetime1101s//bin/zsh.0764; report-only diagnostics remain advisory. Fresh fetchdevda225fb5 merge-tree exit0/tree2a67120f, no head change. Coordinator ffc45679 lifted demo hold/enqueued1bccf9a6 second behind T-1602; claim retained until landing. T-1599 gets a fresh session.

### coord · 2026-11-03T09:55:50.276Z

Merged 54e32c63df7d7aa40e7cd88fc87f7045bffc64b8 onto dev.
