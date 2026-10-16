---
id: T-572
kind: task
title: Demo droplets show no tags at release, so the hub refuses to delete a live untagged droplet
state: open
status: in progress
size: S
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
updated: 2026-10-16T05:02:49.530Z
---

## Summary
E-423 demo run qa-2026-10-16-27-17 at 3c596742, case D18 (A-3726), on the restarted hub pid 37109, which has T-553. At 05:00:24Z, `cland demo stop E-423` returned exit 0 with the lease in state releasing and "operator attention required; identity mismatch; deletion refused". Lease 375889a3 expected droplet 609583042 named cland-v0-375889a3 with tags [cland, cland-p-8a978a214ba5]. The provider showed the same name and status active, but tags []. Run 16's demo droplet (609578713) hit the same refusal under the old message at 04:35Z and was gone by 04:37Z, cause unknown. No code in hub/src/executor removes tags. So the demo droplets are either created without their tags or lose them, and either way a live cland droplet exists that tag-based reaping can't find and release refuses to delete. That breaks the standing constraint that every cland droplet carries a cland tag and guaranteed destruction. Task-run droplets created tonight do show their tags.

## Acceptance criteria
- [ ] C1. Find where a demo droplet's tags go missing (the demo create request, the snapshot or create path, or provider eventual consistency on read) and record the cause with provider request evidence on this item.
- [ ] C2. Every demo droplet carries both cland tags from creation, and a test with the fake provider fails if the demo create path omits them.
- [ ] C3. A droplet whose name and id match its lease but whose tags read empty is still destroyed, or retried until destroyed, with the mismatch logged. A droplet whose name or id differs is still refused.

## Comments

### coord · 2026-10-16T05:01:52.096Z

Stand-in check at 05:03Z: droplet 609583042 returns 404 from DigitalOcean. The account holds only n8n plus the four task droplets, each with both cland tags, so no live untagged droplet is left and the constraint held. The lease record 375889a3 still reads "releasing, watchdog alive, operator attention", a record-only leftover. The likely reading, also logged on T-553: the identity check caught the droplet mid-teardown at the provider, with tags already stripped and status still "active", perhaps because the watchdog or an earlier delete had started it, and called that a mismatch. Run 16 matches: refused at 04:35Z, 404 by 04:37Z. So C1 should first test the provider's teardown state before suspecting the create path. C3's direction: on a tags-only mismatch where id and name match, re-read after a short delay, treat a 404 as released, and clear the lease's attention state.
