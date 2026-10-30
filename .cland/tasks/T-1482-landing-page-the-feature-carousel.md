---
id: T-1482
kind: task
title: "Landing page: the feature carousel becomes a grid of all features"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: null
created: 2026-10-30T11:51:19.056Z
updated: 2026-10-30T11:51:19.056Z
---

## Summary

A landing-page reviewer on X (2026-10-27, replying to the cland account's post of cland.app) wrote: the feature cards sit in a carousel ("01 / 10"), so most of the depth stays behind an arrow; his fix was the first four as a plain grid with the rest behind a "See all" link. The human agreed on 2026-10-30 and chose, with the design session, a grid of all the features in a new order plus click counting instead of hiding six more behind a link. T-1479 added the remote-control slide the same day, so the carousel now holds eleven features, and only the first is seen by a visitor who does not press the arrow.

## What to build

A visitor who scrolls to "Built for shipping, not demos" sees every feature at once: a plain grid of compact cards, each with its number, title, text and "Learn more" link to its docs page, with nothing hidden behind arrows, dots, a counter or scroll-snap. Two columns on wide screens, one on a phone. The cards carry no screenshot or diagram; the hero and workbench sections keep theirs, and the docs pages keep the detail. The order puts cland's differentiators first: the harness one key away; every plan's limits in view; your crew in Telegram and Discord; only what needs you; a gate before every merge; your tracker in your repo; topics, not one noisy chat; plans with stages and lanes; verification for any stack; artifacts in the thread; releases from the item. The carousel script, its CSS and its carousel ARIA roles go away; each card keeps its `feature-<id>` anchor, and the "All features in the docs →" link stays under the grid. A click on a card's "Learn more" link sends a GoatCounter event named after the feature id, with no cookies and no personal data as the FAQ and the footer promise, so in a few weeks the human can see which features draw visitors.

## Acceptance criteria

- [ ] C1. The features section of the landing page renders every entry of its feature list as a card in a CSS grid, in the order fixed in this item, with no carousel track, arrows, counter, dots or carousel script left in the page.
- [ ] C2. Each card shows the number, title, text and "Learn more" link only and keeps its `feature-<id>` anchor; the grid is two columns from the site's desktop breakpoint and one column below it.
- [ ] C3. A "Learn more" click sends a GoatCounter event named `feature-<id>`, and the FAQ and footer wording says the website counts visits and link clicks with no cookies or personal data.
- [ ] C4. The site builds (`npm run build` in site/), the docs link check passes and the source-boundary test that T-1479 extended still passes at the final head.

## Publication

The site goes out through `cland publish` after an ask to the human, as for every marketing path. The human approved the change itself on 2026-10-30 in the design session; the publication ask is still due.

## References

- The `slides` list and the `#features` section of site/src/pages/index.astro; site/src/components/Screenshot.astro and Diagram.astro keep their carousel-specific props until nothing uses them.
- docs/brand/ for the wording rules; site/src/content/docs/docs/features.md lists every feature with its docs link.
- The reviewer's thread: Sam Vale, "Drop your landing page", X, 2026-10-27.
