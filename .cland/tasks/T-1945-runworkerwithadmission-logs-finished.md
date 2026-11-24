---
id: T-1945
kind: task
title: runWorkerWithAdmission logs "Finished" before persisting the worker receipt, so a throwing terminal log skips the durable receipt
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1723
branch: t/T-1945-runworkerwithadmission-logs-finished
created: 2026-11-17T12:20:13.013Z
updated: 2026-11-24T09:02:37.877Z
---

## Summary

In hub/src/hub/suite-worker-admission.ts, runWorkerWithAdmission calls options.log("Finished …") before options.persist(receipt), and nothing guards the log call. If the terminal log throws synchronously, the durable receipt is never written, even though the worker's outcome already exists (rules 25 and 39). Found by impl-1935 by reading the source during T-1935 (topic-1594, 2026-11-17); not reproduced.

## What to build

Persist the receipt first, or isolate the log so that its failure adds a secondary diagnostic and never prevents or replaces the receipt.

## Acceptance criteria

- [ ] C1. With a log callback that throws, the worker's receipt is still persisted with its original outcome, and the log failure is reported as a secondary diagnostic (test, fakes only).
- [ ] C2. The readers of the worker receipt are listed with their dispositions (rule 41).
