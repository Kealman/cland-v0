---
id: T-1240
kind: task
title: Periodic dev T3 regression at 3830f7fc7d18497934afb0713b32f350e876dcd2
state: closed
status: done
size: M
labels:
  - dev-t3-3830f7fc7d18497934afb0713b32f350e876dcd2
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-998
found_by: droplet
topic: null
branch: null
created: 2026-10-24T13:14:01.087Z
updated: 2026-10-24T13:14:18.288Z
closed: 2026-10-24T13:14:18.288Z
---

## Summary

Landed merge 3830f7fc7d18497934afb0713b32f350e876dcd2 first fails hub/test/merge-policy.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run 1de62ca6-d571-452c-8a71-a7a96b85446f; red head 230669296771cf8f282ab2d050fc48603ce0de39; tree f9afab141c86ae5fc05da32c678b6818d19b76ad
Last green run 41de302e-c97d-440e-b5e2-6baa0ebfe89d; head 89e5c304bef194c07caff3e41a82d0e62a2e2902
Original log A-10828: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10828-suite-1de62ca6-d571-452c-8a71-a7a96b85446f-all-at-2306692.log
hub/test/merge-policy.test.ts: culprit at 3830f7fc7d18497934afb0713b32f350e876dcd2 A malformed tool argument is answered as a permission refusal (forbidden) (T-998)
Run eaf5ac03-2cef-4b65-bfdd-afb339fe6b7a; head 230669296771cf8f282ab2d050fc48603ce0de39; red; log A-10833: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10833-suite-eaf5ac03-2cef-4b65-bfdd-afb339fe6b7a-all-at-2306692.log
Run 59ccee73-32c2-4f4f-b67b-d09f0aa8c012; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-10840: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10840-suite-59ccee73-32c2-4f4f-b67b-d09f0aa8c012-all-at-89e5c30.log
Run 716c2502-cfd7-4116-ac84-2f42fccaf745; head 69b3dc7db6d819cd27ac2e96b769a02623cf1c96; green; log A-10843: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10843-suite-716c2502-cfd7-4116-ac84-2f42fccaf745-all-at-69b3dc7.log
Run d18505b3-a58e-455e-ac03-f275a6b5e720; head 86449530f6f292a3cad7e4debeeb56d45d9ec498; red; log A-10846: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10846-suite-d18505b3-a58e-455e-ac03-f275a6b5e720-all-at-8644953.log
Run fa8fe408-1e8e-45fc-858e-a319556426f9; head 355d3c62bcfd457940cbd3ab06fcabfad6ef34a0; green; log A-10852: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10852-suite-fa8fe408-1e8e-45fc-858e-a319556426f9-all-at-355d3c6.log
Run d5e5ba06-4daa-43d9-8875-196affdf843e; head 8dceca4f4569d0d714e7dec95b449e68ff7c28ec; red; log A-10856: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10856-suite-d5e5ba06-4daa-43d9-8875-196affdf843e-all-at-8dceca4.log
Run d15dc7fe-2155-4950-8c87-da76d64780a1; head 3830f7fc7d18497934afb0713b32f350e876dcd2; red; log A-10859: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10859-suite-d15dc7fe-2155-4950-8c87-da76d64780a1-all-at-3830f7f.log
hub/test/suite-dry-run.test.ts: culprit at 94b632aab8413fd16da42831dcb37dd59c5ec625 Tests register temporary projects in the real host executor ledger (T-422)
Run 486bdc9a-96aa-4fd5-8e11-eff4160d69e3; head 230669296771cf8f282ab2d050fc48603ce0de39; red; log A-10871: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10871-suite-486bdc9a-96aa-4fd5-8e11-eff4160d69e3-all-at-2306692.log
Run c8f1103b-bc6c-4c8c-9de3-79a04a9ebcab; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-10885: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10885-suite-c8f1103b-bc6c-4c8c-9de3-79a04a9ebcab-all-at-89e5c30.log
Run 74cb8d5b-eb72-4702-8b9b-eff7e9779674; head 69b3dc7db6d819cd27ac2e96b769a02623cf1c96; red; log A-10897: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10897-suite-74cb8d5b-eb72-4702-8b9b-eff7e9779674-all-at-69b3dc7.log
Run c7570c07-86c7-40f1-aafb-d67422e1cc8b; head ea76a62910fd98a46ceda9febc618fc92e32a959; green; log A-10905: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10905-suite-c7570c07-86c7-40f1-aafb-d67422e1cc8b-all-at-ea76a62.log
Run e2c8b2d8-3f41-4344-a18b-4bb532893859; head 3c3cf5cc3472e79f26c82422053bfd104e7b5dc4; green; log A-10922: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10922-suite-e2c8b2d8-3f41-4344-a18b-4bb532893859-all-at-3c3cf5c.log
Run 15757424-d9f5-43b1-827b-95bcaa448511; head 2415ad825e32ad0db449d8fba82dc0c4d2069835; green; log A-10938: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10938-suite-15757424-d9f5-43b1-827b-95bcaa448511-all-at-2415ad8.log
Run 0c42fd15-f188-4717-860b-08fea08ca001; head 94b632aab8413fd16da42831dcb37dd59c5ec625; red; log A-10948: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10948-suite-0c42fd15-f188-4717-860b-08fea08ca001-all-at-94b632a.log
hub/test/suite-runner-contract.test.ts: culprit at ea76a62910fd98a46ceda9febc618fc92e32a959 Human-queue waiters poll suite.slot about 2.4 times a second each (T-444)
Run 438612ab-76aa-4fcf-92e4-9ec35069f336; head 230669296771cf8f282ab2d050fc48603ce0de39; red; log A-10973: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10973-suite-438612ab-76aa-4fcf-92e4-9ec35069f336-all-at-2306692.log
Run 39348361-b763-40ff-861c-0e8dc8813222; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-10987: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10987-suite-39348361-b763-40ff-861c-0e8dc8813222-all-at-89e5c30.log
Run 8cce5d27-ac0b-48f0-ba90-ca89a44ac4d4; head 69b3dc7db6d819cd27ac2e96b769a02623cf1c96; red; log A-11002: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11002-suite-8cce5d27-ac0b-48f0-ba90-ca89a44ac4d4-all-at-69b3dc7.log
Run 4ce458cc-b94b-4ee5-bcbf-9dee74a21350; head ea76a62910fd98a46ceda9febc618fc92e32a959; red; log A-11017: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11017-suite-4ce458cc-b94b-4ee5-bcbf-9dee74a21350-all-at-ea76a62.log
Run e71fd537-8b14-4701-9924-45d83cbf1cef; head 74407f6ef6cfdca357c8a15b1780740cc3a65266; green; log A-11028: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11028-suite-e71fd537-8b14-4701-9924-45d83cbf1cef-all-at-74407f6.log
Run ed288444-d663-40c7-866b-9d5098317e2a; head 2c241c214cee6252bb7ed843b179d6b49fc82ab6; green; log A-11036: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11036-suite-ed288444-d663-40c7-866b-9d5098317e2a-all-at-2c241c2.log
Run 50d4712b-c8db-41e9-9a23-a3007a17e60f; head 57bddc59c7aabbe1dcf3e400d9dda358639da49e; green; log A-11051: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11051-suite-50d4712b-c8db-41e9-9a23-a3007a17e60f-all-at-57bddc5.log
hub/test/verification-workers.test.ts: culprit at 74407f6ef6cfdca357c8a15b1780740cc3a65266 A droplet capacity refusal is reported as a red periodic dev T3 run, and no executor fallback applies (T-1144)
Run a748d326-9289-45db-a8f4-ae42cebb6652; head 230669296771cf8f282ab2d050fc48603ce0de39; red; log A-11055: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11055-suite-a748d326-9289-45db-a8f4-ae42cebb6652-all-at-2306692.log
Run cfe1a935-6941-45bf-89a6-8f0e9276e36f; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11063: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11063-suite-cfe1a935-6941-45bf-89a6-8f0e9276e36f-all-at-89e5c30.log
Run 9e75787a-9fdc-4411-971d-1d8abe551905; head 69b3dc7db6d819cd27ac2e96b769a02623cf1c96; red; log A-11071: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11071-suite-9e75787a-9fdc-4411-971d-1d8abe551905-all-at-69b3dc7.log
Run 08170fb1-907c-4a2e-8ab4-3353e7be7ab9; head ea76a62910fd98a46ceda9febc618fc92e32a959; red; log A-11074: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11074-suite-08170fb1-907c-4a2e-8ab4-3353e7be7ab9-all-at-ea76a62.log
Run 72ef8856-e5be-4205-a1ae-1192d2e47ce5; head 74407f6ef6cfdca357c8a15b1780740cc3a65266; red; log A-11075: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11075-suite-72ef8856-e5be-4205-a1ae-1192d2e47ce5-all-at-74407f6.log
Run 700bc0b8-cd33-4efe-8a0c-fd30047e4fa9; head 09a9898477123ac8cde7df1e406c753c963d4ce4; green; log A-11078: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11078-suite-700bc0b8-cd33-4efe-8a0c-fd30047e4fa9-all-at-09a9898.log
Run 5e2dd8d2-45e2-4284-91b0-5e667c0ed0d9; head 30b7b71fa5116ac17cb3cdae398b0e4b849e6e49; green; log A-11080: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11080-suite-5e2dd8d2-45e2-4284-91b0-5e667c0ed0d9-all-at-30b7b71.log

## Comments

### coord · 2026-10-24T13:14:18.288Z

Already fixed (coord): the merge-policy regression from T-998 (3830f7fc) is fixed on dev by T-1226 (65c47f8c). The Linux and macOS stage covers at 95662413 passed merge-policy.test.ts.
