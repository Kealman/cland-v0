---
id: T-572
kind: task
title: Demo droplets show no tags at release, so the hub refuses to delete a live untagged droplet
state: open
status: review
size: S
criterion_seq: 3
labels:
  - bug
  - hub
  - executor
  - v0.1.3
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-553
topic: topic-357
branch: t/T-572-demo-droplets-show-no-tags-at-release-so
created: 2026-10-16T05:01:37.265Z
updated: 2026-10-16T05:27:14.575Z
---

## Summary
E-423 demo run qa-2026-10-16-27-17 at 3c596742, case D18 (A-3726), on the restarted hub pid 37109, which has T-553. At 05:00:24Z, `cland demo stop E-423` returned exit 0 with the lease in state releasing and "operator attention required; identity mismatch; deletion refused". Lease 375889a3 expected droplet 609583042 named cland-v0-375889a3 with tags [cland, cland-p-8a978a214ba5]. The provider showed the same name and status active, but tags []. Run 16's demo droplet (609578713) hit the same refusal under the old message at 04:35Z and was gone by 04:37Z, cause unknown. No code in hub/src/executor removes tags. So the demo droplets are either created without their tags or lose them, and either way a live cland droplet exists that tag-based reaping can't find and release refuses to delete. That breaks the standing constraint that every cland droplet carries a cland tag and guaranteed destruction. Task-run droplets created tonight do show their tags.

## Acceptance criteria
- [x] C1. Find where a demo droplet's tags go missing (the demo create request, the snapshot or create path, or provider eventual consistency on read) and record the cause with provider request evidence on this item.
  - done: impl-572 · 2026-10-16T05:14:28.518Z
  - verified: rev-30 [reviewer] · run rev-20261016-572-source · 2026-10-16T05:27:14.575Z · commit ae48c3611f860ad73201eb757f08cf613a1719aa
- [x] C2. Every demo droplet carries both cland tags from creation, and a test with the fake provider fails if the demo create path omits them.
  - done: impl-572 · 2026-10-16T05:14:28.827Z
  - verified: rev-30 [reviewer] · run rev-20261016-572-source · 2026-10-16T05:27:14.575Z · commit ae48c3611f860ad73201eb757f08cf613a1719aa
- [x] C3. A droplet whose name and id match its lease but whose tags read empty is still destroyed, or retried until destroyed, with the mismatch logged. A droplet whose name or id differs is still refused.
  - done: impl-572 · 2026-10-16T05:14:29.214Z

## Comments

### coord · 2026-10-16T05:01:52.096Z

Stand-in check at 05:03Z: droplet 609583042 returns 404 from DigitalOcean. The account holds only n8n plus the four task droplets, each with both cland tags, so no live untagged droplet is left and the constraint held. The lease record 375889a3 still reads "releasing, watchdog alive, operator attention", a record-only leftover. The likely reading, also logged on T-553: the identity check caught the droplet mid-teardown at the provider, with tags already stripped and status still "active", perhaps because the watchdog or an earlier delete had started it, and called that a mismatch. Run 16 matches: refused at 04:35Z, 404 by 04:37Z. So C1 should first test the provider's teardown state before suspecting the create path. C3's direction: on a tags-only mismatch where id and name match, re-read after a short delay, treat a 404 as released, and clear the lease's attention state.

### impl-572 · 2026-10-16T05:09:36.141Z

C1: fake-provider reproduction A-3727 proves that a prior accepted DELETE followed by GET {same id/name, status: active, tags: []} triggers the reported releasing/attention leftover. The demo POST includes both cland tags. This reproduces the failure from supplied real receipts and supports the teardown-state explanation; without real API access it does not prove why DigitalOcean stripped tags or which actor initiated deletion. Shared cleanup.ts scope approved by Coordinator in topic-357. Local test slot yielded to T-523 at its request; continuing source/test additions meanwhile.

### impl-572 · 2026-10-16T05:15:42.086Z

C1 disposition (Coordinator decision af678989-2b8e-4461-8c99-30c8258d64cc, topic-357): settle on bounded inference from faithful fake reproduction A-3727 and supplied real-provider receipts: A-3726 GET same id/name, active, tags []; stand-in 404 at 05:03Z; run 16's matching sequence. Demo creation has both tags. Which actor strips the tags or initiates deletion is not observed. No dedicated paid live teardown tracing is required. E-423 D18 rerun on a hub containing T-572 is the real check; if it still sticks, reopen C1 with live tracing.

### impl-572 · 2026-10-16T05:26:54.289Z

Local green proof at ae48c361: A-3739 demo-release.test.ts 7/7 pass, 15.94s wall, load 1.875, pgrep clear; includes sanitized provider POST with both tags, GET same id/name active/tags=[], and released demo result. All new cases <2.52s. A-3740 executor-droplet.test.ts 14/14 pass, 12.23s wall, load 2.48, pgrep clear. Tree/head unchanged; source Reviewer has receipts. Mac capacity yielded to T-574. No real provider API calls.

### rev-30 · 2026-10-16T05:27:14.575Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-572-source
commit: ae48c3611f860ad73201eb757f08cf613a1719aa
scope: full

# T-572 source review clear at ae48c361

Head ae48c3611f860ad73201eb757f08cf613a1719aa; branch t/T-572-demo-droplets-show-no-tags-at-release-so. Fixed point frozen dev3c596742; one implementation commit, six changed files. Origin task ref matches. task.view confirms claimant impl-572 and C1–C3. Direct Standards/Spec review; no Reviewer execution.

## Standards
No high, medium or low findings (0).
Shared cleanup.ts is the authorized boundary for hub release and detached watchdog. Per-id GET must match both lease resource id and name; either mismatch immediately refuses before deletion, including archive state. A tags-only mismatch logs then observes for at most min(caller deadline,now+2000ms), with100ms pauses and deadline-limited rereads. A404 returns absence; persistent mismatch refuses. Missing tags never authorize DELETE. Existing tagged name discovery for uncertain creates and key absence confirmation remain.
Hub logs executor-release-identity-recheck with lease/id/attention via existing logger; detached watchdog writes structured watchdog.log in its owned lease directory. Error diagnostics include optional id fields compatibly with older persisted attention. Normal confirmed release/accountRelease clears attention. No destructive fallback is added. Existing deletion-start/archive guard is tightened to retain name equality.
Fake provider adds explicit tags-stripped active teardown and wrong GET-id faults, and advances accepted deletion on per-id GET as well as listing. Tests therefore exercise the new observation loop without relying on a tagged listing to rediscover a tagless resource. No production tags are removed by this patch.

## Spec
C1 verified under primary Coordinator af678989-2b8e-4461-8c99-30c8258d64cc: settle on bounded inference, not unsupported certainty about DigitalOcean internals. A-3726 is the real diagnostic with expected lease tags and observed same-name active/tags=[]; Coordinator stand-in later404 at05:03 and run16's analogous sequence support teardown-in-progress. A-3727 reproduces tagged fake POST, prior accepted DELETE, same-id/name active/tags=[] and old release refusal. The real actor stripping tags and exact provider behavior remain unobserved. No dedicated paid tracing is required; E-423 D18 on the merged/restarted T-572 hub is the real after-stage check, and C1 reopens for live tracing if it still sticks.
C2 source-verified: existing demo acquire builds tags[cland,projectTag] from creation; new fake-provider guard asserts the POST includes both, plus a cland-p-12hex tag. It fails if demo create omits them. No speculative create-path rewrite is needed.
C3 implementation established by source and targeted tests, but final runtime criterion mark awaits fresh exact-head droplet verification. Primary scope decision a49b7fec explicitly requires bounded tag-only observation, strict id/name refusal,404 confirmation and persistent-tagless refusal; source implements exactly this. It does not delete an indefinitely live tagless resource just because its name/id match.

## Evidence audited
A-3739 corrected whole demo-release file7/7,0fail/cancel/skip,15.936s. Prior-delete active/tagless case2.513s with concrete fake POST/GET/release diagnostic, persistent tags2.484s, persistent id1.954s, detached watchdog2.442s, prior delete retry2.139s, archive tags2.098s, foreign name/tags refusal2.061s. State/attention persistently clear after404; no extra DELETE is accepted for tagless state. Watchdog starts expired with10s outer retry interval but receipt required within8s, isolating the shared bounded reread path. Exact worker exit is observed before directory cleanup.
Earlier6/7 A-3732 was only a wrong journal-vs-hub.log assertion; the committed correction uses flushProjectLogs and hub.log, now green in A-3739. Read actual real diagnostic A-3726 and red-reproduction A-3727. Typecheck reported green; immutable whitespace check clean. Related compatibility files are still being checked by Implementer; no unsupported claim they already passed.
Source clear, verify C1/C2. C3/final task gate remains pending exact reviewed-head --executor droplet --fresh receipt. Finish any already-running targeted compatibility check before suite submission; failures require diagnosis/new source review if head changes. No per-item QA brief; E-423 after-stage D18 remains separate Coordinator/QA work. No Reviewer tests, compiler/binary execution, edits, signals, provider calls, commits, merges or subagents.
Totals Standards0,Spec0 findings. Existing rule proposal for preserving identity across teardown is already acknowledged by Coordinator for the human batch.

Artifact A-3741 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3741-t-572-source-clear-bounded-tags-only-rereads-with-strict-ownership-refusal.md

Criteria: C1 verified, C2 verified.
