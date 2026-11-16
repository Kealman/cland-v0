---
id: T-1859
kind: task
title: A droplet run stops on a region's 'size not available' instead of trying the next region
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-14T18:24:03.472Z
updated: 2026-11-16T07:31:25.777Z
---

## Summary

A droplet run whose create call returns DigitalOcean `422 unprocessable_entity: Size is not available in this region` ends the whole run instead of trying the next configured region. T-1831's mode-free verify 3c705d47 (2026-11-14 ~18:22Z, log A-19419) stopped this way in ams3 with c-8, after a passing T0. Earlier today, regions whose size is missing from the catalog (fra1 for c-8) were skipped correctly, but a capacity refusal at create time is not handled.

## What to build

The droplet executor treats a create-time "size not available in this region" (422) as region-local. It records the refusal in the run log and tries the next region in `[verification.droplet] regions`. Only when every region refuses does the run end, with one reason naming each region and its refusal. No machine is left behind, and spend reservation and release stay exact.

## Acceptance criteria

- [ ] C1. With the fake DigitalOcean API returning that 422 for the first region and success for the second, a run is created in the second region and its log names the first refusal (test).
- [ ] C2. When every configured region refuses, the run ends with one reason listing each region's refusal, leaves no machine, and releases its spend reservation (test).
