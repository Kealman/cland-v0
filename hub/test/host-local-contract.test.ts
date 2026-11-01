// T3: native local Host process contract; no hub, provider or transport is started.
// Lifecycle: disposable root/environment; stop and observe all children before removal.
import test from 'node:test';
import { hostContract } from './host-contract.ts';
import { localHost } from '../src/host/local.ts';
// Keep Node's generated test location on this executable file for exact-name replay.
hostContract(localHost, (name, run) => test(name, run), { name: 'local', limitPolls: true });
