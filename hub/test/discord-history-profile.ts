import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { RemoteStore } from '../src/remote/state.ts';
import { DiscordApi } from '../src/remote/discord-api.ts';
import { Dispatcher } from '../src/hub/dispatch.ts';
import type { TestContext } from 'node:test';

/** Test-only timings overlap (native reaction time includes fetch); never add them. */
export function discordHistoryProfile(t: TestContext) {
  const metrics: Record<string, { calls: number; ms: number; rows?: number }> = {};
  const record = (name: string, start: number, rows?: number) => {
    const value = metrics[name] ??= { calls: 0, ms: 0 };
    value.calls++; value.ms += performance.now() - start;
    if (rows !== undefined) value.rows = (value.rows ?? 0) + rows;
  };
  const exec = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function(sql) {
    const start = performance.now();
    try { return exec.call(this, sql); }
    finally { if (/^(commit|release)/i.test(sql)) record('sqliteCommitOrRelease', start); }
  };
  const transaction = Store.prototype.transaction;
  Store.prototype.transaction = function(this: Store, fn) {
    const start = performance.now();
    try { return transaction.call(this, fn); } finally { record('storeTransactionInclusive', start); }
  } as typeof transaction;
  const outbox = RemoteStore.prototype.outbox;
  RemoteStore.prototype.outbox = function(...args) {
    const start = performance.now(); const rows = outbox.apply(this, args);
    record('outboxRead', start, rows.length); return rows;
  };
  const reaction = DiscordApi.prototype.addReaction;
  DiscordApi.prototype.addReaction = async function(...args) {
    const start = performance.now();
    try { return await reaction.apply(this, args); } finally { record('nativeReactionInclusive', start); }
  };
  const open = Dispatcher.prototype.open;
  Dispatcher.prototype.open = function(...args) {
    const port = open.apply(this, args), receive = port.receive;
    port.receive = (...input) => {
      const start = performance.now();
      try { return receive(...input); }
      finally { if (JSON.parse(input[0]).type === 'topic.send') record('topicSendFanoutInclusive', start); }
    };
    return port;
  };
  const fetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    const start = performance.now();
    try { return await fetch(...args); } finally { record('loopbackFetchHeadersInclusive', start); }
  };
  t.after(() => {
    DatabaseSync.prototype.exec = exec; Store.prototype.transaction = transaction;
    RemoteStore.prototype.outbox = outbox; DiscordApi.prototype.addReaction = reaction;
    Dispatcher.prototype.open = open; globalThis.fetch = fetch;
  });
  return { reset: () => { for (const key of Object.keys(metrics)) delete metrics[key]; },
    snapshot: () => JSON.parse(JSON.stringify(metrics)) as typeof metrics };
}
