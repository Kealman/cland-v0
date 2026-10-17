---
id: T-736
kind: task
title: "claude-code-accounts: the signed-out case's 'claude-a keeps polling' wait misses its 15 s bound under load"
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-441
branch: t/T-736-claude-code-accounts-the-signed-out-case
created: 2026-10-17T13:01:36.552Z
updated: 2026-10-17T15:08:44.515Z
closed: 2026-10-17T15:08:44.515Z
---

## Summary

In integrated cover 56ed615c (A-4521, droplet c-8, peak load 6.5) `claude-code-accounts.test.ts::a signed-out account has one directory notice and event while another account keeps polling` failed: "claude-a keeps polling while claude-b is signed out: not within 15000 ms". The case advances the hub FakeClock and then waits on real time for the native `claude agents` child of claude-a to log its call. It passes 10/10 alone on the Mac. The case is T-696's (bd588b34).

## What to build

Make each period's poll observable as a receipt: advance the FakeClock, then wait for the adapter's own completion of that poll (the in-flight snapshot finishing), driving the clock again if the poll is still pending, instead of a 15 s real-time `eventually` over the call log. Keep every assertion: claude-a polls each period, claude-b never starts a new child, one directory notice and one event.

## Acceptance criteria

- [x] C1. The case passes 5/5 on the Mac and in the task's droplet verify, with its assertions unchanged, and no real-time wait in it exceeds the bound of a single native child's completion.
  - done: impl-736 · 2026-10-17T14:29:05.424Z
  - verified: rev-30 [reviewer] · run rev-20261017-736-final · 2026-10-17T14:29:37.051Z · commit f2f1aab1b2622d44d77f2391ca1f01c9d80a864a

## Comments

### impl-736 · 2026-10-17T14:22:51.984Z

Implementation: preserve the T3 native-directory contract and all assertions. Observe session.resume completion with a bounded receipt loop that advances the hub FakeClock while pending, drain startup before the period baseline, and assert each period's call count directly. Production adapter and FakeClock unchanged. Baseline targeted case passed (2.291 s total); the supplied integrated receipt A-4521 is the load-failure evidence, so no artificial stress load was introduced. Typecheck and tier manifest lint pass; 5 serial full-file Mac runs underway below load 15.

### rev-30 · 2026-10-17T14:25:54.667Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-736-source
commit: f2f1aab1b2622d44d77f2391ca1f01c9d80a864a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear atf2f1aab1 against direct parentf0de78b7; Standards0/Spec0 findings. One signed-out test only, no production/process-start/allowance change. resume joins agentsFlight and may await next Clock eligibility; helper drives fixture FakeClock while waiting for response, drains startup before baseline, and replaces frozen-clock call-log eventually with direct count assertions after completion. Request/receipt waits each15s match one native agents child's timeout. All original period/count, b latch/started receipt, normal/signed-out state, exactly-one journal/notice account+directory, no auth/doctor assertions remain. A-4538 pre-refresh same-patch Mac5/5 supplied; exact-head Mac refresh is still running per request. C1 remains unverified until completed exact-head Mac5/5 and task droplet evidence. Normal mode-free verify may follow at this exact source-clear head after prepared local checks complete. QA scope none.

### impl-736 · 2026-10-17T14:29:14.310Z

C1 done at unchanged reviewed head f2f1aab1. Exact-head Mac typecheck/tiers and five whole-file serial runs pass (40/40 total, raw A-4543; summary A-4541). Linux droplet verification 915dce68-a248-43c7-9a8a-f82565b5a9fa passed 42/42; signed-out case 3.678 s; log A-4544. Executor c-8 lon1 Linux x64, lifetime 134 s, cost $0.0093. Final same-head evidence verdict requested from Reviewer role. Claim retained pending supervising merge.

### rev-30 · 2026-10-17T14:29:37.051Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-736-final
commit: f2f1aab1b2622d44d77f2391ca1f01c9d80a864a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head clear; source A-4542 unchanged and origin matches. A-4543 raw five whole-file Mac transcripts independently audited:8/8 each,40pass/0fail/cancel/skip, startloads7.67–11.34; signed-out case1.993–2.844s. A-4544/915dce68 green42/42, hub-selected30+Neovim12, all8account-file cases pass; subject3.678220399s. Subject existing identity has ordinary receipt, no new subject5/5 gate claim. All original assertions and two15s native request/completion bounds remain source-current. C1 verified; no findings. Host check/typecheck/report-only lint reusedbfc5fad0d7f4d45e213cab37b38a047f3fb40be5. Linux2workers,c-8lon1,suite67.59s,peak2.42,lifetime134s,$0.0093. No new run/head change or per-item QA.

Criteria: C1 verified.

### coord · 2026-10-17T15:08:44.515Z

Merged ae3bcd296b00129a91546c1bb7a78b5fe7c514f9 onto dev.
