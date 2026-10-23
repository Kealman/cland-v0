---
id: T-1164
kind: task
title: "web/README.md: add the thread r row and drop the remaining stand-in and snapshot-client sentences"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: topic-897
branch: t/T-1164-web-readme-md-add-the-thread-r-row-and
created: 2026-10-23T06:56:38.871Z
updated: 2026-10-23T07:39:18.335Z
closed: 2026-10-23T07:39:18.335Z
---

## Summary

E-417 stage-3 QA (qa-676, E417S3-11 at f2899a3e) found web/README.md still stale after the Inbox and composer landed: the thread key table (~209–220) omits `r` "Reply to Inbox sender", which keymap.ts declares and ~294 describes; ~661–662 says the snapshot client has not landed and calls the drawer and pane a stand-in; ~642 says other areas show ID/title, contradicted by the Inbox drawer; and ~53–54 overstates what remains a stand-in (~328–329 correctly narrows it to Events).

## What to build

web/README.md lists every thread and Inbox key the keymap declares, and describes only Events (until E-417 stage 4 lands it) as pending, with no stand-in or not-yet-landed wording for the Inbox, drawer, pane or snapshot client.

## Acceptance criteria

- [x] C1. web/README.md's thread key table lists `r` (Reply to Inbox sender) with its context, matching web/src/keymap.ts (docs).
  - done: impl-1164 · 2026-10-23T07:36:54.252Z
  - verified: rev-23 [reviewer] · run rev-20261023-1164-source · 2026-10-23T07:39:12.797Z · commit 1efbf76394ae803b225aac38b10bdb8fa6082abe
- [x] C2. web/README.md has no sentence calling the Inbox, drawer, pane or snapshot client a stand-in or not yet landed, and names Events as the only pending area until T-1127 lands (docs).
  - done: impl-1164 · 2026-10-23T07:36:54.343Z
  - verified: rev-23 [reviewer] · run rev-20261023-1164-source · 2026-10-23T07:39:12.797Z · commit 1efbf76394ae803b225aac38b10bdb8fa6082abe

## Comments

### impl-1164 · 2026-10-23T07:34:51.640Z

Read the item, full web/README.md and web/src/keymap.ts. Auditing every key table plus stale drawer/pane/snapshot wording; docs-only scope. The supplied root node_modules link is in place. Will run npm run check and request source review; no suite per launch instruction.

### impl-1164 · 2026-10-23T07:37:34.898Z

Implemented and pushed 1efbf76394ae803b225aac38b10bdb8fa6082abe (tree d13f7f4f31ff7f955cd9bf27862d6523c8d80bd1), web/README.md only. npm run check exited 0 at this head on local macOS: typechecks, web guards/build and static/test lint complete; test lint report-only 132 findings / 59 files, 0 refusals. git diff --check passed and tree clean. No suite or browser QA per docs-only launch instruction. C1/C2 done; requesting source review.

### rev-23 · 2026-10-23T07:39:12.797Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1164-source
commit: 1efbf76394ae803b225aac38b10bdb8fa6082abe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-9901 audits all key tables against keymap.ts plus focused handlers, confirms Inbox-thread r with ask/field exclusions and reply-vs-composer behavior, and restricts unlanded/stand-in wording to Events. Only web/README.md changed; diff check clean. C1/C2 fully established by source inspection; docs-only launch requires no suite or per-item QA. Reported same-head macOS check success is supplemental, not a separately audited raw receipt. Unchanged 60s-vs-180s Web hang-guard prose drift reported separately as XS Bugs.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-23T07:39:18.335Z

Merged e196c1ac9c429d9d4ae4ccb9b2e247396b9132d9 onto dev.
