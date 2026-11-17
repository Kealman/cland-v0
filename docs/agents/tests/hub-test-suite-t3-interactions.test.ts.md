# hub/test/suite-t3-interactions.test.ts

`node --test hub/test/suite-t3-interactions.test.ts` runs T2 candidate-file
selection with fake Git. It checks report-only T3 selection under the T2/Web run
switch, a zero-addition control, old transport compatibility and bounded summary
fields. It launches no Git, harness, browser or provider process.

The offline evaluation script `hub/test/t3-interaction-replay.ts` accepts the
durable A-15009 Markdown artifact and an output JSON path. It copies Git into an
independent disposable mirror with the shared scratch environment builder, reads
immutable candidate sources, and never opens the hub database. It executes no
historical tests. Run it only with the Coordinator's native slot. Projections
use the retained A-15009 duration manifest, not fresh platform measurements.
