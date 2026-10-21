// T1: configuration-to-link rules and independently decoded QR vectors, no sockets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneOrigin } from '../src/web-address.ts';
import { terminalQr } from '../src/qr.ts';
import { decodeTerminalQr } from './qr-decode.ts';
import { checkWebNetwork } from '../src/doctor/web.ts';

test('the phone link prefers the tunnel, otherwise the concrete LAN interface', () => {
  assert.equal(phoneOrigin('192.0.2.4', 'https://phone.example', 1234), 'https://phone.example');
  assert.equal(phoneOrigin('192.0.2.4', '', 1234), 'http://192.0.2.4:1234');
  assert.equal(phoneOrigin('2001:db8::4', '', 1234), 'http://[2001:db8::4]:1234');
  assert.equal(phoneOrigin('0.0.0.0', '', 1234, ['127.0.0.1', '192.0.2.4']), 'http://192.0.2.4:1234');
  for (const bind of ['127.0.0.1', '127.0.0.2', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:0:0:1', '0.0.0.0', '::']) assert.throws(() => phoneOrigin(bind, '', 1234), /phone cannot reach loopback/);
});

test('half-block QR vectors decode to their exact LAN, IPv6 and tunnel links', () => {
  for (const url of [
    'http://192.0.2.4:1234/auth?token=0123456789abcdef'.padEnd(106, 'a'),
    'http://[2001:db8::4]:1234/auth?token=0123456789abcdef'.padEnd(114, 'f'),
    'https://phone.example:8443/auth?token=0123456789abcdef'.padEnd(120, '9'),
  ]) assert.equal(decodeTerminalQr(terminalQr(url)), url);
});

test('doctor network warnings cover wildcard, IPv4 and IPv6 binds, and tunnel/loopback exceptions', () => {
  for (const bind of ['0.0.0.0', '::', '192.0.2.4', '2001:db8::4']) {
    assert.equal(checkWebNetwork({ bind, port: 0, dist: '', origin: '' }).verdict, 'warn');
    assert.equal(checkWebNetwork({ bind, port: 0, dist: '', origin: 'https://phone.example' }).verdict, 'ok');
  }
  for (const bind of ['127.0.0.1', '127.0.0.2', '::1']) assert.equal(checkWebNetwork({ bind, port: 0, dist: '', origin: '' }).verdict, 'ok');
});

test('wildcard phone links skip scope-dependent IPv6 addresses and preserve tunnel precedence', () => {
  assert.equal(phoneOrigin('::', '', 1234, ['fe80::1', '192.0.2.4']), 'http://192.0.2.4:1234');
  assert.equal(phoneOrigin('::', '', 1234, ['febf::1', 'fd00::4']), 'http://[fd00::4]:1234');
  assert.throws(() => phoneOrigin('::', '', 1234, ['fe80::1']), /no phone-reachable LAN address.*link-local/);
  assert.throws(() => phoneOrigin('fe80::1', '', 1234), /no phone-reachable LAN address.*link-local/);
  assert.equal(phoneOrigin('::', 'https://phone.example', 1234, ['fe80::1']), 'https://phone.example');
  assert.equal(phoneOrigin('::', '', 1234, ['fe80::1%en0', 'ff02::1', '224.0.0.1', '0.0.0.0', '::', '192.0.2.4']), 'http://192.0.2.4:1234');
  assert.throws(() => phoneOrigin('::', '', 1234, ['::', 'ff02::1']), /no phone-reachable LAN address/);
});
