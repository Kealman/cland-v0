// T4: bounded archive/startup queries under large retained stores and protocol bursts.
import test from 'node:test';
import { archiveWorkload, inboxStartupWorkload } from './inbox-archive-workload.ts';
test('archive startup and event bursts retain bounded work at large-seed scale', t => archiveWorkload(t, {
  items: 2000, messages: 3000, processes: 256, events: 100,
}));
test('startup inbox queries stay bounded with large retained history and protocol bursts', t => inboxStartupWorkload(t, {
  processes: 256, messagePairs: 300, requests: 100, events: 100, turns: 20,
}));
