---
id: T-1943
kind: task
title: Merge batch candidate trees and member heads expire, so batch evidence can't be replayed exactly later
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-17T11:58:45.463Z
updated: 2026-11-17T11:58:45.463Z
---

## Summary

T-1528's evaluation (A-20861) couldn't replay the A-15009 window exactly. The synthetic batch candidate commits (for example e7113310e) are no longer git objects, and all 12 empty-report batches' candidate trees differ from the retained final reviewed task trees. So historical negatives stay unknown, and any future enforce/run decision for batch selection rests on reconstructions. Found by impl-1528, topic-1601, 2026-11-17.

## What to build

Each batch keeps a durable, bounded record that lets it be replayed: the candidate tree id, base commit, member heads and selection inputs. The objects themselves stay reachable for a stated retention period, for example under a ref namespace that a later pruning step owns.

## Acceptance criteria

- [ ] C1. After a batch lands or fails, its candidate tree, base and member heads stay resolvable as git objects for the configured retention, and a replay helper can recompute its selection from them (test with a fake repo).
- [ ] C2. Retention is bounded, and the pruning that removes expired batch refs is documented and tested; it never runs gc/prune/repack on the live repo.
