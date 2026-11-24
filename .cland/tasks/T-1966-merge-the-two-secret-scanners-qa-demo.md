---
id: T-1966
kind: task
title: Merge the two secret scanners (qa-demo-policy assertPublishable and site capture-safety scanCapture) into one shared scanner policy
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1744
branch: t/T-1966-merge-the-two-secret-scanners-qa-demo
created: 2026-11-18T11:20:29.787Z
updated: 2026-11-24T14:28:22.435Z
closed: 2026-11-24T14:28:22.435Z
---

## Summary

Found by impl-1808 while building T-1808's scan-and-publish helper (2026-11-18). The repo has two secret scanners with different pattern sets. `assertPublishable` (.agents/skills/qa/qa-demo-policy.ts) covers provider keys, private keys and decoded spellings. `scanCapture` (site/scripts/capture-safety.ts) adds private paths and broad token and Bearer forms. T-1808 calls both unchanged, so a match in either refuses publication, but every other caller uses only one of them.

## What to build

One shared scanner policy holding the union of both pattern sets, with both existing entry points delegating to it, and every caller unchanged in behaviour except that it now catches the other scanner's patterns.

## Acceptance criteria

- [x] C1. Every pattern either scanner caught before is caught through the shared policy, proven by a positive-control fixture for each pattern family, generated per run and never a real-looking token committed to the repo (test).
  - done: impl-1966 · 2026-11-24T12:38:12.757Z
  - verified: rev-35 [reviewer] · run rev-35-1966-evidence-1 · 2026-11-24T13:18:11.210Z · commit b505b571f2adc2f0c6ae1874507998e554761778
  - verified: rev-35 [reviewer] · run rev-35-1966-evidence-2 · 2026-11-24T13:20:46.640Z · commit b505b571f2adc2f0c6ae1874507998e554761778
- [x] C2. Every caller of both scanners (QA kit, site captures, T-1808's helper) is listed with its disposition (rule 41) and passes unchanged.
  - done: impl-1966 · 2026-11-24T13:19:21.416Z
  - verified: rev-35 [reviewer] · run rev-35-1966-evidence-2 · 2026-11-24T13:20:46.640Z · commit b505b571f2adc2f0c6ae1874507998e554761778

## Comments

### impl-1966 · 2026-11-24T12:03:57.286Z

Consumer inventory before shared-policy change (rg fields/functions/import paths, all tracked+hidden source, tests across tiers, docs/briefs, raw readers): QA-demo profile: .agents/skills/qa/qa-demo-record.ts; qa/support/invite-capture.ts (transitive hub/test/qa-host-invite.test.ts); hub/test/login-card-signin.test.ts, login-resignin-native.test.ts, login-signed-out-native.test.ts, qa-demo-policy.test.ts. Capture profile: site/scripts/capture-screenshots.ts; site/test/users-docs.test.ts; hub/test/users-docs-invite.test.ts and screenshot-capture.test.ts. hub/src/evidence-publish.ts deliberately runs BOTH profiles and its per-profile positive controls, covered by hub/test/evidence-publish.test.ts. All retain entry points/call sites; each gains shared union families, while QA-demo retains T-1920 and capture retains strict scheme/exact-secret semantics per Coordinator decision. Shipped QA kit copies its whole folder, so shared pure module is beside qa-demo-policy. Historical consumers: qa/briefs/E-1532-stage-{3,4,6}.md; E-1533.md, E-1533-stage-{2,3}.md; E-1535-stage-2.md; E-1536.md, E-1536-stage-2.md; E-1537-stage-{2,4,5}.md; E-1538.md, E-1538-stage-{1,2}.md keep QA-demo API/profile and historical evidence unchanged. Matching docs EVIDENCE.md, docs/agents/evidence-publication.md, qa-demo-recording.md and hub/README.md updated to shared profiles. tiers/durations/index entries are classification/history only, unaffected; no frozen help, protocol, startup, persisted-record or raw wire scanner consumer found. No new wire shape.

### impl-1966 · 2026-11-24T12:04:50.841Z

Inventory addendum: qa-record.sh is the unchanged launcher of qa-demo-record.ts (QA-demo); qa/briefs/E-1314.md and docs/hub/running.md describe its recorder workflow and retain the same launcher/API. Policy implementation remains inside copied QA directory; evidence-publish's provisioned-kit regression passed unchanged. Initial red: new private-path control raised 'AssertionError [ERR_ASSERTION]: Missing expected exception.' at assertPublishable. Green after extraction: qa-demo-policy 85/85, screenshot-capture 3/3, qa-host-invite 2/2 T1 and evidence-publish 21/21 T2 on macOS, Node 24.21.0, local targeted runs; no browser/native T3 or full verify receipt yet. Full source review will use head after single origin/dev merge (65c625080).

### rev-35 · 2026-11-24T12:42:11.172Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1966-source-1
commit: b505b571f2adc2f0c6ae1874507998e554761778
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22938: Standards0/Spec0. One pure shipped policy backs both unchanged wrappers. Coordinator4c572d33's profile distinction is preserved: QA-demo contextual/length semantics, capture strict nonempty scheme/exact secret; other families unioned. Generated per-family/profile controls and fixed diagnostics retained. Wrapper inventory, kit copying and copied-policy regression inspected; additional unchanged raw skill/provisioning readers review-qa-component, roles-clauses, skills-qa, init-skills-update and skill-provenance[-merge] need no migration. A-22936's earlier first-case deadline red remains failed evidence despite subsequent reported local green; no configured run claimed. Site guard advisory pre-existing/T-1910 per Coordinator. C1/C2 done/unverified pending same-head configured receipts/native importers. Read-only review, no tests/probes/edits. Hold releases for Coordinator mode-free window at unchanged head.

### rev-35 · 2026-11-24T13:18:11.005Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1966-evidence-1
commit: b505b571f2adc2f0c6ae1874507998e554761778
scope: evidence
findings: [{"severity":"medium","text":"M1 evidence: C2's seven site caller cases are outside configured tiers; their earlier local 7/7 is only an authored pre-commit report without a durable source-bound producer receipt. Capture those cases at the unchanged reviewed head; no source fix or repeat full configured run is needed.","file":"site/test/users-docs.test.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22960: configured e228fc46/A-22959 is green at b505b571f (code 0/cause empty), but one required caller receipt is missing per lead 0dd97ce4. C1 is established: all 60 generated family/profile identities plus three special controls pass base plus five distinct loads each; full policy 85/85, other caller and three native login files pass. C2 fails only for source-bound site users-docs evidence. T0/T1/T2/ten selected T3/Web completed; remaining T3 deferred, T4 unexecuted; provenance/report-only advisories retained. Source review remains valid, head unchanged; hold releases for the missing targeted receipt, no code fix/full verification repetition requested. No reviewer tests, probes or reconstruction.

Criteria: C2 failed (The seven site/test/users-docs.test.ts caller cases lack a retained execution receipt bound to the reviewed source; configured e228fc46 does not run them.).

### rev-35 · 2026-11-24T13:20:46.640Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1966-evidence-2
commit: b505b571f2adc2f0c6ae1874507998e554761778
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22964: missing caller evidence resolved by A-22962 at unchanged b505b571f. Independently checked raw TAP SHA256, seven named ok outcomes matching pinned source, zero failures/skips/cancellations, declared source HEAD/tree before/after and native pipeline exit 0 (macOS Node 24.21.0, load 2.54, no browser). This complements green same-head e228fc46/A-22959; no source edit or configured rerun. C1 proof retained: 60 family/profile plus three special controls each base+5 loads, policy 85/85, other caller/kit/native sign-in tests pass. C1/C2 current. Configured T0/T1/T2/ten selected T3/Web passed; remaining T3 deferred, T4 unexecuted, advisories report-only. Earlier unbound summary and failed receipts remain distinct. Read-only review.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T14:28:22.435Z

Merged 91c76bbe4aa6ba647e69c0f365b26bdd1c49f644 onto dev.
