---
id: T-1608
kind: task
title: The slim Linux spoke
state: open
status: ready
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
updated: 2026-11-03T23:04:45.283Z
---

## Summary

The spoke loads only what a session's connection needs at start, with the rest imported on first use, to bring its Linux resident size of 105–125 MB toward its macOS size. A measurement test records the spoke's RSS on the platform it runs on, and the task's evidence carries the values before and after from the branch's own Linux droplet verification.

Hot files: `hub/src/spoke/spoke.ts`, `hub/bin/cland-spoke.ts`, `hub/src/spoke/*.ts`, `hub/test/spoke-footprint.test.ts` (new)

## Acceptance criteria

- [x] C1. A T1 test fails when the spoke's start-up import graph (before the hub's welcome) reaches `node:sqlite`, the journal, the tracker or another module on a named deny list (test).
  - verified: rev-36 [reviewer] · run rev-36-1608-final-1 · 2026-11-03T23:04:30.600Z · commit a9413e5b69adc88288825e974302eef60c2ef220
  - done: impl-1608 · 2026-11-03T23:04:45.283Z
- [x] C2. A measurement test starts the spoke against a test hub, waits for the welcome and an idle 10 s, and reports its RSS. It fails only when the spoke does not start, never on the number (test).
  - verified: rev-35 [reviewer] · run rev-35-1608-baseline-evidence-1 · 2026-11-03T22:34:06.350Z · commit 31532c77dff62c312ebdb2ee283782c6b78778c2
  - done: impl-1608 · 2026-11-03T22:37:44.292Z
  - verified: rev-36 [reviewer] · run rev-36-1608-final-1 · 2026-11-03T23:04:30.600Z · commit a9413e5b69adc88288825e974302eef60c2ef220
- [x] C3. The task's evidence records the spoke's RSS on Linux at `dev`'s head and at the branch head, both from droplet runs, with the reduction.
  - done: impl-1608 · 2026-11-03T23:02:43.218Z
  - verified: rev-36 [reviewer] · run rev-36-1608-final-1 · 2026-11-03T23:04:30.600Z · commit a9413e5b69adc88288825e974302eef60c2ef220
- [x] C4. Every spoke tool still answers, and the spoke, spoke-reconnect and spoke-tools test files pass with no test edited.
  - done: impl-1608 · 2026-11-03T22:37:44.414Z
  - verified: rev-36 [reviewer] · run rev-36-1608-final-1 · 2026-11-03T23:04:30.600Z · commit a9413e5b69adc88288825e974302eef60c2ef220

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

### rev-35 · 2026-11-03T22:34:06.350Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1608-baseline-evidence-1
commit: 31532c77dff62c312ebdb2ee283782c6b78778c2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized intermediate baseline evidence clear, findings []; C2 verified only. Independently streamed A-16370 named ordinary measurement pass25006 (10.912593574s), RSS diagnostic25008=130699264bytes, unavailable:null, Linuxx64 Node24.21/idle10000ms/no tools/list or tools/call/excludes hub+runner, and file finish/pass25009 including native joined cleanup+census. One RSS sample, not mean/peak. Same-head uncached102dff96-f9c5-410d-89bc-d23095c6d828 exit0,4924/4924, no fail/cancel/skip/todo; T0/allT1/fallbackallT2/changedT4 once/Web complete. T3 deferred/unexecuted; T4 repetitions skipped. Measured head is dev-equivalent test baseline, not exact dev checkout: production byte-identical to dev d38db9df79ff80d085010c734754fbfe8fc659f8 under Coordinator6d12bbe1. Record this before sample for C3; after sample/reduction and C1/C4 remain incomplete/unverified, not a final task clear. Provenance27389 tree17d0dcf57ae0d14712d6c28c53548ae4965105a8; c-8sfo2 Linux6.8.0-142-generic Node24.21/Nvim0.12.5, isolated HeadlessShell1248/ChromeForTesting156.0.8078.4; cached/occasionnull,skips[]/missing0 report. Budget/lint/ratchet report-only; billing1342s/$0.0932 not suite wall. Detail A-16371 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16371-t-1608-baseline-evidence-linux-rss-130699264-bytes.md. Changed production head needs source review before verification. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.

Criteria: C2 verified.

### impl-1608 · 2026-11-03T22:35:28.479Z

BaselineC3 Linux RSS130699264bytes from my run102dff96/head31532c77d (devd38db9df7 production byte-identical), A16370/A16371; c-8sfo2/Linuxx64Node24.21/tree17d0dcf/cache null. T0/T1/fallbackallT2/changedT4once/Web passed4924; T3 deferred, T4repetitions skipped, gates report-only. C1 red before production edits: seven forbidden paths (subscriptions→tracker/prefixes,TOOLS,validator,task-tools→findings/item,journal,store). After conditional imports C1 passes38.6ms/macOSarm64Node24.21. Consumer inventory A16355 precedes edits; no existing test modified.

### rev-36 · 2026-11-03T22:40:22.433Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1608-source-1
commit: a9413e5b69adc88288825e974302eef60c2ef220
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Production split source clear, no findings; detail A-16378. Shared handler/schema/parser ownership and conditional local role/journal behavior retained; C1 AST deny policy and positive controls, C4 full tool census, unchanged preservation files, C2 measurement/cleanup design inspected. Prior baseline A-16371 is dev-equivalent before evidence only. C1–C4 runtime criteria remain unverified at this changed production head; same-head mode-free verification may proceed. Need Linux after RSS + native cleanup and complete named preservation evidence for final. Reviewer ran no tests/probes/checks/browser and made no edits.

### impl-1608 · 2026-11-03T23:03:02.074Z

Final evidence A-16395 at reviewed/pusheda9413e5b69adc88288825e974302eef60c2ef220. OwnLinuxbaseline102dff96/head31532c77(devd38db9df7productionidentical):RSS130699264bytes,c-8sfo2,A16370. OwnLinuxafterc36a52a4/head a9413e5b6:RSS115593216bytes,c-8,regionnotrecorded(T1667) per Coordinatorb193d322/ledgerleasee5117170,18min55s/$0.0775. Reduction15106048bytes/14.40625MiB/11.5579%; single10sidle sample afterwelcome, no toolcalls/lists, excludeshub+runner, noRSSthreshold. Afterexit0/4927pass/0failcancel skip todo;T0/allT1/fallbackallT2/changedT4once/Webcompleted;T3deferred,T4extrarepsskipped. Linuxx64Node24.21/Nvim0.12.5/isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4,cache null/report-onlygates. NamedC1two/newalltoolsone/measurementone actualpass; seven unchangedT1/T2C4files31pass. Exact-head localDarwinarm64Node24.21 scenariohub-lifecycle6/6exit0 supplied inA16395 for deferrednative boundary. Processmeasurementcase includesjoinedclose+emptycensus; socketcontrolsretained. Freshdevc11c7b7b productiondelta originaldev..currentdev underhub/src/shared/web empty;merge-treeclean9b45fb265d82c4575b5af332ccf001a723cbc7f0/no merge. AllC1–C4done; no source/headchange.

### rev-36 · 2026-11-03T23:04:30.600Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1608-final-1
commit: a9413e5b69adc88288825e974302eef60c2ef220
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C4 verified; no findings. A-16397 independently streams A-16370 baseline RSS130699264bytes and A-16391 after RSS115593216bytes, both actual diagnostics/native case+cleanup file passes; reduction15106048bytes/14.40625MiB/11.5579%, one sample per head. Baseline is approved dev-equivalent test-only31532c77 (production identity independently checked), after exacta9413e5b. Both c-8 Linuxx64 Node24.21; baseline sfo2, after region not recorded(T-1667), retained per Coordinatorb193d322—not inferred. Named C1+positive control2, all44-tool census1, measurement1 and seven unchanged preservation files31 pass remotely; corrected A-16396 supplies exact-head local Darwinarm64 native lifecycle6/6 exit0. After run c36a52a4 exit0/4927pass; T0/allT1/fallbackallT2/changedT4once/Web complete, fullT3 deferred/T4 repetitions skipped/after-stage QA separate. Cache null, isolated HeadlessShell1248 ChromeForTesting156.0.8078.4, budgets/lint/ratchet/skip checks report-only missing0. No Reviewer runtime checks/probes/browser/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
