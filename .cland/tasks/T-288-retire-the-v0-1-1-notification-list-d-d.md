---
id: T-288
kind: task
title: Retire the v0.1.1 notification list, d/D and the 50-row cap from the inbox
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-274
blocked_by:
  - T-285
  - T-286
  - T-287
topic: topic-180
branch: t/T-288-retire-the-v0-1-1-notification-list-d-d
created: 2026-10-12T11:57:19.861Z
updated: 2026-10-12T20:04:27.886Z
---

## Summary

The inbox's v0.1.1 notification list leaves, with its `d`, `D` and 50-row cap, now that the events view shows notifications and events. The docs and the role clauses describe the inbox, the `request` kind and the events view.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**The inbox loses its notification list.** The panel and full-width inbox show only the four sections, the events line and the archive line. The notification block goes, along with `D`, `d`'s dismissal of a notification, the 50-row cap and its "earlier · Agents log" footer, and the row-tracking that followed a selected notification. `d` keeps only the meanings the acting-from-a-row ticket gave it. The action registry, the palette and `␣?` lose the retired keys.

**The hub.** Notifications stop being an inbox section. The `Inbox` frame no longer carries them, and the `inbox.dismiss` and `inbox.dismiss_all` frames are removed. A client still sending them gets a refusal that points to the events view. The hub keeps producing what notifications recorded (verdicts, role changes, deaths, long idles, uncertain deliveries, failed turns, releases, imports) as journal records that `events.list` shows. D17 holds: not-clear verdicts and deaths are warnings in the events view and never count in needsYou. `cland inbox` no longer prints notification lines. The stub hub, the hub tests and the QA cases that asserted notifications in the inbox move their assertions to `events.list` and the events view or drop them, and the needs-you QA cases keep their meaning.

**The docs and the clauses.**

- `hub/README.md` and `nvim/README.md` describe the inbox of four sections, the `request` kind, the leave reasons and the archive, and the events view with its frame, keys and filters. The v0.1.1 notification text, the dismissal rows of the key table and the cap go.
- The role clauses tell sessions when to send a `request` to the human instead of a report: an Implementer or a Lead asking for the human's review, QA asking for a QA run, a handover to the human. This goes in the default clauses and in this project's `.cland/roles.toml`, which cland never rewrites; running role sessions pick the new clause up only on their next launch.
- `GLOSSARY.md`'s Events view entry needs no change unless the wording drifted.

**Demo.** A clear verdict shows in the events view and never in the inbox. `d` on a notification row is impossible because the inbox has none, and `D` does nothing in the inbox.

**Constraints.**

- Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project) and the fake harnesses second. Neovim runs headless on the stub hub. QA cases in `qa/cases/` still pass.
- No new seams inside the hub.
- Neovim is the host with no plugins (ADR 0005).
- Suites run through `cland verify`, the full suite here because hub tests change.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.
- Role sessions pick up the new clauses on their next launch.

## Acceptance criteria

- [ ] The inbox shows no notification list, no `D`, no 50-row cap and no "earlier" footer; `d` acts only on requests and messages; the registry, palette and `␣?` no longer list the retired keys.
- [ ] `inbox.list` carries no notifications, `inbox.dismiss` and `inbox.dismiss_all` are refused with a pointer to the events view, and `cland inbox` prints no notification lines.
- [ ] A clear verdict and a role change appear in `events.list` and the events view and never in the inbox; a not-clear verdict and a death appear as warnings there and never change needsYou.
- [ ] The default role clauses and `.cland/roles.toml` tell sessions to send review, QA and handover requests to the human with the `request` kind.
- [ ] Targeted tests pass (hub frame tests on a real hub, nvim headless tests on the stub hub, the QA cases that touched the inbox), `cland verify` is green, and `hub/README.md`, `nvim/README.md` and the clauses describe the inbox, the `request` kind and the events view.

## Comments

### impl-288 · 2026-10-12T20:04:27.886Z

Started retirement at the existing protocol/CLI and headless UI seams. The real-hub tracer test is red because inbox.list still carries notifications. Journal notification records will stay; inbox notification storage and row actions will retire. T-284's C7 workload test remains in scope. Default clauses and this project's .cland/roles.toml will both change; running sessions receive the new clauses only when relaunched, so the Coordinator must relaunch after merge.
