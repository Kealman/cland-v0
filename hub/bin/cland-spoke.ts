#!/usr/bin/env node
// The spoke a session's harness spawns as its stdio MCP server. Never exits on a hub failure; exits when the session ends.
import { runSpoke } from '../src/spoke/spoke.ts';

process.on('uncaughtException', (err) => process.stderr.write(`cland-spoke: uncaught: ${err.stack ?? err.message}\n`));
process.on('unhandledRejection', (err) => process.stderr.write(`cland-spoke: unhandled: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`));

await runSpoke();
