---
id: T-1397
kind: task
title: The gap line, the General mirror's filter, phone replies, the mute receipt and the card order become messenger-neutral
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by: []
topic: topic-1130
branch: t/T-1397-the-gap-line-the-general-mirror-s-filter
created: 2026-10-27T23:38:45.130Z
updated: 2026-10-28T00:12:31.931Z
closed: 2026-10-28T00:12:31.931Z
---

> Prefactor that edits Telegram files: it lands before E-1311's stage-2 Telegram lanes (T-1385, T-1387) start, and Telegram's existing tests must pass unchanged.

## Summary

A behaviour-preserving prefactor. The decisions Discord shares with Telegram move out of the Telegram files into neutral modules, and Telegram calls them: what General mirrors and under which author, the gap line, the phone reply model, the mute receipt and the oldest-first card order. Telegram's output and persisted keys stay unchanged.

## What to build

- **`mirrorOut(message, self)`** returns `null` for what is not mirrored: requests, answers, asks to the human, and the remote's own `via`. Otherwise it returns `{ header, text, silent }`. The authors are "you" from a workbench, "you (Telegram)" or "you (Discord)" from the other remote, and the agent's name otherwise. Progress notes and hub notices are silent.
- **`flushGap(store, clock, { matches, stateKey }, send)`** is `flushTelegramGap` with a job matcher and a state key. `flushTelegramGap` stays as a wrapper with `telegram.gap` and its current matcher.
- **The phone reply model.** The model holds a title, groups under bold labels and small lines last. `statusReply(project, status, releases, { connected, muted, outbox, label, extra })` takes `label` as "This chat" or "This channel" and `extra` as the gateway's own numbers. `helpReply(project, sections)` builds the help reply. `telegramStatus` and `telegramHelp` render the model to entities exactly as today.
- **`RemoteStore.applyMute(receipt, muted)`** generalises `applyTelegramMute`. Telegram keeps its `telegram.mute:<chat>:<message>` receipts, so a replayed `/mute` still applies once.
- **`inboxPublication(inbox, webOrigin)`** returns the open asks, the hub-answered approvals and the notices, oldest first with ties by id. `TelegramCards.publishInbox` uses it.

**Contract:** this changes no wire, frame or persisted shape. Internal consumers: `telegram.ts`, `telegram-cards.ts`, `telegram-commands.ts`, `telegram-gap.ts`, the Telegram tests through their existing imports, and `hub/README.md`'s remote section. It runs beside E-1311, whose Telegram tickets edit `telegram.ts`; see the plan.

## Acceptance criteria

- [x] C1. Every existing `hub/test/telegram-*.test.ts` passes with its assertions unchanged (test).
  - done: impl-1397 · 2026-10-27T23:43:30.996Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1397-final · 2026-10-28T00:01:45.265Z · commit 0542ab989de8a9ee219838bd936bfb5387d4caa2
- [x] C2. `mirrorOut` gives "you" for a workbench message, "you (Telegram)" for a Telegram one seen from Discord and "you (Discord)" seen from Telegram, returns `null` for the remote's own `via`, a request, an answer and an ask to the human, and marks progress notes and hub notices silent (test).
  - done: impl-1397 · 2026-10-27T23:43:31.409Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1397-final · 2026-10-28T00:01:45.265Z · commit 0542ab989de8a9ee219838bd936bfb5387d4caa2
- [x] C3. `flushGap` with a Discord matcher and state key counts sources once and leaves Telegram's missed rows and `telegram.gap` untouched (test).
  - done: impl-1397 · 2026-10-27T23:43:31.648Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1397-final · 2026-10-28T00:01:45.266Z · commit 0542ab989de8a9ee219838bd936bfb5387d4caa2
- [x] C4. The neutral status reply labels the remote's group "This chat" or "This channel" as asked, and `inboxPublication` orders asks, hub approvals and notices oldest first with ties by id (test).
  - done: impl-1397 · 2026-10-27T23:43:32.042Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1397-final · 2026-10-28T00:01:45.266Z · commit 0542ab989de8a9ee219838bd936bfb5387d4caa2
- [x] C5. `applyMute` applies once per receipt key, and a replayed Telegram `/mute` with an existing receipt still changes nothing (test).
  - done: impl-1397 · 2026-10-27T23:43:32.276Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1397-final · 2026-10-28T00:01:45.266Z · commit 0542ab989de8a9ee219838bd936bfb5387d4caa2

## Notes

Shared files: hub/src/remote/telegram.ts, telegram-gap.ts, telegram-commands.ts, telegram-cards.ts, state.ts; new hub/src/remote/mirror.ts, gap.ts, replies.ts

## Comments

### impl-1397 · 2026-10-27T23:41:54.467Z

Consumer inventory: internal helper extraction only; no wire, frame, schema or persisted shape changes. Production callers migrated: TelegramRemote.receive (mirrorOut), telegramStatus/telegramHelp (neutral model rendered by unchanged entity path), TelegramCards.publishInbox (inboxPublication), flushTelegramGap wrapper (flushGap), applyTelegramMute wrapper (applyMute). Existing helper imports retained for telegram-gap-fixture.ts and telegram-gap.test.ts. Repository search across hub, web, nvim, shared, docs, skills and QA found no external direct helper consumers; gateway snapshots, startup probes, persisted readers and T3/T4 consumers retain identical shapes/keys. All existing Telegram assertions remain untouched.

### rev-34 · 2026-10-27T23:45:00.735Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261027-1397-source1
commit: 0542ab989de8a9ee219838bd936bfb5387d4caa2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards 0 findings / Spec 0 findings. A-12940 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12940-t-1397-source-review-at-0542ab989.md) records full source and consumer review against fixed base e7297a5e. Mirror predicates/header/silent policy, gap captured-set replay and Telegram matcher/state/job prefix, mute transaction/old receipts, reply content/escaping and combined publication order are preserved. Existing Telegram tests are unchanged; five new T1 cases directly assert the neutral contracts with scratch SQLite/FakeClock and no native processes. Documentation/tier/index changes match the seams. C1–C5 remain runtime-unverified pending configured same-head evidence. A-12935 is explicitly a local macOS summary (26 files/278 reported passes), not original generated-case/Linux/full-suite proof. No tests or browsers run by Reviewer. Mode-free configured verification may proceed at this head; final audit needs its original receipt.

### rev-34 · 2026-10-28T00:01:45.266Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1397-final
commit: 0542ab989de8a9ee219838bd936bfb5387d4caa2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1–C5 verified. A-12963 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12963-t-1397-final-original-record-evidence-at-0542ab989.md) audits exact-head b48464fd/A-12961: 3772 ordinary passes/492 files, zero failures/cancellations/skips/todos, plus 50 separate load passes (25 neutral task samples, 25 site-doc samples). Each of the five new generated neutral identities passes base +5/5; max new base .033563868s/load .039206251s. Linux records include all 16 selected unchanged Telegram files/220 passing cases. Deferred telegram-polling-restart T3 is established separately by retained original A-12962 local macOS output: both exact SIGKILL identities pass, native exit0/no signal, no rerun; source unchanged through a tiers-format-only amendment. This is source-equivalent local proof, not Linux T3. Host T0/check passed; remote host-gate tree28c7ae58 reuse is explicitly not repeated Linux typecheck. Linux T1/all fallbackT2/Web completed; T3/T4 unrun in configured plan. Droplet c-8lon1 Linuxx64 6.8.0-142-generic Node24.21/Neovim0.12.5, isolated Chrome Headless Shell156.0.8078.4/build1248, workers2/Web4. Budgets/lint134 findings/ratchet report-only, one missing baseline and Web over-wall retained; not enforcing timing passes. Lifetime818s/$0.0568 is resource accounting. No provider/stageQA or LinuxT4 claim; Reviewer ran no tests/browser. Source A-12940 remains applicable.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-28T00:12:31.931Z

Merged 86f6a1b62443992767d38ecc1dd1ee0d559f3913 onto dev.
