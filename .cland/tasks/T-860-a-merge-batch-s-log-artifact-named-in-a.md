---
id: T-860
kind: task
title: A merge batch's log artifact named in a member's item topic cannot be attached there (artifact-unavailable)
state: open
status: in progress
size: S
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-599
branch: t/T-860-a-merge-batch-s-log-artifact-named-in-a
created: 2026-10-19T08:15:52.852Z
updated: 2026-10-19T14:50:31.502Z
---

## Summary

The hub delivers a merge batch's suite result into each member item's topic and names its log artifact there (for example A-5878 in topic-563 for T-835). But the artifact lives in Agents, so a member lead that attaches it to a send in its own item topic is refused with `artifact-unavailable: artifact A-5878 is unavailable in this topic`.

## Evidence

Reported by impl-835 on 2026-10-19 08:14Z: batch 04289067 (T-832, T-835), run 39f2e57c, log A-5878. The refused attachment was not retried.

## Acceptance criteria

- [ ] C1. A lead can attach a batch log artifact named in a delivery to its own item topic: either the artifact is shared into every member's topic, or the delivery names the topic that holds it and attaching from a member topic is allowed by reference. A component test sends the batch result to a two-member batch and attaches the named log from each member topic.
