---
id: T-1392
kind: task
title: The web's artifact viewer renders PNG, JPEG, GIF and WebP inline under a size cap
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: topic-1128
branch: t/T-1392-the-web-s-artifact-viewer-renders-png
created: 2026-10-27T23:37:28.882Z
updated: 2026-10-27T23:38:24.987Z
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

- [ ] C1. In headless Chromium, PNG, JPEG, GIF and WebP artifacts each render as a loaded inline image with natural width above 0 in the viewer (test).
- [ ] C2. A PNG over the cap shows the download view with its size and no `<img>`, and an SVG still opens in the sandboxed frame (test).

## Notes

Shared files: web/src/artifacts/ArtifactViewer.tsx, web/src/artifacts/ArtifactViewer.module.css
