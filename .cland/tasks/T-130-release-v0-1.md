---
id: T-130
kind: release
version: 0.1.0
title: "Release: v0.1"
state: open
labels:
  - v0.1
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-09T23:02:37.189Z
updated: 2026-10-11T13:41:50.605Z
---

## Goal

v0.1 makes cland scale past one Coordinator over a flat crew and makes the workbench show less at once: a release above epics, explicit item status and order, a session hierarchy with crew configuration and event subscriptions, an epic plan, visibility levels, a session for the human, and the panel, palette, thread and graph work the v0 run asked for.

## Notes

Everything in docs/spec/v0.1.md section 3 is in v0.1; nothing is deferred. The release covers eleven epics: release and status; a quiet Coordinator; workbench basics; threads that read; the human's own session; criteria that live; leads and the crew; the epic plan; visibility and artifacts; the task graph; and release from the item.

Two lanes run in parallel: the hub lane 1 → 2 → 6 → 7 → 8 → 11 and the Neovim lane 3 → 4 → 5 → 10 → 9. Epic 5 also waits for 2; epic 11 waits for every other. The blocking edges stay on the epics.

The build uses what it has shipped: the release item first, item leads after epic 2, an Aide after epic 5, crew.toml after epic 7, and the epic plan for epics 8 to 11 after epic 8. The v0 tail is not a prerequisite and stays unscheduled.

Done means the human has run each epic's demo on v0.1; v0.1.0 ships with cland release --item, using this item's notes and its epics; and the run retrospective is an artifact.

## Comments

### coord · 2026-10-10T09:25:28.415Z

Run note (Coordinator working rule, from the stand-in on 2026-10-10): until the epic plan (T-114) lands, the Coordinator sets --status planned on the items it will launch next (the next stage's worth), so the board's planned section and its next mark mean something. Also in the Coordinator clause in .cland/roles.toml.

### coord · 2026-10-10T10:13:42.910Z

Open question for the human, set provisionally by the stand-in on 2026-10-10. For now, 'needs you' counts asks, approvals and topics waiting for you, and nothing else (T-169). Spec §3.5 also lists 'verdict not clear' and 'session died' as now-layer events. The proposal is that the hub counts them with resolution rules: a not-clear verdict resolves on a newer clear verdict or when the item closes; a death resolves on relaunch, a final stop or a dismissal. That is T-171, planned. Please confirm or change the rule.

### coord · 2026-10-10T11:53:29.344Z

Run note: the batch-merge rule (Coordinator working rule, approved by the stand-in on 2026-10-10).
- Small or Neovim-side deltas may merge before their own full suite. They must be review-clear (QA-clear where the gate needs it), clean on merge-tree against fetched dev, and green on targeted tests. A Neovim-only item also needs a green npm run test:nvim on its branch.
- After each batch of at most 2-3 such items, run one full npm test on integrated dev before any hub restart. A red integrated suite is reverted or fixed forward within the hour, and dev stays unreleasable until green.
- Hub-side items that touch launch, ownership, storage, routing or the merge gate keep their own full suite before merging.
- Note on each batched item's topic that it merged under this rule.

### coord · 2026-10-10T16:40:36.821Z

D16 (the human, via the stand-in, 2026-10-10 ~16:00Z): the human accepts the release at most, never each epic.
- An epic closes when all its children are closed and QA has run its definition-of-done demo on dev, with a clear verdict recorded on the epic (criteria verified by id, the same gate shape as items). There is no human step.
- The human's one acceptance is T-117's pass: the version, the notes and one walkthrough on v0.1.
Applied: spec §4 and the epics' Definition of done openings are amended; QA briefs written for T-107, T-109, T-110, T-111 and T-112; T-116 follows once T-162 lands. T-166 and T-171, the follow-ups filed under T-110, moved to T-115 (Visibility; the inbox and needsYou now belong to its classifier), so T-110 can close.

### coord · 2026-10-11T01:28:27.618Z

Integrated dev suite (batch rule) at a619490 green: hub 1099/1099, Neovim 252/252 (A-950). It covers T-187, T-162, T-177, T-190, T-201, T-207 and T-203 merged on their own runs; T-193 merged after with its own evidence. Hub restart requested.

### coord · 2026-10-11T06:36:26.364Z

Decisions from the human (direct, 2026-10-11 ~06:30Z, relayed by the stand-in):
D17 (answers the open question on T-130): not-clear verdicts and session deaths are not needsYou. needsYou means 'I must react', and these are informational. They go into the event log and inbox as events with a warn marker, never into the top-panel counter. T-171 is rescoped: the hub tags them as warn-level events for the classifier, and the inbox shows them that way, with no resolution rules and no counter. T-171 is unblocked.
D18 (release version, D11 satisfied): v0.1.0. The stand-in answers T-117's version ask with v0.1.0, citing this decision.
D19 (T-117 acceptance): the human does no acceptance pass. QA runs the T-117 walkthrough and closes it on a clear verdict, and the release goes out on that. The deferred checks T-109 C1 (Ghostty and tmux keys) and T-111 M7 (real-model Aide follow-through) are not release blockers. The release notes list them as 'verified in v0.1.1'.
D20 (tech debt leaves T-19): T-19 closes and stops being the catch-all parent. Tech debt lives in the standing container T-216 'Tech debt' (kind epic, no release parent, label tech-debt). The open tech-debt items moved there: T-102, T-103, T-129, T-137, T-147, T-170, T-174, T-202, T-204, T-209, T-211, T-212, T-213, T-214 and T-215.

### coord · 2026-10-11T13:41:50.605Z

Run note (cland-impl and the Coordinator, 2026-10-11 13:50Z): integrated dev suites. One full integrated run per batch of at most 3 merges. A batch skips its integrated run only when every item in it is Neovim-side and each passed its own run at a head that already contained the current dev tip. A batch with any hub-side item keeps its full integrated run, which T-214 always runs in full. The hub restarts only when the latest full integrated run covers every hub-side change on dev.
