---
id: T-2001
kind: task
title: remote-scripted 'acquires, delivers, starts, collects' intermittently times out waiting 15 s for a frame in loaded T2 batches
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1721
branch: t/T-2001-remote-scripted-acquires-delivers-starts
created: 2026-11-19T09:55:31.440Z
updated: 2026-11-24T09:02:28.925Z
---

## Summary

`remote-scripted` case "scripted remote verification acquires, delivers, starts, collects and releases on the hub clock" failed once in a local multi-file T2 batch (impl-1729, T-1729, 2026-11-19, macOS, Node 24.21, load about 6.2) with `Error: no frame matched within 15000ms`. The last observed run state was `launching`, the remote queue holder pid was null, and the fake timestamp was 2026-10-16T12:00Z. Run alone, it passed 5/5 at dev 8431152db and 5/5 with T-1729's change, so it's an intermittent wait race in the test, not attributable to T-1729.

## What to build

Find the event the case waits for and replace the 15 s frame poll with a wait on the producer's receipt (rule 9), so a slow batch run can't miss or outlast the frame. Keep the assertion's meaning.

## Acceptance criteria

- [ ] C1. The case waits on a positive receipt for the frame it needs instead of a time-bound poll, and passes 20/20 in a loaded multi-file T2 batch (test, evidence).
- [ ] C2. The literal failure above is reproduced or explained with evidence before the change (evidence).
