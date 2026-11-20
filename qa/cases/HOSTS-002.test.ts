// Native QA journey: web login mutations reach CLI and Neovim on one scratch hub.
// Lifecycle: native fixture and browser owners join all children before root disposal.
import test from 'node:test';
import { webLogins } from '../support/live-host-journeys.ts';
import { ownedJourney } from '../support/native-journey.ts';
test('web Hosts adds a login for the Neovim inbox and removes it from CLI inventory', { timeout: 240_000 }, ownedJourney(webLogins));
