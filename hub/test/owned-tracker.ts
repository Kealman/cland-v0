import { DatabaseSync } from 'node:sqlite';
import { Tracker } from '../src/tracker/tracker.ts';

type Options = ConstructorParameters<typeof Tracker>[0];
type Owner = { requireClose: (close: () => Promise<void>) => void };

/** A rejected native close never authorizes root disposal. */
export function ownedDatabases(owner: Owner, stop?: () => Promise<void> | undefined) {
  const connections = new Set<DatabaseSync>();
  owner.requireClose(async () => {
    const closing = stop?.();
    if (closing) await closing;
    else for (const connection of connections) if (connection.isOpen) connection.close();
    if ([...connections].some(connection => connection.isOpen)) throw new Error('tracker database close unconfirmed; root retained');
  });
  return (path: string, open = (path: string) => new DatabaseSync(path)) => {
    const connection = open(path);
    connections.add(connection);
    return connection;
  };
}

/** Register before the native open/constructor; transfer disposal only on return. */
export function ownedTracker(owner: Owner, options: Options): Tracker {
  let tracker: Tracker | undefined;
  const open = ownedDatabases(owner, () => tracker?.stop());
  tracker = new Tracker({...options, openDatabase: path => open(path, options.openDatabase)});
  return tracker;
}
