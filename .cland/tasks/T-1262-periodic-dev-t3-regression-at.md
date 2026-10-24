---
id: T-1262
kind: task
title: Periodic dev T3 regression at fffc70b8c61f5d3755eee6d128334752d72d9b8c
state: closed
status: done
size: M
labels:
  - dev-t3-fffc70b8c61f5d3755eee6d128334752d72d9b8c
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1220
found_by: droplet
topic: null
branch: null
created: 2026-10-24T20:36:21.596Z
updated: 2026-10-24T21:13:42.112Z
closed: 2026-10-24T20:36:30.567Z
---

## Summary

Landed merge fffc70b8c61f5d3755eee6d128334752d72d9b8c first fails hub/test/adapter-native-boundary.test.ts, hub/test/merge-gate.test.ts, hub/test/request-guard.test.ts, hub/test/scenarios/stage-close.test.ts, hub/test/subscription-frame.test.ts, hub/test/suite-human.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run 5564ec58-4f94-42b1-9c73-9a8be40a0681; red head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; tree 9db57ffe14959af61713d110b1b4f829164a55d5
Last green run 41de302e-c97d-440e-b5e2-6baa0ebfe89d; head 89e5c304bef194c07caff3e41a82d0e62a2e2902
Original log A-11297: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11297-suite-5564ec58-4f94-42b1-9c73-9a8be40a0681-all-at-da2d0e6.log
hub/test/adapter-native-boundary.test.ts: culprit at fffc70b8c61f5d3755eee6d128334752d72d9b8c A session's shell identity is not bound to a per-session credential (T-1220)
Run f4b9bfe0-c42f-43b4-8434-1063db7a4fae; head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; red; log A-11298: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11298-suite-f4b9bfe0-c42f-43b4-8434-1063db7a4fae-all-at-da2d0e6.log
Run 1303a445-06b6-4be9-b59e-4ba0ced626cf; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11299: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11299-suite-1303a445-06b6-4be9-b59e-4ba0ced626cf-all-at-89e5c30.log
Run 96d6b87a-9a75-4756-b958-5a658eaad129; head ad611df95d015191b8b8af11fd7aa81bcd599b6d; green; log A-11300: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11300-suite-96d6b87a-9a75-4756-b958-5a658eaad129-all-at-ad611df.log
Run 78e11642-e067-4372-958d-afcc8e57b36d; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; green; log A-11301: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11301-suite-78e11642-e067-4372-958d-afcc8e57b36d-all-at-a20ebd8.log
Run 42b6537c-727e-46b0-ba00-906906eb4ebe; head 749b13d2c803d31866e6e72a3008de38d38c47ed; green; log A-11302: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11302-suite-42b6537c-727e-46b0-ba00-906906eb4ebe-all-at-749b13d.log
Run 990aa315-d305-406c-acea-5550ae7fc31b; head 1f98589ebb23983297f6b412afc1295757792c78; green; log A-11303: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11303-suite-990aa315-d305-406c-acea-5550ae7fc31b-all-at-1f98589.log
Run e0f818c3-1e08-4a14-8bb2-47b3b793e771; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11304: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11304-suite-e0f818c3-1e08-4a14-8bb2-47b3b793e771-all-at-6950fd2.log
Run d06b9448-4748-4dfd-b7d7-695672d53af9; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11306: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11306-suite-d06b9448-4748-4dfd-b7d7-695672d53af9-all-at-fffc70b.log
Run 38c20225-6fb4-41dd-94c8-6c753fce4c15; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11307: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11307-suite-38c20225-6fb4-41dd-94c8-6c753fce4c15-all-at-6950fd2.log
Run ea5f8556-3fdd-4771-a42e-210e1e4a91ed; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11312: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11312-suite-ea5f8556-3fdd-4771-a42e-210e1e4a91ed-all-at-fffc70b.log
hub/test/merge-gate.test.ts: culprit at fffc70b8c61f5d3755eee6d128334752d72d9b8c A session's shell identity is not bound to a per-session credential (T-1220)
Run 20b500af-8580-45e3-a2b6-217e7e9dd579; head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; red; log A-11314: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11314-suite-20b500af-8580-45e3-a2b6-217e7e9dd579-all-at-da2d0e6.log
Run 253aa910-4cec-4777-9b24-f64a74d95daf; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11315: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11315-suite-253aa910-4cec-4777-9b24-f64a74d95daf-all-at-89e5c30.log
Run 1eeb79f6-cbe1-43a3-91fc-cefd0ac85340; head ad611df95d015191b8b8af11fd7aa81bcd599b6d; green; log A-11316: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11316-suite-1eeb79f6-cbe1-43a3-91fc-cefd0ac85340-all-at-ad611df.log
Run 618ccc38-31d7-4bde-8a60-2c417cf596e4; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; green; log A-11317: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11317-suite-618ccc38-31d7-4bde-8a60-2c417cf596e4-all-at-a20ebd8.log
Run 9f4aaf5d-c64a-459c-a63a-45472f75cde6; head 749b13d2c803d31866e6e72a3008de38d38c47ed; green; log A-11318: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11318-suite-9f4aaf5d-c64a-459c-a63a-45472f75cde6-all-at-749b13d.log
Run 23af7159-a789-4031-8e84-78f3d9323029; head 1f98589ebb23983297f6b412afc1295757792c78; green; log A-11319: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11319-suite-23af7159-a789-4031-8e84-78f3d9323029-all-at-1f98589.log
Run 74d896ee-f10a-4bc5-b5cf-8094ca178c0a; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11320: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11320-suite-74d896ee-f10a-4bc5-b5cf-8094ca178c0a-all-at-6950fd2.log
Run 924abde9-0810-4e7d-b274-f66311345003; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11321: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11321-suite-924abde9-0810-4e7d-b274-f66311345003-all-at-fffc70b.log
Run 334ba3ab-bd3b-4140-a120-fdee2df6d182; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11322: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11322-suite-334ba3ab-bd3b-4140-a120-fdee2df6d182-all-at-6950fd2.log
Run 0e9aa4ad-aec2-45ef-b29a-70aafac079e0; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11323: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11323-suite-0e9aa4ad-aec2-45ef-b29a-70aafac079e0-all-at-fffc70b.log
hub/test/request-guard.test.ts: culprit at fffc70b8c61f5d3755eee6d128334752d72d9b8c A session's shell identity is not bound to a per-session credential (T-1220)
Run fa364568-be9f-46d5-956e-9dffa66b4372; head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; red; log A-11324: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11324-suite-fa364568-be9f-46d5-956e-9dffa66b4372-all-at-da2d0e6.log
Run 650ec0b1-1448-490c-8603-aba92887f7ed; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11325: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11325-suite-650ec0b1-1448-490c-8603-aba92887f7ed-all-at-89e5c30.log
Run 45c4a0ee-8fb1-4956-82a2-16eff91b2455; head ad611df95d015191b8b8af11fd7aa81bcd599b6d; green; log A-11326: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11326-suite-45c4a0ee-8fb1-4956-82a2-16eff91b2455-all-at-ad611df.log
Run 775190f3-d1ac-400f-8ce4-5f35b3e822b7; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; green; log A-11327: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11327-suite-775190f3-d1ac-400f-8ce4-5f35b3e822b7-all-at-a20ebd8.log
Run 89cdb527-ed86-4f2e-a493-e0f4d71f2e33; head 749b13d2c803d31866e6e72a3008de38d38c47ed; green; log A-11328: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11328-suite-89cdb527-ed86-4f2e-a493-e0f4d71f2e33-all-at-749b13d.log
Run 342a2814-0957-4638-b529-b31c83dc0df9; head 1f98589ebb23983297f6b412afc1295757792c78; green; log A-11330: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11330-suite-342a2814-0957-4638-b529-b31c83dc0df9-all-at-1f98589.log
Run 3ee93ba9-09c1-4449-b94a-fc14b8766af2; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11332: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11332-suite-3ee93ba9-09c1-4449-b94a-fc14b8766af2-all-at-6950fd2.log
Run 6fb1b527-22c9-4023-8aef-83881ccb291c; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11333: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11333-suite-6fb1b527-22c9-4023-8aef-83881ccb291c-all-at-fffc70b.log
Run 673b85fc-5f9d-4dfb-aa41-f5704b2d34de; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11335: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11335-suite-673b85fc-5f9d-4dfb-aa41-f5704b2d34de-all-at-6950fd2.log
Run 89ebbe09-8149-48c4-a549-4d00c0ecf66d; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11337: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11337-suite-89ebbe09-8149-48c4-a549-4d00c0ecf66d-all-at-fffc70b.log
hub/test/scenarios/hook-bridge.test.ts: flake
Run 674fcc32-eda0-44a7-9b1c-bbf22da40db4; head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; green; log A-11340: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11340-suite-674fcc32-eda0-44a7-9b1c-bbf22da40db4-all-at-da2d0e6.log
hub/test/scenarios/stage-close.test.ts: culprit at fffc70b8c61f5d3755eee6d128334752d72d9b8c A session's shell identity is not bound to a per-session credential (T-1220)
Run 7774c06d-618a-4c00-8f2b-5bc11582ea05; head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; red; log A-11342: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11342-suite-7774c06d-618a-4c00-8f2b-5bc11582ea05-all-at-da2d0e6.log
Run 26cc95a9-1f86-4e7a-b0a0-af00f945b835; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11343: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11343-suite-26cc95a9-1f86-4e7a-b0a0-af00f945b835-all-at-89e5c30.log
Run 79920a39-5df7-4e5b-aac0-5e7079f694e4; head ad611df95d015191b8b8af11fd7aa81bcd599b6d; green; log A-11344: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11344-suite-79920a39-5df7-4e5b-aac0-5e7079f694e4-all-at-ad611df.log
Run 758acdf1-d261-404a-93b3-2dd2e18f82a7; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; green; log A-11346: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11346-suite-758acdf1-d261-404a-93b3-2dd2e18f82a7-all-at-a20ebd8.log
Run f81706db-c3b6-411d-8e85-743c03488b1b; head 749b13d2c803d31866e6e72a3008de38d38c47ed; green; log A-11349: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11349-suite-f81706db-c3b6-411d-8e85-743c03488b1b-all-at-749b13d.log
Run ce6ee33d-6e4a-4d1f-bbe8-d889a4fc605f; head 1f98589ebb23983297f6b412afc1295757792c78; green; log A-11351: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11351-suite-ce6ee33d-6e4a-4d1f-bbe8-d889a4fc605f-all-at-1f98589.log
Run e87d4b26-a27b-4efa-a705-acc18174bc9f; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11354: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11354-suite-e87d4b26-a27b-4efa-a705-acc18174bc9f-all-at-6950fd2.log
Run e5a57964-0c91-4727-80a0-c9cf97218dff; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11358: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11358-suite-e5a57964-0c91-4727-80a0-c9cf97218dff-all-at-fffc70b.log
Run 66c97506-edd1-4550-9c6a-a85df179d387; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11359: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11359-suite-66c97506-edd1-4550-9c6a-a85df179d387-all-at-6950fd2.log
Run 550ac3d3-67c5-4161-b8ed-402cd1537e45; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11360: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11360-suite-550ac3d3-67c5-4161-b8ed-402cd1537e45-all-at-fffc70b.log
hub/test/subscription-frame.test.ts: culprit at fffc70b8c61f5d3755eee6d128334752d72d9b8c A session's shell identity is not bound to a per-session credential (T-1220)
Run 8f596777-30fd-4a75-bcdd-806e63f57470; head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; red; log A-11362: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11362-suite-8f596777-30fd-4a75-bcdd-806e63f57470-all-at-da2d0e6.log
Run 9620a83e-5f3e-4dac-b390-ce94935111fa; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11363: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11363-suite-9620a83e-5f3e-4dac-b390-ce94935111fa-all-at-89e5c30.log
Run abd86535-1209-48f3-aad9-ac9a9940c3bd; head ad611df95d015191b8b8af11fd7aa81bcd599b6d; green; log A-11365: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11365-suite-abd86535-1209-48f3-aad9-ac9a9940c3bd-all-at-ad611df.log
Run 3effcf62-2cc1-4df2-9e04-6f9bdd6b1da4; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; green; log A-11366: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11366-suite-3effcf62-2cc1-4df2-9e04-6f9bdd6b1da4-all-at-a20ebd8.log
Run 3edae1ea-a3e0-4432-b1c1-fdfc7146a35d; head 749b13d2c803d31866e6e72a3008de38d38c47ed; green; log A-11368: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11368-suite-3edae1ea-a3e0-4432-b1c1-fdfc7146a35d-all-at-749b13d.log
Run dfd78fbf-5c1e-4c11-aa90-b0b7983e182e; head 1f98589ebb23983297f6b412afc1295757792c78; green; log A-11369: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11369-suite-dfd78fbf-5c1e-4c11-aa90-b0b7983e182e-all-at-1f98589.log
Run d157ee01-5a10-40c2-bac0-128df063f035; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11374: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11374-suite-d157ee01-5a10-40c2-bac0-128df063f035-all-at-6950fd2.log
Run f2bc8897-028d-4204-94b0-c055d9f5ff66; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11376: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11376-suite-f2bc8897-028d-4204-94b0-c055d9f5ff66-all-at-fffc70b.log
Run 147e602d-c4ed-494b-8a92-9bd79cf24707; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11378: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11378-suite-147e602d-c4ed-494b-8a92-9bd79cf24707-all-at-6950fd2.log
Run 3587dda6-49f6-4ce5-ac5a-84945f484667; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11379: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11379-suite-3587dda6-49f6-4ce5-ac5a-84945f484667-all-at-fffc70b.log
hub/test/suite-human.test.ts: culprit at fffc70b8c61f5d3755eee6d128334752d72d9b8c A session's shell identity is not bound to a per-session credential (T-1220)
Run 1d147694-55b6-4724-8de9-81d8b6d72b7d; head da2d0e6f99846275009024eaa2b0cc3c2a82ff02; red; log A-11380: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11380-suite-1d147694-55b6-4724-8de9-81d8b6d72b7d-all-at-da2d0e6.log
Run 70c36216-ff9e-4a6c-b275-aa5b5e05ed2a; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11381: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11381-suite-70c36216-ff9e-4a6c-b275-aa5b5e05ed2a-all-at-89e5c30.log
Run 127451e0-fc83-41a1-8d12-34595c873e71; head ad611df95d015191b8b8af11fd7aa81bcd599b6d; green; log A-11382: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11382-suite-127451e0-fc83-41a1-8d12-34595c873e71-all-at-ad611df.log
Run d85b42c2-86aa-478d-9641-66a8ef78bf78; head a20ebd82a4dcb74bc9a03ab337133d4b7f496ee5; green; log A-11385: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11385-suite-d85b42c2-86aa-478d-9641-66a8ef78bf78-all-at-a20ebd8.log
Run cf430feb-ca07-4cea-bb12-3c6d2393ef45; head 749b13d2c803d31866e6e72a3008de38d38c47ed; green; log A-11386: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11386-suite-cf430feb-ca07-4cea-bb12-3c6d2393ef45-all-at-749b13d.log
Run 41df92d5-08eb-42ae-845e-334b20f64104; head 1f98589ebb23983297f6b412afc1295757792c78; green; log A-11387: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11387-suite-41df92d5-08eb-42ae-845e-334b20f64104-all-at-1f98589.log
Run 81e9bbb9-03dc-48c3-b6ae-1c07257ee453; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11391: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11391-suite-81e9bbb9-03dc-48c3-b6ae-1c07257ee453-all-at-6950fd2.log
Run c4a1e04d-ac67-4100-993e-de0e4d7c80cc; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11392: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11392-suite-c4a1e04d-ac67-4100-993e-de0e4d7c80cc-all-at-fffc70b.log
Run ea583bbc-44af-4dda-b197-ab8e246178b5; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11395: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11395-suite-ea583bbc-44af-4dda-b197-ab8e246178b5-all-at-6950fd2.log
Run e3b134f2-2844-4dd8-b4d4-cf1e3e5ca864; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11396: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11396-suite-e3b134f2-2844-4dd8-b4d4-cf1e3e5ca864-all-at-fffc70b.log

## Comments

### coord · 2026-10-24T20:36:30.434Z

Already fixed on dev: T-1255 (landed 8c9e064d) migrates the seven T3 fixtures T-1220 broke (adapter-native-boundary, merge-gate, request-guard, stage-close, subscription-frame, suite-human). The search confirms culprit fffc70b8 (T-1220). hook-bridge, classified as a flake here, is tracked separately as T-1261. Closing as a duplicate of T-1255.

### coord · 2026-10-24T20:36:30.567Z

Duplicate of T-1255 (landed 8c9e064d).

### hub · 2026-10-24T21:13:42.112Z

Periodic run 679cfcb8-60d9-4f29-9e95-23aa0de00d65; red head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; tree 5c7b99ce510e85a8de29336d129abbe47f22d429
Last green run 41de302e-c97d-440e-b5e2-6baa0ebfe89d; head 89e5c304bef194c07caff3e41a82d0e62a2e2902
Original log A-11364: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11364-suite-679cfcb8-60d9-4f29-9e95-23aa0de00d65-all-at-8fd6195.log
hub/test/adapter-native-boundary.test.ts: culprit at fffc70b8c61f5d3755eee6d128334752d72d9b8c A session's shell identity is not bound to a per-session credential (T-1220)
Run 04d8f22f-df6f-4a14-a68d-14dcdb1de079; head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; red; log A-11397: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11397-suite-04d8f22f-df6f-4a14-a68d-14dcdb1de079-all-at-8fd6195.log
Run 2a731a72-5f92-4012-ae80-f95c16e7636d; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11398: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11398-suite-2a731a72-5f92-4012-ae80-f95c16e7636d-all-at-89e5c30.log
Run 14ccf1e5-ede8-44be-8d38-6e3b9805dbd6; head 12f25962a439aca333d69742c731e26dd8d61f77; green; log A-11399: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11399-suite-14ccf1e5-ede8-44be-8d38-6e3b9805dbd6-all-at-12f2596.log
Run 77151170-10ae-4f32-9fd9-a5b1b16a269e; head 32b505ff9764e4ac2d4ee9eccdfb2576b883a98c; green; log A-11400: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11400-suite-77151170-10ae-4f32-9fd9-a5b1b16a269e-all-at-32b505f.log
Run 062a4163-1d9c-4284-9e1a-0f488dd69d8d; head 8a069e4a3a05fc4647f3be98d9b8fe334db42171; green; log A-11405: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11405-suite-062a4163-1d9c-4284-9e1a-0f488dd69d8d-all-at-8a069e4.log
Run 6176b9b5-54c2-423c-8796-d371faa7d698; head 708ad732fec056195a2dd1c5179fef41b7956541; red; log A-11407: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11407-suite-6176b9b5-54c2-423c-8796-d371faa7d698-all-at-708ad73.log
Run d18b80cb-5018-4876-b825-80b48de8829e; head 795799df95022f1b9bd03a2bfd803204c5c38f8d; green; log A-11418: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11418-suite-d18b80cb-5018-4876-b825-80b48de8829e-all-at-795799d.log
Run 8b7ae472-c95f-4a7d-af1f-eb43c161908e; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11426: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11426-suite-8b7ae472-c95f-4a7d-af1f-eb43c161908e-all-at-6950fd2.log
Run 5cac8120-5d5e-49d9-a34c-187d15d5a996; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11432: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11432-suite-5cac8120-5d5e-49d9-a34c-187d15d5a996-all-at-fffc70b.log
Run 3cb542e2-e08f-4183-bbef-b6a5fc69f2ae; head 6950fd2f66f595adeb7c6e9c5dd939a1d8d23a70; green; log A-11441: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11441-suite-3cb542e2-e08f-4183-bbef-b6a5fc69f2ae-all-at-6950fd2.log
Run b72dfb76-c245-4c82-afd0-9fd38943978a; head fffc70b8c61f5d3755eee6d128334752d72d9b8c; red; log A-11452: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11452-suite-b72dfb76-c245-4c82-afd0-9fd38943978a-all-at-fffc70b.log
hub/test/merge-gate.test.ts: inconclusive (no failure in the requested file)
Run b04f7249-bebd-4b69-92ee-b2317be0eca9; head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; inconclusive; log A-11455: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11455-suite-b04f7249-bebd-4b69-92ee-b2317be0eca9-all-at-8fd6195.log
hub/test/request-guard.test.ts: inconclusive (no failure in the requested file)
Run 532f8aeb-5ee1-4412-af1d-73404d4c408f; head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; inconclusive; log A-11457: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11457-suite-532f8aeb-5ee1-4412-af1d-73404d4c408f-all-at-8fd6195.log
hub/test/scenarios/hook-bridge.test.ts: inconclusive (no failure in the requested file)
Run 65bb9714-7341-4d3d-bc95-13f7d29a40c9; head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; inconclusive; log A-11458: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11458-suite-65bb9714-7341-4d3d-bc95-13f7d29a40c9-all-at-8fd6195.log
hub/test/scenarios/stage-close.test.ts: inconclusive (no failure in the requested file)
Run 6578b90a-6cbd-43d2-8beb-695adb073a1e; head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; inconclusive; log A-11462: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11462-suite-6578b90a-6cbd-43d2-8beb-695adb073a1e-all-at-8fd6195.log
hub/test/subscription-frame.test.ts: inconclusive (no failure in the requested file)
Run 66f0839c-51b6-41a5-aa51-b0e5ee780563; head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; inconclusive; log A-11465: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11465-suite-66f0839c-51b6-41a5-aa51-b0e5ee780563-all-at-8fd6195.log
hub/test/suite-human.test.ts: inconclusive (no failure in the requested file)
Run 10b4fa88-dd46-48af-81fc-bdc3ad24e13f; head 8fd6195fd9fb83d0e50db635e4508e9e429689c2; inconclusive; log A-11467: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11467-suite-10b4fa88-dd46-48af-81fc-bdc3ad24e13f-all-at-8fd6195.log
