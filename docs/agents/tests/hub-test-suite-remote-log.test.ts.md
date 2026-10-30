# hub/test/suite-remote-log.test.ts

`node --test hub/test/suite-remote-log.test.ts` uses a disposable suite fixture,
scripted remote receipts and fake scheduler time. No real worker, cloud machine
or browser runs. The first start acknowledgement stays pending; the second
starts the same admitted machine. The test observes reported completion, then
asserts the exact original remote receipt bytes immediately before the terminal
provenance footer, two start attempts and one admission header. Footer parsing
consumes the entire remaining suffix and verifies its admitted head and executor.
The shared `caseDeadlines` owner bounds setup separately and owns every action
and observation through fixture drain/close before root removal.
