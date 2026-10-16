// Packed as the exact-version binary by offline release-check CLI fixtures. No MCP or real model.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const config = JSON.parse(readFileSync(process.env.OPENCODE_CONFIG, 'utf8'));
for (const key of ['HOME', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'OPENCODE_DB'])
  assert.ok(process.env[key].includes('cland-opencode-check-'), `${key} must be isolated`);
assert.equal(process.env.OPENAI_API_KEY, undefined);
const streams = new Set();
const emit = type => { for (const res of streams) res.write(`data: ${JSON.stringify({ type, data: { sessionID: 'ses_smoke' } })}\n\n`); };
const server = createServer(async (req, res) => {
  if (req.headers.authorization !== `Basic ${Buffer.from(`opencode:${process.env.OPENCODE_PASSWORD}`).toString('base64')}`) { res.writeHead(401); res.end(); return; }
  if (req.url === '/api/event') {
    res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(': open\n\n');
    streams.add(res); req.on('close', () => streams.delete(res)); return;
  }
  const send = data => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (req.url === '/api/info') { send({ version: '2.0.30' }); return; }
  if (req.method === 'POST' && req.url === '/api/session/ses_smoke/prompt') {
    req.resume();
    await new Promise(resolve => req.on('end', resolve));
    send({ data: { id: 'msg_smoke' } });
    const r = await fetch(`${config.providers['cland-smoke'].settings.baseURL}/chat/completions`, { method: 'POST', body: '{}' });
    await r.text();
    for (const type of ['session.execution.started', 'session.inbox.delivered', 'session.step.started', 'session.step.ended', 'session.execution.succeeded']) emit(type);
    return;
  }
  if (req.url === '/api/session' || req.url === '/api/session/ses_smoke') { send({ data: { id: 'ses_smoke', model: { providerID: 'cland-smoke', id: 'smoke' } } }); return; }
  if (req.url === '/api/session/active') { send({ data: {} }); return; }
  if (req.url === '/api/session/ses_smoke/message') { send({ data: [{ id: 'msg_assistant', type: 'assistant' }] }); return; }
  if (req.url === '/api/session/ses_smoke/message/msg_assistant') { send({ data: { id: 'msg_assistant', type: 'assistant' } }); return; }
  send({ data: [] });
});
server.listen(0, '127.0.0.1', () => console.log(`server listening on http://127.0.0.1:${server.address().port}`));
process.on('SIGTERM', () => { for (const res of streams) res.end(); server.closeAllConnections(); server.close(); });
