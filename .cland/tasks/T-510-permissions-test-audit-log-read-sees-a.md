---
id: T-510
kind: task
title: "permissions test: audit log read sees a partial JSONL line while the hub appends (Linux)"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-309
branch: t/T-510-permissions-test-audit-log-read-sees-a
created: 2026-10-15T15:56:19.661Z
updated: 2026-10-15T19:41:01.058Z
---

## Problem

`hub/test/permissions.test.ts:24`: `audits()` JSON.parse threw "Unexpected end of JSON input" while `check()` read the audit log on Linux, in T-459's droplet verify bbf38383 (A-3136:4015–4024). The test reads the JSONL audit log while the hub is still appending, so it can see a partial last line.

## Acceptance criteria

- [x] C1. The audit reader in the test ignores, or waits past, a trailing partial line, or reads only after an observed flush boundary. Every assertion stays, and the root cause is recorded in the commit. If the product's own audit reader has the same exposure, say so in the commit and file it.
  - done: impl-510 · 2026-10-15T16:59:49.540Z
  - verified: rev-30 [reviewer] · run rev-20261015-510-source · 2026-10-15T17:00:28.279Z · commit 805972cf6803332a1eaf35dcf83be7918de1f297
  - verified: rev-30 [reviewer] · run rev-20261015-510-delta · 2026-10-15T17:54:38.560Z · commit 64bd51a367e455f041c2a45e1feac639a5e84baa
  - verified: rev-30 [reviewer] · run rev-20261015-510-final · 2026-10-15T19:40:55.373Z · commit 64bd51a367e455f041c2a45e1feac639a5e84baa
- [x] C2. permissions.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-510 · 2026-10-15T19:39:31.392Z
  - verified: rev-30 [reviewer] · run rev-20261015-510-final · 2026-10-15T19:40:55.373Z · commit 64bd51a367e455f041c2a45e1feac639a5e84baa

## Comments

### impl-510 · 2026-10-15T16:47:07.642Z

Read task, E-482 Coordinator decisions, and release spec. Plan: reproduce audit helper on a deterministic partial-tail fixture, read only completed JSONL lines, preserve every permission/audit assertion, inspect product reader exposure, then collect five serial labelled Mac whole-file passes before review and droplet verification.

### impl-510 · 2026-10-15T16:59:50.167Z

Implemented and pushed 805972cf6803332a1eaf35dcf83be7918de1f297 on t/T-510-permissions-test-audit-log-read-sees-a after fetching/merging origin/dev. Diff against dev is only permissions.test.ts (7 additions/2 deletions). Product readAudit catches partial JSON already: no product crash follow-up. Deterministic actual-helper red/green: partial tail, partial-only, empty, complete, malformed complete (still throws). A-3196 records five quiet serial Mac whole-file passes, 25/25 tests, 5.01–5.55 s per file; preflight free/no Coordinator local run and load1 6.00–8.06 before each. C2 droplet evidence pending source review. Shared manifest 051db745 included. No QA brief required (qaPolicy scope none, no qaCriteria).

### rev-30 · 2026-10-15T17:00:28.279Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-510-source
commit: 805972cf6803332a1eaf35dcf83be7918de1f297
scope: full

Source review T-510 at 805972cf6803332a1eaf35dcf83be7918de1f297, fixed point 051db74546a22710acbf85c2bd32a765d2e5b71a.
Standards: no high/medium/low findings. Review performed directly under the no-delegation role. One test helper changes; no production code or test identities added.
Spec: no high/medium/low findings. audits() reads the snapshot once and truncates after its final newline. No newline yields an empty complete-record prefix; complete matching audit lines still pass through strict JSON.parse, so malformed completed records still fail. Existing before/after flushes, per-call count and identity checks, permissions/errors/privacy/CLI assertions and all time bounds are byte-unchanged outside this helper. This treats the record boundary separately from the live hub's acknowledgement without weakening the final assertions.
C1 verified. The commit records the post-flush concurrent-append root cause and production-reader assessment. readAudit in hub/src/hub/audit.ts:104 already catches malformed/partial JSON, so this crash is confined to the strict test helper and no product fix is required for this symptom.
A-3193 records deterministic actual-helper reproduction and boundary checks. A-3196 contains five serial whole permissions files: each 5/5, exit 0, zero failure/cancellation/skip, 25 total passing cases, approximately 5.01–5.55s per file. All admissions are labelled quiet/alone, load1 6.00–8.06, busy=False and coord=False. These establish C2's Mac portion; its required exact-head droplet receipt remains pending. No Reviewer tests or edits.
Source clear permits the requested exact-head verification, with droplet evidence still required by C2. No final gate claim.

Criteria: C1 verified.

### impl-510 · 2026-10-15T17:17:03.607Z

Same-head local verification 6f23ac0f passed at reviewed 805972cf: 1796/1796 tests, typechecks and hub-only selection with Neovim smoke. Receipt A-3202. This is additional Mac evidence; C2 still awaits its required Linux droplet receipt. Coordinator restart hold bdda2243 is active; no new verification will be submitted until the resubmit notice.

### rev-30 · 2026-10-15T17:17:20.787Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-510-local-evidence
commit: 805972cf6803332a1eaf35dcf83be7918de1f297
scope: evidence

T-510 local post-source evidence clear at unchanged 805972cf6803332a1eaf35dcf83be7918de1f297; this is not final criterion clearance.
A-3202 / 6f23ac0f-2477-4729-baf8-b050505143f0 completes exit 0 on local Darwin after remote-capacity fallback: typecheck, hub free/machine and Neovim smoke, 1796 passed / 0 failed / 0 cancelled / 0 skipped. All five permissions cases pass (timings :4774–4778), including permission table/audit counts, role changes, human restrictions, raw frames and dynamic grants. No hard duration failure.
No new Standards or Spec findings; C1's source verification stands. C2's five serial quiet Mac files were established by A-3196, but C2 explicitly also requires a droplet task receipt. This local run does not establish that portion, so C2 remains unverified and no final-ready claim is made.
Coordinator bdda2243 prohibits new verify submissions and pauses droplet watchers until the restart notice. Keep the same reviewed head and wait for that notice before pursuing the outstanding Linux evidence. No Reviewer tests, edits or provider calls.

### impl-510 · 2026-10-15T17:53:58.335Z

Restart hold lifted by Coordinator 6cf32c6a. Picked requested test-only duration manifest d5442c61 as 64bd51a367e455f041c2a45e1feac639a5e84baa and pushed; 051db745 was already included before original review. permissions.test.ts unchanged from reviewed 805972cf. Delta source review requested before explicit droplet verify. Prior Mac evidence: five serial passes A-3196; green local 1796/1796 A-3202, accepted by Reviewer A-3203. No local test rerun needed for shared manifest-only pick per Coordinator instructions.

### rev-30 · 2026-10-15T17:54:38.560Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-510-delta
commit: 64bd51a367e455f041c2a45e1feac639a5e84baa
scope: delta

Delta source review clear T-510 at 64bd51a367e455f041c2a45e1feac639a5e84baa, parent 805972cf6803332a1eaf35dcf83be7918de1f297.
Standards: no findings. Spec: no findings. Exact diff adds only two measured duration entries under allow in hub/test/durations.json, matching Coordinator-posted d5442c61: follows restart 5.362s and role-clause reconnect 4.61s, each with lifecycle reason and A-3210 provenance. JSON parses; existing allowances/values are unchanged. No task-source changes, assertion/bound changes or dev merge. Task file blob is unchanged from the prior reviewed head.
C1 reverified: complete audit records still parse strictly, partial tail is excluded, all assertions/bounds and commit diagnosis are unchanged. A-3196's five quiet Mac passes and A-3202's local green suite remain evidence for unchanged test source. C2 explicitly requires a droplet receipt and stays unverified.
Coordinator restart release 6cf32c6a authorizes the next exact-head droplet verify. This is source clearance, not final gate. Shared test-only picks need no additional local pass. No Reviewer tests, edits or provider calls.

Criteria: C1 verified.

### impl-510 · 2026-10-15T17:55:31.784Z

Delta source clear at 64bd51a3 (A-3219). Explicit droplet verify 55836405 submitted after queue showed remote 3/4 with no waiters, but admission raced another caller and hub fell back locally at remote 4/4. Run left executing per Coordinator's no-cancel instruction. Asked lead how to obtain a remote slot for C2 without repeated local fallback runs. Head unchanged, no new source changes.

### impl-510 · 2026-10-15T18:14:26.263Z

Second same-head Mac fallback 55836405 is green at delta-reviewed 64bd51a3: 1796/1796, A-3241. C2 Linux receipt remains outstanding. Per Coordinator 42918b81, next fresh explicit droplet attempt is allowed only when remote occupancy is ≤2/4; one more fallback means waiting for T-512. First queue check after result is 4/4; no verification submitted. Per Coordinator 4a85ed21, next attempt will set fresh to avoid executor-agnostic cache reuse.

### rev-30 · 2026-10-15T18:16:07.857Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-510-local-evidence-2
commit: 64bd51a367e455f041c2a45e1feac639a5e84baa
scope: evidence

Local evidence pass T-510 clear at unchanged source-reviewed 64bd51a367e455f041c2a45e1feac639a5e84baa; final C2 remains unverified.
A-3241 / 55836405-f903-44c0-be72-68c06a36d2bf completes exit 0 on local Darwin after remote-budget fallback: typecheck, hub and Neovim smoke; 1796 passed / 0 failed / 0 cancelled / 0 skipped. All five permissions cases pass (:4774–4778). No new source findings or hard budget failures; C1 verification stands.
This is a second local run, not Linux evidence. A-3196 supplies the five serial quiet Mac files. C2 still explicitly requires a droplet task receipt; actual platform must be checked even when submission requested droplet or a cache result returns. No final-ready claim and no extra local run is requested. No Reviewer tests or edits.

### impl-510 · 2026-10-15T19:17:45.474Z

Coordinator 8ae29999 directed immediate fresh explicit droplet verification at unchanged delta-reviewed 64bd51a3. Submitted 0ea19bdd-ab2b-4158-8646-b7076d81e544; queue confirms T-510 has a remote slot (droplet acquiring), no local fallback. Waiting for the hub receipt before marking C2 done. The earlier read-only capacity watcher missed available capacity and has been stopped.

### rev-30 · 2026-10-15T19:39:27.423Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-510-linux-first
commit: 64bd51a367e455f041c2a45e1feac639a5e84baa
scope: evidence

Linux evidence review T-510 not clear at unchanged source-reviewed 64bd51a367e455f041c2a45e1feac639a5e84baa. A-3306/0ea19bdd-ab2b-4158-8646-b7076d81e544 is actual Linux c-8, exit1:1780 pass/1 fail/3 platform skips. Typecheck and hub phases complete; Neovim smoke not reached after the unrelated hub failure.

All five permissions cases complete green (A-3306:4817–4821), including the repaired audit reader/table case5.700s. No audit JSON tail failure or new T-510 source issue. This supplies the previously missing actual-droplet whole-file execution evidence for C2; A-3196's five serial quiet Mac files and prior current-head local full green A-3241/55836405 remain applicable. Final gate acceptance is still pending the outside failure disposition.

Medium gate blocker / aside Bugs S — hub/test/pid-identity.test.ts:128 (case starts:102): staged replacement process has the same displayed start identity as the original, so assert.notEqual fails before the intended reused-PID safety proof (A-3306:4024–4035). Both actual/expected strings are Thu Oct15 19:28:27 2026. This demonstrates an invalid fixture staging boundary at second-granularity identity; it does not demonstrate that production signalled a reused PID. No exact known-item classification is established here.

Lead must classify/deduplicate this failure and settle whether the already green current-head Mac receipt plus own-file-green Linux receipt satisfy T-510's gate, or direct another receipt. Do not assume this is T-485 or T-514 based on stop terminology. C1 stands; C2 final mark remains pending acceptable gate disposition, with its platform evidence now supplied. No task criterion is failed speculatively. Coordinator8b300f2e currently forbids new submissions/local tests until restart notice, so no retry is requested during the hold.

No Reviewer tests, edits or provider calls.

### impl-510 · 2026-10-15T19:39:52.858Z

Actual Linux droplet 0ea19bdd at 64bd51a3: permissions.test.ts 5/5 green (A-3306:2088–2092), satisfying the file/platform portion of C2 together with A-3196's five Mac passes. Overall hub gate red on unrelated pid-identity.test.ts:128, staged replacement start stamp equals original to the displayed second (A-3306:4024–4034). Reported external Bugs find to lead with size/file/line and requested classification; Reviewer A-3307 confirms task cases green but final gate not clear pending disposition. Current restart hold 8b300f2e prevents retry. No source fix or head change; claim retained.

### rev-30 · 2026-10-15T19:40:55.373Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-510-final
commit: 64bd51a367e455f041c2a45e1feac639a5e84baa
scope: evidence

Final evidence review T-510 clear at unchanged source-reviewed 64bd51a367e455f041c2a45e1feac639a5e84baa. No high or medium task finding remains.

Confirmed Coordinator6f131b5b-b532-467b-817d-2125a4131bd9 in topic history: pid-identity.test.ts:128 same-second staged start-stamp collision is filed in E-482 and counts as known; Mac A-3202 plus actual Linux A-3306 meet this gate. Additionally A-3241 is a direct current-head Mac green, avoiding reliance solely on the earlier shared-manifest parent.

Receipt evidence:
- A-3202/6f23ac0f at805972cf: local Darwin1796/1796 green, previously reviewed.
- A-3241/55836405 at exact64bd51a3: local Darwin1796/1796 green, typecheck/hub/Neovim smoke completed, previously accepted A-3244.
- A-3306/0ea19bdd at exact64bd51a3: actual Linux c-8, exit1,1780pass/1fail/3 platform skips; permissions5/5 green (pass lines2088–2092, timings4817–4821), including repaired audit-table case5.700s. Sole red is the now-classified PID fixture collision (4024–4035), outside T-510. No audit JSON-tail or hard duration failure. This Linux suite remains overall red; final acceptance uses the explicit Coordinator disposition.

C1 reverified from source/delta: test audit reader parses complete newline-delimited records only, discarding the trailing incomplete fragment while retaining strict JSON parsing of complete lines and every permission/privacy assertion. Root cause is recorded. Product audit reader already catches malformed JSON, so no equivalent product crash follow-up is invented. permissions.test.ts blob is identical at805972cf and64bd51a3.
C2 verified: A-3196 contains five serial quiet Mac whole-file5/5 passes (25cases), with natural exits and recorded free/load preflights. A-3306 provides actual-droplet whole-file5/5 at current reviewed head. Current branch resolves exactly64bd51a3. Only previously reviewed shared manifest allowances followed original source.

No extra run or head change requested. Current Coordinator8b300f2e cover/restart hold remains in force for subsequent submission/merge routing. No Reviewer tests, edits or provider calls.

Criteria: C1 verified, C2 verified.
