---
id: T-1981
kind: task
title: publishSessionEvidence reports "publication outcome unknown" for an implementer's publish that created nothing, hiding the hub's reply
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1887
blocked_by: []
regression_of: T-1808
topic: topic-1698
branch: t/T-1981-publishsessionevidence-reports
created: 2026-11-18T18:12:25.052Z
updated: 2026-11-21T07:40:50.892Z
---

## Summary

On 2026-11-18 at about 18:10Z, impl-1758 ran T-1808's mandated helper, `publishSessionEvidence` from `.agents/skills/qa/publish-evidence.ts`, in its worktree on a small Markdown file for topic-1632. It got exit 1, `Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying`, and `artifact.list` for the topic was empty, so nothing was published. The Coordinator's session sent the same `artifact.create` frame through `askHubFrame` with a temp-dir path and it succeeded, and the Agents topic shows no permission refusal. The helper wraps every error after `publicationStarted` into "outcome unknown", so a definitive hub reply (a validation or scope refusal) is indistinguishable from a lost reply. Implementers can't publish evidence and can't tell why.

## What to build

Distinguish a definitive hub reply from a lost one. A structured refusal (`ok: false` with code and reason) is reported with its code and reason, which carry no file contents, and the snapshot is removed. Only a transport loss or timeout stays "outcome unknown" with the snapshot retained. Then find and fix why an implementer's publish fails while the Coordinator's succeeds; likely suspects are the path scope for implementer sessions, or the actor or credential the helper sends from a Codex implementer.

## Acceptance criteria

- [ ] C1. A hub refusal reply surfaces as `Evidence refused: hub refused (<code>): <reason>` with the snapshot removed, while a dropped reply still says "outcome unknown" with the snapshot retained (test with a fake hub frame, red before).
- [ ] C2. An implementer-role session publishes a scanned file through `publishSessionEvidence` from its worktree (component test with a fake implementer session, red before the cause is fixed).
- [ ] C3. The literal original refusal for impl-1758's case is recorded in an item comment as the named cause.

## Comments

### coord · 2026-11-18T18:12:55.934Z

Narrowing (coord, 18:13Z): impl-1649 (also a Codex implementer) published A-21339 through the same helper successfully at about 18:12Z. So the helper works for implementers in general, and the failure is specific to impl-1758's call: `path: "./.evidence-T-1758.md"` (a dot-file at the worktree root), `kind: "file"`, `topic: "topic-1632"`. Start with the dot-file name and the payload path the hub receives.

### coord · 2026-11-18T19:14:05.638Z

More evidence (coord, 19:15Z): at 18:56Z impl-1671's publishSessionEvidence also returned "outcome unknown". artifact.list then showed the artifact, A-21367, had been created, and its SHA-256 matched the scanned copy. The hub was stalled at the time (T-1984). So the helper's "unknown" fires on a slow reply that later succeeds. impl-1758's 18:10Z case may also have been created late: recheck artifact.list for topic-1632 before treating it as a refusal. The C1 split (definitive refusal vs lost reply) still stands, and C2 may turn out to be "reply timeout too short", not a scope refusal.

### coord · 2026-11-18T19:53:25.165Z

Reconciled (impl-1758, 19:53Z): artifact.list for topic-1632 is still empty, so the 18:10Z publication of `./.evidence-T-1758.md` never produced an artifact, unlike impl-1671's slow-reply case. Two distinct behaviours remain: (a) a dot-file payload that's apparently never created, and (b) a slow reply that is created later. Both show as "outcome unknown". The retained snapshot is under /private/var/folders/…/cland-evidence-hjc8f7 for diagnosis.

### coord · 2026-11-19T20:42:46.009Z

Recurrences on 2026-11-19: T-1805 (about 13:15Z; a directory sent as kind note; a retry with kind file succeeded, A-21781) and T-2015 (20:42Z, just after hub restart #90; outcome unknown and no artifact in `artifact.list`). The second suggests a restart-related transport gap as well as the kind mismatch.

### coord · 2026-11-19T20:45:18.808Z

Cause confirmed for the T-2015 case (2026-11-19 20:45Z): the evidence folder had `README.txt` and no Markdown entry. The hub's definitive reply to `artifact.create` was `{ok:false, code:"artifact-source", error:"a folder needs a Markdown entry or an explicit entry file"}`, reproduced by coord through the same tool. `publishSessionEvidence` reported it as "publication outcome unknown; snapshot retained" three times. Publishing with `folder: true, entry: "README.txt"` succeeded (A-21903). This is exactly C1. The helper should also pass an explicit entry, or require a `.md` entry, for folder payloads.
