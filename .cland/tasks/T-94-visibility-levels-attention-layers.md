---
id: T-94
kind: question
title: "Visibility levels: attention layers across the workbench"
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:46.891Z
updated: 2026-10-09T19:47:02.582Z
---

## Question

What are cland's visibility levels: the attention layers that decide what the human sees at once, what sits one key away, what hides behind filters and deeper panels, and what is reachable only on purpose?

## Context

Screen space is critically short: the human kept folding and switching panels. Agents produce events, artifacts (161 in v0: 80 by Implementers, 49 by Reviewers, 31 by QA, QA reports among them) and chatter that all land at the same depth; stopped sessions drown the live ones; done items fill the board; the Agents log mixes everything. The human wants layers: the top always at hand, the next behind one key or filter, deeper panels for the rest, agent-to-agent logs deepest but reachable because anything may be needed once. The sessions panel decision in the map's Notes (live grouped, stopped folded) is the first instance.

## To decide

- The layers: how many and their names (for example: now, soon, background, archive).
- Default placement by rule (author, addressee, kind, state, age): asks, verdicts and messages addressed to the human on top; reports and shared artifacts next; agent-to-agent traffic, stopped sessions, archived artifacts and done items below.
- How each surface shows a layer: inbox sections, thread folding, the Agents log, the sessions panel, the items panel, artifact lists, the top bar counts.
- How the human moves a thing between layers or changes defaults (config), and whether agents may mark a thing as top-layer.
- GLOSSARY entry (Layer or Visibility level) and the canvas mockups of the layered views.

Record the resolution as a comment, the spec section, the GLOSSARY entry and the canvas update.

## Comments

### human · 2026-10-09T19:47:02.041Z

Resolution (2026-10-09, the human accepted every point).

- Four layers: now (needs the human or changes their plan), watch (worth seeing, can wait), background (agent-to-agent traffic and bookkeeping, unfolded on purpose or in the Agents log), archive (closed and old, on explicit request).
- Default placement by surface: messages (to the human and asks now; the Coordinator's reports watch; agent to agent background; older than 7 days archive), inbox events (ask, approval, waiting topic, verdict not clear, died now; clear verdict, release, import, long idle watch; the rest Agents only), sessions (waiting and busy now, Aides always now; idle watch; stopped background), items (current release in work now; planned watch; backlog, unscheduled, done background; closed releases archive), artifacts (the human's own and those sent to the human watch; agents' reports background; archived archive).
- Surfaces show now and watch; background behind a fold or key; archive on action; the top bar counts now only; the inbox never shows background; agent-to-agent runs in a thread fold into one line; items panel filters are expressed through layers.
- Overrides: the human pins or mutes topics, sessions and artifacts (ui.json); agents raise only by addressing the human or asking; project defaults in a [visibility] table of config.toml.
- Visuals belong to the prototypes T-97 and T-99. GLOSSARY: Layer. No ADR.

Recorded in docs/spec/v0.1.md §3.5 and GLOSSARY.md.

### human · 2026-10-09T19:47:02.582Z

Resolved: see the resolution comment; spec v0.1 §3.5
