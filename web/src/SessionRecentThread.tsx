import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { ConnectionState } from './connection.ts';
import { Thread, type ThreadControls } from './Thread.tsx';

/** Session traffic uses the shared numeric-page/live cache and thread presentation. */
export function SessionRecentThread({ session, connection, controls, composer = false, focusRequest }: { session: string; connection: ConnectionState; controls?: Ref<ThreadControls> | undefined; composer?: ReactNode; focusRequest?: number | undefined }) {
  const [ready, setReady] = useState(false);
  const thread = useRef<ThreadControls>(null);
  useImperativeHandle(controls, () => ({ focus: () => thread.current?.focus(), run: action => thread.current?.run(action) ?? false }), []);
  const source = connection.sessionThreads;
  useEffect(() => {
    if (!source) return;
    void source.refresh(session);
    setReady(true);
  }, [session, source]);
  useLayoutEffect(() => { if (ready && focusRequest) thread.current?.focus(); }, [ready, focusRequest]);
  return ready && source && <Thread connection={connection} topic={session} source={source} title={session} logLabel={`${session} recent thread`} composer={composer} controls={thread} />;
}
