---
id: T-225
kind: task
title: "Release from the item: tag, push, comment the tag on the item and close
  it; the release skill and Coordinator clause release from the item"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
  - v0.1
assignee: impl-225
parent: E-117
blocked_by:
  - T-224
topic: topic-139
branch: t/T-225-release-from-the-item-tag-push-comment
created: 2026-10-11T15:38:17.485Z
updated: 2026-10-11T16:45:18.541Z
---

## Parent

T-117 (Release from the item), tracer bullet 3 plus the release flow. Builds on T-224, the `--item` dry run and its notes.

## What to build

`cland release --item T-n` without `--dry-run` does the following:
- Tags `v<version>`, fast-forwards `main` to `dev` and pushes to GitHub as today, with the notes from T-224.
- On success, the hub comments the tag on the release item and closes it. The next open release becomes the current one.
- A release without `--item` behaves as before.

The `release` skill (.agents/skills/release) and the Coordinator's clause (the shipped default and the project's .cland/roles.toml, with a handover listing the exact lines) release from the item: dry run first, then the notes and version shown to the human in an `ask`, then the real run after approval.

Under decisions D18 and D19 (docs/spec/v0.1.md §4), the human's stand-in, an Aide or the session the human named, may answer that ask with the version the human decided. The skill's current step 3, saying the stand-in "cannot choose or authorize the version", must be reconciled with that: the stand-in relays a version the human chose and does not invent one.

## Acceptance criteria

- [x] C1. A scratch release from a test release item tags `v<version>`, moves and pushes `main` to the GitHub stand-in, comments the tag on the item, and closes it.
  - done: impl-225 · 2026-10-11T16:31:47.381Z
  - verified: rev-16 [reviewer] · run rev-20261011-225-2 · 2026-10-11T16:44:55.728Z · commit 51d6f1961b410a6647c720f740f4124e8c7a9048
- [x] C2. A release without `--item` is unchanged.
  - done: impl-225 · 2026-10-11T16:18:30.754Z
  - verified: rev-16 [reviewer] · run rev-20261011-225-2 · 2026-10-11T16:44:55.728Z · commit 51d6f1961b410a6647c720f740f4124e8c7a9048
- [x] C3. The `release` skill and the Coordinator clause describe releasing from the item after the human's approval, consistent with D18/D19. The roles.toml handover lines are listed.
  - done: impl-225 · 2026-10-11T16:18:30.831Z
  - verified: rev-16 [reviewer] · run rev-20261011-225-2 · 2026-10-11T16:44:55.728Z · commit 51d6f1961b410a6647c720f740f4124e8c7a9048
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-225 · 2026-10-11T16:44:24.369Z
  - verified: rev-16 [reviewer] · run rev-20261011-225-2 · 2026-10-11T16:44:55.728Z · commit 51d6f1961b410a6647c720f740f4124e8c7a9048

## Comments

### coord · 2026-10-11T15:39:27.581Z

Notes from cland-impl (2026-10-11 15:42Z): (1) The Coordinator clause and the release skill must say the version comes from the human, and the stand-in may relay it only when the human has recorded it (D18 names v0.1.0); the stand-in never invents a version. (2) The notes from the item carry T-130's Notes, which list T-109 C1 and T-111 M7 as 'verified in v0.1.1' (D19). Check the release output shows them. T-224 and T-225 are hub-risky: each needs its own pre-merge full suite. T-117's former C8 (tag on GitHub, item closed) is now T-130's post-release check.

### impl-225 · 2026-10-11T16:12:03.430Z

Implementing real item releases in the task worktree: retain T-224 notes and legacy releases, add scratch publication/closure/recovery coverage, then update the release skill and Coordinator clauses. Final verification will use cland suite all after merging origin/dev.

### impl-225 · 2026-10-11T16:18:52.013Z

Implemented and pushed d0c44af419d5076da12b36a51c74e7cff70c4ef4. Item releases publish the T-224 notes and close with tag/full-commit comment after successful Git follow-up; receipts bind recovery to the canonical item and avoid duplicate comments. Version-only behavior is unchanged. Targeted tests: release-item 7/7; existing release/sync 17/17; typecheck passed. Fetched and merged origin/dev (a8a8da0; already up to date). Handover A-1310 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1310-t-225-release-handover-clause-line-59-notes-and-recovery.md lists exact .cland/roles.toml line 59 and T-130's verified-in-v0.1.1 notes. Requesting review, then own pre-merge full suite.

### rev-16 · 2026-10-11T16:21:23.766Z

verdict: review
result: not clear
by: rev-16 [reviewer]
run: rev-20261011-225-1
commit: d0c44af419d5076da12b36a51c74e7cff70c4ef4

Medium — hub/src/hub/releases.ts:124,134: release.tmp is deleted before territory lock cleanup, but the new outer catch reports a recoverable `released; follow-up failed` on cleanup error. With publication/closure complete and no receipt, the instructed same-item/version retry reaches territory-release.ts:116-117 and refuses the existing tag. Preserve recovery identity through late cleanup, or report a completed release without promising receipt-based retry.

Read-only in-memory probe of the exact reviewed Releases class with a successful publication and injected late lock cleanup failure returned followUp.step=lock-release, receiptPresent=false, itemClosed=true. No filesystem/network/ref mutations were performed. Other source paths and approval/handover wording have no findings; C4 full-suite evidence remains pending.

Criteria: C1 failed (Late territory-lock cleanup failure returns released/follow-up-failed after release.tmp was deleted, so the instructed same-item retry cannot recover and instead rejects the existing tag.).

### impl-225 · 2026-10-11T16:25:17.181Z

Addressing rev-20261011-225-1: scratch GitHub post-receive fixture replaces the held territory lock with a directory after accepting main/tag. On d0c44af the regression fails because release.tmp is absent after lock cleanup fails. The fix defers receipt deletion until territory lock cleanup succeeds, still within the hub's serial operation. Developed in detached .cland/worktrees/T-225-recovery-fix so the ongoing suite eb4574af continues testing unchanged source; I will apply and commit to the task branch when that run finishes, then request re-review and a new final suite.

### impl-225 · 2026-10-11T16:31:47.456Z

Fixed rev-20261011-225-1 at pushed head 51d6f1961b410a6647c720f740f4124e8c7a9048. release.tmp now survives territory lock cleanup and is deleted afterward inside the hub's serial operation. New scratch regression replaces the held lock after GitHub accepts main/tag, confirms lock-release follow-up retains the receipt and closed item, then repairs the lock and retries with no duplicate comment or later dev publication. Regression was red on d0c44af and green on the fix; typecheck, item-release tests 8/8, and selected existing recovery/sync tests 6/6 passed in the isolated checkout with identical source. Fetched and merged origin/dev (already up to date). Pre-fix suite eb4574af passed 1526/1526 at d0c44af but will not count as final C4; launching a fresh full suite at 51d6f19. Updated handover A-1313: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1313-t-225-updated-handover-receipt-retained-through-lock-cleanup.md.

### impl-225 · 2026-10-11T16:44:24.466Z

Final full suite 7dc3ba5d-5142-4404-adf7-7f6489acb759 passed at exact pushed head 51d6f1961b410a6647c720f740f4124e8c7a9048: typecheck + full npm test, 1527/1527, zero failures/cancellations/skips. Log A-1314: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1314-suite-7dc3ba5d-5142-4404-adf7-7f6489acb759-all-at-51d6f19.log. C4 marked done. rev-16 source re-review reported no remaining findings at this head, including receipt retention through lock cleanup and scratch idempotent recovery. Awaiting the final exact-head review verdict; keeping claim until merge.

### rev-16 · 2026-10-11T16:44:55.728Z

verdict: review
result: clear
by: rev-16 [reviewer]
run: rev-20261011-225-2
commit: 51d6f1961b410a6647c720f740f4124e8c7a9048

No high, medium or low findings remain. A-1311 is resolved: hub/src/hub/releases.ts:132-142 deletes the receipt only after successful territory-lock cleanup within the serial operation. The exact-class read-only probe retains the receipt on late cleanup failure, and A-1314's real scratch EISDIR regression passes with a pinned same-item retry and no duplicate comment.

C1 verified: item publication/main/tag propagation, Notes, tag/full-commit comment, closure and recovery scratch tests pass. C2 verified: version-only release preserves item files and commit notes; unchanged legacy release.test.ts and all 17 legacy cases pass. C3 verified: skill preview/notes/version/build approval flow and human-recorded-version relay match D18/D19; project clause line 59, shipped line 64 and A-1313 handover match. C4 verified: exact-head full suite 7dc3ba5d (A-1314), typecheck plus npm test exit 0, 1527/1527 with zero failures or skips.

Standards and spec axes have zero remaining findings. Final review artifact records the evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T16:45:18.541Z

Merged 0cc2e7f59460988470be42983e5493f67352fd8c onto dev.
