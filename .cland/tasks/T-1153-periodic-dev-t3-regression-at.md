---
id: T-1153
kind: task
title: Periodic dev T3 regression at 0c8c8c9a5ecfcb824ffae7c3a478897defe09d80
state: closed
status: done
size: M
labels:
  - dev-t3-0c8c8c9a5ecfcb824ffae7c3a478897defe09d80
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1117
found_by: droplet
topic: null
branch: null
created: 2026-10-22T18:21:31.244Z
updated: 2026-10-22T20:21:41.358Z
closed: 2026-10-22T18:21:40.033Z
---

## Summary

Landed merge 0c8c8c9a5ecfcb824ffae7c3a478897defe09d80 first fails hub/test/opencode-adapter.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run 0764ca02-c81a-46b6-b46b-8012933e8b2a; red head d3e632bc49f0714452309550af9bef83678f55f2; tree f51382b81acec6fba37d68ad6ded15dc3ea7a751
Last green run eb22dbbc-8450-4749-9331-032f86d3084b; head 1b4291e6019fdeda13d101c1e3fd70ebfbf60553
Original log A-9402: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9402-suite-0764ca02-c81a-46b6-b46b-8012933e8b2a-all-at-d3e632b.log
hub/test/opencode-adapter.test.ts: culprit at 0c8c8c9a5ecfcb824ffae7c3a478897defe09d80 The human's message kinds and Withdraw in the hub (T-1117)
Run b85ae02f-20e1-4a96-872d-144df6c52098; head d3e632bc49f0714452309550af9bef83678f55f2; red; log A-9403: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9403-suite-b85ae02f-20e1-4a96-872d-144df6c52098-all-at-d3e632b.log
Run 8addd266-52e3-4b7e-9414-d5b377e34ced; head 1b4291e6019fdeda13d101c1e3fd70ebfbf60553; green; log A-9405: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9405-suite-8addd266-52e3-4b7e-9414-d5b377e34ced-all-at-1b4291e.log
Run 44563eb7-2538-4ff7-baad-3227e11bff79; head 83c7e0c35627d7ace3e326c0f4a1a588bd2b0329; green; log A-9407: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9407-suite-44563eb7-2538-4ff7-baad-3227e11bff79-all-at-83c7e0c.log
Run 16ece8af-fdb8-417a-937c-a0930c7764a6; head 22051ac0aa83450fcfedeb185067fd6e60ba6b9c; green; log A-9409: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9409-suite-16ece8af-fdb8-417a-937c-a0930c7764a6-all-at-22051ac.log
Run 08054bda-10f7-4bfd-b958-2b74af571319; head 8ee2aaa851fac885eaea13d38201e601862f93cf; red; log A-9413: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9413-suite-08054bda-10f7-4bfd-b958-2b74af571319-all-at-8ee2aaa.log
Run 5688ea9a-9f76-4d0f-98ed-28e441a6148f; head 0fcc58a749a4a2354f84b270b0f07385675936dd; green; log A-9415: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9415-suite-5688ea9a-9f76-4d0f-98ed-28e441a6148f-all-at-0fcc58a.log
Run b20e7eca-2ff5-44b2-83e9-02703f4f8f37; head 58aa8efd66089c04613d2002ea072a9738046a3b; green; log A-9416: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9416-suite-b20e7eca-2ff5-44b2-83e9-02703f4f8f37-all-at-58aa8ef.log
Run de94f760-b974-4592-bb9b-f12d1dfe583b; head 31bd45bc885333257fb94055645ae14bc6ee4947; red; log A-9417: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9417-suite-de94f760-b974-4592-bb9b-f12d1dfe583b-all-at-31bd45b.log
Run b1bdb777-511c-4dc0-aced-a81887fb6d32; head 0c8c8c9a5ecfcb824ffae7c3a478897defe09d80; red; log A-9418: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9418-suite-b1bdb777-511c-4dc0-aced-a81887fb6d32-all-at-0c8c8c9.log

## Comments

### coord · 2026-10-22T18:21:40.033Z

Duplicate of T-1150 (filed 17:58Z from the same periodic run 0764ca02, regression of T-1117). The hub's search confirms the culprit 0c8c8c9a (T-1117); T-1150 carries the test migration and its full Linux run 6e61e141 is in progress.

### hub · 2026-10-22T20:21:41.358Z

Periodic run bea28a99-ae00-4a09-bff0-e576ca77078c; red head ed86d772185bae632106810aa3bf21959bc53fda; tree 42b6f114cde44b8a77581fc180c8ad3ebb1b1616
Last green run eb22dbbc-8450-4749-9331-032f86d3084b; head 1b4291e6019fdeda13d101c1e3fd70ebfbf60553
Original log A-9436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9436-suite-bea28a99-ae00-4a09-bff0-e576ca77078c-all-at-ed86d77.log
hub/test/opencode-adapter.test.ts: culprit at 0c8c8c9a5ecfcb824ffae7c3a478897defe09d80 The human's message kinds and Withdraw in the hub (T-1117)
Run 13c9c3fd-2f2f-47a2-b0c6-be4072383083; head ed86d772185bae632106810aa3bf21959bc53fda; red; log A-9440: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9440-suite-13c9c3fd-2f2f-47a2-b0c6-be4072383083-all-at-ed86d77.log
Run 71e28efa-96d8-428b-82df-e61711d57e91; head 1b4291e6019fdeda13d101c1e3fd70ebfbf60553; green; log A-9441: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9441-suite-71e28efa-96d8-428b-82df-e61711d57e91-all-at-1b4291e.log
Run d9392dee-dfda-4040-af24-fb035459c82d; head 4fd2ac6770cd299e0dee23921662a55b597b2d65; green; log A-9442: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9442-suite-d9392dee-dfda-4040-af24-fb035459c82d-all-at-4fd2ac6.log
Run 123694d9-4de1-400e-8e9e-025903eaa0eb; head 58aa8efd66089c04613d2002ea072a9738046a3b; green; log A-9444: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9444-suite-123694d9-4de1-400e-8e9e-025903eaa0eb-all-at-58aa8ef.log
Run 783a99e4-7243-42fc-a5c9-6dc8a6a98242; head de40ac3c93e5f1713c775831ce1f475bd17c07e1; red; log A-9446: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9446-suite-783a99e4-7243-42fc-a5c9-6dc8a6a98242-all-at-de40ac3.log
Run ce04c611-2fed-480e-9df2-d654f4afc2fe; head 1db66120ceea49ef40eaae8aa4352c1fe14bd06b; red; log A-9447: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9447-suite-ce04c611-2fed-480e-9df2-d654f4afc2fe-all-at-1db6612.log
Run 7aa8a96d-27e8-492a-aa76-2832adf9900d; head 26e74e4dba757ff1cda5229df5a66be0cfa30486; red; log A-9448: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9448-suite-7aa8a96d-27e8-492a-aa76-2832adf9900d-all-at-26e74e4.log
Run 20bf0d4a-0616-4018-a1af-6fbd2e0f3cc7; head 0c8c8c9a5ecfcb824ffae7c3a478897defe09d80; red; log A-9449: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9449-suite-20bf0d4a-0616-4018-a1af-6fbd2e0f3cc7-all-at-0c8c8c9.log
