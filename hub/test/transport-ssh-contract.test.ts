// T3: real fake-SSH child death and reconnect are the lifecycle under test.
// Lifecycle: stop carrier, drain children and sockets, then remove the disposable root.
import test from 'node:test';
import { transportContract } from './transport-contract.ts';
import { sshContractFixture } from './transport-contract-fixture.ts';
test('ssh carrier with fake sshd: C1–C7 four Unix endpoints relay and recover without TCP', { timeout: 20000 }, t => transportContract(t, sshContractFixture));
