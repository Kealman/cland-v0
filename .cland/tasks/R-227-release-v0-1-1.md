---
id: R-227
kind: release
version: 0.1.1
title: "v0.1.1"
state: closed
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-168
branch: null
created: 2026-10-11T17:47:48.488Z
updated: 2026-10-12T03:17:01.577Z
closed: 2026-10-12T03:14:27.001Z
---

## Goal

v0.1.1 makes the crew's machinery dependable: sessions stop, die and hand over work in ways the hub records correctly, and verification becomes a hub-owned service with a queue, a result cache and metrics instead of a machine-wide lock file.

## Notes

Scope by decision D21 (2026-10-11): everything from the v0.1 run that needs no human decision or design grilling. Three epics: Session lifecycle; Verification service; v0.1.1 hygiene. Items needing the human's decisions sit in v0.1.2 as backlog. Version 0.1.1 is the human's recorded version (D21).

Deferred checks. D23 (2026-10-12, stand-in cland-impl, for the human's morning review): T-229 C5 reads as "a hung tracker write is detected and named (tracker-storage-stalled event, hub status flag), and hub stop stays bounded and reports the abandoned write; the serving-time fail-fast exit is T-253 in v0.1.2".

## Comments

### coord · 2026-10-12T03:14:26.839Z

Released v0.1.1 at 99b1d66821cd9320bb01867f4de3682f44668b9b.

### qa-22 · 2026-10-12T03:17:01.577Z

verdict: qa
result: clear
by: qa-22 [qa]
run: qa-2026-10-12-22-p1
commit: 99b1d66821cd9320bb01867f4de3682f44668b9b

| Case | Surface | Result | Evidence |
|---|---|---|---|
| P1 | hub-api | PASS | A-1502: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1502-v0-1-1-post-release-qa-p1-clear/report.md |

Findings: none (high, medium or low).

Published v0.1.1: GitHub main, local main, territory main and peeled tag all equal 99b1d66821cd9320bb01867f4de3682f44668b9b. Annotated tag object bc5f47a846587bebe661c95627cc60adcba878fd matches all three. T-227 is closed; release comment and last released journal row match T-227/v0.1.1/full SHA, with no followUp.

Tag notes exactly match current Notes including D21 scope and D23 Deferred checks, then three epic deliverable lines (T-229, T-230, T-231), then 23 Item-trailer title lines and 12 other subjects in territory-release ordering since v0.1.0. Full inputs and exact comparison are in A-1502.

P1 Git/CLI reads had CLAND_* removed; no release/sync/push/merge or scratch hub. Runner dev 5249820a8e941778ddb1cf1e457d184111ae03ca differs only in the release tracker file. Authorized brief is Coordinator P1 request 2f1692d1-854b-428c-903a-d7c7f75740a1 plus A-1319, confirmed 8401145b-4a3e-4a69-bd1e-a678a134c361. Closed-item hold refusal respected. No hold or criterion marks for this post-check.
