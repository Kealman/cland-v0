---
id: T-1939
kind: task
title: transport-kind-types compiler case runs 11.8 s in a loaded full T2; move it to T3 beside typecheck.test.ts
state: open
status: in progress
size: XS
labels:
  - needs-triage
assignee: null
parent: E-1881
blocked_by: []
regression_of: T-1660
topic: topic-1610
branch: t/T-1939-transport-kind-types-compiler-case-runs
created: 2026-11-17T08:45:27.406Z
updated: 2026-11-17T23:19:32.398Z
---

## Summary

T-1660's case `hub/test/transport-kind-types.test.ts::a new transport kind compiles against the unchanged carrier contract` runs the TypeScript compiler API over the production import graph. In periodic dev T3 557d7a51 (A-20788, Linux c-8 nyc1, full T2 at load) it took 11.816 s against the enforced 5 s new-identity budget, which turned dev red. It took 2.515 s in T-1660's own verify and 1.714 s locally. The Coordinator added a dated allowance (17.8 s, owner C-216, expires 2026-11-24) so dev and task verifies stop failing. This item makes the fix permanent.

## Acceptance criteria

- [ ] C1. The case runs in T3 beside hub/test/typecheck.test.ts, with its reason recorded in the tier manifest, and the T-1660 assertions are unchanged (test).
- [ ] C2. The temporary allowance for the case is removed from hub/test/durations.json in the same change.
