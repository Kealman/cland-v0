---
id: T-932
kind: task
title: Lease stays 'releasing' when DigitalOcean returns a destroying droplet with empty tags (identity guard refuses; demo lease 3781f5d9)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-689
branch: t/T-932-lease-stays-releasing-when-digitalocean
created: 2026-10-20T03:00:27.589Z
updated: 2026-10-20T05:26:47.289Z
closed: 2026-10-20T05:26:47.289Z
---

## Summary

E-424's demo lease 3781f5d9 (droplet cland-v0-3781f5d9, id 610730338) was asked to stop at about 02:56Z on 2026-10-20. hub.log shows three `executor-release-identity-recheck` events at 02:56:49–54Z: DigitalOcean returned the droplet with matching id and name but `tags: []` instead of `["cland","cland-p-8a978a214ba5"]`. Then came `executor-release-unconfirmed` at 02:57:01Z: the T-462 identity guard refused to confirm it. DigitalOcean listed no cland droplet at 02:59Z, so the droplet was destroyed anyway, but the hub's lease row stayed "releasing" until its 03:50Z deadline. That holds a remote slot and its reserved spend.

## What to build

While a release is in progress, treat matching id and name with an empty tags array as a droplet being destroyed (DigitalOcean drops tags during destroy). Confirm release when a later list or get shows the id gone. Keep the guard strict for any non-empty, mismatched tag set.

## Acceptance criteria

- [x] C1. A fake-provider T2 test: during release, a get with empty tags followed by a 404 confirms release and frees the slot and the reservation; a get with foreign tags still refuses.
  - done: impl-932 · 2026-10-20T05:11:46.383Z
  - verified: rev-31 [reviewer] · run rev-20261020-932-source · 2026-10-20T05:13:03.864Z · commit f6ab011c9cc7ce6dc9381f89a34607ba5bbd42f8
  - verified: rev-31 [reviewer] · run rev-20261020-932-final · 2026-10-20T05:21:46.706Z · commit f6ab011c9cc7ce6dc9381f89a34607ba5bbd42f8
- [x] C2. A mode-free verify at the reviewed head is green.
  - done: impl-932 · 2026-10-20T05:20:35.778Z
  - verified: rev-31 [reviewer] · run rev-20261020-932-final · 2026-10-20T05:21:46.706Z · commit f6ab011c9cc7ce6dc9381f89a34607ba5bbd42f8

## Comments

### coord · 2026-10-20T03:50:24.065Z

Second occurrence 2026-10-20 03:43Z: E-424 demo lease 0144bd56. Three executor-release-identity-recheck events at 03:43:51–55Z with tags [], then executor-release-retry and executor-release-unconfirmed at 03:44:00Z ('DigitalOcean 0 deadline: request deadline reached'). The droplet was gone on DigitalOcean at 03:50Z (stand-in check), and the hub row stayed 'releasing'. It blocks QA verdicts that wait for a destruction receipt.

### coord · 2026-10-20T03:59:53.685Z

Second occurrence, observed by the stand-in. Lease 0144bd56 released itself at 03:51:05Z, about 7 min after the unconfirmed-destroy event. Lifetime was 27 min 42 s and it cost $0.115. The earlier case, 3781f5d9, also released on the hub's own retry within 6–7 min. Neither left a leaked droplet. The practical cost is a wait of about 7 min on the demo verdict or lease slot. Severity stays S. It is a known issue for the v0.1.4 release notes, not a blocker.

### coord · 2026-10-20T05:08:59.953Z

Third occurrence: E-482's demo lease a606ddb6 was stopped at about 05:06:37Z and was still "releasing" at 05:08:41Z, past its 05:08:33Z deadline. It's expected to clear on the hub's retry like the first two. It held the E-482 QA verdict for a few minutes, so the cost is now three waits in one demo round.

### impl-932 · 2026-10-20T05:11:12.374Z

Reproduced the two-second empty-tag refusal with an in-process fake-provider T2 regression. Cleanup now treats matching id/name plus empty tags as observation-only while releasing and continues bounded attempts until the id returns 404. Added strict non-empty foreign-tag refusal even after accepted DELETE; watchdog marks its local cleanup attempt releasing. Component coverage checks reservation settlement and actual single-slot reuse. Typecheck passed; completing targeted checks before source review.

### rev-31 · 2026-10-20T05:13:03.864Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-932-source
commit: f6ab011c9cc7ce6dc9381f89a34607ba5bbd42f8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; A-7062 records Standards/Spec review. Empty tags with matching id/name permit observation while releasing but never grant DELETE authority; non-empty mismatched tags refuse before and after accepted DELETE. A-7060 retains 8/8 fake-provider release tests and prepare-retry 1/1, including >2-second virtual deletion, reservation settlement and actual remote_budget=1 reuse. C1 verified; C2 awaits configured mode-free verify at this exact unchanged head.

Criteria: C1 verified.

### rev-31 · 2026-10-20T05:21:46.706Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-932-final
commit: f6ab011c9cc7ce6dc9381f89a34607ba5bbd42f8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-7087 audits complete A-7082 / 74dec684 at unchanged reviewed head. 1920 ordinary plus five distinct new-case repetitions all pass; explicit slow-deletion 5/5 line 44009, maximum 0.547050734 s. All eight release cases pass, host check/all T1/fallback all T2 green, no tier mismatch or hard budget failure. C1/C2 verified and claimant done. No merge action.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T05:26:47.289Z

Merged 0327b2ef9d0d8ba65ca9124d12b445c5f5900200 onto dev.
