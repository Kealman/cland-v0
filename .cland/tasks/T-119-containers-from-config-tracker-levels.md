---
id: T-119
kind: task
title: "Containers from config: [tracker] levels replaces the hard-coded container kinds; a container with open children cannot close"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by:
  - T-118
topic: null
branch: null
created: 2026-10-09T21:56:19.667Z
updated: 2026-10-09T21:56:19.667Z
---

## Parent

T-107 (v0.1 release and status), slice 2 of 6. Spec §3.1 (Levels, Parenting rule, Closing a container, Tools).

## What to build

Container kinds come from `levels` in `.cland/config.toml`, `[tracker] levels = ["release", "epic"]` by default, ordered top-down. They replace every hard-coded container kind in the hub, the item parser and the CLI; the sizing counted about twenty sites. Leaf kinds stay fixed: `task`, `question` and `spec`. `map` stays outside the ladder, and its children are questions. The parenting rule from slice 1 now reads the configured levels. An item file whose kind is neither a configured level nor a leaf is refused when indexed, with a notice naming the file. It is never dropped silently.

Closing a release or an epic with open children is refused by the hub, with no force flag. The refusal names the open children. `cland init` writes the default `[tracker] levels`, and `cland update` keeps a changed value.

## Acceptance criteria

- [ ] With the default config, behaviour matches slice 1. In a scratch project with `levels = ["release", "epic", "feature"]`, a feature under an epic is accepted, and a feature under a release is refused.
- [ ] An item file with an unknown kind is refused when indexed, with a notice, and the rest of the tracker still loads.
- [ ] Closing the v0.1 release item, or an epic, with open children is refused and names them; with all children closed it succeeds.
- [ ] No container kind is hard-coded outside the config defaults, which a test proves, for example by a search over `hub/src` in the test suite.
- [ ] `cland init` writes the levels; `cland update` keeps a changed value; `hub/README.md` documents `[tracker] levels`.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Risk from the sizing: the hard-coded kinds are spread across the hub, so sweep them all in one change, and do not convert them one example at a time (A-96, class G). Defaults against instances: this project's `.cland/config.toml` does not inherit a new default, so list the exact line it needs in your report, and the Coordinator commits it.
