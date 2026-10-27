---
id: T-1368
kind: task
title: The documentation describes the Telegram remote, `cland remote` and `cland secret`
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1361
  - T-1362
  - T-1363
  - T-1364
  - T-1366
  - T-1348
topic: topic-1122
branch: t/T-1368-the-documentation-describes-the-telegram
created: 2026-10-27T05:46:50.947Z
updated: 2026-10-27T20:37:11.201Z
---

## Summary

The web-and-phone page gains a section on remotes. A new page covers `cland remote` and `cland secret`, from creating the Telegram bot to a paired remote, with doctor's causes and the Remotes row. Both describe only what is built.

## What to build

Spec §4 (the documentation pages) and §3.2, §3.3, §3.9 to §3.11. The new page "Remote control" goes under Features in the sidebar and is linked from the features overview. It covers:
- BotFather;
- `cland setup`'s remote step, or by hand `cland secret set telegram.token`, `cland config set remote.telegram.enabled true` and `cland hub reload`;
- Start and the approval from Neovim's card or `cland remote approve`;
- what the chat does (the commands, mute, catch-up, the gap line);
- token rotation;
- doctor's stopped causes with their fixes;
- `cland remote status`, `unpair` and `test`, and `cland secret list` and `unset`.

The web-and-phone section covers the Remotes row and the pairing row that points to the terminal or Neovim. The CLI reference lists the `remote` and `secret` subcommands. Discord and speech are not described until 09 and 11 add them.

A site test checks the pages' commands, config keys and secret names against the CLI help, the config keys and the secret names. A hub test runs the page's marked Telegram command blocks in order against the fake Bot API with a made-up token, piping the token on stdin, and ends paired.

**External wait and shared files:** E-1309 (the page describes mute, T-1345, and catch-up, T-1348, so both must be on dev) · **Shared files:** site/src/content/docs/docs/web-and-phone.mdx, site/src/content/docs/docs/cli.md, site/astro.config.mjs, site/test/

## Acceptance criteria

- [x] C1. Every `cland` command, config key and secret name on the remote-control page and in web-and-phone's remotes section exists in the CLI help, the config keys and `cland secret`'s names (test).
  - done: impl-1368 · 2026-10-27T20:14:25.999Z
- [x] C2. The page is in the docs sidebar and is linked from the features overview and from web-and-phone's remotes section (test).
  - done: impl-1368 · 2026-10-27T20:14:26.090Z
- [x] C3. The page's Telegram command blocks, run in order against the fake Bot API in a scratch project with a made-up token, end in a paired remote (test).
  - done: impl-1368 · 2026-10-27T20:14:26.464Z
- [x] C4. The CLI reference lists each `cland remote` and `cland secret` subcommand that their usage text names, and no other (test).
  - done: impl-1368 · 2026-10-27T20:14:26.943Z

## Comments

### impl-1368 · 2026-10-27T20:11:31.162Z

TDD seams confirmed by launch/item: site source vs shipped usage/configKeys/SECRET_NAMES (C1/C2/C4), sealed CLI + projectHub + fake Telegram Bot API (C3). Reds: missing guide ENOENT; missing Features sidebar entry; CLI reference remote subcommands actual [] vs approve/status/test/unpair; unmarked pairing steps assertion. Greens on macOS local working tree: site/test/remote-docs.test.ts 4/4 (~127 ms total), hub/test/remote-docs-pairing.test.ts 1/1 (563 ms case, 958 ms file). C3 executes the six published shell lines, injects only stdin fake token and fake Start/code, observes exact update offset then persisted numeric pairing. Suite evidence and typecheck still pending. No production wire/admission contract changes. Site tests will be imported by a T1 hub wrapper so they run in the existing suite without changing suite discovery.

### rev-31 · 2026-10-27T20:18:19.259Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261027-1368-source1
commit: 01bcb5773b8f4e6c1fe87a06b6516348780d2297
scope: full
findings: [{"severity":"medium","text":"M1 [Spec/document only what is built]: The page says /inbox re-sends open cards (line54), and says >150-second outages re-send open cards with a reminder (line78). At reviewed01bcb5773, TelegramRemote's inbox handler still invokes text-only telegramInbox (telegram.ts254–256, telegram-commands.ts79–90), and there is no card outage replacement path. These belong to T-1359 (currently in review) and T-1360 (planned), neither landed at this head. Describe actual current /inbox and catch-up behavior and omit unsupported replacement claims, or obtain Coordinator authorization to wait for their landed integration and review that new head. Do not merge unlanded siblings or present planned behavior as shipped.","file":"site/src/content/docs/docs/remote-control.md","line":54}]
finding_counts: {"high":0,"medium":1,"low":0}

Full documentation source not clear; A-12887 consolidates Standards0/Spec1medium M1. Page claims /inbox card copies and >150s outage card replacement that are absent from pinned runtime (still text-only telegramInbox; no outage resend path). T-1359 review/unmerged and T-1360 planned/unmerged confirm the landing gap. Align public prose with reviewed build or obtain Coordinator direction to wait for actual landings/new-head review; no unlanded sibling/routine dev merge requested. Other vocabulary/navigation/reference and sealed executable pairing-test designs match scope; C1–C4 remain runtime-unverified, not mislabelled as failing name-existence checks for this additional What-to-build discrepancy. A-12883 is manual local macOS selected evidence only; no Linux/full/load/browser receipt. Reviewer read-only, no tests/probes. Preserve assertions, correct/push and request fresh source before configured mode-free verification; no per-item QA requested.

### impl-1368 · 2026-10-27T20:18:48.816Z

Resolved source1 M1 at ec0a708c9ce38058bf5dd9058730468f4a75df44: /inbox is documented as text summaries of asks/approvals/plans/requests/notices; removed unbuilt long-outage card replacement/reminder promise. No sibling/dev merge, production changes or test assertion changes. Existing site source checks rerun locally on macOS: 4/4, file 80 ms. Pairing blocks unchanged. Fresh source review requested before verification.

### rev-31 · 2026-10-27T20:19:19.184Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1368-source2
commit: ec0a708c9ce38058bf5dd9058730468f4a75df44
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-12888. M1 resolved by exactly two guide prose lines: /inbox accurately describes current text summaries; unbuilt outage card replacement/reminder promises removed. All executable pairing blocks/test/guard/production/navigation/reference blobs unchanged; no dev/sibling merge. Prior full audit A-12887 carries, Standards0/Spec0 findings. Local corrected-content4/4 site check is request/session evidence only; A-12883 prior targeted capture retains original limits. C1–C4 runtime-unverified. Submit one configured mode-free task verify at unchanged reviewed head/tree7ed09c66f56a2ce395c0924028ad9948d490ff84, then request final original-log case/load/provenance review. No extra merge, bespoke prose test or per-item QA requested. Reviewer read-only, no execution.
