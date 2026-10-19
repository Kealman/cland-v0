---
id: Q-863
kind: question
title: Ideas from the OpenRig study, for the triage after v0.2
state: open
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-19T10:04:03.112Z
updated: 2026-10-19T10:04:03.112Z
---

## Question

Which of these ideas go into the release planned after v0.2 ships? They come from the marketing session's study of OpenRig, the closest rival (2026-10-19). The human asked to record them now and to decide at that planning; nothing is designed or built before then.

## Ideas, ranked

Sizes are the study's estimates: S = a ticket, M = a small epic, L = an epic or more.

1. Install through the user's own agent: a person-facing `cland` skill (`npx skills add …`) that discloses changes, installs, runs init and setup, and ends with the human talking to the Aide. (M)
2. An agent-facing help page shipped with each version (help/agents.md): start from the user's goal, collect versions and `doctor --json`, a known-failures table, ends with the agent drafting a support message. (S)
3. Re-orient a session after compaction: PostCompact and prompt hooks re-deliver the role clause, rules, claimed item and open asks. (S–M)
4. A "parked" diagnosis: idle session × open obligations (claims, holds, unanswered asks, pending verdicts), a chip, an inbox line and one automatic nudge per episode. Targets the stalled-lead class in T-204. (M)
5. A rate-limited session gets one scheduled wake at its limit reset. (S)
6. A "what cland changes on your machine" table plus `init --dry-run` / `setup --dry-run`. (S)
7. Plain-command guidance in role clauses to avoid permission prompts (no pipes into interpreters, no $VARS, files via the file tool, one command at a time). (S)
8. A per-role capability map ("what cland can do for you") and a `whats-new.md` written for agents by `cland update`. (S)
9. Release notes with a "Not verified" section drawn from waived criteria and dispositions, plus thematic release names. (S)
10. One-command crew restore after a reboot, with an honest per-session outcome (resumed / fresh with brief / needs a decision). (M)
11. Check whether hub injection can clobber or submit a human's half-typed prompt; if so, hold deliveries while the composer is non-empty and show "held: N". The v0.2 web composer has the same question. (S to check, M to fix)
12. "Watch this for me" as a first-class Coordinator or Aide duty: a hub timer on an item that wakes its holder, plus a short skill, so watches survive compaction and handover. (S–M)
13. Generate the CLI reference from the hub's command registry at release time, stamped with the version. (S–M)
14. Test ideas: seeded-regression pairs (each gate test must fail on a planted fault), a stub runtime for zero-cost scenarios, live-model evals that check skills lead agents to the right cland commands. (M)
15. A workbench agents can drive: a hub API "open X in the human's workbench", or a polite "Coordinator suggests: open A-1234" chip; QA could drive the web workbench the same way. (M)
16. "One subscription" as a first-class path in docs, presets and onboarding (OpenCode free-model Implementers answer the "only for people with several max plans" objection). (S)
17. Later: shareable crew presets (L), joining an already-running session to the crew (M–L), multiple machines.

## Looked at and not recommended

Their Slack gateway (many bugs), their 87-command surface and coined vocabulary, fail-open gates, global trust and hook writes at daemon start.

## Source

The marketing session's write-up `research/openrig/features.md` in the private marketing repo: section 4 "Ideas worth taking" (with OpenRig file paths, issue numbers, sizes and fit), the comparison table in section 2, their pain points in section 5. The ideas are copied here because that repo is not reachable from this one.
