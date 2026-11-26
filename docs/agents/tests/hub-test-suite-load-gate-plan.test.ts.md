# hub/test/suite-load-gate-plan.test.ts

Completion-summary controls use fake log strings only: positive 5/5 success and
quarantine totals, duplicate identities, skips, interrupted start-only records,
and ambiguous legacy failure lines. A legacy complete failure and an interrupted
3/5 run share the same text, so neither supplies positive completion evidence.
This pure parser leaves the total unknown while retaining confirmed counts.
The large planted completion log contains 20,006 lines, including a final
unterminated partial receipt. A positively controlled split guard rejects a
whole-log array; scan counters bound newline searches to one forward pass and
line slices to 200 characters for this fixture. Identity sets still scale with
distinct reported identities; the scanner retains only its current line.

Pure T1 manifest fixture using A-19799 tier totals/projections: the 75-minute
deadline trims an oversized calibrated base; a 150-minute deadline fits
every tier with the reserve and trims expensive repetitions. Rotation proves all
files in a three-night cycle and includes each tier nightly. Calibration rejects
invalid measurements, retains its floor and adopts a larger later ratio. The
native-run interval helper consumes only the remote start log and remote finish:
missing/invalid/duplicate markers and nonpositive intervals remain unknown.
An in-memory multi-MB semantic log bounds matching to two regex-result
allocations, stopping as soon as a second valid marker proves ambiguity. It
retains the shared anchored pattern and needs no line arrays or native imports.
No native
process, provider, browser or real clock is involved.
