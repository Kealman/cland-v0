---
id: Q-1290
kind: question
title: "Prior art: agent-to-messenger bridges and their failures"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.385Z
updated: 2026-10-25T11:44:08.227Z
closed: 2026-10-25T11:40:44.090Z
---

## Question

What do existing bridges between coding agents (or long-running assistants) and messengers teach a cland remote (map M-1286)? Sources: primary code and docs where available.

Cover: (1) BCAS's dropped Discord bot, cland's predecessor: the research/bcas-hub branch of this repo, docs/hub-extraction.md, closed items Q-2, Q-7, E-19 and T-21 in .cland/tasks, and /Users/evgeniyivanov/Projects/BratvaInc/bcas (read-only; never print a token): what it did, how it paired humans, how it handled asks, why it was dropped. (2) OpenRig's Slack gateway: the marketing session's write-up at /Users/evgeniyivanov/Projects/cland/marketing/research/openrig/features.md (sections 2 and 5, read-only) and OpenRig's own repository if public: what broke and why. (3) Other bridges: Telegram and Discord front-ends for Claude Code, Codex or OpenCode (search GitHub for recent projects), Home Assistant's Telegram bot, matterbridge, Zulip and Matrix bridges, OpenAI's or Anthropic's own messenger surfaces if any: pairing and allow-lists, catch-up after downtime, command sets, rate limiting, message splitting, buttons for questions, media and voice handling, how they avoid echo loops and duplicate deliveries, how they store tokens. Conclude with the failure classes to design against and the patterns worth copying, each with its source.

## Comments

### human · 2026-10-25T11:40:43.967Z

## Resolution (2026-10-25)

Findings: `docs/research/messenger-bridges.md` on branch `research/messenger-bridges` (commit 74b06b51, origin only, never merged; worktree /Users/evgeniyivanov/Projects/cland/messenger-bridges). Covers BCAS's dropped Discord bot (local ref research/bcas-hub 2f919450 and the BCAS repo), OpenRig's Slack gateway (48 defects: 22 issues and 26 fixes without an issue, lost inbound the largest class), Anthropic's and OpenAI's own surfaces (Claude Code's Telegram and Discord channel plugins in research preview, Remote Control, Claude in Slack and Tag, Codex Slack and mobile), community bridges for coding agents (claude-code-telegram, kimaki, takopi, cc-connect, opencode-telegram-bot, Claude-Code-Remote), OpenClaw (722 advisories), and mature bridges (Home Assistant's Telegram bot, matterbridge, mautrix, Zulip, Hubot, Errbot). Thirteen failure classes and fifteen patterns, each with its source.

What it settles:
- Bridges die quietly: the commonest serious failure is "alive but deaf" (polling dead, socket "connected", status green, found "because nobody answered"). Liveness must come from traffic, and the human learns of an outage in the chat and the workbench after a grace period, with a recovery notice.
- Loss sits at the acknowledgement: offsets advanced before the message was stored; two pollers or a restart inside the old long poll gave 409 loops; killing "the other poller" killed healthy ones. Store first, then confirm; dedupe by update id and by chat and message id; one OS-held poller lock; ride out a 409 at start and kill nothing.
- Asks break on meaning: a typed empty answer counted as consent, an earlier message answered a later question, two surfaces both answered, approvals were broadcast to every allow-listed user, a repeated id approved another prompt. Copy: first answer wins everywhere, the answer is stored before the platform ack, every copy of the card loses its buttons, stale and foreign taps get a reply, late messages never answer, a reply answers only its own card.
- Security: authorize every update type before any work, downloads included; identity by numeric ids never usernames; capped pairing (single use, about 1 hour, at most 3 pending, no ambiguous characters); a 0600 token file checked at start, redacted logs, platform hosts only, and no Telegram file URL in a session's hands because it embeds the token.
- Pairing direction is a grilling question: every messenger bridge read issues the code in the chat and approves on the trusted side (Claude Code channels, OpenClaw, Claude Tag); the map's CLI-issued code redeemed in the chat appears only in vendor apps (Codex mobile, Happy), and whoever redeems a leaked code first is paired.
- Delivery: one durable outbox per token that merges edits, honours `retry_after` with a cap, records an attempt before sending and resends only what provably never left; a gap line instead of a replay; late stays late and outbound items whose source closed are dropped; split after markup conversion with numbered parts and never let a parse error drop a message; a new message for completion, edits for progress; register commands only on change (setMyCommands at every start earned 490-second waits); capped backoff with jitter and RESUME before IDENTIFY (Discord token resets after about 1,000 identifies a day).
- BCAS: no pairing, only an env allow-list of handles; the token in a root 0600 env file; owner-only asks with the edit kept as a retried debt; a 103-character command description crash-looped the whole hub; a restart forgot which post belonged to which agent; dropped because it was bound to one project and Discord leaked into the core.
- M-1286's settled shape (outbound only, one bot per project, a hub-held mirror, a gap line) avoids several classes outright.

Unverified: the causes in takopi #252/#254, cc-connect #1577, OpenClaw #58611 and #9650 are the reporters' own; the BCAS outage loss is read from code; four of OpenRig's 24 issues only mention Slack; multiple-choice relay in Claude Code channels is inferred.

### human · 2026-10-25T11:44:08.227Z

Branch note (2026-10-25): a provenance pass followed; research/messenger-bridges now ends at ffee79d8 (on top of 74b06b51), with a provenance line (BCAS and cland facts from their own sources, everything else from the five reader reports, 16 re-checked citations marked with a dagger) and the 'Not verified' list trimmed to claims in the body.
