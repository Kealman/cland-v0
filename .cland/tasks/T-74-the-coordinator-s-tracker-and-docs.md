---
id: T-74
kind: task
title: "The Coordinator's tracker and docs commits have no sanctioned path to the territory's dev: the hook refuses them, and the only workaround is the raw marker"
state: open
labels:
  - ready-for-agent
  - slice-2
  - territory
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T15:00:48.091Z
updated: 2026-10-09T16:44:17.551Z
---

## Parent

Part of T-20; found on the first day on `dev`, 2026-10-09 at 15:00Z, right after the D15 interim ended.

## What happened

Decision D1 says the Coordinator's tracker and docs commits land on `dev` directly. The territory's `update` hook, from T-53, refuses every update of `dev` that does not carry cland's marker. So `git push origin dev` with a tracker commit was rejected ("hook declined"). The Coordinator then pushed with `CLAND_TERRITORY_WRITE=1`. That works, but it is the raw accident-guard bypass, and it is undocumented as a normal path. If local `dev` holds unpushed tracker commits, `cland merge` lands its squash on top of whatever it sees, and the root and the territory can diverge.

## What to build

A sanctioned way for the Coordinator's own commits to reach `dev`, with no raw marker:
- `cland push`, or a `dev` push grant for the Coordinator. It fast-forwards the territory's `dev` to the root's `dev` under the territory lock, only when it is a fast-forward and only for the Coordinator or the human. A session shell with another role is refused.
- Check what `cland merge` does when the root's `dev` is ahead of the territory's: it should push those commits first, as part of the merge, or refuse naming them. Pick one and document it.
- Update the `merge` skill and hub/README.md's push rule. In AGENTS.md's managed block, say how tracker commits reach `dev`.

## Acceptance criteria

- [ ] The Coordinator's tracker commit on the root's `dev` reaches the territory with one sanctioned command and no environment marker. An Implementer's attempt is refused.
- [ ] `cland merge` with the root's `dev` ahead of the territory has a defined, tested outcome.
- [ ] `npm run typecheck && npm test` pass, and the docs are updated.

## Notes

Size S. Implementer: Codex. Until this lands, the Coordinator pushes tracker commits with the marker. Each such push is a fast-forward of its own tracker commits only, and is noted in the run notes on T-20.
