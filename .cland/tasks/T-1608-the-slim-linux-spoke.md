---
id: T-1608
kind: task
title: The slim Linux spoke
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
topic: topic-1374
branch: t/T-1608-the-slim-linux-spoke
created: 2026-11-02T03:33:57.391Z
updated: 2026-11-03T22:09:20.723Z
---

## Summary

The spoke loads only what a session's connection needs at start, with the rest imported on first use, to bring its Linux resident size of 105–125 MB toward its macOS size. A measurement test records the spoke's RSS on the platform it runs on, and the task's evidence carries the values before and after from the branch's own Linux droplet verification.

Hot files: `hub/src/spoke/spoke.ts`, `hub/bin/cland-spoke.ts`, `hub/src/spoke/*.ts`, `hub/test/spoke-footprint.test.ts` (new)

## Acceptance criteria

- [ ] C1. A T1 test fails when the spoke's start-up import graph (before the hub's welcome) reaches `node:sqlite`, the journal, the tracker or another module on a named deny list (test).
- [ ] C2. A measurement test starts the spoke against a test hub, waits for the welcome and an idle 10 s, and reports its RSS. It fails only when the spoke does not start, never on the number (test).
  - failed: rev-35 [reviewer] · 2026-11-03T22:08:14.692Z · note The measurement baseline cannot run through configured verification until its guide registration and invalid nonlegacy allowance date span are corrected.
- [ ] C3. The task's evidence records the spoke's RSS on Linux at `dev`'s head and at the branch head, both from droplet runs, with the reduction.
- [ ] C4. Every spoke tool still answers, and the spoke, spoke-reconnect and spoke-tools test files pass with no test edited.

## Notes

Shared files: `hub/src/spoke/spoke.ts`, `hub/bin/cland-spoke.ts`

## Comments

### impl-1608 · 2026-11-03T22:04:11.388Z

Coordinator6d12bbe1 approved two reviewed heads: test-only dev-equivalent baseline, then lazy-import split. Baseline local Darwinarm64 Node24.21 T4 measurement pass, RSS60129280bytes after welcome+10s, no tools invoked, native cleanup/census pass. All-package typecheck pass. Linux C3 unexecuted; static lint still running. Requested allowance owner decision and C4 current-file mapping.

### coord · 2026-11-03T22:05:30.692Z

Coord decision 2026-11-03 22:05Z. C4's names map to current files: spoke = in-process-spoke, spoke-stdio, spoke-unix-edge and spoke-identity; spoke-reconnect = spoke-readiness and bridge-grace; spoke-tools = tool-arguments-spoke plus the documented-tools census, with scenario hub-lifecycle also checked. All must pass unedited at the branch head. The T4 baseline measurement's duration allowance is 30 s, owner C-216, expiring 2026-11-20, with no RSS threshold (C3 carries RSS as droplet evidence).

### rev-35 · 2026-11-03T22:08:14.692Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1608-baseline-source-1
commit: 9fff19fe966d5d1e9c89b2d7cff093b5ff3f8c44
scope: full
findings: [{"severity":"medium","text":"New guide lacks the required '# hub/test/spoke-footprint.test.ts' heading and has no generated index row. test-docs.test.ts:16–27 and generate-test-docs-index.ts:7–8 reject this; correct heading and regenerate index before baseline verification.","file":"docs/agents/tests/hub-test-spoke-footprint.test.ts.md","line":1},{"severity":"medium","text":"C-216 allowance spans Nov3–Nov20, but suite-durations.ts:188–190 permits seven days for nonlegacy owners; legacyOwner is E-880. Existing production parser refuses the manifest even in report mode. Resolve expiry with Coordinator within shipped policy.","file":"hub/test/durations.json","line":9987}]
finding_counts: {"high":0,"medium":2,"low":0}

Intermediate baseline source review only; not clear at 9fff19fe966d5d1e9c89b2d7cff093b5ff3f8c44. Production byte-identical to dev d38db9df79ff80d085010c734754fbfe8fc659f8, including hub/bin. Standards: two medium findings. Spec: no further findings in authorized test-only measurement scope; welcome consumer observation precedes ten idle seconds, no RSS threshold, native joined cleanup plus empty census. C2 failed for execution readiness; C1/C3/C4 intentionally unfinished under Coordinator's two-head plan, not findings. A-16356 detail /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16356-t-1608-baseline-source-review-guide-registration-and-invalid-allowance-dates.md. Lead subsequently reports fixes/Nov10 authorization and duration replay A-16357 prepared; those are not at this reviewed commit and need a fresh source request. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.

Criteria: C2 failed (The measurement baseline cannot run through configured verification until its guide registration and invalid nonlegacy allowance date span are corrected.).

### rev-35 · 2026-11-03T22:09:20.723Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1608-baseline-source-2
commit: 31532c77dff62c312ebdb2ee283782c6b78778c2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Intermediate test-only baseline source clear; both medium findings resolved. Guide heading/index match; C-216 allowance30s dates Nov3–Nov10 satisfy shipped parser, per Coordinator a326ffb5. A-16357 retains two pre-commit macOS arm64 Node24.21 duration samples10.513454209s/11.039158541s exit0 and report-mode production checker replay; first RSS unavailable is not a size reading, second60129280bytes is not Linux evidence. Confirmed production byte-identical to dev d38db9df79ff80d085010c734754fbfe8fc659f8 across hub/src,hub/bin,shared,web,nvim. Same measurement design: welcome consumption then10s idle, no tools/list/call, no RSS threshold, joined native cleanup plus empty census. No criteria verified on this source-only pass; C2 awaits same-head runtime evidence; C1/C3/C4 intentionally unfinished under two-head plan, not a final task clear. Future production split needs fresh source review before verification. Detail A-16358 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16358-t-1608-corrected-baseline-source-clear.md. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.
