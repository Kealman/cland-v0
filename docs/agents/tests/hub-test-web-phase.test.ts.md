# hub/test/web-phase.test.ts

This T1 file tests candidate capabilities, command plans and package phases with
scratch sources and no browser. A configured check stays first in every batch
plan, including candidates with no Web files. Candidates with no configured
check omit that step. Select Web in batches only for candidate diffs touching web/, independently of
T0. Assert Web follows T1 in command plans and assert package phases separately. Browser behavior belongs in the Web tier.
