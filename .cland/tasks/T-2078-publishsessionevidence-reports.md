---
id: T-2078
kind: task
title: publishSessionEvidence reports "publication outcome unknown" when artifact.create succeeded but its reply was lost or late (busy hub)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1764
branch: t/T-2078-publishsessionevidence-reports
created: 2026-11-24T09:06:04.630Z
updated: 2026-11-25T05:42:47.743Z
closed: 2026-11-25T05:42:47.743Z
---

## Summary

On 2026-11-24 at about 09:05Z, two implementers' evidence publications failed with "Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying", from hub/src/evidence-publish.ts:123. In both cases `artifact.list` then showed the artifact had been created: A-22774 (impl-1945, T-1945) and A-22775 (impl-1953, T-1953). `artifactCreate` threw a non-HubRefusal error after the hub had already created the artifact, probably a reply timeout. At the time, hub #100 was at 30 to 140% CPU from T-2069's report-retry loop. The caller handled it safely by reconciling and not retrying, but every busy-hub publication costs a manual reconcile.

## What to build

When the outcome is unknown, reconcile automatically: look the artifact up by its retryKey, or by title and topic plus the snapshot's content hash, through `artifact.list`, and return the created artifact when it's found. Otherwise keep today's refusal. Find which error `artifactCreate` raised here, such as a timeout or a lost reply. If the cause is only T-2069's CPU loop, recheck after hub #101 is on T-2069 and close this with that evidence.

## Acceptance criteria

- [x] C1. When `artifact.create` succeeds but its reply is lost, publishSessionEvidence returns the created artifact after one reconcile lookup, and creates no duplicate (test with a fake transport).
  - done: impl-2078 · 2026-11-25T02:35:52.853Z
  - verified: rev-35 [reviewer] · run rev-35-2078-evidence-1 · 2026-11-25T04:19:10.637Z · commit fcb4544b639728b67dee084d026169301bce8b68
- [x] C2. When the artifact really doesn't exist after one reconcile lookup, publishSessionEvidence retries once with the same retained snapshot and key; if that retry's outcome is still unknown, it keeps the snapshot and returns the original "outcome unknown" refusal (test).
  - done: impl-2078 · 2026-11-25T02:35:53.192Z
  - verified: rev-35 [reviewer] · run rev-35-2078-evidence-1 · 2026-11-25T04:19:10.637Z · commit fcb4544b639728b67dee084d026169301bce8b68

## Comments

### coord · 2026-11-24T09:06:24.691Z

Third case: impl-2065 (T-2065), A-22777 at 09:06Z. Same "publication outcome unknown", and artifact.list confirmed the artifact. All three came within about one minute, while about ten implementers ran full test:lint and the hub was in T-2069's retry loop.

### coord · 2026-11-24T10:34:37.049Z

Fourth case, which differs from the first three: impl-2001 (T-2001) at about 10:33Z on hub #101. The same "publication outcome unknown" came back, but `artifact.list` showed no artifact was created: a true unknown, not a lost success. One retry from the retained snapshot, with a 30-second reply observation, succeeded as A-22829. So the reconcile design in C1 must handle both outcomes: a lost success, which returns the existing artifact, and a lost request, which is retried once.

### coord · 2026-11-25T01:56:26.115Z

Data point from impl-1970 (T-1970), 2026-11-25. Publishing evidence through publishSessionEvidence at 01:54:12Z returned "publication outcome unknown; snapshot retained; reconcile session artifacts before retrying". artifact.list for topic-1758 showed no new artifact then, and still none at about 01:56Z. A single retry with the retained snapshot bytes succeeded at 01:56:04Z as A-23122. So the first attempt really didn't publish, and the unknown outcome didn't hide a late success. The reconcile-then-retry-once sequence works but is manual today.

### impl-2078 · 2026-11-25T02:01:24.704Z

Consumer census (rg field/function/importer search across hub/src, shared, hub/test all tiers, nvim/test, .agents and docs): publishEvidence callers are evidence-publish.test.ts and publishSessionEvidence; installed locator .agents/skills/qa/publish-evidence.ts loads exports without changing its signature. Guides: qa/EVIDENCE.md, implement/SKILL.md, qa/SKILL.md, qa/BRIEF.md, docs/agents/evidence-publication.md, hub/README.md. artifact.list production readers are CLI artifact.ts, spoke/spoke.ts, hub/core.ts and nvim artifacts UI; stub-hub.ts and artifacts.test.ts cover legacy list pages. Existing artifact.list response and retryKey creation protocol remain unchanged; no client/schema/role/CLI-help migration. Regression uses previous {artifacts:[...]} shape. Native retryKey receipt in hub/artifacts.ts serializes identical actor/key/arguments; retained path is reused exactly. Original transport exception was sanitized and not persisted, so its historical concrete class cannot be recovered safely; shared transport can produce HubTimeout (default 3000ms), socket errors or closed-before-answer. Tests simulate non-refusal transport rejection and never query live hub storage.

### rev-35 · 2026-11-25T02:14:11.699Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2078-source-1
commit: cf2c9e4e92f3c8f4c08e762d7c01ca8048d8af76
scope: full
findings: [{"severity":"medium","text":"Metadata/bytes match does not bind an artifact to this admitted retryKey. An older identical row can falsely complete this attempt and delete its snapshot while its first create still copies it. No request-bound receipt or regression covers this path.","file":"hub/src/evidence-publish.ts","line":184}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23159: C2 retry-once wording approved and reviewed, but M1 blocks C1. Retain existing assertions, add old-identical-row/current-pending control, resolve request-bound recovery or safe retained refusal with Coordinator if capability/scope changes. No configured evidence yet. Hold positively released; fresh corrected committed source review required before verification.

Criteria: C1 failed (Reconciliation may return an older identical artifact and release this still-pending attempt's snapshot; request-bound identity/completion is missing.).

### rev-35 · 2026-11-25T02:28:10.028Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2078-source-2
commit: 9657626c60c8ddf2ba57ecf9f72649ab6d2fc5f4
scope: full
findings: [{"severity":"medium","text":"New held-replay proof releases its receipt only in its later finally; evidenceCase has no releaseOnClose enrollment. On observer expiry/TestContext abort while original continuation awaits a step, no independent owner releases the hold before joining proof/root cleanup.","file":"hub/test/evidence-publish.test.ts","line":96}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23171: Coordinator62019788 approves same-key/path replay without list lookup; durable SQLite receipt and restart control reviewed. Production M1 resolved. Remaining M2 is narrow fixture ownership; hold positively released for releaseOnClose correction/control. T-2095 remains explicitly unresolved per Coordinator; no configured run yet. Fresh corrected-head source review required.

Criteria: C1 failed (Production identity M1 resolved, but the new held-replay regression lacks independent cancellation release-before-join ownership; C1 control correction required.).

### rev-35 · 2026-11-25T02:38:37.600Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2078-source-3
commit: fcb4544b639728b67dee084d026169301bce8b68
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23190: original M1 and M2 resolved. Keyed replay production unchanged from9657626c6; receipt release enrolled before admission, actual cleanup owner drives cancellation and joins complete inner proof before root removal, independent fallback releases both holds. Coordinator62019788 scope and separate unresolved T-2095 disposition retained. C1/C2 runtime verification pending; no configured result yet. Source hold released; normal Coordinator window for one exact-head verify.

### rev-35 · 2026-11-25T04:19:10.637Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2078-evidence-1
commit: fcb4544b639728b67dee084d026169301bce8b68
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear: configured run 2cdba587-ca5b-4c23-be70-a720695cdc06 / A-23249 has durable result code0, empty cause, complete T0(two)/T1/T2/T3/Web receipts and zero unfinished entries. A-23251 records the independent paired audit: all nine new identities base plus 5/5 loaded, full helper30/30, producer4/4 and artifact persistence consumer18/18 including lost-reply restart. C1/C2 verified under Coordinator62019788's same-actor/key/path replay disposition and prior source clear A-23190. Paired inventory7627 base pass/1 macOS prerequisite skip plus45 loaded pass; three known F2 finish-only rows excluded from proof. T1 247/T2 448/selected T3 7/Web55 positive file passes; other267 T3 deferred and18 T4 unexecuted. Budget/lint findings report-only, cache unknown. Git source tree6472d02... and verification tree2474a85... are literal distinct identities at the same head. T-2095 remains unresolved; one green Linux dot-file observation does not erase its local failure history or claim a fix. No new findings, source changes or reruns requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T05:42:47.743Z

Merged 22ac59c0d4c8a92dec1d54a0c77729995bfb038d onto dev.
