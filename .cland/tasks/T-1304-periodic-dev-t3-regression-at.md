---
id: T-1304
kind: task
title: Periodic dev T3 regression at 8fa6651232453ff072118595c03673e5da98c544
state: closed
status: done
size: M
labels:
  - dev-t3-8fa6651232453ff072118595c03673e5da98c544
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1225
found_by: droplet
topic: null
branch: null
created: 2026-10-25T13:35:25.575Z
updated: 2026-10-25T13:35:44.825Z
closed: 2026-10-25T13:35:44.825Z
---

## Summary

Landed merge 8fa6651232453ff072118595c03673e5da98c544 first fails hub/test/qa-lint-build.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run fee2e7ee-66cc-4e52-afd9-34f1a3b04642; red head e684fef926ff9de910f36d9e84d933a943e2c625; tree e06a9dd7f21192c5559d799a720ea639c7400d96
Last green run 4c511a7e-aceb-42f6-8801-3f629ee132ff; head 82cf0f6caae30e159a6fb4644171abcd29c32d05
Original log A-11934: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11934-suite-fee2e7ee-66cc-4e52-afd9-34f1a3b04642-all-at-e684fef.log
hub/test/qa-lint-build.test.ts: culprit at 8fa6651232453ff072118595c03673e5da98c544 cland qa lint rejects every Aide verification row although the Aide clause allows cland verify (T-1225)
Run aa7c4fd8-58b3-43c8-87dd-7673d82d3136; head e684fef926ff9de910f36d9e84d933a943e2c625; red; log A-11935: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11935-suite-aa7c4fd8-58b3-43c8-87dd-7673d82d3136-all-at-e684fef.log
Run 555827d7-badb-459b-8926-b98a60424957; head 82cf0f6caae30e159a6fb4644171abcd29c32d05; green; log A-11940: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11940-suite-555827d7-badb-459b-8926-b98a60424957-all-at-82cf0f6.log
Run c84ae855-b6a1-470f-9d0f-01b836de1599; head ff73a3d057029f50e133b66272ffa04ccd34cd36; green; log A-11947: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11947-suite-c84ae855-b6a1-470f-9d0f-01b836de1599-all-at-ff73a3d.log
Run d214c5f0-1a3c-4c97-a5b5-d37484dace76; head 5881ebcc36b1010ecb04e5808665fb24856ee926; red; log A-11950: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11950-suite-d214c5f0-1a3c-4c97-a5b5-d37484dace76-all-at-5881ebc.log
Run bb9673b0-a452-4e45-a45c-cc589c1918b6; head d8925bcc8b2527d1b5877c9b29ad19fd83d5c3db; red; log A-11953: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11953-suite-bb9673b0-a452-4e45-a45c-cc589c1918b6-all-at-d8925bc.log
Run 3189d084-48f0-4cdb-bff2-cdcdea6f5118; head 8fa6651232453ff072118595c03673e5da98c544; red; log A-11955: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11955-suite-3189d084-48f0-4cdb-bff2-cdcdea6f5118-all-at-8fa6651.log
Run d3f63722-9e52-489a-900e-38390f0ad0ae; head ff73a3d057029f50e133b66272ffa04ccd34cd36; green; log A-11959: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11959-suite-d3f63722-9e52-489a-900e-38390f0ad0ae-all-at-ff73a3d.log
Run 409a18d0-e612-4a2d-97ab-dcc237150605; head 8fa6651232453ff072118595c03673e5da98c544; red; log A-11960: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11960-suite-409a18d0-e612-4a2d-97ab-dcc237150605-all-at-8fa6651.log
hub/test/roles-timing.test.ts: culprit at 8acdd283b96ddb2683d5f38c87c00d2d823465af Role clause assembly scans skills with readdirSync on every hello (T-1230)
Run e7ed9194-bd2b-445c-ab38-06ec50832f62; head e684fef926ff9de910f36d9e84d933a943e2c625; red; log A-11964: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11964-suite-e7ed9194-bd2b-445c-ab38-06ec50832f62-all-at-e684fef.log
Run 6b22be48-68e8-49cf-ba5e-11da605f5d5c; head 82cf0f6caae30e159a6fb4644171abcd29c32d05; green; log A-11967: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11967-suite-6b22be48-68e8-49cf-ba5e-11da605f5d5c-all-at-82cf0f6.log
Run 58add556-0fd8-4a7b-a842-d37454d686ef; head ff73a3d057029f50e133b66272ffa04ccd34cd36; red; log A-11971: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11971-suite-58add556-0fd8-4a7b-a842-d37454d686ef-all-at-ff73a3d.log
Run 6bf65f10-23ad-4568-92e0-b46e8c4f32d9; head 98c60b8cca9d6582eabd28cb2a116780dec915d4; red; log A-11974: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11974-suite-6bf65f10-23ad-4568-92e0-b46e8c4f32d9-all-at-98c60b8.log
Run 11ec2538-dc87-405e-93ac-1a3b3deb5216; head 8acdd283b96ddb2683d5f38c87c00d2d823465af; red; log A-11978: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11978-suite-11ec2538-dc87-405e-93ac-1a3b3deb5216-all-at-8acdd28.log
Run 1ffa3ada-1880-4c2a-9b06-2a06f40d3a21; head 911b233e9a116a4c2ad350085f276b2db2bf734e; green; log A-11980: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11980-suite-1ffa3ada-1880-4c2a-9b06-2a06f40d3a21-all-at-911b233.log
Run 927453e2-44c6-4e26-a5d4-a3e12d58bb3f; head 911b233e9a116a4c2ad350085f276b2db2bf734e; green; log A-11981: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11981-suite-927453e2-44c6-4e26-a5d4-a3e12d58bb3f-all-at-911b233.log
Run 51c32609-e12e-42d2-b756-e007d742c6fd; head 8acdd283b96ddb2683d5f38c87c00d2d823465af; red; log A-11984: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11984-suite-51c32609-e12e-42d2-b756-e007d742c6fd-all-at-8acdd28.log

## Comments

### coord · 2026-10-25T13:35:44.825Z

Duplicate of T-1303 (regression-of T-1225), which landed on dev at 0ef4dde1 and fixes hub/test/qa-lint-build.test.ts. The search began at 12:51Z, before T-1303 landed.
