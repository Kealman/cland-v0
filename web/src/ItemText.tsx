import { createContext, useContext } from 'react';
import s from './ItemText.module.css';

export const ItemNavigation = createContext<{ open: (id: string) => void; prefixes: string[] }>({ open: () => {}, prefixes: ['T'] });
/** Plain text stays plain text; item references alone become navigation links. */
export function ItemText({ text }: { text: string }) {
  const { open, prefixes } = useContext(ItemNavigation);
  return text.split(/(\b[A-Z]-\d+\b)/g).map((part, index) => /^[A-Z]-\d+$/.test(part) && prefixes.includes(part[0]!)
    ? <a key={index} className={s.link} data-item-link={part} href={`#item/${part}`} onClick={event => { event.preventDefault(); open(part); }}>{part}</a>
    : part);
}
