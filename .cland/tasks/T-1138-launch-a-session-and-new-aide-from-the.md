---
id: T-1138
kind: task
title: Launch a session and New Aide from the header
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1132
topic: topic-882
branch: t/T-1138-launch-a-session-and-new-aide-from-the
created: 2026-10-22T15:16:16.038Z
updated: 2026-10-23T01:04:45.471Z
closed: 2026-10-23T01:04:45.471Z
---

## Summary

Launch a session (`l`) and New Aide (`a`) open a small form with the role's defaults from `roles.toml`, the item and the brief, as Neovim's launcher does; the directory is always the project's.

## Parent

E-418 (§3.2 the header; v0.1 §3.3 the Aide; tracer step 3).

## What to build

The header's Launch a session and New Aide buttons, `l` and `a` in the Sessions area, and two palette actions open an in-place form: name, role (from the hub's roles), harness, model (the harness's models, fetched with `models.list` when the field is focused), account (from the registry), effort, item and brief (text or an artifact id). Choosing a role fills the harness, model, account and effort from its launch defaults; changing the harness clears the model and effort meant for the other one. New Aide preselects the Aide role with `[roles.aide]`'s defaults.

The form has no directory: the hub starts the session in the project root, or with an item in that item's task worktree, and refuses a directory from the web (the hub slice). Enter launches and Esc cancels. The hub's refusals (a name in use, the Coordinator held, a limited account with its reset, an unknown harness) show under the fields. The new session appears in its group as its row arrives. Neovim's `launcher.lua` defines the behaviour.

## Acceptance criteria

- [x] C1. `a` in Sessions opens the form with the Aide role's defaults, Enter launches it, and the new Aide appears under Yours and in `cland session list` with the project root as its directory (Web test with the fake harness).
  - done: impl-1138 · 2026-10-23T00:34:26.834Z
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-1 · 2026-10-23T00:46:49.629Z · commit c60f7c24d5d09584556885288215c76017d8cc63
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-2 · 2026-10-23T01:00:09.277Z · commit b0afcf851784784d42e2ed6b32d2a1bbec3c22d7
- [x] C2. Choosing a role in `l`'s form fills harness, model, account and effort from `roles.toml`, and changing the harness clears the model and effort (Web test).
  - done: impl-1138 · 2026-10-23T00:28:39.944Z
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-1 · 2026-10-23T00:46:49.629Z · commit c60f7c24d5d09584556885288215c76017d8cc63
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-2 · 2026-10-23T01:00:09.277Z · commit b0afcf851784784d42e2ed6b32d2a1bbec3c22d7
- [x] C3. A launch on a limited fake account shows the hub's refusal with the account's reset under the form, and nothing launches (Web test).
  - done: impl-1138 · 2026-10-23T00:34:26.941Z
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-1 · 2026-10-23T00:46:49.629Z · commit c60f7c24d5d09584556885288215c76017d8cc63
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-2 · 2026-10-23T01:00:09.277Z · commit b0afcf851784784d42e2ed6b32d2a1bbec3c22d7
- [x] C4. The form has no directory field, and its `session.launch` frame carries no directory (Web test).
  - done: impl-1138 · 2026-10-23T00:34:27.021Z
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-1 · 2026-10-23T00:46:49.630Z · commit c60f7c24d5d09584556885288215c76017d8cc63
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-2 · 2026-10-23T01:00:09.277Z · commit b0afcf851784784d42e2ed6b32d2a1bbec3c22d7
- [x] C5. `web/README.md` describes the launch form and its keys (docs).
  - done: impl-1138 · 2026-10-23T00:28:40.294Z
  - verified: rev-26 [reviewer] · run rev-20261023-1138-source-2 · 2026-10-23T00:35:12.439Z · commit c60f7c24d5d09584556885288215c76017d8cc63
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-1 · 2026-10-23T00:46:49.630Z · commit c60f7c24d5d09584556885288215c76017d8cc63
  - verified: rev-26 [reviewer] · run rev-20261023-1138-source-3 · 2026-10-23T00:48:41.170Z · commit b0afcf851784784d42e2ed6b32d2a1bbec3c22d7
  - verified: rev-26 [reviewer] · run rev-20261023-1138-final-2 · 2026-10-23T01:00:09.277Z · commit b0afcf851784784d42e2ed6b32d2a1bbec3c22d7

## Comments

### impl-1138 · 2026-10-23T00:27:50.146Z

Implemented the launcher test-first at the agreed authenticated Web/public session-list seam. Role defaults, harness/account/model choices, project-only launch frames, text/artifact briefs, offline/pending guards and active session-page routing are covered. Local macOS targeted launch 8/8, required area-slots 4/4, key-contexts 3/3, palette 11/11; T0 npm run check passes (test lint report mode, 0 refusals). Evidence artifact posted in topic-882; source review and queued verification next. Coordinator's shared capabilities expectation fix 29c9a46c merged before review.

### rev-26 · 2026-10-23T00:31:03.190Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261023-1138-source-1
commit: cca400e5e178283d5e95c902e3376588bf3256b0
scope: full
findings: [{"severity":"medium","text":"Initial shortcut cases (also lines 148,169,206) fence only shell rail rendering, while SessionsArea consumes launch keys when live=false. Bound setup on connected launch/default readiness before the one-shot physical key, arm the form observer before triggering, and retain final row/default/refusal/CLI/no-directory assertions (rule 9).","file":"web/test/session-launch.test.ts","line":36}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec audit complete: M1 is the only finding, accepted by lead. Source not clear at cca400e5. Actual product/default/authority/capability handling and matching docs otherwise reviewed; C5 source checked but no verification marks on this not-clear pass. A-9677 records complete audit and provenance limits. Fix bounded initial connected/default readiness plus pre-armed form observers, preserving final public-frame/CLI/refusal assertions, then request fresh source review before mode-free verify. A-9663 local development narrative is supporting evidence, not exact-head suite proof; preserve original receipts without reruns. A-9677: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9677-t-1138-source-review-at-cca400e5-initial-readiness-fence.md.

Criteria: C1 failed (Aide shortcut can precede initial live/default readiness, invalidating the launch/readback test setup.), C3 failed (Limited-account shortcut case can consume l before connected readiness; bound setup before the action.), C4 failed (Shortcut-driven Aide/item frame cases need initial readiness fences before no-directory proof.).

### rev-26 · 2026-10-23T00:35:12.439Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1138-source-2
commit: c60f7c24d5d09584556885288215c76017d8cc63
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at c60f7c24/tree 3d9b8da9. M1 resolved: enabled launch readiness now fences live status and role snapshot; initial shortcut tests bound setup separately and arm form observers before keys. New held-role-snapshot regression proves Live alone does not enable blank-default launch, then exact Aide defaults after release. Original row/default/refusal/CLI/no-cwd and pending/offline assertions retained. Standards and Spec: no findings. C5 README verified; C1–C4 await mode-free configured same-head evidence. A-9680 preserves original development provenance limits; A-9681/A-9682 hold local static/targeted exit-0 receipts (9/9 launch, 4/4 area-slots, 3/3 key-contexts, 11/11 palette), not configured/Linux proof. All new launch identities under 4 seconds locally. A-9683: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9683-t-1138-corrected-source-review-at-c60f7c24.md.

Criteria: C5 verified.

### rev-26 · 2026-10-23T00:46:49.630Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1138-final-1
commit: c60f7c24d5d09584556885288215c76017d8cc63
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged c60f7c24. A-9703 independently audits A-9701 / 1e52504a: exit 0, 2595 ordinary tests and 391 files passed, no failures/cancellations/skips. All T1/fallback all T2 hub+Neovim/Web passed on Linux x64 c-8 lon1; host check gate a4a166a9 reused, not repeated remotely. All nine owned launcher cases pass, including Aide defaults/Yours/CLI project-root/no-cwd, role/harness changes, limited-account reset refusal/no launch, stale catalog, pending/offline guards, page routing and held initial snapshot. Owned samples 1.264–2.897 seconds; affected renamed key-context 2.230 seconds, so no four-second allowance trigger. C5 source docs unchanged. C1–C5 verified, no findings. Generic lint/tier/duration/ratchet diagnostics remain report-only; actual Web wall 81.581 seconds exceeds report-only 40 seconds, existing unrelated warnings retained. No T3/T4, performance-budget pass or after-stage QA claim. A-9703: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9703-t-1138-final-evidence-review-at-c60f7c24.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-26 · 2026-10-23T00:48:41.170Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1138-source-3
commit: b0afcf851784784d42e2ed6b32d2a1bbec3c22d7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged delta source clear at b0afcf85/tree 94501e0c after Coordinator 6108fd79 authorized dev 48ffceb6 merge. Standards/Spec: no findings. A-9706 audits both parents/all combined files: launch form/default readiness, page routing and original tests unchanged; incoming queue session-open handler retained after launcher precedence; help/palette combine launch actions and Open session or queue with 24 keys; tier/duration/docs entries preserved. C5 verified; C1–C4 await mode-free configured evidence at this exact merged head. A-9704 retains local build and six targeted files all exit 0 with exact head/tree provenance; not configured/Linux evidence. A-9701/A-9703 remain historical at c60f7c24. A-9706: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9706-t-1138-merged-delta-source-review-at-b0afcf85.md.

Criteria: C5 verified.

### rev-26 · 2026-10-23T01:00:09.277Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1138-final-2
commit: b0afcf851784784d42e2ed6b32d2a1bbec3c22d7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear at unchanged b0afcf85. A-9718 independently audits A-9717 / c29617e4: exit 0, 2623 ordinary tests and 393 files passed, no failed/cancelled/skipped records. All T1/fallback T2 hub+Neovim/Web completed on Linux x64 c-8 lon1; host gate 7e94c8b5 reused, not remotely repeated. All nine launcher cases pass (1.233–2.814 seconds); renamed key-context 2.321 seconds, below four-second allowance trigger. Area-slots/key-contexts/palette/sessions/session-actions/queue integration all pass. Source docs retained; C1–C5 verified, no findings. Generic lint/tier/duration/ratchet diagnostics remain report-only; actual Web phase wall 82.423 seconds exceeds report-only 40 seconds. Existing unrelated warnings and nine missing baselines retained. No T3/T4, enforcing performance-budget pass or after-stage QA claim. Prior receipts remain historical at their original heads. A-9718: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9718-t-1138-final-merged-head-evidence-at-b0afcf85.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T01:04:45.471Z

Merged fc2cec980f6a35ff23ea284d382ad4f7079b9d05 onto dev.
