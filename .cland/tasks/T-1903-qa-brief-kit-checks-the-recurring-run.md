---
id: T-1903
kind: task
title: QA brief kit checks the recurring run-copy corrections
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1861
topic: topic-1660
branch: t/T-1903-qa-brief-kit-checks-the-recurring-run
created: 2026-11-16T07:29:47.508Z
updated: 2026-11-19T21:26:23.203Z
closed: 2026-11-19T21:26:23.203Z
---

## Summary

More than 22 run-copy corrections in v0.4.0 (§3.5). `cland qa lint` exists (`qa-lint-references.ts`). §7 #12, with T-1868, T-1808, T-1665 and T-1861.

Kind: product (qa lint) + skill. Triage ticket H-15 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. `cland qa lint` flags the five most frequent corrections: seals, kit pins, `npm run build`, census filters and exact lists (test).
  - done: impl-1903 · 2026-11-19T19:35:51.659Z
  - verified: rev-39 [reviewer] · run rev-20261119-1903-final-4 · 2026-11-19T20:09:23.504Z · commit f7b1f73c7a0280a4db03a6ef35108258873fe15f
- [x] C2. The qa skill starts each run from the latest corrected run copy (docs check).
  - done: impl-1903 · 2026-11-19T19:29:34.746Z
  - verified: rev-39 [reviewer] · run rev-20261119-1903-source-3 · 2026-11-19T19:39:59.137Z · commit f7b1f73c7a0280a4db03a6ef35108258873fe15f
  - verified: rev-39 [reviewer] · run rev-20261119-1903-final-4 · 2026-11-19T20:09:23.505Z · commit f7b1f73c7a0280a4db03a6ef35108258873fe15f

## Dependencies

T-1861

## Comments

### impl-1903 · 2026-11-19T19:16:51.725Z

Consumer census: lintQaBrief remains unchanged for T1 qa-lint and suite-admission callers and T3 qa-lint-build corpus oracle. New lintQaRunCopy is a separate advisory API used only by offline runQaLint and T1 controls; CLI stderr adds report-only rows while existing exit statuses stay unchanged. QA skill and BRIEF template share docs/agents/qa-brief-lint.md guidance; hub README indexed. QA_LINT_USAGE owning frozen commands.json row will migrate; cli-usage compatibility and cli-help retained. No wire/schema changes, no test tier moves; qa-lint-build T3 not changed. Search covered function/field/output names across hub,nvim,web,hidden skills,docs,qa fixtures.

### rev-35 · 2026-11-19T19:23:32.918Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1903-source-1
commit: a0251b52965ac03576fb16d3667f4d7d708711f8
scope: full
findings: [{"severity":"medium","text":"M1 · Standards/rules9,12: the new real-CLI callback reuses raw t/tempProject and an unregistered execFile child, without a pre-acquisition original-work owner, separate setup/behaviour bounds or cancellation join fencing root cleanup until CLI closure. Preserve the executable/exit-code subject while adding joined lifecycle ownership.","file":"hub/test/qa-lint-cli.test.ts","line":46},{"severity":"medium","text":"M2 · Spec/C2 and Standards/rule16: the shipped skill/template's new authoritative run-copy reference points to docs/agents/qa-brief-lint.md, which is not provisioned to host projects (init/instructions.ts DOCS has only three other files). Ship the guidance with the QA skill and point all consumers at that same available source, with an installed-copy check.","file":".agents/skills/qa/SKILL.md","line":31}]
finding_counts: {"high":0,"medium":2,"low":0}

Source1 full review at a0251b52965ac03576fb16d3667f4d7d708711f8/tree397b25def43b0ab6f201e28f6e05ef67118cdb5d. A-21871 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21871-t-1903-source1-cli-test-ownership-and-shipped-guidance-gaps.md).

Medium M1, Standards: hub/test/qa-lint-cli.test.ts:46 — new raw-t callback lacks encompassing pre-acquisition setup/body/returned-child ownership and cancellation join fencing root cleanup; execFile's ordinary callback/10s timeout and clandCliLaunch permission marker do not supply that boundary. Lead f33d1e8b confirms. Preserve actual subprocess/exit assertions while adding the owner.
Medium M2, Spec/Standards: .agents/skills/qa/SKILL.md:31 — newly authoritative guidance is under unprovisioned repository docs. provisionSkills copies skill files; provisionDocs lists three other docs only. Shipped skill/copied template need a shared packaged source and installed-copy proof. Lead eeec3ecd confirms.

No additional finding in five lexical advisories, report-only isolation, unchanged blocking admission/exit status, help/frozen owning bytes or stated lexical limitations. Marks: failed C1,C2; no verified marks. A-21869 is candidate-tree authored-return evidence, not immutable-head configured verification. No Reviewer runtime/edit performed. Please consolidate both corrections and request fresh exact-head source review before configured verification.

Criteria: C1 failed (New T2 real-CLI test lacks encompassing setup/body/child cancellation ownership before root cleanup.), C2 failed (New authoritative run-copy guidance linked by the shipped skill/template is not provisioned into installed host projects.).

### impl-1903 · 2026-11-19T19:29:49.381Z

Source1 corrections at 76b03c0a0: fixtureWork and captured child close/result join now cover all three offline CLI callbacks, preserving executable assertions; this deduplicates both pre-existing callback asides. Canonical run-copy guidance moved into shipped qa/RUN-COPY.md; new actual provisionSkills installed-copy regression red ENOENT before move then green. Consumer links migrated in QA skill, copied template, repo reference; original consumers and lexical/report-only semantics unchanged. A-21874 correction evidence, A-21869 retained original. Full test:lint/root typecheck exit0; T1 affected37/37, T2 CLI3/3 and full skills-qa24/24 candidate passes, macOS Node24.21.0. No cancellation experiment or configured verification yet. Fresh source review requested.

### rev-35 · 2026-11-19T19:32:15.902Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1903-source-2
commit: 76b03c0a0e78fcda04138781c0f11d987aa5b437
scope: full
findings: [{"severity":"medium","text":"M3 · Standards/rule39: lintFixture's finally awaits owner.dispose(), so a rejected cleanup replaces an already selected outer setup/behaviour deadline or failure. Preserve the primary outcome and attach cleanup as a secondary diagnostic, retaining the disposal/root fence.","file":"hub/test/qa-lint-cli.test.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 full review at76b03c0a0e78fcda04138781c0f11d987aa5b437/tree57911f11f9f71488aa3f0aa65d0ea2f4fa265858. A-21875 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21875-t-1903-source2-preserve-selected-failure-when-fixture-cleanup-rejects.md).

Sole medium M3, Standards/rule39: hub/test/qa-lint-cli.test.ts:30 — finally await owner.dispose() can replace the selected outer setup/behaviour deadline/error if disposal also rejects. fixtureWork.run's inner aggregation does not preserve that outer deadline. Lead75f7b8a2 confirms. Preserve the primary outcome plus secondary cleanup diagnostic and keep the current disposal/root fence; a deterministic error-path control suffices, no new real cancellation run requested.

Original M1 ownership and M2 shipped guidance are resolved in source, including all three callbacks and the installed provisionSkills reference check. No additional Spec finding in report-only advisories, existing exit/admission policy or corrected-copy workflow.

Marks: C1 failed; C2 remains done but unverified; no verification marks added. A-21874 reports candidate-tree ordinary CLI3/3, full skills QA24/24 and affected T1 selection37/37 plus full lint/typecheck, not immutable-head configured evidence. No Reviewer runtime/edit performed. Correct M3 then fresh exact-head review before configured verification.

Criteria: C1 failed (New lintFixture finally can replace a selected outer setup/behaviour failure with a rejected disposal, losing the primary outcome.).

### rev-39 · 2026-11-19T19:39:59.137Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1903-source-3
commit: f7b1f73c7a0280a4db03a6ef35108258873fe15f
scope: full
findings: [{"severity":"low","text":"L1: QA lint reference still says exit0 means no findings; new report-only advisories can coexist with0. Qualify as no blocking findings and distinguish advisory rows, matching updated help/reference. Documentation-only/nonblocking.","file":"docs/hub/artifacts.md","line":177}]
finding_counts: {"high":0,"medium":0,"low":1}

T-1903 corrected source review CLEAR
Headf7b1f73c7a0280a4db03a6ef35108258873fe15f
Git tree0e071864e9ab588da9cd645c0ffefda10f952d65
Base03efb0fc1eaf62bebf7213fd74480d3e57dca887
Reviewrev-20261119-1903-source-3; scope full.

## Standards
No high/medium findings. M3 resolved: outer lintFixture observation now uses existing production withCleanupAsync. Inspected helper awaits disposal on both paths, preserves selected Error identity/code and adds cleanup detail secondarily; cleanup-only failure remains failure. Root/child ownership is unchanged and still awaited, not bypassed to keep the primary. Pure deferred-promise contract control covers identity/code/secondary detail and successful-operation/failed-cleanup path; no real cancellation reproduction claimed.
M1 remains resolved: fixtureWork is enrolled before root acquisition for all three real CLI callbacks; separate setup/behavior bounds retain the original admitted producer. Child capture owns native close/result/stop, cancellation passes scope signal, late acquired owners close before root removal. Real executable exit0/exit1/usage assertions retained.
Low L1 — docs/hub/artifacts.md:177 still says "Exit 0 means no findings", though new lexical report-only findings can coexist with0. Qualify this to no blocking findings and distinguish advisory output, matching changed usage/docs/agents reference. Documentation-only, nonblocking.

## Spec
No functional findings. Five lexical checks retain source-text scope and clear limits: seals, full kit pin, npm run build, own-pid census exclusion, required generated-case list. They are a separate lintQaRunCopy API, never passed to blocking brief admission; CLI emits file/line report-only rows while return code derives solely from lintQaBrief. Source/procedure/corpus callers and unchanged qa-lint-build T3 keep blocking semantics; frozen owning help bytes migrated.
M2 resolved/C2 verified by source/docs check: canonical RUN-COPY.md now lives inside shipped qa skill. provisionSkills enumerates/copies its file set; skill relative RUN-COPY link and copied qa/briefs template ../../.agents/skills/qa/RUN-COPY link resolve to that same packaged file. Installed-copy regression reads actual provisioned bytes. Skill's common entry instructions require latest corrected run copy, correction commit and helper reconciliation for every run. Repository reference points to packaged guidance. No duplicate unshipped authoritative run-copy text.
C1 runtime remains unverified pending exact-head configured result; C2 source/doc condition is established.

Evidence A-21878 transcribes local macOS Node24.21.0 candidate checks: final affectedT1 qa-lint/cli-usage/compatibility38/38, realCLI T2 3/3/nativeexit0, full typecheck0 and test:lint0/131report-only findings62files/zero refusals. Earlier T1 36/36 was before join-state assertion and not relabelled final; A-21874 installed-copy24/24/earlier37affectedT1 retain previous candidate scope. A-21869/A-21874/A-21875 and their red/provenance limits remain. No separately retained raw streams/immutable invocation trees established by A-21878; no browser/T3/T4/cloud/QA/native cancellation/configured run. No tier move or old-tier proof borrowed.
Standards1low/Spec0functional. PriorM1/M2/M3 resolved. Reviewer read-only exact source/diffs/helpers/docs/provisioning/consumer/evidence inspection; whitespace check passes. No edits/tests/probes/browser/subagents/commits/merges.
Source clear at exact head permits Coordinator window request and configured verification; retain L1 as nonblocking docs follow-up.
A-21884: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21884-t-1903-source-clear-selected-outcome-preservation-and-packaged-guidance.md

Criteria: C2 verified.

### rev-39 · 2026-11-19T20:09:23.505Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1903-final-4
commit: f7b1f73c7a0280a4db03a6ef35108258873fe15f
scope: evidence
findings: [{"severity":"low","text":"Carried L1: exit0 wording still says no findings though report-only advice can coexist with0; qualify as no blocking findings. Documentation-only Tech debt,XS follow-up previously reported to lead; nonblocking.","file":"docs/hub/artifacts.md","line":177}]
finding_counts: {"high":0,"medium":0,"low":1}

T-1903 final evidence CLEAR
Headf7b1f73c7a0280a4db03a6ef35108258873fe15f; Git tree0e071864e9ab588da9cd645c0ffefda10f952d65.
Reviewrev-20261119-1903-final-4, scope evidence.
Configureda32acd7a-9489-4ca5-a882-ad8a2285b7fd/A-21894 passed at exact source-cleared head, no cache. Producer snapshot treece846f1971183d5fa6e1398677cea1e722390e90 is distinct from source Git tree.

Independent structured completion check:7,030 ordinary passes plus40 separate load repetition passes; zero fail/cancel/skip. T0/T1/all fallbackT2/Web exit0. T3 deferred to merge batch,T4 unexecuted; no all-tier/real-QA-run claim.
Required files qa-lint36/36, realCLI3/3, skills-qa24/24 ordinary. Eight exact new generated cases pass ordinarily and5/5 under load:
- QA fixture settlement preserves the selected deadline and reports secondary cleanup failure
- run-copy seal advice detects a scratch launch without the shared builders
- run-copy advice flags unpinned reused kits and accepts a full kit commit
- run-copy advice calls for a build when a browser bundle is used
- run-copy census advice requires observer exclusion by pid
- run-copy exact list advice rejects subset expectations for generated registrations
- run-copy advice reports file and line without changing lint exit status
- installed QA skill and copied brief resolve the shared corrected-run guidance

C1: actual executable test keeps all five file/line report-only categories with exit0 and a coexisting blocking command finding with exit1. Five lexical positive/negative control cases pass; lexical/presence limits remain documented, not helper execution/pin freshness/exhaustive membership claims. Shared withCleanupAsync outer wiring and source-reviewed fixture/child/root ownership remain; settlement control passes with selected identity/code and secondary detail, no real cancellation experiment inferred.
C2: current source skill requires latest corrected run copy; same-head installed provisionSkills test proves shipped RUN-COPY bytes and copied-template/skill path resolution. No unshipped authoritative reference remains for this new guidance. Source/doc C2 mark retained and now backed by installed-copy runtime proof.

Carried low L1 — docs/hub/artifacts.md:177 still says exit0 means no findings; report-only rows can coexist with0. Update to no blocking findings/distinguish advisory output. Same nonblocking documentation-only follow-up reported to lead as Tech debt,XS in A-21884; no new functional finding.
Linuxx64droplet c-8ams3/kernel6.8.0-149-generic/Node24.21.0/Neovim0.12.5/workers2. Actual browser receipt:/home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Producer lifetime1489.543s/cost$0.1034404861(summary1490s/$0.1034), not test wall time. Lint131/62,duration/budget/ratchet advisories remain report-only.
Earlier A-21869/A-21874/A-21878 candidate checks and prior not-clear findings/installed-copy red retain their epochs and raw/provenance limits. No Reviewer tests/probes/browser/file edits/commits/merges. Standards1low/Spec0functional; verifyC1,C2.
A-21895: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21895-t-1903-final-clear-five-advisory-kinds-and-installed-run-copy-receipts.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T21:26:23.203Z

Merged 06182c40626e0e9ceb9b793f86bce1b32dd4276c onto dev.
