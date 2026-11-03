// T3: the fake transport is the real carrier plus fake SSH, per A-15561.
// Lifecycle: stop carrier, drain children and sockets, then remove the disposable root.
import test from 'node:test';
import { transportContract } from './transport-contract.ts';
import { sshContractFixture } from './transport-contract-fixture.ts';
test('fake transport pairing: C1–C7 four Unix endpoints relay and recover without TCP', { timeout: 20000 }, t => transportContract(t, sshContractFixture));
