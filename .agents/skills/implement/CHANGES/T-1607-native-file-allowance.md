# T-1607 aggregate native file allowance

Coordinator 8f8a0401 permits a split only if every case is at or below four
seconds in the two Linux x64 samples. A-16511 has frame launch 4.665092952 s
and reparented child 4.210327858 s; A-16517 has 4.280447828 s and 4.371144373 s.
Both exceed that threshold, so no test moves or fixture reduction are made.

The approved alternative is a file-only 90 s allowance, owner C-216, added
2026-11-04 and expiring 2026-11-11. Its reason keeps both aggregate samples:
58.659 s at 3bc5ba0d5 (A-16511) and 60.959 s at 60c445704 (A-16517).
The latter run is partial: assertions passed, T3 exited 1 on the file gate,
and T4/Web did not run. It is not a green receipt. No individual allowance,
test title, assertion, ownership gate, fixture bound or ordering is changed.
The production checker replays those recorded samples separately from a new
native run; a replay is not current-head coverage or wall time.
