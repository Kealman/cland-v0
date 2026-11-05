#!/usr/bin/env node
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFile, readFile, unlink, chmod, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureEnvironment } from '../fixture-environment.ts';
import { hostPath } from './fake-host.ts';
import { parseSsh, authenticate, controlRequest, hostOwner, sameOwner } from './fake-ssh-common.ts';
import type { Forward, Control } from './fake-ssh-common.ts';
try {
  const parsed = parseSsh(process.argv.slice(2));
  const host = await authenticate(parsed.options, parsed.destination);
  const owner = await hostOwner(host.directory);
  if (parsed.operation) {
    if (!parsed.options.controlpath) throw new Error('missing control path');
    await controlRequest(parsed.options.controlpath, { operation: parsed.operation, forwards: parsed.forwards, owner });
  } else if (!parsed.master) {
    if (!parsed.command.length) throw new Error('missing command');
    const env = fixtureEnvironment(host.directory, process.env, { CLAND_FAKE_HOSTS: process.env.CLAND_FAKE_HOSTS, CLAND_FAKE_HOST_ROOT: process.env.CLAND_FAKE_HOST_ROOT, CLAND_HOST_BOOT_ID_FILE: join(host.directory, 'boot-id') });
    const child = spawn('/bin/sh', ['-c', parsed.command.join(' ')], { cwd: host.home, env, stdio: 'inherit' });
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => child.kill(signal));
    await new Promise<void>((resolve, reject) => { child.on('error', reject); child.on('close', (code, signal) => { process.exitCode = code ?? (signal ? 255 : 0); resolve(); }); });
  } else {
    const control = parsed.options.controlpath;
    if (!control || control === 'none') throw new Error('master requires control socket');
    const token = randomUUID();
    let ready = false;
    const listeners = new Map<string, { server: net.Server; connections: Set<net.Socket> }>();
    const sockets = new Set<net.Socket>();
    function track(socket: net.Socket) { sockets.add(socket); socket.on('error', () => socket.destroy()); socket.once('close', () => sockets.delete(socket)); return socket; }
    async function add(forward: Forward) {
      const parts = forward.spec.split(':');
      const listen = parts.shift()!;
      if (!/^(\/|~\/)/.test(listen) || parts.length < 1 || parts.length > 2) throw new Error('TCP listen forwards are forbidden');
      const local = forward.direction === 'L';
      const path = local ? listen : await hostPath(host.home, listen);
      let target: string;
      if (parts.length === 2) {
        if (!local || !['localhost', '127.0.0.1', '[::1]'].includes(parts[0]!) || !/^\d+$/.test(parts[1]!)) throw new Error('only host loopback destination ports are supported');
        const ports = JSON.parse(await readFile(join(host.directory, 'ports.json'), 'utf8')) as Record<string, string>;
        if (!ports[parts[1]!]) throw new Error('unmapped fake host loopback port');
        target = await hostPath(host.home, ports[parts[1]!]!);
      } else target = local ? await hostPath(host.home, parts[0]!) : parts[0]!;
      const key = `${forward.direction}:${forward.spec}`;
      if (listeners.has(key)) throw new Error('forward already exists');
      if (!local || parsed.options.streamlocalbindunlink === 'yes') await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
      const connections = new Set<net.Socket>();
      const server = net.createServer({ allowHalfOpen: true }, incoming => {
        const a = track(incoming), b = track(net.createConnection({ path: target, allowHalfOpen: true }));
        for (const socket of [a, b]) { connections.add(socket); socket.once('close', () => connections.delete(socket)); }
        a.pipe(b).pipe(a); a.once('close', () => b.destroy()); b.once('close', () => a.destroy());
      });
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
      await chmod(path, 0o600);
      listeners.set(key, { server, connections });
    }
    async function cancel(forward: Forward) {
      const key = `${forward.direction}:${forward.spec}`;
      const entry = listeners.get(key);
      if (!entry) throw new Error('unknown forward');
      for (const socket of entry.connections) socket.destroy();
      await new Promise<void>(resolve => entry.server.close(() => resolve())); listeners.delete(key);
    }
    for (const forward of parsed.forwards) await add(forward);
    const server = net.createServer({ allowHalfOpen: true }, socket => {
      let line = '';
      socket.setTimeout(3000, () => socket.destroy());
      socket.on('error', () => socket.destroy());
      socket.on('data', data => { line += data; if (line.length > 65536) socket.destroy(); });
      socket.on('end', () => { void (async () => {
        const request = JSON.parse(line) as Control;
        if (!ready) throw new Error('fake master not ready');
        if (!sameOwner(request.owner, owner) || request.operation === 'kill-master' && request.token !== token) throw new Error('fake master owner mismatch');
        if (request.operation === 'forward') for (const f of request.forwards) await add(f);
        else if (request.operation === 'cancel') for (const f of request.forwards) await cancel(f);
        else if (!['check', 'exit', 'kill-master'].includes(request.operation)) throw new Error('unsupported control operation');
        socket.end('ok\n', () => { if (request.operation === 'exit') process.exit(0); if (request.operation === 'kill-master') process.kill(process.pid, 'SIGKILL'); });
      })().catch(error => socket.end(`${(error as Error).message}\n`)); });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(control, resolve); });
    await chmod(control, 0o600);
    const record = join(host.directory, 'master-control');
    const pending = `${record}.${token}`;
    await writeFile(pending, JSON.stringify({ control, owner, token }), { mode: 0o600 });
    await rename(pending, record);
    ready = true;
    process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
  }
} catch (error) { console.error((error as Error).message); process.exit(255); }
