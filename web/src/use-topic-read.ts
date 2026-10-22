import { useEffect, useRef, type RefObject } from 'react';
import type { ConnectionState } from './connection.ts';
import type { TopicMessage } from '../../shared/wire/index.ts';

/** A read receipt names the last rendered message actually visible for a full second. */
export function useTopicRead(root: RefObject<HTMLDivElement | null>, connection: ConnectionState, topic: string, messages: readonly TopicMessage[] | undefined) {
  const { live, command } = connection;
  const reschedule = useRef<(() => void) | undefined>(undefined);
  const readSeq = connection.topics?.find(row => row.id === topic)?.readSeq ?? 0;
  useEffect(() => {
    const log = root.current;
    if (!log || !live || !command) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = '';
    const visible = () => {
      if (document.visibilityState !== 'visible' || !log.getClientRects().length) return undefined;
      const rect = log.getBoundingClientRect();
      if (rect.right <= 0 || rect.left >= innerWidth) return undefined;
      const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
      return [...log.querySelectorAll<HTMLElement>('[data-message-id]')].reverse().find(node => {
        const box = node.getBoundingClientRect();
        return box.bottom > top && box.top < bottom && Number(node.dataset.messageSeq) > readSeq;
      });
    };
    const schedule = () => {
      const id = visible()?.dataset.messageId ?? '';
      if (id === pending) return;
      clearTimeout(timer); pending = id;
      if (!id) return;
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible' && visible()?.dataset.messageId === id) {
          void command({ type: 'topic.read', topic, upTo: id }).catch(() => {});
        }
      }, 1000);
    };
    const observer = new IntersectionObserver(schedule);
    reschedule.current = schedule;
    observer.observe(log);
    const resize = new ResizeObserver(schedule);
    resize.observe(log);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
      reschedule.current = undefined;
      clearTimeout(timer); observer.disconnect(); resize.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [root, live, command, topic, readSeq]);
  useEffect(() => { reschedule.current?.(); }, [messages]);
}
