---
id: T-1392
kind: task
title: The web's artifact viewer renders PNG, JPEG, GIF and WebP inline under a size cap
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: topic-1128
branch: t/T-1392-the-web-s-artifact-viewer-renders-png
created: 2026-10-27T23:37:28.882Z
updated: 2026-10-28T00:08:00.720Z
closed: 2026-10-28T00:08:00.720Z
---

## Summary

An image artifact whose capability URL answers `image/png`, `image/jpeg`, `image/gif` or `image/webp` with a size within the cap shows inline in the viewer, with the download link kept. Larger images and every other type render as today.

## What to build

The viewer's HEAD branch gains an image case. For the four types, with a `Content-Length` of at most 10 MiB (a named constant), it renders an `<img>` on the capability URL. The image's alt text is the artifact's title, it is scaled to fit the pane with tokens only, and the "Download <name>" link stays below.
- An over-cap image keeps today's download view, with its size shown.
- SVG stays in the sandboxed frame.
- A folder child that is an image follows the same rule.
- A broken image shows the download view and a one-line note.

No hub change: the `/a/` route already serves these types. Spec §3.6 (images in the workbenches).

## Acceptance criteria

- [x] C1. In headless Chromium, PNG, JPEG, GIF and WebP artifacts each render as a loaded inline image with natural width above 0 in the viewer (test).
  - done: impl-1392 · 2026-10-27T23:41:37.683Z
  - verified: rev-31 [reviewer] · run rev-20261027-1392-final1 · 2026-10-27T23:59:39.296Z · commit d4b587e2f5c5404957f23954fb047d07cf1473be
- [x] C2. A PNG over the cap shows the download view with its size and no `<img>`, and an SVG still opens in the sandboxed frame (test).
  - done: impl-1392 · 2026-10-27T23:41:38.959Z
  - verified: rev-31 [reviewer] · run rev-20261027-1392-final1 · 2026-10-27T23:59:39.297Z · commit d4b587e2f5c5404957f23954fb047d07cf1473be

## Notes

Shared files: web/src/artifacts/ArtifactViewer.tsx, web/src/artifacts/ArtifactViewer.module.css

## Comments

### impl-1392 · 2026-10-27T23:40:42.045Z

Seams: existing sealed web/test/artifacts.test.ts Playwright + production frame artifact.create/url; browser canvas makes tiny PNG/JPEG/WebP and fixed GIF bytes, only scratch paths. No shared wire/schema/refusal/authority changes; no rule-20 migration needed. C1 baseline red: img png picture not visible in 3000ms; green 2.563s incl four formats, exact-10-MiB PNG and folder child. C2 baseline-viewer control red: missing 10,485,761 bytes; candidate green 1.068s incl file SVG sandbox and broken-image fallback. Local macOS arm64 Node 24.21.0, pinned Headless Shell; no Linux/suite evidence yet. Initial setup-only failure resolved by building stale/missing worktree assets; waits unchanged.

### rev-31 · 2026-10-27T23:44:08.878Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1392-source1
commit: d4b587e2f5c5404957f23954fb047d07cf1473be
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-12937: Standards0/Spec0 findings at d4b587e2f/treeca908f35. Four MIME types and named inclusive10MiB HEAD cap, artifact-title alt/pane-fit/no-referrer, retained capability download, byte-size over-cap fallback, sandboxed SVG and matching-URL decode fallback match scope. Two new cases extend existing sealed Web seam: actual naturalWidth>0 for four formats/exactcap/folder child and overcap-noimg/no-errornote/SVG sandbox/broken decode. Existing assertions unchanged; selected-id viewer keys prevent prior loaded image state carrying across selection. No shared wire/schema/authority/keyboard/role/command/dependency change; docs/hub/web/skill CHANGES align. A-12932 is manual local macOS selected14/14/build/typecheck/red-control evidence with original capture limits, not Linux/full proof; tracker-only precommit fast-forward verified. C1/C2 remain runtime-unverified. Submit one configured mode-free verify at unchanged reviewed head, then request original named-case/phase/executor/browser evidence review. Linux new-case>=3s allowance decision awaits actual timing; no newWebfile repetition claim. No extra merge or per-item QA requested. Reviewer read-only, no execution.

### rev-31 · 2026-10-27T23:59:39.297Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1392-final1
commit: d4b587e2f5c5404957f23954fb047d07cf1473be
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-12960 original-log audit of A-12959 at unchanged d4b587e2f/treeca908f35. Run16b95534 finished exit0 with3769ordinary passes,zero failure/cancel/skip/TODO. Exact C1 image-format/exactcap/folder case passes2.551572863s (finish19484/timing19485); C2 overcap-size/noimg/SVGsandbox/broken-decode case passes1.585214117s (19504/19505). All14 owning file cases pass; native fixture cleanup censusafter0/hubstopped retained. Verifies C1/C2 carrying source1A-12937. T0/allT1/fallback all hub+NeovimT2/Web complete; T3/T4 absent/deferred. Images execute once; Web0newfiles/0repetitionsrequired.25separate T1 documentation load passes are unrelated to image repetition. Linuxx64c-8lon1,Node24.21/Neovim0.12.5,HeadlessShell156.0.8078.4/v1248,configuredworkers2/Webshard4,lifetime718s/$0.0498 machineaccounting. HostgateTREE95f9ef379 reused,not secondremote typecheck. Lint/duration/ratchet report-only;134findings/61files,existing overruns retained. Coordinator6506b0a9 accepts no allowance: worstnew2.551572863s×1.5=3.8273592945s,below4sWebtrigger. No source/manifest change needed. LocalA-12932 remains separate macOS selected-summary evidence; no humanbrowser/physicalphone claim. Coordinator owns ready/enqueue and explicitly requests no extra fullsuite; no extra merge or per-item QA. Reviewer read-only, no execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-28T00:08:00.720Z

Merged de50d2522b463a33f7b86c45e9fced4479a3983f onto dev.
