---
id: T-1252
kind: task
title: Periodic dev T3 regression at 5e29a5f2dd92895d43afd8b9a10e23faab1f2155
state: closed
status: done
size: M
labels:
  - dev-t3-5e29a5f2dd92895d43afd8b9a10e23faab1f2155
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1012
found_by: droplet
topic: null
branch: null
created: 2026-10-24T14:21:18.628Z
updated: 2026-10-24T14:21:46.069Z
closed: 2026-10-24T14:21:46.069Z
---

## Summary

Landed merge 5e29a5f2dd92895d43afd8b9a10e23faab1f2155 first fails nvim/test/sessions-lifecycle.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run 4954e966-b8bc-42f8-92d0-13679635ed10; red head 699a44dd1741e272ecd883c73c1aeda0215d6dff; tree 4bbed43f892034a2d6fb9f7613bc20f6264e7d54
Last green run 41de302e-c97d-440e-b5e2-6baa0ebfe89d; head 89e5c304bef194c07caff3e41a82d0e62a2e2902
Original log A-11081: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11081-suite-4954e966-b8bc-42f8-92d0-13679635ed10-all-at-699a44d.log
nvim/test/qa.test.ts: inconclusive (file has nonpassing execution receipts)
Run 897ebeb6-de24-4386-af7c-e1ec62a45a2b; head 699a44dd1741e272ecd883c73c1aeda0215d6dff; red; log A-11086: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11086-suite-897ebeb6-de24-4386-af7c-e1ec62a45a2b-all-at-699a44d.log
Run fcf0918a-f3a3-45ff-a33a-ca81e3ed19a1; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; inconclusive; log A-11095: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11095-suite-fcf0918a-f3a3-45ff-a33a-ca81e3ed19a1-all-at-89e5c30.log
nvim/test/sessions-lifecycle.test.ts: culprit at 5e29a5f2dd92895d43afd8b9a10e23faab1f2155 Neovim test fixtures inherit the parent environment unless sealed explicitly (T-1012)
Run 7af3a1d6-18fd-4a50-9814-f4e7e195e927; head 699a44dd1741e272ecd883c73c1aeda0215d6dff; red; log A-11101: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11101-suite-7af3a1d6-18fd-4a50-9814-f4e7e195e927-all-at-699a44d.log
Run 3ae40e31-19d0-4875-be16-c2850a320b62; head 89e5c304bef194c07caff3e41a82d0e62a2e2902; green; log A-11116: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11116-suite-3ae40e31-19d0-4875-be16-c2850a320b62-all-at-89e5c30.log
Run 000d07d6-276d-403c-86a6-94c00a9c0891; head 44f220a559e2f027daf9ba59a9f14098efbd99f7; green; log A-11129: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11129-suite-000d07d6-276d-403c-86a6-94c00a9c0891-all-at-44f220a.log
Run 4112c519-179c-4ef5-b4ae-3d550ba454d4; head 12f25962a439aca333d69742c731e26dd8d61f77; green; log A-11142: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11142-suite-4112c519-179c-4ef5-b4ae-3d550ba454d4-all-at-12f2596.log
Run 2e58bd7f-f01b-45c4-baf7-c18294af5077; head 35d8de1c5a3d203be35b129ca54b6ade506b06fa; red; log A-11157: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11157-suite-2e58bd7f-f01b-45c4-baf7-c18294af5077-all-at-35d8de1.log
Run a66e2f41-f0c6-4061-a617-d39aa0ba149d; head 5e29a5f2dd92895d43afd8b9a10e23faab1f2155; red; log A-11163: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11163-suite-a66e2f41-f0c6-4061-a617-d39aa0ba149d-all-at-5e29a5f.log
Run 6e640cc0-4283-4995-9719-66cbe73239b2; head 512c4960bb573e8df6e215de8bceb509af8e7d6a; green; log A-11182: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11182-suite-6e640cc0-4283-4995-9719-66cbe73239b2-all-at-512c496.log
Run 5dcd19ce-b745-4bc4-8a5d-5a468187736d; head 1039defcfa6c68d941707d6ae0e6a72b74102ff4; green; log A-11187: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11187-suite-5dcd19ce-b745-4bc4-8a5d-5a468187736d-all-at-1039def.log

## Comments

### coord · 2026-10-24T14:21:41.665Z

Already fixed on dev: T-1246 (landed 32b505ff) seals the Neovim session-attach fixture environment that T-1012 changed. The periodic search confirmed the culprit 5e29a5f2 (T-1012) and that the file is green at 512c4960 and 1039defc. Closing as a duplicate of T-1246; T-1244 tracks the search filing bugs for regressions dev already fixed.

### coord · 2026-10-24T14:21:46.069Z

Duplicate of T-1246 (landed 32b505ff).
