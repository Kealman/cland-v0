# hub/test/web-phase.test.ts

This T1 file tests candidate capabilities, command plans and package phases with
scratch sources and no browser. A configured check stays first in every batch
plan, including candidates with no Web files. Candidates with no configured
check omit that step. Select Web in batches only for candidate diffs touching web/, independently of
T0. Assert Web follows T1 in command plans and assert package phases separately. Browser behavior belongs in the Web tier.

T-1200 uses the pure new-file planner, repetition callback and terminal-summary
parser to prove ten completed file repetitions on exactly two lanes, and rejects
partial/skipped/failing/unloaded evidence. The verify summary retains the exact
count in report mode. These controls start no CPU worker or child process;
the real sealed child/CPU lifecycle contract lives in `suite-runner.test.ts`.

Host baseline selection uses a scripted Git-reader seam: resolve the merge base
of HEAD and fetched dev, then list that ancestor's Web files. Test new, existing
and renamed paths and a newer dev tip that already contains a candidate file.
The runner accepts the carried list, intersects it with the current phase,
distinguishes checked `[]` from an absent field and reports missing proof only
for the latter. Selection transport validates the additive field; cache identity
keeps missing, empty and populated lists distinct. No runner Git fallback exists.
