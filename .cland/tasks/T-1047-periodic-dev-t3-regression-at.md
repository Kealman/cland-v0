---
id: T-1047
kind: task
title: Periodic dev T3 regression at ff0f6c7fceb4e8f20abbb616b759a5d1f4c73da5
state: closed
status: done
size: M
labels:
  - dev-t3-ff0f6c7fceb4e8f20abbb616b759a5d1f4c73da5
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-988
found_by: droplet
topic: null
branch: null
created: 2026-10-21T12:02:52.329Z
updated: 2026-10-21T12:03:00.439Z
closed: 2026-10-21T12:03:00.439Z
---

## Summary

Landed merge ff0f6c7fceb4e8f20abbb616b759a5d1f4c73da5 first fails hub/test/cli-imports.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run c2965396-c4a7-45db-9252-20ad3fa92613; red head b970270a5f799b3f9ea5b16917f42fff3cf819e9; tree 93719948f2aa7a30568592711b04f0d1cced76ea
Last green run c7c00b48-b4fc-4c14-9306-dca487963eec; head 479178b25c78ccbb54f908ef7cc7c05c18426cd0
Original log A-8338: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8338-suite-c2965396-c4a7-45db-9252-20ad3fa92613-all-at-b970270.log
hub/test/cli-imports.test.ts: culprit at ff0f6c7fceb4e8f20abbb616b759a5d1f4c73da5 The network, the tunnel and the phone's link (T-988)
Run 583b1464-30b2-49df-bd4b-9219df0f8d58; head b970270a5f799b3f9ea5b16917f42fff3cf819e9; red; log A-8339: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8339-suite-583b1464-30b2-49df-bd4b-9219df0f8d58-all-at-b970270.log
Run 3f1c4742-dd4f-4a33-ab78-5dd4d7015cb5; head 479178b25c78ccbb54f908ef7cc7c05c18426cd0; green; log A-8348: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8348-suite-3f1c4742-dd4f-4a33-ab78-5dd4d7015cb5-all-at-479178b.log
Run 23847422-f7b7-4f49-b627-d4b8d118e086; head 990153208f59caca9e3349e3ee34c21a9baed018; green; log A-8353: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8353-suite-23847422-f7b7-4f49-b627-d4b8d118e086-all-at-9901532.log
Run a65133cd-677b-45e7-91d1-1355411cd38a; head ff0f6c7fceb4e8f20abbb616b759a5d1f4c73da5; red; log A-8356: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8356-suite-a65133cd-677b-45e7-91d1-1355411cd38a-all-at-ff0f6c7.log
Run eda6d792-d97d-45b0-8c06-d3ad8c8e320e; head 102d592dadffabda064f3af376ed7cd9739acb36; green; log A-8357: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8357-suite-eda6d792-d97d-45b0-8c06-d3ad8c8e320e-all-at-102d592.log
Run 05ede494-187a-4ff8-9a2e-67b4d6f26dc1; head aeae1f25cca0c0e9d99d0575b339e06856d0ef58; green; log A-8362: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8362-suite-05ede494-187a-4ff8-9a2e-67b4d6f26dc1-all-at-aeae1f2.log
hub/test/session-events.test.ts: culprit at aeae1f25cca0c0e9d99d0575b339e06856d0ef58 Numbered deltas from one emit point (T-985)
Run 7e4c4001-5e73-47e2-9ff8-5ef103e0af56; head b970270a5f799b3f9ea5b16917f42fff3cf819e9; red; log A-8364: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8364-suite-7e4c4001-5e73-47e2-9ff8-5ef103e0af56-all-at-b970270.log
Run b8670224-2ab9-4e51-9f71-668feaefed56; head 479178b25c78ccbb54f908ef7cc7c05c18426cd0; green; log A-8371: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8371-suite-b8670224-2ab9-4e51-9f71-668feaefed56-all-at-479178b.log
Run 8496dd6b-37ec-4fc5-9f5e-8aa2f8fdf136; head 990153208f59caca9e3349e3ee34c21a9baed018; green; log A-8372: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8372-suite-8496dd6b-37ec-4fc5-9f5e-8aa2f8fdf136-all-at-9901532.log
Run 37bc84cc-c0f8-45f2-bb7e-181472fef18a; head ff0f6c7fceb4e8f20abbb616b759a5d1f4c73da5; red; log A-8373: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8373-suite-37bc84cc-c0f8-45f2-bb7e-181472fef18a-all-at-ff0f6c7.log
Run 823b2414-a0b7-4200-9ccc-4afd829dd87d; head 102d592dadffabda064f3af376ed7cd9739acb36; green; log A-8374: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8374-suite-823b2414-a0b7-4200-9ccc-4afd829dd87d-all-at-102d592.log
Run 0e682d61-cacc-4d75-8198-74c3aefc3c3d; head aeae1f25cca0c0e9d99d0575b339e06856d0ef58; red; log A-8375: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8375-suite-0e682d61-cacc-4d75-8198-74c3aefc3c3d-all-at-aeae1f2.log

## Comments

### coord · 2026-10-21T12:03:00.439Z

Duplicate of T-1045 (cland hub loads web-address.ts and exceeds its CLI import budget, regression of T-988). It was filed at 11:33Z from the same run, c2965396 (A-8338), and fixed and landed at 5dac5788. The hub's search confirms the same culprit, ff0f6c7f (T-988). The next periodic dev T3 confirms the fix.
