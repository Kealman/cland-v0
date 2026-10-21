---
id: T-1032
kind: task
title: Periodic dev T3 regression at 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d
state: open
status: in progress
size: S
criterion_seq: 1
labels:
  - dev-t3-07eeff96cb31d8e1cc391a95edd3408d9f0edf4d
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-991
found_by: droplet
topic: null
branch: t/T-1032-periodic-dev-t3-regression-at
created: 2026-10-20T23:58:31.284Z
updated: 2026-10-21T02:52:23.447Z
---

## Summary

Landed merge 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d first fails hub/test/typecheck.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run b32f6ed5-0f50-48d0-a2ae-90589cee322a; red head 7313b6939e085b1763580ebb51913a7f9e7ce5bf; tree 6b454423a87edeb20b70a25d4f21b9431581683c
Last green run 92354758-ca83-4dd2-8748-7dd63f292b68; head 0c6616845a568eeaf5a48f876a85d47f1fa1a6ba
Original log A-8104: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8104-suite-b32f6ed5-0f50-48d0-a2ae-90589cee322a-all-at-7313b69.log
hub/test/typecheck.test.ts: culprit at 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d The web phase of the suite (T-991)
Run 2bbe9435-64e5-4b66-b9ab-c434e7864818; head 7313b6939e085b1763580ebb51913a7f9e7ce5bf; red; log A-8105: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8105-suite-2bbe9435-64e5-4b66-b9ab-c434e7864818-all-at-7313b69.log
Run 6ef8a959-0420-4bd9-9bda-a202d3bc869e; head 0c6616845a568eeaf5a48f876a85d47f1fa1a6ba; green; log A-8106: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8106-suite-6ef8a959-0420-4bd9-9bda-a202d3bc869e-all-at-0c66168.log
Run 15b61fed-1a1c-43cd-a06e-33a6131fc7c4; head d8a7781c5fd15e379bc9261248bc482b96311d0c; green; log A-8107: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8107-suite-15b61fed-1a1c-43cd-a06e-33a6131fc7c4-all-at-d8a7781.log
Run 078c11c9-3f29-42e4-86a8-b6aed0c62237; head 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d; red; log A-8108: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8108-suite-078c11c9-3f29-42e4-86a8-b6aed0c62237-all-at-07eeff9.log

## Acceptance criteria

- [ ] C1. hub/test/typecheck.test.ts passes with the web workspace: its project fixture carries the files web/test and web/tsconfig.tools.json import from hub/test and hub/src, derived from the import closure rather than a hand list (targeted local T3 run named in the item).
