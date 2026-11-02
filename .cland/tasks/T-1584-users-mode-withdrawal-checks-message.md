---
id: T-1584
kind: task
title: Users-mode withdrawal checks message ownership by user id
state: open
status: ready
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1561
  - T-1570
topic: topic-1323
branch: t/T-1584-users-mode-withdrawal-checks-message
created: 2026-11-01T19:56:29.775Z
updated: 2026-11-02T05:59:09.559Z
---

## Summary

In users mode, a person may withdraw only the ordinary messages they wrote themselves. The check compares the message's persisted user id with the trusted caller's user id, never the display author name. Single mode keeps today's `from = human` fence.

## What to build

Withdrawal of an ordinary human message in users mode checks ownership through the attribution T-1561 persists. Core's withdrawal-reason check and the web message block's withdraw affordance both use the persisted user id against the signed-in caller. Another user's message offers no withdraw action and a crafted withdrawal is refused with a reason naming ownership. Messages written before attribution (no user id) stay withdrawable only by the admin, as in single mode.

Found by impl-1561 while building T-1561 (topic-1306, 2026-11-01 19:56Z); T-1561 keeps the existing fence and grants no cross-user authority.

## Acceptance criteria

- [x] C1. In users mode, the author of an ordinary human message can withdraw it; the hub checks the persisted user id against the trusted caller's user id.
  - done: impl-1584 · 2026-11-02T05:34:20.184Z
  - verified: rev-38 [reviewer] · run rev-38-1584-evidence-1 · 2026-11-02T05:59:07.569Z · commit 95d3c0facc4c3a16b8d961fc098f070d0384eaef
- [x] C2. In users mode, another user's withdrawal of that message is refused by the hub with a reason naming ownership, and the message stays unchanged.
  - done: impl-1584 · 2026-11-02T05:34:20.437Z
  - verified: rev-38 [reviewer] · run rev-38-1584-evidence-1 · 2026-11-02T05:59:07.569Z · commit 95d3c0facc4c3a16b8d961fc098f070d0384eaef
- [x] C3. The web message block offers the withdraw action only on the viewer's own messages in users mode; single mode is unchanged.
  - done: impl-1584 · 2026-11-02T05:34:21.636Z
  - verified: rev-38 [reviewer] · run rev-38-1584-evidence-1 · 2026-11-02T05:59:07.569Z · commit 95d3c0facc4c3a16b8d961fc098f070d0384eaef
- [x] C4. A message without a persisted user id (written before attribution) is withdrawable only by the admin in users mode.
  - done: impl-1584 · 2026-11-02T05:34:22.703Z
  - verified: rev-38 [reviewer] · run rev-38-1584-evidence-1 · 2026-11-02T05:59:07.569Z · commit 95d3c0facc4c3a16b8d961fc098f070d0384eaef
- [x] C5. No ownership decision reads the display author name; a test where two users share a display name proves it.
  - done: impl-1584 · 2026-11-02T05:34:24.439Z
  - verified: rev-38 [reviewer] · run rev-38-1584-evidence-1 · 2026-11-02T05:59:07.569Z · commit 95d3c0facc4c3a16b8d961fc098f070d0384eaef

## Comments

### impl-1584 · 2026-11-02T05:29:59.675Z

Consumer inventory (rule 20): core eligibility projections (message/delivery/history/thread), dispatch topic.withdraw, web MessageBlock/connection/web.session, shared TopicMessage and WebSessionResult, topic-threads, spoke tools/protocol. Tests: topic-withdraw, web-authority, human-routing, topics/component, store, Claude/Codex/OpenCode adapters, web withdraw/phone-composer/message-users. Docs: hub/README, web/README, nvim/README, implement skill; QA E-417 stage briefs. No wire shape change planned; withdrawable remains delivery eligibility with viewer ownership applied in web. Existing single-mode consumers remain unchanged; new tests cover prior web.session shape.

### impl-1584 · 2026-11-02T05:32:20.545Z

Implementation adds optional legacyUser on projected human rows whose persisted messages.user_id is null, preserving first-user attribution. shared/wire/message-ownership.ts supplies the ownership predicate to core and web; connection retains existing web.session.user.role locally (no session reply change). Core ownership is checked against a freshly loaded trusted caller id, independently of delivery eligibility and existing userAuthorityRefusal. Red receipt: topic-withdraw users test failed with 'only the human’s own ordinary messages can be withdrawn'; web new case failed waiting for owner's Withdraw under original MessageBlock. Green local macOS: topic-withdraw 7/7; isolated pinned Headless Shell web withdraw 9/9. Full verification has not run.

### impl-1584 · 2026-11-02T05:34:13.328Z

Final inventory update: additive optional Message.legacyUser is restated in hub protocol/shared wire and set only by Store from persisted null user_id. All production projections preserve it by spreads; old clients ignore it. New client compatibility test strips web.session.user and message attribution to previous human/from shape. Local topic.withdraw now enters the existing userAuthorityRefusal seam as well, using first user without adding --as selection; tests cover freshly changed stored roles on both web and local callers. No other role system added.

### rev-35 · 2026-11-02T05:38:26.801Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1584-source-1
commit: 97d07be214eca0c1b504d45b50c9343f8e6a0004
scope: full
findings: [{"severity":"low","text":"The Withdraw description still says the action follows withdrawable alone; document the additional users-mode owner-id check and admin-only legacy exception so the web guide matches MessageBlock.","file":"web/README.md","line":932}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear at corrected exact head 97d07be214eca0c1b504d45b50c9343f8e6a0004. Low: web/README.md:932 omits the users-mode owner-id and admin-only legacy affordance conditions; update its Withdraw description (rule 16). No high/medium findings. Standards and spec review in A-15584 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15584-t-1584-source-review-at-97d07be214.md). Shared ownership predicate, persisted-null legacy marker, fresh trusted caller lookup, local/web role preflight and single-mode delivery fences match C1–C5. Source review only; no tests run by reviewer. All C1–C5 remain unverified pending named same-head queued verification; reported local targeted/typecheck/lint evidence is not a queued receipt.

### rev-35 · 2026-11-02T05:39:12.483Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1584-source-2
commit: 95d3c0facc4c3a16b8d961fc098f070d0384eaef
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 95d3c0facc4c3a16b8d961fc098f070d0384eaef. Previous low resolved: web/README.md now documents persisted-id ownership, display-name exclusion, admin-only legacy exception, single-mode fence and independent hub role admission. Entire delta from source-1 is that documentation paragraph; code/tests unchanged, prior standards/spec analysis A-15584 carries forward. Refreshed review A-15585 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15585-t-1584-refreshed-source-review-at-95d3c0fa.md). No findings. Source only; no tests run by reviewer. C1–C5 remain unverified pending named same-head queued evidence.

### rev-38 · 2026-11-02T05:59:07.569Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1584-evidence-1
commit: 95d3c0facc4c3a16b8d961fc098f070d0384eaef
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; no findings. Source verdict rev-35-1584-source-2 / A-15585 carries forward at unchanged 95d3c0facc4c3a16b8d961fc098f070d0384eaef. Independently checked A-15600 named outcome:pass receipts for persisted-id ownership and forged caller refusal, unchanged queued row, admin-only legacy policy, same-display-name users, desktop/phone affordances and previous-wire fallback; hub/web message-users preservation also passes. Run 4d5d2385-8c5f-4940-96e8-64a73a1eb8b1 matches task.verify/head and candidate tree outside documented tracker/rulebook exclusions. 4703 reported cases pass: T0, all T1/T2 fallback, Web and one selected T4 guard base execution; remaining T3 deferred to merge batch, T4 repetitions unexecuted. Uncached Linux x64 droplet / Node v24.21.0 / Neovim v0.12.5; isolated Headless Shell 1248, Google Chrome for Testing 156.0.8078.4. Budgets/lint report-only. Reviewer ran no tests/browser. C1–C5 verified using prior source review plus this exact-head evidence; after-stage QA stays separate. Full criterion-to-case mapping and boundaries: A-15604 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15604-t-1584-final-evidence-review-at-95d3c0fa.md).

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
