---
id: T-1482
kind: task
title: "Landing page: the feature carousel becomes a grid of all features"
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1238
branch: t/T-1482-landing-page-the-feature-carousel
created: 2026-10-30T11:51:19.056Z
updated: 2026-10-30T12:15:04.565Z
---

## Summary

A landing-page reviewer on X (2026-10-27, replying to the cland account's post of cland.app) wrote: the feature cards sit in a carousel ("01 / 10"), so most of the depth stays behind an arrow; his fix was the first four as a plain grid with the rest behind a "See all" link. The human agreed on 2026-10-30 and chose, with the design session, a grid of all the features in a new order plus click counting instead of hiding six more behind a link. T-1479 added the remote-control slide the same day, so the carousel now holds eleven features, and only the first is seen by a visitor who does not press the arrow.

## What to build

A visitor who scrolls to "Built for shipping, not demos" sees every feature at once: a plain grid of compact cards, each with its number, title, text and "Learn more" link to its docs page, with nothing hidden behind arrows, dots, a counter or scroll-snap. Two columns on wide screens, one on a phone. The cards carry no screenshot or diagram; the hero and workbench sections keep theirs, and the docs pages keep the detail. The order puts cland's differentiators first: the harness one key away; every plan's limits in view; your crew in Telegram and Discord; only what needs you; a gate before every merge; your tracker in your repo; topics, not one noisy chat; plans with stages and lanes; verification for any stack; artifacts in the thread; releases from the item. The carousel script, its CSS and its carousel ARIA roles go away; each card keeps its `feature-<id>` anchor, and the "All features in the docs →" link stays under the grid. A click on a card's "Learn more" link sends a GoatCounter event named after the feature id, with no cookies and no personal data as the FAQ and the footer promise, so in a few weeks the human can see which features draw visitors.

## Acceptance criteria

- [x] C1. The features section of the landing page renders every entry of its feature list as a card in a CSS grid, in the order fixed in this item, with no carousel track, arrows, counter, dots or carousel script left in the page.
  - done: impl-1482 · 2026-10-30T11:56:30.207Z
- [x] C2. Each card shows the number, title, text and "Learn more" link only and keeps its `feature-<id>` anchor; the grid is two columns from the site's desktop breakpoint and one column below it.
  - done: impl-1482 · 2026-10-30T11:56:30.325Z
- [x] C3. A "Learn more" click sends a GoatCounter event named `feature-<id>`, and the FAQ and footer wording says the website counts visits and link clicks with no cookies or personal data.
  - done: impl-1482 · 2026-10-30T11:56:30.909Z
- [x] C4. The site builds (`npm run build` in site/), the docs link check passes and the source-boundary test that T-1479 extended still passes at the final head.
  - done: impl-1482 · 2026-10-30T11:56:31.286Z

## Publication

The site goes out through `cland publish` after an ask to the human, as for every marketing path. The human approved the change itself on 2026-10-30 in the design session; the publication ask is still due.

## References

- The `slides` list and the `#features` section of site/src/pages/index.astro; site/src/components/Screenshot.astro and Diagram.astro keep their carousel-specific props until nothing uses them.
- docs/brand/ for the wording rules; site/src/content/docs/docs/features.md lists every feature with its docs link.
- The reviewer's thread: Sam Vale, "Drop your landing page", X, 2026-10-27.

## Comments

### impl-1482 · 2026-10-30T11:52:41.889Z

Consumer inventory before changing the landing list: site/src/pages/index.astro owns list/render/script/styles; site/test/remote-docs.test.ts reads remote entry by id/href and remains compatible; site prebuild onboarding-claims test reads public source; screenshot inventory site/SCREENSHOTS.md names carousel placements and will be updated. Shared Screenshot/Diagram props remain available; hero/workbench and docs consumers stay unchanged. No hub wire/schema/persisted contract changes. Adding focused source regressions for C1–C4.

### impl-1482 · 2026-10-30T11:56:45.174Z

Implemented at 5c7b396165397c4937721a5da2cc3cfcb729f760; all four criteria done. Evidence A-14323. Consumer inventory amendment: after landing migration, Screenshot frame and Diagram compact had zero remaining Astro/MDX callers, so removed their obsolete props and frame CSS; default hero/workbench/docs rendering retained. Source request delivered to Reviewer. No per-item QA required (qaPolicy none). Awaiting verdict before one mode-free verification.

### rev-31 · 2026-10-30T11:58:06.896Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261030-1482-source1
commit: 5c7b396165397c4937721a5da2cc3cfcb729f760
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear,A-14327,treed83ae30d42cd145c85a94c4a1968a509a1220be6. Standards/Spec0findings:eleven features exactorder,compact semantic1/2-column900pxgrid,stableanchors/docslinks,carousel code/ARIA/styles removed;unused frame/compact props have no pinned-source callers. Static feature-id GoatCounter attributes match official Events documentation;FAQ/footer/README/screenshots inventory updated. Existing T1 wrapper covers new source regressions. C1–C4runtime-unverified pending original final-head configured receipts and localbuild/browser/docsfragment evidence;source tests alone do not prove runtime clicks/layout/build. A-14323 summary separate;new captured folder limitations preserved,including unversioned count.js bytes/hash gap and wrapperpartialtranscription. No Reviewer workloads/edits;QA none;publicationask outside review. Run one unchanged-head mode-free verify then final evidence request.

### rev-31 · 2026-10-30T12:15:04.565Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1482-evidence1
commit: 5c7b396165397c4937721a5da2cc3cfcb729f760
scope: evidence
findings: [{"severity":"medium","text":"Original configured4fc0ab74/A-14347 exits1: second-phone ask case times out3000ms waiting for exact Inbox archive question text. Final evidence cannot clear;retain original red and obtain lead/Coordinator diagnosis/retry disposition.","file":"web/test/phone-asks.test.ts","line":195}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence1notclear,A-14348;source1/A-14327 unchanged. Original same-head A-14347 independently4256ordinary(4255pass/1fail)+125extra loadpass;T0/T1/allfallbackT2pass,Webfail,T3/T4absent. Actual timeout text and source195:150 quoted in artifact;no flake/infra/task-cause classification by Reviewer. Four landing source cases base+5pass each retained,not a greenrun substitute. C1–C4 remain unverified;no new semantic criterionfailure inferred from separate phone timeout. Local A-14328 not finalaudited here,capturegaps retained. No Reviewer workloads/retry;lead/Coordinator own disposition;QA none.
