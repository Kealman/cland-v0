#!/usr/bin/env python3
"""PROTOTYPE (ticket #11): compare what the screen shows in a session window
(tmux capture-pane) with what the terminal buffer holds (CP.visible over RPC).
A difference after a float closed is the misrendering of neovim#40915.

usage: compare_screen.py <capture.txt> <visible.json> [<visible-after.json>]
A row counts as equal if it matches the buffer in any of the snapshots.
"""
import json
import sys

screen = open(sys.argv[1], encoding="utf-8").read().split("\n")
snaps = [json.load(open(p, encoding="utf-8")) for p in sys.argv[2:]]
vis = snaps[0]
if "error" in vis:
    print("UNCLEAR:", vis["error"])
    sys.exit(0)

col, width = vis["col"], vis["width"]
lines = [l.rstrip() for l in vis["lines"]]
alts = [[l.rstrip() for l in s["lines"]] for s in snaps if "lines" in s and len(s["lines"]) == len(lines)]


def rows_at(offset):
    out = []
    for k in range(len(lines)):
        r = vis["row"] + offset + k
        cell = screen[r][col:col + width].rstrip() if r < len(screen) else ""
        out.append(cell)
    return out


best = None
for offset in (0, 1):  # the winbar may or may not count as part of the window
    got = rows_at(offset)
    diff = [k for k in range(len(lines)) if all(got[k] != a[k] for a in alts)]
    if best is None or len(diff) < len(best[1]):
        best = (offset, diff, got)

offset, diff, got = best
if not diff:
    print(f"MATCH: all {len(lines)} visible rows on screen equal the buffer (offset {offset})")
else:
    print(f"MISMATCH: {len(diff)} of {len(lines)} visible rows differ (offset {offset})")
    for k in diff[:20]:
        print(f"  row {k:2d} buffer: {lines[k]!r}")
        print(f"         screen: {got[k]!r}")
