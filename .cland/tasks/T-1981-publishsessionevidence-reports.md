---
id: T-1981
kind: task
title: publishSessionEvidence reports "publication outcome unknown" for an implementer's publish that created nothing, hiding the hub's reply
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1887
blocked_by: []
regression_of: T-1808
topic: topic-1698
branch: t/T-1981-publishsessionevidence-reports
created: 2026-11-18T18:12:25.052Z
updated: 2026-11-21T11:45:09.656Z
closed: 2026-11-21T11:45:09.656Z
---

## Summary

On 2026-11-18 at about 18:10Z, impl-1758 ran T-1808's mandated helper, `publishSessionEvidence` from `.agents/skills/qa/publish-evidence.ts`, in its worktree on a small Markdown file for topic-1632. It got exit 1, `Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying`, and `artifact.list` for the topic was empty, so nothing was published. The Coordinator's session sent the same `artifact.create` frame through `askHubFrame` with a temp-dir path and it succeeded, and the Agents topic shows no permission refusal. The helper wraps every error after `publicationStarted` into "outcome unknown", so a definitive hub reply (a validation or scope refusal) is indistinguishable from a lost reply. Implementers can't publish evidence and can't tell why.

## What to build

Distinguish a definitive hub reply from a lost one. A structured refusal (`ok: false` with code and reason) is reported with its code and reason, which carry no file contents, and the snapshot is removed. Only a transport loss or timeout stays "outcome unknown" with the snapshot retained. Then find and fix why an implementer's publish fails while the Coordinator's succeeds; likely suspects are the path scope for implementer sessions, or the actor or credential the helper sends from a Codex implementer.

## Acceptance criteria

- [x] C1. A hub refusal reply surfaces as `Evidence refused: hub refused (<code>): <reason>` with the snapshot removed, while a dropped reply still says "outcome unknown" with the snapshot retained (test with a fake hub frame, red before).
  - done: impl-1981 · 2026-11-21T07:46:33.576Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-1981-final · 2026-11-21T08:19:51.536Z · commit 11a14390e02b79261f18a95ce8ba8cccfab6e4e6
- [x] C2. An implementer-role session publishes a scanned file through `publishSessionEvidence` from its worktree (component test with a fake implementer session, red before the cause is fixed).
  - done: impl-1981 · 2026-11-21T07:46:34.244Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-1981-final · 2026-11-21T08:19:51.536Z · commit 11a14390e02b79261f18a95ce8ba8cccfab6e4e6
- [x] C3. An item comment names the cause: the literal refusal a reproduction of impl-1758's case gets (a small Markdown file published from an implementer worktree), with the hub.log fact that the original left no artifact.create audit row (2026-11-18 18:00–18:30Z), and the confirmed T-2015 refusal (artifact-source).
  - done: impl-1981 · 2026-11-21T07:46:35.152Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-1981-source · 2026-11-21T07:48:35.103Z · commit 11a14390e02b79261f18a95ce8ba8cccfab6e4e6
  - verified: rev-40 [reviewer] · run rev-40-20261121-1981-final · 2026-11-21T08:19:51.536Z · commit 11a14390e02b79261f18a95ce8ba8cccfab6e4e6

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

### impl-1981 · 2026-11-21T07:41:40.091Z

Consumer search before changing refusal classification: publishEvidence/publishSessionEvidence callers in hub/test/evidence-publish.test.ts, copied locator .agents/skills/qa/publish-evidence.ts, QA EVIDENCE.md, implement/QA skills and BRIEF.md (including frozen implement-workflow fixture). HubRefusal producer is shared/socket-client.ts re-exported by cli/socket-client.ts; existing refusal wire shape remains unchanged, including older replies without code. Snapshot lifecycle/cleanup consumers are local to evidence-publish.ts and its T2 test. No CLI usage/help export or wire field changes. C1 red observed on macOS Node 24.21.0: expected 'Evidence refused: hub refused (artifact-source): a folder needs a Markdown entry or an explicit entry file', actual 'Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying'. Existing dropped-reply regression passes.

### impl-1981 · 2026-11-21T07:44:36.311Z

C3 reproduction (macOS, Node v24.21.0, T2 component, fake in-process implementer + disposable worktree, no external network/real harness): path './.evidence-T-1758.md', kind 'file' publishes '# Clean reproduction' with creatorRole='implementer'; there is no literal refusal for that valid dot-file shape at this head. A blank-title control returns the literal 'Evidence refused: hub refused (artifact-title): an artifact needs a title', snapshot removed. With the C1 classifier disabled, the component's same control fails red: actual 'Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying', expected artifact-title refusal. Restored classifier: evidence-publish.test.ts 21/21 pass. No distinct dot-file defect reproduced; C2's valid publish is green before and after classifier fix. Historical provenance supplied by Coordinator: hub.log between 2026-11-18 18:00–18:30Z has no artifact.create audit row for impl-1758, only artifact.list (ok), sends, comments and edits; original may have failed pre-audit validation or never reached hub. The independently confirmed T-2015 receipt is {ok:false,code:'artifact-source',error:'a folder needs a Markdown entry or an explicit entry file'}; it is not evidence of impl-1758's original cause.

### rev-40 · 2026-11-21T07:48:35.103Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1981-source
commit: 11a14390e02b79261f18a95ce8ba8cccfab6e4e6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards0/Spec0 findings. Existing shared HubRefusal positively selects definitive code/reason and snapshot cleanup; transport/timeout stays unknown/retained. Ancillary cleanup disposition preserves the primary outcome. Optional env/cwd consistently isolates authenticated discovery, actor credentials, socket client and relative source path. New T2 component retains full owned setup/body/cleanup, committed bytes/implementer role and exact refusal assertions; shared fake/legacy/transport controls retained. Docs and consumer census checked, wire shape unchanged. C3 verified under Coordinator5bbc6f2b clarification: valid exact dot-file shape succeeds, no distinct defect reproduced; historical no-artifact.create audit fact remains Coordinator-supplied and original cause unknown; T-2015 artifact-source kept separate. A-22385 local21/21/lint/typecheck and red18/3 are reported prose, not raw/native exact-head configured evidence. C1/C2 final verification pending same-head mode-free cland verify and named positive receipts. No Reviewer tests/native/browser/probes or edits.

Criteria: C3 verified.

### rev-40 · 2026-11-21T08:19:51.536Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1981-final
commit: 11a14390e02b79261f18a95ce8ba8cccfab6e4e6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings. A-22424 independently audits exact-head/canonical-tree A-22419/42a11723: T0/T1/fallback allT2/Web exit0,7266pass/1Mac-only selector skip/0fail/cancel. Uncached Linuxx64c8ams3 Node24.21.0/Nvim0.12.5; HeadlessShell1248/CfT156.0.8078.4. T3 merge batch, T4 unexecuted; budgets/lint report-only. All21 evidence-publish generated names pass; new implementer dot-file publication/refusal-removal/legacy cleanup names have base+5 positive finishes each with5/5 load gates. Existing transport unknown/retained-byte case positively passes. C1/C2 verified from named receipts/unchanged source; earlier classifier-disabled red remains reported local evidence, not reconstructed raw provenance. C2/C3 use Coordinator5bbc6f2b scope: valid exact dot-file succeeds, no distinct failure reproduced; original impl-1758 cause unknown and no-audit-row fact separate from confirmed T-2015artifact-source. C3 current source mark re-established. No Reviewer tests/native/browser/probes/edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-21T11:45:09.656Z

Merged a28f8ecf978b654c98e28bb7eb738394da7b6022 onto dev.
