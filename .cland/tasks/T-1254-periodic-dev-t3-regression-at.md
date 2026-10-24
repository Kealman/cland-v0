---
id: T-1254
kind: task
title: Periodic dev T3 regression at 75951a7d8a1f669d41568d9698c15acd5635ace0
state: closed
status: done
size: M
labels:
  - dev-t3-75951a7d8a1f669d41568d9698c15acd5635ace0
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-360
found_by: droplet
topic: null
branch: null
created: 2026-10-24T16:49:49.099Z
updated: 2026-10-24T16:49:57.572Z
closed: 2026-10-24T16:49:57.572Z
---

## Summary

Landed merge 75951a7d8a1f669d41568d9698c15acd5635ace0 first fails hub/test/account-limited.test.ts, hub/test/rule-sessions.test.ts, hub/test/session-native-lifecycle.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run 07aadba8-a273-46ed-8e96-962e7f1db881; red head c44650a624b4eb1dca40a96c5bfc0c2e0bdff9f3; tree b3526d2e23e5fd9473ad0aa0ddd3bf2890a129dc
Last green run 41de302e-c97d-440e-b5e2-6baa0ebfe89d; head 89e5c304bef194c07caff3e41a82d0e62a2e2902
Original log A-11254: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11254-suite-07aadba8-a273-46ed-8e96-962e7f1db881-all-at-c44650a.log
hub/test/account-limited.test.ts: culprit at 75951a7d8a1f669d41568d9698c15acd5635ace0 Codex fake harness replies to the first channel block of a digest instead of the message addressed to it (T-360)
Run 2ddaa22f-da58-4cb9-8191-867ac7ac823e; head c44650a624b4eb1dca40a96c5bfc0c2e0bdff9f3; red; log A-11256: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11256-suite-2ddaa22f-da58-4cb9-8191-867ac7ac823e-all-at-c44650a.log
Run 58ff7a1a-9231-4977-b6e9-ebd7a4b8e1a3; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11258: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11258-suite-58ff7a1a-9231-4977-b6e9-ebd7a4b8e1a3-all-at-89e5c30.log
Run be894b1e-862c-45a8-9594-4e94dd0f6a0d; head 1ac99cb6a8356d1ae30d2fc5746045b57f57c92e; green; log A-11259: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11259-suite-be894b1e-862c-45a8-9594-4e94dd0f6a0d-all-at-1ac99cb.log
Run 4be6ebd1-b993-4345-937b-75975ed8f275; head 453db9811b529965e832a3d4b9a2aba9128fa133; green; log A-11260: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11260-suite-4be6ebd1-b993-4345-937b-75975ed8f275-all-at-453db98.log
Run 3e810d6d-6362-44ce-9af3-8d5c12b405da; head e053338bac873b11434b8fdc61a2a86516a63bd7; red; log A-11261: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11261-suite-3e810d6d-6362-44ce-9af3-8d5c12b405da-all-at-e053338.log
Run 58d3300d-701c-48a4-aa71-86b0bcddf4a7; head 16a7bbe526dc989c701b4bf20cc1676763fdea2a; green; log A-11262: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11262-suite-58d3300d-701c-48a4-aa71-86b0bcddf4a7-all-at-16a7bbe.log
Run 8a6ceb87-5cac-4c8e-996b-da66fec6a9a3; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; red; log A-11263: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11263-suite-8a6ceb87-5cac-4c8e-996b-da66fec6a9a3-all-at-a20ebd8.log
Run 6667bce9-ac49-451b-9cf0-b169ca39de33; head 75951a7d8a1f669d41568d9698c15acd5635ace0; red; log A-11266: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11266-suite-6667bce9-ac49-451b-9cf0-b169ca39de33-all-at-75951a7.log
hub/test/rule-sessions.test.ts: culprit at 75951a7d8a1f669d41568d9698c15acd5635ace0 Codex fake harness replies to the first channel block of a digest instead of the message addressed to it (T-360)
Run d5897435-973c-4671-855b-4253c9e0869c; head c44650a624b4eb1dca40a96c5bfc0c2e0bdff9f3; red; log A-11268: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11268-suite-d5897435-973c-4671-855b-4253c9e0869c-all-at-c44650a.log
Run 48528e0b-99af-4e9a-8fe2-9ece45a29fc3; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11269: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11269-suite-48528e0b-99af-4e9a-8fe2-9ece45a29fc3-all-at-89e5c30.log
Run aac86449-28c0-4f00-b0dd-abc095917480; head 1ac99cb6a8356d1ae30d2fc5746045b57f57c92e; green; log A-11272: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11272-suite-aac86449-28c0-4f00-b0dd-abc095917480-all-at-1ac99cb.log
Run 20344d77-d38b-47ea-ad8f-01bec8144200; head 453db9811b529965e832a3d4b9a2aba9128fa133; green; log A-11273: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11273-suite-20344d77-d38b-47ea-ad8f-01bec8144200-all-at-453db98.log
Run bad8e37f-34fa-4f97-9066-5e2a2ad014ce; head e053338bac873b11434b8fdc61a2a86516a63bd7; red; log A-11274: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11274-suite-bad8e37f-34fa-4f97-9066-5e2a2ad014ce-all-at-e053338.log
Run 24a1d38e-5a9a-4c92-b487-02ea8305fde1; head 16a7bbe526dc989c701b4bf20cc1676763fdea2a; green; log A-11275: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11275-suite-24a1d38e-5a9a-4c92-b487-02ea8305fde1-all-at-16a7bbe.log
Run 158d0827-0d5b-42c2-968f-6a20b0b337c8; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; red; log A-11276: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11276-suite-158d0827-0d5b-42c2-968f-6a20b0b337c8-all-at-a20ebd8.log
Run ddaf8f62-6cd9-4e8e-a2d7-149f1fc98875; head 75951a7d8a1f669d41568d9698c15acd5635ace0; red; log A-11277: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11277-suite-ddaf8f62-6cd9-4e8e-a2d7-149f1fc98875-all-at-75951a7.log
hub/test/session-native-lifecycle.test.ts: culprit at 75951a7d8a1f669d41568d9698c15acd5635ace0 Codex fake harness replies to the first channel block of a digest instead of the message addressed to it (T-360)
Run 7d73b8fa-41b2-4c0b-9a91-8ec32092cec9; head c44650a624b4eb1dca40a96c5bfc0c2e0bdff9f3; red; log A-11278: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11278-suite-7d73b8fa-41b2-4c0b-9a91-8ec32092cec9-all-at-c44650a.log
Run 6f80e60b-c334-4da3-a061-49e979eb3b11; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11279: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11279-suite-6f80e60b-c334-4da3-a061-49e979eb3b11-all-at-89e5c30.log
Run ec08e8fa-d419-43cf-89f8-942ca86d4377; head 1ac99cb6a8356d1ae30d2fc5746045b57f57c92e; green; log A-11280: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11280-suite-ec08e8fa-d419-43cf-89f8-942ca86d4377-all-at-1ac99cb.log
Run fd20f743-6298-4810-8d0c-a396a82a4ef4; head 453db9811b529965e832a3d4b9a2aba9128fa133; green; log A-11281: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11281-suite-fd20f743-6298-4810-8d0c-a396a82a4ef4-all-at-453db98.log
Run 1c0d025d-4429-425f-a6b9-d4cbc770accb; head e053338bac873b11434b8fdc61a2a86516a63bd7; red; log A-11282: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11282-suite-1c0d025d-4429-425f-a6b9-d4cbc770accb-all-at-e053338.log
Run 8f40d786-11f3-4111-84bd-05bafbbc0020; head 16a7bbe526dc989c701b4bf20cc1676763fdea2a; green; log A-11283: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11283-suite-8f40d786-11f3-4111-84bd-05bafbbc0020-all-at-16a7bbe.log
Run 45f4d14a-6d1d-4a66-b0e7-e82da5985382; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; red; log A-11284: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11284-suite-45f4d14a-6d1d-4a66-b0e7-e82da5985382-all-at-a20ebd8.log
Run 4e308859-280d-4182-89ce-aaa4b431deab; head 75951a7d8a1f669d41568d9698c15acd5635ace0; red; log A-11285: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11285-suite-4e308859-280d-4182-89ce-aaa4b431deab-all-at-75951a7.log

## Comments

### coord · 2026-10-24T16:49:57.463Z

Already fixed on dev: T-1253 (landed 6950fd2f) fixes the Codex fake's launch-brief handling and moves rule-sessions and session-native-lifecycle onto T-360's contract. The search confirms culprit 75951a7d (T-360) for all three files, matching coord's local bisect. Closing as a duplicate of T-1253; T-1244 tracks the search filing bugs for regressions dev already fixed.

### coord · 2026-10-24T16:49:57.572Z

Duplicate of T-1253 (landed 6950fd2f).
