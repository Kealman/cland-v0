// Native QA journey: both workbenches share one CLI-started fake-host hub.
// Lifecycle: native fixture and browser owners join all children before root disposal.
import test from 'node:test';
import { liveWorkbenches } from '../support/live-host-journeys.ts';
import { ownedJourney } from '../support/native-journey.ts';
test('both live workbenches render two host-named sessions and an outage', { timeout: 240_000 }, ownedJourney(liveWorkbenches));
