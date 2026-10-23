import { createContext, useCallback, useState, type ReactNode } from 'react';
import { readInterfaceState, writeInterfaceState } from '../interface-state.ts';

export const TopicArtifacts = createContext<{ topic: string | undefined; opened: (topic: string) => void }>({ topic: undefined, opened: () => {} });

/** The last opened thread remains the attachment target after leaving Topics. */
export function TopicArtifactsProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState<string | undefined>(() => {
    const saved = readInterfaceState('artifact-topic');
    return typeof saved === 'string' ? saved : undefined;
  });
  const opened = useCallback((topic: string) => { setTopic(topic); writeInterfaceState('artifact-topic', topic); }, []);
  return <TopicArtifacts.Provider value={{ topic, opened }}>{children}</TopicArtifacts.Provider>;
}
