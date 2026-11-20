// Native QA journey: one CLI-started scratch hub; doctor combines three faults.
// Lifecycle: fixture owners join the daemon and fake API before directory disposal.
import test from 'node:test';
import { combinedDoctor } from '../support/host-user-journeys.ts';
import { ownedJourney } from '../support/native-journey.ts';

test('doctor on one scratch hub names stale image, signed-out login and missing token fixes', { timeout: 120_000 }, ownedJourney(combinedDoctor));
