---
id: T-1249
kind: task
title: A turn that fails on provider capacity stays idle until someone messages the session
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1063
branch: t/T-1249-a-turn-that-fails-on-provider-capacity
created: 2026-10-24T13:35:17.533Z
updated: 2026-10-25T18:49:40.546Z
closed: 2026-10-25T18:49:40.546Z
---

## Summary

A Codex session's turn fails with `Selected model is at capacity. Please try a different model.` and the session sits idle until someone messages it. On 2026-10-24 this hit impl-998 and impl-422 (09:06Z), rev-23 holding T-1098's evidence review (12:25Z), and rev-23 holding T-1214's review (13:34Z). T-1214 blocked five branches. Each time the hub posted the failure, and the work resumed only after a Coordinator message.

## Acceptance criteria

- [x] C1. When a session's turn fails with a provider-capacity error, the hub re-delivers the last turn input after a bounded backoff (for example 30 s, 60 s, then 120 s, at most 3 tries) without a Coordinator message, and posts each retry (test).
  - done: impl-1249 · 2026-10-25T17:30:55.435Z
  - verified: rev-32 [reviewer] · run rev-20261025-1249-final · 2026-10-25T18:05:31.490Z · commit b6a15f47f9ac956779df6fa44041d67b540102fc
- [x] C2. Other turn failures are not retried this way, and a session that is stopped, archived or reassigned is never retried (test).
  - done: impl-1249 · 2026-10-25T17:48:30.059Z
  - verified: rev-32 [reviewer] · run rev-20261025-1249-final · 2026-10-25T18:05:31.490Z · commit b6a15f47f9ac956779df6fa44041d67b540102fc
- [x] C3. After the last try fails, the hub tells the item lead or Coordinator once, as today (test).
  - done: impl-1249 · 2026-10-25T17:30:55.614Z
  - verified: rev-32 [reviewer] · run rev-20261025-1249-final · 2026-10-25T18:05:31.490Z · commit b6a15f47f9ac956779df6fa44041d67b540102fc

## Comments

### impl-1249 · 2026-10-25T17:17:48.722Z

Implementation seam: triage A-11669 explicitly selects adapter-seam tests. Use existing T2 scriptedCodex/projectHub + fake clock, retaining exact native input/readback, delivery receipts and Agents retry notices; no processes/browser needed. Rule 20 inventory before the optional internal AdapterHost.turnFailed replay argument: production Sessions host; Codex and OpenCode callers; Claude signal-to-Sessions path; scriptedCodex/fakeHarness hosts and native/adapter/composition tests; Agents lifecycle/journal/inbox consumers of existing turn-failed notices; shipped implement skill, hub README and test docs. Full repository search covers src/test, nvim/web/shared, QA briefs, docs and skills. Keep 3-argument callers and wire notices unchanged; optional replay applies only to Codex provider-capacity failures.

### impl-1249 · 2026-10-25T17:27:08.403Z

Consumer inventory results: AdapterHost.turnFailed production callers are Codex and OpenCode, with Sessions.host receiving it; Claude Code uses Sessions.signal's unchanged 3-argument failure path. Tests: codex-native, codex-adapter, codex-delivery, opencode-native, opencode-adapter, claude-code-sessions/adapter/schedule, account-limited; generic fake host consumers retain optional callbacks. Protocol/persisted readers: hub protocol + shared/wire NotificationKind, hub journal, Agents lifecycle mapper and Inbox; existing turn-failed/redelivered shapes are retained, so web/nvim and historical records need no migration. QA brief hits E-424 and T-272 concern Claude sign-out/authentication and remain unaffected. No native wire/schema/refusal/credential/admission shape changed; optional replay is internal, only provided by Codex. CLI usage frozen fixture changes with the advertised policy. Ordinary-error and existing uncertain-admission regressions retain previous public-frame shape. Matching role clauses contain no failed-turn recovery description; no role grants or clause lines changed (byte reserve).

### rev-32 · 2026-10-25T17:33:58.495Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261025-1249-source
commit: ead35459a4442d6eb9dfa941bc539029d91442ef
scope: full
findings: [{"severity":"medium","text":"M1: New native work that starts during held capacity readback is reported as replay failure instead of cancellation. check() invokes authorize() before checking changed turnSequence/lastStartedTurn; if the newer turn is still busy, Sessions' idle guard throws and its still-current retry entry calls capacityExhausted, sending an unnecessary terminal failure to the lead/Coordinator. Check supersession as cancellation before this error path and add a held-readback/new-turn-still-busy regression retaining no replay and no terminal report.","file":"hub/src/adapters/codex.ts","line":1013}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec source review recorded in A-12060. Standards: no independent finding. Spec: M1 medium at codex.ts:1013; authorize's idle guard runs before native supersession detection, so newer still-busy native work during held readback is falsely reported through capacityExhausted. Add that precise ordering control, retain no obsolete replay/no terminal failure assertions, and preserve real readback/admission failure reporting. C2 failed; C1/C3 remain unverified pending corrected source and same-head configured evidence. Local A-12054 is a Darwin T2 implementation summary, not configured runtime evidence. No tests run by Reviewer. Verification is not cleared at this head.

Criteria: C2 failed (M1: newer native work during held readback is escalated as terminal replay failure instead of cancellation.).

### rev-32 · 2026-10-25T17:36:19.213Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1249-source2
commit: c80d86ca04dc077e4378ceced5b034ee6bc9cc5a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear; A-12064 records unchanged baseline plus all correction hunks. M1 resolved by checking native supersession before idle authorization and immediately after held readback. The new stays-busy regression observes readback completion and retains no obsolete submission/no terminal failure assertions. Standards and Spec: no remaining findings. C1–C3 remain runtime-unverified pending one same-head mode-free configured receipt. Local A-12063 is attributed precommit Darwin T2 output, not configured Linux evidence. No tests run by Reviewer.

### rev-32 · 2026-10-25T17:47:12.267Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261025-1249-evidence1
commit: c80d86ca04dc077e4378ceced5b034ee6bc9cc5a
scope: evidence
findings: [{"severity":"medium","text":"Configured exact-head run 87ad3f88 fails successful late-steer reconciliation: Error: recovery receipt: not within 15000 ms (A-12070 lines14959–14965). T2 failed; later mapped-T4/Web phases did not run. No root-cause or shared-defect classification established.","file":"hub/test/codex-native.test.ts","line":659}]
finding_counts: {"high":0,"medium":1,"low":0}

A-12071 records failed run87ad3f88/A-12070 at the source-cleared head. Exact output: Error: recovery receipt: not within 15000 ms, codex-native.test.ts:659 via recoveries:524. T0/T1 passed, T2 failed; no later mapped-T4/Web receipt. Linux x64 c-8 lon1, ordinary2604/2603pass/1fail, lifetime538s/$0.0374; hostT0 gate reused, not repeated on Linux. Report-only duration/lint diagnostics are separate from the actual failure. C2 failed, C1/C3 pending; no shared-defect classification or unchanged retry authorized. Any fix needs fresh source review.

Criteria: C2 failed (Exact-head configured T2 failed existing successful late-steer reconciliation: recovery receipt not within 15000 ms; runtime compatibility is not established.).

### rev-32 · 2026-10-25T17:49:01.861Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1249-source3
commit: b6a15f47f9ac956779df6fa44041d67b540102fc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear; A-12074 carries previous baseline plus the completion-episode correction. Fresh turn/started clears the prior marker; existing late-steer recovery assertions remain intact, while same-episode duplicate final capacity completion remains suppressed. No remaining Standards/Spec findings. C1–C3 runtime marks remain pending a fresh same-head configured receipt. Prior87ad3f88/A-12070 is failed partial evidence, audited in A-12072 (correcting prior prose's erroneous A-12071 reference). Local A-12073 is attributed Darwin scripted T2 final-source output, not configured Linux evidence. Reviewer ran no tests.

### rev-32 · 2026-10-25T18:05:31.490Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261025-1249-final
commit: b6a15f47f9ac956779df6fa44041d67b540102fc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; A-12080 audits original A-12078 run8099d09e at unchanged source3 head. 3255 ordinary passes/445files;85 separate load passes (17×5), no fail/cancel/skip. C1 bounded30/60/120s,max3,exact input/posted retries; C2 lifecycle/work cancellation including held-readback busy M1, ordinary/uncertain policies and prior failed late-steer compatibility; C3 one terminal report/no claimant self-wake all have named base+load receipts. T0 hostMac30.855s,excluded-tree318edbc1 reused/not repeatedLinux; Linuxx64 c8nyc1 Node24.21 Nvim.12.5,workers2/Web4,life837s/$0.0581. T1/allfallbackT2/mappedT4once/fullWeb complete; noT3/otherT4/nativeprovider/QA claim. Headless156.0.8078.4/1248; budgets/tier/lint report-only133/60. EarlierfailedA-12070 retained, currentfreshreceipt isgreen. C1–C3verified; no remaining findings.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1249 · 2026-10-25T18:06:02.454Z

Ready at b6a15f47f9ac956779df6fa44041d67b540102fc. Final source/evidence review clear, C1–C3 verified (rev-20261025-1249-final; A-12080). Fresh mode-free run 8099d09e passed with log A-12078 and parsed named-case/load facts A-12079: T0, all T1, fallback all T2, mapped T4 once, Web; Linux runtime, report-only budgets/lint; no T3/native-provider claim. All 17 new cases have 5/5 load proofs; no new case >=3 s on Linux. Fresh `git fetch --no-auto-maintenance origin dev` and `git merge-tree --write-tree HEAD origin/dev` exit 0 against dev 16596bda7470b33f301e3e49eeaef180180ad0f6, candidate tree cacdce388dcc569359ac6e2a18cbf22b9a65cc56. Working tree clean; head unchanged. Coordinator owns the additional rule-6 verify-all and enqueue; claim retained until merge.

### coord · 2026-10-25T18:49:40.546Z

Merged 13d66f11aa6b5386f899a5a145e99231622fa2db onto dev.
