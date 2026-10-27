---
id: T-1368
kind: task
title: The documentation describes the Telegram remote, `cland remote` and `cland secret`
state: closed
status: done
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
updated: 2026-10-27T21:05:28.210Z
closed: 2026-10-27T21:05:28.210Z
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
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final1 · 2026-10-27T20:39:56.475Z · commit ec0a708c9ce38058bf5dd9058730468f4a75df44
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final2 · 2026-10-27T20:58:32.182Z · commit e7112a07908923fc44f0ea61801efb2a8f8ccd12
- [x] C2. The page is in the docs sidebar and is linked from the features overview and from web-and-phone's remotes section (test).
  - done: impl-1368 · 2026-10-27T20:14:26.090Z
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final1 · 2026-10-27T20:39:56.475Z · commit ec0a708c9ce38058bf5dd9058730468f4a75df44
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final2 · 2026-10-27T20:58:32.182Z · commit e7112a07908923fc44f0ea61801efb2a8f8ccd12
- [x] C3. The page's Telegram command blocks, run in order against the fake Bot API in a scratch project with a made-up token, end in a paired remote (test).
  - done: impl-1368 · 2026-10-27T20:14:26.464Z
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final1 · 2026-10-27T20:39:56.475Z · commit ec0a708c9ce38058bf5dd9058730468f4a75df44
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final2 · 2026-10-27T20:58:32.182Z · commit e7112a07908923fc44f0ea61801efb2a8f8ccd12
- [x] C4. The CLI reference lists each `cland remote` and `cland secret` subcommand that their usage text names, and no other (test).
  - done: impl-1368 · 2026-10-27T20:14:26.943Z
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final1 · 2026-10-27T20:39:56.475Z · commit ec0a708c9ce38058bf5dd9058730468f4a75df44
  - verified: rev-31 [reviewer] · run rev-20261027-1368-final2 · 2026-10-27T20:58:32.182Z · commit e7112a07908923fc44f0ea61801efb2a8f8ccd12

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

### rev-31 · 2026-10-27T20:39:56.475Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1368-final1
commit: ec0a708c9ce38058bf5dd9058730468f4a75df44
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged ec0a708c9ce38058bf5dd9058730468f4a75df44, tree 7ed09c66f56a2ce395c0924028ad9948d490ff84. Independent original A-12895 audit recorded in A-12897 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12897-t-1368-final-exact-head-documentation-evidence-audit.md). Configured mode-free c4fa8fb3-a34b-4acf-a05d-28976e5e5120 finished exit 0: 3748 ordinary passing finishes, zero failures/cancellations/skips/TODO, plus 30 separate passing load finishes for six exact identities, each 5/5. Site vocabulary/negative controls/navigation/subcommands, runtime vocabulary equivalence and published Telegram pairing command blocks all have actual base and load finishes. Maximum new sample 1.615915075 s; no new >=3 s allowance required. Verifies C1–C4, carrying source2 A-12888 and resolved M1. T0/all T1/fallback all hub+Neovim T2/Web completed; T3/T4 absent, deferred per configured policy. Linux x64 6.8.0-142-generic, droplet c-8 sfo2, Node24.21.0/Neovim0.12.5, Headless Shell156.0.8078.4/Playwright v1248, workers2; lifetime966s/cost$0.0671 are machine accounting. Host gate TREE fde3ecb1d4a0cfbc93d180bfca24421693b4f055 reused, not another source commit or remote typecheck. Timing/lint/ratchet report-only; 134 lint findings/61 files, two missing new-file baselines and existing overruns retained. Web zero new-file repetitions required. No live-platform or rendered-site acceptance claim. Coordinator owns ready/enqueue and separate integrated verification; no extra merge or run requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1368 · 2026-10-27T20:41:24.177Z

Coordinator shared-change instruction 8d1aef01 authorized post-review merge of dev 77cb4c6d (includes T-1359). Merged that exact commit, then updated /inbox to live copies of open asks/approval cards/📥 notices at bottom oldest first, retained older-copy/all-copy outcome behavior, and stated oldest-first new-card bursts. Checked landed telegram-commands.ts menu/help and telegram-cards.ts publishInbox/copy outcome paths. T-1360 outage replacement remains omitted. New head e7112a07908923fc44f0ea61801efb2a8f8ccd12, tree 49a39e62e8edaf161b310f3d57a7373ebc28a3d5, pushed and clean. Local macOS checks at new content: hub documentation wrapper 5/5 (117 ms file), pairing 1/1 (568 ms case/974 ms file), root npm run typecheck and diff check pass. Prior Linux suite and criterion verification belong to ec0a708c9 and do not certify the changed head. Fresh source review then one new mode-free verify/final evidence review required.

### rev-31 · 2026-10-27T20:42:48.848Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1368-delta1
commit: e7112a07908923fc44f0ea61801efb2a8f8ccd12
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge/documentation source delta clear, A-12900. Independently verified merge72f12d4ae parents ec0a708c9 and exact Coordinator-authorized dev77cb4c6d (decision8d1aef01), followed only by two guide paragraph edits at e7112a079/tree49a39e62. Landed /inbox source publishes live mixed cards/notices oldest-first with prior callbacks retained and all-copy outcomes; new prose matches telegram.ts254–258, telegram-cards.ts132–141/144–152/191–207 and telegram-commands.ts48. Unlanded T-1360 outage replacement remains omitted. Same17 task paths; executable pairing blocks/tests/guards/tiers/navigation/reference retain prior reviewed blobs; shared skill/README additions preserved beside upstream work. Standards0/Spec0 findings, prior full source2 A-12888 carries. Local wrapper5/5/pairing1/1/typecheck are request-level macOS selected evidence only. Prior final1/A-12897 and Linux A-12895 certify ec0a708c9 only; C1–C4 done marks remain but verification is stale at this head. Submit one configured mode-free verify at unchanged e7112a079, then request exact-head original-log named-case/load/phase evidence review. No extra merge or per-item QA requested. Reviewer read-only, no execution.

### rev-31 · 2026-10-27T20:58:32.182Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1368-final2
commit: e7112a07908923fc44f0ea61801efb2a8f8ccd12
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-12906 independently audits original A-12904 at unchanged e7112a07908923fc44f0ea61801efb2a8f8ccd12/tree49a39e62. Mode-free configured d2d87473 finished exit0:3754 ordinary passing test finishes, no failure/cancel/skip/TODO, plus30 separate passing load finishes for six exact identities each5/5. All page vocabulary/negative controls, navigation/reference, runtime-name equivalence and executable stdin-token pairing flow have actual base and load finishes; pairing base1.181130523s/loadmax1.188314309s. No new>=3s allowance required. Verifies C1–C4, carrying full source2 and authorized delta A-12900; T-1360 outage replacement remains omitted. T0/allT1/fallback all hub+NeovimT2/Web complete (29.974/72/397/151s outer phase durations); T3/T4 absent, deferred per configured policy. Linuxx64 dropletc-8sfo2, Node24.21.0/Neovim0.12.5, HeadlessShell156.0.8078.4/v1248,workers2,lifetime776s/cost$0.0539 machine accounting. Host gate TREE9f915c5086799fb1898da48e95efec81a7f837e4 reused, not remote typecheck or alternate candidate. Report-only lint/timing/ratchet retain134findings/61files,two missing baselines,existing overruns; Web0newfile repetitions required. No live-platform/rendered-site/integrated-all acceptance claim. Old ec0a708c9 run/final1 remain historical. Coordinator owns ready/enqueue/separate integrated gate; no extra merge, run or per-item QA requested. Reviewer read-only, no execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-27T21:05:28.210Z

Merged ac24dd08ca54fd465359eb5afe0b630d7494fce5 onto dev.
