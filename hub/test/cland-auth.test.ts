// T3: executes the privileged helper itself with every external command stubbed.
// No sudo, device, real mount, process signalling, or provider is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixtureEnvironment } from './fixture-environment.ts';
import { testWaitMs } from './until.ts';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cland-auth-script-'));
  const bin = join(root, 'bin'); mkdirSync(bin);
  const log = join(root, 'commands'); writeFileSync(log, '');
  for (const command of ['mount', 'umount', 'fsfreeze', 'sync', 'fuser', 'mountpoint', 'findmnt', 'readlink', 'mkdir', 'chown', 'chmod', 'rmdir', 'sleep', 'flock']) {
    writeFileSync(join(bin, command), `#!/bin/bash\nprintf '%s %s\\n' '${command}' "$*" >> "$COMMAND_LOG"\nexit 0\n`, { mode: 0o755 });
  }
  const helper = join(root, 'cland-auth');
  writeFileSync(helper, readFileSync(new URL('../src/host/cland-auth.sh', import.meta.url), 'utf8').replace('/cland/auth/.operation.lock', join(root, 'operation.lock')));
  const env = fixtureEnvironment(root, process.env, { PATH: bin, COMMAND_LOG: log });
  return { root, bin, log, run: (args: string[]) => {
    const result = spawnSync('/bin/bash', [helper, ...args], { cwd: root, env, encoding: 'utf8', timeout: testWaitMs() });
    const diagnostic = `incomplete helper: exit=${result.status}, signal=${result.signal}, stderr=${result.stderr?.slice(-2000)}`;
    assert.equal(result.error, undefined, diagnostic);
    assert.equal(result.signal, null, diagnostic);
    return result;
  } };
}
test('C4: invalid helper arguments fail before any external command', () => {
  const f = fixture();
  try {
    for (const args of [[], ['mount'], ['unknown', 'volume', '/cland/auth/codex-work'], ['mount', '../volume', '/cland/auth/codex-work'], ['freeze', '-volume', '/cland/auth/codex-work'], ['thaw', 'volume', '/tmp/work'], ['umount', 'volume', '/cland/auth/../root'], ['freeze', 'volume', '/cland/auth/login'], ['thaw', 'volume', '/cland/auth/codex-work/child'], ['mount', 'volume', '/cland/auth/codex-work', 'extra']]) {
      const result = f.run(args);
      assert.equal(result.error, undefined);
      assert.notEqual(result.status, 0, JSON.stringify(args));
      assert.equal(readFileSync(f.log, 'utf8'), '', 'no command on refused input');
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});


test('helper dispatches freeze and thaw only for the matching mounted volume', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'findmnt'), '#!/bin/bash\nprintf "%s\\n" "51 /dev/disk/by-id/scsi-0DO_Volume_volume"\n', { mode: 0o755 });
    for (const op of ['freeze', 'thaw']) {
      const result = f.run([op, 'volume', '/cland/auth/codex-work']);
      assert.equal(result.status, 0, result.stderr);
    }
    assert.equal(readFileSync(f.log, 'utf8'), 'flock -x -w 30 9\nsync \nfsfreeze -f /cland/auth/codex-work\nflock -x -w 30 9\nfsfreeze -u /cland/auth/codex-work\n');
    writeFileSync(f.log, '');
    writeFileSync(join(f.bin, 'findmnt'), '#!/bin/bash\nprintf "%s\\n" "52 /dev/other"\n', { mode: 0o755 });
    const refused = f.run(['umount', 'volume', '/cland/auth/codex-work']);
    assert.equal(refused.status, 3);
    assert.equal(readFileSync(f.log, 'utf8'), 'flock -x -w 30 9\nreadlink -f /dev/disk/by-id/scsi-0DO_Volume_volume\n');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('unmount observes writers gone and refuses a disk with persistent writers', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'findmnt'), '#!/bin/bash\nprintf "%s\\n" "51 /dev/disk/by-id/scsi-0DO_Volume_volume"\n', { mode: 0o755 });
    writeFileSync(join(f.bin, 'fuser'), '#!/bin/bash\n[[ "$*" = "-s "*operation.lock ]] && exit 0\nprintf "fuser %s\\n" "$*" >> "$COMMAND_LOG"\nexit 1\n', { mode: 0o755 });
    assert.equal(f.run(['umount', 'volume', '/cland/auth/codex-work']).status, 0);
    assert.equal(readFileSync(f.log, 'utf8'), 'flock -x -w 30 9\nfuser -s -m -M /cland/auth/codex-work\nsync \numount /cland/auth/codex-work\nrmdir /cland/auth/codex-work\n');
    writeFileSync(f.log, '');
    writeFileSync(join(f.bin, 'fuser'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
    const result = f.run(['umount', 'volume', '/cland/auth/codex-work']);
    assert.equal(result.status, 4, result.stderr);
    assert.doesNotMatch(readFileSync(f.log, 'utf8'), /(?:^|\n)umount /);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});


test('writer probe errors and missing fuser never authorize unmount', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'findmnt'), '#!/bin/bash\nprintf "%s\\n" "51 /dev/disk/by-id/scsi-0DO_Volume_volume"\n', { mode: 0o755 });
    for (const [status, diagnostic] of [[127, 'missing census'], [2, 'probe failed'], [1, 'cannot inspect proc']] as const) {
      writeFileSync(f.log, '');
      writeFileSync(join(f.bin, 'fuser'), `#!/bin/bash\n[[ "$*" = "-s "*operation.lock ]] && exit 0\necho '${diagnostic}' >&2\nexit ${status}\n`, { mode: 0o755 });
      const result = f.run(['umount', 'volume', '/cland/auth/codex-work']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(diagnostic));
      assert.doesNotMatch(readFileSync(f.log, 'utf8'), /(?:^|\n)(umount|rmdir) /);
    }
    writeFileSync(f.log, '');
    unlinkSync(join(f.bin, 'fuser'));
    const missing = f.run(['umount', 'volume', '/cland/auth/codex-work']);
    assert.equal(missing.status, 6);
    assert.match(missing.stderr, /exit 127/);
    assert.doesNotMatch(readFileSync(f.log, 'utf8'), /(?:^|\n)(umount|rmdir) /);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('lost or replaced mount after admission refuses every later effect', () => {
  const f = fixture();
  try {
    for (const replacement of ['', '52 /dev/other', '52 /dev/disk/by-id/scsi-0DO_Volume_volume']) {
      for (const op of ['freeze', 'thaw', 'umount']) {
        writeFileSync(f.log, '');
        const receipt = join(f.root, 'observed'); writeFileSync(receipt, '');
        writeFileSync(join(f.bin, 'findmnt'), `#!/bin/bash\nread -r seen < '${receipt}' || true\nif [[ "$seen" != yes ]]; then printf 'yes\\n' > '${receipt}'; printf '51 /dev/disk/by-id/scsi-0DO_Volume_volume\\n'; else printf 'changed\\n' > '${receipt}'; printf '%s\\n' '${replacement}'; fi\n`, { mode: 0o755 });
        const result = f.run([op, 'volume', '/cland/auth/codex-work']);
        assert.notEqual(result.status, 0);
        assert.equal(readFileSync(receipt, 'utf8'), 'changed\n', 'fresh mount observation reached');
        assert.doesNotMatch(readFileSync(f.log, 'utf8'), /(?:^|\n)(fuser|fsfreeze|umount|rmdir) /);
      }
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('contended operation lock refuses before mount discovery or effects', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'flock'), '#!/bin/bash\nexit 75\n', { mode: 0o755 });
    assert.notEqual(f.run(['freeze', 'volume', '/cland/auth/codex-work']).status, 0);
    assert.equal(readFileSync(f.log, 'utf8'), '');
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('failed positive census and failed signal retain the mounted disk', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'findmnt'), '#!/bin/bash\nprintf "%s\\n" "51 /dev/disk/by-id/scsi-0DO_Volume_volume"\n', { mode: 0o755 });
    for (const stub of ['exit 1', '[[ "$1" = -k ]] && { echo "signal failed" >&2; exit 2; }; exit 0']) {
      writeFileSync(f.log, '');
      writeFileSync(join(f.bin, 'fuser'), `#!/bin/bash\n${stub}\n`, { mode: 0o755 });
      const result = f.run(['umount', 'volume', '/cland/auth/codex-work']);
      assert.equal(result.status, 6);
      assert.match(result.stderr, /incomplete/);
      assert.doesNotMatch(readFileSync(f.log, 'utf8'), /(?:^|\n)(umount|rmdir) /);
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('mount installs the requested scratch device and checks identity before permissions', () => {
  const f = fixture();
  try {
    const devices = join(f.root, 'devices'); mkdirSync(devices);
    const device = join(devices, 'scsi-0DO_Volume_volume'); writeFileSync(device, '');
    const helper = join(f.root, 'cland-auth');
    writeFileSync(helper, readFileSync(helper, 'utf8').replace('/dev/disk/by-id', devices));
    writeFileSync(join(f.bin, 'mountpoint'), '#!/bin/bash\nexit 32\n', { mode: 0o755 });
    writeFileSync(join(f.bin, 'findmnt'), `#!/bin/bash\nprintf '%s\\n' '51 ${device}'\n`, { mode: 0o755 });
    const result = f.run(['mount', 'volume', '/cland/auth/codex-work']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(f.log, 'utf8'), `flock -x -w 30 9\nmkdir -p /cland/auth/codex-work\nmount -o defaults,noatime,discard ${device} /cland/auth/codex-work\nchown runner:runner /cland/auth/codex-work\nchmod 700 /cland/auth/codex-work\n`);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('mount changes after the writer census fence signals and final unmount', () => {
  const f = fixture();
  try {
    for (const users of [true, false]) {
      const receipt = join(f.root, 'reads'); writeFileSync(receipt, '0\n');
      writeFileSync(f.log, '');
      writeFileSync(join(f.bin, 'findmnt'), `#!/bin/bash\nread -r count < '${receipt}'\ncount=$((count+1))\nprintf '%s\\n' "$count" > '${receipt}'\nif ((count < 4)); then printf '51 /dev/disk/by-id/scsi-0DO_Volume_volume\\n'; else printf '52 /dev/disk/by-id/scsi-0DO_Volume_volume\\n'; fi\n`, { mode: 0o755 });
      writeFileSync(join(f.bin, 'fuser'), `#!/bin/bash\nprintf 'fuser %s\\n' "$*" >> "$COMMAND_LOG"\n[[ "$*" = "-s "*operation.lock ]] && exit 0\nexit ${users ? 0 : 1}\n`, { mode: 0o755 });
      const result = f.run(['umount', 'volume', '/cland/auth/codex-work']);
      assert.equal(result.status, 3, result.stderr);
      assert.equal(readFileSync(receipt, 'utf8'), '4\n');
      assert.match(readFileSync(f.log, 'utf8'), /fuser -s -m -M /);
      assert.doesNotMatch(readFileSync(f.log, 'utf8'), /fuser -k|(?:^|\n)umount /);
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
