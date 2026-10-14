// Injected through NODE_OPTIONS; observes the real daemon without a production seam.
import { Socket } from 'node:net';
import tls from 'node:tls';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

if (process.env.ACCOUNT_NETWORK_RECORD) appendFileSync(process.env.ACCOUNT_NETWORK_RECORD + '.loaded', String(process.pid) + '\n');

const record = (args: unknown[]) => {
  const first = args[0];
  const normalized = Array.isArray(first) ? first : args;
  const options = normalized[0];
  // Unix sockets have a path; numeric ports without a host default to localhost.
  if (typeof options === 'string' || typeof options === 'object' && options !== null && 'path' in options) return;
  const host = typeof options === 'object' && options !== null && 'host' in options ? String(options.host) : typeof normalized[1] === 'string' ? normalized[1] : 'localhost';
  if (host === 'localhost' || host === '::1' || host.startsWith('127.') || host.startsWith('::ffff:127.')) return;
  if (process.env.ACCOUNT_NETWORK_RECORD) appendFileSync(process.env.ACCOUNT_NETWORK_RECORD, JSON.stringify({ pid: process.pid, host }) + '\n');
};
const originalNet = Socket.prototype.connect;
Socket.prototype.connect = function (...args: unknown[]) { record(args); return Reflect.apply(originalNet, this, args); };
const originalTls = tls.connect;
tls.connect = function (...args: unknown[]) { record(args); return Reflect.apply(originalTls, this, args); };
syncBuiltinESMExports();
