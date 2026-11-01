// Project-owned human identities. No credentials or transport policy live here.
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export type SignInMode = 'single' | 'users';
export type User = { id: string; name: string; displayName: string; role: string; state: string; created: number };
export class Users {
  readonly #resetters: Array<() => void> = [];
  readonly #db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.#db = db;
    db.exec(`create table if not exists roles (name text primary key);
      insert or ignore into roles (name) values ('admin');
      create table if not exists users (id text primary key, name text not null unique,
        display_name text not null, role text not null references roles(name), state text not null, created integer not null);
      create table if not exists auth_state (singleton integer primary key check(singleton = 1),
        mode text not null check(mode in ('single','users')), set_at integer not null);`);
  }
  roles(): string[] { return (this.#db.prepare('select name from roles order by name').all() as { name: string }[]).map(row => row.name); }
  list(): User[] {
    return this.#db.prepare('select id, name, display_name as displayName, role, state, created from users order by created, rowid').all().map(row => ({ ...row })) as User[];
  }
  firstAdmin(displayName: string, collisions: readonly string[], now: number): User {
    const first = this.list()[0];
    if (first) return first;
    const name = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!name) throw new Error('user name needs an ASCII letter or number');
    if (['human', 'hub', 'all', 'coordinator', 'lead'].includes(name)) throw new Error(`reserved user name: ${name}`);
    if (collisions.includes(name)) throw new Error(`user name collision: ${name}`);
    const user: User = { id: randomUUID(), name, displayName, role: 'admin', state: 'active', created: now };
    this.#db.prepare('insert into users (id,name,display_name,role,state,created) values (?,?,?,?,?,?)').run(user.id, name, displayName, user.role, user.state, now);
    return user;
  }
  setMode(mode: SignInMode, now: number): void {
    this.#db.prepare('insert into auth_state values (1,?,?) on conflict(singleton) do update set mode=excluded.mode,set_at=excluded.set_at').run(mode, now);
  }
  /** Register only synchronous durable writes on this Store's database handle. */
  onReset(revoke: () => void): void { this.#resetters.push(revoke); }
  reset(now: number): void {
    this.#db.exec('begin immediate');
    try {
      for (const revoke of this.#resetters) revoke();
      this.setMode('single', now);
      this.#db.exec('commit');
    } catch (error) { this.#db.exec('rollback'); throw error; }
  }
  validateMode(mode: SignInMode, startupPath?: string): void {
    const row = this.#db.prepare('select mode from auth_state where singleton=1').get();
    if (mode === 'users' && (row?.mode !== 'users' || !this.#db.prepare('select 1 from users limit 1').get())) throw new Error(`users mode requires the authorized first admin; ${startupPath ? `set auth.mode = \"single\" in ${startupPath}, start the hub, then run` : 'run'} cland auth mode users`);
    if (mode === 'single' && row?.mode === 'users' && this.#db.prepare('select 1 from users limit 1').get()) throw new Error(startupPath
      ? `auth.mode is single but this project is in users mode (${this.list().length} users). To return to single mode, set auth.mode = "users" in ${startupPath}, start the hub, then run cland auth reset.`
      : 'users mode cannot return to single by editing config.toml; use cland auth reset');
  }
}
