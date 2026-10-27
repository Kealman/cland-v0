---
id: T-1342
kind: task
title: "Pairing on Telegram: start, codes, the t.me link and a blocked bot"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: topic-1094
branch: t/T-1342-pairing-on-telegram-start-codes-the-t-me
created: 2026-10-26T19:09:06.499Z
updated: 2026-10-27T00:18:06.935Z
closed: 2026-10-27T00:18:06.935Z
---

## Summary

Pairing on Telegram: `/start` in an unpaired chat gives the code, the sender's id and the approve command; `/start` in the paired chat names the project; and `cland remote status` prints the bot's `t.me/<bot>` link. A blocked bot stops sending and reports it.

## What to build

Wire T-1332's codes and limits and T-1333's approval to the Telegram client. Detect a block from the membership update and a 403, stop sending, and report it in General and `cland remote status`. Spec §3.2.

## Acceptance criteria

- [x] C1. On the fake, a stranger's `/start` gets a code with their id and the approve command and at most two replies, `cland remote approve telegram <code>` pairs the human, and `/start` in the paired chat names the project (test).
  - done: impl-1342 · 2026-10-26T23:26:41.471Z
  - verified: rev-26 [reviewer] · run rev-20261027-1342-evidence-1 · 2026-10-27T00:12:08.540Z · commit a9e238aa407d768f65da3b2b220669736fdf266c
- [x] C2. After the fake reports the bot blocked, through a membership update and then a 403, the remote stops sending and reports it, and `cland remote status` shows the `t.me/<bot>` link (test).
  - done: impl-1342 · 2026-10-26T23:26:41.590Z
  - verified: rev-26 [reviewer] · run rev-20261027-1342-evidence-1 · 2026-10-27T00:12:08.540Z · commit a9e238aa407d768f65da3b2b220669736fdf266c

## Comments

### impl-1342 · 2026-10-26T23:18:51.065Z

Read E-1309/spec §§3.2, 3.4, 3.7, 3.9, 3.10, 3.12/§4 and GLOSSARY. Pre-agreed TDD seams: production projectHub frame/CLI plus loopback fake Bot API. Consumer inventory (rule 20, before policy change): TelegramRemote start/run/test/status/pairingReplaced and production messengerFactory/daemon, Telegram polling first-match handlers and stored pairing/update/dedupe readers; Gateway disable/status/test and ConfiguredGateway; remote.status dispatcher/CLI and doctor/native workbench status consumers; pairing callback/PairingCodes/approval frames; test fakes/messenger, telegram-polling-fixture, telegram-polling and restart T3, telegram-messenger, telegram-api, remote-cli (legacy shape), gateway/state/secrets/config-set, pairing-codes/approval/service, project-hub-lifecycle/cli-imports, all-tier search incl QA E-1308 and shipped implement skill. No wire/schema fields removed or added. Existing explicit handlers retain priority and all legacy signatures remain valid. Changes: attach native private /start after injected handlers, paired membership failure via existing disable path, retain botLink/traffic on disabled native remotes, sanitized General notice helper coordinated with T-1349. Other consumers retain existing contracts; T2 previous-hub remote-cli coverage retained. New telegram-pairing.test.ts covers C1/C2 through native factory, CLI approval/status, durable next-poll offsets and native close receipts.

### rev-26 · 2026-10-26T23:28:57.049Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1342-source-1
commit: 70257a77a489b337869aebaf01dee1f13ec1cfc7
scope: full
findings: [{"severity":"medium","text":"M1: REMOTE_USAGE adds two pairing/blocked-bot help lines but the owning frozen row in hub/test/fixtures/cli-usage/commands.json is unchanged. Preserve existing compatibility/help byte guards, reproduce their red and correct only the owning row with original green receipts.","file":"hub/src/cli/usage.ts","line":67}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec audit complete at fixed base 72ad5a9f9b3cb7db16d91ef0a728369c8de9af4d. Exactly one Standards M1; no additional Spec findings. Native pairing/stranger limits, CLI grant, fatal stop/notice, disabled link retention and consumed-kick restart tests audited. Coordinator's shared helper/second-lander and T-1349 reload-recovery scope decisions read directly; no missing-feature finding for that approved split. A-12513: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12513-t-1342-full-source-review-at-70257a77a-frozen-help-m1.md. Working-tree correction report is separate from this reviewed commit. No Reviewer execution/delegation. C1/C2 runtime pending. Fresh corrected pushed-head source review precedes the Coordinator-disposed verification occasion; no additional full run requested.

### rev-26 · 2026-10-26T23:29:38.287Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1342-source-2
commit: a9e238aa407d768f65da3b2b220669736fdf266c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full Standards/Spec source clear, retaining A-12513 full audit. M1 resolved: only owning REMOTE_USAGE frozen row adds the exact two shipped help lines; guards, other rows and all production code unchanged. Actual pushed head a9e238aa4 reviewed; placeholder 02c012d excluded. A-12510 local original red/green remains targeted Mac evidence only. Detailed A-12514: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12514-t-1342-full-source-clearance-at-a9e238aa4.md. No dev merge, Reviewer execution or delegation. C1/C2 runtime pending the Coordinator-disposed same-head verification occasion; this does not request an additional full run. Approved shared helper/T-1349 recovery scope unchanged.

### rev-26 · 2026-10-27T00:12:08.540Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1342-evidence-1
commit: a9e238aa407d768f65da3b2b220669736fdf266c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1/C2 verified from original Coordinator all run b28605c7-d11e-4fa9-9d4d-21728d9ac7f0 / A-12526. Independently deduplicated 4896 ordinary passes + 8 reasoned unrelated skips, zero failures/cancellations/TODO; no separate load-gate repetitions. T0/T1/T2/T3/Web completed exit 0; T4 absent. Three exact Telegram pairing/membership/403 cases pass at 0.614735409/0.485205583/0.389369046 s, retaining native closure, fixed durable notice, CLI link/traffic, stopped-send and consumed-kick restart assertions. Related legacy/help/polling receipts pass. Linux x64 droplet c-8 lon1, Node24.21.0/Neovim0.12.5, isolated Headless Shell156.0.8078.4/v1248. Budgets/lint/ratchet remain report-only; host typecheck prepared tree e8b96096 was not repeated remotely. Detailed audit A-12527: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12527-t-1342-final-same-head-evidence-clearance-at-a9e238aa4.md. Source A-12514 retained. Coordinator decision7cc15aa2/A-12516 keeps this head: T-1349 owns long-description cause/fix ordering/regression and unchanged-reload recovery before E-1309 DoD; no claim those edges are fixed here. No Reviewer execution/delegation. Coordinator owns landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T00:18:06.935Z

Merged 0c8025a1539a25b2b372a5ece69b25529745f842 onto dev.
