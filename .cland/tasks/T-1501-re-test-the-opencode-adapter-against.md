---
id: T-1501
kind: task
title: Re-test the OpenCode adapter against OpenCode 2.2.x (session form and message schema variants changed)
state: open
status: review
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
updated: 2026-10-31T14:49:02.155Z
---

## Summary

The informational OpenCode check before the 0.3.1 release (`npm run check:opencode`, 2026-10-31 05:20Z) found the newest stable OpenCode 2.x at 2.2.5, while the adapter was built and tested against 2.0.24. It reports 12 schema differences in two operations. Ten are in `GET /api/session/{sessionID}/form` (`fields.items.anyOf` and `prefixItems[0].anyOf`: "a tested variant was removed or changed"). Two are in `GET /api/session/{sessionID}/message/{messageID}` (`data.anyOf`). The check doesn't block releases, and the adapter's behavioural tests run against the pinned/fake OpenCode.

## Acceptance criteria

- [x] C1. The adapter's form and message readers are checked against OpenCode 2.2.x schemas, either updated to accept the changed variants with a fixture per variant or documented as unaffected, and `npm run check:opencode` reports the tested version or the residual differences with reasons.
  - done: impl-1501 · 2026-10-31T14:48:33.276Z

## Comments

### impl-1501 · 2026-10-31T14:45:44.030Z

C1 consumer audit (before changes): compared upstream v2.0.24/v2.2.5 OpenAPI; reproduced all 12 warnings. Consumers searched by compareOpenCodeContract/runOpenCodeCheck, approvalDetails, form/message paths, Form.When/Value and native/providerState names across hub/web/nvim/shared, qa, docs and skills (including T3/T4). Production: check-opencode -> opencode-contract (only output caller); OpenCodeClient.snapshot reads form ids only; approvalDetails reads assistant type/content and matching tool id/name/state.input; OpenCodeAdapter consumes both; doctor/opencode-smoke only fetches message route. Fixtures/tests: opencode-check (T1), opencode-client-membership (T1), scripted-opencode, fake-opencode, opencode-native (T2), opencode-adapter (T3), opencode-policy and src/adapters/opencode tests. Docs/skill consumers: hub README state table, release/OPENCODE-CHECK.md, historical QA E-424 D13. No wire/admission contract changes planned; keep full comparator warnings and old reader fixtures. Add exact-version explanatory output and recorded-schema reader coverage; no tested range expansion or native 2.2 runtime claim.

### impl-1501 · 2026-10-31T14:48:58.801Z

Source head 152f338d0 pushed; requested Reviewer full source review in topic-1271. A-14882 holds evidence (durable artifact). npm run test:lint completed exit 0, zero refusals; 122 report-only findings in 59 files and known installed TypeScript capability baseline remain advisory. Local T1 touched files 8 + 3 tests and typecheck passed on macOS. Live informational check ran in sealed disposable source copy, exit 0: newest 2.2.5; all twelve warnings plus scoped reasons. No native 2.2 run, browser, or local suite. Awaiting source verdict before mode-free verify.
