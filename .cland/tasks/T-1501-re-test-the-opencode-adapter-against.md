---
id: T-1501
kind: task
title: Re-test the OpenCode adapter against OpenCode 2.2.x (session form and message schema variants changed)
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1271
branch: t/T-1501-re-test-the-opencode-adapter-against
created: 2026-10-31T05:17:30.173Z
updated: 2026-10-31T15:21:08.777Z
closed: 2026-10-31T15:21:08.777Z
---

## Summary

The informational OpenCode check before the 0.3.1 release (`npm run check:opencode`, 2026-10-31 05:20Z) found the newest stable OpenCode 2.x at 2.2.5, while the adapter was built and tested against 2.0.24. It reports 12 schema differences in two operations. Ten are in `GET /api/session/{sessionID}/form` (`fields.items.anyOf` and `prefixItems[0].anyOf`: "a tested variant was removed or changed"). Two are in `GET /api/session/{sessionID}/message/{messageID}` (`data.anyOf`). The check doesn't block releases, and the adapter's behavioural tests run against the pinned/fake OpenCode.

## Acceptance criteria

- [x] C1. The adapter's form and message readers are checked against OpenCode 2.2.x schemas, either updated to accept the changed variants with a fixture per variant or documented as unaffected, and `npm run check:opencode` reports the tested version or the residual differences with reasons.
  - done: impl-1501 · 2026-10-31T14:52:10.626Z
  - verified: rev-31 [reviewer] · run rev-20261031-1501-final1 · 2026-10-31T15:13:08.730Z · commit 387ecd7e138116f6229942ffcda747fe937fa4e3

## Comments

### impl-1501 · 2026-10-31T14:45:44.030Z

C1 consumer audit (before changes): compared upstream v2.0.24/v2.2.5 OpenAPI; reproduced all 12 warnings. Consumers searched by compareOpenCodeContract/runOpenCodeCheck, approvalDetails, form/message paths, Form.When/Value and native/providerState names across hub/web/nvim/shared, qa, docs and skills (including T3/T4). Production: check-opencode -> opencode-contract (only output caller); OpenCodeClient.snapshot reads form ids only; approvalDetails reads assistant type/content and matching tool id/name/state.input; OpenCodeAdapter consumes both; doctor/opencode-smoke only fetches message route. Fixtures/tests: opencode-check (T1), opencode-client-membership (T1), scripted-opencode, fake-opencode, opencode-native (T2), opencode-adapter (T3), opencode-policy and src/adapters/opencode tests. Docs/skill consumers: hub README state table, release/OPENCODE-CHECK.md, historical QA E-424 D13. No wire/admission contract changes planned; keep full comparator warnings and old reader fixtures. Add exact-version explanatory output and recorded-schema reader coverage; no tested range expansion or native 2.2 runtime claim.

### impl-1501 · 2026-10-31T14:48:58.801Z

Source head 152f338d0 pushed; requested Reviewer full source review in topic-1271. A-14882 holds evidence (durable artifact). npm run test:lint completed exit 0, zero refusals; 122 report-only findings in 59 files and known installed TypeScript capability baseline remain advisory. Local T1 touched files 8 + 3 tests and typecheck passed on macOS. Live informational check ran in sealed disposable source copy, exit 0: newest 2.2.5; all twelve warnings plus scoped reasons. No native 2.2 run, browser, or local suite. Awaiting source verdict before mode-free verify.

### rev-31 · 2026-10-31T14:51:58.856Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261031-1501-source1
commit: 152f338d041acd0af515b74a7c23bad84870a28e
scope: full
findings: [{"severity":"medium","text":"M1: both running-tool examples omit metadata required by recorded2.2.5 schema; unrelated tool remains invalid in every state-loop example. Old-shape control at membership:64 also adds providerState to text/reasoning parts whose old schemas require their state shape and reject extra fields. Correct samples and add schema-fidelity positives/negatives for both pinned versions, retaining exact safe reader assertions.","file":"hub/test/fixtures/opencode-2.2.5-readers.json","line":154}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source1 A-14887: Standards0 distinct findings, Spec1medium M1. Full comparator warnings/exact-version reasons, unchanged readers/safe fallback, range/native-runtime limits, T1 seams and matching docs otherwise source-sound. Correct same base and retain independent approval/correlation/fallback/old-shape assertions with faithful schema controls. A-14882 local T1/typecheck/lint/live-informational summaries retain partial scope; no configured/Reviewer workloads/native2.2 claim. Refresh C1 after fixes and request source review before verification.

Criteria: C1 failed (Claimed schema-reader evidence uses invalid2.2.5 running-tool examples and an invalid2.0.24 metadata shape, so fixture compatibility is not established.).

### rev-31 · 2026-10-31T14:53:48.598Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261031-1501-source2
commit: 387ecd7e138116f6229942ffcda747fe937fa4e3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear A-14891, Standards0/Spec0. M1 fixed: required metadata on both running tools; correct old text/reasoning state and tool provider metadata; pinned-schema checks before every form/message/legacy reader assertion plus original-defect negatives. Exact safe subject/command/correlation/fallback and old-wire assertions retained. Fixture checker scope disclosed, no dependency/native process/runtime range change. Full12warnings and exact-version advisory reasons/docs unchanged; native2.2 not claimed. A-14889 local membership4/typecheck/lint summaries retain scope; A-14882 earlier report8/live probe remain earlier-head only. C1 final runtime pending. Submit one mode-free verify frozen exact head, then original-record evidence review; no Reviewer workloads.

### rev-31 · 2026-10-31T15:13:08.730Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261031-1501-final1
commit: 387ecd7e138116f6229942ffcda747fe937fa4e3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1 verified. A-14916 records independent audit of A-14913/run d94c9764-3529-4916-9a8f-46e7edac169a at the unchanged source2-clear head: 4443 ordinary passes plus 145 separate load-gate passes, no failures/cancellations/skips/todo, and all four new schema-reader identities each passing base plus five load repetitions. T0/T1/fallback all T2/Web completed; T3/T4 were not run. Linux droplet and pinned Headless Shell provenance retained. Host typecheck gate was reused, not repeated remotely; lint/timing notices remain report-only. Evidence verifies schema fidelity and safe readers only, with no native OpenCode 2.2 execution or tested-range expansion claim. Both Standards and Spec audits clear within these bounds.

Criteria: C1 verified.

### coord · 2026-10-31T15:21:08.777Z

Merged da255b5d0f2fd2a8b6de53685e5524192b31914f onto dev.
