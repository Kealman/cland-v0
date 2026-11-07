import { ProvisionRecords } from './provision-records.ts';
// Host persistence and private bootstrap material. Admission belongs to the socket edge.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { parseTransportKind, type TransportKind } from './transport-kind.ts';
import { SOCKET_PATH_MAX } from '../project.ts';
import { hostDirectory } from '../../../shared/fake-host-directory.ts';

export type HostRecord = { id: string; transport: TransportKind; address: string; user: string; state: 'registered' | 'revoked' };
export type HostRegistration = { id: string; address: string; user: string; clientKeyPath: string; knownHosts: string };
const digest = (secret: string) => createHash('sha256').update(secret).digest('hex');
function hostId(id: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id) || id === 'local') throw new Error('invalid host id');
}
export class HostRecords {
  readonly provisions:ProvisionRecords;
  readonly #db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.#db = db;
    db.exec(`create table if not exists hosts (
      id text primary key, transport text not null, address text not null,
      user text not null, state text not null, secret_digest text not null
    )`);
    this.provisions=new ProvisionRecords(db);
    db.exec(`create trigger if not exists revoke_host_provision after update of state on hosts when new.state='revoked' begin
      update provisioned_hosts set record=json_set(record,'$.state','failed','$.reason','host revoked','$.release',case when json_extract(record,'$.release')='released' then 'released' else 'incomplete' end) where id=new.id;
    end;`);
  }
  get(id: string): HostRecord | null {
    const row = this.#db.prepare('select id,transport,address,user,state from hosts where id=?').get(id);
    return row ? { ...row, transport: parseTransportKind(row.transport) } as HostRecord : null;
  }
  list(): HostRecord[] { return this.#db.prepare('select id,transport,address,user,state from hosts order by id').all().map(row => ({ ...row, transport: parseTransportKind(row.transport) })) as HostRecord[]; }
  /** Storage primitive; callers own admission and connection revocation. */
  revoke(id: string): void { this.#db.prepare("update hosts set state='revoked' where id=?").run(id); }
  insert(input: HostRegistration, secret: string): HostRecord {
    hostId(input.id);
    this.#db.prepare("insert into hosts (id,transport,address,user,state,secret_digest) values (?,'ssh',?,?,'registered',?)").run(input.id, input.address, input.user, digest(secret));
    return this.get(input.id)!;
  }
  /** Match revoked digests too, so admission can distinguish revocation without exposing material. */
  identify(secret: string): HostRecord | null {
    const hash = Buffer.from(digest(secret), 'hex');
    for (const row of this.#db.prepare('select id,secret_digest from hosts').all()) {
      if (typeof row.secret_digest === 'string' && /^[a-f0-9]{64}$/.test(row.secret_digest)
        && timingSafeEqual(Buffer.from(row.secret_digest, 'hex'), hash)) return this.get(String(row.id));
    }
    return null;
  }
  matches(id: string, secret: string): boolean {
    const row = this.#db.prepare("select secret_digest from hosts where id=? and state != 'revoked'").get(id);
    if (!row || typeof row.secret_digest !== 'string' || !/^[a-f0-9]{64}$/.test(row.secret_digest)) return false;
    return timingSafeEqual(Buffer.from(row.secret_digest, 'hex'), Buffer.from(digest(secret), 'hex'));
  }
}

export function hostPaths(root: string, id: string) {
  hostId(id);
  const directory = join(root, '.cland', 'run', 'hosts', id);
  const name = `cland-h-${digest(root + '\0' + id).slice(0, 20)}`;
  const candidates = [directory, join(tmpdir(), name), join('/tmp', name)];
  // Leave room for SSH's temporary control suffix as well as long session names.
  const socketDirectory = candidates.find(path => Buffer.byteLength(join(path, 's-' + 'f'.repeat(24) + '.sock')) <= SOCKET_PATH_MAX - 20)!;
  return { directory, socketDirectory, secret: join(directory, 'secret'),
    clientKeyPath: join(directory, 'client-key-path'), knownHosts: join(directory, 'known_hosts'),
    agentSocket: join(socketDirectory, 'agent.sock'), gitSocket: join(socketDirectory, 'git.sock'), controlSocket: join(socketDirectory, 'ctl.sock'),
    sessionSocket: (session: string) => join(socketDirectory, `s-${digest(session).slice(0, 24)}.sock`) };
}
function privateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) throw new Error('unsafe host directory');
  chmodSync(path, 0o700);
}
export class HostSecretStore {
  readonly #root: string;
  readonly #records: HostRecords;
  readonly #register: (values: readonly string[]) => void;
  constructor(root: string, records: HostRecords, register: (values: readonly string[]) => void = () => {}) {
    this.#root = root; this.#records = records; this.#register = register;
  }
  register(input: HostRegistration): HostRecord {
    const paths = hostPaths(this.#root, input.id);
    if (this.#records.get(input.id)) throw new Error('host already registered');
    const secret = randomBytes(32).toString('hex');
    this.#register([secret]);
    privateDirectory(paths.directory);
    privateDirectory(paths.socketDirectory);
    // Refuse leftover material from an interrupted registration instead of adopting it.
    const written: string[] = [];
    try {
      for (const [path, value] of [[paths.secret, secret], [paths.knownHosts, input.knownHosts], [paths.clientKeyPath, input.clientKeyPath]] as const) {
        writeFileSync(path, value, { mode: 0o600, flag: 'wx' }); written.push(path);
      }
      return this.#records.insert(input, secret);
    } catch {
      for (const path of written) rmSync(path, { force: true });
      throw new Error('host registration failed');
    }
  }
  /** Bootstrap callers deliver these bytes only on stdin, never argv or frames. */
  readSecret(id: string): string {
    if (this.#records.get(id)?.state !== 'registered') throw new Error('host secret unavailable');
    const path = hostPaths(this.#root, id).secret;
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) throw new Error('unsafe host secret file');
    const secret = readFileSync(path, 'utf8');
    if (!this.#records.matches(id, secret)) throw new Error('host secret unavailable');
    this.#register([secret]);
    return secret;
  }
  restore(): void { for (const host of this.#records.list()) if (host.state === 'registered') this.readSecret(host.id); }
}

export function registerFakeHosts(root: string, records: HostRecords, env: NodeJS.ProcessEnv, register: (values: readonly string[]) => void): void {
  const secrets = new HostSecretStore(root, records, register);
  secrets.restore();
  if (!env.CLAND_FAKE_HOSTS || !env.CLAND_FAKE_HOST_ROOT) return;
  if (!isAbsolute(env.CLAND_FAKE_HOST_ROOT)) throw new Error('fake host root must be absolute');
  const registeredAddresses=new Set(records.list().map(record=>record.address));
  for (const id of env.CLAND_FAKE_HOSTS.split(',').filter(Boolean)) {
    hostId(id);
    if (records.get(id) || registeredAddresses.has(id) || records.provisions.ownsFakeAddress(id)) continue; // Revoked hosts never mint automatically on restart.
    const fake = hostDirectory(env.CLAND_FAKE_HOST_ROOT, id);
    const key = readFileSync(join(fake, 'host-key.pub'), 'utf8').trim();
    secrets.register({ id, address: id, user: 'agent', clientKeyPath: join(fake, 'client-key'), knownHosts: `${id} ${key}\n` });
  }
}
