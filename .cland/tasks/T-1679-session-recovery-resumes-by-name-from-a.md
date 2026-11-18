---
id: T-1679
kind: task
title: Session recovery resumes by name from a stale snapshot and can resume a renamed or replaced session
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1616
branch: t/T-1679-session-recovery-resumes-by-name-from-a
created: 2026-11-04T15:48:11.031Z
updated: 2026-11-18T08:31:50.137Z
---

## Summary

Found by the T-1612 reviewer and reported by impl-1612 (2026-11-04). It is pre-existing and non-blocking for T-1612. `resumeHost` (formerly `resumeAll`) snapshots the detached ProcessTable rows, then later resumes each by `p.name`. While an earlier row is held, a later row can be renamed and its old name reused. Recovery may then resume the replacement, possibly on another host, and miss the captured session.

## What to build

Recovery keys each step on the captured session id. Before resuming, it re-reads the row by that id and revalidates host, status and pending-stop. A row that was renamed, replaced or moved is skipped and reported, never resumed under the old name.

## Acceptance criteria

- [x] C1. A rename plus name reuse between snapshot and resume resumes only the captured session id, and never the replacement (test).
  - done: impl-1679 · 2026-11-18T06:36:37.650Z
  - verified: rev-39 [reviewer] · run rev-39-1679-final-20261118 · 2026-11-18T07:44:39.581Z · commit 383ab4606ddeaa298ee01e353f25ad2a2a526154
- [x] C2. A row whose host, status or pending-stop changed since the snapshot is not resumed and is reported (test).
  - done: impl-1679 · 2026-11-18T07:44:29.134Z
  - verified: rev-39 [reviewer] · run rev-39-1679-final-20261118 · 2026-11-18T07:44:39.581Z · commit 383ab4606ddeaa298ee01e353f25ad2a2a526154

## Comments

### impl-1679 · 2026-11-18T06:17:19.932Z

Consumer inventory (rule 20/41): resumeHost callers are hub/src/hub/daemon.ts host-ready callback (catch/log rejection), Sessions.resumeAll (await void), host-reboot.test.ts and host-survival.test.ts (await/compare Promise identity). resumeAll callers/readers: daemon.ts startup .then; session-host, session-host-routing, host-registry, system-processes, name-reservation and host-survival tests, all await void. Full repository search for resumeHost/resumeAll found no wire, nvim/web, skills, QA briefs, startup probes or frozen fixtures beyond these. Keep Promise<void> unchanged; add structured resume-skipped log records. Tests use existing public Sessions.resumeHost + ProcessTable seam with fake adapters and Hosts.

### impl-1679 · 2026-11-18T06:41:53.932Z

Public resume inventory addendum: A-21081 (.cland/artifacts/A-21081-t-1679-evidence-provenance-and-public-resume-consumer-addendum.md) lists direct Sessions.resume callers/readers with pinned tiers, every session.resume wire/QA/skill/docs/fixture hit and execution disposition. Production direct caller: hub/src/adapters/requests.ts:123; readers: CLI session.ts, nvim sessions.lua, web SessionActions.tsx. Existing request/reply/help shapes are unchanged; previous-wire fixtures unexecuted. The artifact corrects evidence provenance and records unresolved setup/guard ownership and recovery settlement gaps at 447d0110f. No source changes or test reruns during review.

### rev-36 · 2026-11-18T06:48:34.582Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1679-source-1
commit: 447d0110feca52fefa1bda61f5dfa8f43c04b741
scope: full
findings: [{"severity":"medium","text":"Carry the recovery-only captured-row eligibility fence through final settlement. eligible reaches admission/authorizeResume, but after awaiting adapter.resume (2436) and the final native identity proof (2523), neither the settlement block nor publish rechecks it before table.put (2477). A row replaced or changed to another host/status/pending-stop while its own resume is held can be overwritten by the stale result instead of producing resume-skipped. The current matrix only changes a later snapshot row while an earlier row is held. Revalidate the captured recovery identity/eligibility at both post-await settlement boundaries, preserve ordinary public resume's intended rename behavior, and add held-result/identity controls. No omitted final owner/disposition exists per 5acffcd4 (rules 9/25/26; C2).","file":"hub/src/adapters/sessions.ts","line":2632},{"severity":"medium","text":"Enroll a whole-case normal/signal owner before acquiring fixtures in all seven new matrix cases. Raw tempProject/HubCore/ProcessTable construction, manual module mutation and two fake spawn awaits occur before t.after registration at 47. The callback has no adopted-root guard, step fences, caller join or separately named setup bound; failure/timeout can tear down storage or restore patches while setup/body work continues, and early setup failure leaks DBs/owners. Use the shared whole-case owner, named setup observation, immediate root adoption and pending-work drainage before captured cleanup. Implementer confirms no earlier owner/disposition in e3f03ea7 (rules 9/12).","file":"hub/test/host-survival.test.ts","line":24},{"severity":"medium","text":"Replace the inline partial process patch with the shared positively controlled native guard and keep it alive through cleanup. Public callback/custom APIs are trapped, but captured lower-level ChildProcess.prototype.spawn is not, restoration is only registered after setup awaits and can be skipped when teardown rejects, and native=0 is asserted before teardown. An earlier captured launch function or cleanup-time native attempt can escape the claimed fake-only boundary. Register restoration before mutation, exercise callback/custom/prototype denial controls and check the final attempt count after admitted work/resource cleanup drain. Confirmed in e3f03ea7 (rule 38).","file":"hub/test/host-survival.test.ts","line":25},{"severity":"low","text":"Move the recovery paragraph to its own location after the complete OpenCode forwarding paragraph. It is inserted between 'Readiness,' at 946 and 'HTTP requests and SSE all use...' at 955, splitting the original sentence and leaving the OpenCode description malformed. Keep the recovery semantics and restore the surrounding sentence (rule 16).","file":"docs/hub/adapters-and-sessions.md","line":947}]
finding_counts: {"high":0,"medium":3,"low":1}

A-21084 full source review at Git tree 829887e30a35c6169f6995aadd3172f4ecd81088 against fixed base 303b482b82f898df49c31449b70417880005152f. NOT CLEAR: Standards two medium/one low; Spec one medium. Admission now pins exact cland id and structured reasons correctly, but eligible/authorizeResume is not called after adapter.resume or the final identity probe before publish/table.put. This can overwrite a changed or replaced admitted row; new matrix only covers a later snapshot row changing before admission. Implementer confirms no final fence/disposition (5acffcd4). Seven new matrix callbacks also lack pre-acquisition whole-case join/root/setup ownership, and the inline native trap omits captured prototype spawn, early-failure restoration and post-cleanup verification (confirmed e3f03ea7). Move docs recovery paragraph out of the middle of the OpenCode 'Readiness, HTTP requests...' sentence. C2 failed; C1 remains unverified. A-21077/A-21081 retain earlier setup/behavior/partial red rounds and final local 9+5 T2 green summaries with unavailable raw/native/tree/cwd limits. A-21083 provides 26 T1 completion tails summing 288 passes and resolves object-form T3 tier labels; no configured verification or Linux/native/browser/T3/T4 evidence exists here. Public/wire/frozen consumer expansion retained with 98-file declared pinned census, no signature/help/tier change. Pre-existing running()->all() retained-history aside filed separately as T-1959 by Coordinator; not a T-1679 finding or requested scope expansion. Source/experiment pin released for consolidated corrections, preserving assertions/history; fresh source review required before verification. No new stress/native probe or full suite authorized by this review.

Criteria: C2 failed (Recovery eligibility does not guard final settlement after adapter/identity awaits, so changed host/status/pending-stop or replacement can be overwritten by a stale result.).

### impl-1679 · 2026-11-18T06:57:40.540Z

Consolidated corrections at 72e3710d14bb13d549a0fbf90e945919b6bf0168 (tree 41006907cc3947b1c502c5a99a3c0c5e03dd92c5): recovery-only final settlement/publish eligibility; shared whole-case ownership and native guard; docs paragraph relocation. A-21093 preserves eight new red failures, green 17-case recovery, 29 T1 files plus five reboot tests, full lint/typecheck, explicit command/cwd/tree/load receipts and missing provenance. Consumer census includes A-21084 plus internal relaunchAfterSignIn this.resume; private helpers have only wrapper/recovery callers, ordinary resume unchanged. All four source findings addressed; requesting fresh source review, no configured verify yet.

### rev-39 · 2026-11-18T06:59:49.446Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-39-1679-source-20261118
commit: 72e3710d14bb13d549a0fbf90e945919b6bf0168
scope: full
findings: [{"severity":"medium","text":"Carry recovery-only eligibility through the earlier legacy-identity upgrade before its post-probe write. #resume awaits #upgradeLegacyIdentity without authorize/settle; that helper at2099 checks only pid/startedAt/pidStarted before updating pidIdentity. A held local identity probe can return after name/host/status changes (or broad bySessionId replacement matching) and persist the old proof onto the changed row before later recovery fences notice. Current remote-row settlement tests bypass this path. Preserve ordinary explicit resume semantics and add held local legacy checkpoint controls. Implementer confirms no omitted guard in8ccbee0b (C2; rules25/26).","file":"hub/src/adapters/sessions.ts","line":2359}]
finding_counts: {"high":0,"medium":1,"low":0}

NOT CLEAR: one medium finding, legacy identity post-probe write lacks recovery eligibility fence (sessions.ts:2359; helper write2099). Earlier A-21084 adapter/final publication, whole-case ownership, native guard and docs findings are addressed. Full standards/spec review recorded in accompanying artifact; C1 remains unverified, C2 failed. Read supplied A-21093 targeted macOS evidence with its stated provenance limits; no reviewer tests and no configured/Linus/native/browser/T3/T4 pass claimed. Correct this fence and request fresh source review before configured verification.

Criteria: C2 failed (Recovery legacy-identity upgrade can write pidIdentity onto a changed or replaced row after its identity await, before recovery eligibility is checked.).

### impl-1679 · 2026-11-18T07:04:18.508Z

Legacy identity guard consumer inventory before correction: #upgradeLegacyIdentity has three private callers in Sessions: #stopFailedLaunch (checkpoint updates pending-stop record), #stop (ordinary identity upgrade), and #resume (ordinary/recovery). The optional guard is supplied only by #resume from recovery settle; the first two callers keep default behavior. No external helper import/wire shape changes. Four held-local fake regressions were red (17 pass/4 fail); unchanged-row positive control added. Current candidate tree cf008183e5e786d050bbf9a9194bc997023e8dfa; full typecheck passed at ambient load1 9.2793. Full lint underway.

### impl-1679 · 2026-11-18T07:10:12.884Z

Third candidate 383ab4606ddeaa298ee01e353f25ad2a2a526154 (tree cf008183e5e786d050bbf9a9194bc997023e8dfa) guards legacy identity persistence. A-21106 holds all 29 T1 outputs; companion evidence holds red 17 pass/4 fail at load1 10.1753, green 20 selected logic cases at ambient load1 14.1133, full typecheck/lint. Two original timing-sensitive host-survival cases and host-reboot remain unexecuted at this head; their load<8 admission deferred them. No configured verification yet; scope and missing receipts explicit. Requesting source review of the correction.

### rev-39 · 2026-11-18T07:11:18.924Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1679-source2-20261118
commit: 383ab4606ddeaa298ee01e353f25ad2a2a526154
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at383ab4606ddeaa298ee01e353f25ad2a2a526154. Standards/spec: no findings. Legacy identity validator executes after proof await and before persistence; recovery passes its captured eligibility callback, ordinary migration callers unchanged. Four local changed-row controls plus unchanged positive control cover the missing checkpoint; previous ownership/guard/final-settlement fixes retained. All A-21098/A-21084 findings resolved. Inspected A-21106/A-21108: supplied local macOS Node24.21.0 targeted20-case logic green,29 T1 outputs, lint/typecheck with report-only notices. Two original timing-sensitive host-survival cases and host-reboot remain unexecuted at this head. No reviewer test execution or configured/Linux/native/browser/T3/T4 pass claimed. C1/C2 run-dependent verification deferred to same-head configured result.

### rev-39 · 2026-11-18T07:44:39.581Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1679-final-20261118
commit: 383ab4606ddeaa298ee01e353f25ad2a2a526154
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; no findings. task.view2660db69-e95f-4800-be57-7f9e9cbd880c finished/passed; A-21127 provenance pins reviewed head383ab4606 / runtime treead7d1c425129d39dbc7ca145be10070a40333100, no cache. Independent structured receipt audit: host-survival22 base passes plus all20 recovery identities5/5 load repetitions; host-reboot5 and lifecycle-serialization9 base passes; all three file completions pass. Confirms C1 captured-id/name-reuse and C2 changed-row/pending-stop and settlement controls, including legacy proof and unchanged positive control. Host T0, Linux x64 droplet Node24.21.0 T1/allT2/Web plus one mapped T4 base guard passed; no T3/otherT4 claim. Chrome Headless Shell156.0.8078.4 / Playwright1248, duration/lint checks report-only. Source A-21109 unchanged; prior failed rounds retained. Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T08:31:50.137Z

Batch e028e266 (A-21143) failure attributed outside this item: `territory-lock.test.ts:396` "a hub stops successfully twice after its project directory is deleted" (`Missing expected rejection`, ENOENT expected) is a T-1950 regression. Lease compaction's recursive mkdir recreates the deleted project root; it's filed as T-1964. The case passed 5/5 alone (3 single-case runs on dev 6b8f29393 and on this head 383ab4606, then 2 whole-file runs of 20/20 on this head, macOS, load 3.5–3.9), and this item's diff doesn't touch it. Per the flaky-rerun rule (2026-10-15) the item gets one re-enqueue at the unchanged head 383ab4606.
