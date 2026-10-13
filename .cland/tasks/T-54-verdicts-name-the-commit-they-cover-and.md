---
id: T-54
kind: task
title: verdicts name the commit they cover, and the hub knows which verdicts it wrote
state: closed
status: done
labels:
  - ready-for-agent
  - slice-2
assignee: impl-54
parent: E-20
blocked_by: []
topic: topic-11
branch: t/T-54-verdict-commit-and-provenance
created: 2026-10-09T08:33:53.658Z
updated: 2026-10-10T00:58:17.638Z
closed: 2026-10-09T10:00:10.487Z
---

## Parent

Part of T-20 (slice 2, ticket 2 of 12). Spec section 4.7 (the merge gate); ADR 0004 (identity enforced by the hub).

## What to build

A verdict's header gains `commit:`. `task.comment` with a verdict takes `commit` (`cland task comment … --commit <sha>`); without it, on an item whose `branch` resolves, the hub records that branch's tip at write time and says so in the result. The hub keeps each verdict it writes in its database, in a table the index never rebuilds from the files: item, kind, result, run, commit, the writer's session id and role at write time, and the comment's time. `task.view` and `task.list` mark each verdict `hub` (written through the hub) or `file` (found only in the file: a hand edit, an import). `task.view` also says whether each latest verdict is current: its commit is the branch tip, or its diff from the merge base has the same `git patch-id --stable` as the tip's, which a rebase that changed nothing keeps (decision D4). The item view shows the short commit and the marks. Verdicts without `commit` keep parsing. This is the ground for the gate (ticket 4): only the latest verdict of each kind, written through the hub by a session that held the matching role at the time and does not claim the item, counts (decision D5).

## Acceptance criteria

- [ ] `cland task comment T-1 "ok" --verdict review --result clear --run r-1 --commit <sha>` writes the full sha as `commit:` in the header, and `cland task view T-1 --json` returns it.
- [ ] Without `--commit`, on an item whose `branch` exists, the verdict records the branch's tip; on an item without one, it has no commit and the result notes it.
- [ ] A verdict typed into the file by hand, `by` line and all, shows as `file`; one written through the hub shows as `hub`, also after a hub restart and after a hand edit elsewhere in the file.
- [ ] After a new commit on the branch, `cland task view` marks the review verdict stale; after a rebase that keeps the diff, current.
- [ ] The item view in Neovim shows the short commit, a red `stale` and `from the file` where they apply.
- [ ] Item files whose verdicts have no `commit` parse, index and show as before.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents `commit:` and the provenance marks.

## Notes

Test seam: the CLI and spokes against a real hub in a temp project with a real git repository; the item file; a headless Neovim item view against the hub, as the items tests do. Size M. Implementer: Codex gpt-6.1-sol. Can start immediately.

## Comments

### impl-54 · 2026-10-09T08:37:56.552Z

Starting implementation: verdict commit headers, durable hub provenance, current/stale calculation and Neovim item marks. Will validate with real-hub/git integration coverage and the full repository checks.

### coord · 2026-10-09T08:39:13.006Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/49 (a sub-issue of #20; the item is the source of truth).

### impl-54 · 2026-10-09T08:41:32.667Z

CLI explicit SHA and branch-tip fallback tests pass. Spoke verdicts now carry durable source/writer evidence in a table separate from the rebuilt index; restart, unrelated file edit, forged by-line, and modified verdict cases pass. Implementing current/stale via stable patch IDs next, with dev then main as the comparison base.

### impl-54 · 2026-10-09T08:44:49.790Z

Current/stale and dev/main comparison-base reporting pass; Neovim headless tests now verify the short SHA, hub/file marks, and red stale highlight. Typecheck and targeted tracker/role suites pass. The full npm test run is underway; README documents the file header, response fields, durable evidence table, and patch-ID comparison.

### impl-54 · 2026-10-09T08:50:48.168Z

Implementation committed as 12b5b5d. Standards review: clear (no documented violations or material smells). Compatibility cases now pass, including the old-schema additive upgrade and text SHA/validation path. Typecheck passes. Full npm test remains in progress under the shared machine load; no failures reported so far.

### impl-54 · 2026-10-09T09:05:31.782Z

Final hub suite: 275 tests, 268 passed, 7 sandbox skips, 0 failures. Neovim initially passed 62/63; its legacy protocol fixture correctly caught an unnecessary extra row for verdicts with no new metadata. Preserved the old layout for those older hubs. Both the legacy item-view case and real-hub red-stale/provenance case now pass; both follow-up review axes are clear. Running the full Neovim suite again; no hub changes since its successful full run.

### impl-54 · 2026-10-09T09:07:41.213Z

T-54 complete on t/T-54-verdict-commit-and-provenance: 12b5b5d implements commit headers/capture, durable per-comment provenance with writer session/role, dev/main stable-patch freshness, CLI/spoke fields, Neovim marks, README and six real-hub/Git cases; 163444f preserves the old single-row UI for older hubs with no verdict metadata. Final validation: npm run typecheck passed; full hub suite 275 tests / 268 passed / 7 sandbox skips / 0 failures; npm run test:nvim 63 passed / 0 failures. Standards review: clear (0 findings). Spec review: clear (0 findings), including the follow-up UI fix. Working tree clean; no in-scope omissions. Gate implementation remains T-59.

### rev-5 · 2026-10-09T09:12:19.419Z

verdict: review
result: not clear
by: rev-5 [reviewer]
run: rev-20261009-54-163444f

Reviewed b8368b3...163444fec427235c04e827cf56b52381eb3a8da2 (12b5b5d and 163444f), read-only in the main thread.

Medium — hub/src/tracker/index-db.ts:275: Provenance is matched solely by item id and comment fingerprint, so an exact hand-appended copy of an earlier hub-written clear verdict is also marked source=hub with that writer. After a later hub-written not-clear verdict, append the earlier clear comment (including author/time/header/body): all three rows receive hub provenance, and tracker.ts:398 makes the copied clear the latest verdict. This violates T-54's hand-written-verdict criterion and undermines the D5 evidence the merge gate will consume. Match durable verdict occurrences/order, or fail closed on duplicate/replayed matches; cover clear → not clear → hand-copied clear through view/list and restart.

Standards: 0 documented violations or material baseline smells. Spec: 1 medium, above. Explicit SHA validation/capture, branch fallback/result notes, durable evidence separation and additive migration, writer role at write time, dev/main stable-patch comparison, metadata-free legacy UI, Neovim marks, README, and absence of changes under .cland/tasks otherwise look consistent.

Verification: both hub and Neovim tsc --noEmit checks passed. A read-only :memory: SQLite evaluation of this branch's TrackerIndex reproduced the copied verdict being marked hub. Legacy parse/serialize roundtrip and real-Git tip/base/missing-commit freshness probes passed. Reviewed the committed real-hub/Git and headless-Neovim tests; did not rerun integration suites because this Reviewer sandbox permits no filesystem writes or network. No edits.

### impl-54 · 2026-10-09T09:20:28.785Z

Addressing rev-20261009-54-163444f: provenance will match durable records once, in their write order, across each item's file-ordered verdicts. Regression will cover clear → not clear → exact hand-appended clear through view/list and restart, plus replay after removing the original occurrence.

### impl-54 · 2026-10-09T09:24:40.670Z

Replay regression passes through view/list/restart and after removing the original occurrence; both follow-up review axes are clear. Typecheck passed; the requested full suite is running. Connection note: the MCP spoke reports that it was replaced and will not reconnect. Normal CLI task commands still authenticate this shell as impl-54, but this version has no CLI send support. I will record the final commit and check results on this item if the send tool remains unavailable.

### impl-54 · 2026-10-09T09:31:03.050Z

Requested full run: typecheck passed; hub suite 276 tests, 268 passed, 7 skips, one load timeout waiting 15000 ms for the replacement Claude session clause turn to become busy then idle (claude-code-sessions.test.ts:186). All seven verdict cases, including the replay regression, passed. Rerunning only that timed-out case alone as requested; Neovim follows separately because npm test stopped at the hub failure. No timeout/retry code changes.

### impl-54 · 2026-10-09T09:36:22.905Z

Coordinator handoff — fix ready for rev-5 re-review: a057956 on t/T-54-verdict-commit-and-provenance.

Addressed the medium finding from rev-20261009-54-163444f. TrackerIndex now matches each durable hub record at most once and strictly in write order across an item's file-ordered verdicts; both view and list use that matching. Exact duplicates and out-of-order replayed comments carry source=file and no writer identity. The real-hub/spoke regression covers clear → not clear → hand-copied clear through view/list and restart, and confirms a replay remains file-only after removing the original occurrence. README documents the rule. Standards and Spec follow-up reviews both clear; working tree clean.

Checks: npm run typecheck passed. Requested full npm test run: hub 268 pass / 7 skips / 1 load timeout (Claude replacement clause turn did not become idle within 15000 ms); that case passed alone, 1/1. Neovim separately: 62 pass / 1 load timing failure (file refresh 1415 ms versus the existing 1000 ms threshold); that case passed alone, 1/1. All seven verdict cases passed. No retries or longer timeouts added to code.

Transport limitation: the MCP spoke was replaced and now refuses calls; the current role and CLI task identity still work. CLI has no agent-send command in this version, so this item comment is the final handoff instead of a send message. No push or merge performed.

### rev-5 · 2026-10-09T09:44:17.249Z

verdict: review
result: clear
by: rev-5 [reviewer]
run: rev-20261009-54-a057956

Reviewed a057956f83ade4d5d11aac1014669a6a71acf0f9 and main...t/T-54-verdict-commit-and-provenance (merge base b8368b3), read-only, main thread only.

No high or medium findings remain. The earlier medium in rev-20261009-54-163444f is resolved for the requested replay cases: index-db.ts:281 matches each durable record at most once in strictly increasing insertion order; view and list share the same matching. A clear → not clear → copied clear sequence produces hub/hub/file, and removing the original clear produces hub/file. The copy has no writer identity. The committed real-hub/spoke regression covers view/list, restart, and original removal. The fix touches only the index, the view call, that regression, and README; nothing under .cland/tasks. Earlier commit capture, freshness, compatibility and UI conclusions still hold.

Standards: 0 findings. Spec: 0 findings. Clarification: the raw last verdict remains clear/file, as the regression expressly asserts; this change removes its eligibility as hub evidence rather than hiding/reordering the file verdict. The merge gate remains T-59.

Verification: hub TypeScript check passed on the pinned head. Read-only :memory: SQLite assertions confirmed matching parity between list/view inputs, both replay cases, unchanged verdicts, and a direct duplicate; no file changes. Integration tests were reviewed, not rerun in this read-only/no-network Reviewer sandbox. The implementer's final item comment reports hub 268 pass/7 skips/1 timing failure and Neovim 62 pass/1 timing failure, each failing case subsequently passing alone; it does not report an entirely green full rerun.

### qa-13 · 2026-10-09T09:55:17.491Z

verdict: qa
result: clear
by: qa-13 [qa]
run: qa-20261009-54-a057956

Exercised branch t/T-54-verdict-commit-and-provenance at a057956f83ade4d5d11aac1014669a6a71acf0f9. No code changes; working tree clean.

Ran:
- npm run typecheck && npm test: typecheck passed; hub 276 tests / 269 passed / 7 skipped / 0 failed; Neovim 63 passed / 0 failed. No timing failure needed a rerun.
- node --test hub/test/verdict-commit.test.ts nvim/test/items.test.ts: 9 passed / 0 failed / 0 skipped. Read the assertions: explicit/full SHA, default branch tip and absent branch notes, durable provenance and original writer role after restart/unrelated edits, dev/main patch-ID freshness across rebases and changed commits, old-schema additive migration, invalid SHA rejection, and replay through view/list/restart including removal of the original occurrence.
- Headless Neovim via the repository harness (nvim_input and screenstring): short SHA, from the hub/file, red stale highlight passed; full-suite shell.test.ts legacy item-view case passed with its single-row adjacency assertion.
- Project CLI task view T-54 --json and task list --json: both succeeded.
- Independent CLI exercise in a temporary Git project, all commands using env -u CLAND_HUB_FILE -u CLAND_SESSION_ID -u CLAND_SESSION_NAME node <T-54 worktree>/hub/bin/cland.ts: create, link branch, explicit --commit and branch-tip default, item without branch, view/list source=hub/current=true/writer/verdictBase=main, new commit causing stale, unrelated title edit, hand-appended verdict and exact earlier-clear copy source=file with no writer, restart preserving all marks. Scratch hub stopped successfully both times; no kill fallback needed.
- hub/README.md:687–693 documents optional commit headers, capture/result notes, provenance/writer, additive durable evidence, replay rule, dev/main verdictBase and freshness.

Findings by severity: no high, medium or low product findings in the requested scope. The replay remains visible as the last clear in file order, but carries source=file and no hub writer; gate behavior is T-59 and was not tested.

Evidence limits: six hub tests skipped because ps is refused; one skipped because macOS sandbox-exec is unavailable. All T-54 and Neovim cases ran. Initial scratch start under /private/tmp failed Unix listen with EPERM; the profile permits sockets under the system $TMPDIR, where the complete exercise passed.

Evidence files: /tmp/qa-13-t54-full.log; /tmp/qa-13-t54-focused.log; /tmp/qa-13-t54-manual-system.log; reproduction driver /tmp/qa-13-t54-manual-system.py. Scratch project: /var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/cland-qa13-t54-sfwxxpyu (hub stopped).

### coord · 2026-10-09T10:00:10.485Z

Merged into main as 5ec7436 (`git merge --no-ff`, by the Coordinator) at 09:56Z; on main after the merge: typecheck clean, 294 hub + 65 Neovim tests pass. Verdicts: review not clear rev-20261009-54-163444f (one medium: an exact hand-copied earlier hub verdict passed as hub-written), fix a057956 (a hub record matches at most one comment, in order; duplicates and replays are `file`), review clear rev-20261009-54-a057956 (rev-5, 09:44Z), QA clear qa-20261009-54-a057956 (qa-13, 09:55Z: the suite, the changed tests, a scratch hub exercising explicit and default commits, `verdictBase`, writer metadata, staleness, hand-written and replayed verdicts as `file`, restart). Decisions on the way: the base for freshness is `dev` when present, else `main`, reported as `verdictBase`; the raw latest verdict in file order may still be a file copy, so the gate (T-59) must select by provenance. Timeline: launched 08:37Z, implemented 09:07Z, fix round to 09:36Z, review clear 09:44Z, QA clear 09:55Z, merged 09:56Z. GitHub mirror #49.
