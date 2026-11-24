---
id: T-2071
kind: task
title: A snapshot prepare's five-region image transfer hits DigitalOcean's request deadline, and a failed prepare may leave its image and builder behind
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: null
branch: null
created: 2026-11-24T08:59:26.627Z
updated: 2026-11-24T09:00:18.660Z
---

## Summary

Split from T-2008's 2026-11-24 comment by the 0.4.1 re-triage A-22763, which the human approved on ask 0d31338f. `cland executor prepare` failed after 1,433 s with "transfer: DigitalOcean 0 deadline: request deadline reached; image 256132409; regions ams3, fra1, nyc1, sfo2, blr1", with the builder lifetime and cost "unconfirmed". The builder cland-v0-fd861f52 showed "releasing; operator attention: deletion not confirmed" before it went away. Image 256132409 may remain as a partly transferred snapshot.

## What to build

Give the five-region image transfer a deadline that fits its measured duration, or transfer to the regions in use first and the rest asynchronously. Make a failed prepare delete its own image and confirm the builder's deletion and cost. All of this runs against the fake DigitalOcean API; tests use no real droplet or image.

## Acceptance criteria

- [ ] C1. A transfer slower than one request deadline but within the prepare budget completes, or a regional subset publishes, against the fake API (test).
- [ ] C2. A failed prepare deletes the image it created and reports the builder's confirmed lifetime and cost, or names what's still unconfirmed (test).
