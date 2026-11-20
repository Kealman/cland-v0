// Native QA journey: scripted terminal setup chooses users and agent hosts.
// Lifecycle: setup machine joins CLI, daemon and provider before root disposal.
// Limitation (Coordinator decision): prepared fake pool; new DigitalOcean pool creation is T-2019.
import test from 'node:test';
import { terminalHostSetup } from '../support/terminal-host-setup.ts';
import { ownedJourney } from '../support/native-journey.ts';
test('one setup terminal chooses users and agent hosts with private invite capture', { timeout: 240_000 }, ownedJourney(terminalHostSetup));
