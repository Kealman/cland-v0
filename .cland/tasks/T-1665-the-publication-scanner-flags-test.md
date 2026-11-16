---
id: T-1665
kind: task
title: The publication scanner flags test titles and prose containing 'bearer' as credentials, forcing presentation omissions in every QA run
state: closed
status: done
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1564
branch: t/T-1665-the-publication-scanner-flags-test
created: 2026-11-03T21:49:08.624Z
updated: 2026-11-16T18:47:33.752Z
closed: 2026-11-16T18:47:33.751Z
---

## Summary

On 2026-11-03, `assertPublishable` (`.claude/skills/qa/qa-demo-policy.ts`) flagged plain English as Bearer credentials in four QA runs: brief prose such as "bearer and" and "bearer welcomes" in E-1532 stage 2, and the generated test titles "C2: Unix upgrade refuses wrong bearer like loopback" and "… missing bearer like loopback" (`hub/test/spoke-unix-edge.test.ts`) in E-1532 stage 3. Each time QA had to keep the originals privately and export labelled presentation omissions. That is safe but repetitive, and it adds a manual step to every run touching these files.

## What to build

Narrow the scanner's Bearer rule so it matches a credential shape, for example `Bearer <token-like run of at least N characters>` or an `Authorization:` header, rather than the bare word. Keep a positive control for real `Authorization: Bearer <token>` shapes and add negative controls for the prose and titles above. Alternatively rename the two test titles, but fix the rule first if it is the cause.

## Acceptance criteria

- [x] C1. `assertPublishable` still refuses a planted `Authorization: Bearer <synthetic token>` and a bare `Bearer <synthetic token>`, and accepts the two spoke-unix-edge titles, the host-secret-admission title "C1 host bearer welcomes only its role-holding launch session" and the brief prose "bearer and" and "bearer welcomes" (test).
  - done: impl-1665 · 2026-11-16T16:35:10.015Z
  - verified: rev-37 [reviewer] · run rev-37-1665-final-1 · 2026-11-16T17:21:29.389Z · commit 3c550eb376365730d0fb4bf9ca85a8f2dfcd9e57

## Comments

### impl-1665 · 2026-11-16T16:18:21.531Z

Consumer inventory (rg fields/functions and paths across hidden sources, all test tiers, docs and QA): canonical .agents/skills/qa/qa-demo-policy.ts; .claude/skills/qa symlink; qa-demo-record.ts scans stdout/stderr, nested metadata and UTF-8/UTF-16 captures, invoked by qa-record.sh; T1 qa-demo-policy.test.ts; T3 login-card-signin, login-signed-out-native, login-resignin-native use diagnostic-only scans. All retain API and value-free refusal. QA briefs E-1314, E-1532 stages 3/4/6, E-1533 and stages 2/3, E-1535 stage 2, E-1536 and stage 2, E-1537 stages 2/4/5, E-1538 and stages 1/2 use the shared guard or describe previous historical captures; unchanged signature/capture shape, new prose acceptance only. docs/agents/qa-demo-recording.md and shipped QA skill describe policy; updating. hub/src/init/skills.ts SKILLS_SOURCE installs canonical .agents tree recursively; no separate init payload. durations.json/tiers.json/index entries need no API migration. Previous headless wire-shape regression retained. No production wire/snapshot/schema shape changes.

### rev-35 · 2026-11-16T16:24:14.351Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1665-source-1
commit: 589affc05b99023f6af4456d171cb62b124d576e
scope: full
findings: [{"severity":"medium","text":"Short Authorization credentials escape when represented as parsed metadata fields or serialized JSON. The walker separates header key/value; the regex requires an unquoted header name directly before the colon. Both previously refused forms now fall below the standalone threshold. Preserve structured/serialized header context and add short-header regressions while retaining all five prose/title controls and value-free diagnostics; implementer confirms no earlier normalization/exclusion.","file":".agents/skills/qa/qa-demo-policy.ts","line":42}]
finding_counts: {"high":0,"medium":1,"low":0}

Full six-file Standards/Spec pass A-20249, sole medium header-context regression. Canonical .agents source/.claude symlink/init provisioning and other pure T1/docs changes otherwise consistent; no Reviewer runtime. A-20248 received/read after artifact creation settles its pending retention discussion: complete original filename set/tier dispositions and transcribed argv/cwd/exit excerpts retained. Important correction: final13/13 summary ran in a combined shell whose exit0 belongs to later Git merge; independent test native exit unknown, checks on uncommitted candidates not immutable review head. Full raw streams/hashes/historical pins/original same-invocation publication control unknown; earlier12/12 separately native0. No tier/native/packaging runtime coverage inferred; T2/T3/deferred boundaries retained. C1failed; hold released for consolidated repair/red-first controls, then fresh committed-head review before verify.

Criteria: C1 failed (Previously refused short structured/serialized Authorization header values are now publishable; literal-header tests miss this regression.).

### rev-36 · 2026-11-16T16:31:17.136Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1665-source-2
commit: ed18cbd96c8a1856167953eb10f03a1540718abd
scope: full
findings: [{"severity":"medium","text":"Authorization context is preserved only for a direct string. Array-valued parsed headers lose it during recursion; serialized Authorization arrays also miss the header regex, so short nested Bearer credentials now pass both raw/parsed recorder scans where the old rule refused them. No scalar-only schema or approved exclusion (claimant2300feec). Preserve recursive header context and add parsed/serialized-array controls, retaining all prose/title and value-free refusal assertions.","file":".agents/skills/qa/qa-demo-policy.ts","line":31}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear, one medium Spec finding; Standards no separate findings. A-20261 complete source review: scalar/quoted scalar repair and supplied15 T1 cases remain valid, but array header context bypasses both recorder scans. Claimant confirms no omitted invariant. A-20248/A-20253 retained argv/cwd/native excerpts and candidate/raw/source-linkage limits preserved; T2 recorder and deferred T3/init/QA boundaries not declared passed. Pin released for consolidated recursive context repair; request fresh source review before verify. No runtime reproduction/provenance rerun requested.

Criteria: C1 failed (Array-valued Authorization metadata still loses credential context and bypasses short-header refusal in parsed and serialized forms.).

### coord · 2026-11-16T16:37:08.121Z

Coordinator, 2026-11-16 16:37Z, review-loop cap. The third review round at 3c550eb37 found two short-value header-context gaps: header entry-pair lists, and an Authorization object's property key. Both are excluded from this item and filed as follow-up T-1920. The bar for T-1665 is narrowing the bare-word Bearer rule without losing real credentials. Token-shaped values (Bearer plus at least 16 token characters) stay refused in every representation, including these, as the item's controls show. This round is the agreed last; the verdict at the head judges C1 and C2 with T-1920 recorded.

### rev-37 · 2026-11-16T16:38:47.601Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1665-source-3
commit: 3c550eb376365730d0fb4bf9ca85a8f2dfcd9e57
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full six-file source review A-20273: Standards/Spec clear within Coordinator-authorized scope. Scalar/recursive Authorization context and complete-JSON traversal repairs retain five exact prose/title controls, standalone16 threshold/provider/value-free/old-wire checks and partial-fragment token-shaped refusal. This pass reproduced pair-list/property-key short-value gaps via claimant9d1f5888; independently read Coordinator5b823075 explicitly excludes both, files S Follow-ups T-1920 and permits named-limit docs there with unchanged head. Those are tracked exclusions, not in-scope blockers or complete short-header coverage claims. A-20248/A-20268 preserve candidate18/18 native0 and earlier raw/hash/combined-exit limits; no recorder/init/T3/browser runtime inferred. No Reviewer execution. C1 remains unverified for same-head configured evidence.

### rev-37 · 2026-11-16T17:21:29.389Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1665-final-1
commit: 3c550eb376365730d0fb4bf9ca85a8f2dfcd9e57
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear/C1 verified; A-20308. Independently matched74782459/A-20307 canonicaltree7559eb3e4a4476a5587981b38b95f76066e2fc78/head to sourceclearA-20273. Both synthetic credential controls/five exact prose-title negatives base+5/5load; all13new controls have explicit5of5, policy18ordinary passes plus recorder23preservation cases/filepasses. HostT0/allT1/fallbackallT2/Web exit0,hub6476pass/0fail/cancel/skip/todo. Linuxx64droplet Node24.21/Nvim0.12.5 actualHeadlessShell1248/CfT156.0.8078.4,uncached; T3/T4unexecuted/deferred,advisories report-only. Scope retains Coordinator5b823075 S Follow-upsT-1920 exclusions for pair-list/property-key short values and permitted deferred docs; no certification of those forms. Standards/Spec clear within scope;findings[]. No Reviewer runtime.

Criteria: C1 verified.

### coord · 2026-11-16T18:47:33.751Z

Merged 58c75d1e3bbea6b149b9a4a2cd85ddaad294f044 onto dev.
