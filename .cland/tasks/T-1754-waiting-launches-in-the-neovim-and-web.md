---
id: T-1754
kind: task
title: Waiting launches in the Neovim and web inboxes
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1744
topic: topic-1445
branch: t/T-1754-waiting-launches-in-the-neovim-and-web
created: 2026-11-07T16:02:00.048Z
updated: 2026-11-08T16:17:20.856Z
closed: 2026-11-08T16:17:20.856Z
---

## Summary

Both inboxes render each waiting launch from the inbox frame as one status line: the session with its role, the pool, the reason and the time it began. A reason change updates the line in place, and a placement or cancel removes it. The lines are not asks and do not count toward needs-you.

## What to build

Rendering only; the frame shape is T-1744's. In the web, colours come from `tokens.css` tokens, with secondary text at 4.5:1, and no key binding is added. The Hosts row and session rows that name their host belong to E-1537 (Workbenches, doctor, setup and docs for hosts).

## Acceptance criteria

- [x] C1. Neovim's inbox shows each waiting launch as one line with session, role, pool, reason and since, and a reason change replaces the line in place (test).
  - done: impl-1754 · 2026-11-08T15:15:57.907Z
  - verified: rev-36 [reviewer] · run rev-36-1754-final-1 · 2026-11-08T15:36:57.089Z · commit 1c20f7bdcaf2af94b222fc6cec4d00f95edb3c0f
- [x] C2. The web inbox shows the same line and updates it in place, and the typecheck's colour and contrast checks pass (test).
  - done: impl-1754 · 2026-11-08T15:15:58.293Z
  - verified: rev-36 [reviewer] · run rev-36-1754-final-1 · 2026-11-08T15:36:57.089Z · commit 1c20f7bdcaf2af94b222fc6cec4d00f95edb3c0f
- [x] C3. Neither inbox counts a waiting launch toward needs-you, and both drop the line when the launch is placed or cancelled (test).
  - done: impl-1754 · 2026-11-08T14:58:24.035Z
  - verified: rev-36 [reviewer] · run rev-36-1754-final-1 · 2026-11-08T15:36:57.089Z · commit 1c20f7bdcaf2af94b222fc6cec4d00f95edb3c0f

## Blocked by

- T-1744

## Notes

- Hot files: `nvim/lua/cland/inbox.lua`, `web/src/InboxArea.tsx`, `web/src/InboxArea.module.css`.
- Tests: `nvim/test/inbox*.test.ts` (Neovim T2, edit); `web/src` inbox tests (web, edit).
- Serves epic C3.

## Comments

### impl-1754 · 2026-11-08T14:56:08.004Z

Implementation uses the existing optional waitingLaunches frame with no schema, fake-wire, or counting contract change. Consumers checked: shared/wire Inbox and WaitingLaunch; web connection inbox/snapshot/delta handling, InboxArea, inbox-visit, browser-notifications; Neovim state.set_inbox, views inbox event and snapshot handlers, inbox rendering, stub inboxValue and live-protocol frame catalog. Previous wire shape covered in both new client tests. New seams: Neovim public set_inbox to rendered buffer; web public WebSocket inbox to rendered DOM. Red: Neovim missing facts within 10000ms; Web waiting-launch locator absent within 3000ms after build. Green focused tests: 1/1 each on macOS Node 24.21.0, isolated Neovim and pinned Headless Shell. Full targeted and T0 checks in progress.

### impl-1754 · 2026-11-08T14:58:59.083Z

Head 18a80fcec: source review requested. Targeted consumer evidence on macOS Node24.21.0: T2 285/285 across artifact-render, criteria-component, events(-quiet), explorer-component/card-component/roots-component, graph, human-marks-component, item-prefixes, launcher-component, layers-component, needs-you, palette-component, panel-placement-component, plan-component, progress-counts-component, scenarios/workbench, session-archive/resume, sessions, shell-component, vboard. Inbox-sections/actions/requests plus Web inbox/phone-inbox: initial mixed run 58/59 (new Web fixture startup-frame race); corrected Web inbox rerun 26/26. T3 serial native under preservation lock 65/65: artifact-browser, closed-pages, criteria, explorer, layers, message-users-live, palette, plan, shell, ui. No changed or newly added T3/T4 files; remaining T3 deferred to stage/periodic integration. No frame/schema change, catalog not regenerated; catalog workbench/needs-you/sessions/inbox consumers ran. T0 typecheck incl colours/contrast, static, lint-tests all passed; static retains known report-only T-1484 and build-tier notices. New tests below allowance threshold (Neovim .268s, Web .892s). Artifact A-17849 has red/green detail. Mode-free verify is pending clear source verdict.

### rev-35 · 2026-11-08T15:02:49.776Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1754-source-1
commit: 18a80fcecceb279d021c378c91dd4594c68e44fd
scope: full
findings: [{"severity":"medium","text":"All waiting facts, including since, are concatenated into Canvas:add's left side. Canvas truncates left chunks to the Inbox panel width, so ordinary production-length host-boot reasons hide since with no right-side time/detail path. The new control covers only full-width N and short 'no room', so C1 is not established for the Inbox panel. Retain a visible compact since at supported narrow width (format per lead) and add a production-length panel regression; authoraed44426 confirms no approved exception/other owner.","file":"nvim/lua/cland/inbox.lua","line":225}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17852 complete pinned pass: Standards0/Spec1medium. Retain visible since at normal narrow panel width with realistic boot-reason control; compact/full format decision sent to lead by authoraed44426, no approved clipping exception. Web CSS token/contrast guard, stable keys, inert/count separation, optional older frame, removal and fixture ownership source-inspected without other findings. C1 failed; C2/C3 runtime-unverified. A17850 complete native65log+A17851 qualified original tool excerpts inspected; initial58/59red vsWeb26/26repair/T2catalog285/285 separate, no immutablehead/browser-version/Linux proof. No Reviewer execution/edit/delegation. Correct/commit/fresh source request before mode-freeverify; no extra broad/native/fullsuite/provenance-only rerun/devmerge requested. Full after-stageQA separate.

Criteria: C1 failed (Neovim left-only waiting line clips since behind production-length reasons in the Inbox panel; full-width short-reason test misses it.).

### impl-1754 · 2026-11-08T15:08:07.915Z

Rework head c2b5fbfbf follows Coordinator narrow-layout decision c4167bf3 and source-1 finding. Compact right time (HH:MM today/date+time otherwise), ISO wide; Web existing title has full facts. Real narrow64-column Neovim / 360px Web UUID boot controls added. Red preserved as failure despite shell-cat status masking. Green focused2/2, edited files31/31, final Neovim5/5 after day-refresh source; T0 typecheck/static/lint all exit0. Artifacts A-17856 provenance and A-17857 original producer logs. Qualified dirty-candidate evidence, not pinned verify. Earlier broad/native receipts unchanged, no extra broad/native rerun or dev merge. C-216 report-only duration allowance7.5s until2026-11-15 records green macOS3.120s and unexecuted Linux projection. Fresh source review assigned before verify.

### rev-36 · 2026-11-08T15:14:19.814Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1754-source-2
commit: c2b5fbfbf1d22cb235944f7364e2b0a57bae3d67
scope: full
findings: [{"severity":"medium","text":"Both waiting identity and time are nonshrinking nowrap flex items. Admitted 24-character session+role names can exceed the 360px row even after reason shrinks to zero, putting since outside the visible bounds. Current innerText assertions do not catch this. Apply Coordinator a8cc9213's revised priority: since stays within bounds, pool/reason shrink first, then identity ellipsis; cover maximum names with previous-day time and actual bounds. Author confirms conflict and reports Web red reproduction.","file":"web/src/InboxArea.module.css","line":68}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17863 complete corrected source pass: Standards0/Spec1medium. Read Coordinator a8cc9213 directly: earlier never-clipped identity rule replaced with overflow-only identity ellipsis. Neovim right-time fix/Canvas clipping is compatible with revised policy; no additional findings. Clock midnight redraw, optional frames, inert/count/removal separation, CSS tokens and 7.5s projected allowance inspected. A-17856/57 local candidate focused2/2, edited31/31, finalNeovim5/5 retained with mixed-tree/browser-version limits; initial red remains failed. No runtime criteria verified; no Reviewer tests/browser/edit/delegation. Correct/commit/fresh source request before configured verify. No extra broad/native/provenance-only rerun or dev merge requested; full after-stage QA separate.

Criteria: C2 failed (Web nonshrinking long identity can push since outside narrow row; revised overflow policy and bounds control pending.).

### impl-1754 · 2026-11-08T15:15:02.001Z

Rework head1c20f7bdc applies Coordinator a8cc9213 revised clipping exception and source2 C2 finding. Only production delta since c2b5fbfbf: Web identity min-width0/shrink/ellipsis, reason basis0, time flex:none. Max24+24 previous-day controls at64-column Neovim and360px Web assert actual since bounds/no overflow/identity ellipsis. Red exit1 (Web), green exit0 2/2; typecheck/contrast and wording exit0. Original producer logs/exact command/native status/source-linkage limits in A-17866. New measured samples recorded in same-head C-216 report-only duration allowances; Linux1.6x values are projections. Fresh source review requested; no extra broad/native rerun or dev merge. Mode-free exact-reviewed-head verification still pending clear source verdict.

### rev-36 · 2026-11-08T15:15:52.234Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1754-source-3
commit: 1c20f7bdcaf2af94b222fc6cec4d00f95edb3c0f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards0/Spec0. Maximum-identity Web overflow resolved per directly-read Coordinator a8cc9213: reason zero basis, shrinkable/ellipsized identity, fixed time. Actual max24+24 previous-day Web bounds/no-overflow and Neovim cells/right-time controls inspected; previous source findings resolved. A-17866 focused2/2 original local candidate receipts read with dirty-tree/browser-provenance limits; prior evidence remains qualified. Unique 24s/9s C-216 Nov15 entries match retained samples and explicitly unexecuted Linux1.6x projections, report mode unchanged. No runtime criteria verified. Fresh mode-free verify at exact unchanged head next; restore C1/C2 done marks before final evidence. No extra broad/native/provenance-only rerun or dev merge requested. Full after-stage QA separate. Reviewer read-only; no tests/browser/delegation.

### impl-1754 · 2026-11-08T15:35:59.741Z

Verification a8c90e7c-a602-47d1-8acf-d8d872237d7d passed at exact reviewed head1c20f7bdcaf2af94b222fc6cec4d00f95edb3c0f/treec8353a515aa7fa3188313dada61ac79ba6cd6fb0. A-17886 original suite log. T0/T1/T2/Web exit0;5587/5587 pass,0 skipped/cancelled/failed; state.lua forces allT2 fallback. T3/T4 unexecuted in this receipt, T3 deferred to merge/stage coverage. Linuxx64 droplet6.8.0-147-generic Node24.21.0 Neovim0.12.5; pinned chromium_headless_shell-1248 Google Chrome for Testing156.0.8078.4. Report-only duration/Web wall notices retained. Droplet lifetime1026s cost$0.0712. Clean unchanged head, Reviewer notified for final settlement. After-stage QA separate.

### rev-36 · 2026-11-08T15:36:57.089Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1754-final-1
commit: 1c20f7bdcaf2af94b222fc6cec4d00f95edb3c0f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C3 verified. A-17886 configured a8c90e7c green5587/5587, no fail/cancel/skip; source-clear/head/branch ref match1c20f7bdc. Independently parsed Neovim waiting base0.584153877s+5/5load and Web waiting base1.597981128s (Web0 repetitions required), covering corrected max identities/time bounds, in-place updates/inert counts/removal/older frames. T0 colour token/4.5contrast checks retained at bound capturetree; not repeated remotely. Sections5/actions24/requests1/Webinbox26/phone3/area-slots1 base sets pass. Uncached Linuxx64 droplet/Node24.21/Nvim0.12.5/isolatedHeadless1248 CfT156 provenance, skips[]missing0report. T0/T1/fallbackallT2/Web executed; T3/T4 unexecuted, T3 merge-batch/fullafter-stageQA separate. Report-only budget/Webwall/lint advisories preserved; older candidate native65 not promoted to current-head proof. No Reviewer execution/edit/delegation or additional run requested.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-08T16:17:20.856Z

Merged ee0e1911749414cb25a66b1e3ab2119d7ff8b155 onto dev.
