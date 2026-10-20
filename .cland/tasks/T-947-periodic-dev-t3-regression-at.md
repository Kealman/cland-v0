---
id: T-947
kind: task
title: Periodic dev T3 regression at 8ed94bda3452ede3d8ff685f2eebc738eec0e94c
state: closed
status: done
size: M
labels:
  - dev-t3-8ed94bda3452ede3d8ff685f2eebc738eec0e94c
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-798
found_by: droplet
topic: null
branch: null
created: 2026-10-20T08:01:49.801Z
updated: 2026-10-20T08:02:05.083Z
closed: 2026-10-20T08:02:05.083Z
---

## Summary

Landed merge 8ed94bda3452ede3d8ff685f2eebc738eec0e94c first fails hub/test/roles.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run 3998189d-5b13-47cd-9792-8f1a54b04ec7; red head eaa11b62b3c7d8d2306a3e90ed04e69519afe587; tree cb9b46b507ec25f0cb08895e13848f31331a7fda
Last green run f4c5789e-342e-4805-88a6-7e96cef02e17; head 824105c5a2a56b3495e9215cc88d60c4c129df6c
Original log A-7200: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7200-suite-3998189d-5b13-47cd-9792-8f1a54b04ec7-all-at-eaa11b6.log
hub/test/codex-adapter.test.ts: culprit at e1abb0e71a6a8b2bb400d67af748f5deab0ff388 The OpenCode adapter applies inherited approval and sandbox, but OpenCode roles should keep OpenCode's own settings (T-821)
Run 47df0f47-cfd0-4580-8d06-ff466349c104; head eaa11b62b3c7d8d2306a3e90ed04e69519afe587; red; log A-7201: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7201-suite-47df0f47-cfd0-4580-8d06-ff466349c104-all-at-eaa11b6.log
Run e45d8c81-e103-4e57-b940-def4ffd3d1f2; head 824105c5a2a56b3495e9215cc88d60c4c129df6c; green; log A-7202: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7202-suite-e45d8c81-e103-4e57-b940-def4ffd3d1f2-all-at-824105c.log
Run b042b2fe-8554-4921-8812-a377ce560a52; head 6380e048ae92facd396db6fe8a3265bf055a6a97; green; log A-7206: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7206-suite-b042b2fe-8554-4921-8812-a377ce560a52-all-at-6380e04.log
Run 3ef4056b-f89b-4236-8b80-bebbf6f4d88a; head 19533afa349d957eea9d05ef3d816bf21af9f409; green; log A-7209: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7209-suite-3ef4056b-f89b-4236-8b80-bebbf6f4d88a-all-at-19533af.log
Run e828ae91-640f-43fe-9c85-c4e67d398cd7; head f62fb71cee07004686b768bcfc21bfe607ff69ff; green; log A-7210: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7210-suite-e828ae91-640f-43fe-9c85-c4e67d398cd7-all-at-f62fb71.log
Run 30c80a5f-a7b9-4bb3-a59c-08d6f0c6f4bb; head e1abb0e71a6a8b2bb400d67af748f5deab0ff388; red; log A-7211: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7211-suite-30c80a5f-a7b9-4bb3-a59c-08d6f0c6f4bb-all-at-e1abb0e.log
hub/test/roles.test.ts: culprit at 8ed94bda3452ede3d8ff685f2eebc738eec0e94c Publish marketing commits (site, brand, README) to GitHub main and site without a release, then sync (T-798)
Run d7af8fbd-5fd0-42a8-a02e-cda28b3a0a01; head eaa11b62b3c7d8d2306a3e90ed04e69519afe587; red; log A-7215: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7215-suite-d7af8fbd-5fd0-42a8-a02e-cda28b3a0a01-all-at-eaa11b6.log
Run 34ba9e38-597f-4864-b618-7a955ac0fd4d; head 824105c5a2a56b3495e9215cc88d60c4c129df6c; green; log A-7217: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7217-suite-34ba9e38-597f-4864-b618-7a955ac0fd4d-all-at-824105c.log
Run 6679d965-5365-497a-abe3-6d247123a19b; head 6380e048ae92facd396db6fe8a3265bf055a6a97; green; log A-7218: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7218-suite-6679d965-5365-497a-abe3-6d247123a19b-all-at-6380e04.log
Run 3705eb14-2cb0-4492-bdff-7e4a16638a38; head 19533afa349d957eea9d05ef3d816bf21af9f409; green; log A-7222: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7222-suite-3705eb14-2cb0-4492-bdff-7e4a16638a38-all-at-19533af.log
Run a1d6f3e3-acac-418a-9ac9-3bbcd1149abf; head f62fb71cee07004686b768bcfc21bfe607ff69ff; red; log A-7223: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7223-suite-a1d6f3e3-acac-418a-9ac9-3bbcd1149abf-all-at-f62fb71.log
Run 6017b835-b68e-4d6b-9550-b5e597b9f047; head 8ed94bda3452ede3d8ff685f2eebc738eec0e94c; red; log A-7224: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7224-suite-6017b835-b68e-4d6b-9550-b5e597b9f047-all-at-8ed94bd.log

## Comments

### coord · 2026-10-20T08:02:05.083Z

Duplicate of T-945 (landed b1abc9e9): the culprit search confirmed T-798 (8ed94bda) grew the Coordinator clause past the reserve in roles.test.ts; T-945 tightened it to 7529 bytes.
