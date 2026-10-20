---
id: T-969
kind: task
title: Periodic dev T3 regression at 13e652a73f354a0adc77368888e3c5ff7c6669e8
state: closed
status: done
size: M
labels:
  - dev-t3-13e652a73f354a0adc77368888e3c5ff7c6669e8
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-955
found_by: droplet
topic: null
branch: null
created: 2026-10-20T12:51:22.949Z
updated: 2026-10-20T12:52:09.490Z
closed: 2026-10-20T12:52:09.490Z
---

## Summary

Landed merge 13e652a73f354a0adc77368888e3c5ff7c6669e8 first fails hub/test/doctor-isolation.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run b5fc792c-8f93-4754-b1fd-c2ce60e5eeba; red head 224d45cc6101ef93ecb375b1309da0a99d4c090c; tree ee2bcb50879e81f00b8073b5691a295b4443de5e
Last green run d7fa9559-5a6c-4860-b983-be52b79131e7; head 7916d5f71b99d937331e31618ffdcbab799b5393
Original log A-7568: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7568-suite-b5fc792c-8f93-4754-b1fd-c2ce60e5eeba-all-at-224d45c.log
hub/test/cover-quiet.test.ts: culprit at eeb7e08e3c84d71fafe7aaaed2ff675fa5a46bd7 Shared test fixtures and the manual load harness follow rule 15: own HOME and Git config, credential filter after every overlay (T-961)
Run e1951589-1ff5-40bc-879e-effa6855fdae; head 224d45cc6101ef93ecb375b1309da0a99d4c090c; red; log A-7570: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7570-suite-e1951589-1ff5-40bc-879e-effa6855fdae-all-at-224d45c.log
Run 5dda0dcc-1ad8-4106-b032-f502f33b070a; head 7916d5f71b99d937331e31618ffdcbab799b5393; green; log A-7574: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7574-suite-5dda0dcc-1ad8-4106-b032-f502f33b070a-all-at-7916d5f.log
Run e7a505eb-5c45-4824-9896-fe252e260fd9; head 426cf3447f8747a3016d91a2f66eec35fc5e40c4; green; log A-7576: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7576-suite-e7a505eb-5c45-4824-9896-fe252e260fd9-all-at-426cf34.log
Run 631856f8-990e-482c-b7bd-38b19145a66c; head bd64bdcb031711cc44ff602f05e97fafddeac84a; green; log A-7578: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7578-suite-631856f8-990e-482c-b7bd-38b19145a66c-all-at-bd64bdc.log
Run abd3f60c-30a3-4dda-b74b-59f17b5d5806; head 8dd8b24e36db81c4a32a085487923fa261a9845a; green; log A-7581: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7581-suite-abd3f60c-30a3-4dda-b74b-59f17b5d5806-all-at-8dd8b24.log
Run c83fd6a8-f6f3-43b8-a469-58fa43e43b3e; head f7ea597142f8f34e857d0f726fca06b77686ed5f; green; log A-7583: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7583-suite-c83fd6a8-f6f3-43b8-a469-58fa43e43b3e-all-at-f7ea597.log
Run d674f19d-529a-41df-a8cb-370e8408305e; head eeb7e08e3c84d71fafe7aaaed2ff675fa5a46bd7; red; log A-7584: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7584-suite-d674f19d-529a-41df-a8cb-370e8408305e-all-at-eeb7e08.log
hub/test/demo.test.ts: culprit at eeb7e08e3c84d71fafe7aaaed2ff675fa5a46bd7 Shared test fixtures and the manual load harness follow rule 15: own HOME and Git config, credential filter after every overlay (T-961)
Run 0a56030f-26e1-4b8a-abec-2377c7b1fcb3; head 224d45cc6101ef93ecb375b1309da0a99d4c090c; red; log A-7587: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7587-suite-0a56030f-26e1-4b8a-abec-2377c7b1fcb3-all-at-224d45c.log
Run 9695914f-544c-461d-a37b-ca3e82db287d; head 7916d5f71b99d937331e31618ffdcbab799b5393; green; log A-7590: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7590-suite-9695914f-544c-461d-a37b-ca3e82db287d-all-at-7916d5f.log
Run f1f1efa9-2e9e-4ada-8f90-ea6aa5a758e1; head 426cf3447f8747a3016d91a2f66eec35fc5e40c4; green; log A-7591: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7591-suite-f1f1efa9-2e9e-4ada-8f90-ea6aa5a758e1-all-at-426cf34.log
Run 437ffd27-b301-421a-9eab-838f37966946; head bd64bdcb031711cc44ff602f05e97fafddeac84a; green; log A-7595: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7595-suite-437ffd27-b301-421a-9eab-838f37966946-all-at-bd64bdc.log
Run c7c9c315-00de-4d14-b2e3-63b486accaa2; head 8dd8b24e36db81c4a32a085487923fa261a9845a; green; log A-7597: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7597-suite-c7c9c315-00de-4d14-b2e3-63b486accaa2-all-at-8dd8b24.log
Run cf806df5-4cf0-4572-a7bb-7e4151089dfb; head f7ea597142f8f34e857d0f726fca06b77686ed5f; green; log A-7601: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7601-suite-cf806df5-4cf0-4572-a7bb-7e4151089dfb-all-at-f7ea597.log
Run 1343c4f7-ad1d-453c-a610-b93056a9a3c5; head eeb7e08e3c84d71fafe7aaaed2ff675fa5a46bd7; red; log A-7602: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7602-suite-1343c4f7-ad1d-453c-a610-b93056a9a3c5-all-at-eeb7e08.log
hub/test/doctor-isolation.test.ts: culprit at 13e652a73f354a0adc77368888e3c5ff7c6669e8 A T1 test holds the shipped role clauses' byte reserve and wording pins (T-955)
Run 3c336176-d8d2-4ef1-a9c9-34e87587bc0f; head 224d45cc6101ef93ecb375b1309da0a99d4c090c; red; log A-7608: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7608-suite-3c336176-d8d2-4ef1-a9c9-34e87587bc0f-all-at-224d45c.log
Run 2ad5b264-64b2-44aa-89f2-ec0c37d4c1a1; head 7916d5f71b99d937331e31618ffdcbab799b5393; green; log A-7615: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7615-suite-2ad5b264-64b2-44aa-89f2-ec0c37d4c1a1-all-at-7916d5f.log
Run b68a284b-4113-4088-bfd4-fef6998354bf; head 426cf3447f8747a3016d91a2f66eec35fc5e40c4; green; log A-7616: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7616-suite-b68a284b-4113-4088-bfd4-fef6998354bf-all-at-426cf34.log
Run ce4c687a-2090-45ba-b3ef-5785eb41b54b; head bd64bdcb031711cc44ff602f05e97fafddeac84a; green; log A-7620: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7620-suite-ce4c687a-2090-45ba-b3ef-5785eb41b54b-all-at-bd64bdc.log
Run 09624666-fd04-47c1-910f-04fa7844d30d; head 8dd8b24e36db81c4a32a085487923fa261a9845a; red; log A-7621: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7621-suite-09624666-fd04-47c1-910f-04fa7844d30d-all-at-8dd8b24.log
Run 40cc4807-754f-48f8-b143-c8187f674d6c; head 931546b6121f84cc027fd2c294be2ead6b627365; red; log A-7623: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7623-suite-40cc4807-754f-48f8-b143-c8187f674d6c-all-at-931546b.log
Run d3d1cb48-c58a-41ef-9970-507ed3794f6d; head 13e652a73f354a0adc77368888e3c5ff7c6669e8; red; log A-7627: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7627-suite-d3d1cb48-c58a-41ef-9970-507ed3794f6d-all-at-13e652a.log
hub/test/fixture-orphans-lifecycle.test.ts: inconclusive (Error: unknown explicit hub shard file: hub/test/fixture-orphans-lifecycle.test.ts)
Run a7dad14f-7a4f-4726-a44e-7f4eab3ccc6b; head 224d45cc6101ef93ecb375b1309da0a99d4c090c; red; log A-7628: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7628-suite-a7dad14f-7a4f-4726-a44e-7f4eab3ccc6b-all-at-224d45c.log
hub/test/orphan-servers.test.ts: inconclusive (file has nonpassing execution receipts)
Run fb5f4b02-455d-40f1-a71d-d22bfbbf1e89; head 224d45cc6101ef93ecb375b1309da0a99d4c090c; red; log A-7633: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7633-suite-fb5f4b02-455d-40f1-a71d-d22bfbbf1e89-all-at-224d45c.log
Run f3ae2df6-f0dc-4bd8-b260-452af594ad01; head 7916d5f71b99d937331e31618ffdcbab799b5393; inconclusive; log A-7635: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7635-suite-f3ae2df6-f0dc-4bd8-b260-452af594ad01-all-at-7916d5f.log
hub/test/release.test.ts: culprit at eeb7e08e3c84d71fafe7aaaed2ff675fa5a46bd7 Shared test fixtures and the manual load harness follow rule 15: own HOME and Git config, credential filter after every overlay (T-961)
Run 6be47763-dedb-48dc-aeac-35364ddd0503; head 224d45cc6101ef93ecb375b1309da0a99d4c090c; red; log A-7638: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7638-suite-6be47763-dedb-48dc-aeac-35364ddd0503-all-at-224d45c.log
Run ae5b06d5-afa7-46c4-915b-b49500121603; head 7916d5f71b99d937331e31618ffdcbab799b5393; green; log A-7643: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7643-suite-ae5b06d5-afa7-46c4-915b-b49500121603-all-at-7916d5f.log
Run 6802f2cb-1177-4b2e-ae70-b256df2ae82a; head 426cf3447f8747a3016d91a2f66eec35fc5e40c4; green; log A-7646: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7646-suite-6802f2cb-1177-4b2e-ae70-b256df2ae82a-all-at-426cf34.log
Run 1c83202c-1266-41d7-9d75-382e81548a60; head bd64bdcb031711cc44ff602f05e97fafddeac84a; green; log A-7647: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7647-suite-1c83202c-1266-41d7-9d75-382e81548a60-all-at-bd64bdc.log
Run 7bc649d4-7102-470a-a3cd-da8ae304f5dc; head 8dd8b24e36db81c4a32a085487923fa261a9845a; green; log A-7648: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7648-suite-7bc649d4-7102-470a-a3cd-da8ae304f5dc-all-at-8dd8b24.log
Run c9975d74-e542-4ba1-82a3-19830e2650d4; head f7ea597142f8f34e857d0f726fca06b77686ed5f; green; log A-7651: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7651-suite-c9975d74-e542-4ba1-82a3-19830e2650d4-all-at-f7ea597.log
Run 9c85b374-6580-4bee-b7ba-cc84a9eccac6; head eeb7e08e3c84d71fafe7aaaed2ff675fa5a46bd7; red; log A-7652: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7652-suite-9c85b374-6580-4bee-b7ba-cc84a9eccac6-all-at-eeb7e08.log
hub/test/scenarios/droplet-verify.test.ts: inconclusive (Error: verify-tiers: duration key has no matching test identity: hub/test/demo-release-component.test.ts::demo stop confirms an earlier delete whose active droplet has lost its tags)
Run e5d2725d-2cc0-4bfa-88f7-3fe7cff22415; head 224d45cc6101ef93ecb375b1309da0a99d4c090c; red; log A-7655: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7655-suite-e5d2725d-2cc0-4bfa-88f7-3fe7cff22415-all-at-224d45c.log

## Comments

### coord · 2026-10-20T12:52:09.490Z

Duplicate of T-965 (landed 0d0808a7). The search named 13e652a7 (T-955) for doctor-isolation, but T-955 changes only role-clause test files, so it cannot cause a doctor failure. The green probe at bd64bdcb is my reading of a lucky pass of the fixture startup-sweep race T-807 introduced, which T-965 fixed (see the note on T-965). The stage covers at the v0.1.5 tip will confirm it.
