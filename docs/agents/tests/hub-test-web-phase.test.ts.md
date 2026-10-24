# hub/test/web-phase.test.ts

This T1 file tests candidate capabilities, command plans and package phases with
scratch sources and no browser. A configured check stays first in every batch
plan, including candidates with no Web files. Candidates with no configured
check omit that step. Keep Web exclusion independent of T0, and assert package
phases separately from command plans. Browser behavior belongs in the Web tier.
