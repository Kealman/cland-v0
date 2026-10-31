---
id: T-1494
kind: task
title: Verifiers can decline or release an accepted request without a verdict
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1283
branch: t/T-1494-verifiers-can-decline-or-release-an
created: 2026-10-30T19:25:12.366Z
updated: 2026-10-31T20:56:00.466Z
closed: 2026-10-31T20:56:00.466Z
---

## Summary

A verifier that accepts a request it will not serve, because the request was withdrawn, is a duplicate, or is already owned by another verifier, has no way to release the pending reservation except posting a verdict. `task.hold` release only removes a real tracker hold. On 2026-10-30 this left rev-26 excluded from assignment for an hour (T-1487). T-1487 retires stale pendings automatically on later verdicts and accepted newer requests. An explicit decline would close the remaining gap: the verifier states the reason, and the request goes back to the queue or to the requester.

Origin: impl-1487's T-1487 scope note (2026-10-30). Adding it means a role-tool change and a relaunch (role tools are fixed at launch), so it needs its own item.

## Acceptance criteria

- [x] C1. A verifier declines an accepted request with a one-line reason; the pending reservation clears at once, the requester gets the reason, and the request is reassigned or returned without a verdict being recorded.
  - done: impl-1494 · 2026-10-31T18:46:35.227Z
  - verified: rev-26 [reviewer] · run rev-20261031-1494-evidence-3 · 2026-10-31T19:38:29.607Z · commit 7e13db9f41b8bc36dec52edc18f94ff545c7ade8

## Comments

### impl-1494 · 2026-10-31T18:35:42.198Z

Contract inventory before implementation: new verification.decline spoke tool/frame; production consumers are protocol SpokeRequest/isSpokeRequest, spoke tools/spoke forwarding, role permissions/default-roles launch templates, dispatcher and Core pending-verification + verification-receipt metadata. Existing pending {item,kind,head?} projection and request wire shapes stay unchanged. Consumers searched by task.hold, pending-verification, PendingVerification, verifierRequest and tool lists: who/session lists, tracker holds/verdict cleanup, role launch/permission tests, harness DOCUMENTED_TOOLS, T2 verifier-routing, T3 native session tests and T4 inbox verifier/load fixtures; these retain existing shapes. Documentation consumers: hub README, docs/review-and-qa.md, docs/agents/{session-permissions,issue-tracker,tests}, qa and implement skills. Planned seam: existing sealed projectHub real spoke frames in verifier-routing.test.ts, both Reviewer and QA, durable accepted delivery and stored notice; no native process or browser.

### impl-1494 · 2026-10-31T18:38:27.859Z

Consumer inventory published as A-15031, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15031-t-1494-verifier-contract-consumer-inventory.txt. Explicit chosen behavior: return declined work to original requester, not automatic requeue; other queued requests can use released capacity. Pending wire projection and legacy request semantics remain unchanged; old hubs refuse the additive tool. No QA required (per-item qaPolicy none, no qaCriteria). Red controls: both reviewer/qa generated cases failed original source at declined.ok false !== true after setup polling corrections; 77/77 routing cases then passed on changed source (local macOS, in-process projectHub, no browser/native harness).

### rev-26 · 2026-10-31T18:43:19.411Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1494-source-1
commit: 65be0e19ca730ad983d8bde21448b84e5eed221b
scope: full
findings: [{"severity":"medium","text":"M2: non-null noticeToSessions can contain unresolved pending requester IDs with no admitted delivery; decline ignores pending and clears the reservation. Null captured agent identities also fall through to topic-only notice. Preserve pending on incomplete admission or own durable identity-bound notice reconciliation; add unavailable/late/null controls.","file":"hub/src/hub/core.ts","line":1991},{"severity":"medium","text":"M1: new root/hub/spoke setup is directly awaited without pre-registered shared acquisition/deadline ownership; projectHub teardown registers only after startup. Compose existing caseDeadlines/client seams and prove omitted/aborted setup plus early-failure drainage while preserving assertions.","file":"hub/test/verifier-routing.test.ts","line":1018},{"severity":"medium","text":"M3: permissions add verification.decline but Reviewer/QA clauses and the owning code-review skill workflow omit it. Update existing work lines and skill/provenance with exact receipt/reason and separate hold release, within clause byte reserve.","file":"hub/src/roles/default-roles.ts","line":219}]
finding_counts: {"high":0,"medium":3,"low":0}

A-15033 consolidates full source1 audit: three medium findings, no additional findings. Receipt/current-role/transaction/tool wiring checked; proposed fixes remain separate from this frozen head. Local 77 routing cases/typecheck/lint summary is partial evidence, no reviewer workloads. Preserve semantic assertions and complete fixes together; request fresh exact pushed-head source review before configured verification. No full run requested.

Criteria: C1 failed (An unresolved or uncaptured agent requester can lose the decline reason after the reservation has been cleared.).

### impl-1494 · 2026-10-31T18:46:21.804Z

Source1 M1–M3 corrections: new decline cases now register caseDeadlines before root work with separately named root/hub/client setup bounds. Added omitted/aborted late-acquisition and post-client early-failure controls asserting root retention, joined cleanup and positive hub.stopped before removal. M2 red-first missing/null requester controls failed source1 true !== false; production now rejects agent null captured identity and transactionally rejects noticeToSessions pending deliveries, preserving both reservation keys and rolling back notice. Retained legacy NULL-admission rows with missing identity stay fenced; a late captured identity receives the reason on retry. M3 revises existing Reviewer/QA work lines (no added lines; both shorter than source1), preserves verdict rules, and updates owning code-review workflow/provenance. No dev merge after first review.

### rev-26 · 2026-10-31T18:51:04.199Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1494-source-2
commit: c656e6f40e6caa6d6d8a86c5981943e797b53967
scope: full
findings: [{"severity":"medium","text":"The fault control's real-context emergency cleanup never invokes the intercepted shared disposer unless the body reaches cleanup = dispose(). An earlier assertion or setup observation failure can leave fixture clients/root undisposed; raw entry/cleanup/stopped waits also lack independent real-clock bounds while the injected FakeClock is stationary. Invoke the shared disposer unconditionally and idempotently from emergency cleanup, immediately observe the assertion promise, and retain actual assertion-failure/finally coverage with bounded drainage.","file":"hub/test/verifier-routing.test.ts","line":1103}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 review at c656e6f40e6caa6d6d8a86c5981943e797b53967. Standards: sole remaining medium M1 is fault-control ownership and observation bounds at hub/test/verifier-routing.test.ts:1103; details in A-15035. The intercepted caseDeadlines disposer is not registered on the real test context, while emergency cleanup merely awaits a cleanup variable assigned later in the body. Spec: M2 requester identity/admission and M3 role/workflow documentation are corrected; no further spec finding. C1 remains done but runtime unverified; this remaining control-only defect does not independently refute its public behavior. Original A-15034 contains 82/82 passing local case records, but these do not establish the missing early-failure cleanup path. No reviewer tests, full suite, native harness or browser execution. Replacement pushed-head source review is required before configured verification.

### rev-26 · 2026-10-31T18:52:00.966Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1494-source-3
commit: 8aaaf6426944974c17183c5cc9e99b7cacc3687c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15037 records the exact-head source3 audit. Standards: no remaining findings; M1 now invokes the memoized shared disposer from pre-registered emergency cleanup, independently bounds observations with the real clock, immediately observes assertion rejection, and retains an actual assertion-failure/finally drainage control plus positive shutdown/root-removal assertions. Spec: no remaining findings; source2 M2/M3 corrections are unchanged. Only the control file and its guide changed since source2. C1 remains done, runtime unverified until exact-head configured verification and original-record evidence review. A-15036 local macOS 83-case/final four-control/typecheck/lint summary is qualified local evidence, not a reviewer workload or full-suite receipt. No T3/T4/browser/native harness execution claimed.

### rev-26 · 2026-10-31T18:57:49.274Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1494-evidence-1
commit: 8aaaf6426944974c17183c5cc9e99b7cacc3687c
scope: evidence
findings: [{"severity":"medium","text":"Original run fails the QA execution-procedure assertion after shortening its Work clause; roles-clauses.test.ts:129 also fails the retained 'do not fix findings' wording. Preserve the existing execution/permission/no-fixes semantics and deliberately retain or migrate all owning clause guards.","file":"hub/test/review-qa-component.test.ts","line":33},{"severity":"medium","text":"The exhaustive spoke-tool baselines omit verification.decline, so the tool-list deep equality fails and validation coverage for the new tool never runs. Add its valid baseline through a permitted verifier and preserve exhaustive required/unknown/type assertions.","file":"hub/test/tool-arguments.test.ts","line":88}]
finding_counts: {"high":0,"medium":2,"low":0}

A-15041 audits original failed A-15040/run14c45f5b at exact source-clear head. T0 exit0, T1 native exit1 with three task-owned consumer failures, final exit1; later T2/T3/T4/Web unexecuted. Original output: QA points to UI/CLI controls at review-qa-component:33, /do not fix findings/ mismatch at roles-clauses:129, missing verification.decline baseline at tool-arguments:88. Independently paired 1,618 identities: ordinary1267pass/3fail plus165pass/3fail files; separate90loadtest/90loadfile passes; no unpaired IDs. Linux x64 droplet c-8 lon1 Node24.21/Nvim0.12.5, exact head, cache/occasion/browser null; candidate differs only by excluded tracker/rules. Report-only advisories retained. C1 remains runtime unverified; own T2 behavior controls did not execute, so no public-behavior failure mark inferred. New pushed-head source review required before another run; Coordinator handles replacement scheduling authority.

### impl-1494 · 2026-10-31T18:58:12.903Z

Run 14c45f5b-95bb-4437-a03c-0d01956cf173 at 8aaaf6426 exited 1: original A-15040 says AssertionError 'QA points to UI/CLI controls', missing /do not fix findings/, and tool-name deep-equality lacks verification.decline baseline. These are task-owned consumer misses. Restored QA exact execution/check permission/no-fix phrases on its existing line; retained decline and separate hold release. Existing reserve guards pass. Exhaustive tool matrix now declares request+reason baseline and uses Reviewer for its malformed frames; deep-equality, required-field and type assertions preserved. Reproduced all three locally red before edits, then sequential whole-file green: review-qa-component 1/1 (0.081s), roles-clauses 39/39 (0.099s), tool-arguments 10/10 (0.430s), local macOS T1, no process/browser. Coordinator decision f375e458 authorizes one replacement mode-free run after new source clear; T2/Web/T3/T4 from failed run remain unexecuted, not passes.

### rev-26 · 2026-10-31T18:59:09.771Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1494-source-4
commit: 17f9bfed51b0981115e4e0591008d73884a78146
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15043 records full continuing source4 audit. Exact three-file parent/head correction restores QA execution, beyond-brief check permissions and do-not-fix wording on its existing Work line while retaining decline/receipt/reason/no-verdict/separate-hold instructions. Original clause guards unchanged. Exhaustive tool fixture adds verification.decline request/reason and permitted Reviewer caller; tool-name equality and malformed required/unknown/type assertions remain intact. Owning guide aligned; A-15042 inventory checked. No remaining Standards or Spec findings. Earlier decline production/ownership corrections unchanged. C1 remains done and runtime unverified pending same-head configured evidence; failed A-15040 remains failed with T2 and later phases unexecuted. Local macOS 1/39/10 whole-file passes/typecheck/lint are implementer summaries, not configured/runtime proof. No reviewer workloads.

### rev-26 · 2026-10-31T19:16:30.861Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1494-evidence-2
commit: 17f9bfed51b0981115e4e0591008d73884a78146
scope: evidence
findings: [{"severity":"medium","text":"Original A-15053 fails text.includes(reviewerList): the fixture embeds the old Reviewer tools literal without verification.decline. Migrate that owning list while retaining exact matching, edited-permission reload, grant/revocation and audit assertions; inventory other literal permission-list consumers.","file":"hub/test/permissions.test.ts","line":519}]
finding_counts: {"high":0,"medium":1,"low":0}

A-15054 original failed run44f206d1 audit: exact source-clear head, T0/T1exit0, T2nativeexit1, later T3/T4/Web unexecuted. Actual sole failure permissions.test.ts:520 assert.ok(text.includes(reviewerList)), false expected true; earlier built-in/default table equality passed. 5026 complete progress pairs: ordinary3837pass/1fail and427pass/1fail files; separate380loadtest/380loadfile passes. Eight own decline/identity/cleanup generated cases each have one base plus five distinct load passes, recorded by original line numbers; valid partial evidence only. C1 remains runtime unverified for final settlement, no behavior failure mark inferred from obsolete fixture literal. Linuxx64 droplet c8lon1 Node24.21/Nvim0.12.5, exact head, candidate differs only excluded tracker/rules, cache/occasion/browser null. Report advisories retained; no reviewer workloads. New source review before replacement run.

### impl-1494 · 2026-10-31T19:21:00.281Z

Closed the missed-consumer class before source5: searched every named role/tool table, grant/permission section, parser/template/tool registry and usage/doc/skill consumer across hub T1–T4, Nvim/web, shipped skill workflows and fixtures. A-15055 records assessment and exact per-file receipts; A-15056 retains raw source matches. T4 workload uses unchanged task.hold frames and has no independent tool table. Migrated permissions.test.ts exact literal reviewerList; kept literal-match/reload/grant/revocation/audit assertions. Corrected README Reviewer/QA permissions table. On local macOS Node24.21, 56 matching/owning test files ran one at a time: 636/636 passed, zero skip/fail/cancel/todo; includes native T3, isolated Chrome Headless Shell Web (version unrecorded), and Nvim. Typecheck/lint exit0 (122 advisory findings, no refusals). These targeted files are not a full suite. Pushed 7e13db9f41b8bc36dec52edc18f94ff545c7ade8; no post-source1 dev merge.

### rev-26 · 2026-10-31T19:21:50.686Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1494-source-5
commit: 7e13db9f41b8bc36dec52edc18f94ff545c7ade8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15058 source5 full continuing audit: complete three-file diff migrates exact Reviewer permission literal, README table and owning guide; inclusion/replacement/reload/grant/revocation/audit assertions unchanged. No production or fixture owner change. A-15055/56 consumer inventory checked, including legacy grants, unchanged hold/projection/CLI/T3/T4 consumers and direct role-list literals. Parsed all56 A-15057 original local logs:636tests/pass, zero fail/cancel/skip/todo, consistent totals. Local macOS Node24.21 native/Nvim/isolated-Web targeted evidence, browser version explicitly unknown; not full configured proof. C1 remains done/runtime unverified; original failed A-15040/A-15053 and partial own-case receipts retain their heads/outcomes. No remaining Standards or Spec findings, no reviewer workloads. Exact-head configured result and final original-record audit remain required.

### rev-26 · 2026-10-31T19:38:29.607Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1494-evidence-3
commit: 7e13db9f41b8bc36dec52edc18f94ff545c7ade8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15065 independently audits original A-15063/runff79485d at unchanged source5 head. C1 verified: Reviewer/QA exact receipt, one-line reason, pending clearance, requester delivery, no verdict, stale/other-identity fences; missing/null requester and four cleanup controls each one base+5 distinct sequential load passes. All four prior failed consumers now pass at3631/3699/6387/13939. 5125 complete matching pairs:4524ordinarytest/521file plus40loadtest/40loadfile passes, zero adverse/unpaired and six empty failure arrays. T0/T1/allfallbackT2 inclNeovim/selectedrolesT3four/selectedinboxverifierT4onebase/Web exit0; remaining T3/T4 unexecuted, T4repetitions skipped. Exact head/candidate provenance checked; candidate differs only1540excludedtracker/rules, Linuxx64 droplet Node24.21/Nvim0.12.5 actual isolated Shell1248 Chrome156.0.8078.4, cache/occasionnull/skips[]. Typecheck host reuse and report advisories qualified. Prior red A-15040/A-15053 retained. No reviewer workload; configured task evidence, not full integrated all-tier coverage.

Criteria: C1 verified.

### coord · 2026-10-31T20:56:00.466Z

Merged c05755231ad555ee3cc2f704e86ed2aeb06492ad onto dev.
