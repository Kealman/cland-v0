---
id: T-297
kind: question
title: "OpenCode version hygiene: pin or follow, doctor's range and install hint, the two fragile points"
state: open
labels:
  - ready-for-human
  - hub
assignee: null
parent: T-294
blocked_by: []
topic: null
branch: null
created: 2026-10-12T16:20:57.000Z
updated: 2026-10-12T16:20:57.000Z
---

## Open question

From the T-295 research: v2.0.0 shipped on 2026-09-11 and cland's adapter is built on 2.0.24; three releases followed (2.0.27 on 2026-10-12, about one a day), nobody has run them, and doctor's tested range `>=2.0.24 <2.1.0` admits them silently; doctor's install hint leads to the v1 installer, which cland cannot drive; v1 users are told to run `opencode upgrade --major`. The API has been additive since 2.0.10 but 2.0.0 to 2.0.10 renamed 129 operations. Two fragile points: launch parses the `server listening on <url>` log line, and a rejected approval is reported as a server shutdown (upstream #54180).

To decide: pin or follow-with-a-check (re-verify the range at each release with the research's `openapi-digest.mjs` diff tool), the doctor hints (upgrade --major for 1.x, the v2 installer), and whether the two fragile points get a fix or a guard.
